import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
const MJM_BLUE = "#024885";
const LIMIT_INICIAL = 5;

interface EstadisticaItem {
  id?: number | string;
  label: string;
  value: number;
}

interface ModalidadPorUsuario {
  modalidad: string;
  cantidad: number;
}

interface DireccionItem {
  MODALIDAD: string;
  DIRECCIÓN_CONSOLIDADA: string;
  CANTIDAD: number;
}

interface CardProps {
  titulo: string;
  datos: EstadisticaItem[];
  colorTema: string;
  icono: keyof typeof Ionicons.glyphMap;
  showAll: boolean;
  setShowAll: React.Dispatch<React.SetStateAction<boolean>>;
  isUserCard: boolean;
  loading: boolean;
  onSelectUser?: (id: number | string, nombre: string) => void;
}

const obtenerTextoTurnoActual = (): string => {
  const ahora = new Date();
  const tiempoMinutos = ahora.getHours() * 60 + ahora.getMinutes();
  if (tiempoMinutos >= 430 && tiempoMinutos < 900) return "Turno Mañana (07:00 - 15:00)";
  if (tiempoMinutos >= 900 && tiempoMinutos < 1320) return "Turno Tarde (15:00 - 22:00)";
  return "Turno Noche (22:00 - 07:00)";
};

const DashboardCard = React.memo(
  ({
    titulo,
    datos,
    colorTema,
    icono,
    showAll,
    setShowAll,
    isUserCard,
    loading,
    onSelectUser,
  }: CardProps) => {
    const maxVal = useMemo(() => {
      return datos.length > 0 ? Math.max(...datos.map((item) => Number(item.value) || 0), 1) : 1;
    }, [datos]);

    const totalSubCard = useMemo(() => {
      return datos.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
    }, [datos]);
const turnoCargadoUnaVez = useRef(false);
    const datosVisibles = showAll ? datos : datos.slice(0, LIMIT_INICIAL);
    const hayMasDatos = datos.length > LIMIT_INICIAL;

    return (
      <View style={[styles.dashboardCard, { borderColor: colorTema }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: colorTema + "15" }]}>
            <Ionicons name={icono} size={20} color={colorTema} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <ThemedText style={[styles.cardTitleText, { color: colorTema }]}>{titulo}</ThemedText>
            <ThemedText style={styles.cardTotalSub}>
              {loading ? "Calculando..." : `Suma en lista: ${totalSubCard} reg.`}
            </ThemedText>
          </View>
        </View>

        <View style={styles.divider} />

        {loading ? (
          <ActivityIndicator size="small" color={colorTema} style={{ marginVertical: 25 }} />
        ) : datos.length > 0 ? (
          <>
            {datosVisibles.map((item, index) => {
              const valNum = Number(item.value) || 0;
              const porcentaje = Math.max(Math.min(Math.round((valNum / maxVal) * 100), 100), 6);

              return (
                <View key={`${item.label}-${index}`} style={styles.barGroup}>
                  {isUserCard ? (
                    <TouchableOpacity
                      style={styles.labelRowClickable}
                      activeOpacity={0.7}
                      onPress={() => onSelectUser?.(item.id ?? "", item.label)}
                    >
                      <ThemedText style={styles.itemLabelLink} numberOfLines={1}>
                        {index + 1}. {item.label} <Ionicons name="chevron-forward" size={11} color={MJM_BLUE} />
                      </ThemedText>
                      <ThemedText style={[styles.itemValue, { color: colorTema }]}>{valNum} reg.</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.labelRow}>
                      <ThemedText style={styles.itemLabel} numberOfLines={1}>
                        {index + 1}. {item.label}
                      </ThemedText>
                      <ThemedText style={[styles.itemValue, { color: colorTema }]}>{valNum} reg.</ThemedText>
                    </View>
                  )}

                  <View style={styles.barBackground}>
                    <View style={{ backgroundColor: colorTema, height: "100%", width: `${porcentaje}%`, borderRadius: 3 }} />
                  </View>
                </View>
              );
            })}

            {hayMasDatos && (
              <TouchableOpacity
                style={[styles.verMasButton, { borderColor: colorTema + "40" }]}
                onPress={() => setShowAll((prev) => !prev)}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.verMasText, { color: colorTema }]}>
                  {showAll ? "Ver menos" : `Ver más (${datos.length - LIMIT_INICIAL} ocultos)`}
                </ThemedText>
                <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={14} color={colorTema} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <ThemedText style={styles.emptyText}>No hay registros en este turno.</ThemedText>
        )}
      </View>
    );
  }
);

