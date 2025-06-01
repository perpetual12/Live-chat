import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const SOCKET_URL = 'http://localhost:3010';

function UserChat() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [userId] = useState(() => localStorage.getItem('chatUserId') || Date.now().toString());
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('chatUserId', userId);
    setIsLoading(true);
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      newSocket.emit('requestUserHistory', userId);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('message', (message) => {
      setMessages(prev => [...prev, message]);
      // Mark admin messages as read when received
      if (message.is_admin && !message.read_at) {
        newSocket.emit('markMessagesRead', { userId, isAdmin: false });
      }
      
      // Show typing indicator briefly when admin sends a message
      if (message.is_admin && !message.is_auto_response) {
        setIsTyping(false);
      }
    });

    newSocket.on('adminTyping', (data) => {
      if (data.userId === userId) {
        setIsTyping(true);
        // Auto-clear typing indicator after 3 seconds
        setTimeout(() => setIsTyping(false), 3000);
      }
    });

    newSocket.on('messageHistory', (history) => {
      setMessages(history);
      setIsLoading(false);
      // Mark any unread admin messages as read
      const hasUnreadAdminMessages = history.some(msg => msg.is_admin && !msg.read_at);
      if (hasUnreadAdminMessages) {
        newSocket.emit('markMessagesRead', { userId, isAdmin: false });
      }
    });

    return () => newSocket.close();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input field when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, [isConnected]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() && socket) {
      socket.emit('userMessage', {
        text: messageInput,
        userId: userId
      });
      setMessageInput('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    // Send message on Enter (but not with Shift+Enter which should create a new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-darker-blue to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-dark-blue to-blue-700 text-white p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Live Chat Support</h2>
          <div className="flex items-center">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-500'}`}></span>
            <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        
        <div className="h-[500px] flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-2 text-gray-600">Loading conversation...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Start a conversation with our support team</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isLastInGroup = idx === messages.length - 1 || 
                    messages[idx + 1]?.is_admin !== msg.is_admin;
                  const isFirstInGroup = idx === 0 || 
                    messages[idx - 1]?.is_admin !== msg.is_admin;
                  const messageTime = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${msg.is_admin ? 'items-start' : 'items-end'} 
                        ${!isLastInGroup ? 'mb-1' : 'mb-4'}`}
                    >
                      {isFirstInGroup && msg.is_admin && (
                        <span className="text-xs text-gray-500 ml-2 mb-1">Support</span>
                      )}
                      <div
                        className={`message ${
                          msg.is_admin 
                            ? 'admin-message mr-auto bg-gray-100 rounded-tl-none' 
                            : 'user-message ml-auto bg-blue-600 text-white rounded-tr-none'
                        } ${msg.is_auto_response ? 'bg-orange-50 border-l-4 border-orange-500 italic mr-auto text-gray-700' : ''} 
                        flex flex-col shadow-sm transition-all duration-200 hover:shadow-md`}
                      >
                        <div className="break-words">{msg.content || msg.text}</div>
                        <div className={`flex items-center justify-end text-xs ${msg.is_admin ? 'text-gray-500' : 'text-blue-100'} mt-1`}>
                          <span>{messageTime}</span>
                          {!msg.is_admin && (
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
              {isTyping && (
                <div className="flex items-start">
                  <div className="bg-gray-100 rounded-lg p-3 max-w-[70%] animate-pulse">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
          
          <form onSubmit={sendMessage} className="chat-input border-t border-gray-200">
            <input
              ref={inputRef}
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={!isConnected}
              className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
              aria-label="Message input"
            />
            <button 
              type="submit" 
              disabled={!isConnected || !messageInput.trim()}
              className="transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label="Send message"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              <span className="ml-1 sm:inline hidden">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UserChat;
