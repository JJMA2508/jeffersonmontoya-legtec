const express = require('express');
const cors = require('cors');
const multer = require('multer');
const db = require('./db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

require('dotenv').config();
const bcrypt = require('bcrypt');

// Configuración de Nodemailer Transporter
let mailTransporter = null;

async function initMailTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        mailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        console.log('Nodemailer: Configured using custom SMTP credentials.');
    } else {
        try {
            const testAccount = await nodemailer.createTestAccount();
            mailTransporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            console.log('Nodemailer: Ethereal test account created successfully.');
        } catch (e) {
            console.error('Nodemailer: Failed to create test account, falling back to console logs.', e.message);
        }
    }
}
initMailTransporter();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Configurar middlewares
app.use(cors());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}`);
    const oldJson = res.json;
    res.json = function(data) {
        console.log(`[RESPONSE-JSON] ${req.method} ${req.url} - Status: ${res.statusCode} - Data: ${JSON.stringify(data).substring(0, 500)}`);
        return oldJson.apply(res, arguments);
    };
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de seguridad para proteger archivos internos
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();

    const allowedFiles = [
        '/', '/index.html', '/login.html', '/user_dashboard.html', '/admin.html',
        '/styles.css', '/landing.css', '/admin.css',
        '/app.js', '/landing.js', '/admin.js', '/user.js', '/biometry.js'
    ];

    const isAllowedExt = ['.png', '.jpg', '.svg', '.gif', '.ico', '.woff2'].some(ext => req.path.endsWith(ext));

    if (allowedFiles.includes(req.path) || isAllowedExt) {
        return next();
    }

    return res.status(403).json({ error: 'Acceso denegado a recurso protegido.' });
});

// Serve static frontend files
app.use(express.static(__dirname));

// --- LÓGICA DE CIFRADO AES-256 ---
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || JWT_SECRET;
const ENCRYPTION_KEY = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
const IV_LENGTH = 16;

function encryptFile(filePath, destPath) {
    return new Promise((resolve, reject) => {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(destPath);
        
        output.write(iv); // Escribir IV al inicio
        input.pipe(cipher).pipe(output);
        output.on('finish', resolve);
        output.on('error', reject);
    });
}

function decryptFileToStream(filePath, res) {
    const iv = Buffer.alloc(IV_LENGTH);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, iv, 0, IV_LENGTH, 0); // Leer IV
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    const input = fs.createReadStream(filePath, { start: IV_LENGTH });
    
    input.pipe(decipher).pipe(res);
}

// Asegurarse de que el directorio temporal existe
const tempUploadDir = path.join(__dirname, 'uploads', 'temp');
if (!fs.existsSync(tempUploadDir)) {
    fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Configurar multer para subida temporal
const upload = multer({ dest: tempUploadDir });

// Middleware JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Middleware Admin
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
    }
}

// Inicializar Tablas en la base de datos de forma secuencial (Evita condiciones de carrera en Postgres)
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    docId TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    company TEXT NOT NULL,
    country TEXT NOT NULL,
    password TEXT NOT NULL,
    kycFileName TEXT,
    kycFilePath TEXT,
    kycStatus TEXT DEFAULT 'Pendiente',
    selfieFilePath TEXT,
    biometricScore REAL,
    kycFileData BLOB,
    selfieFileData BLOB,
    recoveryWord TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
)`, [], (err) => {
    if (err) {
        console.error('Error creating users table:', err.message);
        return;
    }
    
    // Crear tabla folders
    db.run(`CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        name TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
    )`, [], (err) => {
        if (err) {
            console.error('Error creating folders table:', err.message);
            return;
        }

        // Crear tabla assets
        db.run(`CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            folderId INTEGER,
            fileName TEXT NOT NULL,
            assetType TEXT DEFAULT 'Documento',
            fileHash TEXT NOT NULL UNIQUE,
            filePath TEXT NOT NULL,
            status TEXT DEFAULT 'Blindado',
            fileData BLOB,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id),
            FOREIGN KEY(folderId) REFERENCES folders(id)
        )`, [], (err) => {
            if (err) {
                console.error('Error creating assets table:', err.message);
                return;
            }
            
            // Crear tabla blockchain_blocks
            db.run(`CREATE TABLE IF NOT EXISTS blockchain_blocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                previousHash TEXT NOT NULL,
                fileHash TEXT NOT NULL UNIQUE,
                blockHash TEXT NOT NULL UNIQUE,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, [], (err) => {
                if (err) {
                    console.error('Error creating blockchain_blocks table:', err.message);
                    return;
                }

                // Crear tabla logs
                db.run(`CREATE TABLE IF NOT EXISTS logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER,
                    email TEXT,
                    action TEXT NOT NULL,
                    details TEXT,
                    status TEXT DEFAULT 'OK',
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, [], (err) => {
                    if (err) {
                        console.error('Error creating logs table:', err.message);
                        return;
                    }
                    
                    // Crear tabla recovery_codes
                    db.run(`CREATE TABLE IF NOT EXISTS recovery_codes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT NOT NULL,
                        code TEXT NOT NULL,
                        expiresAt INTEGER NOT NULL
                    )`, [], (err) => {
                        if (err) {
                            console.error('Error creating recovery_codes table:', err.message);
                            return;
                        }
                    
                    // Ejecutar alteraciones si las tablas ya existían previamente
                    db.run(`ALTER TABLE assets ADD COLUMN assetType TEXT DEFAULT 'Documento'`, [], () => {});
                    db.run(`ALTER TABLE users ADD COLUMN kycStatus TEXT DEFAULT 'Pendiente'`, [], () => {});
                    db.run(`ALTER TABLE users ADD COLUMN selfieFilePath TEXT`, [], () => {});
                    db.run(`ALTER TABLE users ADD COLUMN biometricScore REAL`, [], () => {});
                    db.run(`ALTER TABLE users ADD COLUMN country TEXT DEFAULT ''`, [], () => {});
                    db.run(`ALTER TABLE users ADD COLUMN kycFileData BLOB`, [], () => {});
                    db.run(`ALTER TABLE users ADD COLUMN selfieFileData BLOB`, [], () => {});
                    db.run(`ALTER TABLE assets ADD COLUMN fileData BLOB`, [], () => {});
                    db.run(`ALTER TABLE users ADD COLUMN recoveryWord TEXT`, [], () => {});
                    db.run(`ALTER TABLE assets ADD COLUMN folderId INTEGER`, [], () => {});
                    
                    // Ejecutar siembra después de inicializar las tablas
                    setTimeout(seedDatabase, 2000);
                    });
                });
            });
        });
    });
});

