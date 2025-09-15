import React, { useContext, useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../ThemeContext';
import { supabase } from '../supabaseClient';

function isPasswordValid(pw) {
  // At least one letter and one symbol, min 8 chars
  return /[a-zA-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw) && pw.length >= 8;
}

export default function AuthScreen() {
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
      Alert.alert(
        'Account Created',
        'Account created! Check your email to verify your account.'
      );
    }
    setLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
      </Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
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
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.inputBorder }]}
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
      {info ? <Text style={{ color: colors.label, marginBottom: 10 }}>{info}</Text> : null}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.button }]}
        onPress={submit}
        disabled={
          loading ||
          (mode === 'signup' && !isPasswordValid(pw))
        }
      >
        {loading
          ? <ActivityIndicator color={colors.buttonText} />
          : <Text style={[styles.buttonText, { color: colors.buttonText }]}>
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

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 24, fontFamily: 'Quicksand' },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14, fontFamily: 'Quicksand' },
  button: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: 'bold', fontFamily: 'Quicksand' },
});