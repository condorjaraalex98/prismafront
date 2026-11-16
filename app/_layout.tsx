// app/_layout.tsx
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthProvider } from '../context/userContext';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Ocurrió un problema inesperado</Text>
      <Text style={styles.errorMessage} numberOfLines={3}>
        {error?.message || 'Error interno de la aplicación.'}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={retry}>
        <Text style={styles.retryText}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#024885',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#024885',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});