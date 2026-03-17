import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setLoading(false);
      } catch (err) {
        console.error('Error parsing stored user:', err);
        sessionStorage.removeItem('currentUser');
      }
    }

    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!storedUser && user) {
          setUser(user);
        }
      } catch (err) {
        if (!storedUser) {
          console.error('Error checking user:', err);
        }
      } finally {
        if (!storedUser) {
          setLoading(false);
        }
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!sessionStorage.getItem('currentUser')) {
        setUser(session?.user || null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const signup = async (email, password) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const loginWithUserData = async (userData) => {
    try {
      setError(null);
      const userInfo = {
        userID: userData.userID,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        fName: userData.fName,
        lName: userData.lName,
        picture_path: userData.picture_path,
        status: userData.status,
        createdAt: userData.createdAt,
        passwordExpires: userData.passwordExpires,
        address: userData.address,
        dob: userData.dob,
        loginAttempts: userData.loginAttempts,
        suspendFrom: userData.suspendFrom,
        suspendedTill: userData.suspendedTill,
      };
      sessionStorage.setItem('currentUser', JSON.stringify(userInfo));
      setUser(userInfo);
      setLoading(false);
      return userInfo;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      console.log('Current user before logout:', user);
      
      sessionStorage.removeItem('currentUser');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      
      console.log('Current user after logout:', null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    loginWithUserData,
    signup,
    logout,
    supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

