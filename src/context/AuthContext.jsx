import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { login as apiLogin, signup as apiSignup, getMe, setAuthToken, clearAuthToken, getStoredToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken());
  const [initializing, setInitializing] = useState(true);

  // On load, if a token is already stored (previous session), verify it's
  // still valid by fetching the current user rather than trusting it blindly
  // -- an expired/revoked token should drop the user back to /login, not
  // silently 401 on every subsequent request.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = getStoredToken();
      if (!existing) {
        setInitializing(false);
        return;
      }
      setAuthToken(existing);
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
          setToken(existing);
        }
      } catch {
        clearAuthToken();
        if (!cancelled) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: u, token: t } = await apiLogin(email, password);
    setAuthToken(t);
    setUser(u);
    setToken(t);
    return u;
  }, []);

  const signup = useCallback(async (email, password, displayName) => {
    const { user: u, token: t } = await apiSignup(email, password, displayName);
    setAuthToken(t);
    setUser(u);
    setToken(t);
    return u;
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setToken(null);
  }, []);

  // Called by the axios response interceptor when any request comes back
  // 401 -- the token is no longer valid (expired, or the user was deleted),
  // so drop the session everywhere at once rather than per-component.
  const forceLogout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    setToken(null);
  }, []);

  useEffect(() => {
    window.__omnistreamForceLogout = forceLogout;
    return () => {
      delete window.__omnistreamForceLogout;
    };
  }, [forceLogout]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, initializing, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
