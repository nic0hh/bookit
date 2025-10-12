import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let sub;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data?.session?.user ?? null;
        if (sessionUser) setUser(sessionUser);
      } catch (e) {
        console.log('AuthContext rehydrate error', e);
      }

      // subscribe to changes so AuthContext and supabase client stay in sync
      try {
        const resp = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
          setInitializing(false); // ensure we stop initializing when auth state arrives
        });
        sub = resp?.data?.subscription;
      } catch (e) {
        console.log('AuthContext subscribe error', e);
        setInitializing(false);
      }

      // If no event fires, make sure we stop initializing
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
      signIn,
      signUp,
      signOut,
      isVerified,
    }}>
      {children}
    </AuthContext.Provider>
  );
}