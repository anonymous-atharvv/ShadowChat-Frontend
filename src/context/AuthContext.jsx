import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { generateE2EKeyPair, exportPublicKey, storePrivateKey, getPrivateKey, computeFingerprint } from '../utils/e2ee';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef(null);

  // Helper to schedule token refresh
  const scheduleRefresh = (delayMs = 13 * 60 * 1000) => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
          setUser(data.user);
          scheduleRefresh();
          // Ensure E2EE keys are present and published
          bootstrapE2E(data.user, data.token);
        } else {
          // Token refresh failed, log out
          logout();
        }
      } catch (err) {
        console.error('Silent refresh failed:', err);
        // Retry in 30 seconds if network error
        scheduleRefresh(30 * 1000);
      }
    }, delayMs);
  };

  // E2E Keys bootstrap
  const bootstrapE2E = async (currentUser, authToken) => {
    if (!currentUser || !authToken) return;
    try {
      let privateKey = await getPrivateKey(currentUser.id);
      if (!privateKey || !currentUser.publicKey) {
        console.log('Generating E2EE keys...');
        const keyPair = await generateE2EKeyPair();
        await storePrivateKey(currentUser.id, keyPair.privateKey);
        const pubKeyJwk = await exportPublicKey(keyPair.publicKey);
        const fingerprint = await computeFingerprint(pubKeyJwk);

        // Publish to server
        const res = await fetch('/api/keys/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ publicKey: pubKeyJwk, fingerprint })
        });

        if (res.ok) {
          console.log('E2EE keys registered successfully.');
          setUser(prev => prev && prev.id === currentUser.id ? { ...prev, publicKey: pubKeyJwk, keyFingerprint: fingerprint } : prev);
        } else {
          console.error('Failed to publish E2EE public key.');
        }
      } else {
        console.log('E2EE keys verified.');
      }
    } catch (err) {
      console.error('Error bootstrapping E2E keys:', err);
    }
  };

  useEffect(() => {
    // Initial silent refresh
    const initAuth = async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
          setUser(data.user);
          scheduleRefresh();
          await bootstrapE2E(data.user, data.token);
        }
      } catch (err) {
        console.error('Initial silent refresh error:', err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setToken(data.token);
    setUser(data.user);
    scheduleRefresh();
    await bootstrapE2E(data.user, data.token);
    return data;
  };

  const signup = async (username, password) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setToken(data.token);
    setUser(data.user);
    scheduleRefresh();
    await bootstrapE2E(data.user, data.token);
    return data;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    }
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    setToken(null);
    setUser(null);
  };

  const updateUser = (updates) => setUser(prev => ({ ...prev, ...updates }));

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
