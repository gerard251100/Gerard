'use strict';

// Restablece la contraseña del administrador a "admin123".
// Solo se puede usar desde la computadora donde está la página.

const { db } = require('./src/db');
const { hashPassword } = require('./src/security');
const { DATA_DIR } = require('./src/paths');

const admin = db.prepare("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword('admin123'), admin.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(admin.id);

console.log('');
console.log('  ============================================');
console.log('   Contrasena del administrador restablecida');
console.log('');
console.log(`   Correo:     ${admin.email}`);
console.log('   Contrasena: admin123');
console.log('');
console.log('   Ingresa y cambiala en "Pagos y cuenta".');
console.log(`   Datos en: ${DATA_DIR}`);
console.log('  ============================================');
console.log('');
