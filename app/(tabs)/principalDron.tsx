import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MODULOS = [
  {
    id: "3",
    nombre: "ESCUELA SEGURA",
    ruta: "/descseg",
    icono: "school",
    color: "#ffc107",
    bg: "#fffdf0",
  },

  {
    id: "6",
    nombre: "OTRAS NOVEDADES",
    ruta: "/dgeneral",
    icono: "alert-circle",
    color: "#cf2929",
    bg: "#fff9f2",
  },

   {
    id: "7",
    nombre: "INICIO DE SERVICIO",
    ruta: "/iniciodron",
   icono: "play-circle",
   color: "#0056b3",
    bg: "#fff9f2",
  }
  
];

export default function PrincipalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.main, { paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.sectionTitle}>
          SELECCIONE UNA ACTIVIDAD
        </ThemedText>

        <View style={styles.grid}>
          {MODULOS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { borderColor: item.color }]}
              activeOpacity={0.8}
              onPress={() => router.push(item.ruta as any)}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                <Ionicons
                  name={item.icono as any}
                  size={32}
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
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { padding: 15 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748b",
    marginBottom: 25,
    textAlign: "center",
    letterSpacing: 1.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "white",
    width: "48%",
    padding: 15,
    borderRadius: 24,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderLeftWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    height: 150,
  },
  iconCircle: {
    padding: 14,
    borderRadius: 50,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 14,
    textTransform: "uppercase",
  },
  indicator: {
    width: 24,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
  },
});
