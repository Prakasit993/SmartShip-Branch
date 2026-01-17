// scripts/hash-password.js
// รันด้วย: node scripts/hash-password.js <your-password>
// ตัวอย่าง: node scripts/hash-password.js MySecretPassword123

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
    console.log('❌ กรุณาระบุรหัสผ่าน');
    console.log('');
    console.log('วิธีใช้: node scripts/hash-password.js <your-password>');
    console.log('ตัวอย่าง: node scripts/hash-password.js MySecretPassword123');
    process.exit(1);
}

const saltRounds = 12;
const hash = bcrypt.hashSync(password, saltRounds);

console.log('');
console.log('✅ Hash สำเร็จ!');
console.log('');
console.log('📋 คัดลอก hash นี้ไปใส่ใน .env.local:');
console.log('─'.repeat(60));
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log('─'.repeat(60));
console.log('');
console.log('⚠️  อย่าลืมลบ ADMIN_PASSWORD บรรทัดเดิมออก!');
