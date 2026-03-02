import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="navbar">
            <div className="nav-content">
                <div className="nav-logo">
                    DocuForge
                </div>

                {user && (
                    <div className="nav-links">
                        <Link to="/" className={isActive('/') ? 'active' : ''}>
                            Dashboard
                        </Link>
                        <Link to="/templates" className={isActive('/templates') ? 'active' : ''}>
                            Templates
                        </Link>
                        <Link to="/documents" className={isActive('/documents') ? 'active' : ''}>
                            Documents
                        </Link>
                    </div>
                )}

                <div className="nav-user">
                    {user ? (
                        <div className="flex items-center gap-4">
                            <span className="user-welcome">Welcome, {user.username}</span>
                            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="nav-links">
                            <Link to="/login">Login</Link>
                            <Link to="/register" className="btn btn-primary btn-sm">
                                Get Started
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default Navbar;