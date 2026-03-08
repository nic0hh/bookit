import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    let sub;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user ?? null;
        if (sessionUser) setUser(sessionUser);
      } catch (e) {}

      try {
        const resp = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            setIsRecovery(true);
            setUser(session?.user ?? null);
          } else {
            setIsRecovery(false);
            setUser(session?.user ?? null);
          }
          setInitializing(false);
        });
        sub = resp?.data?.subscription;
      } catch (e) {
        setInitializing(false);
      }

      setInitializing(false);
    })();

    return () => {
      if (sub?.unsubscribe) sub.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.session?.user) {
      setUser(data.session.user);
    }
    return { data, error };
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const isVerified = user?.email_confirmed_at || user?.confirmed_at;

  return (
    <AuthContext.Provider value={{
      user,
      initializing,
      isRecovery,
      signIn,
      signUp,
      signOut,
      isVerified,
    }}>
      {children}
    </AuthContext.Provider>
  );
}