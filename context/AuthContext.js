import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
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

  const isVerified = session?.user?.email_confirmed_at || session?.user?.confirmed_at;

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user || null,
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