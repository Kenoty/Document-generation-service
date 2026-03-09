import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!username || !password) {
            setError('Please fill in all fields');
            return;
        }

        setLoading(true);
        setError('');

        const result = await login(username, password);

        if (!result.success) {
            setError(result.message);
            setLoading(false);
        }
        // Не делаем navigate — GuestRoute сам редиректнет на /
    };

    const handleGuestLogin = () => {
        navigate('/templates');
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <div className="auth-header">
                    <h2>Login to DocuForge</h2>
                    <p className="text-muted">Enter your credentials to access your account</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form-content">
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                            className="form-input"
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            className="form-input"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary btn-full"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <button
                    onClick={handleGuestLogin}
                    className="btn btn-guest btn-full"
                >
                    Continue as Guest
                </button>

                <div className="auth-footer">
                    <p className="text-center">
                        Don't have an account? <Link to="/register" className="auth-link">Register here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;