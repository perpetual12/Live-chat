let socket;
        let currentUserId = null;
        let adminId = null;
        let messageHistory = {};

        // Check login status when page loads
        window.addEventListener('load', checkAuthStatus);

        async function checkAuthStatus() {
            try {
                const response = await fetch('/admin/check-auth');
                const data = await response.json();

                if (data.isAuthenticated) {
                    // User is logged in
                    adminId = data.user.id;
                    document.getElementById('loginSection').style.display = 'none';
                    document.getElementById('dashboardSection').style.display = 'block';
                    
                    // Initialize socket and load dashboard data
                    initializeSocket();
                    
                    // Load dashboard data
                    const dashboardResponse = await fetch('/admin/dashboard');
                    const dashboardData = await dashboardResponse.json();
                    
                    if (dashboardData.activeUsers) {
                        const chatList = document.getElementById('chatList');
                        chatList.innerHTML = '';
                        dashboardData.activeUsers.forEach(userId => addUserToList(userId));
                    }
                    
                    if (dashboardData.messagesByUser) {
                        messageHistory = dashboardData.messagesByUser;
                    }
                } else {
                    // User is not logged in
                    document.getElementById('loginSection').style.display = 'block';
                    document.getElementById('dashboardSection').style.display = 'none';
                }
            } catch (error) {
                console.error('Error checking auth status:', error);
            }
        }

        async function login() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    adminId = data.user.id;
                    document.getElementById('loginSection').style.display = 'none';
                    document.getElementById('dashboardSection').style.display = 'block';
                    
                    // Load existing users and messages
                    if (data.activeUsers) {
                        const chatList = document.getElementById('chatList');
                        chatList.innerHTML = '';
                        data.activeUsers.forEach(userId => addUserToList(userId));
                    }
                    
                    // Store message history
                    if (data.messagesByUser) {
                        messageHistory = data.messagesByUser;
                    }

                    initializeSocket();
                } else {
                    document.getElementById('loginError').textContent = data.message;
                }
            } catch (error) {
                console.error('Login error:', error);
                document.getElementById('loginError').textContent = 'Error connecting to server';
            }
        }

        async function logout() {
            try {
                const response = await fetch('/admin/logout', { 
                    method: 'POST',
                    credentials: 'same-origin' // Important for session handling
                });
                
                if (response.ok) {
                    // Disconnect socket
                    if (socket) {
                        socket.disconnect();
                    }
                    
                    // Clear admin state
                    adminId = null;
                    currentUserId = null;
                    messageHistory = {};
                    
                    // Show login form
                    document.getElementById('loginSection').style.display = 'block';
                    document.getElementById('dashboardSection').style.display = 'none';
                    document.getElementById('chatMessages').innerHTML = '';
                    document.getElementById('chatList').innerHTML = '';
                }
            } catch (error) {
                console.error('Error logging out:', error);
            }
        }

        function initializeSocket() {
            socket = io('http://localhost:3010');

            socket.on('connect', () => {
                console.log('Connected to server');
                socket.emit('adminConnected');
            });

            socket.on('activeUsers', (users) => {
                console.log('Received active users:', users);
                const chatList = document.getElementById('chatList');
                chatList.innerHTML = '';
                users.forEach(userId => addUserToList(userId));
            });

            socket.on('message', (message) => {
                console.log('Received message:', message);
                const userId = message.user_id;
                
                // Initialize message array if it doesn't exist
                if (!messageHistory[userId]) {
                    messageHistory[userId] = [];
                    addUserToList(userId);
                }
                
                // Add message to history
                messageHistory[userId].push(message);

                // If this is the current chat, display the message
                if (currentUserId === userId) {
                    appendMessage(
                        message.is_admin ? 'You' : `User ${userId}`,
                        message.content || message.text,
                        message.is_admin,
                        message.is_auto_response,
                        new Date(message.created_at)
                    );
                }
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from server');
            });

            socket.on('reconnect', () => {
                console.log('Reconnected to server');
                socket.emit('adminConnected');
                if (currentUserId) {
                    socket.emit('requestUserHistory', currentUserId);
                }
            });
        }

        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            
            if (message && currentUserId && adminId) {
                socket.emit('adminMessage', {
                    text: message,
                    adminId: adminId,
                    userId: currentUserId
                });
                input.value = '';
            }
        }

        function appendMessage(sender, text, isAdmin, isAutoResponse, timestamp = new Date()) {
            const messagesDiv = document.getElementById('chatMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isAdmin ? 'admin-message' : 'user-message'}`;
            
            if (isAutoResponse) {
                messageDiv.style.fontStyle = 'italic';
                messageDiv.style.borderLeft = '3px solid #ff9800';
                messageDiv.style.backgroundColor = '#fff3e0';
            }

            messageDiv.innerHTML = `
                <div>${text}</div>
                <div class="timestamp">${sender} • ${timestamp.toLocaleTimeString()}</div>
            `;
            
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function addUserToList(userId) {
            const chatList = document.getElementById('chatList');
            if (!document.getElementById(`user-${userId}`)) {
                const userDiv = document.createElement('div');
                userDiv.id = `user-${userId}`;
                userDiv.style.padding = '10px';
                userDiv.style.borderBottom = '1px solid #eee';
                userDiv.style.cursor = 'pointer';
                userDiv.onclick = () => selectUser(userId);
                userDiv.textContent = `User ${userId}`;
                chatList.appendChild(userDiv);
            }
        }

        function selectUser(userId) {
            currentUserId = userId;
            document.querySelectorAll('#chatList > div').forEach(div => {
                div.style.background = div.id === `user-${userId}` ? '#e3f2fd' : 'white';
            });
            
            // Load message history for selected user
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = '';
            
            if (messageHistory[userId]) {
                messageHistory[userId].forEach(message => {
                    appendMessage(
                        message.is_admin ? 'You' : `User ${userId}`,
                        message.content,
                        message.is_admin,
                        message.is_auto_response
                    );
                });
            }
        }

        // Handle enter key
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });