import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
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

        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                // Не сбрасываем user при 401 на login/register
                if (error.response?.status === 401
                    && !error.config.url.includes('/api/auth/login')
                    && !error.config.url.includes('/api/auth/register')) {
                    setUser(null);
                }
                return Promise.reject(error);
            }
        );

        checkCurrentUser();

        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    const checkCurrentUser = async () => {
        try {
            const response = await axios.get('/api/auth/current-user');
            setUser(response.data);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = useCallback(async (username, password) => {
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
    }, []);

    const register = useCallback(async (username, password) => {
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
    }, []);

    const logout = useCallback(async () => {
        try {
            await axios.post('/api/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
        }
    }, []);

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