# Live Chat Application

A real-time chat application with admin interface built with Node.js, React, Socket.IO, and PostgreSQL.

## Features

- Real-time messaging between users and admins
- Admin dashboard with user management
- Unread message indicators that persist across sessions
- Auto-response system for new users
- Session-based authentication
- Responsive design
- Environment-based configuration

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd live-chat-application
```

### 2. Environment Configuration

Copy the example environment files and configure them:

```bash
# Server environment
cp .env.example .env

# Client environment
cp client/.env.example client/.env
```

### 3. Configure Environment Variables

Edit the `.env` file and update the following critical variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=live_chat_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Session Security
SESSION_SECRET=your_super_secure_session_secret_change_this_in_production

# Admin Credentials
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change_this_password
```

### 4. Database Setup

Create a PostgreSQL database and run the schema:

```sql
-- Connect to PostgreSQL and create database
CREATE DATABASE live_chat_db;

-- Connect to the database and create tables
\c live_chat_db;

-- Create admins table
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    admin_id INTEGER REFERENCES admins(id),
    is_admin BOOLEAN DEFAULT FALSE,
    is_auto_response BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create session table (for express-session)
CREATE TABLE session (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IDX_session_expire ON session (expire);
```

### 5. Install Dependencies

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 6. Build the Client

```bash
cd client
npm run build
cd ..
cp -r client/build/* public/
```

### 7. Start the Application

```bash
# Start the server
npm start
```

The application will be available at:
- Main application: `http://localhost:3010`
- Admin interface: `http://localhost:3010/admin`

## Usage

### Admin Setup

1. Create an admin account:
```bash
curl -X POST http://localhost:3010/admin/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_secure_password"}'
```

2. Login to the admin interface at `http://localhost:3010/admin`

### User Interface

Users can access the chat interface at `http://localhost:3010`

## Environment Variables Reference

### Server (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3010` |
| `HOST` | Server host | `localhost` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `live_chat_db` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | **Required** |
| `SESSION_SECRET` | Session encryption key | **Required** |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` |
| `WELCOME_MESSAGE` | Auto welcome message | Default message |
| `AUTO_RESPONSE_MESSAGE` | Auto response message | Default message |
| `AUTO_RESPONSE_DELAY` | Auto response delay (ms) | `1000` |

### Client (client/.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_BASE_URL` | API server URL | `http://localhost:3010` |
| `REACT_APP_SOCKET_URL` | Socket.IO server URL | `http://localhost:3010` |
| `REACT_APP_DEBUG_MODE` | Enable debug logging | `false` |

## Security Considerations

1. **Change default passwords** in production
2. **Use strong session secrets** (32+ characters)
3. **Enable HTTPS** in production
4. **Configure CORS** properly for your domain
5. **Use environment variables** for all sensitive data
6. **Never commit** `.env` files to version control

## Development

### Running in Development Mode

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Start the React development server
cd client
npm start
```

### Testing

```bash
# Run server tests
npm test

# Run client tests
cd client
npm test
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a production database
3. Configure proper CORS origins
4. Use HTTPS
5. Set secure session configuration
6. Use a process manager like PM2

## Troubleshooting

### Common Issues

1. **Database connection failed**: Check database credentials and ensure PostgreSQL is running
2. **Session errors**: Verify session table exists and session secret is set
3. **CORS errors**: Check CORS_ORIGIN environment variable
4. **Socket connection failed**: Verify SOCKET_CORS_ORIGIN matches client URL

### Logs

Check application logs for detailed error information:
```bash
tail -f logs/app.log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
