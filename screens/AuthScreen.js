import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemeContext } from '../ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

function isPasswordValid(pw) {
  return /[a-zA-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw) && pw.length >= 8;
}

export default function AuthScreen() {
  const { signIn, signUp } = useContext(AuthContext);
  const { colors } = useContext(ThemeContext);

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset' | 'otp'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [otp, setOtp] = useState('');
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  // ── Verify OTP and update password in one step ────────────────────────────
  const handleVerifyOtp = async () => {
    setErr('');
    if (!otp || otp.length < 6) {
      setErr('Please enter the 6-digit code from your email.');
      return;
    }
    if (!isPasswordValid(newPw)) {
      setErr('Password must be at least 8 characters, with letters and symbols.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: 'email',
    });
    if (error) {
      setErr('Invalid or expired code. Please try again.');
      setLoading(false);
      return;
    }
    if (data.session) {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) {
        setErr(updateError.message);
      } else {
        await supabase.auth.signOut();
        setMode('signin');
        setInfo('Password updated! You can now sign in.');
        setOtp('');
        setNewPw('');
        setEmail('');
      }
    }
    setLoading(false);
  };

  // ── Standard sign in / sign up / reset ───────────────────────────────────
  const submit = async () => {
    setErr('');
    setInfo('');
    setLoading(true);

    if (mode === 'reset') {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) {
        setErr(error.message);
      } else {
        setInfo('Check your email for a 6-digit code.');
        setMode('otp');
      }
      setLoading(false);
      return;
    }

    if (mode === 'signup' && !isPasswordValid(pw)) {
      setErr('Password must be at least 8 characters, with letters and symbols.');
      setLoading(false);
      return;
    }

    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email.trim(), pw);

    if (error) {
      setErr(error.message);
    } else if (mode === 'signup') {
      setInfo('Successful! Please check for an email from Supabase to activate your account.');
      setEmail('');
      setPw('');
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

  // ── OTP + new password screen ─────────────────────────────────────────────
  if (mode === 'otp') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 24, marginBottom: 8, fontFamily: 'Quicksand_700Bold' }}>
          Reset Password
        </Text>
        <Text style={{ color: colors.label, fontSize: 14, marginBottom: 20, fontFamily: 'Quicksand_400Regular' }}>
          Enter the 6-digit code sent to {email} and choose a new password.
        </Text>
        <TextInput
          style={inputStyle}
          placeholder="6-digit code"
          placeholderTextColor={colors.label}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TextInput
          style={inputStyle}
          secureTextEntry
          placeholder="New password"
          placeholderTextColor={colors.label}
          value={newPw}
          onChangeText={setNewPw}
        />
        <Text style={{ color: colors.label, fontSize: 13, marginBottom: 12, fontFamily: 'Quicksand_400Regular' }}>
          Password must be at least 8 characters, with letters and symbols.
        </Text>
        {err ? <Text style={{ color: '#d72660', marginBottom: 10, fontFamily: 'Quicksand_500Medium' }}>{err}</Text> : null}
        {info ? <Text style={{ color: '#34c759', marginBottom: 10, fontFamily: 'Quicksand_500Medium' }}>{info}</Text> : null}
        <TouchableOpacity
          onPress={handleVerifyOtp}
          disabled={loading}
          style={{
            backgroundColor: colors.actionButton,
            borderRadius: 15,
            paddingVertical: 12,
            alignItems: 'center',
            borderWidth: 0.7,
            borderColor: colors.actionButtonText,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading
            ? <ActivityIndicator color={colors.actionButtonText} />
            : <Text style={{ color: colors.actionButtonText, fontFamily: 'Quicksand_600SemiBold' }}>Update Password</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setMode('reset'); setErr(''); setInfo(''); setOtp(''); setNewPw(''); }} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.label, textAlign: 'center', fontFamily: 'Quicksand_400Regular' }}>Resend code</Text>
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
              {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Code'}
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