import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminChat from './components/AdminChat.js';
import UserChat from './components/UserChat.js';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminChat />} />
        <Route path="/" element={<UserChat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