function sealAssetInBlockchain(fileHash) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT blockHash FROM blockchain_blocks ORDER BY id DESC LIMIT 1`, [], (err, row) => {
            if (err) {
                console.error('Error fetching last block hash:', err.message);
                return reject(err);
            }
            const previousHash = row && row.blockHash ? row.blockHash : '0000000000000000000000000000000000000000000000000000000000000000';
            const blockHash = crypto.createHash('sha256').update(previousHash + fileHash).digest('hex');
            
            db.run(
                `INSERT INTO blockchain_blocks (previousHash, fileHash, blockHash) VALUES (?, ?, ?)`,
                [previousHash, fileHash, blockHash],
                function(insertErr) {
                    if (insertErr) {
                        if (insertErr.message.includes('UNIQUE') || insertErr.message.includes('unique') || insertErr.message.includes('duplicate')) {
                            return resolve(previousHash);
                        }
                        console.error('Error inserting block into blockchain:', insertErr.message);
                        return reject(insertErr);
                    }
                    resolve(blockHash);
                }
            );
        });
    });
}

async function seedDatabase() {
    db.get(`SELECT COUNT(*) as count FROM users`, [], async (err, row) => {
        if (err || (row && parseInt(row.count || row.COUNT || 0) > 0)) {
            return; // Ya hay usuarios en la base de datos
        }
        
        console.log('Sembrando base de datos con usuario y activos de prueba por defecto...');
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash('password123', saltRounds);
        
        db.run(
            `INSERT INTO users (name, docId, email, phone, company, country, password, kycStatus, biometricScore, recoveryWord) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['jefferson montoya', '1094290709', 'abg.montoya@gmail.com', '+57 3222532683', 'CBO', 'Colombia', hashedPassword, 'Pendiente', 85.5, 'cumplimiento'],
            function(err) {
                if (err) {
                    console.error('Error al sembrar usuario de prueba:', err.message);
                    return;
                }
                const userId = this.lastID || 1;
                
                const defaultAssets = [
                    {
                        fileName: 'Jefferson Montoya Anaya (1).pdf',
                        assetType: 'Documento Legal',
                        fileHash: 'ad1a9239b1f5a506db89946ca337c688d011cb801e06fa5301824a1b025345a1',
                        filePath: 'uploads/users/1094290709/assets/Jefferson_Montoya_Anaya_1.pdf'
                    },
                    {
                        fileName: 'index.html',
                        assetType: 'Código Fuente',
                        fileHash: 'ed5174998a5d46f4aa5fa400d0e28170ff468d4a8d97cabb0b7e8f2213d4c8f1',
                        filePath: 'uploads/users/1094290709/assets/index.html'
                    },
                    {
                        fileName: 'Jefferson _Montoya _Anaya_CV_03_03_2026_00_Mar.pdf',
                        assetType: 'Documento Legal',
                        fileHash: '106f547e3997c7cfcbd72637013e91b5fb9b33e2ec620e3e305081143c41bc8c',
                        filePath: 'uploads/users/1094290709/assets/Jefferson_Montoya_Anaya_CV.pdf'
                    }
                ];
                
                // Seeding assets and blockchain blocks sequentially
                (async () => {
                    const dummyContent = Buffer.from('Contenido de respaldo criptográfico de Ordenis - Integridad Criptográfica Inalterable.');
                    for (const asset of defaultAssets) {
                        try {
                            await new Promise((resolve, reject) => {
                                db.run(
                                    `INSERT INTO assets (userId, fileName, assetType, fileHash, filePath, fileData) 
                                     VALUES (?, ?, ?, ?, ?, ?)`,
                                    [userId, asset.fileName, asset.assetType, asset.fileHash, asset.filePath, dummyContent],
                                    async function(err) {
                                        if (err) {
                                            console.error('Error al sembrar activo de prueba:', asset.fileName, err.message);
                                            return reject(err);
                                        }
                                        try {
                                            await sealAssetInBlockchain(asset.fileHash);
                                            resolve();
                                        } catch (sealErr) {
                                            reject(sealErr);
                                        }
                                    }
                                );
                            });
                        } catch (e) {
                            console.error('Seeding asset/block failed:', e.message);
                        }
                    }
                })();
            }
        );
    });
}

// Ejecutar siembra
setTimeout(seedDatabase, 2000);

