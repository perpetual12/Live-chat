import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { UserIcon, ArrowRightOnRectangleIcon, PaperAirplaneIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3010';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

function AdminChat() {
  const [socket, setSocket] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [messageHistory, setMessageHistory] = useState({});
  const [activeUsers, setActiveUsers] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [adminId, setAdminId] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (isLoggedIn && !socket) {
      setIsLoading(true);
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        newSocket.emit('adminConnected');
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      newSocket.on('activeUsers', (users) => {
        console.log('Received active users:', users);
        setActiveUsers(users);
        setIsLoading(false);
      });

      newSocket.on('unreadCounts', (counts) => {
        console.log('Received unread counts:', counts);
        setUnreadCounts(counts);
      });

      newSocket.on('unreadCountUpdated', ({ userId, count }) => {
        console.log(`Unread count updated for user ${userId}: ${count}`);
        setUnreadCounts(prev => ({
          ...prev,
          [userId]: count
        }));
      });

      newSocket.on('message', (message) => {
        console.log('Received message:', message);
        setMessageHistory(prev => {
          const userId = message.user_id;
          const updatedHistory = { ...prev };
          if (!updatedHistory[userId]) {
            updatedHistory[userId] = [];
          }

          // Check if message already exists to prevent duplicates
          const messageExists = updatedHistory[userId].some(msg =>
            msg.id === message.id ||
            (msg.content === message.content && Math.abs(new Date(msg.created_at) - new Date(message.created_at)) < 1000)
          );

          if (!messageExists) {
            updatedHistory[userId] = [...updatedHistory[userId], message];
          }

          return updatedHistory;
        });

        // Update unread count if message is from user and admin is not viewing that chat
        if (!message.is_admin && currentUserId !== message.user_id) {
          setUnreadCounts(prev => ({
            ...prev,
            [message.user_id]: (prev[message.user_id] || 0) + 1
          }));
        }
      });

      newSocket.on('messagesRead', ({ userId }) => {
        setMessageHistory(prev => {
          const updatedHistory = { ...prev };
          if (updatedHistory[userId]) {
            updatedHistory[userId] = updatedHistory[userId].map(msg => ({
              ...msg,
              read_at: msg.read_at || (msg.is_admin ? new Date().toISOString() : msg.read_at)
            }));
          }
          return updatedHistory;
        });
      });

      return () => {
        console.log('Cleaning up socket connection');
        newSocket.close();
      };
    }
  }, [isLoggedIn]);

  // When admin switches to a user's chat, mark messages as read
  useEffect(() => {
    if (currentUserId && socket) {
      socket.emit('markMessagesRead', { userId: currentUserId, isAdmin: true });
      setUnreadCounts(prev => ({ ...prev, [currentUserId]: 0 }));
      inputRef.current?.focus();
    }
  }, [currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageHistory, currentUserId]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/check-auth`, {
        credentials: 'include'
      });
      const data = await response.json();
      setIsLoggedIn(data.isAuthenticated);
      if (data.isAuthenticated && data.user) {
        setAdminId(data.user.id);
        loadDashboardData();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        credentials: 'include'
      });
      const data = await response.json();
      setActiveUsers(data.activeUsers || []);
      setMessageHistory(data.messagesByUser || {});
      setUnreadCounts(data.unreadCounts || {});
      console.log('Dashboard data loaded, unread counts:', data.unreadCounts);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      // setIsLoggedIn(data.isAuthenticated);
      // if (data.isAuthenticated && data.user) {
      //   setAdminId(data.user.id);
      //   loadDashboardData();
      // } else {
      //   setError(data.message || 'Login failed');
      // }
      
      if (response.ok) {
        setIsLoggedIn(true);
        setAdminId(data.user.id);
        setError('');
        setMessageHistory(data.messagesByUser || {});
        setActiveUsers(data.activeUsers || []);
        setUnreadCounts(data.unreadCounts || {});
        console.log('Login successful, loaded unread counts:', data.unreadCounts);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Error connecting to server. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/admin/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setIsLoggedIn(false);
      setCurrentUserId(null);
      setMessageHistory({});
      setActiveUsers([]);
      if (socket) {
        socket.close();
        setSocket(null);
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && currentUserId && socket && adminId) {
      const messageData = {
        text: messageInput,
        userId: currentUserId,
        adminId: adminId
      };
      console.log('Sending admin message:', messageData);
      console.log('Current state - adminId:', adminId, 'currentUserId:', currentUserId, 'socket connected:', socket?.connected);
      socket.emit('adminMessage', messageData);
      setMessageInput('');
      inputRef.current?.focus();
    } else {
      console.log('Cannot send message - missing requirements:', {
        messageInput: messageInput.trim(),
        currentUserId,
        socket: !!socket,
        adminId,
        socketConnected: socket?.connected
      });
    }
  };

  const handleKeyDown = (e) => {
    // Send message on Enter (but not with Shift+Enter which should create a new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    } else {
      // Send typing indicator
      if (currentUserId && socket && adminId) {
        socket.emit('adminTyping', { userId: currentUserId });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-darker-blue to-blue-900 flex items-center justify-center p-4">
      {!isLoggedIn ? ( 
        <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-xl">
          <h2 className="text-2xl font-bold mb-6 text-center text-dark-blue">Admin Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            {error && <div className="text-red-500 text-sm p-2 bg-red-50 rounded border border-red-200">{error}</div>}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-colors shadow-md"
            >
              Login
            </button>
          </form>
        </div>

       ) : (
         <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-dark-blue to-blue-700 text-white p-4 flex justify-between items-center">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold">Admin Dashboard</h2>
              {isConnected ? (
                <span className="ml-3 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-1"></span>
                  Online
                </span>
              ) : (
                <span className="ml-3 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-1"></span>
                  Offline
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 bg-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-800 transition-colors text-sm shadow-sm"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row h-[500px]">
            <div className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-gray-200 max-h-[200px] sm:max-h-full sm:h-full overflow-y-auto">
              <div className="sticky top-0 bg-gray-50 p-3 text-sm font-medium text-gray-700 border-b border-gray-200 flex items-center justify-between">
                <span>Active Users</span>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                  {activeUsers.length}
                </span>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <ArrowPathIcon className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : activeUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No active users at the moment
                </div>
              ) : (
                activeUsers.map(userId => (
                  <div
                    key={userId}
                    onClick={() => setCurrentUserId(userId)}
                    className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      currentUserId === userId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        currentUserId === userId ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <UserIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">User {userId.substring(0, 8)}</span>
                        <div className="text-xs text-gray-500">
                          {messageHistory[userId]?.length || 0} messages
                        </div>
                      </div>
                    </div>
                    {unreadCounts[userId] > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                        {unreadCounts[userId]}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="flex-1 flex flex-col min-h-0">
              {currentUserId ? (
                <>
                  <div className="bg-gray-50 p-3 border-b border-gray-200 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">User {currentUserId.substring(0, 8)}</div>
                      <div className="text-xs text-gray-500">
                        {messageHistory[currentUserId]?.length || 0} messages in conversation
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messageHistory[currentUserId]?.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      messageHistory[currentUserId]?.map((msg, idx) => {
                        const isLastInGroup = idx === messageHistory[currentUserId].length - 1 || 
                          messageHistory[currentUserId][idx + 1]?.is_admin !== msg.is_admin;
                        const isFirstInGroup = idx === 0 || 
                          messageHistory[currentUserId][idx - 1]?.is_admin !== msg.is_admin;
                        const messageTime = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                        return (
                          <div
                            key={idx}
                            className={`flex flex-col ${
                              msg.is_admin ? 'items-end' : 'items-start'
                            } ${!isLastInGroup ? 'mb-1' : 'mb-4'}`}
                          >
                            {isFirstInGroup && !msg.is_admin && (
                              <span className="text-xs text-gray-500 ml-2 mb-1">User {currentUserId.substring(0, 8)}</span>
                            )}
                            <div
                              className={`message ${
                                msg.is_admin 
                                  ? 'admin-message ml-auto bg-blue-600 text-white rounded-tr-none' 
                                  : msg.is_auto_response 
                                    ? 'auto-message mr-auto bg-orange-50 border-l-4 border-orange-500 italic text-gray-700' 
                                    : 'user-message mr-auto bg-gray-100 rounded-tl-none'
                              } flex flex-col shadow-sm transition-all duration-200 hover:shadow-md`}
                            >
                              <div className="break-words">{msg.content || msg.text}</div>
                              <div className={`flex items-center justify-end text-xs ${msg.is_admin ? 'text-blue-100' : 'text-gray-500'} mt-1`}>
                                <span>{messageTime}</span>
                                {msg.is_admin && (
                                  <span className="ml-2">
                                    {msg.read_at ? (
                                      <span className="text-blue-100">✓✓</span>
                                    ) : (
                                      <span className="text-blue-200">✓</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  <form onSubmit={sendMessage} className="chat-input border-t border-gray-200 p-3 flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={!isConnected ? "Connecting..." : "Type your message..."}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      disabled={!isConnected}
                      aria-label="Message input"
                    />
                    <button
                      type="submit"
                      disabled={!isConnected || !messageInput.trim()}
                      className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      aria-label="Send message"
                      title={!isConnected ? "Waiting for connection..." : "Send message"}
                    >
                      <PaperAirplaneIcon className="h-5 w-5" />
                      <span className="ml-1 sm:inline hidden">Send</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                    <UserIcon className="h-8 w-8 text-blue-500" />
                  </div>
                  <p className="text-lg font-medium text-gray-700 mb-2">Select a user to start chatting</p>
                  <p className="text-sm text-gray-500 text-center max-w-md">
                    Choose a user from the sidebar to view their conversation history and respond to their messages.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminChat;
