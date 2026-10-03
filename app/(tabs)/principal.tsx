import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 1. Actividades Operativas / Recurrentes Principales (Colores originales)
const ACTIVIDADES_OPERATIVAS = [
  {
    id: "1",
    nombre: "CUADERNO DE CONTROL",
    ruta: "/cuaderno",
    icono: "book",
    color: "#dc3545",
    bg: "#fff5f5",
  },
  {
    id: "2",
    nombre: "TÁCTICO PRIORIZADO",
    ruta: "/tactp",
    icono: "shield-checkmark",
    color: "#0056b3",
    bg: "#f0f7ff",
  },
  {
    id: "3",
    nombre: "ESCUELA SEGURA",
    ruta: "/escseg",
    icono: "school",
    color: "#ffc107",
    bg: "#fffdf0",
  },
  {
    id: "4",
    nombre: "PATRULLAJE INTEGRADO (Solo Inicio)",
    ruta: "/integrado",
    icono: "shield",
    color: "#28a745",
    bg: "#f6fff8",
  },
  {
    id: "5",
    nombre: "SERENAZGO SIN FRONTERAS",
    ruta: "/sinfrontera",
    icono: "map",
    color: "#6f42c1",
    bg: "#f8f4ff",
  },
];

// 2. Otras Novedades (Color original naranja, separado por no ser recurrente)
const OTRAS_ACTIVIDADES = [
  {
    id: "6",
    nombre: "OTRAS NOVEDADES",
    ruta: "/general",
    icono: "document-text",
    color: "#0056b3",
    bg: "#fff9f2",
  },
];

const INICIO = [
  {
    id: '1',
    nombre: 'Inicio de servicio',
   
    color: '#0056b3',
    bg: '#e6f0fa',
    ruta: '/inicioser',
    icono: 'play-outline',
  },
  {
    id: '2',
    nombre: 'Fin de Servicio',
    
   color: "#0056b3",
    bg: '#fdf2f2',
    ruta: '/finser',
    icono: 'stop-outline',
  },
];

// 3. Unidades de Apoyo y Emergencia (Colores originales de GAR y Paramédico)
const UNIDADES_APOYO = [
  {
    id: "7",
    nombre: "GAR",
    ruta: "/gar",
    icono: "people",
    color: "#0056b3",
    bg: "#fff5f9",
  },
  {
    id: "8",
    nombre: "PARAMÉDICO",
    ruta: "/paramedico",
 
        icono: "bandage",
    color: "#0056b3",
    bg: "#f2fcf9",
  },

  {
    id: "9",
    nombre: "CONDUCTOR AMBULANCIA",
    ruta: "/ambulancia",
    icono: "medkit",
    color: "#0056b3",
    bg: "#f2fcf9",
  },
];

export default function PrincipalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleOpenDrawer = () => {
    navigation.dispatch({ type: "OPEN_DRAWER" });
  };

  return (
    <ThemedView style={[styles.main, { paddingTop: insets.top + 15 }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ENCABEZADO / TÍTULO PRINCIPAL CON ACCIÓN DE ABRIR DRAWER */}
        <TouchableOpacity
          style={styles.headerContainer}
          onPress={handleOpenDrawer}
          activeOpacity={0.7}
        >
          <View style={styles.titleRow}>
          
            <ThemedText style={styles.mainTitle}>PANEL DE CONTROL</ThemedText>
          </View>
          <ThemedText style={styles.sectionSubtitle}>
            SELECCIONE UNA ACTIVIDAD
          </ThemedText>
        </TouchableOpacity>

        {/* SECCIÓN 3: REPORTES Y NOVEDADES GENERALES (No recurrentes) */}
        <View style={styles.categoryContainer}>
          <View style={styles.categoryHeader}>
            <Ionicons name="document-text-outline" size={14} color="#0056b3" />
            <ThemedText style={styles.categoryTitle}>
              NOVEDADES GENERALES
            </ThemedText>
          </View>

          <View style={styles.grid}>
            {OTRAS_ACTIVIDADES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.cardFull, { borderColor: item.color }]}
                activeOpacity={0.8}
                onPress={() => router.push(item.ruta as any)}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                  <Ionicons
                    name={item.icono as any}
                    size={26}
                    color={item.color}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText
                    style={[styles.cardTitleLeft, { color: item.color }]}
                  >
                    {item.nombre}
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    Registro libre de ocurrencias
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={item.color} />
              </TouchableOpacity>
            ))}
          </View>

         <View style={styles.grid}>
  {INICIO.map((item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.cardFull, { borderColor: item.color }]}
      activeOpacity={0.8}
      onPress={() => router.push(item.ruta as any)}
    >
      <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
        <Ionicons
          name={item.icono as any}
          size={26}
          color={item.color}
        />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <ThemedText
          style={[styles.cardTitleLeft, { color: item.color }]}
        >
          {item.nombre}
        </ThemedText>
        
        <ThemedText style={styles.cardSubtitle}>
          {item.id === 'fin_de_servicio' || item.nombre.includes('Fin') 
            ? '30 minutos de tolerancia, solo motorizados'
            : '30 minutos de tolerancia'}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={item.color} />
    </TouchableOpacity>
  ))}
