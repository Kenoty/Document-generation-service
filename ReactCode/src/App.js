import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Templates from './components/Templates';
import Documents from './components/Documents';
import Navbar from './components/Navbar';
import './App.css';

// Только для авторизованных → иначе на /login
function ProtectedRoute({ children }) {
    const { user } = useAuth();
    return user ? children : <Navigate to="/login" />;
}

// Только для гостей → иначе на /
function GuestRoute({ children }) {
    const { user } = useAuth();
    return user ? <Navigate to="/" /> : children;
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
    return (
        <Routes>
            {/* Гостевые — только для неавторизованных */}
            <Route path="/login" element={
                <GuestRoute>
                    <Login />
                </GuestRoute>
            } />
            <Route path="/register" element={
                <GuestRoute>
                    <Register />
                </GuestRoute>
            } />

            {/* ✅ Открыт всем — без ProtectedRoute */}
            <Route path="/templates" element={
                <AppLayout>
                    <Templates />
                </AppLayout>
            } />

            {/* Только для авторизованных */}
            <Route path="/" element={
                <ProtectedRoute>
                    <AppLayout>
                        <Dashboard />
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