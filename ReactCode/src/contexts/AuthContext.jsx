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
        axios.defaults.withCredentials = true;

        // Глобальный перехватчик — при 401 сбрасываем пользователя
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response?.status === 401) {
                    setUser(null);
                }
                return Promise.reject(error);
            }
        );

        checkCurrentUser();

        // Очистка при размонтировании
        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    const checkCurrentUser = async () => {
        try {
            const response = await axios.get('/api/auth/current-user');
            setUser(response.data);
        } catch (error) {
            // 401 — просто не авторизован, это нормально
            console.log('User not authenticated');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            const response = await axios.post('/api/auth/login', {
                username,
                password
            });

            setUser(response.data);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message
                    || error.response?.data
                    || 'Login failed'
            };
        }
    };

    const register = async (username, password) => {
        try {
            const response = await axios.post('/api/auth/register', {
                username,
                password
            });

            setUser(response.data);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message
                    || error.response?.data
                    || 'Registration failed'
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