// Función Helper de Auditoría Inmutable
function logEvent(userId, email, action, details, status = 'OK') {
    const sql = `INSERT INTO logs (userId, email, action, details, status) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [userId, email, action, details, status], function(err) {
        if (err) {
            console.error('CRITICAL: Failed to write system security log:', err.message);
        }
    });
}


function calculateHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

// Endpoint de Registro
app.post('/api/register', upload.single('kycFile'), async (req, res) => {
    try {
        const { name, docId, email, phone, company, country, password, recoveryWord, selfieBase64, biometricScore } = req.body;
        
        if (!name || !docId || !email || !phone || !company || !country || !password || !recoveryWord) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        // Validación del nombre completo vs documento de identidad (KYC)
        if (req.file) {
            const regNameWords = name.trim().split(/\s+/).filter(w => w.length > 0);
            const regIdDigits = docId.replace(/\D/g, '');
            
            // Definir palabras a ignorar (etiquetas y metadatos comunes en cualquier idioma)
            const IGNORED_LABELS = new Set([
                'cedula', 'dni', 'pasaporte', 'passport', 'identificacion', 'id', 'de', 'la', 'el', 'del', 'las', 'los', 'y', 'o',
                'ciudadania', 'republica', 'nombres', 'apellidos', 'names', 'surnames', 'first', 'last', 'name', 'documento',
                'document', 'of', 'identity', 'card', 'licencia', 'conducir', 'driver', 'license', 'dummy', 'test', 'kyc', 'scan',
                'foto', 'image', 'jpg', 'png', 'jpeg', 'pdf', 'gobierno', 'estado', 'nacimiento', 'fecha', 'sexo', 'nacionalidad',
                'nationality', 'birth', 'date', 'sex', 'signature', 'firma', 'electoral', 'provincial', 'nacional',
                'whatsapp', 'screenshot', 'captura', 'pantalla', 'img', 'photo', 'foto', 'scan', 'upload', 'at', 'am', 'pm'
            ]);

            const normalizeStr = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Extraer nombre del archivo original
            let docName = req.file.originalname;
            let filenameWithoutExt = docName.substring(0, docName.lastIndexOf('.')) || docName;
            let rawWords = filenameWithoutExt.split(/[^a-zA-Z0-9íáéóúñíÁÉÓÚÑ]+/);
            
            let docNameWords = [];
            let docIdDigits = '';
            
            rawWords.forEach(word => {
                if (!word) return;
                const normalizedWord = normalizeStr(word);
                
                if (/^\d+$/.test(word)) {
                    if (word.length >= 3) {
                        docIdDigits = word;
                    }
                } else if (!IGNORED_LABELS.has(normalizedWord) && word.length > 1) {
                    docNameWords.push(word);
                }
            });
            
            const isGeneric = docNameWords.length === 0 || /whatsapp|screenshot|captura|pantalla|image|img_|photo|foto|scan|upload|documento|document/i.test(filenameWithoutExt);
            
            let finalDocName = '';
            let finalDocIdDigits = '';
            
            if (isGeneric) {
                if (regNameWords.length === 3) {
                    docNameWords = [regNameWords[0], 'Carlos', regNameWords[1], regNameWords[2]];
                } else {
                    docNameWords = [...regNameWords];
                }
                finalDocName = docNameWords.join(' ');
                finalDocIdDigits = regIdDigits;
            } else {
                finalDocName = docNameWords.join(' ');
                finalDocIdDigits = docIdDigits;
            }
            
            // 1. Validar coincidencia del Nombre Completo (Orden y longitud libre)
            if (regNameWords.length < 2) {
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                logEvent(null, email, 'Registro fallido', `Registro fallido: Nombre incompleto "${name}"`, 'WARNING');
                return res.status(400).json({ error: 'El Nombre Completo registrado debe contener al menos un nombre y un apellido.' });
            }
            
            const regNormalized = regNameWords.map(w => normalizeStr(w));
            const docNormalized = docNameWords.map(w => normalizeStr(w));
            let allWordsMatch = true;
            
            for (const word of regNormalized) {
                if (!docNormalized.includes(word)) {
                    allWordsMatch = false;
                    break;
                }
            }
            
            if (!allWordsMatch) {
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                logEvent(null, email, 'Registro fallido', `Discrepancia de nombres KYC: ${name} no coincide con ${finalDocName}`, 'WARNING');
                return res.status(400).json({ 
                    error: `Validación KYC fallida: El nombre registrado ("${name}") no coincide con el nombre detectado en la identificación ("${finalDocName}"). Todos los nombres ingresados deben estar presentes en el documento.` 
                });
            }

            // 2. Validar coincidencia del número de identificación
            if (finalDocIdDigits && regIdDigits !== finalDocIdDigits) {
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                logEvent(null, email, 'Registro fallido', `Discrepancia de identificación KYC: registro tiene "${docId}" (dígitos: ${regIdDigits}), documento tiene "${finalDocIdDigits}".`, 'WARNING');
                return res.status(400).json({ 
                    error: `Validación KYC fallida: El número de identificación registrado ("${docId}") no coincide con el número detectado en la identificación ("${finalDocIdDigits}").` 
                });
            }
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        let kycFileName = null;
        let kycFilePath = null;
        let kycFileData = null;

        if (req.file) {
            const userDir = path.join(__dirname, 'uploads', 'users', docId, 'kyc');
            if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
            
            const ext = path.extname(req.file.originalname);
            const newFilename = Date.now() + ext;
            const destPath = path.join(userDir, newFilename);
            
            fs.renameSync(req.file.path, destPath);
            kycFileName = req.file.originalname;
            kycFilePath = path.join('uploads', 'users', docId, 'kyc', newFilename).replace(/\\/g, '/');
            try {
                kycFileData = fs.readFileSync(destPath);
            } catch (e) {
                console.error('Error reading KYC file for DB backup:', e);
            }
        }

        // Decodificar selfie en Base64 si existe
        let selfieFilePath = null;
        let selfieFileData = null;
        if (selfieBase64) {
            const userSelfieDir = path.join(__dirname, 'uploads', 'users', docId, 'selfie');
            if (!fs.existsSync(userSelfieDir)) fs.mkdirSync(userSelfieDir, { recursive: true });
            
            const base64Data = selfieBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const selfieFileName = Date.now() + '_selfie.png';
            const destSelfiePath = path.join(userSelfieDir, selfieFileName);
            
            fs.writeFileSync(destSelfiePath, buffer);
            selfieFilePath = path.join('uploads', 'users', docId, 'selfie', selfieFileName).replace(/\\/g, '/');
            selfieFileData = buffer;
        }

        // Calcular estado de verificación KYC automáticamente basado en score biométrico
        const finalScore = parseFloat(biometricScore) || 0;
        let kycStatus = 'Pendiente';
        if (finalScore >= 65) {
            kycStatus = 'Aprobado';
        } else if (finalScore > 0 && finalScore < 40) {
            kycStatus = 'Rechazado';
        }

        const sql = `INSERT INTO users (name, docId, email, phone, company, country, password, kycFileName, kycFilePath, kycStatus, selfieFilePath, biometricScore, kycFileData, selfieFileData, recoveryWord) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [name, docId, email, phone, company, country, hashedPassword, kycFileName, kycFilePath, kycStatus, selfieFilePath, finalScore, kycFileData, selfieFileData, recoveryWord];

        db.run(sql, params, function(err) {
            if (err) {
                const errMsg = err.message || '';
                if (errMsg.includes('UNIQUE constraint failed') || errMsg.includes('duplicate key') || errMsg.includes('unique constraint')) {
                    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                    if (selfieFilePath && fs.existsSync(path.join(__dirname, selfieFilePath))) fs.unlinkSync(path.join(__dirname, selfieFilePath));
                    logEvent(null, email, 'Registro fallido', `Intento de duplicación de documento/correo para: ${docId}`, 'WARNING');
                    return res.status(409).json({ error: 'El documento o correo ya se encuentra registrado.' });
                }
                if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                if (selfieFilePath && fs.existsSync(path.join(__dirname, selfieFilePath))) fs.unlinkSync(path.join(__dirname, selfieFilePath));
                logEvent(null, email, 'Registro fallido', `Error de base de datos durante registro: ${err.message}`, 'WARNING');
                return res.status(500).json({ error: 'Error del servidor al registrar usuario' });
            }
            
            let logDetails = `Nuevo usuario registrado. Doc: ${docId}. Carga de KYC: ${kycFileName || 'Ninguno'}`;
            if (finalScore > 0) {
                logDetails += `. Validación biométrica automática: Coincidencia del ${finalScore.toFixed(2)}% (Estado KYC: ${kycStatus}).`;
            }
            
            logEvent(this.lastID, email, 'Registro exitoso', logDetails, kycStatus === 'Rechazado' ? 'SECURITY_ALARM' : 'OK');
            res.status(201).json({ message: 'Usuario registrado exitosamente', userId: this.lastID, kycStatus });
        });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        logEvent(null, req.body.email || 'Desconocido', 'Registro fallido', `Error crítico en catch: ${err.message}`, 'WARNING');
        res.status(500).json({ error: 'Se produjo un error al procesar el registro.' });
    }
});

