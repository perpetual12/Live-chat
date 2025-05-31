import pg from 'pg';

const { Client } = pg;

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'live_chat_db',
    password: 'Perpetual12',
    port: 5000,
});

async function checkAdmin() {
    try {
        await client.connect();
        const result = await client.query('SELECT id, username, created_at FROM admins');
        console.log('Existing admins:', result.rows);
    } catch (err) {
        console.error('Error checking admin:', err);
    } finally {
        await client.end();
    }
}

checkAdmin(); 