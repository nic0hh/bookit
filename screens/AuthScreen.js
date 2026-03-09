import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { ThemeContext } from '../ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

function isPasswordValid(pw) {
  return /[a-zA-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw) && pw.length >= 8;
}

export default function AuthScreen() {
  const { signIn, signUp } = useContext(AuthContext);
  const { colors } = useContext(ThemeContext);

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset' | 'newpassword'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

// ── Detect password reset token in URL (web only) ────────────────────────
const { isRecovery } = useContext(AuthContext);

useEffect(() => {
  if (Platform.OS !== 'web') return;
  if (!isRecovery) return;

  const accessToken = sessionStorage.getItem('recovery_access_token');
  const refreshToken = sessionStorage.getItem('recovery_refresh_token');

  if (accessToken && refreshToken) {
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (!error) {
          sessionStorage.removeItem('recovery_access_token');
          sessionStorage.removeItem('recovery_refresh_token');
          setMode('newpassword');
        }
      });
  }
}, [isRecovery]);

  // ── Set new password after reset ─────────────────────────────────────────
  const handleNewPassword = async () => {
    setErr('');
    if (!isPasswordValid(newPw)) {
      setErr('Password must be at least 8 characters, with letters and symbols.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      setErr(error.message);
    } else {
      setInfo('Password updated successfully! You can now sign in.');
      setMode('signin');
      setNewPw('');
    }
    setLoading(false);
  };

  // ── Standard sign in / sign up / reset ───────────────────────────────────
  const submit = async () => {
    setErr('');
    setInfo('');
    setLoading(true);

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://bookit-5000.netlify.app',
      });
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
      const { data, error: sessionError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pw,
      });
      if (!sessionError && data?.session) {
        await supabase.auth.setSession(data.session);
      }
    }
    setLoading(false);
  };

  const inputStyle = {
    backgroundColor: colors.inputBackground,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    color: colors.text,
    marginBottom: 12,
  };

  // ── New password screen ───────────────────────────────────────────────────
  if (mode === 'newpassword') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 24, marginBottom: 8, fontFamily: 'Quicksand_700Bold' }}>
          Set New Password
        </Text>
        <Text style={{ color: colors.label, fontSize: 14, marginBottom: 20, fontFamily: 'Quicksand_400Regular' }}>
          Choose a strong password for your account.
        </Text>
        <TextInput
          style={inputStyle}
          secureTextEntry
          placeholder="New password"
          placeholderTextColor={colors.label}
          value={newPw}
          onChangeText={setNewPw}
        />
        <Text style={{ color: colors.label, fontSize: 13, marginBottom: 12, fontFamily: 'Quicksand_400Regular' }}>
          Password should contain upper and lowercase letters and symbols.
        </Text>
        {err ? <Text style={{ color: '#d72660', marginBottom: 10, fontFamily: 'Quicksand_500Medium' }}>{err}</Text> : null}
        {info ? <Text style={{ color: '#34c759', marginBottom: 10, fontFamily: 'Quicksand_500Medium' }}>{info}</Text> : null}
        <TouchableOpacity
          onPress={handleNewPassword}
          disabled={loading || !isPasswordValid(newPw)}
          style={{
            backgroundColor: colors.actionButton,
            borderRadius: 15,
            paddingVertical: 12,
            alignItems: 'center',
            borderWidth: 0.7,
            borderColor: colors.actionButtonText,
            opacity: loading || !isPasswordValid(newPw) ? 0.5 : 1,
          }}
        >
          {loading
            ? <ActivityIndicator color={colors.actionButtonText} />
            : <Text style={{ color: colors.actionButtonText, fontFamily: 'Quicksand_600SemiBold' }}>Update Password</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main auth screen ──────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 24, marginBottom: 12, fontFamily: 'Quicksand_700Bold' }}>
        {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
      </Text>

      <TextInput
        style={inputStyle}
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
            style={inputStyle}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={colors.label}
            value={pw}
            onChangeText={setPw}
          />
          {mode === 'signup' && (
            <Text style={{ color: colors.label, fontSize: 13, marginBottom: 8, fontFamily: 'Quicksand_400Regular' }}>
              Password should contain upper and lowercase letters and symbols.
            </Text>
          )}
        </>
      )}

      {err ? <Text style={{ color: '#d72660', marginBottom: 10, fontFamily: 'Quicksand_500Medium' }}>{err}</Text> : null}
      {info ? <Text style={{ color: '#34c759', marginBottom: 10, fontFamily: 'Quicksand_500Medium', fontSize: 14 }}>{info}</Text> : null}

      <TouchableOpacity
        onPress={submit}
        disabled={loading || (mode === 'signup' && !isPasswordValid(pw))}
        style={{
          backgroundColor: colors.actionButton,
          borderRadius: 15,
          paddingVertical: 12,
          alignItems: 'center',
          borderWidth: 0.7,
          borderColor: colors.actionButtonText,
          marginBottom: 8,
          opacity: loading || (mode === 'signup' && !isPasswordValid(pw)) ? 0.5 : 1,
        }}
      >
        {loading
          ? <ActivityIndicator color={colors.actionButtonText} />
          : <Text style={{ color: colors.actionButtonText, fontFamily: 'Quicksand_600SemiBold' }}>
              {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Email'}
            </Text>}
      </TouchableOpacity>

      {mode === 'signup' && pw && !isPasswordValid(pw) && (
        <Text style={{ color: '#d72660', fontSize: 13, marginTop: 6, fontFamily: 'Quicksand_400Regular' }}>
          Password must be at least 8 characters, with letters and symbols.
        </Text>
      )}

      {mode === 'signin' && (
        <TouchableOpacity onPress={() => { setMode('reset'); setErr(''); setInfo(''); }} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.label, textAlign: 'center', fontFamily: 'Quicksand_400Regular' }}>Forgot password?</Text>
        </TouchableOpacity>
      )}

      {mode === 'reset' && (
        <TouchableOpacity onPress={() => { setMode('signin'); setErr(''); setInfo(''); }} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.label, textAlign: 'center', fontFamily: 'Quicksand_400Regular' }}>Back to Sign In</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(''); setInfo(''); }}
        style={{ marginTop: 18 }}
      >
        <Text style={{ color: colors.label, fontFamily: 'Quicksand_400Regular' }}>
          {mode === 'signin' ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}