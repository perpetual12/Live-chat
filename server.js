import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import pg from 'pg';
import pgSession from 'connect-pg-simple';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PostgresqlStore = pgSession(session);
const { Client } = pg;

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Database configuration
const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'live_chat_db',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 5432,
    // Connection pool settings
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
});

// Connect to the database
await client.connect();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    store: new PostgresqlStore({
        pool: client,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'fallback_session_secret_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 30 * 24 * 60 * 60 * 1000, // 30 days default
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const result = await client.query('SELECT * FROM admins WHERE username = $1', [username]);
        const admin = result.rows[0];

        if (!admin) {
            return done(null, false, { message: 'Incorrect username.' });
        }

        const validPassword = await bcrypt.compare(password, admin.password);
        if (!validPassword) {
            return done(null, false, { message: 'Incorrect password.' });
        }

        return done(null, admin);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const result = await client.query('SELECT * FROM admins WHERE id = $1', [id]);
        done(null, result.rows[0]);
    } catch (err) {
        done(err);
    }
});

// Track users' first messages (in memory)
let userFirstMessages = new Set();

// Helper function to get messages for a user
async function getUserMessages(userId) {
    try {
        const result = await client.query(
            'SELECT * FROM messages WHERE user_id = $1 ORDER BY created_at ASC',
            [userId]
        );
        return result.rows;
    } catch (err) {
        console.error('Error fetching messages:', err);
        return [];
    }
}

// Helper function to mark messages as read
async function markMessagesAsRead(userId, isAdmin) {
    try {
        const now = new Date();
        if (isAdmin) {
            // Mark user messages as read by admin
            await client.query(
                'UPDATE messages SET read_at = $1 WHERE user_id = $2 AND is_admin = false AND read_at IS NULL',
                [now, userId]
            );
        } else {
            // Mark admin messages as read by user
            await client.query(
                'UPDATE messages SET read_at = $1 WHERE user_id = $2 AND is_admin = true AND read_at IS NULL',
                [now, userId]
            );
        }
        
        // Get updated messages
        const messages = await getUserMessages(userId);
        return messages;
    } catch (err) {
        console.error('Error marking messages as read:', err);
        return null;
    }
}

