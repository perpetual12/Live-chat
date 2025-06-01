# Live Chat Customer Support Application

## 🌟 About This Application

This is a **real-time customer support chat system** designed to provide seamless communication between website visitors and support agents. The application enables businesses to offer instant customer support through a modern, responsive web interface.

### 🎯 Purpose & Use Cases

**For Businesses:**
- Provide instant customer support on your website
- Manage multiple customer conversations simultaneously
- Track unread messages and response times
- Offer automated welcome messages for new visitors
- Monitor customer engagement and support metrics

**For Customers:**
- Get immediate help without phone calls or emails
- Simple, intuitive chat interface
- No registration required - just start chatting
- Receive instant responses from support agents

**Perfect For:**
- E-commerce websites needing customer support
- SaaS platforms offering user assistance
- Service businesses providing online consultations
- Any website wanting to improve customer engagement

## ✨ Key Features

### 🔄 Real-Time Communication
- **Instant messaging** between customers and support agents
- **Live typing indicators** to show when agents are responding
- **Socket.IO powered** for reliable real-time connections
- **Auto-reconnection** handling for stable connections

### 👨‍💼 Admin Dashboard
- **Centralized support interface** for managing all customer chats
- **User list with unread indicators** showing which customers need attention
- **Persistent unread counts** that survive admin login/logout sessions
- **Message history** for each customer conversation
- **Multi-admin support** with session-based authentication

### 🤖 Smart Auto-Response System
- **Welcome messages** automatically sent to new visitors
- **Configurable auto-responses** for when agents are busy
- **Customizable message templates** via environment variables
- **First-time visitor detection** for personalized greetings

### 🔒 Security & Privacy
- **Session-based authentication** for admin access
- **Environment variable configuration** for sensitive data
- **Secure password hashing** with bcrypt
- **CORS protection** and security headers
- **No customer data exposure** in client-side code

### 📱 User Experience
- **Responsive design** that works on desktop, tablet, and mobile
- **Clean, modern interface** with intuitive navigation
- **Real-time status indicators** showing connection status
- **Smooth animations** and visual feedback
- **Accessibility features** with proper ARIA labels

## 🏗️ Technology Stack

### Backend
- **Node.js** - Server runtime environment
- **Express.js** - Web application framework
- **Socket.IO** - Real-time bidirectional communication
- **PostgreSQL** - Robust relational database
- **Passport.js** - Authentication middleware
- **bcrypt** - Password hashing and security
- **express-session** - Session management

### Frontend
- **React** - Modern UI library with hooks
- **Socket.IO Client** - Real-time client communication
- **Tailwind CSS** - Utility-first CSS framework
- **Heroicons** - Beautiful SVG icons
- **Responsive Design** - Mobile-first approach

### Infrastructure
- **Environment Variables** - Secure configuration management
- **Session Store** - PostgreSQL-backed session storage
- **CORS** - Cross-origin resource sharing
- **Security Headers** - Protection against common attacks

## 🏛️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Customer UI   │    │   Admin Panel   │    │   Database      │
│                 │    │                 │    │                 │
│ • Chat Interface│    │ • User List     │    │ • Messages      │
│ • Auto Messages │    │ • Chat History  │    │ • Admins        │
│ • Real-time     │    │ • Unread Counts │    │ • Sessions      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴───────────┐
                    │     Node.js Server      │
                    │                         │
                    │ • Express.js Routes     │
                    │ • Socket.IO Events      │
                    │ • Authentication        │
                    │ • Session Management    │
                    │ • Real-time Messaging   │
                    └─────────────────────────┘
```

### Data Flow
1. **Customer** visits website and starts chatting
2. **Socket.IO** establishes real-time connection
3. **Messages** are stored in PostgreSQL database
4. **Admin** receives real-time notifications
5. **Unread counts** are calculated and persisted
6. **Auto-responses** are triggered for new conversations

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