</View>
        </View>

        {/* SECCIÓN 1: ACTIVIDADES OPERATIVAS RECURRENTES */}
        <View style={styles.categoryContainer}>
          <View style={styles.categoryHeader}>
            <Ionicons name="grid-outline" size={14} color="#0056b3" />
            <ThemedText style={styles.categoryTitle}>
              ACTIVIDADES RECURRENTES
            </ThemedText>
          </View>

          <View style={styles.grid}>
            {ACTIVIDADES_OPERATIVAS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, { borderColor: item.color }]}
                activeOpacity={0.8}
                onPress={() => router.push(item.ruta as any)}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                  <Ionicons
                    name={item.icono as any}
                    size={26}
                    color={item.color}
                  />
                </View>
                <ThemedText style={[styles.cardTitle, { color: item.color }]}>
                  {item.nombre}
                </ThemedText>
                <View
                  style={[styles.indicator, { backgroundColor: item.color }]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SECCIÓN 2: UNIDADES DE APOYO Y EMERGENCIA */}
        <View style={styles.categoryContainer}>
          <View style={styles.categoryHeader}>
            <Ionicons name="shield-half-outline" size={14} color="#0056b3" />
            <ThemedText style={styles.categoryTitle}>OTRAS UNIDADES</ThemedText>
          </View>

          <View style={styles.grid}>
            {UNIDADES_APOYO.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, { borderColor: item.color }]}
                activeOpacity={0.8}
                onPress={() => router.push(item.ruta as any)}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                  <Ionicons
                    name={item.icono as any}
                    size={26}
                    color={item.color}
                  />
                </View>
                <ThemedText style={[styles.cardTitle, { color: item.color }]}>
                  {item.nombre}
                </ThemedText>
                <View
                  style={[styles.indicator, { backgroundColor: item.color }]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { paddingHorizontal: 15, paddingBottom: 30 },
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  mainTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0056b3",
    letterSpacing: 1.2,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 1.5,
  },
  categoryContainer: {
    marginBottom: 15,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  categoryTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0056b3",
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',       // <-- Coloca los elementos uno al lado del otro
    flexWrap: 'wrap',           // <-- Permite que bajen si no entran
    justifyContent: 'space-between', // <-- Separa las tarjetas de forma equitativa
    gap: 10,                    // <-- Espacio entre las tarjetas (en versiones recientes de React Native)
  },
  card: {
    backgroundColor: "white",
    width: "48%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    borderLeftWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    height: 125,
  },
  cardFull: {
    backgroundColor: "white",
    width: "48%",
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    borderLeftWidth: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    padding: 10,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 14,
    textTransform: "uppercase",
    marginTop: 6,
  },
  cardTitleLeft: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 9,
    color: "#64748b",
  },
  indicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginTop: 6,
  },
});