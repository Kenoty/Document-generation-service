import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.defaults.baseURL = 'http://localhost:8080';
        axios.defaults.withCredentials = true; // Важно для работы с сессиями

        // Проверяем текущего пользователя при загрузке
        checkCurrentUser();
    }, []);

    const checkCurrentUser = async () => {
        try {
            console.log('Checking current user...');
            const response = await axios.get('/api/auth/current-user');
            console.log('User authenticated:', response.data);
            setUser(response.data);
        } catch (error) {
            console.log('User not authenticated, attempting to refresh session...');

            // Пытаемся обновить сессию перед полным сбросом
            try {
                await axios.post('/api/auth/refresh-session');
                const retryResponse = await axios.get('/api/auth/current-user');
                setUser(retryResponse.data);
                console.log('Session refreshed successfully');
            } catch (refreshError) {
                console.log('Session refresh failed, user not authenticated');
                setUser(null);
            }
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            console.log('Attempting login for:', username);
            const response = await axios.post('/api/auth/login', {
                username,
                password
            });

            const userData = response.data;
            console.log('Login successful:', userData);
            setUser(userData);

            return { success: true };
        } catch (error) {
            console.error('Login failed:', error.response?.data);

            // Очищаем возможные остаточные сессии
            try {
                await axios.post('/api/auth/logout');
            } catch (logoutError) {
                // Игнорируем ошибки логаута
            }

            return {
                success: false,
                message: error.response?.data || 'Login failed'
            };
        }
    };

    const register = async (username, password) => {
        try {
            const response = await axios.post('/api/auth/register', {
                username,
                password
            });

            const userData = response.data;
            setUser(userData);

            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data || 'Registration failed'
            };
        }
    };

    const logout = async () => {
        try {
            await axios.post('/api/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
        }
    };

    const value = {
        user,
        login,
        register,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}