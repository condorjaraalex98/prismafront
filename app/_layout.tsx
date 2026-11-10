// app/_layout.tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/userContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* El login (index) fuera del Drawer */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        
        {/* El grupo (tabs) que contiene toda la lógica de tu menú lateral y pantallas */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}