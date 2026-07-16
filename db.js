const pg = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const isPostgres = !!process.env.DATABASE_URL;

let pgPool = null;
let sqliteDb = null;

if (isPostgres) {
    pgPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
    pgPool.on('error', (err) => {
        console.error('Unexpected error on idle database client:', err.message);
    });
    console.log('Database: Connected to PostgreSQL cloud instance.');
} else {
    const dbPath = path.join(__dirname, 'database.sqlite');
    sqliteDb = new sqlite3.Database(dbPath);
    console.log('Database: Connected to local SQLite database.');
}
function camelCaseKeys(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(camelCaseKeys);
    }
    const newObj = {};
    for (const key of Object.keys(obj)) {
        let newKey = key;
        if (key === 'docid') newKey = 'docId';
        else if (key === 'kycfilename') newKey = 'kycFileName';
        else if (key === 'kycfilepath') newKey = 'kycFilePath';
        else if (key === 'kycstatus') newKey = 'kycStatus';
        else if (key === 'selfiefilepath') newKey = 'selfieFilePath';
        else if (key === 'biometricscore') newKey = 'biometricScore';
        else if (key === 'kycfiledata') newKey = 'kycFileData';
        else if (key === 'selfiefiledata') newKey = 'selfieFileData';
        else if (key === 'recoveryword') newKey = 'recoveryWord';
        else if (key === 'createdat') newKey = 'createdAt';
        else if (key === 'userid') newKey = 'userId';
        else if (key === 'filename') newKey = 'fileName';
        else if (key === 'assettype') newKey = 'assetType';
        else if (key === 'filehash') newKey = 'fileHash';
        else if (key === 'filepath') newKey = 'filePath';
        else if (key === 'filedata') newKey = 'fileData';
        else if (key === 'previoushash') newKey = 'previousHash';
        else if (key === 'blockhash') newKey = 'blockHash';
        else if (key === 'folderid') newKey = 'folderId';
        
        newObj[newKey] = obj[key];
    }
    return newObj;
}

function translateSql(sql) {
    if (!isPostgres) return sql;
    
    // Translate SQLite table creation keywords to PostgreSQL
    let translated = sql
        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
        .replace(/DATETIME/gi, 'TIMESTAMP')
        .replace(/REAL/gi, 'DOUBLE PRECISION')
        .replace(/BLOB/gi, 'BYTEA');
        
    // Translate "?" placeholders to "$1, $2, $3..."
    let count = 1;
    translated = translated.replace(/\?/g, () => `$${count++}`);
    
    return translated;
}

const db = {
    isPostgres,
    
    all(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        const translatedSql = translateSql(sql);
        if (isPostgres) {
            pgPool.query(translatedSql, params, (err, res) => {
                if (err) {
                    console.error('Postgres all error:', err.message, 'SQL:', translatedSql);
                    callback(err);
                } else {
                    callback(null, camelCaseKeys(res.rows));
                }
            });
        } else {
            sqliteDb.all(sql, params, callback);
        }
    },

    get(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        const translatedSql = translateSql(sql);
        if (isPostgres) {
            pgPool.query(translatedSql, params, (err, res) => {
                if (err) {
                    console.error('Postgres get error:', err.message, 'SQL:', translatedSql);
                    callback(err);
                } else {
                    callback(null, camelCaseKeys(res.rows[0]) || null);
                }
            });
        } else {
            sqliteDb.get(sql, params, callback);
        }
    },

    run(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        let translatedSql = translateSql(sql);
        if (isPostgres) {
            const isInsert = /^\s*insert\s+into/i.test(sql);
            if (isInsert && !/returning/i.test(translatedSql)) {
                translatedSql += ' RETURNING id';
            }
            pgPool.query(translatedSql, params, (err, res) => {
                if (err) {
                    console.error('Postgres run error:', err.message, 'SQL:', translatedSql);
                    if (callback) callback(err);
                } else {
                    const lastID = res.rows && res.rows[0] ? res.rows[0].id : null;
                    const context = { lastID, changes: res.rowCount };
                    if (callback) callback.call(context, null);
                }
            });
        } else {
            sqliteDb.run(sql, params, callback);
        }
    }
};

module.exports = db;
