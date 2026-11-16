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
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";
const MJM_BLUE = "#024885";
const LIMIT_INICIAL = 5;
const PERMITIDOS_PATRULLAJE = [1, 2, 3, 4, 6, 8];

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

interface TipoPatrullajeItem {
  id_tipop: number | string;
  nombre: string;
}

interface TipoVehiculoItem {
  id_tipo_vehiculo: number | string;
  descripcion: string;
}

const TIPOS_VEHICULO_ESTATICOS: TipoVehiculoItem[] = [
  { id_tipo_vehiculo: 1, descripcion: "Camioneta" },
  { id_tipo_vehiculo: 4, descripcion: "Ambulancia" },
];

const obtenerTextoTurnoActual = (): string => {
  const ahora = new Date();
  const hora = ahora.getHours();
  const minutos = ahora.getMinutes();
  const tiempoMinutos = hora * 60 + minutos;

  if (tiempoMinutos >= 430 && tiempoMinutos < 900) {
    return "Turno Mañana (07:00 - 14:59)";
  } else if (tiempoMinutos >= 900 && tiempoMinutos < 1320) {
    return "Turno Tarde (15:00 - 21:59)";
  } else {
    return "Turno Noche (22:00 - 06:59)";
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
                  {showAll
                    ? "Ver menos"
                    : `Ver más (${datos.length - LIMIT_INICIAL} ocultos)`}
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
          <ThemedText style={styles.emptyText}>
            No hay registros en este turno.
          </ThemedText>
        )}
      </View>
    );
  }
);

