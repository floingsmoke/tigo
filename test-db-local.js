const { getDb } = require('./backend/database');

async function test() {
    try {
        console.log('Testing DB connection...');
        const db = await getDb();
        console.log('DB connected.');

        console.log('Running query: SELECT count(*) FROM users');
        const count = db.prepare('SELECT count(*) as count FROM users').get();
        console.log('User count:', count);

        console.log('Running query: SELECT * FROM users LIMIT 1');
        const user = db.prepare('SELECT * FROM users LIMIT 1').get();
        console.log('User 1:', user ? user.email : 'No user');

        console.log('✅ Test passed');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
}

test();
