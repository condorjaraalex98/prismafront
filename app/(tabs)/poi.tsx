import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  totalGeneral: number;
  showAll: boolean;
  setShowAll: React.Dispatch<React.SetStateAction<boolean>>;
  isUserCard: boolean;
  loading: boolean;
  onSelectUser?: (id: number | string, nombre: string) => void;
}

const obtenerTextoTurnoActual = (): string => {
  const ahora = new Date();
  const hora = ahora.getHours();
  const minutos = ahora.getMinutes();
  const tiempoMinutos = hora * 60 + minutos;

  if (tiempoMinutos >= 430 && tiempoMinutos < 900) {
    return "Turno Mañana (07:00 - 15:00)";
  } else if (tiempoMinutos >= 900 && tiempoMinutos < 1320) {
    return "Turno Tarde (15:00 - 22:00)";
  } else {
    return "Turno Noche (22:00 - 07:00)";
  }
};

const DashboardCard = React.memo(
  ({
    titulo,
    datos,
    colorTema,
    icono,
    totalGeneral,
    showAll,
    setShowAll,
    isUserCard,
    loading,
    onSelectUser,
  }: CardProps) => {
    const maxVal = useMemo(() => {
      return datos.length > 0
        ? Math.max(...datos.map((item) => Number(item.value) || 0), 1)
        : 1;
    }, [datos]);

    const datosVisibles = showAll ? datos : datos.slice(0, LIMIT_INICIAL);
    const hayMasDatos = datos.length > LIMIT_INICIAL;

    return (
      <View style={[styles.dashboardCard, { borderColor: colorTema }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: colorTema + "15" }]}>
            <Ionicons name={icono} size={20} color={colorTema} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <ThemedText style={[styles.cardTitleText, { color: colorTema }]}>
              {titulo}
            </ThemedText>
            <ThemedText style={styles.cardTotalSub}>
              Total:{" "}
              <ThemedText style={{ fontWeight: "900", color: colorTema }}>
                {totalGeneral} reg.
              </ThemedText>
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
              const porcentaje = Math.max(
                Math.min(Math.round((valNum / maxVal) * 100), 100),
                6
              );

              return (
                <View key={`${item.label}-${index}`} style={styles.barGroup}>
                  {isUserCard ? (
                    <TouchableOpacity
                      style={styles.labelRowClickable}
                      activeOpacity={0.7}
                      onPress={() => onSelectUser?.(item.id ?? "", item.label)}
                    >
                      <ThemedText style={styles.itemLabelLink} numberOfLines={1}>
                        {index + 1}. {item.label}{" "}
                        <Ionicons name="chevron-forward" size={11} color={MJM_BLUE} />
                      </ThemedText>
                      <ThemedText style={[styles.itemValue, { color: colorTema }]}>
                        {valNum} reg.
                      </ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.labelRow}>
                      <ThemedText style={styles.itemLabel} numberOfLines={1}>
                        {index + 1}. {item.label}
                      </ThemedText>
                      <ThemedText style={[styles.itemValue, { color: colorTema }]}>
                        {valNum} reg.
                      </ThemedText>
                    </View>
                  )}

                  <View style={styles.barBackground}>
                    <View
                      style={{
                        backgroundColor: colorTema,
                        height: "100%",
                        width: `${porcentaje}%`,
                        borderRadius: 3,
                      }}
                    />
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
                <Ionicons
                  name={showAll ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colorTema}
                />
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
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showAllUsuarios, setShowAllUsuarios] = useState<boolean>(false);
  const [showAllModalidades, setShowAllModalidades] = useState<boolean>(false);

  // Estados de los nuevos filtros (Badges)
  const [origenesList, setOrigenesList] = useState<any[]>([]);
  const [tiposPatrullajeList, setTiposPatrullajeList] = useState<any[]>([]);
  const [filtroOrigen, setFiltroOrigen] = useState<string>("TODOS");
  const [filtroTipoPatrullaje, setFiltroTipoPatrullaje] = useState<string>("TODOS");

  // Estados del Modal y Navegación
  const [selectedUserId, setSelectedUserId] = useState<number | string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [modalidadesUsuario, setModalidadesUsuario] = useState<ModalidadPorUsuario[]>([]);
  const [loadingUserModalidades, setLoadingUserModalidades] = useState<boolean>(false);

  const [selectedModalidad, setSelectedModalidad] = useState<string | null>(null);
  const [direccionesModalidad, setDireccionesModalidad] = useState<DireccionItem[]>([]);
  const [loadingDirecciones, setLoadingDirecciones] = useState<boolean>(false);

  const textoTurno = useMemo(() => obtenerTextoTurnoActual(), []);

  // Cargar catálogos para los badges al montar la pantalla
  useEffect(() => {
    fetch(`${API_BASE_URL}/ocurrencias/catalogos-filtros`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setOrigenesList(data.origenes || []);
          setTiposPatrullajeList(data.tipos_patrullaje || []);
        }
      })
      .catch((err) => console.error("Error cargando catálogos de filtros", err));
  }, []);

  const fetchEstadisticas = useCallback(async () => {
    setErrorMessage(null);
    try {
      let url = `${API_BASE_URL}/ocurrencias/estadisticas?`;
      if (filtroOrigen !== "TODOS") url += `id_origen=${filtroOrigen}&`;
      if (filtroTipoPatrullaje !== "TODOS") url += `id_tipop=${filtroTipoPatrullaje}&`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Error en la petición de datos");
      const data = await response.json();

      setEstadisticasUsuarios(data.por_usuario || []);
      setEstadisticasModalidades(data.por_modalidad || []);
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
      setErrorMessage("No se pudieron actualizar los datos del servidor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtroOrigen, filtroTipoPatrullaje]);

  useEffect(() => {
    fetchEstadisticas();
  }, [fetchEstadisticas, filtroOrigen, filtroTipoPatrullaje]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEstadisticas();
  };

  const handleSelectUser = useCallback(async (idUsuario: number | string, nombreUsuario: string) => {
    setSelectedUserId(idUsuario);
    setSelectedUser(nombreUsuario);
    setSelectedModalidad(null);
    setLoadingUserModalidades(true);
    try {
      let url = `${API_BASE_URL}/ocurrencias/modalidades-por-usuario?id_usuario=${idUsuario}&`;
      if (filtroOrigen !== "TODOS") url += `id_origen=${filtroOrigen}&`;
      if (filtroTipoPatrullaje !== "TODOS") url += `id_tipop=${filtroTipoPatrullaje}&`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Error obteniendo detalles");
      const data = await response.json();
      setModalidadesUsuario(data.modalidades || []);
    } catch (error) {
      console.error("Error:", error);
      setModalidadesUsuario([]);
    } finally {
      setLoadingUserModalidades(false);
    }
  }, [filtroOrigen, filtroTipoPatrullaje]);

  const handleSelectModalidad = useCallback(async (nombreModalidad: string) => {
    if (!selectedUserId) return;
    setSelectedModalidad(nombreModalidad);
    setLoadingDirecciones(true);
    try {
      let url = `${API_BASE_URL}/ocurrencias/detalle-por-modalidad?id_usuario=${selectedUserId}&modalidad=${encodeURIComponent(nombreModalidad)}&`;
      if (filtroOrigen !== "TODOS") url += `id_origen=${filtroOrigen}&`;
      if (filtroTipoPatrullaje !== "TODOS") url += `id_tipop=${filtroTipoPatrullaje}&`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Error obteniendo direcciones");
      const data = await response.json();
      setDireccionesModalidad(data.direcciones || []);
    } catch (error) {
      console.error("Error:", error);
      setDireccionesModalidad([]);
    } finally {
      setLoadingDirecciones(false);
    }
  }, [selectedUserId, filtroOrigen, filtroTipoPatrullaje]);

  const cerrarModal = () => {
    setSelectedUserId(null);
    setSelectedUser(null);
    setSelectedModalidad(null);
    setModalidadesUsuario([]);
    setDireccionesModalidad([]);
  };

  const totalUsuarios = useMemo(
    () => estadisticasUsuarios.reduce((acc, item) => acc + Number(item.value || 0), 0),
    [estadisticasUsuarios]
  );

  const totalModalidades = useMemo(
    () => estadisticasModalidades.reduce((acc, item) => acc + Number(item.value || 0), 0),
    [estadisticasModalidades]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ThemedView style={styles.main}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MJM_BLUE} />
          }
        >
          {/* CABECERA Y TURNO */}
          <View style={styles.headerContainer}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <ThemedText style={styles.mainTitle}>DASHBOARD DE ESTADÍSTICAS</ThemedText>
              <View style={styles.turnoBadge}>
                <Ionicons name="time-outline" size={12} color={MJM_BLUE} />
                <ThemedText style={styles.turnoBadgeText}>{textoTurno}</ThemedText>
              </View>
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.8}>
              <Ionicons name="refresh" size={16} color="white" />
              <ThemedText style={styles.refreshButtonText}>Actualizar</ThemedText>
            </TouchableOpacity>
          </View>

          {/* FILTROS SUPERIORES: BADGES DE ORIGEN Y TIPO PATRULLAJE */}
          <View style={styles.filtrosContainer}>
            <ThemedText style={styles.filtroLabel}>Origen:</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
              <TouchableOpacity
                style={[styles.badge, filtroOrigen === "TODOS" && styles.badgeActive]}
                onPress={() => setFiltroOrigen("TODOS")}
              >
                <ThemedText style={[styles.badgeText, filtroOrigen === "TODOS" && styles.badgeTextActive]}>
                  Todos
                </ThemedText>
              </TouchableOpacity>
              {origenesList.map((item) => (
                <TouchableOpacity
                  key={item.id_origen}
                  style={[styles.badge, filtroOrigen === String(item.id_origen) && styles.badgeActive]}
                  onPress={() => setFiltroOrigen(String(item.id_origen))}
                >
                  <ThemedText style={[styles.badgeText, filtroOrigen === String(item.id_origen) && styles.badgeTextActive]}>
                    {item.descripcion}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ThemedText style={[styles.filtroLabel, { marginTop: 6 }]}>Tipo de Patrullaje:</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
              <TouchableOpacity
                style={[styles.badge, filtroTipoPatrullaje === "TODOS" && styles.badgeActive]}
                onPress={() => setFiltroTipoPatrullaje("TODOS")}
              >
                <ThemedText style={[styles.badgeText, filtroTipoPatrullaje === "TODOS" && styles.badgeTextActive]}>
                  Todos
                </ThemedText>
              </TouchableOpacity>
              {tiposPatrullajeList.map((item) => (
                <TouchableOpacity
                  key={item.id_tipop}
                  style={[styles.badge, filtroTipoPatrullaje === String(item.id_tipop) && styles.badgeActive]}
                  onPress={() => setFiltroTipoPatrullaje(String(item.id_tipop))}
                >
                  <ThemedText style={[styles.badgeText, filtroTipoPatrullaje === String(item.id_tipop) && styles.badgeTextActive]}>
                    {item.nombre}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          )}

          {/* DASHBOARD GRID */}
          <View style={styles.dashboardGrid}>
            <DashboardCard
              titulo="RENDIMIENTO POR PERSONAL (CLICK PARA VER DETALLE)"
              datos={estadisticasUsuarios}
              colorTema={MJM_BLUE}
              icono="people-outline"
              totalGeneral={totalUsuarios}
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
              totalGeneral={totalModalidades}
              showAll={showAllModalidades}
              setShowAll={setShowAllModalidades}
              isUserCard={false}
              loading={loading}
            />
          </View>
        </ScrollView>

        {/* MODAL DE DESGLOSE */}
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
                  <ThemedText style={styles.emptyText}>No hay modalidades registradas.</ThemedText>
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
                    <ThemedText style={styles.emptyText}>No hay direcciones registradas.</ThemedText>
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
  mainTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#024885",
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 1,
    marginTop: 2,
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
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    alignItems: "flex-start",
  },
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
  cardTitleText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardTotalSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 14 },
  barGroup: { marginBottom: 14 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
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
  itemLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    maxWidth: "75%",
  },
  itemLabelLink: {
    fontSize: 12,
    fontWeight: "bold",
    color: MJM_BLUE,
    maxWidth: "75%",
  },
  itemValue: { fontSize: 12, fontWeight: "bold" },
  barBackground: {
    width: "100%",
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    height: 8,
    overflow: "hidden",
  },
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
  emptyText: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: MJM_BLUE,
    marginTop: 2,
  },
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
  modalItemLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
    marginRight: 10,
  },
  modalItemLabelLink: {
    fontSize: 12,
    fontWeight: "bold",
    color: MJM_BLUE,
    flex: 1,
  },
  modalItemVal: { fontSize: 12, fontWeight: "bold", color: "#28a745" },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
    paddingVertical: 4,
  },
  backButtonText: { fontSize: 12, fontWeight: "bold", color: MJM_BLUE },
  modalCloseFooter: {
    backgroundColor: MJM_BLUE,
    marginTop: 15,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  turnoBadge: { flexDirection: "row", alignItems: "center", backgroundColor: MJM_BLUE + "12", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: "flex-start", marginTop: 4 },
  turnoBadgeText: { fontSize: 11, fontWeight: "700", color: MJM_BLUE, marginLeft: 4 },
  modalCloseFooterText: { color: "white", fontSize: 12, fontWeight: "bold" },

  
  // Estilos de los badges de filtros
  filtrosContainer: { backgroundColor: "white", padding: 10, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: "#e2e8f0" },
  filtroLabel: { fontSize: 10, fontWeight: "700", color: "#64748b", marginBottom: 4, textTransform: "uppercase" },
  badgeScroll: { flexDirection: "row", marginBottom: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, backgroundColor: "#f1f5f9", marginRight: 6, borderWidth: 1, borderColor: "#e2e8f0" },
  badgeActive: { backgroundColor: MJM_BLUE, borderColor: MJM_BLUE },
  badgeText: { fontSize: 11, color: "#334155", fontWeight: "600" },
  badgeTextActive: { color: "white" },

  
  

  
});