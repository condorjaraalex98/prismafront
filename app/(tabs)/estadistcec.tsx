import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";
const MJM_BLUE = "#024885";

interface EvolucionItem {
  fecha?: string;
  dia: number;
  turno?: string;
  total: number;
}

interface MatrizItem {
  usuario: string;
  dia: number;
  turno?: string;
  total: number;
}

interface TotalesMes {
  total_mes: number;
  total_mañana: number;
  total_tarde: number;
  total_noche: number;
}

interface ModalidadItem {
  id: number;
  nombre: string;
}

interface OrigenItem {
  id_origen: number;
  descripcion: string;
}

const MESES = [
  { label: "Enero", value: 1 },
  { label: "Febrero", value: 2 },
  { label: "Marzo", value: 3 },
  { label: "Abril", value: 4 },
  { label: "Mayo", value: 5 },
  { label: "Junio", value: 6 },
  { label: "Julio", value: 7 },
  { label: "Agosto", value: 8 },
  { label: "Setiembre", value: 9 },
  { label: "Octubre", value: 10 },
  { label: "Noviembre", value: 11 },
  { label: "Diciembre", value: 12 },
];

const GRUPOS_MOSAICO = [
  { label: "TODOS", value: null as string | null },
  { label: "G1", value: "1" },
  { label: "G2", value: "2" },
  { label: "G3", value: "3" },
  { label: "G4", value: "4" },
];

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const TURNO_COLORS: Record<string, string> = {
  M: "#0284c7",
  T: "#d97706",
  N: "#475569",
};

const CHART_HEIGHT = 155;
const CHART_TOP_PAD = 32;
const CHART_BOTTOM_PAD = 14;

