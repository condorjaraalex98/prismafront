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
    timerRef.current = setTimeout(() => {
      logout();
      router.replace('/');
    }, 2700000); 
  };

  useEffect(() => {
    if (!loading && !userData) {
      router.replace('/'); 
    }
  }, [userData, loading]);

  useEffect(() => {
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

  if (loading || !userData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Verificando sesión...</Text>
      </View>
    );
  }

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
      
        drawerContent={(props) => <Sidebar {...props} isExpanded={!isMobile} />}
        screenOptions={{ headerShown: false, drawerType: isMobile ? 'front' : 'permanent', swipeEnabled: true,
          // 👈 AGREGA ESTO AQUÍ:
          drawerStyle: {
            width: isMobile ? 250 :250, // Modifica estos valores para hacerlo más angosto o ancho
            backgroundColor: '#004481',  // Mantiene tu color de fondo azul original
          },
        }}
      >
        {/* AQUÍ SÍ VAN TODAS TUS PANTALLAS PORQUE VIVEN EN TABS */}
        <Drawer.Screen name="principal" options={{ title: 'Panel Principal' }} />
        <Drawer.Screen name="cuaderno" options={{ title: 'Cuaderno de Control' }} />
        <Drawer.Screen name="tactp" options={{ title: 'Táctico Priorizado' }} />
        <Drawer.Screen name="escseg" options={{ title: 'Escuela Segura' }} />
        <Drawer.Screen name="rcecom" options={{ title: 'Escuela Segura' }} />
          <Drawer.Screen name="usuario" options={{ title: 'Usuario' }} />
           <Drawer.Screen name="crudpnp" options={{ title: 'CrudPNP' }} />
              <Drawer.Screen name="rolservicio" options={{ title: 'RolServicio' }} />
            <Drawer.Screen name="crudvia" options={{ title: 'CrudVia' }} />
 <Drawer.Screen name="operativo" options={{ title: 'operativo' }} />
                 <Drawer.Screen name="poi" options={{ title: 'Usuario' }} />
           <Drawer.Screen name="cecomsuper" options={{ title: 'Cecomsuper' }} />
            <Drawer.Screen name="estadis" options={{ title: 'CrudVia' }} />
    <Drawer.Screen name="estadist" options={{ title: 'CrudVia' }} />
             <Drawer.Screen name="crudunidades" options={{ title: 'CrudUnidades' }} />
                 <Drawer.Screen name="crudlugar" options={{ title: 'CrudLugar' }} />
         <Drawer.Screen name="cecomdoceh" options={{ title: 'Escuela Segura' }} />
           <Drawer.Screen name="rcampo" options={{ title: 'Escuela Segura' }} />
             <Drawer.Screen name="rcampomoto" options={{ title: 'Escuela Segura' }} />
        <Drawer.Screen name="integrado" options={{ title: 'Patrullaje Integrado' }} />
        <Drawer.Screen name="sinfrontera" options={{ title: 'Serenazgo sin Fronteras' }} />
        <Drawer.Screen name="general" options={{ title: 'Otras Novedades' }} />
        <Drawer.Screen name="inicioser" options={{ title: 'Inicio de Servicio' }} />
        <Drawer.Screen name="finser" options={{ title: 'Fin de Servicio' }} />
        <Drawer.Screen name="gar" options={{ title: 'GAR' }} />

          <Drawer.Screen name="sipcop" options={{ title: 'SIPCOP' }} />

            <Drawer.Screen name="sipcopd" options={{ title: 'SIPCOPD' }} />

              <Drawer.Screen name="exportar" options={{ title: 'exportar' }} />
 <Drawer.Screen name="exportarango" options={{ title: 'exportar rango' }} />



              <Drawer.Screen name="principalmovilidad" options={{ title: 'movilidad' }} />
 <Drawer.Screen name="principalDron" options={{ title: 'Dron' }} />
<Drawer.Screen name="descseg" options={{ title: 'EscDron' }} />
<Drawer.Screen name="iniciodron" options={{ title: 'iniciodron' }} />
<Drawer.Screen name="dgeneral" options={{ title: 'generaldron' }} />
<Drawer.Screen name="escmovilidad" options={{ title: 'escmovilidad'}} />
<Drawer.Screen name="generalmovilidad" options={{ title: 'generalmovilidad' }} />

<Drawer.Screen name="mapa" options={{ title: 'mapas'}} />
<Drawer.Screen name="puntos" options={{ title: 'puntos' }} />

<Drawer.Screen name="modaliniciocecom" options={{ title: 'iniciocecom'}} />
<Drawer.Screen name="cecom" options={{ title: 'cecom' }} />
<Drawer.Screen name="cecomop" options={{ title: 'cecomop' }} />
<Drawer.Screen name="modalfincecom" options={{ title: 'modalfincecom' }} />




        <Drawer.Screen name="paramedico" options={{ title: 'Paramédico' }} />
        <Drawer.Screen name="ambulancia" options={{ title: 'Conductor Ambulancia' }} />
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