// Helper function to get all unique user IDs
async function getActiveUsers() {
    try {
        const result = await client.query(
            'SELECT DISTINCT user_id FROM messages ORDER BY user_id'
        );
        return result.rows.map(row => row.user_id);
    } catch (err) {
        console.error('Error fetching active users:', err);
        return [];
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Send active users to admin when they connect
    socket.on('adminConnected', async () => {
        console.log('Admin connected, sending active users');
        const activeUsers = await getActiveUsers();

        // Calculate unread counts for each user
        const unreadCounts = {};
        for (const userId of activeUsers) {
            try {
                const result = await client.query(
                    'SELECT COUNT(*) as count FROM messages WHERE user_id = $1 AND is_admin = false AND read_at IS NULL',
                    [userId]
                );
                unreadCounts[userId] = parseInt(result.rows[0].count) || 0;
            } catch (err) {
                console.error('Error calculating unread count for user', userId, err);
                unreadCounts[userId] = 0;
            }
        }

        console.log('Sending active users and unread counts:', { activeUsers, unreadCounts });
        socket.emit('activeUsers', activeUsers);
        socket.emit('unreadCounts', unreadCounts);
    });

    // Handle marking messages as read
    socket.on('markMessagesRead', async ({ userId, isAdmin }) => {
        console.log(`Marking messages as read for user ${userId} by ${isAdmin ? 'admin' : 'user'}`);
        const updatedMessages = await markMessagesAsRead(userId, isAdmin);
        if (updatedMessages) {
            // Notify all clients about read status update
            io.emit('messagesUpdated', { userId, messages: updatedMessages });

            // If admin is marking messages as read, update unread count
            if (isAdmin) {
                io.emit('unreadCountUpdated', { userId, count: 0 });
            }
        }
    });

    // Send message history when requested
    socket.on('requestUserHistory', async (userId) => {
        console.log('History requested for user:', userId);
        try {
            // First, check if this is a new user (no messages yet)
            const userMessageCount = await client.query(
                'SELECT COUNT(*) FROM messages WHERE user_id = $1',
                [userId]
            );

            // If this is a new user, send the welcome message
            if (userMessageCount.rows[0].count === '0') {
                const welcomeText = process.env.WELCOME_MESSAGE || "Welcome to our chat support! How can we help you today?";
                const welcomeResult = await client.query(
                    'INSERT INTO messages (content, user_id, is_admin, is_auto_response) VALUES ($1, $2, $3, $4) RETURNING *',
                    [
                        welcomeText,
                        userId,
                        true,
                        true
                    ]
                );
                const welcomeMessage = welcomeResult.rows[0];
                socket.emit('message', {
                    ...welcomeMessage,
                    text: welcomeMessage.content
                });
            }

            // Then get all messages for this user
            const messages = await getUserMessages(userId);
            socket.emit('messageHistory', messages);
        } catch (err) {
            console.error('Error fetching user history:', err);
            socket.emit('messageHistory', []);
        }
    });

    socket.on('userMessage', async (message) => {
        console.log('Received user message:', message);
        
        try {
            // Store user message in database
            const result = await client.query(
                'INSERT INTO messages (content, user_id, is_admin) VALUES ($1, $2, $3) RETURNING *',
                [message.text, message.userId, false]
            );
            const newMessage = result.rows[0];
            
            // Emit to all clients (for real-time updates)
            io.emit('message', {
                ...newMessage,
                text: newMessage.content
            });

            // Update unread count for this user (increment by 1)
            try {
                const unreadResult = await client.query(
                    'SELECT COUNT(*) as count FROM messages WHERE user_id = $1 AND is_admin = false AND read_at IS NULL',
                    [message.userId]
                );
                const unreadCount = parseInt(unreadResult.rows[0].count) || 0;
                io.emit('unreadCountUpdated', { userId: message.userId, count: unreadCount });
            } catch (err) {
                console.error('Error updating unread count:', err);
            }

            // Check if this is the user's first non-system message
            const userMessageCount = await client.query(
                'SELECT COUNT(*) FROM messages WHERE user_id = $1 AND NOT is_auto_response',
                [message.userId]
            );

            // Send automatic response for user's first message
            if (userMessageCount.rows[0].count === '1' && !userFirstMessages.has(message.userId)) {
                userFirstMessages.add(message.userId);
                console.log('Sending auto-response to user:', message.userId);
                const autoResponseDelay = parseInt(process.env.AUTO_RESPONSE_DELAY) || 1000;
                setTimeout(async () => {
                    const autoResponseText = process.env.AUTO_RESPONSE_MESSAGE || "Thank you for reaching out! An agent will join you shortly. Please wait a moment.";
                    const autoResult = await client.query(
                        'INSERT INTO messages (content, user_id, is_admin, is_auto_response) VALUES ($1, $2, $3, $4) RETURNING *',
                        [
                            autoResponseText,
                            message.userId,
                            true,
                            true
                        ]
                    );
                    const autoResponse = autoResult.rows[0];
                    io.emit('message', {
                        ...autoResponse,
                        text: autoResponse.content
                    });
                }, autoResponseDelay);
            }
        } catch (err) {
            console.error('Error storing message:', err);
        }
    });

    socket.on('adminMessage', async (message) => {
        console.log('Received admin message:', message);
        if (message.adminId && message.userId) {
            try {
                const result = await client.query(
                    'INSERT INTO messages (content, user_id, admin_id, is_admin) VALUES ($1, $2, $3, $4) RETURNING *',
                    [message.text, message.userId, message.adminId, true]
                );
                const newMessage = result.rows[0];
                io.emit('message', {
                    ...newMessage,
                    text: newMessage.content
                });
            } catch (err) {
                console.error('Error storing admin message:', err);
            }
        }
    });
    
    // Handle admin typing indicator
    socket.on('adminTyping', (data) => {
        console.log('Admin typing:', data);
        if (data.userId) {
            // Broadcast typing indicator to specific user
            io.emit('adminTyping', { userId: data.userId });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Admin signup route (place this before the login route)
app.post('/admin/signup', async (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // Check if admin already exists
        const checkUser = await client.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash password and create admin
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const result = await client.query(
            'INSERT INTO admins (username, password) VALUES ($1, $2) RETURNING id, username, created_at',
            [username, hashedPassword]
        );

        console.log('Admin created successfully:', result.rows[0]);
        res.status(201).json({
            message: 'Admin created successfully',
            admin: {
                id: result.rows[0].id,
                username: result.rows[0].username,
                created_at: result.rows[0].created_at
            }
        });
    } catch (err) {
        console.error('Error creating admin:', err);
        res.status(500).json({ message: 'Error creating admin account' });
    }
});

// Check admin login status
app.get('/admin/check-auth', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            isAuthenticated: true,
            user: {
                id: req.user.id,
                username: req.user.username
            }
        });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// Admin login route
app.post('/admin/login', (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    passport.authenticate('local', async (err, user, info) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (!user) {
            try {
                const result = await client.query('SELECT username FROM admins WHERE username = $1', [username]);
                if (result.rows.length === 0) {
                    return res.status(401).json({ 
                        message: 'User does not exist. Please sign up first.',
                        signup_required: true
                    });
                } else {
                    return res.status(401).json({ message: 'Incorrect password' });
                }
            } catch (dbErr) {
                console.error('Database error:', dbErr);
                return res.status(500).json({ message: 'Error checking credentials' });
            }
        }

        req.logIn(user, async (loginErr) => {
            if (loginErr) {
                console.error('Session error:', loginErr);
                return res.status(500).json({ message: 'Error logging in' });
            }

            try {
                // Get active users and their messages
                const activeUsers = await getActiveUsers();
                const messagesByUser = {};
                const unreadCounts = {};

                for (const userId of activeUsers) {
                    messagesByUser[userId] = await getUserMessages(userId);

                    // Calculate unread count for this user
                    try {
                        const result = await client.query(
                            'SELECT COUNT(*) as count FROM messages WHERE user_id = $1 AND is_admin = false AND read_at IS NULL',
                            [userId]
                        );
                        unreadCounts[userId] = parseInt(result.rows[0].count) || 0;
                    } catch (err) {
                        console.error('Error calculating unread count for user', userId, err);
                        unreadCounts[userId] = 0;
                    }
                }

                return res.json({
                    message: 'Login successful',
                    user: {
                        id: user.id,
                        username: user.username
                    },
                    activeUsers,
                    messagesByUser,
                    unreadCounts
                });
            } catch (dbErr) {
                console.error('Error fetching messages:', dbErr);
                return res.status(500).json({ message: 'Error fetching message history' });
            }
        });
    })(req, res, next);
});

// Update the dashboard route
app.get('/admin/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const activeUsers = await getActiveUsers();
        const messagesByUser = {};
        const unreadCounts = {};

        for (const userId of activeUsers) {
            messagesByUser[userId] = await getUserMessages(userId);

            // Calculate unread count for this user
            try {
                const result = await client.query(
                    'SELECT COUNT(*) as count FROM messages WHERE user_id = $1 AND is_admin = false AND read_at IS NULL',
                    [userId]
                );
                unreadCounts[userId] = parseInt(result.rows[0].count) || 0;
            } catch (err) {
                console.error('Error calculating unread count for user', userId, err);
                unreadCounts[userId] = 0;
            }
        }

        res.json({ activeUsers, messagesByUser, unreadCounts });
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        res.status(500).json({ message: 'Error fetching dashboard data' });
    }
});

app.post('/admin/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ message: 'Error logging out' });
        }
        res.json({ message: 'Logout successful' });
    });
});

// Serve static files
app.use(express.static('public'));

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        await client.end();
        console.log('Database connection closed.');
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

// Start server
const PORT = parseInt(process.env.PORT) || 3010;
const HOST = process.env.HOST || 'localhost';
server.listen(PORT, HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
