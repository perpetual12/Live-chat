// Add this after your existing message table creation
const createReadStatusTable = `
  CREATE TABLE IF NOT EXISTS message_read_status (
    message_id INTEGER REFERENCES messages(id),
    read_at TIMESTAMP,
    PRIMARY KEY (message_id)
  )
`;

db.run(createReadStatusTable);

io.on('connection', (socket) => {
  // ... existing socket connection code ...

  socket.on('userMessage', async (data) => {
    try {
      const { text, userId } = data;
      const result = await db.run(
        'INSERT INTO messages (content, user_id, is_admin, created_at) VALUES (?, ?, ?, ?)',
        [text, userId, false, new Date().toISOString()]
      );
      
      const message = {
        id: result.lastID,
        content: text,
        user_id: userId,
        is_admin: false,
        created_at: new Date().toISOString(),
        read_at: null
      };

      io.emit('message', message);
    } catch (error) {
      console.error('Error saving user message:', error);
    }
  });

  socket.on('adminMessage', async (data) => {
    try {
      const { text, userId, adminId } = data;
      const result = await db.run(
        'INSERT INTO messages (content, user_id, admin_id, is_admin, created_at) VALUES (?, ?, ?, ?, ?)',
        [text, userId, adminId, false, new Date().toISOString()]
      );
      
      const message = {
        id: result.lastID,
        content: text,
        user_id: userId,
        admin_id: adminId,
        is_admin: true,
        created_at: new Date().toISOString(),
        read_at: null
      };

      io.emit('message', message);
    } catch (error) {
      console.error('Error saving admin message:', error);
    }
  });

  socket.on('markMessagesRead', async ({ userId, isAdmin }) => {
    try {
      const currentTime = new Date().toISOString();
      
      // Mark messages as read based on who is marking them
      await db.run(
        `UPDATE messages SET read_at = ? 
         WHERE user_id = ? AND is_admin = ? AND read_at IS NULL`,
        [currentTime, userId, !isAdmin]
      );

      // Notify clients about read status update
      io.emit('messagesRead', { userId, timestamp: currentTime });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  socket.on('requestUserHistory', async (userId) => {
    try {
      const messages = await db.all(
        'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC',
        [userId]
      );
      socket.emit('messageHistory', messages);
    } catch (error) {
      console.error('Error fetching message history:', error);
    }
  });

  socket.on('adminConnected', async () => {
    try {
      // Get all unique user IDs who have sent messages
      const users = await db.all(
        'SELECT DISTINCT user_id FROM messages ORDER BY created_at DESC'
      );
      
      // Get unread message counts for each user
      const unreadCounts = {};
      for (const user of users) {
        const count = await db.get(
          'SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND is_admin = 0 AND read_at IS NULL',
          [user.user_id]
        );
        unreadCounts[user.user_id] = count.count;
      }
      
      socket.emit('activeUsers', users.map(u => u.user_id));
      socket.emit('unreadCounts', unreadCounts);
    } catch (error) {
      console.error('Error handling admin connection:', error);
    }
  });
}); 