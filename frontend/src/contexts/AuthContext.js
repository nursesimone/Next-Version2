import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [nurse, setNurse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('nurse_token');
    const savedNurse = localStorage.getItem('nurse_data');
    
    if (token && savedNurse) {
      setNurse(JSON.parse(savedNurse));
      // Verify token is still valid
      authAPI.getMe()
        .then(res => {
          setNurse(res.data);
          localStorage.setItem('nurse_data', JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem('nurse_token');
          localStorage.removeItem('nurse_data');
          setNurse(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { token, nurse: nurseData } = response.data;
    localStorage.setItem('nurse_token', token);
    localStorage.setItem('nurse_data', JSON.stringify(nurseData));
    setNurse(nurseData);
    return nurseData;
  };

  const register = async (data) => {
    const response = await authAPI.register(data);
    const { token, nurse: nurseData } = response.data;
    localStorage.setItem('nurse_token', token);
    localStorage.setItem('nurse_data', JSON.stringify(nurseData));
    setNurse(nurseData);
    return nurseData;
  };

  const logout = () => {
    localStorage.removeItem('nurse_token');
    localStorage.removeItem('nurse_data');
    setNurse(null);
  };

  return (
    <AuthContext.Provider value={{ nurse, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
