import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Templates from './components/Templates';
import Documents from './components/Documents';
import Navbar from './components/Navbar';
import './App.css';
import axios from 'axios';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function AppLayout({ children }) {
  return (
      <div className="App">
        <Navbar />
        <main className="main-content">
          <div className="container">
            {children}
          </div>
        </main>
      </div>
  );
}

function AppContent() {
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await axios.post('/api/auth/refresh-session');
      } catch (error) {
        console.log('No active session or refresh failed');
      }
    };

    initializeAuth();
  }, []);

  const { user } = useAuth();

  return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/templates" element={
          <ProtectedRoute>
            <AppLayout>
              <Templates />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/documents" element={
          <ProtectedRoute>
            <AppLayout>
              <Documents />
            </AppLayout>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
  );
}

function App() {
  return (
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
  );
}

export default App;