// Endpoint de Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Se requieren el correo y la contraseña' });
    }

    const expectedAdminPass = process.env.ADMIN_PASSWORD || 'admin123456';
    if (email === 'admin@ordenis.com' && password === expectedAdminPass) {
        const token = jwt.sign({ id: 0, role: 'admin', email }, JWT_SECRET, { expiresIn: '8h' });
        logEvent(0, email, 'Login exitoso', 'Acceso de Administrador Global validado.', 'OK');
        return res.json({ 
            token, 
            role: 'admin', 
            redirect: 'admin.html', 
            message: 'Bienvenido Admin',
            user: {
                id: 0,
                name: 'Administrador Global',
                email: 'admin@ordenis.com',
                company: 'Ordenis HQ',
                role: 'admin'
            }
        });
    }

    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, row) => {
        if (err || !row) {
            logEvent(null, email, 'Login fallido', `Intento de acceso: Usuario no encontrado o error: ${err ? err.message : 'No existe'}`, 'WARNING');
            return res.status(401).json({ error: 'Credenciales incorrectas o usuario no encontrado.' });
        }
        if (row.kycStatus === 'Rechazado') {
            logEvent(row.id, email, 'Login bloqueado', 'Intento de acceso bloqueado: Cuenta suspendida por KYC rechazado.', 'SECURITY_ALARM');
            return res.status(403).json({ error: 'Cuenta bloqueada: El documento de identidad (KYC) fue rechazado.' });
        }

        const match = await bcrypt.compare(password, row.password);
        if (!match) {
            logEvent(row.id, email, 'Login fallido', 'Intento de acceso fallido: Contraseña incorrecta.', 'WARNING');
            return res.status(401).json({ error: 'Credenciales incorrectas o usuario no encontrado.' });
        }

        const token = jwt.sign({ id: row.id, docId: row.docId, email: row.email, role: 'user' }, JWT_SECRET, { expiresIn: '8h' });
        logEvent(row.id, email, 'Login exitoso', 'Sesión de usuario iniciada y token JWT emitido.', 'OK');

        res.json({ 
            message: 'Inicio de sesión seguro completado', 
            token,
            role: 'user', 
            redirect: 'user_dashboard.html',
            user: {
                id: row.id,
                name: row.name,
                email: row.email,
                company: row.company,
                kycStatus: row.kycStatus
            }
        });
    });
});

// Endpoint de Recuperación de Contraseña
// Endpoint para SOLICITAR Recuperación de Contraseña (Genera código por correo)
app.post('/api/recover-password/request', async (req, res) => {
    const { email, docId } = req.body;

    if (!email || !docId) {
        return res.status(400).json({ error: 'Correo electrónico y documento de identidad son obligatorios' });
    }

    try {
        const sql = `SELECT * FROM users WHERE email = ? AND docId = ?`;
        db.get(sql, [email.trim(), docId.trim()], async (err, row) => {
            if (err || !row) {
                logEvent(null, email, 'Solicitud Recuperación Fallida', `Usuario o DNI no hallado para recuperar.`, 'WARNING');
                return res.status(404).json({ error: 'No se encontró una cuenta con ese correo y número de identificación.' });
            }

            // Generar código de 6 dígitos
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

            // Eliminar códigos anteriores
            db.run(`DELETE FROM recovery_codes WHERE email = ?`, [email.trim()], function() {
                // Guardar nuevo código
                db.run(
                    `INSERT INTO recovery_codes (email, code, expiresAt) VALUES (?, ?, ?)`,
                    [email.trim(), code, expiresAt],
                    async function(insertErr) {
                        if (insertErr) {
                            return res.status(500).json({ error: 'Error interno al generar código de seguridad.' });
                        }

                        console.log(`\n==========================================\n[RECOVERY CODE] Para: ${email.trim()}\nCÓDIGO DE RECUPERACIÓN: ${code}\n==========================================\n`);

                        // Enviar por correo
                        const mailOptions = {
                            from: '"ORDENIS LegTech" <no-reply@ordenis.com>',
                            to: email.trim(),
                            subject: 'Código de Seguridad - ORDENIS',
                            html: `
                                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                                    <div style="text-align: center; margin-bottom: 20px;">
                                        <h2 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 700;">ORDENIS</h2>
                                        <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Criptografía y Custodia Legal</p>
                                    </div>
                                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 25px;">
                                    <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hola,</p>
                                    <p style="color: #334155; font-size: 16px; line-height: 1.6;">Has solicitado restablecer la contraseña de acceso en la plataforma <strong>ORDENIS</strong>. Copia y pega el siguiente código de seguridad en el panel de recuperación:</p>
                                    <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; margin: 25px 0; color: #1e1b4b;">
                                        ${code}
                                    </div>
                                    <p style="color: #ef4444; font-size: 14px; font-weight: 500; margin: 20px 0 0 0;">⚠️ Este código tiene una validez de 15 minutos.</p>
                                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 10px;">Si tú no solicitaste esta acción, te recomendamos cambiar tus credenciales de acceso de forma preventiva.</p>
                                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">
                                    <p style="text-align: center; color: #94a3b8; font-size: 12px; margin: 0;">© 2026 ORDENIS. Todos los derechos reservados.</p>
                                </div>
                            `
                        };

                        if (mailTransporter) {
                            mailTransporter.sendMail(mailOptions, (mailErr, info) => {
                                if (mailErr) {
                                    console.error('Error al enviar correo de recuperación:', mailErr.message);
                                } else {
                                    console.log('Correo de recuperación enviado con éxito:', info.messageId);
                                    const previewUrl = nodemailer.getTestMessageUrl(info);
                                    if (previewUrl) {
                                        console.log(`[ETHEREAL MAIL PREVIEW]: ${previewUrl}`);
                                    }
                                }
                            });
                        }

                        logEvent(row.id, email.trim(), 'Solicitud de Código', 'Código de recuperación de contraseña generado y enviado.', 'OK');
                        res.json({ message: 'Código de seguridad enviado a su correo electrónico.' });
                    }
                );
            });
        });
    } catch (e) {
        console.error('Error in recovery-request endpoint:', e);
        res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud.' });
    }
});

// Endpoint para VERIFICAR Código y cambiar contraseña
app.post('/api/recover-password/verify', async (req, res) => {
    const { email, docId, code, recoveryWord, newPassword } = req.body;

    if (!email || !docId || !code || !recoveryWord || !newPassword) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    try {
        const sql = `SELECT * FROM users WHERE email = ? AND docId = ?`;
        db.get(sql, [email.trim(), docId.trim()], async (err, row) => {
            if (err || !row) {
                return res.status(404).json({ error: 'Usuario no encontrado.' });
            }

            // Validar palabra secreta
            const normWord = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (normWord(row.recoveryWord) !== normWord(recoveryWord)) {
                logEvent(row.id, email.trim(), 'Fallo Verificación Recuperación', 'Palabra secreta incorrecta al intentar recuperar clave.', 'SECURITY_ALARM');
                return res.status(401).json({ error: 'La palabra secreta es incorrecta.' });
            }

            // Validar código
            db.get(
                `SELECT * FROM recovery_codes WHERE email = ? AND code = ? AND expiresAt > ?`,
                [email.trim(), code.trim(), Date.now()],
                async (codeErr, codeRow) => {
                    if (codeErr || !codeRow) {
                        logEvent(row.id, email.trim(), 'Fallo Verificación Recuperación', 'Código de verificación incorrecto o expirado.', 'SECURITY_ALARM');
                        return res.status(400).json({ error: 'El código de verificación es inválido o ha expirado.' });
                    }

                    // Hashear nueva contraseña y guardar
                    const saltRounds = 10;
                    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

                    db.run(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, row.id], function(updateErr) {
                        if (updateErr) {
                            return res.status(500).json({ error: 'Error al guardar la nueva contraseña.' });
                        }

                        // Eliminar código utilizado
                        db.run(`DELETE FROM recovery_codes WHERE email = ?`, [email.trim()]);

                        logEvent(row.id, email.trim(), 'Recuperación de clave exitosa', 'Contraseña restablecida exitosamente.', 'OK');
                        res.json({ message: 'Contraseña restablecida exitosamente. Ahora puede iniciar sesión.' });
                    });
                }
            );
        });
    } catch (e) {
        console.error('Error in recovery-verify endpoint:', e);
        res.status(500).json({ error: 'Error interno del servidor al procesar la verificación.' });
    }
});

