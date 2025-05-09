"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Helper functions for cookie management
const setCookie = (name: string, value: string, days: number = 7, path: string = '/') => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=' + path + '; SameSite=Lax';
};

const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null; // Guard for SSR or non-browser environments
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
};

const deleteCookie = (name: string, path: string = '/') => {
  document.cookie = name + '=; Max-Age=-99999999; path=' + path + '; SameSite=Lax';
};

interface AuthContextType {
  token: string | null;
  apiUrl: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (newToken: string, newApiUrl: string) => void;
  logout: () => void;
  setApiUrlOnly: (newApiUrl: string) => void; // For cases where token is already set (e.g. from env)
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true to check localStorage

  useEffect(() => {
    // Try to load token and apiUrl from cookies on initial load (client-side)
    const storedToken = getCookie('authToken');
    const storedApiUrl = getCookie('apiUrl');
    if (storedToken) {
      setToken(storedToken);
    }
    if (storedApiUrl) {
      setApiUrl(storedApiUrl);
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newApiUrl: string) => {
    setCookie('authToken', newToken);
    setCookie('apiUrl', newApiUrl);
    setToken(newToken);
    setApiUrl(newApiUrl);
  };

  const logout = () => {
    deleteCookie('authToken');
    deleteCookie('apiUrl');
    setToken(null);
    setApiUrl(null);
  };

  const setApiUrlOnly = (newApiUrl: string) => {
    setCookie('apiUrl', newApiUrl);
    setApiUrl(newApiUrl);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        apiUrl,
        isAuthenticated: !!token, // Considered authenticated if there's a token
        isLoading,
        login,
        logout,
        setApiUrlOnly,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 