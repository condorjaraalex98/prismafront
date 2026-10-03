import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Sidebar } from '../../components/Sidebar';
import { useAuth } from '../../context/userContext';

export default function TabLayout() {
  const { userData, logout, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // --- LÓGICA DE INACTIVIDAD (45 MINUTOS / 2,700,000 ms) ---
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = () => {
    if (Platform.OS !== 'web') {
      Alert.alert("Cerrar Sesión", "¿Estás seguro que deseas salir?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Salir", onPress: () => { logout(); router.replace('/'); } }
      ]);
    } else {
      logout();
      router.replace('/');
    }
  };

  const resetInactivityTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Si pasan 45 minutos sin actividad, cierra sesión automáticamente
    timerRef.current = setTimeout(() => {
      logout();
      router.replace('/');
    }, 2700000); 
  };

  // --- LÓGICA DE PROTECCIÓN Y EVENTOS ---
  useEffect(() => {
    if (!loading && !userData) {
      router.replace('/'); 
    }
  }, [userData, loading]);

  useEffect(() => {
    // Iniciamos el temporizador y escuchamos eventos de interacción si estamos en Web
    resetInactivityTimer();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleActivity = () => resetInactivityTimer();
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('click', handleActivity);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('click', handleActivity);
      };
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // --- PANTALLA DE CARGA ---
  if (loading || !userData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Verificando sesión...</Text>
      </View>
    );
  }

  // HEADER PARA MÓVIL: MJM Style
  const MobileHeader = ({ navigation }: any) => (
    <SafeAreaView style={styles.safeHeader}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            onPress={() => navigation.openDrawer()} 
            style={styles.menuIconButton}
          >
            <Ionicons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.smallAvatar}>
            <Text style={styles.avatarText}>
              {userData?.nombres ? userData.nombres[0].toUpperCase() : 'U'}
            </Text>
          </View>
          <View>
            <Text style={styles.headerWelcome}>BIENVENIDO,</Text>
            <Text style={styles.headerName} numberOfLines={1}>
              {userData?.nombres} {userData?.apellido_paterno}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.municipalityText}>MJM</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={22} color="#f87171" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onTouchStart={resetInactivityTimer}>
     <Drawer
  initialRouteName="principal"
  drawerContent={(props) => (
    <Sidebar 
      {...props} 
      isExpanded={!isMobile} 
    />
  )}
  screenOptions={({ navigation }) => ({
    headerShown: false,
    header: () => <MobileHeader navigation={navigation} />,
    // Mantiene 'front' en móvil y 'permanent' en Web (escritorio)
    drawerType: isMobile ? 'front' : 'permanent', 
    drawerStyle: {
      width: isMobile ? 300 : 260,
      backgroundColor: '#004481',
    },
    // DESACTIVA el gesto de arrastre en Android/Móvil
    swipeEnabled: false, 
  })}
>
  <Drawer.Screen name="principal" />
</Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#004481',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  safeHeader: {
    backgroundColor: '#004481',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconButton: { marginRight: 15 },
  smallAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  headerWelcome: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700' },
  headerName: { color: '#fff', fontSize: 13, fontWeight: 'bold', maxWidth: 150 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  municipalityText: { color: '#38bdf8', fontSize: 11, fontWeight: '900', marginRight: 12 },
  logoutButton: {
    padding: 6,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 8,
  },
});