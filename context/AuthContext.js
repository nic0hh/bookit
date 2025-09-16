import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Get current session on mount
    const session = supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user || null);
      setInitializing(false);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const isVerified = user?.email_confirmed_at || user?.confirmed_at;

  return (
    <AuthContext.Provider value={{
      user,
      initializing,
      signIn,
      signUp,
      signOut,
      isVerified,
    }}>
      {children}
    </AuthContext.Provider>
  );
}