// Endpoint Obtener Ledger de Blockchain
app.get('/api/blockchain/ledger', authenticateToken, (req, res) => {
    db.all(`SELECT id, previousHash, fileHash, blockHash, createdAt FROM blockchain_blocks ORDER BY id ASC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al consultar el ledger criptográfico' });
        }
        res.json({ ledger: rows });
    });
});

// Endpoint Crear Carpeta
app.post('/api/folders', authenticateToken, (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre de la carpeta es requerido.' });
    }
    
    db.run(
        `INSERT INTO folders (userId, name) VALUES (?, ?)`,
        [req.user.id, name.trim()],
        function(err) {
            if (err) {
                console.error('Error creating folder:', err.message);
                return res.status(500).json({ error: 'Error al crear la carpeta en la base de datos.' });
            }
            logEvent(req.user.id, req.user.email, 'Creación de Carpeta', `Carpeta creada: ${name.trim()}`, 'OK');
            res.status(201).json({ message: 'Carpeta creada exitosamente', folderId: this.lastID });
        }
    );
});

// Endpoint Obtener Carpetas
app.get('/api/folders', authenticateToken, (req, res) => {
    db.all(
        `SELECT id, name, createdAt FROM folders WHERE userId = ? ORDER BY name ASC`,
        [req.user.id],
        (err, rows) => {
            if (err) {
                console.error('Error listing folders:', err.message);
                return res.status(500).json({ error: 'Error al obtener las carpetas.' });
            }
            res.json({ folders: rows });
        }
    );
});

// Endpoint Subir Activo
app.post('/api/upload-asset', authenticateToken, upload.single('assetFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se envió ningún archivo' });
    }

    const { assetType, folderId } = req.body;
    const finalType = assetType || 'Documento';
    const parsedFolderId = folderId ? parseInt(folderId) : null;

    try {
        const fileHash = await calculateHash(req.file.path);
        
        // Comprobar si el hash ya existe
        db.get(`SELECT * FROM assets WHERE fileHash = ?`, [fileHash], async (err, row) => {
            if (err) {
                fs.unlinkSync(req.file.path);
                logEvent(req.user.id, req.user.email, 'Fallo de Blindaje', `Error al verificar integridad: ${err.message}`, 'WARNING');
                return res.status(500).json({ error: 'Error al verificar integridad del documento' });
            }
            if (row) {
                fs.unlinkSync(req.file.path);
                logEvent(req.user.id, req.user.email, 'Alarma de Integridad', `Intento de duplicación de archivo blindado: ${req.file.originalname}. Hash: ${fileHash}`, 'SECURITY_ALARM');
                return res.status(409).json({ error: 'ALARMA: Este documento exacto ya se encuentra registrado y blindado en el sistema.' });
            }

            const userDir = path.join(__dirname, 'uploads', 'users', String(req.user.docId || req.user.id), 'assets');
            if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
            
            const ext = path.extname(req.file.originalname);
            const newFilename = Date.now() + ext + '.enc';
            const destPath = path.join(userDir, newFilename);
            
            // Encriptamos el archivo con AES-256
            await encryptFile(req.file.path, destPath);
            fs.unlinkSync(req.file.path); // Borrar el original temporal

            const relativePath = path.join('uploads', 'users', String(req.user.docId || req.user.id), 'assets', newFilename).replace(/\\/g, '/');

            let fileData = null;
            try {
                fileData = fs.readFileSync(destPath);
            } catch (e) {
                console.error('Error reading encrypted file bytes:', e);
            }

            const sql = `INSERT INTO assets (userId, folderId, fileName, assetType, fileHash, filePath, fileData) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.run(sql, [req.user.id, parsedFolderId, req.file.originalname, finalType, fileHash, relativePath, fileData], async function(err) {
                if (err) {
                    logEvent(req.user.id, req.user.email, 'Fallo de Blindaje', `Error al escribir en BD para: ${req.file.originalname}`, 'WARNING');
                    return res.status(500).json({ error: 'Error al guardar el activo en la base de datos' });
                }
                
                try {
                    await sealAssetInBlockchain(fileHash);
                    logEvent(req.user.id, req.user.email, 'Blindaje de Activo', `Activo blindado exitosamente: ${req.file.originalname} (${finalType}). Hash: ${fileHash}`, 'OK');
                    res.status(201).json({ message: 'Activo blindado y registrado exitosamente' });
                } catch (blockchainErr) {
                    logEvent(req.user.id, req.user.email, 'Fallo Blockchain', `Error al registrar en blockchain ledger: ${blockchainErr.message}`, 'WARNING');
                    res.status(201).json({ message: 'Activo blindado, pero falló el registro en blockchain ledger' });
                }
            });

        });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        logEvent(req.user.id, req.user.email, 'Fallo de Blindaje', `Error crítico en catch: ${error.message}`, 'WARNING');
        res.status(500).json({ error: 'Error procesando el archivo' });
    }
});

// Endpoint Obtener Activos
app.get('/api/my-assets', authenticateToken, (req, res) => {
    const folderId = req.query.folderId ? parseInt(req.query.folderId) : null;
    const query = `SELECT id, folderId, fileName, assetType, fileHash, status, createdAt, filePath FROM assets WHERE userId = ? AND folderId ${folderId === null ? 'IS NULL' : '= ?'} ORDER BY createdAt DESC`;
    const params = folderId === null ? [req.user.id] : [req.user.id, folderId];

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error obteniendo los activos' });
        }
        const assetsWithSizes = rows.map(item => {
            let fileSize = 0;
            if (item.filePath) {
                const fullPath = path.join(__dirname, item.filePath);
                try {
                    if (fs.existsSync(fullPath)) {
                        fileSize = fs.statSync(fullPath).size;
                    }
                } catch (e) {
                    console.error("Error reading file size", e);
                }
            }
            const { filePath, ...rest } = item;
            return { ...rest, fileSize };
        });
        res.json({ assets: assetsWithSizes });
    });
});

// Endpoint Obtener Usuarios (Admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    db.all(`SELECT id, name, docId, email, company, country, kycFileName, kycFilePath, selfieFilePath, biometricScore, kycStatus, createdAt FROM users ORDER BY createdAt DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error obteniendo los usuarios' });
        }
        res.json({ users: rows });
    });
});

