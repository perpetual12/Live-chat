-- Create the database
CREATE DATABASE live_chat_db;

-- Connect to the database
\c live_chat_db;

-- Create admins table
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create session table for connect-pg-simple
CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- Create messages table with improved structure
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    admin_id INTEGER REFERENCES admins(id),
    is_admin BOOLEAN DEFAULT FALSE,
    is_auto_response BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Create index on session expire
CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- Create index on user_id for faster message retrieval
CREATE INDEX "IDX_messages_user_id" ON "messages" ("user_id"); 