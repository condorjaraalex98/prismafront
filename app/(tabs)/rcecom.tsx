import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";
const MJM_BLUE = "#024885";
const LIMIT_INICIAL = 5;
const ORIGENES_PERMITIDOS = [1, 5, 6, 7, 11];

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
  datos: EstadisticaItem[];
  colorTema: string;
  showAll: boolean;
  onToggleShowAll: () => void;
  isUserCard: boolean;
  loading: boolean;
  onSelectUser?: (id: number | string, nombre: string) => void;
}

const obtenerTextoTurnoActual = (): string => {
  const ahora = new Date();
  const hora = ahora.getHours();
  const minutos = ahora.getMinutes();
  const tiempoMinutos = hora * 60 + minutos;

  if (tiempoMinutos >= 420 && tiempoMinutos < 900) {
    return "Turno Mañana (07:00 - 14:59)";
  } else if (tiempoMinutos >= 900 && tiempoMinutos < 1320) {
    return "Turno Tarde (15:00 - 21:59)";
  } else {
    return "Turno Noche (22:00 - 06:59)";
  }
};

const DashboardCard = React.memo(
  ({
    datos,
    colorTema,
    showAll,
    onToggleShowAll,
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
      <View style={[styles.dashboardCard, { borderColor: colorTema + "25" }]}>
        <View style={styles.divider} />

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colorTema}
            style={{ marginVertical: 25 }}
          />
        ) : datos.length > 0 ? (
          <>
            {datosVisibles.map((item, index) => {
              const valNum = Number(item.value) || 0;
              const porcentaje = Math.max(
                Math.min(Math.round((valNum / maxVal) * 100), 100),
                6
              );

              return (
                <View key={`${item.id ?? item.label}-${index}`} style={styles.barGroup}>
                  {isUserCard ? (
                    <TouchableOpacity
                      style={styles.labelRowClickable}
                      activeOpacity={0.7}
                      onPress={() => onSelectUser?.(item.id ?? "", item.label)}
                    >
                      <ThemedText style={styles.itemLabelLink} numberOfLines={1}>
                        {index + 1}. {item.label}
                      </ThemedText>
                      <View style={styles.badgeItemValue}>
                        <ThemedText
                          style={[styles.itemValueText, { color: colorTema }]}
                        >
                          {valNum} reg.
                        </ThemedText>
                        <Ionicons
                          name="chevron-forward"
                          size={11}
                          color={colorTema}
                        />
                      </View>
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
                style={[styles.verMasButton, { borderColor: colorTema + "30" }]}
                onPress={onToggleShowAll}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.verMasText, { color: colorTema }]}>
                  {showAll
                    ? "Ver menos"
                    : `Ver más (${datos.length - LIMIT_INICIAL} ocultos)`}
                </ThemedText>
                <Ionicons
                  name={showAll ? "chevron-up" : "chevron-down"}
                  size={13}
                  color={colorTema}
                />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <ThemedText style={styles.emptyText}>
            No hay registros en este origen.
          </ThemedText>
        )}
      </View>
    );
  }
);

export default function GraficoEstadisticasScreen() {
  const [datosPorOrigen, setDatosPorOrigen] = useState<
    Record<number, EstadisticaItem[]>
  >({});
  const [nombresOrigenes, setNombresOrigenes] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showAllState, setShowAllState] = useState<Record<number, boolean>>({});

  const [selectedOrigenId, setSelectedOrigenId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | string | null>(
    null
  );
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [modalidadesUsuario, setModalidadesUsuario] = useState<
    ModalidadPorUsuario[]
  >([]);
  const [loadingUserModalidades, setLoadingUserModalidades] =
    useState<boolean>(false);

  const [selectedModalidad, setSelectedModalidad] = useState<string | null>(
    null
  );
  const [direccionesModalidad, setDireccionesModalidad] = useState<
    DireccionItem[]
  >([]);
  const [loadingDirecciones, setLoadingDirecciones] = useState<boolean>(false);

  const [textoTurno, setTextoTurno] = useState<string>(obtenerTextoTurnoActual());

  const isMountedRef = useRef(true);
  const statsAbortRef = useRef<AbortController | null>(null);
  const modalAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      statsAbortRef.current?.abort();
      modalAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setTextoTurno(obtenerTextoTurnoActual());
    const interval = setInterval(() => {
      setTextoTurno(obtenerTextoTurnoActual());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/ocurrencias/catalogos-filtros`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMountedRef.current) return;
        if (data.success && data.origenes) {
          const mapaNombres: Record<number, string> = {};
          data.origenes.forEach((item: any) => {
            const id = Number(item.id_origen);
            if (ORIGENES_PERMITIDOS.includes(id)) {
              mapaNombres[id] = item.descripcion;
            }
          });
          setNombresOrigenes(mapaNombres);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Error cargando catálogos de filtros", err);
        }
      });

    return () => controller.abort();
  }, []);

  const fetchTodasLasEstadisticas = useCallback(async () => {
    statsAbortRef.current?.abort();
    const controller = new AbortController();
    statsAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);

    setErrorMessage(null);
    try {
      const resultados = await Promise.all(
        ORIGENES_PERMITIDOS.map(async (idOrigen) => {
          const response = await fetch(
            `${API_BASE_URL}/ocurrencias/estadisticas?id_origen=${idOrigen}&solo_usuarios=1`,
            { signal: controller.signal }
          );
          if (!response.ok) throw new Error(`Error en origen ${idOrigen}`);
          const data = await response.json();
          return {
            idOrigen,
            por_usuario: (data.por_usuario || []) as EstadisticaItem[],
          };
        })
      );

      if (!isMountedRef.current) return;
      const nuevoMapa: Record<number, EstadisticaItem[]> = {};
      for (const res of resultados) {
        nuevoMapa[res.idOrigen] = res.por_usuario;
      }
      setDatosPorOrigen(nuevoMapa);
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      console.error("Error al cargar estadísticas:", error);
      if (isMountedRef.current) {
        setErrorMessage("No se pudieron actualizar los datos del servidor.");
      }
    } finally {
      clearTimeout(timer);
      if (isMountedRef.current && statsAbortRef.current === controller) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchTodasLasEstadisticas();
  }, [fetchTodasLasEstadisticas]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTodasLasEstadisticas();
  }, [fetchTodasLasEstadisticas]);

  const handleSelectUser = useCallback(
    async (
      idOrigen: number,
      idUsuario: number | string,
      nombreUsuario: string
    ) => {
      modalAbortRef.current?.abort();
      const controller = new AbortController();
      modalAbortRef.current = controller;

      setSelectedOrigenId(idOrigen);
      setSelectedUserId(idUsuario);
      setSelectedUser(nombreUsuario);
      setSelectedModalidad(null);
      setLoadingUserModalidades(true);

      try {
        const url = `${API_BASE_URL}/ocurrencias/modalidades-por-usuario?id_usuario=${encodeURIComponent(
          String(idUsuario)
        )}&id_origen=${idOrigen}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Error obteniendo detalles");
        const data = await response.json();
        if (isMountedRef.current) {
          setModalidadesUsuario(data.modalidades || []);
        }
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        console.error("Error:", error);
        if (isMountedRef.current) setModalidadesUsuario([]);
      } finally {
        if (isMountedRef.current && modalAbortRef.current === controller) {
          setLoadingUserModalidades(false);
        }
      }
    },
    []
  );

  const handleSelectModalidad = useCallback(
    async (nombreModalidad: string) => {
      if (!selectedUserId || selectedOrigenId === null) return;
      modalAbortRef.current?.abort();
      const controller = new AbortController();
      modalAbortRef.current = controller;

      setSelectedModalidad(nombreModalidad);
      setLoadingDirecciones(true);

      try {
        const url = `${API_BASE_URL}/ocurrencias/detalle-por-modalidad?id_usuario=${encodeURIComponent(
          String(selectedUserId)
        )}&modalidad=${encodeURIComponent(
          nombreModalidad
        )}&id_origen=${selectedOrigenId}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Error obteniendo direcciones");
        const data = await response.json();
        if (isMountedRef.current) {
          setDireccionesModalidad(data.direcciones || []);
        }
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        console.error("Error:", error);
        if (isMountedRef.current) setDireccionesModalidad([]);
      } finally {
        if (isMountedRef.current && modalAbortRef.current === controller) {
          setLoadingDirecciones(false);
        }
      }
    },
    [selectedUserId, selectedOrigenId]
  );

  const cerrarModal = useCallback(() => {
    modalAbortRef.current?.abort();
    setSelectedOrigenId(null);
    setSelectedUserId(null);
    setSelectedUser(null);
    setSelectedModalidad(null);
    setModalidadesUsuario([]);
    setDireccionesModalidad([]);
  }, []);

  const toggleShowAll = useCallback((idOrigen: number) => {
    setShowAllState((prev) => ({ ...prev, [idOrigen]: !prev[idOrigen] }));
  }, []);

  const totalesPorOrigen = useMemo(() => {
    const res: Record<number, number> = {};
    for (const idOrigen of ORIGENES_PERMITIDOS) {
      const lista = datosPorOrigen[idOrigen] || [];
      res[idOrigen] = lista.reduce(
        (acc, item) => acc + Number(item.value || 0),
        0
      );
    }
    return res;
  }, [datosPorOrigen]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ThemedView style={styles.main}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={MJM_BLUE}
            />
          }
        >
          {/* CABECERA Y TURNO */}
          <View style={styles.headerContainer}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <ThemedText style={styles.mainTitle}>
                DASHBOARD DE ESTADÍSTICAS
              </ThemedText>
              <View style={styles.turnoBadge}>
                <Ionicons name="time-outline" size={13} color={MJM_BLUE} />
                <ThemedText style={styles.turnoBadgeText}>
                  {textoTurno}
                </ThemedText>
              </View>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={15} color="white" />
              <ThemedText style={styles.refreshButtonText}>
                Actualizar
              </ThemedText>
            </TouchableOpacity>
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          )}

          {/* CONTENEDOR GRID DE LOS 5 ORÍGENES */}
          <View style={styles.dashboardGrid}>
            {ORIGENES_PERMITIDOS.map((idOrigen) => {
              const listaUsuarios = datosPorOrigen[idOrigen] || [];
              const nombreOrigen =
                nombresOrigenes[idOrigen] || `Origen ${idOrigen}`;
              const totalUsuarios = totalesPorOrigen[idOrigen] || 0;

              return (
                <View key={idOrigen} style={styles.origenColumnGroup}>
                  <View style={styles.origenHeaderBanner}>
                    <ThemedText style={styles.origenHeaderText} numberOfLines={1}>
                      {nombreOrigen}
                    </ThemedText>
                    <View style={styles.origenBadgeCount}>
                      <ThemedText style={styles.origenBadgeCountText}>
                        {totalUsuarios}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.cardsSubGrid}>
                    <DashboardCard
                      datos={listaUsuarios}
                      colorTema={MJM_BLUE}
                      showAll={!!showAllState[idOrigen]}
                      onToggleShowAll={() => toggleShowAll(idOrigen)}
                      isUserCard={true}
                      loading={loading}
                      onSelectUser={(idUsr, nomUsr) =>
                        handleSelectUser(idOrigen, idUsr, nomUsr)
                      }
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* MODAL DE DESGLOSE */}
        <Modal
          visible={!!selectedUser}
          animationType="fade"
          transparent={true}
          onRequestClose={cerrarModal}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={cerrarModal} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.modalTitle}>
                    {selectedModalidad
                      ? "DIRECCIONES ASOCIADAS"
                      : "DESGLOSE POR PERSONAL"}
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
                  <ActivityIndicator
                    size="small"
                    color={MJM_BLUE}
                    style={{ marginVertical: 30 }}
                  />
                ) : modalidadesUsuario.length > 0 ? (
                  <FlatList
                    data={modalidadesUsuario}
                    keyExtractor={(mod, idx) => `${mod.modalidad}-${idx}`}
                    style={{ maxHeight: 300 }}
                    initialNumToRender={15}
                    maxToRenderPerBatch={15}
                    windowSize={5}
                    renderItem={({ item: mod }) => (
                      <TouchableOpacity
                        style={styles.modalItemRowClickable}
                        activeOpacity={0.7}
                        onPress={() => handleSelectModalidad(mod.modalidad)}
                      >
                        <ThemedText
                          style={styles.modalItemLabelLink}
                          numberOfLines={1}
                        >
                          • {mod.modalidad}
                        </ThemedText>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <ThemedText style={styles.modalItemVal}>
                            {mod.cantidad} reg.
                          </ThemedText>
                          <Ionicons
                            name="chevron-forward"
                            size={12}
                            color={MJM_BLUE}
                          />
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                ) : (
                  <ThemedText style={styles.emptyText}>
                    No hay modalidades registradas.
                  </ThemedText>
                )
              ) : (
                <View>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setSelectedModalidad(null)}
                  >
                    <Ionicons name="arrow-back" size={14} color={MJM_BLUE} />
                    <ThemedText style={styles.backButtonText}>
                      Volver a modalidades
                    </ThemedText>
                  </TouchableOpacity>

                  {loadingDirecciones ? (
                    <ActivityIndicator
                      size="small"
                      color={MJM_BLUE}
                      style={{ marginVertical: 30 }}
                    />
                  ) : direccionesModalidad.length > 0 ? (
                    <FlatList
                      data={direccionesModalidad}
                      keyExtractor={(item, idx) =>
                        `${item.DIRECCIÓN_CONSOLIDADA}-${idx}`
                      }
                      style={{ maxHeight: 250 }}
                      initialNumToRender={15}
                      maxToRenderPerBatch={15}
                      windowSize={5}
                      renderItem={({ item }) => (
                        <View style={styles.modalItemRow}>
                          <ThemedText
                            style={styles.modalItemLabel}
                            numberOfLines={2}
                          >
                            📍 {item.DIRECCIÓN_CONSOLIDADA}
                          </ThemedText>
                          <ThemedText style={styles.modalItemVal}>
                            {item.CANTIDAD} reg.
                          </ThemedText>
                        </View>
                      )}
                    />
                  ) : (
                    <ThemedText style={styles.emptyText}>
                      No hay direcciones registradas.
                    </ThemedText>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.modalCloseFooter}
                onPress={cerrarModal}
              >
                <ThemedText style={styles.modalCloseFooterText}>
                  Cerrar
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  main: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 28, paddingTop: 12 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: MJM_BLUE,
    letterSpacing: 0.5,
  },
  refreshButton: {
    backgroundColor: MJM_BLUE,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: MJM_BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  refreshButtonText: { color: "white", fontSize: 11, fontWeight: "700" },
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
    gap: 16,
    alignItems: "stretch",
  },
  origenColumnGroup: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    justifyContent: "space-between",
  },
  origenHeaderBanner: {
    backgroundColor: "#024885",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  origenHeaderText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    flex: 1,
  },
  origenBadgeCount: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  origenBadgeCountText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  cardsSubGrid: {
    flex: 1,
    justifyContent: "flex-start",
  },
  dashboardCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    justifyContent: "flex-start",
  },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 10 },
  barGroup: { marginBottom: 12 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  labelRowClickable: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    backgroundColor: "#f8fafc",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    maxWidth: "70%",
  },
  itemLabelLink: {
    fontSize: 11,
    fontWeight: "700",
    color: MJM_BLUE,
    maxWidth: "68%",
  },
  badgeItemValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ffffff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  itemValueText: { fontSize: 10, fontWeight: "800" },
  itemValue: { fontSize: 11, fontWeight: "bold" },
  barBackground: {
    width: "100%",
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    height: 5,
    overflow: "hidden",
    marginTop: 2,
  },
  verMasButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#f8fafc",
  },
  verMasText: { fontSize: 11, fontWeight: "700" },
  emptyText: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "92%",
    maxWidth: 400,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
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
    fontSize: 15,
    fontWeight: "bold",
    color: MJM_BLUE,
    marginTop: 2,
  },
  closeButton: { padding: 6, backgroundColor: "#f1f5f9", borderRadius: 10 },
  modalItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  modalItemRowClickable: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    marginBottom: 6,
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
    fontWeight: "700",
    color: MJM_BLUE,
    flex: 1,
  },
  modalItemVal: { fontSize: 11, fontWeight: "800", color: "#16a34a" },
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
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  turnoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MJM_BLUE + "12",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 6,
    borderWidth: 1,
    borderColor: MJM_BLUE + "25",
  },
  turnoBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: MJM_BLUE,
    marginLeft: 4,
  },
  modalCloseFooterText: { color: "white", fontSize: 12, fontWeight: "bold" },
});