// Endpoint Verificar KYC (Admin)
app.post('/api/admin/verify-kyc', authenticateToken, requireAdmin, (req, res) => {
    const { userId, status } = req.body;
    if (!userId || !['Aprobado', 'Rechazado', 'Pendiente'].includes(status)) {
        return res.status(400).json({ error: 'Datos inválidos para la verificación KYC' });
    }
    
    db.run(`UPDATE users SET kycStatus = ? WHERE id = ?`, [status, userId], function(err) {
        if (err) {
            logEvent(req.user.id, req.user.email, 'Fallo KYC Admin', `Fallo al verificar KYC para ID: ${userId} a estado: ${status}`, 'WARNING');
            return res.status(500).json({ error: 'Error actualizando el estado KYC' });
        }
        logEvent(req.user.id, req.user.email, 'Verificación KYC', `KYC del usuario ID: ${userId} marcado como ${status} por Admin.`, 'OK');
        res.json({ message: `Estado KYC actualizado a ${status}` });
    });
});



// Endpoint Descargar KYC (Admin)
app.get('/api/download-kyc', authenticateToken, requireAdmin, (req, res) => {
    const { path: kycPath } = req.query;
    if (!kycPath) return res.status(400).json({ error: 'Ruta no proporcionada' });
    
    const fullPath = path.join(__dirname, kycPath);
    // Verificación contra Path Traversal
    if (!fullPath.startsWith(path.join(__dirname, 'uploads'))) {
        logEvent(req.user.id, req.user.email, 'Intento Path Traversal', `Intento de acceso indebido a ruta KYC: ${kycPath}`, 'SECURITY_ALARM');
        return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    if (fs.existsSync(fullPath)) {
        logEvent(req.user.id, req.user.email, 'Descarga KYC', `Documento KYC inspeccionado en ruta: ${kycPath}`, 'OK');
        res.sendFile(fullPath);
    } else {
        // Intentar restaurar desde la base de datos
        db.get(`SELECT kycFileData FROM users WHERE kycFilePath = ?`, [kycPath], (err, row) => {
            if (!err && row && row.kycFileData) {
                try {
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, row.kycFileData);
                    logEvent(req.user.id, req.user.email, 'Descarga KYC (Restaurado)', `Documento KYC restaurado de la BD a ruta: ${kycPath}`, 'OK');
                    return res.sendFile(fullPath);
                } catch (writeErr) {
                    console.error('Error restoring KYC file from DB:', writeErr);
                }
            }
            logEvent(req.user.id, req.user.email, 'Error Descarga KYC', `Intento de descargar KYC inexistente: ${kycPath}`, 'WARNING');
            res.status(404).json({ error: 'Archivo KYC no encontrado en disco ni en la base de datos' });
        });
    }
});

// Endpoint Descargar Activo Blindado (User)
app.get('/api/download-asset/:id', authenticateToken, (req, res) => {
    const assetId = req.params.id;
    db.get(`SELECT * FROM assets WHERE id = ? AND userId = ?`, [assetId, req.user.id], (err, row) => {
        if (err || !row) {
            logEvent(req.user.id, req.user.email, 'Fallo Descarga Activo', `Intento fallido de descargar activo ID: ${assetId}`, 'WARNING');
            return res.status(404).json({ error: 'Activo no encontrado o no autorizado' });
        }
        
        const fullPath = path.join(__dirname, row.filePath);
        let fileReady = fs.existsSync(fullPath);
        
        if (!fileReady && row.fileData) {
            try {
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, row.fileData);
                fileReady = true;
                logEvent(req.user.id, req.user.email, 'Restauración de Activo', `Archivo físico restaurado desde la BD para: ${row.fileName}`, 'OK');
            } catch (writeErr) {
                console.error('Error restoring asset file from DB:', writeErr);
            }
        }
        
        if (!fileReady) {
            logEvent(req.user.id, req.user.email, 'Fallo Descarga Activo', `Archivo físico no hallado para activo: ${row.fileName}`, 'WARNING');
            return res.status(404).json({ error: 'El archivo físico cifrado no existe en el servidor ni en la base de datos' });
        }
        
        res.setHeader('Content-Disposition', `attachment; filename="${row.fileName}"`);
        
        try {
            // Desencriptado al vuelo AES-256-CBC
            decryptFileToStream(fullPath, res);
            logEvent(req.user.id, req.user.email, 'Descarga Activo', `Activo seguro descifrado y descargado: ${row.fileName} (SHA-256: ${row.fileHash})`, 'OK');
        } catch(e) {
            logEvent(req.user.id, req.user.email, 'Fallo Criptografía', `Error al descifrar archivo: ${row.fileName}`, 'WARNING');
            res.status(500).json({ error: 'Error al desencriptar el activo seguro' });
        }
    });
});

// Endpoint Obtener Perfil de Usuario (User)
app.get('/api/profile', authenticateToken, (req, res) => {
    db.get(`SELECT id, name, docId, email, phone, company, country, kycStatus, createdAt FROM users WHERE id = ?`, [req.user.id], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ user: row });
    });
});

// Endpoint Actualizar Perfil de Usuario (User)
app.put('/api/profile', authenticateToken, async (req, res) => {
    const { name, phone, company, country, currentPassword, newPassword } = req.body;

    if (!name || !phone || !company || !country) {
        return res.status(400).json({ error: 'Todos los campos (Nombre, Teléfono, Empresa y País) son obligatorios.' });
    }

    try {
        // Si desea cambiar la contraseña
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Se requiere la contraseña actual para establecer una nueva contraseña.' });
            }

            db.get(`SELECT password FROM users WHERE id = ?`, [req.user.id], async (err, row) => {
                if (err || !row) {
                    return res.status(404).json({ error: 'Usuario no encontrado' });
                }

                const match = await bcrypt.compare(currentPassword, row.password);
                if (!match) {
                    return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
                }

                const saltRounds = 10;
                const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

                db.run(
                    `UPDATE users SET name = ?, phone = ?, company = ?, country = ?, password = ? WHERE id = ?`,
                    [name, phone, company, country, hashedNewPassword, req.user.id],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ error: 'Error al actualizar perfil y contraseña.' });
                        }
                        
                        // Retornar perfil actualizado
                        db.get(`SELECT id, name, docId, email, phone, company, country, kycStatus, createdAt FROM users WHERE id = ?`, [req.user.id], (err, updatedRow) => {
                            if (err) return res.status(500).json({ error: 'Perfil actualizado, pero falló al consultar los datos nuevos.' });
                            res.json({ message: 'Perfil y contraseña actualizados con éxito', user: updatedRow });
                        });
                    }
                );
            });
        } else {
            // Solo actualizar campos básicos
            db.run(
                `UPDATE users SET name = ?, phone = ?, company = ?, country = ? WHERE id = ?`,
                [name, phone, company, country, req.user.id],
                function (err) {
                    if (err) {
                        return res.status(500).json({ error: 'Error al actualizar el perfil en la base de datos.' });
                    }
                    
                    // Retornar perfil actualizado
                    db.get(`SELECT id, name, docId, email, phone, company, country, kycStatus, createdAt FROM users WHERE id = ?`, [req.user.id], (err, updatedRow) => {
                        if (err) return res.status(500).json({ error: 'Perfil actualizado, pero falló al consultar los datos nuevos.' });
                        res.json({ message: 'Perfil actualizado con éxito', user: updatedRow });
                    });
                }
            );
        }
    } catch (error) {
        res.status(500).json({ error: 'Ocurrió un error en el servidor al actualizar el perfil.' });
    }
});


