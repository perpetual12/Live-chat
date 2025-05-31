import pg from 'pg';
import bcrypt from 'bcrypt';

const { Client } = pg;

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'live_chat_db',
    password: 'Perpetual12',
    port: 5000,
});

async function createAdmin(username, password) {
    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected successfully');

        // First check if admin exists
        const checkResult = await client.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (checkResult.rows.length > 0) {
            console.log('Admin user already exists, updating password...');
            const hashedPassword = await bcrypt.hash(password, 10);
            const updateResult = await client.query(
                'UPDATE admins SET password = $1 WHERE username = $2 RETURNING id, username, created_at',
                [hashedPassword, username]
            );
            console.log('Admin password updated successfully:', updateResult.rows[0]);
        } else {
            console.log('Creating new admin user...');
            const hashedPassword = await bcrypt.hash(password, 10);
            const insertResult = await client.query(
                'INSERT INTO admins (username, password) VALUES ($1, $2) RETURNING id, username, created_at',
                [username, hashedPassword]
            );
            console.log('Admin created successfully:', insertResult.rows[0]);
        }
    } catch (err) {
        console.error('Error managing admin:', err);
    } finally {
        await client.end();
    }
}

// Create an admin with username 'admin' and password 'adminpass'
createAdmin('admin', 'adminpass'); 