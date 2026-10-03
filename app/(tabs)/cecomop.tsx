import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
const MJM_BLUE = "#024885";

interface VehiculoMatriz {
  id_unidad: number;
  placa: string;
  id_detalle: number | null;
  ultima_fecha: string | null;
  ultima_hora: string | null;
  ultimo_km_marcado: number;
  odometro_inicial: number | null;
  odometro_final: number | null;
  estado_cierre: string | null;
  turno: string | null;
  personal_responsable: string | null;
  tipo_ultimo_marcado: string;
}

export default function DashboardMatrizVehicularScreen() {
  const [vehiculos, setVehiculos] = useState<VehiculoMatriz[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "INICIO" | "FIN">("TODOS");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cargar la matriz optimizada desde el backend
  const fetchMatrizVehicular = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vehiculo/ultimo-estado-placas`);
      if (!response.ok) throw new Error("Error al obtener la matriz de vehículos");
      const data = await response.json();
      if (data.success) {
        setVehiculos(data.data || []);
      }
    } catch (error) {
      console.error("Error cargando matriz:", error);
      setErrorMessage("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrizVehicular();
  }, [fetchMatrizVehicular]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatrizVehicular();
  };

  // Filtrado por texto (placa o responsable) y tipo de marcación
  const vehiculosFiltrados = vehiculos.filter((item) => {
    const texto = busqueda.toLowerCase();
    const coincideTexto =
      item.placa?.toLowerCase().includes(texto) ||
      item.personal_responsable?.toLowerCase().includes(texto);

    if (filtroEstado === "INICIO") return coincideTexto && item.tipo_ultimo_marcado?.includes("INICIO");
    if (filtroEstado === "FIN") return coincideTexto && item.tipo_ultimo_marcado?.includes("FIN");
    return coincideTexto;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ThemedView style={styles.main}>
        
        {/* CABECERA */}
        <View style={styles.headerContainer}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.mainTitle}>MATRIZ VEHICULAR</ThemedText>
            <ThemedText style={styles.subTitle}>Control de flota, turnos y último kilómetro</ThemedText>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.8}>
            <Ionicons name="refresh" size={15} color="white" />
            <ThemedText style={styles.refreshButtonText}>Actualizar</ThemedText>
          </TouchableOpacity>
        </View>

        {/* BUSCADOR */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por placa o personal..."
            placeholderTextColor="#94a3b8"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda("")}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* FILTROS RÁPIDOS */}
        <View style={styles.filterRow}>
          {(["TODOS", "INICIO", "FIN"] as const).map((est) => (
            <TouchableOpacity
              key={est}
              style={[styles.filterButton, filtroEstado === est && styles.filterButtonActive]}
              onPress={() => setFiltroEstado(est)}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.filterText, filtroEstado === est && styles.filterTextActive]}>
                {est === "TODOS" ? "Todos" : est === "INICIO" ? "En Calle (Inicio)" : "Cerrados (Fin)"}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {errorMessage && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </View>
        )}

        {/* LISTA / MATRIZ DE VEHÍCULOS */}
        {loading ? (
          <ActivityIndicator size="large" color={MJM_BLUE} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={vehiculosFiltrados}
            keyExtractor={(item) => String(item.id_unidad)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MJM_BLUE} />}
            ListEmptyComponent={<ThemedText style={styles.emptyText}>No se encontraron unidades registradas.</ThemedText>}
            renderItem={({ item }) => {
              const esInicio = item.tipo_ultimo_marcado?.includes("INICIO");
              return (
                <View style={styles.cardVehiculo}>
                  
                  {/* Encabezado de Tarjeta */}
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[styles.statusDot, { backgroundColor: esInicio ? "#16a34a" : "#024885" }]} />
                      <ThemedText style={styles.placaText}>{item.placa}</ThemedText>
                    </View>
                    <View style={[styles.badgeStatus, { backgroundColor: esInicio ? "#dcfce7" : "#e0f2fe" }]}>
                      <ThemedText style={[styles.badgeStatusText, { color: esInicio ? "#16a34a" : "#0369a1" }]}>
                        {item.tipo_ultimo_marcado}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Detalle de Turno y Responsable */}
                  <View style={styles.cardDetailsRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.labelDetail}>Responsable:</ThemedText>
                      <ThemedText style={styles.valueDetail} numberOfLines={1}>
                        {item.personal_responsable || "Sin asignar"}
                      </ThemedText>
                    </View>
                    <View>
                      <ThemedText style={styles.labelDetail}>Turno:</ThemedText>
                      <ThemedText style={styles.valueDetail}>{item.turno || "N/A"}</ThemedText>
                    </View>
                  </View>

                  {/* Bloque Destacado: Último KM y Hora */}
                  <View style={styles.kmHighlightBox}>
                    <View>
                      <ThemedText style={styles.labelKmTitle}>
                        {esInicio ? "KM INICIAL REGISTRADO" : "KM FINAL REGISTRADO"}
                      </ThemedText>
                      <ThemedText style={styles.kmValueText}>
                        {item.ultimo_km_marcado?.toLocaleString()} km
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <ThemedText style={styles.labelDetail}>Último Registro:</ThemedText>
                      <ThemedText style={styles.fechaHoraText}>{item.ultima_fecha || "---"}</ThemedText>
                      <ThemedText style={styles.fechaHoraSubText}>{item.ultima_hora || ""}</ThemedText>
                    </View>
                  </View>

                  {/* Estado de Cierre / Auditoría */}
                  {item.estado_cierre === "PENDIENTE_AUDITORIA" && (
                    <View style={styles.auditWarningBox}>
                      <Ionicons name="warning-outline" size={13} color="#dc2626" />
                      <ThemedText style={styles.auditWarningText}>Requiere Auditoría / Observado</ThemedText>
                    </View>
                  )}

                </View>
              );
            }}
          />
        )}

      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  main: { flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 16, paddingTop: 12 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  mainTitle: { fontSize: 16, fontWeight: "900", color: MJM_BLUE, letterSpacing: 0.5 },
  subTitle: { fontSize: 11, color: "#64748b", marginTop: 2 },
  refreshButton: {
    backgroundColor: MJM_BLUE,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  refreshButtonText: { color: "white", fontSize: 11, fontWeight: "700" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 12, color: "#1e293b", padding: 0 },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: MJM_BLUE,
  },
  filterText: { fontSize: 11, fontWeight: "700", color: MJM_BLUE },
  filterTextActive: { color: "white" },
  errorContainer: {
    backgroundColor: "#fee2e2",
    borderColor: "#f87171",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: { color: "#b91c1c", fontSize: 12, textAlign: "center" },
  listContent: { paddingBottom: 24, gap: 12 },
  cardVehiculo: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  placaText: { fontSize: 14, fontWeight: "900", color: "#1e293b" },
  badgeStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeStatusText: { fontSize: 10, fontWeight: "800" },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 10 },
  cardDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  labelDetail: { fontSize: 10, color: "#64748b", fontWeight: "600" },
  valueDetail: { fontSize: 12, color: "#334155", fontWeight: "700", marginTop: 1 },
  kmHighlightBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  labelKmTitle: { fontSize: 9, fontWeight: "900", color: "#64748b", letterSpacing: 0.5 },
  kmValueText: { fontSize: 15, fontWeight: "900", color: MJM_BLUE, marginTop: 2 },
  fechaHoraText: { fontSize: 11, fontWeight: "700", color: "#334155", marginTop: 1 },
  fechaHoraSubText: { fontSize: 10, color: "#94a3b8", fontWeight: "600" },
  auditWarningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fee2e2",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  auditWarningText: { fontSize: 10, fontWeight: "700", color: "#dc2626" },
  emptyText: { fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 30 },
});