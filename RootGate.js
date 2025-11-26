import React, { useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import RootStack from './navigation/RootStack';
import { AuthContext } from './context/AuthContext';
import { ThemeContext } from './ThemeContext';

export default function RootGate() {
  const { initializing } = useContext(AuthContext);
  const { colors } = useContext(ThemeContext);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors?.background || '#fff' }}>
        <ActivityIndicator size="large" color={colors?.actionButtonText || '#000'} />
      </View>
    );
  }

  return <RootStack />;
}