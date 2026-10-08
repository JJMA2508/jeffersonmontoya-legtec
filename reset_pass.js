const db = require('./db');
const bcrypt = require('bcrypt');

console.log('🔄 Iniciando restablecimiento de contraseña...');

const newPassword = 'password123';
const email1 = 'abg.montoya@gmail.com';
const email2 = 'jeffbelt20@gmail.com';

bcrypt.hash(newPassword, 10, (err, hash) => {
    if (err) {
        console.error('Error al generar hash:', err.message);
        process.exit(1);
    }
    
    db.run('UPDATE users SET password = ? WHERE email = ?', [hash, email1], (err1) => {
        if (err1) {
            console.error(`Error al actualizar password para ${email1}:`, err1.message);
        } else {
            console.log(`✅ Contraseña de ${email1} restablecida a: ${newPassword}`);
        }
        
        db.run('UPDATE users SET password = ? WHERE email = ?', [hash, email2], (err2) => {
            if (err2) {
                console.error(`Error al actualizar password para ${email2}:`, err2.message);
            } else {
                console.log(`✅ Contraseña de ${email2} restablecida a: ${newPassword}`);
            }
            
            console.log('🎉 Proceso completado.');
            process.exit(0);
        });
    });
});
