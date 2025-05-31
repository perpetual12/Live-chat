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

async function resetAdmin() {
    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected successfully');

        // First, delete existing admin if any
        console.log('Removing existing admin users...');
        await client.query('DELETE FROM admins');
        
        // Create new admin
        console.log('Creating new admin user...');
        const username = 'admin';
        const password = 'adminpass';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await client.query(
            'INSERT INTO admins (username, password) VALUES ($1, $2) RETURNING *',
            [username, hashedPassword]
        );
        
        console.log('Admin created successfully with credentials:');
        console.log('Username:', username);
        console.log('Password:', password);
        console.log('Database entry:', result.rows[0]);
        
        // Verify the user exists
        const verify = await client.query('SELECT * FROM admins WHERE username = $1', [username]);
        console.log('\nVerification - Admin in database:', verify.rows[0]);
        
    } catch (err) {
        console.error('Error resetting admin:', err);
    } finally {
        await client.end();
    }
}

resetAdmin(); 