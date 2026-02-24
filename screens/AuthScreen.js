import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { ThemeContext } from '../ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

function isPasswordValid(pw) {
  // At least one letter and one symbol, min 8 chars
  return /[a-zA-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw) && pw.length >= 8;
}

export default function AuthScreen(props) {
  const { signIn, signUp } = useContext(AuthContext);
  const { colors } = useContext(ThemeContext);
  const [mode, setMode] = useState('signin'); // 'signin', 'signup', 'reset'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async () => {
    setErr('');
    setInfo('');
    setLoading(true);
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) setErr(error.message);
      else setInfo('Password reset email sent. Check your inbox.');
      setLoading(false);
      return;
    }
    if (mode === 'signup' && !isPasswordValid(pw)) {
      setErr('Password must be at least 8 characters, with letters and symbols.');
      setLoading(false);
      return;
    }
    const fn = mode === 'signin' ? signIn : signUp;
    const error = await fn(email.trim(), pw);
    if (error) {
      setErr(error.message);
    } else if (mode === 'signup') {
      setInfo('Successful! Please check for an email from Supabase to activate your account.');
      setEmail('');
      setPw('');
    } else {
      // Ensure the client has the session (v2 API)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (!error && data?.session) {
        await supabase.auth.setSession(data.session);
        // Update your AuthContext user as usual
      }
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 24, marginBottom: 12 }}>
        {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
      </Text>

      <TextInput
        style={{
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
          borderWidth: 1,
          borderRadius: 15,
          padding: 12,
          color: colors.text,
          marginBottom: 12,
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.label}
        value={email}
        onChangeText={setEmail}
      />
      {mode !== 'reset' && (
        <>
          <TextInput
            style={{
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
              borderWidth: 1,
              borderRadius: 15,
              padding: 12,
              color: colors.text,
              marginBottom: 12,
            }}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={colors.label}
            value={pw}
            onChangeText={setPw}
          />
          {mode === 'signup' && (
            <Text style={{ color: colors.label, fontSize: 13, marginBottom: 8 }}>
              Password should contain upper and lowercase letters and symbols.
            </Text>
          )}
        </>
      )}
      {err ? <Text style={{ color: '#d72660', marginBottom: 10 }}>{err}</Text> : null}
      {info ? (
  <Text style={{ color: '#34c759', marginBottom: 10, fontFamily: 'Quicksand_500Medium', fontSize: 14 }}>
    {info}
  </Text>
) : null}
      <TouchableOpacity
        onPress={submit}
        style={{
          backgroundColor: colors.actionButton,
          borderRadius: 15,
          paddingVertical: 12,
          alignItems: 'center',
          borderWidth: 0.7,
          borderColor: colors.actionButtonText,
          marginBottom: 8,
        }}
        disabled={
          loading ||
          (mode === 'signup' && !isPasswordValid(pw))
        }
      >
        {loading
          ? <ActivityIndicator color={colors.buttonText} />
          : <Text style={{ color: colors.actionButtonText, fontWeight: 'bold' }}>
              {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Email'}
            </Text>}
      </TouchableOpacity>
      {mode === 'signup' && pw && !isPasswordValid(pw) && (
        <Text style={{ color: '#d72660', fontSize: 13, marginTop: 6 }}>
          Password must be at least 8 characters, with letters and symbols.
        </Text>
      )}
      {mode === 'signin' && (
        <TouchableOpacity onPress={() => setMode('reset')} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.label, textAlign: 'center' }}>Forgot password?</Text>
        </TouchableOpacity>
      )}
      {mode === 'reset' && (
        <TouchableOpacity onPress={() => setMode('signin')} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.label, textAlign: 'center' }}>Back to Sign In</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{ marginTop: 18 }}>
        <Text style={{ color: colors.label }}>
          {mode === 'signin' ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

async function handleSignIn(email, password) {
  // v2 API
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    Alert.alert('Sign in failed', error.message);
    return;
  }
  // Ensure the supabase client has the session persisted (RN AsyncStorage)
  if (data?.session) {
    await supabase.auth.setSession(data.session);
  }
  // update your AuthContext/user state as you already do
}