export default function GraficoEstadisticasScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [evolucionDiaria, setEvolucionDiaria] = useState<EvolucionItem[]>([]);
  const [matrizUsuarios, setMatrizUsuarios] = useState<MatrizItem[]>([]);
  const [totalesMes, setTotalesMes] = useState<TotalesMes>({
    total_mes: 0,
    total_mañana: 0,
    total_tarde: 0,
    total_noche: 0,
  });
  const [modalidadesCatalogo, setModalidadesCatalogo] = useState<
    ModalidadItem[]
  >([]);
  const [origenesCatalogo, setOrigenesCatalogo] = useState<OrigenItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [vistaActual, setVistaActual] = useState<"grafico" | "matriz">(
    "grafico"
  );

  const [mesSeleccionado, setMesSeleccionado] = useState<number>(
    new Date().getMonth() + 1
  );
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(
    new Date().getFullYear()
  );
  const [modalidadFiltro, setModalidadFiltro] = useState<number | null>(null);
  const [origenFiltro, setOrigenFiltro] = useState<number | null>(null);
  const [grupoFiltro, setGrupoFiltro] = useState<string | null>(null);

  const [busquedaInput, setBusquedaInput] = useState<string>("");
  const [busquedaQuery, setBusquedaQuery] = useState<string>("");

  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [totalUsuariosServidor, setTotalUsuariosServidor] = useState<number>(0);

  const [modalMesVisible, setModalMesVisible] = useState(false);
  const [modalModalidadVisible, setModalModalidadVisible] = useState(false);
  const [modalOrigenVisible, setModalOrigenVisible] = useState(false);

  const [diaSeleccionadoTooltip, setDiaSeleccionadoTooltip] = useState<
    number | null
  >(null);
  const [hoveredUsuario, setHoveredUsuario] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const isMountedRef = useRef(true);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      fetchAbortRef.current?.abort();
    };
  }, []);

  const fetchEstadisticasMensuales = useCallback(
    async (pageToFetch = 1, append = false, query = "") => {
      if (append && loadingMoreRef.current) return;

      if (!append) {
        fetchAbortRef.current?.abort();
      }
      const controller = new AbortController();
      if (!append) fetchAbortRef.current = controller;
      const timer = setTimeout(() => controller.abort(), 15000);

      try {
        if (append) {
          loadingMoreRef.current = true;
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        let url = `${API_URL}/ocurrencias/estadisticas-mensuales3?mes=${mesSeleccionado}&anio=${anioSeleccionado}&modo=turnos&origenes=1,5,6,7,11&page=${pageToFetch}&limit=10`;

        if (modalidadFiltro) url += `&id_modalidad=${modalidadFiltro}`;
        if (origenFiltro) url += `&id_origen=${origenFiltro}`;
        if (grupoFiltro) url += `&grupo=${grupoFiltro}`;
        if (query.trim() !== "") {
          url += `&busqueda=${encodeURIComponent(query.trim())}`;
        }

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (!isMountedRef.current) return;

        setEvolucionDiaria(data.evolucion_diaria_turnos || []);

        if (append) {
          setMatrizUsuarios((prev) => [
            ...prev,
            ...(data.matriz_usuarios || []),
          ]);
        } else {
          setMatrizUsuarios(data.matriz_usuarios || []);
        }

        setTotalUsuariosServidor(data.total_usuarios_count || 0);
        setTotalesMes(
          data.totales_mes || {
            total_mes: 0,
            total_mañana: 0,
            total_tarde: 0,
            total_noche: 0,
          }
        );
        setModalidadesCatalogo(data.modalidades_catalogo || []);
        setOrigenesCatalogo(data.origenes_catalogo || []);
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        console.error("Error al cargar estadísticas mensuales:", error);
      } finally {
        clearTimeout(timer);
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
        loadingMoreRef.current = false;
      }
    },
    [mesSeleccionado, anioSeleccionado, modalidadFiltro, origenFiltro, grupoFiltro]
  );

  useEffect(() => {
    setPaginaActual(1);
    setDiaSeleccionadoTooltip(null);
    fetchEstadisticasMensuales(1, false, busquedaQuery);
  }, [
    mesSeleccionado,
    anioSeleccionado,
    modalidadFiltro,
    origenFiltro,
    grupoFiltro,
    busquedaQuery,
    fetchEstadisticasMensuales,
  ]);

  const onRefresh = () => {
    setRefreshing(true);
    setPaginaActual(1);
    fetchEstadisticasMensuales(1, false, busquedaQuery);
  };

  const limpiarFiltros = () => {
    setModalidadFiltro(null);
    setOrigenFiltro(null);
    setGrupoFiltro(null);
    setBusquedaInput("");
    setBusquedaQuery("");
    setPaginaActual(1);
  };

  const diasEnMes = new Date(anioSeleccionado, mesSeleccionado, 0).getDate();
  const diasArray = useMemo(
    () => Array.from({ length: diasEnMes }, (_, i) => i + 1),
    [diasEnMes]
  );

  const usuariosUnicosCargados = useMemo(() => {
    const mapaTotales: Record<string, number> = {};
    matrizUsuarios.forEach((item) => {
      mapaTotales[item.usuario] =
        (mapaTotales[item.usuario] || 0) + Number(item.total || 0);
    });

    return Array.from(new Set(matrizUsuarios.map((item) => item.usuario))).sort(
      (a, b) => (mapaTotales[b] || 0) - (mapaTotales[a] || 0)
    );
  }, [matrizUsuarios]);

  const hayMasUsuariosEnServidor =
    usuariosUnicosCargados.length < totalUsuariosServidor;

  const maxTotalDiario = useMemo(() => {
    if (evolucionDiaria.length === 0) return 1;
    const max = Math.max(
      ...diasArray.map((dia) =>
        evolucionDiaria
          .filter((e) => Number(e.dia) === dia)
          .reduce((acc, curr) => acc + Number(curr.total || 0), 0)
      )
    );
    return max > 0 ? max : 1;
  }, [diasArray, evolucionDiaria]);

  const calculatedPoints = useMemo(() => {
    const count = diasArray.length;
    if (count === 0 || containerWidth === 0) return [];

    const colWidth = containerWidth / count;
    const usableHeight = CHART_HEIGHT - CHART_TOP_PAD - CHART_BOTTOM_PAD;

    return diasArray.map((dia, index) => {
      const totalDia = evolucionDiaria
        .filter((e) => Number(e.dia) === dia)
        .reduce((acc, curr) => acc + Number(curr.total || 0), 0);

      const x = (index + 0.5) * colWidth;
      const y =
        CHART_HEIGHT -
        CHART_BOTTOM_PAD -
        (totalDia / maxTotalDiario) * usableHeight;

      return { x, y, total: totalDia, dia };
    });
  }, [diasArray, evolucionDiaria, maxTotalDiario, containerWidth]);

  const svgPolylinePoints = useMemo(
    () => calculatedPoints.map((p) => `${p.x},${p.y}`).join(" "),
    [calculatedPoints]
  );

  const onLayoutChartContainer = (event: LayoutChangeEvent) => {
    const { width: w } = event.nativeEvent.layout;
    if (w > 0 && w !== containerWidth) {
      setContainerWidth(w);
    }
  };

  const nombreMesActual =
    MESES.find((m) => m.value === mesSeleccionado)?.label || "";
  const hayFiltrosActivos =
    modalidadFiltro !== null ||
    origenFiltro !== null ||
    grupoFiltro !== null ||
    busquedaInput.length > 0;

  return (
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
        {/* ENCABEZADO */}
        <View style={styles.headerContainer}>
          <View>
            <ThemedText style={styles.mainTitle}>
              TOTAL GENERAL: {totalesMes.total_mes} OCURRENCIAS
            </ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              MONITOREO Y CONTROL • POR TURNOS
              {grupoFiltro ? ` • GRUPO ${grupoFiltro}` : ""}
            </ThemedText>
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

        {/* TODOS LOS FILTROS + MOSAICO DE GRUPO EN UNA SOLA FILA */}
        <View style={styles.filterCard}>
          <View style={styles.singleFilterRow}>
            <TouchableOpacity
              style={[styles.filterChip, styles.chipMes]}
              onPress={() => setModalMesVisible(true)}
            >
              <Ionicons name="calendar" size={13} color="#0284c7" />
              <ThemedText
                style={[styles.filterChipText, styles.textMes]}
                numberOfLines={1}
              >
                {nombreMesActual} {anioSeleccionado}
              </ThemedText>
              <Ionicons name="chevron-down" size={12} color="#0284c7" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                styles.chipMes,
                modalidadFiltro !== null && styles.filterChipActiveRed,
              ]}
              onPress={() => setModalModalidadVisible(true)}
            >
              <Ionicons
                name="shield"
                size={13}
                color={modalidadFiltro !== null ? "white" : "#0284c7"}
              />
              <ThemedText
                style={[
                  styles.filterChipText,
                  styles.textMes,
                  modalidadFiltro !== null && { color: "white" },
                ]}
                numberOfLines={1}
              >
                {modalidadFiltro
                  ? modalidadesCatalogo.find((m) => m.id === modalidadFiltro)
                      ?.nombre || "Modalidad"
                  : "Modalidad"}
              </ThemedText>
              <Ionicons
                name="chevron-down"
                size={12}
                color={modalidadFiltro !== null ? "white" : "#0284c7"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                styles.chipMes,
                origenFiltro !== null && styles.filterChipActiveRed,
              ]}
              onPress={() => setModalOrigenVisible(true)}
            >
              <Ionicons
                name="git-branch"
                size={13}
                color={origenFiltro !== null ? "white" : "#0284c7"}
              />
              <ThemedText
                style={[
                  styles.filterChipText,
                  styles.textMes,
                  origenFiltro !== null && { color: "white" },
                ]}
                numberOfLines={1}
              >
                {origenFiltro
                  ? origenesCatalogo.find((o) => o.id_origen === origenFiltro)
                      ?.descripcion || "Origen"
                  : "Origen"}
              </ThemedText>
              <Ionicons
                name="chevron-down"
                size={12}
                color={origenFiltro !== null ? "white" : "#0284c7"}
              />
            </TouchableOpacity>

            {/* MOSAICO DE GRUPO (1, 2, 3, 4) */}
            <View style={styles.grupoMosaicRow}>
              {GRUPOS_MOSAICO.map((g) => {
                const activo = grupoFiltro === g.value;
                return (
                  <TouchableOpacity
                    key={g.label}
                    onPress={() => setGrupoFiltro(g.value)}
                    style={[
                      styles.grupoMosaicChip,
                      activo && styles.grupoMosaicChipActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <ThemedText
                      style={[
                        styles.grupoMosaicText,
                        activo && styles.grupoMosaicTextActive,
                      ]}
                    >
                      {g.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {vistaActual === "matriz" && (
              <View style={styles.searchInlineContainer}>
                <Ionicons name="search" size={13} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar personal..."
                  placeholderTextColor="#94a3b8"
                  value={busquedaInput ?? ""}
                  onChangeText={setBusquedaInput}
                  onSubmitEditing={() => setBusquedaQuery(busquedaInput)}
                  returnKeyType="search"
                />
                {busquedaInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setBusquedaInput("");
                      setBusquedaQuery("");
                    }}
                  >
                    <Ionicons name="close-circle" size={14} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {hayFiltrosActivos && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={limpiarFiltros}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={13}
                  color="#ef4444"
                />
                <ThemedText style={styles.clearFiltersText}>Limpiar</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* SELECTOR DE VISTA */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              vistaActual === "grafico" && styles.tabActive,
            ]}
            onPress={() => setVistaActual("grafico")}
          >
            <Ionicons
              name="bar-chart-outline"
              size={16}
              color={vistaActual === "grafico" ? "white" : MJM_BLUE}
            />
            <ThemedText
              style={[
                styles.tabText,
                vistaActual === "grafico" && styles.tabTextActive,
              ]}
            >
              Gráfica Diaria
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              vistaActual === "matriz" && styles.tabActive,
            ]}
            onPress={() => setVistaActual("matriz")}
          >
            <Ionicons
              name="grid-outline"
              size={16}
              color={vistaActual === "matriz" ? "white" : MJM_BLUE}
            />
            <ThemedText
              style={[
                styles.tabText,
                vistaActual === "matriz" && styles.tabTextActive,
              ]}
            >
              Matriz del Mes
            </ThemedText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={MJM_BLUE}
            style={{ marginVertical: 40 }}
          />
        ) : vistaActual === "grafico" ? (
          /* VISTA 1: GRÁFICO DIARIO */
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up-outline" size={16} color={MJM_BLUE} />
              <ThemedText style={styles.sectionTitleText}>
                Registro Diario ({nombreMesActual} {anioSeleccionado})
              </ThemedText>
            </View>
            <View style={styles.divider} />

            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: TURNO_COLORS.M }]}
                />
                <ThemedText style={styles.legendText}>Mañana (M)</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: TURNO_COLORS.T }]}
                />
                <ThemedText style={styles.legendText}>Tarde (T)</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: TURNO_COLORS.N }]}
                />
                <ThemedText style={styles.legendText}>Noche (N)</ThemedText>
              </View>
            </View>

            {evolucionDiaria.length > 0 ? (
              <View
                onLayout={onLayoutChartContainer}
                style={styles.chartWrapper}
              >
                {containerWidth > 0 && (
                  <Svg
                    width={containerWidth}
                    height={CHART_HEIGHT}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                    }}
                  >
                    <Polyline
                      points={svgPolylinePoints}
                      fill="none"
                      stroke={MJM_BLUE}
                      strokeWidth="1.8"
                      strokeOpacity="0.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {calculatedPoints.map((p, idx) => (
                      <Circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={p.total > 0 ? "4" : "0"}
                        fill={MJM_BLUE}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    ))}
                  </Svg>
                )}

                <View style={styles.valuesOverlayContainer}>
                  {calculatedPoints.map((p, idx) => (
                    <View key={idx} style={styles.valueLabelColumn}>
                      {p.total > 0 ? (
                        <View
                          style={[
                            styles.barValueBadge,
                            { top: Math.max(p.y - 23, 2) },
                          ]}
                        >
                          <ThemedText
                            style={styles.barValueText}
                            numberOfLines={1}
                          >
                            {p.total}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>

                <View style={styles.fullWidthChartContainer}>
                  {diasArray.map((dia) => {
                    const registrosDia = evolucionDiaria.filter(
                      (e) => Number(e.dia) === dia
                    );
                    const totalDia = registrosDia.reduce(
                      (acc, curr) => acc + Number(curr.total || 0),
                      0
                    );
                    const fechaObj = new Date(
                      anioSeleccionado,
                      mesSeleccionado - 1,
                      dia
                    );
                    const nombreDiaSemana = DIAS_SEMANA[fechaObj.getDay()];
                    const isSelected = diaSeleccionadoTooltip === dia;

                    return (
                      <TouchableOpacity
                        key={dia}
                        style={[
                          styles.barColumnFull,
                          isSelected && styles.barColumnSelected,
                        ]}
                        activeOpacity={0.7}
                        onPress={() =>
                          setDiaSeleccionadoTooltip(isSelected ? null : dia)
                        }
                      >
                        <View style={styles.barTrack}>
                          {registrosDia.length > 0 ? (
                            <View style={styles.barStackContainer}>
                              {registrosDia.map((reg, idx) => {
                                const alturaPorcentaje =
                                  (Number(reg.total) / maxTotalDiario) * 100;
                                const colorTurno =
                                  TURNO_COLORS[reg.turno || "M"] || MJM_BLUE;
                                return (
                                  <View
                                    key={idx}
                                    style={{
                                      width: "100%",
                                      height: `${alturaPorcentaje}%`,
                                      backgroundColor: colorTurno,
                                      borderTopWidth: 0.5,
                                      borderColor: "#ffffff",
                                    }}
                                  />
                                );
                              })}
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.barFill,
                                {
                                  height: `${Math.min(
                                    (totalDia / maxTotalDiario) * 100,
                                    100
                                  )}%`,
                                },
                              ]}
                            />
                          )}
                        </View>

                        <View style={styles.labelContainerFull}>
                          <ThemedText
                            style={[
                              styles.barLabelNumber,
                              isSelected && {
                                color: MJM_BLUE,
                                fontWeight: "900",
                              },
                            ]}
                          >
                            {dia}
                          </ThemedText>
                          <ThemedText style={styles.barLabelDay}>
                            {nombreDiaSemana}
                          </ThemedText>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <ThemedText style={styles.emptyText}>
                No hay registros para este periodo.
              </ThemedText>
            )}

            {diaSeleccionadoTooltip !== null && (
              <View style={styles.tooltipCard}>
                <View style={styles.tooltipHeader}>
                  <ThemedText style={styles.tooltipTitle}>
                    Detalle del día {diaSeleccionadoTooltip} de{" "}
                    {nombreMesActual}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setDiaSeleccionadoTooltip(null)}
                  >
                    <Ionicons name="close" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
                {evolucionDiaria
                  .filter((e) => Number(e.dia) === diaSeleccionadoTooltip)
                  .map((item, idx) => (
                    <ThemedText key={idx} style={styles.tooltipText}>
                      {item.turno ? `Turno [${item.turno}]:` : "Total:"}{" "}
                      {item.total} ocurrencias
                    </ThemedText>
                  ))}
              </View>
            )}

            <ThemedText style={styles.chartTip}>
              💡 Toca cualquier barra para ver el detalle exacto del día
            </ThemedText>
          </View>
        ) : (
          /* VISTA 2: MATRIZ DEL MES */
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="grid-outline" size={16} color={MJM_BLUE} />
              <ThemedText style={styles.sectionTitleText}>
                Matriz de Productividad (Mostrando{" "}
                {usuariosUnicosCargados.length} de {totalUsuariosServidor})
              </ThemedText>
            </View>
            <View style={styles.divider} />

            {usuariosUnicosCargados.length > 0 ? (
              <ScrollView
                horizontal={!isDesktop}
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={{ minWidth: "100%", flexGrow: 1 }}
              >
                <View style={{ width: "100%" }}>
                  <View style={styles.matrixRow}>
                    <View
                      style={[
                        styles.matrixCell,
                        styles.matrixHeaderColFixed,
                        { width: isDesktop ? 210 : 145 },
                      ]}
                    >
                      <ThemedText style={styles.matrixHeaderText}>
                        Personal
                      </ThemedText>
                    </View>
                    {diasArray.map((dia) => (
                      <View
                        key={dia}
                        style={[styles.matrixCell, styles.matrixHeaderColDay]}
                      >
                        <ThemedText style={styles.matrixDayHeaderText}>
                          {dia}
                        </ThemedText>
                      </View>
                    ))}
                    <View
                      style={[styles.matrixCell, styles.matrixHeaderColTotal]}
                    >
                      <ThemedText style={styles.matrixHeaderText}>
                        TOT
                      </ThemedText>
                    </View>
                  </View>

                  {usuariosUnicosCargados.map((usuario, uIndex) => {
                    let totalFilaUsuario = 0;
                    const estaHover = hoveredUsuario === usuario;

                    return (
                      <View key={uIndex} style={styles.matrixRow}>
                        <View
                          style={[
                            styles.matrixCell,
                            styles.matrixColFixed,
                            {
                              width: isDesktop ? 210 : 145,
                              position: "relative",
                              zIndex: estaHover ? 50 : 1,
                            },
                          ]}
                          {...(Platform.OS === "web"
                            ? ({
                                title: usuario,
                                onMouseEnter: () => setHoveredUsuario(usuario),
                                onMouseLeave: () => setHoveredUsuario(null),
                              } as any)
                            : {})}
                        >
                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={{ width: "100%" }}
                            onPress={() => {
                              if (Platform.OS !== "web") {
                                Alert.alert("Personal", usuario);
                              }
                            }}
                          >
                            <ThemedText
                              style={styles.matrixUserText}
                              numberOfLines={1}
                            >
                              {usuario}
                            </ThemedText>
                          </TouchableOpacity>

                          {Platform.OS === "web" && estaHover && (
                            <View style={styles.hoverUserTooltip}>
                              <ThemedText style={styles.hoverUserTooltipText}>
                                {usuario}
                              </ThemedText>
                            </View>
                          )}
                        </View>

                        {diasArray.map((dia) => {
                          const itemsEncontrados = matrizUsuarios.filter(
                            (m) => m.usuario === usuario && Number(m.dia) === dia
                          );
                          const cantidadTotal = itemsEncontrados.reduce(
                            (acc, curr) => acc + Number(curr.total || 0),
                            0
                          );
                          totalFilaUsuario += cantidadTotal;

                          return (
                            <View
                              key={dia}
                              style={[
                                styles.matrixCell,
                                styles.matrixColDay,
                                cantidadTotal > 0 && {
                                  backgroundColor: "#eff6ff",
                                },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.matrixValueText,
                                  cantidadTotal > 0 && {
                                    color: MJM_BLUE,
                                    fontWeight: "bold",
                                  },
                                ]}
                              >
                                {cantidadTotal > 0 ? cantidadTotal : "-"}
                              </ThemedText>
                            </View>
                          );
                        })}

                        <View
                          style={[
                            styles.matrixCell,
                            styles.matrixColTotal,
                            { backgroundColor: "#f8fafc" },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.matrixValueText,
                              { fontWeight: "900", color: MJM_BLUE },
                            ]}
                          >
                            {totalFilaUsuario}
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })}

                  <View style={styles.matrixRow}>
                    <View
                      style={[
                        styles.matrixCell,
                        styles.matrixColFixed,
                        {
                          width: isDesktop ? 210 : 145,
                          backgroundColor: "#f1f5f9",
                        },
                      ]}
                    >
                      <ThemedText
                        style={[styles.matrixHeaderText, { textAlign: "left" }]}
                      >
                        TOTAL DÍA
                      </ThemedText>
                    </View>
                    {diasArray.map((dia) => {
                      const totalColumnaDia = matrizUsuarios
                        .filter((m) => Number(m.dia) === dia)
                        .reduce((acc, curr) => acc + Number(curr.total || 0), 0);

                      return (
                        <View
                          key={dia}
                          style={[
                            styles.matrixCell,
                            styles.matrixColDay,
                            { backgroundColor: "#f1f5f9" },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.matrixValueText,
                              { fontWeight: "bold", color: "#0f172a" },
                            ]}
                          >
                            {totalColumnaDia > 0 ? totalColumnaDia : "-"}
                          </ThemedText>
                        </View>
                      );
                    })}
                    <View
                      style={[
                        styles.matrixCell,
                        styles.matrixColTotal,
                        { backgroundColor: "#e2e8f0" },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.matrixValueText,
                          { fontWeight: "900", color: "#0f172a" },
                        ]}
                      >
                        {totalesMes.total_mes}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </ScrollView>
            ) : (
              <ThemedText style={styles.emptyText}>
                No se encontró personal con ese filtro.
              </ThemedText>
            )}

            {hayMasUsuariosEnServidor && (
              <TouchableOpacity
                style={[styles.loadMoreButton, { opacity: loadingMore ? 0.6 : 1 }]}
                disabled={loadingMore}
                onPress={() => {
                  const siguientePagina = paginaActual + 1;
                  setPaginaActual(siguientePagina);
                  fetchEstadisticasMensuales(
                    siguientePagina,
                    true,
                    busquedaQuery
                  );
                }}
                activeOpacity={0.8}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={MJM_BLUE} />
                ) : (
                  <Ionicons
                    name="chevron-down-circle-outline"
                    size={16}
                    color="#024885"
                  />
                )}
                <ThemedText style={styles.loadMoreText}>
                  Mostrar 10 más ({usuariosUnicosCargados.length} de{" "}
                  {totalUsuariosServidor})
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL PERIODO */}
      <Modal
        visible={modalMesVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalMesVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalMesVisible(false)}
          />
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              Seleccionar Periodo
            </ThemedText>
            <View style={styles.yearSelector}>
              <TouchableOpacity
                onPress={() => setAnioSeleccionado((a) => a - 1)}
                style={styles.yearButton}
              >
                <Ionicons name="chevron-back" size={16} color={MJM_BLUE} />
              </TouchableOpacity>
              <ThemedText style={styles.yearText}>{anioSeleccionado}</ThemedText>
              <TouchableOpacity
                onPress={() => setAnioSeleccionado((a) => a + 1)}
                style={styles.yearButton}
              >
                <Ionicons name="chevron-forward" size={16} color={MJM_BLUE} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 250 }}>
              {MESES.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[
                    styles.modalItem,
                    mesSeleccionado === m.value && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setMesSeleccionado(m.value);
                    setModalMesVisible(false);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.modalItemText,
                      mesSeleccionado === m.value && {
                        color: "white",
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {m.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalMesVisible(false)}
            >
              <ThemedText style={styles.modalCloseText}>Cancelar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL MODALIDAD */}
      <Modal
        visible={modalModalidadVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalModalidadVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalModalidadVisible(false)}
          />
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              Filtrar por Modalidad
            </ThemedText>
            <ScrollView style={{ maxHeight: 250 }}>
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  modalidadFiltro === null && styles.modalItemActive,
                ]}
                onPress={() => {
                  setModalidadFiltro(null);
                  setModalModalidadVisible(false);
                }}
              >
                <ThemedText
                  style={[
                    styles.modalItemText,
                    modalidadFiltro === null && {
                      color: "white",
                      fontWeight: "bold",
                    },
                  ]}
                >
                  Todas las Modalidades
                </ThemedText>
              </TouchableOpacity>
              {modalidadesCatalogo.map((mod) => (
                <TouchableOpacity
                  key={mod.id}
                  style={[
                    styles.modalItem,
                    modalidadFiltro === mod.id && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setModalidadFiltro(mod.id);
                    setModalModalidadVisible(false);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.modalItemText,
                      modalidadFiltro === mod.id && {
                        color: "white",
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {mod.nombre}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalModalidadVisible(false)}
            >
              <ThemedText style={styles.modalCloseText}>Cerrar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL ORIGEN */}
      <Modal
        visible={modalOrigenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOrigenVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalOrigenVisible(false)}
          />
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Filtrar por Origen</ThemedText>
            <ScrollView style={{ maxHeight: 250 }}>
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  origenFiltro === null && styles.modalItemActive,
                ]}
                onPress={() => {
                  setOrigenFiltro(null);
                  setModalOrigenVisible(false);
                }}
              >
                <ThemedText
                  style={[
                    styles.modalItemText,
                    origenFiltro === null && {
                      color: "white",
                      fontWeight: "bold",
                    },
                  ]}
                >
                  Todos los Orígenes
                </ThemedText>
              </TouchableOpacity>
              {origenesCatalogo.map((orig) => (
                <TouchableOpacity
                  key={orig.id_origen}
                  style={[
                    styles.modalItem,
                    origenFiltro === orig.id_origen && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setOrigenFiltro(orig.id_origen);
                    setModalOrigenVisible(false);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.modalItemText,
                      origenFiltro === orig.id_origen && {
                        color: "white",
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {orig.descripcion}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalOrigenVisible(false)}
            >
              <ThemedText style={styles.modalCloseText}>Cerrar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { paddingHorizontal: 15, paddingVertical: 16 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#024885",
    letterSpacing: 1.1,
  },
  sectionSubtitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 1.1,
    marginTop: 2,
  },
  refreshButton: {
    backgroundColor: "#024885",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    elevation: 2,
  },
  refreshButtonText: { color: "white", fontSize: 11, fontWeight: "bold" },

  filterCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  singleFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  filterChip: {
    flex: 1,
    minWidth: 105,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 3,
  },
  filterChipText: {
    fontSize: 9.5,
    fontWeight: "bold",
    flex: 1,
  },
  chipMes: {
    backgroundColor: "#e0f2fe",
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  textMes: {
    color: "#0369a1",
  },
  filterChipActiveRed: {
    backgroundColor: MJM_BLUE,
    borderColor: MJM_BLUE,
  },
  grupoMosaicRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 2,
    gap: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  grupoMosaicChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  grupoMosaicChipActive: {
    backgroundColor: MJM_BLUE,
  },
  grupoMosaicText: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#475569",
  },
  grupoMosaicTextActive: {
    color: "#ffffff",
  },
  searchInlineContainer: {
    flex: 1.2,
    minWidth: 135,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    height: 33,
    gap: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: "#334155",
  },
  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
    gap: 3,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  clearFiltersText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ef4444",
  },

  tabSelector: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: "#024885", elevation: 2 },
  tabText: { fontSize: 11, fontWeight: "bold", color: "#024885" },
  tabTextActive: { color: "white" },

  sectionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#024885",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#024885",
  },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 10 },
  emptyText: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 20,
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 9,
    color: "#475569",
    fontWeight: "600",
  },

  /* GRÁFICO DIARIO */
  chartWrapper: {
    height: 195,
    width: "100%",
    position: "relative",
    justifyContent: "flex-end",
  },
  valuesOverlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    zIndex: 5,
    pointerEvents: "none",
  },
  valueLabelColumn: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  barValueBadge: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  barValueText: {
    fontSize: 9,
    color: MJM_BLUE,
    fontWeight: "bold",
    textAlign: "center",
  },
  fullWidthChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 155,
    width: "100%",
    justifyContent: "space-between",
  },
  barColumnFull: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
    paddingHorizontal: 2,
    borderRadius: 6,
  },
  barColumnSelected: {
    backgroundColor: "#e0f2fe",
  },
  barTrack: {
    width: "70%",
    maxWidth: 12,
    height: 105,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barStackContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    backgroundColor: MJM_BLUE,
    borderRadius: 3,
  },
  labelContainerFull: {
    alignItems: "center",
    marginTop: 4,
    width: "100%",
  },
  barLabelNumber: {
    fontSize: 8,
    color: "#334155",
    fontWeight: "700",
  },
  barLabelDay: {
    fontSize: 8.5,
    color: "#475569",
    fontWeight: "700",
    textTransform: "lowercase",
  },
  chartTip: {
    fontSize: 9,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 10,
    fontStyle: "italic",
  },
  tooltipCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  tooltipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  tooltipTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: MJM_BLUE,
  },
  tooltipText: {
    fontSize: 9,
    color: "#334155",
    marginTop: 2,
  },

  /* MATRIZ */
  matrixRow: { flexDirection: "row", width: "100%" },
  matrixCell: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 7,
    borderWidth: 0.5,
    borderColor: "#f1f5f9",
  },
  matrixHeaderColFixed: {
    backgroundColor: "#f1f5f9",
    alignItems: "flex-start",
    paddingLeft: 8,
  },
  matrixHeaderColDay: {
    flex: 1,
    minWidth: 16,
    backgroundColor: "#f1f5f9",
  },
  matrixHeaderColTotal: { width: 38, backgroundColor: "#e2e8f0" },
  matrixColFixed: {
    alignItems: "flex-start",
    paddingHorizontal: 8,
    backgroundColor: "#ffffff",
  },
  matrixColDay: { flex: 1, minWidth: 16 },
  matrixColTotal: { width: 38 },
  matrixHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#334155",
    textAlign: "center",
  },
  matrixDayHeaderText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#334155",
    textAlign: "center",
  },
  matrixUserText: { fontSize: 10, fontWeight: "600", color: "#334155" },
  matrixValueText: { fontSize: 8.5, color: "#64748b", textAlign: "center" },
  hoverUserTooltip: {
    position: "absolute",
    top: -28,
    left: 6,
    backgroundColor: "#0f172a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 999,
    elevation: 8,
  },
  hoverUserTooltipText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: "bold",
  },

  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  loadMoreText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#024885",
  },

  /* MODALES */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 320,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#024885",
    marginBottom: 12,
    textAlign: "center",
  },
  yearSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  yearButton: { padding: 4 },
  yearText: { fontSize: 12, fontWeight: "bold", color: "#334155" },
  modalItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  modalItemActive: { backgroundColor: MJM_BLUE },
  modalItemText: { fontSize: 11, color: "#334155" },
  modalCloseButton: {
    marginTop: 12,
    backgroundColor: "#e2e8f0",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseText: { fontSize: 11, fontWeight: "bold", color: "#334155" },
});