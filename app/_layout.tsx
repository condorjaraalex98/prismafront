import { Drawer } from 'expo-router/drawer';
import { AuthProvider } from '../context/userContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Drawer 
        screenOptions={{ 
          headerShown: false // Esto oculta el encabezado de todas las pantallas
        }}
      >
        <Drawer.Screen name="persona" options={{ title: 'Personas' }} />
        <Drawer.Screen name="oc" options={{ title: 'OC' }} />
        <Drawer.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Drawer.Screen name="camarav" options={{ title: 'Cámara' }} />
      </Drawer>
    </AuthProvider>
  );
}