export default function GraficoEstadisticasScreen() {
  const [estadisticasUsuarios, setEstadisticasUsuarios] = useState<EstadisticaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showAllUsuarios, setShowAllUsuarios] = useState<boolean>(false);

  const [tiposPatrullajeList, setTiposPatrullajeList] = useState<TipoPatrullajeItem[]>([]);
  const [filtroTipoPatrullaje, setFiltroTipoPatrullaje] = useState<string>("TODOS");
  const [totalesTipoPatrullaje, setTotalesTipoPatrullaje] = useState<Record<string, number>>({});
  const [totalGeneralPatrullaje, setTotalGeneralPatrullaje] = useState<number>(0);

  const [tiposVehiculoList] = useState<TipoVehiculoItem[]>(TIPOS_VEHICULO_ESTATICOS);
  const [filtroTipoVehiculo, setFiltroTipoVehiculo] = useState<string>("TODOS");

  const [selectedUserId, setSelectedUserId] = useState<number | string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [modalidadesUsuario, setModalidadesUsuario] = useState<ModalidadPorUsuario[]>([]);
  const [loadingUserModalidades, setLoadingUserModalidades] = useState<boolean>(false);

  const [selectedModalidad, setSelectedModalidad] = useState<string | null>(null);
  const [direccionesModalidad, setDireccionesModalidad] = useState<DireccionItem[]>([]);
  const [loadingDirecciones, setLoadingDirecciones] = useState<boolean>(false);

  const [textoTurno, setTextoTurno] = useState<string>(obtenerTextoTurnoActual());

  const isMountedRef = useRef(true);
  const statsAbortRef = useRef<AbortController | null>(null);
  const conteosAbortRef = useRef<AbortController | null>(null);
  const modalAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      statsAbortRef.current?.abort();
      conteosAbortRef.current?.abort();
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
        if (data.success && data.tipos_patrullaje) {
          const filtrados = data.tipos_patrullaje.filter((item: TipoPatrullajeItem) =>
            PERMITIDOS_PATRULLAJE.includes(Number(item.id_tipop))
          );
          setTiposPatrullajeList(filtrados);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Error cargando catálogos de filtros", err);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (filtroTipoPatrullaje !== "3") {
      setFiltroTipoVehiculo("TODOS");
    }
    setShowAllUsuarios(false);
  }, [filtroTipoPatrullaje]);

  // Mismo query string consistente para tarjeta principal y modales
  const construirQueryString = useCallback(
    (incluirSoloUsuarios = false) => {
      const params = new URLSearchParams();
      params.set("excluir_origenes", "1,5,6,7,11");
      if (incluirSoloUsuarios) params.set("solo_usuarios", "1");

      if (filtroTipoPatrullaje !== "TODOS") {
        params.set("id_tipop", filtroTipoPatrullaje);
        if (filtroTipoPatrullaje === "3") {
          if (filtroTipoVehiculo !== "TODOS") {
            params.set("id_tipo_vehiculo", filtroTipoVehiculo);
          } else {
            params.set("excluir_tipo_vehiculo", "2");
          }
        }
      } else {
        params.set("excluir_tipo_vehiculo", "2");
      }

      return `?${params.toString()}`;
    },
    [filtroTipoPatrullaje, filtroTipoVehiculo]
  );

  const fetchEstadisticas = useCallback(async () => {
    statsAbortRef.current?.abort();
    const controller = new AbortController();
    statsAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);

    setErrorMessage(null);
    try {
      const url = `${API_BASE_URL}/ocurrencias/estadisticas${construirQueryString(true)}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Error en la petición de datos");
      const data = await response.json();

      if (!isMountedRef.current) return;
      setEstadisticasUsuarios(data.por_usuario || []);
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
  }, [construirQueryString]);

  // Paralelizado con Promise.all (6x más rápido que el bucle for secuencial)
  const fetchConteoFiltros = useCallback(async () => {
    conteosAbortRef.current?.abort();
    const controller = new AbortController();
    conteosAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const respuestas = await Promise.all(
        PERMITIDOS_PATRULLAJE.map(async (idTipop) => {
          const params = new URLSearchParams();
          params.set("id_tipop", String(idTipop));
          params.set("excluir_origenes", "1,5,6,7,11");
          params.set("solo_usuarios", "1");

          if (String(idTipop) === "3") {
            if (filtroTipoVehiculo !== "TODOS") {
              params.set("id_tipo_vehiculo", filtroTipoVehiculo);
            } else {
              params.set("excluir_tipo_vehiculo", "2");
            }
          }

          const res = await fetch(
            `${API_BASE_URL}/ocurrencias/estadisticas?${params.toString()}`,
            { signal: controller.signal }
          );
          if (!res.ok) return { idTipop: String(idTipop), total: 0 };
          const data = await res.json();
          const porUsuario: EstadisticaItem[] = data.por_usuario || [];
          const totalTipo = porUsuario.reduce(
            (acc, item) => acc + Number(item.value || 0),
            0
          );
          return { idTipop: String(idTipop), total: totalTipo };
        })
      );

      if (!isMountedRef.current) return;
      const nuevosTotales: Record<string, number> = {};
      let sumaTotal = 0;
      for (const r of respuestas) {
        nuevosTotales[r.idTipop] = r.total;
        sumaTotal += r.total;
      }

      setTotalesTipoPatrullaje(nuevosTotales);
      setTotalGeneralPatrullaje(sumaTotal);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error obteniendo conteos de filtros", error);
      }
    } finally {
      clearTimeout(timer);
    }
  }, [filtroTipoVehiculo]);

  useEffect(() => {
    fetchEstadisticas();
  }, [fetchEstadisticas]);

  useEffect(() => {
    fetchConteoFiltros();
  }, [fetchConteoFiltros]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEstadisticas();
    fetchConteoFiltros();
  }, [fetchEstadisticas, fetchConteoFiltros]);

  const handleSelectUser = useCallback(
    async (idUsuario: number | string, nombreUsuario: string) => {
      modalAbortRef.current?.abort();
      const controller = new AbortController();
      modalAbortRef.current = controller;

      setSelectedUserId(idUsuario);
      setSelectedUser(nombreUsuario);
      setSelectedModalidad(null);
      setLoadingUserModalidades(true);

      try {
        const qs = construirQueryString(false);
        const url = `${API_BASE_URL}/ocurrencias/modalidades-por-usuario${qs}&id_usuario=${encodeURIComponent(
          String(idUsuario)
        )}`;

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
    [construirQueryString]
  );

  const handleSelectModalidad = useCallback(
    async (nombreModalidad: string) => {
      if (!selectedUserId) return;
      modalAbortRef.current?.abort();
      const controller = new AbortController();
      modalAbortRef.current = controller;

      setSelectedModalidad(nombreModalidad);
      setLoadingDirecciones(true);

      try {
        const qs = construirQueryString(false);
        const url = `${API_BASE_URL}/ocurrencias/detalle-por-modalidad${qs}&id_usuario=${encodeURIComponent(
          String(selectedUserId)
        )}&modalidad=${encodeURIComponent(nombreModalidad)}`;

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
    [selectedUserId, construirQueryString]
  );

  const cerrarModal = useCallback(() => {
    modalAbortRef.current?.abort();
    setSelectedUserId(null);
    setSelectedUser(null);
    setSelectedModalidad(null);
    setModalidadesUsuario([]);
    setDireccionesModalidad([]);
  }, []);

  const totalUsuarios = useMemo(
    () =>
      estadisticasUsuarios.reduce(
        (acc, item) => acc + Number(item.value || 0),
        0
      ),
    [estadisticasUsuarios]
  );

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
              <View style={styles.tituloRow}>
                <ThemedText style={styles.mainTitle}>
                  DASHBOARD CAMPO GENERAL
                </ThemedText>
                <ThemedText style={styles.totalHeaderBadge}>
                  ({totalGeneralPatrullaje} reg.)
                </ThemedText>
              </View>

              <View style={styles.turnoBadge}>
                <Ionicons name="time-outline" size={12} color={MJM_BLUE} />
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
              <Ionicons name="refresh" size={16} color="white" />
              <ThemedText style={styles.refreshButtonText}>Actualizar</ThemedText>
            </TouchableOpacity>
          </View>

          {/* FILTROS SUPERIORES */}
          <View style={styles.filtrosContainer}>
            <ThemedText style={styles.filtroLabel}>
              Tipo de Patrullaje:
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.badgeScroll}
            >
              <TouchableOpacity
                style={[
                  styles.badge,
                  filtroTipoPatrullaje === "TODOS" && styles.badgeActive,
                ]}
                onPress={() => setFiltroTipoPatrullaje("TODOS")}
              >
                <ThemedText
                  style={[
                    styles.badgeText,
                    filtroTipoPatrullaje === "TODOS" && styles.badgeTextActive,
                  ]}
                >
                  Todos ({totalGeneralPatrullaje})
                </ThemedText>
              </TouchableOpacity>
              {tiposPatrullajeList.map((item) => {
                const countTipo =
                  totalesTipoPatrullaje[String(item.id_tipop)] ?? 0;
                return (
                  <TouchableOpacity
                    key={item.id_tipop}
                    style={[
                      styles.badge,
                      filtroTipoPatrullaje === String(item.id_tipop) &&
                        styles.badgeActive,
                    ]}
                    onPress={() => setFiltroTipoPatrullaje(String(item.id_tipop))}
                  >
                    <ThemedText
                      style={[
                        styles.badgeText,
                        filtroTipoPatrullaje === String(item.id_tipop) &&
                          styles.badgeTextActive,
                      ]}
                    >
                      {item.nombre} ({countTipo})
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filtroTipoPatrullaje === "3" && (
              <>
                <View style={{ height: 10 }} />
                <ThemedText style={styles.filtroLabel}>
                  Tipo de Vehículo (Detalle):
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.badgeScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.badge,
                      filtroTipoVehiculo === "TODOS" &&
                        styles.badgeActiveVehiculo,
                    ]}
                    onPress={() => setFiltroTipoVehiculo("TODOS")}
                  >
                    <ThemedText
                      style={[
                        styles.badgeText,
                        filtroTipoVehiculo === "TODOS" &&
                          styles.badgeTextActive,
                      ]}
                    >
                      Todos
                    </ThemedText>
                  </TouchableOpacity>
                  {tiposVehiculoList.map((item) => (
                    <TouchableOpacity
                      key={item.id_tipo_vehiculo}
                      style={[
                        styles.badge,
                        filtroTipoVehiculo === String(item.id_tipo_vehiculo) &&
                          styles.badgeActiveVehiculo,
                      ]}
                      onPress={() =>
                        setFiltroTipoVehiculo(String(item.id_tipo_vehiculo))
                      }
                    >
                      <ThemedText
                        style={[
                          styles.badgeText,
                          filtroTipoVehiculo ===
                            String(item.id_tipo_vehiculo) &&
                            styles.badgeTextActive,
                        ]}
                      >
                        {item.descripcion}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
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
              totalGeneral={totalUsuarios}
              showAll={showAllUsuarios}
              setShowAll={setShowAllUsuarios}
              isUserCard={true}
              loading={loading}
              onSelectUser={handleSelectUser}
            />
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
                        <ThemedText style={styles.modalItemLabelLink} numberOfLines={1}>
                          • {mod.modalidad}{" "}
                          <Ionicons
                            name="chevron-forward"
                            size={11}
                            color={MJM_BLUE}
                          />
                        </ThemedText>
                        <ThemedText style={styles.modalItemVal}>
                          {mod.cantidad} reg.
                        </ThemedText>
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
                          <ThemedText style={styles.modalItemLabel} numberOfLines={2}>
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
  tituloRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  totalHeaderBadge: {
    fontSize: 14,
    fontWeight: "900",
    color: MJM_BLUE,
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
  turnoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MJM_BLUE + "12",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  turnoBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: MJM_BLUE,
    marginLeft: 4,
  },
  modalCloseFooterText: { color: "white", fontSize: 12, fontWeight: "bold" },
  filtrosContainer: {
    backgroundColor: "white",
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filtroLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  badgeScroll: { flexDirection: "row", marginBottom: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    backgroundColor: "#f1f5f9",
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  badgeActive: { backgroundColor: MJM_BLUE, borderColor: MJM_BLUE },
  badgeActiveVehiculo: { backgroundColor: "#10b981", borderColor: "#10b981" },
  badgeText: { fontSize: 11, color: "#334155", fontWeight: "600" },
  badgeTextActive: { color: "white" },
});