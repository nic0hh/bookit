import React, { createContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://zzhwzeartfukqlytbmqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6aHd6ZWFydGZ1a3FseXRibXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1ODgzNjIsImV4cCI6MjA3MzE2NDM2Mn0.vbnnK1uDi4qU81z6umtE25hhuCUEVD1q4kMBOvIEyH4',
  {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
);

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      setUser(data?.session?.user || null);
      setInitializing(false);
    };
    getSession();

    // Optionally, listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      listener?.subscription?.unsubscribe();
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