export default function GraficoEstadisticasScreen() {
  const [estadisticasUsuarios, setEstadisticasUsuarios] = useState<EstadisticaItem[]>([]);
  const [estadisticasModalidades, setEstadisticasModalidades] = useState<EstadisticaItem[]>([]);
  
  // ESTADOS SEPARADOS PARA CADA CONTADOR (Cero interferencia entre ellos)
  const [totalTurnoReal, setTotalTurnoReal] = useState<number>(0);
  const [loadingTotal, setLoadingTotal] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showAllUsuarios, setShowAllUsuarios] = useState<boolean>(false);
  const [showAllModalidades, setShowAllModalidades] = useState<boolean>(false);

  const [selectedUserId, setSelectedUserId] = useState<number | string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [modalidadesUsuario, setModalidadesUsuario] = useState<ModalidadPorUsuario[]>([]);
  const [loadingUserModalidades, setLoadingUserModalidades] = useState<boolean>(false);

  const [selectedModalidad, setSelectedModalidad] = useState<string | null>(null);
  const [direccionesModalidad, setDireccionesModalidad] = useState<DireccionItem[]>([]);
  const [loadingDirecciones, setLoadingDirecciones] = useState<boolean>(false);

  // Contador 2: Calculado netamente del array de las tarjetas de la interfaz
  const totalDinamicoListas = useMemo(() => {
    return estadisticasUsuarios.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  }, [estadisticasUsuarios]);

  const cacheModalidadesRef = useRef<Map<number | string, ModalidadPorUsuario[]>>(new Map());
  const cacheDireccionesRef = useRef<Map<string, DireccionItem[]>>(new Map());

  const textoTurno = useMemo(() => obtenerTextoTurnoActual(), []);

  // FUNCIÓN 1: Consulta exclusiva para el Contador 1 (Los 6k de la BD)
  const fetchTotalTurno = async () => {
  // Si ya se cargó una vez y no quieres que cambie más al refrescar las listas, 
  // puedes bloquearlo aquí. (O si quieres que se actualice solo al refrescar, 
  // asegúrate de que use un estado totalmente independiente).
  try {
    setLoadingTotal(true);
    const response = await fetch(`${API_BASE_URL}/ocurrencias/total-turno`);
    const data = await response.json();
    if (data.success) {
      setTotalTurnoReal(data.total);
    }
  } catch (error) {
    console.error("Error al obtener total absoluto:", error);
  } finally {
    setLoadingTotal(false);
  }
};

  // FUNCIÓN 2: Consulta exclusiva para las tarjetas y listas (Contador 2)
  const fetchEstadisticas = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/ocurrencias/estadisticas`);
      if (!response.ok) throw new Error("Error en la petición de datos");
      const data = await response.json();

      setEstadisticasUsuarios(data.por_usuario || []);
      setEstadisticasModalidades(data.por_modalidad || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("No se pudieron actualizar los datos del servidor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Carga inicial al abrir la pantalla
  useEffect(() => {
    fetchTotalTurno();
    fetchEstadisticas();
  }, []);

  // Botón Actualizar (Refrescar): Ejecuta ambos de forma independiente sin mezclar resultados
  const onRefresh = () => {
    setRefreshing(true);
    cacheModalidadesRef.current.clear();
    cacheDireccionesRef.current.clear();
    
    // Llamadas independientes concurrentes
    Promise.all([fetchTotalTurno(), fetchEstadisticas(true)]).finally(() => {
      setRefreshing(false);
    });
  };

  const handleSelectUser = useCallback(async (idUsuario: number | string, nombreUsuario: string) => {
    setSelectedUserId(idUsuario);
    setSelectedUser(nombreUsuario);
    setSelectedModalidad(null);

    if (cacheModalidadesRef.current.has(idUsuario)) {
      setModalidadesUsuario(cacheModalidadesRef.current.get(idUsuario)!);
      return;
    }

    setLoadingUserModalidades(true);
    try {
      const response = await fetch(`${API_BASE_URL}/ocurrencias/modalidades-por-usuario?id_usuario=${idUsuario}`);
      const data = await response.json();
      const mods = data.modalidades || [];
      cacheModalidadesRef.current.set(idUsuario, mods);
      setModalidadesUsuario(mods);
    } catch (error) {
      setModalidadesUsuario([]);
    } finally {
      setLoadingUserModalidades(false);
    }
  }, []);

  const handleSelectModalidad = useCallback(async (nombreModalidad: string) => {
    if (!selectedUserId) return;
    setSelectedModalidad(nombreModalidad);

    const cacheKey = `${selectedUserId}_${nombreModalidad}`;
    if (cacheDireccionesRef.current.has(cacheKey)) {
      setDireccionesModalidad(cacheDireccionesRef.current.get(cacheKey)!);
      return;
    }

    setLoadingDirecciones(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/ocurrencias/detalle-por-modalidad?id_usuario=${selectedUserId}&modalidad=${encodeURIComponent(nombreModalidad)}`
      );
      const data = await response.json();
      const dirs = data.direcciones || [];
      cacheDireccionesRef.current.set(cacheKey, dirs);
      setDireccionesModalidad(dirs);
    } catch (error) {
      setDireccionesModalidad([]);
    } finally {
      setLoadingDirecciones(false);
    }
  }, [selectedUserId]);

  const cerrarModal = () => {
    setSelectedUserId(null);
    setSelectedUser(null);
    setSelectedModalidad(null);
    setModalidadesUsuario([]);
    setDireccionesModalidad([]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ThemedView style={styles.main}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MJM_BLUE} />}
        >
          {/* CABECERA CON LOS DOS CONTADORES TOTALMENTE AISLADOS */}
          <View style={styles.headerContainer}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <ThemedText style={styles.mainTitle}>DASHBOARD DE ESTADÍSTICAS</ThemedText>
              
              <View style={styles.badgesRow}>
                <View style={styles.turnoBadge}>
                  <Ionicons name="time-outline" size={12} color={MJM_BLUE} />
                  <ThemedText style={styles.turnoBadgeText}>{textoTurno}</ThemedText>
                </View>

                {/* CONTADOR 1: El Total Total Total absoluto (Ej. 6k) */}
                <View style={styles.totalBadge}>
                  <Ionicons name="stats-chart" size={12} color="#28a745" />
                  <ThemedText style={styles.totalBadgeText}>
                    Total Turno: {loadingTotal ? "..." : `${totalTurnoReal} reg.`}
                  </ThemedText>
                </View>

                {/* CONTADOR 2: El acumulado dinámico de las listas */}
                <View style={styles.listBadge}>
                  <Ionicons name="layers-outline" size={12} color="#856404" />
                  <ThemedText style={styles.listBadgeText}>
                    Cargado en Listas: {loading ? "Cargando..." : `${totalDinamicoListas} reg.`}
                  </ThemedText>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.8}>
              <Ionicons name="refresh" size={16} color="white" />
              <ThemedText style={styles.refreshButtonText}>Actualizar</ThemedText>
            </TouchableOpacity>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          )}

          <View style={styles.dashboardGrid}>
            <DashboardCard
              titulo="RENDIMIENTO POR PERSONAL"
              datos={estadisticasUsuarios}
              colorTema={MJM_BLUE}
              icono="people-outline"
              showAll={showAllUsuarios}
              setShowAll={setShowAllUsuarios}
              isUserCard={true}
              loading={loading}
              onSelectUser={handleSelectUser}
            />

            <DashboardCard
              titulo="MODALIDADES RECURRENTES"
              datos={estadisticasModalidades}
              colorTema="#28a745"
              icono="shield-outline"
              showAll={showAllModalidades}
              setShowAll={setShowAllModalidades}
              isUserCard={false}
              loading={loading}
            />
          </View>
        </ScrollView>

        <Modal visible={!!selectedUser} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.modalTitle}>
                    {selectedModalidad ? "DIRECCIONES ASOCIADAS" : "DESGLOSE POR PERSONAL"}
                  </ThemedText>
                  <ThemedText style={styles.modalSubtitle} numberOfLines={1}>
                    {selectedModalidad ? selectedModalidad : selectedUser}
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={cerrarModal} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {!selectedModalidad ? (
                loadingUserModalidades ? (
                  <ActivityIndicator size="small" color={MJM_BLUE} style={{ marginVertical: 30 }} />
                ) : modalidadesUsuario.length > 0 ? (
                  <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                    {modalidadesUsuario.map((mod, idx) => (
                      <TouchableOpacity
                        key={`${mod.modalidad}-${idx}`}
                        style={styles.modalItemRowClickable}
                        activeOpacity={0.7}
                        onPress={() => handleSelectModalidad(mod.modalidad)}
                      >
                        <ThemedText style={styles.modalItemLabelLink} numberOfLines={1}>
                          • {mod.modalidad} <Ionicons name="chevron-forward" size={11} color={MJM_BLUE} />
                        </ThemedText>
                        <ThemedText style={styles.modalItemVal}>{mod.cantidad} reg.</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <ThemedText style={styles.emptyText}>No hay modalidades registradas para este efectivo.</ThemedText>
                )
              ) : (
                <View>
                  <TouchableOpacity style={styles.backButton} onPress={() => setSelectedModalidad(null)}>
                    <Ionicons name="arrow-back" size={14} color={MJM_BLUE} />
                    <ThemedText style={styles.backButtonText}>Volver a modalidades</ThemedText>
                  </TouchableOpacity>

                  {loadingDirecciones ? (
                    <ActivityIndicator size="small" color={MJM_BLUE} style={{ marginVertical: 30 }} />
                  ) : direccionesModalidad.length > 0 ? (
                    <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                      {direccionesModalidad.map((item, idx) => (
                        <View key={idx} style={styles.modalItemRow}>
                          <ThemedText style={styles.modalItemLabel} numberOfLines={2}>
                            📍 {item.DIRECCIÓN_CONSOLIDADA}
                          </ThemedText>
                          <ThemedText style={styles.modalItemVal}>{item.CANTIDAD} reg.</ThemedText>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <ThemedText style={styles.emptyText}>No hay direcciones registradas para esta modalidad.</ThemedText>
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.modalCloseFooter} onPress={cerrarModal}>
                <ThemedText style={styles.modalCloseFooterText}>Cerrar</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f1f5f9" },
  main: { flex: 1, backgroundColor: "#f1f5f9" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 10 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  mainTitle: { fontSize: 15, fontWeight: "900", color: "#024885", letterSpacing: 0.8 },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  turnoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MJM_BLUE + "15",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  turnoBadgeText: { 
    fontSize: 11, 
    fontWeight: "700", 
    color: MJM_BLUE, 
    marginLeft: 4 
  },
  totalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#28a74515",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#28a74530",
  },
  totalBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#28a745",
    marginLeft: 4,
  },
  listBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff3cd",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ffeeba",
  },
  listBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#856404",
    marginLeft: 4,
  },
  refreshButton: {
    backgroundColor: "#024885",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
  },
  refreshButtonText: { color: "white", fontSize: 11, fontWeight: "bold" },
  errorContainer: {
    backgroundColor: "#fee2e2",
    borderColor: "#f87171",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: { color: "#b91c1c", fontSize: 12, textAlign: "center" },
  dashboardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20, alignItems: "flex-start" },
  dashboardCard: {
    flex: 1,
    minWidth: 300,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderTopWidth: 4,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  iconCircle: { padding: 10, borderRadius: 10 },
  cardTitleText: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  cardTotalSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 14 },
  barGroup: { marginBottom: 14 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  labelRowClickable: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
    backgroundColor: "#f8fafc",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  itemLabel: { fontSize: 12, fontWeight: "600", color: "#334155", maxWidth: "75%" },
  itemLabelLink: { fontSize: 12, fontWeight: "bold", color: MJM_BLUE, maxWidth: "75%" },
  itemValue: { fontSize: 12, fontWeight: "bold" },
  barBackground: { width: "100%", backgroundColor: "#e2e8f0", borderRadius: 4, height: 8, overflow: "hidden" },
  verMasButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#f8fafc",
  },
  verMasText: { fontSize: 11, fontWeight: "bold" },
  emptyText: { fontSize: 12, color: "#94a3b8", textAlign: "center", paddingVertical: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", maxWidth: 400, backgroundColor: "white", borderRadius: 16, padding: 20, elevation: 5 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 10, fontWeight: "900", color: "#64748b", letterSpacing: 1 },
  modalSubtitle: { fontSize: 14, fontWeight: "bold", color: MJM_BLUE, marginTop: 2 },
  closeButton: { padding: 4, backgroundColor: "#f1f5f9", borderRadius: 8 },
  modalItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalItemRowClickable: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    marginBottom: 4,
  },
  modalItemLabel: { fontSize: 12, fontWeight: "600", color: "#334155", flex: 1, marginRight: 10 },
  modalItemLabelLink: { fontSize: 12, fontWeight: "bold", color: MJM_BLUE, flex: 1 },
  modalItemVal: { fontSize: 12, fontWeight: "bold", color: "#28a745" },
  backButton: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, paddingVertical: 4 },
  backButtonText: { fontSize: 12, fontWeight: "bold", color: MJM_BLUE },
  modalCloseFooter: {
    backgroundColor: MJM_BLUE,
    marginTop: 15,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseFooterText: { color: "white", fontSize: 12, fontWeight: "bold" },
});