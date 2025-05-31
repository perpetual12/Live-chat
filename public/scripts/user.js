const socket = io('http://localhost:3010');
        const userId = localStorage.getItem('chatUserId') || Date.now().toString();
        localStorage.setItem('chatUserId', userId);
        let messageHistory = [];

        socket.on('connect', () => {
            console.log('Connected to server');
            // Request message history for this user
            socket.emit('requestUserHistory', userId);
        });

        socket.on('messageHistory', (messages) => {
            console.log('Received message history:', messages);
            messageHistory = messages;
            const messagesDiv = document.getElementById('messages');
            messagesDiv.innerHTML = '';
            messages.forEach(message => {
                appendMessage(
                    message.content || message.text,
                    message.is_admin,
                    message.is_auto_response,
                    new Date(message.created_at),
                    message.read_at
                );
            });
            // Mark admin messages as read
            socket.emit('markMessagesRead', { userId, isAdmin: false });
            // Scroll to bottom after loading history
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });

        socket.on('message', (message) => {
            if (message.user_id === userId) {
                messageHistory.push(message);
                appendMessage(
                    message.content || message.text,
                    message.is_admin,
                    message.is_auto_response,
                    new Date(message.created_at),
                    message.read_at
                );
                // If it's an admin message, mark it as read immediately
                if (message.is_admin) {
                    socket.emit('markMessagesRead', { userId, isAdmin: false });
                }
            }
        });

        socket.on('messagesUpdated', ({ userId: updatedUserId, messages }) => {
            if (updatedUserId === userId) {
                messageHistory = messages;
                const messagesDiv = document.getElementById('messages');
                messagesDiv.innerHTML = '';
                messages.forEach(message => {
                    appendMessage(
                        message.content || message.text,
                        message.is_admin,
                        message.is_auto_response,
                        new Date(message.created_at),
                        message.read_at
                    );
                });
            }
        });

        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (message) {
                socket.emit('userMessage', {
                    text: message,
                    userId: userId
                });
                input.value = '';
            }
        }

        function appendMessage(text, isAdmin, isAutoResponse, timestamp = new Date(), readAt = null) {
            const messagesDiv = document.getElementById('messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isAdmin ? 'admin-message' : 'user-message'}`;
            
            if (!readAt && isAdmin) {
                messageDiv.classList.add('unread');
            }

            if (isAutoResponse) {
                messageDiv.style.fontStyle = 'italic';
                messageDiv.style.borderLeft = '3px solid #ff9800';
                messageDiv.style.backgroundColor = '#fff3e0';
            }
            
            messageDiv.innerHTML = `
                <div>${text}</div>
                <div class="timestamp">${isAdmin ? 'Support' : 'You'} • ${timestamp.toLocaleTimeString()}</div>
                ${!isAdmin ? `<div class="read-status">${readAt ? 'Seen ' + new Date(readAt).toLocaleTimeString() : 'Delivered'}</div>` : ''}
            `;
            
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        // Handle enter key
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Add visibility change handler to mark messages as read when user views them
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                socket.emit('markMessagesRead', { userId, isAdmin: false });
            }
        });

        // Add reconnection handling
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        socket.on('reconnect', () => {
            console.log('Reconnected to server');
            // Re-request message history after reconnection
            socket.emit('requestUserHistory', userId);
        });