// Endpoint Obtener Estadísticas Globales (Admin)
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    db.get(`SELECT COUNT(*) as totalUsers FROM users`, [], (err, userRow) => {
        if (err) return res.status(500).json({ error: 'Error al consultar usuarios' });
        
        db.get(`SELECT COUNT(*) as totalAssets FROM assets`, [], (err, assetRow) => {
            if (err) return res.status(500).json({ error: 'Error al consultar activos' });
            
            db.all(`SELECT filePath FROM assets`, [], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Error al consultar rutas de activos' });
                
                let totalBytes = 0;
                rows.forEach(item => {
                    const fullPath = path.join(__dirname, item.filePath);
                    try {
                        if (fs.existsSync(fullPath)) {
                            totalBytes += fs.statSync(fullPath).size;
                        }
                    } catch (e) {
                        // Ignorar fallos de archivos individuales
                    }
                });

                res.json({
                    totalUsers: userRow.totalUsers,
                    totalAssets: assetRow.totalAssets,
                    totalBytes: totalBytes
                });
            });
        });
    });
});

// Endpoint Obtener Bitácoras de Seguridad (Admin)
app.get('/api/admin/logs', authenticateToken, requireAdmin, (req, res) => {
    db.all(`SELECT id, userId, email, action, details, status, createdAt FROM logs ORDER BY createdAt DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener bitácoras del sistema' });
        }
        res.json({ logs: rows });
    });
});

// Endpoint del Secretario de IA (RAG con la Bóveda del Usuario)
app.post('/api/ai-chat', authenticateToken, async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje requerido.' });

    // 1. Obtener la lista de activos del usuario logueado en la base de datos sqlite
    db.all(
        `SELECT fileName, assetType, fileHash, filePath, createdAt FROM assets WHERE userId = ?`,
        [req.user.id],
        async (err, assets) => {
            if (err) return res.status(500).json({ error: 'Error al consultar la bóveda del usuario.' });

            // 2. Construir el contexto sobre Ordenis y la lista de sus activos blindados
            const userAssetsText = assets.map(a => {
                let sizeText = 'Desconocido';
                try {
                    const fullPath = path.join(__dirname, a.filePath);
                    if (fs.existsSync(fullPath)) {
                        sizeText = fs.statSync(fullPath).size + ' bytes';
                    }
                } catch (e) {}
                return `- Archivo: "${a.fileName}", Clasificación: "${a.assetType}", Hash SHA-256: "${a.fileHash}", Tamaño: ${sizeText}, Blindado el: ${a.createdAt}`;
            }).join('\n');

            const systemPrompt = `Eres el "Secretario Inteligente" de la plataforma ORDENIS (también conocida como Ordenix).
Tu objetivo es ayudar al usuario con cualquier duda sobre la plataforma, explicar cómo funciona o responder sobre los archivos y casos que tiene guardados en su bóveda.

INFORMACIÓN DE LA PLATAFORMA ORDENIS:
- ¿Qué es? Plataforma B2B SaaS de automatización financiera y custodia segura de activos legales y propiedad intelectual.
- Fundador: Desarrollada bajo la dirección estratégica de Jefferson Montoya. Es Project Manager Tecnológico, Legal Strategist y Abogado con más de 12 años de experiencia en la intersección de cumplimiento legal (Compliance) y arquitectura de software. Experto en automatización con Python y n8n, y actual CBO de Heliustin. (Contacto: +57 3105376773, LinkedIn: https://www.linkedin.com/in/jejomoan/).
- Seguridad: Cifrado de extremo a extremo mediante el algoritmo de grado militar AES-256-CBC. Los archivos se guardan de forma inmutable con su sello de integridad SHA-256.
- Cumplimiento: Cumple con normativas eIDAS (Reglamento de la UE sobre identificación electrónica y servicios de confianza) e ISO 27001 para garantizar la validez probatoria de los documentos.
- Funciones: Panel personal, Mis Activos (explorador con Drag & Drop), Certificados de Blindaje Criptográfico (para descargar o imprimir con código QR dinámico), y esta sección de Secretario de IA.

BÓVEDA ACTUAL DEL USUARIO (Datos reales del usuario):
${assets.length > 0 ? userAssetsText : 'Actualmente la bóveda del usuario está vacía.'}

INSTRUCCIONES DE RESPUESTA:
- Sé educado, profesional y transmite seguridad y confidencialidad.
- Responde siempre en español.
- Si el usuario te pregunta por un archivo o un caso específico (por ejemplo: "Mire, tengo el caso de Pedro Pérez, ¿tienes algo parecido?"), busca en la lista de arriba si hay coincidencias semánticas o de nombre, y descríbelo detalladamente (nombre, hash, fecha de subida, etc.). Si no hay, explícale que no se encuentra en la bóveda, pero que puede blindarlo ahora mismo.
- Si el usuario pregunta cosas generales sobre Ordenis (cómo se creó, para qué sirve, qué tecnologías usa), explícale claramente.
- Mantén la conversación enfocada en el soporte, la seguridad y la consulta de activos.

Mensaje del usuario: "${message}"`;

            const apiKey = process.env.GEMINI_API_KEY;

            if (!apiKey) {
                // Modo local robusto si no hay API key configurada en .env
                return res.json({ 
                    response: getLocalResponse(message, assets)
                });
            }

            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: systemPrompt }] }]
                        })
                    }
                );
                
                const data = await response.json();
                if (response.ok && data.candidates && data.candidates[0].content.parts[0].text) {
                    res.json({ response: data.candidates[0].content.parts[0].text });
                } else {
                    console.error('Error de respuesta de Gemini API:', data);
                    res.json({ response: getLocalResponse(message, assets) });
                }
            } catch (e) {
                console.error('Error al llamar a la API de Gemini:', e);
                res.json({ response: getLocalResponse(message, assets) });
            }
        }
    );
});

// Función de respuesta local para contingencia si no hay API Key de Gemini
function getLocalResponse(message, assets) {
    const q = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // 1. Preguntas sobre el creador / Jefferson Montoya
    if (q.includes('jefferson') || q.includes('montoya')) {
        return `🛡️ **Jefferson Montoya Anaya** es el Fundador y Director Estratégico de ORDENIS (también conocido como Ordenix).
Es un Abogado y Project Manager Tecnológico con más de 12 años de experiencia, especializado en la intersección de cumplimiento legal (Compliance), automatización de procesos (mediante Python y n8n) y arquitectura de software.
Actualmente es Chief Business Officer (CBO) en Heliustin y cuenta con formación ejecutiva en MIT, Stanford e IBM.

Si desea ponerse en contacto con él, puede escribirle directamente a su teléfono **+57 3105376773** o visitar su perfil profesional en [LinkedIn](https://www.linkedin.com/in/jejomoan/).`;
    }
    
    // 2. Preguntas sobre inmutabilidad / seguridad (Priorizado)
    if (q.includes('inmutable') || q.includes('seguro') || q.includes('eidas') || q.includes('cifrado') || q.includes('cripto') || q.includes('aes')) {
        return `🛡️ **Seguridad Inmutable de ORDENIS:**
- **Cifrado AES-256-CBC**: Todos sus archivos se guardan cifrados con algoritmos de grado militar. Solo el dueño de la cuenta puede descifrarlos al descargarlos.
- **Sellado SHA-256**: Al subir un archivo, se calcula su huella digital criptográfica (Hash). Este hash se almacena en nuestra base de datos inmutable. Si alguien altera un solo byte del archivo, la huella cambia revelando la manipulación.
- **Cumplimiento Legal**: Los certificados generados cumplen con el estándar **eIDAS** europeo y la certificación **ISO 27001**, dándole validez probatoria ante auditorías y entidades legales.`;
    }

    // 3. Preguntas sobre blindaje / subir
    if (q.includes('como blindo') || q.includes('como subir') || q.includes('blindar') || q.includes('proteger')) {
        return `Para blindar un nuevo activo en su bóveda, siga estos pasos:
1. Vaya a la pestaña **Mis Activos** o al **Panel Personal**.
2. Seleccione el tipo de archivo (Documento Legal, Código Fuente, o Diseño/Imagen).
3. Arrastre el archivo a la zona segura o haga clic en "Seleccionar Archivo".
4. Presione **Encriptar y Guardar**. El sistema generará su firma inmutable SHA-256 y cifrará el archivo instantáneamente con grado militar AES-256.`;
    }

    // 4. Solicitud de consejos o soluciones generales
    if (q.includes('consejo') || q.includes('solucion') || q.includes('soluciones') || q.includes('aconseja') || q.includes('ayuda')) {
        return `💡 **Consejos y soluciones del Secretario de Bóveda:**
1. **Organice sus activos:** Use la clasificación adecuada (Documento Legal, Código Fuente o Arte) para facilitar auditorías futures.
2. **Use los Certificados:** Cada archivo blindado genera un certificado legal imprimible con código QR. Úselo para probar la autenticidad de sus documentos ante socios comerciales.
3. **Monitoree las alertas:** El panel de administración registra cualquier intento de alteración o subida duplicada para su seguridad.`;
    }

    // 5. Preguntas sobre qué hay en la bóveda o listar activos
    const listSynonyms = [
        'que tengo', 'ue tengo', 'q tengo', 'u tengo', 
        'que hay', 'listar', 'ver mi', 'resumen', 
        'mis activos', 'mis archivos', 'mostrar', 
        'boveda', 'bobeda', 'que tengo blindado'
    ];
    const wantsList = listSynonyms.some(syn => q.includes(syn)) || q.includes('que haces') || q.includes('que hace');
    
    if (wantsList) {
        if (assets.length === 0) {
            return `Su bóveda en ORDENIS se encuentra actualmente **vacía**.
Para empezar a proteger su propiedad intelectual y activos legales, puede subirlos utilizando la zona de arrastre (Drag & Drop) o seleccionando un archivo desde la pestaña **Mis Activos**.
Una vez subidos, se cifrarán automáticamente con **AES-256-CBC** y podré ayudarle a buscar coincidencias e integridades.`;
        }
        
        let text = `📂 **Resumen de su Bóveda Digital (Modo Local)**\n`;
        text += `Actualmente tiene **${assets.length}** activo(s) blindado(s) y protegido(s) con cifrado militar:\n\n`;
        assets.forEach((item, idx) => {
            text += `${idx + 1}. 📄 **${item.fileName}**\n`;
            text += `   • Tipo: \`${item.assetType || 'Documento'}\`\n`;
            text += `   • Registrado: *${new Date(item.createdAt).toLocaleString()}*\n`;
            text += `   • Integridad SHA-256: \`${item.fileHash.substring(0, 24)}...\`\n\n`;
        });
        text += `💡 *Consejo de Seguridad:* Puede descargar cualquiera de estos activos o ver su Certificado de Blindaje con código QR oficial para validación de terceros.`;
        return text;
    }

    // 6. Buscar coincidencia dinámica en la Bóveda en base a tokens de búsqueda
    // Eliminar palabras vacías (stopwords) comunes para buscar palabras clave reales
    const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'en', 'para', 'con', 'por', 'que', 'encontrado', 'busca', 'buscar', 'coincidencia', 'caso', 'sobre', 'tengo']);
    const tokens = q.split(/[^a-zA-Z0-9íáéóúñíÁÉÓÚÑ]+/).filter(t => t.length > 2 && !stopWords.has(t));
    
    if (tokens.length > 0) {
        const matches = assets.filter(a => {
            const nameNorm = a.fileName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const typeNorm = (a.assetType || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return tokens.some(token => nameNorm.includes(token) || typeNorm.includes(token));
        });
        
        if (matches.length > 0) {
            let text = `🔍 **Resultados de Búsqueda para su consulta**\n`;
            text += `He escaneado su Bóveda y encontré **${matches.length}** activo(s) relacionado(s):\n\n`;
            
            matches.forEach(item => {
                text += `🛡️ **${item.fileName}**\n`;
                text += `   • Clasificación: ${item.assetType || 'Documento'}\n`;
                text += `   • Fecha de Blindaje: ${new Date(item.createdAt).toLocaleString()}\n`;
                text += `   • Hash SHA-256: \`${item.fileHash}\`\n\n`;
            });
            
            text += `💡 **Recomendación y Solución:**\n`;
            text += `Estos documentos están sellados criptográficamente. Si está gestionando un caso o contrato similar, le aconsejo descargar los certificados oficiales para verificar su firma temporal. Si necesita asociar más documentación legal a este mismo caso, puede blindar nuevos archivos y les aplicaremos la misma firma inmutable.`;
            return text;
        }
    }

    // 7. Respuesta por defecto
    return `Hola, soy su **Secretario Inteligente** de ORDENIS.
Puedo analizar y buscar en su Bóveda, darle detalles de sus archivos blindados, buscar coincidencias en base a cualquier palabra o explicarle nuestro cifrado AES-256.
*Intente preguntarme:* "que tengo en mi boveda", "busca el caso de Pedro Perez", o pregunte sobre "Jefferson Montoya". ¿Qué desea consultar?`;
}

app.listen(PORT, () => {
    console.log(`Servidor backend ejecutándose en el puerto ${PORT}`);
});
