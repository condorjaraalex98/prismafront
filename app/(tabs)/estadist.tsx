import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polyline, Circle } from "react-native-svg";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    LayoutChangeEvent,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";
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
  sum_por_orden_central: number;
  sum_control_fv_sv: number;
  sum_inyectable: number;
  sum_curacion_topica: number;
  sum_traslado_urgencia: number;
  sum_pertenece_muni: number;
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

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const TURNO_COLORS: { [key: string]: string } = {
  M: "#0284c7", // Mañana
  T: "#d97706", // Tarde
  N: "#475569", // Noche
};

export default function GraficoEstadisticasScreen() {
  const [evolucionDiaria, setEvolucionDiaria] = useState<EvolucionItem[]>([]);
  const [matrizUsuarios, setMatrizUsuarios] = useState<MatrizItem[]>([]);
  const [totalesMes, setTotalesMes] = useState<TotalesMes>({ 
    total_mes: 0, 
    total_mañana: 0, 
    total_tarde: 0, 
    total_noche: 0,
    sum_por_orden_central: 0,
    sum_control_fv_sv: 0,
    sum_inyectable: 0,
    sum_curacion_topica: 0,
    sum_traslado_urgencia: 0,
    sum_pertenece_muni: 0,
  });
  const [modalidadesCatalogo, setModalidadesCatalogo] = useState<ModalidadItem[]>([]);
  const [origenesCatalogo, setOrigenesCatalogo] = useState<OrigenItem[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [vistaActual, setVistaActual] = useState<"grafico" | "matriz">("grafico");
  
  const [modoReporte, setModoReporte] = useState<"turnos" | "normal">("turnos");

  const [mesSeleccionado, setMesSeleccionado] = useState<number>(new Date().getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(new Date().getFullYear());
  const [modalidadFiltro, setModalidadFiltro] = useState<number | null>(null);
  const [origenFiltro, setOrigenFiltro] = useState<number | null>(null);
  
  const [busquedaInput, setBusquedaInput] = useState<string>("");
  const [busquedaQuery, setBusquedaQuery] = useState<string>("");

  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [totalUsuariosServidor, setTotalUsuariosServidor] = useState<number>(0);

  const [modalMesVisible, setModalMesVisible] = useState(false);
  const [modalModalidadVisible, setModalModalidadVisible] = useState(false);
  const [modalOrigenVisible, setModalOrigenVisible] = useState(false);
  
  const [diaSeleccionadoTooltip, setDiaSeleccionadoTooltip] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [mostrarDetalleParamedico, setMostrarDetalleParamedico] = useState<boolean>(false);

  const fetchEstadisticasMensuales = useCallback(async (pageToFetch = 1, append = false, query = "") => {
    try {
      if (!append) setLoading(true);

      let url = `${API_URL}/ocurrencias/estadisticas-mensualespara?mes=${mesSeleccionado}&anio=${anioSeleccionado}&modo=${modoReporte}&page=${pageToFetch}&limit=10`;
      
      if (modalidadFiltro) url += `&id_modalidad=${modalidadFiltro}`;
      if (origenFiltro) url += `&id_origen=${origenFiltro}`;
      if (query.trim() !== "") url += `&busqueda=${encodeURIComponent(query.trim())}`;

      const response = await fetch(url);
      const data = await response.json();

      setEvolucionDiaria(data.evolucion_diaria_turnos || []);
      
      if (append) {
        setMatrizUsuarios(prev => [...prev, ...(data.matriz_usuarios || [])]);
      } else {
        setMatrizUsuarios(data.matriz_usuarios || []);
      }

      setTotalUsuariosServidor(data.total_usuarios_count || 0);
      setTotalesMes(data.totales_mes || { 
        total_mes: 0, 
        total_mañana: 0, 
        total_tarde: 0, 
        total_noche: 0,
        sum_por_orden_central: 0,
        sum_control_fv_sv: 0,
        sum_inyectable: 0,
        sum_curacion_topica: 0,
        sum_traslado_urgencia: 0,
        sum_pertenece_muni: 0,
      });
      setModalidadesCatalogo(data.modalidades_catalogo || []);
      setOrigenesCatalogo(data.origenes_catalogo || []);
    } catch (error) {
      console.error("Error al cargar estadísticas mensuales:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mesSeleccionado, anioSeleccionado, modalidadFiltro, origenFiltro, modoReporte]);

  useEffect(() => {
    setPaginaActual(1);
    fetchEstadisticasMensuales(1, false, busquedaQuery);
  }, [mesSeleccionado, anioSeleccionado, modalidadFiltro, origenFiltro, modoReporte, busquedaQuery, fetchEstadisticasMensuales]);

  const onRefresh = () => {
    setRefreshing(true);
    setPaginaActual(1);
    fetchEstadisticasMensuales(1, false, busquedaQuery);
  };

  const limpiarFiltros = () => {
    setModalidadFiltro(null);
    setOrigenFiltro(null);
    setBusquedaInput("");
    setBusquedaQuery("");
    setPaginaActual(1);
  };

  const diasEnMes = new Date(anioSeleccionado, mesSeleccionado, 0).getDate();
  const diasArray = useMemo(() => Array.from({ length: diasEnMes }, (_, i) => i + 1), [diasEnMes]);

  const usuariosUnicosCargados = useMemo(() => {
    const mapaTotales: { [usuario: string]: number } = {};
    
    matrizUsuarios.forEach((item) => {
      mapaTotales[item.usuario] = (mapaTotales[item.usuario] || 0) + Number(item.total || 0);
    });

    return Array.from(new Set(matrizUsuarios.map((item) => item.usuario))).sort(
      (a, b) => (mapaTotales[b] || 0) - (mapaTotales[a] || 0)
    );
  }, [matrizUsuarios]);

  const hayMasUsuariosEnServidor = usuariosUnicosCargados.length < totalUsuariosServidor;

  const maxTotalDiario = useMemo(() => {
    if (evolucionDiaria.length === 0) return 1;
    const max = Math.max(
      ...diasArray.map(dia => {
        return evolucionDiaria
          .filter(e => Number(e.dia) === dia)
          .reduce((acc, curr) => acc + Number(curr.total || 0), 0);
      })
    );
    return max > 0 ? max : 1;
  }, [diasArray, evolucionDiaria]);

  const CHART_HEIGHT = 140;

  // Puntos calculados en base al ancho dinámico del contenedor
  const calculatedPoints = useMemo(() => {
    const count = diasArray.length;
    if (count === 0 || containerWidth === 0) return [];

    const colWidth = containerWidth / count;
    
    return diasArray.map((dia, index) => {
      const totalDia = evolucionDiaria
        .filter((e) => Number(e.dia) === dia)
        .reduce((acc, curr) => acc + Number(curr.total || 0), 0);

      const x = (index + 0.5) * colWidth;
      // Invertimos Y con margen superior e inferior de 15px para evitar cortes
      const paddedHeight = CHART_HEIGHT - 30;
      const y = CHART_HEIGHT - 15 - (totalDia / maxTotalDiario) * paddedHeight;

      return { x, y, total: totalDia, dia };
    });
  }, [diasArray, evolucionDiaria, maxTotalDiario, containerWidth]);

  const svgPolylinePoints = useMemo(() => {
    return calculatedPoints.map((p) => `${p.x},${p.y}`).join(" ");
  }, [calculatedPoints]);

  const onLayoutChartContainer = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  };

  const nombreMesActual = MESES.find((m) => m.value === mesSeleccionado)?.label || "";
  const hayFiltrosActivos = modalidadFiltro !== null || origenFiltro !== null || busquedaInput.length > 0;

  return (
    <ThemedView style={styles.main}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MJM_BLUE} />
        }
      >
        {/* ENCABEZADO */}
        <View style={styles.headerContainer}>
          <View>
            <ThemedText style={styles.mainTitle}>TOTAL GENERAL: {totalesMes.total_mes} OCURRENCIAS</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>MONITOREO Y CONTROL</ThemedText>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.8}>
            <Ionicons name="refresh" size={16} color="white" />
            <ThemedText style={styles.refreshButtonText}>Actualizar</ThemedText>
          </TouchableOpacity>
        </View>

        {/* MODO DE REPORTE */}
        <View style={styles.modoSelectorContainer}>
          <TouchableOpacity
            style={[styles.modoButton, modoReporte === "turnos" && styles.modoButtonActive]}
            onPress={() => setModoReporte("turnos")}
          >
            <Ionicons name="time-outline" size={14} color={modoReporte === "turnos" ? "white" : MJM_BLUE} />
            <ThemedText style={[styles.modoText, modoReporte === "turnos" && styles.modoTextActive]}>
              Por Turnos
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modoButton, modoReporte === "normal" && styles.modoButtonActive]}
            onPress={() => setModoReporte("normal")}
          >
            <Ionicons name="calendar-number-outline" size={14} color={modoReporte === "normal" ? "white" : MJM_BLUE} />
            <ThemedText style={[styles.modoText, modoReporte === "normal" && styles.modoTextActive]}>
              Por Fecha Ocurrencia
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* FILTROS */}
        <View style={styles.filterCard}>
          <View style={styles.filterRow}>
            <TouchableOpacity style={[styles.filterChip, styles.chipMes]} onPress={() => setModalMesVisible(true)}>
              <Ionicons name="calendar" size={14} color="#0284c7" />
              <ThemedText style={[styles.filterChipText, styles.textMes]} numberOfLines={1}>
                {nombreMesActual} {anioSeleccionado}
              </ThemedText>
              <Ionicons name="chevron-down" size={12} color="#0284c7" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterChip, styles.chipMes, modalidadFiltro !== null && styles.filterChipActiveRed]} 
              onPress={() => setModalModalidadVisible(true)}
            >
              <Ionicons name="shield" size={14} color={modalidadFiltro !== null ? "white" : "#0284c7"} />
              <ThemedText style={[styles.filterChipText, styles.textMes, modalidadFiltro !== null && { color: "white" }]} numberOfLines={1}>
                {modalidadFiltro ? modalidadesCatalogo.find(m => m.id === modalidadFiltro)?.nombre || "Modalidad" : "Modalidad"}
              </ThemedText>
              <Ionicons name="chevron-down" size={12} color={modalidadFiltro !== null ? "white" : "#0284c7"} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterChip, styles.chipMes, origenFiltro !== null && styles.filterChipActiveRed]} 
              onPress={() => setModalOrigenVisible(true)}
            >
              <Ionicons name="git-branch" size={14} color={origenFiltro !== null ? "white" : "#0284c7"} />
              <ThemedText style={[styles.filterChipText, styles.textMes, origenFiltro !== null && { color: "white" }]} numberOfLines={1}>
                {origenFiltro ? origenesCatalogo.find(o => o.id_origen === origenFiltro)?.descripcion || "Origen" : "Origen"}
              </ThemedText>
              <Ionicons name="chevron-down" size={12} color={origenFiltro !== null ? "white" : "#0284c7"} />
            </TouchableOpacity>
          </View>

          {hayFiltrosActivos && (
            <View style={{ alignItems: "flex-end", marginTop: 6 }}>
              <TouchableOpacity style={styles.clearFiltersButton} onPress={limpiarFiltros} activeOpacity={0.8}>
                <Ionicons name="close-circle-outline" size={12} color="#ef4444" />
                <ThemedText style={styles.clearFiltersText}>Limpiar</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {vistaActual === "matriz" && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={14} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar personal (Presiona Enter)..."
                placeholderTextColor="#94a3b8"
                value={busquedaInput}
                onChangeText={setBusquedaInput}
                onSubmitEditing={() => setBusquedaQuery(busquedaInput)}
                returnKeyType="search"
              />
              {busquedaInput.length > 0 && (
                <TouchableOpacity onPress={() => { setBusquedaInput(""); setBusquedaQuery(""); }}>
                  <Ionicons name="close-circle" size={14} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* TARJETA DE RESUMEN: DETALLE PARAMÉDICO */}
        <View style={styles.summaryCard}>
          <TouchableOpacity 
            style={styles.summaryHeaderTouchable} 
            onPress={() => setMostrarDetalleParamedico(!mostrarDetalleParamedico)}
            activeOpacity={0.8}
          >
            <View style={styles.summaryHeader}>
              <ThemedText style={styles.summaryTitleText}>Detalle Paramédico</ThemedText>
            </View>
            <Ionicons 
              name={mostrarDetalleParamedico ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={MJM_BLUE} 
            />
          </TouchableOpacity>

          {mostrarDetalleParamedico && (
            <>
              <View style={styles.divider} />
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <ThemedText style={styles.metricValue}>{totalesMes.sum_por_orden_central}</ThemedText>
                  <ThemedText style={styles.metricLabel}>Por Orden Central</ThemedText>
                </View>

                <View style={styles.metricItem}>
                  <ThemedText style={styles.metricValue}>{totalesMes.sum_inyectable}</ThemedText>
                  <ThemedText style={styles.metricLabel}>Inyectables</ThemedText>
                </View>

                <View style={styles.metricItem}>
                  <ThemedText style={styles.metricValue}>{totalesMes.sum_curacion_topica}</ThemedText>
                  <ThemedText style={styles.metricLabel}>Curación Tópica</ThemedText>
                </View>

                <View style={styles.metricItem}>
                  <ThemedText style={[styles.metricValue, { color: "#16a34a" }]}>{totalesMes.sum_pertenece_muni}</ThemedText>
                  <ThemedText style={styles.metricLabel}>Pertenece Muni</ThemedText>
                </View>

                <View style={styles.metricItem}>
                  <ThemedText style={styles.metricValue}>{totalesMes.sum_control_fv_sv}</ThemedText>
                  <ThemedText style={styles.metricLabel}>Control FV/SV</ThemedText>
                </View>

                <View style={styles.metricItem}>
                  <ThemedText style={styles.metricValue}>{totalesMes.sum_traslado_urgencia}</ThemedText>
                  <ThemedText style={styles.metricLabel}>Traslado Urgencia</ThemedText>
                </View>
              </View>
            </>
          )}
        </View>

        {/* SELECTOR DE VISTA */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tabButton, vistaActual === "grafico" && styles.tabActive]}
            onPress={() => setVistaActual("grafico")}
          >
            <Ionicons name="bar-chart-outline" size={16} color={vistaActual === "grafico" ? "white" : MJM_BLUE} />
            <ThemedText style={[styles.tabText, vistaActual === "grafico" && styles.tabTextActive]}>
              Gráfica Diaria
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, vistaActual === "matriz" && styles.tabActive]}
            onPress={() => setVistaActual("matriz")}
          >
            <Ionicons name="grid-outline" size={16} color={vistaActual === "matriz" ? "white" : MJM_BLUE} />
            <ThemedText style={[styles.tabText, vistaActual === "matriz" && styles.tabTextActive]}>
              Matriz del Mes
            </ThemedText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={MJM_BLUE} style={{ marginVertical: 40 }} />
        ) : vistaActual === "grafico" ? (
          /* VISTA 1: GRÁFICO DIARIO PROFESIONAL */
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
                <View style={[styles.legendDot, { backgroundColor: TURNO_COLORS.M }]} />
                <ThemedText style={styles.legendText}>Mañana (M)</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: TURNO_COLORS.T }]} />
                <ThemedText style={styles.legendText}>Tarde (T)</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: TURNO_COLORS.N }]} />
                <ThemedText style={styles.legendText}>Noche (N)</ThemedText>
              </View>
            </View>

            {evolucionDiaria.length > 0 ? (
              <View onLayout={onLayoutChartContainer} style={styles.chartWrapper}>
                {/* SVG Trazado de tendencia exacto */}
           {/* SVG Trazado de tendencia exacto */}
{containerWidth > 0 && (
  <Svg
    width={containerWidth}
    height={CHART_HEIGHT}
    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
  >
    {/* Línea Polyline más delgada y clara */}
    <Polyline
      points={svgPolylinePoints}
      fill="none"
      stroke={MJM_BLUE}
      strokeWidth="1.8"       // <--- Reducimos el grosor de la línea (antes estaba en 2.5)
      strokeOpacity="0.75"    // <--- Le damos una ligera transparencia para que luzca más clara que los puntos
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    
    {/* Puntos destacados sobre la línea (mantienen su grosor fuerte) */}
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

                {/* Capa de Valores Superiores */}
                <View style={styles.valuesOverlayContainer}>
                  {calculatedPoints.map((p, idx) => (
                    <View key={idx} style={styles.valueLabelColumn}>
                      {p.total > 0 ? (
                        <View style={[styles.barValueBadge, { top: Math.max(p.y - 20, 0) }]}>
                          <ThemedText style={styles.barValueText}>{p.total}</ThemedText>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>

                {/* GRÁFICO DE BARRAS INTERACTIVO */}
                <View style={styles.fullWidthChartContainer}>
                  {diasArray.map((dia) => {
                    const registrosDia = evolucionDiaria.filter((e) => Number(e.dia) === dia);
                    const totalDia = registrosDia.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
                    const fechaObj = new Date(anioSeleccionado, mesSeleccionado - 1, dia);
                    const nombreDiaSemana = DIAS_SEMANA[fechaObj.getDay()];
                    const isSelected = diaSeleccionadoTooltip === dia;

                    return (
                      <TouchableOpacity 
                        key={dia} 
                        style={[styles.barColumnFull, isSelected && styles.barColumnSelected]}
                        activeOpacity={0.7}
                        onPress={() => setDiaSeleccionadoTooltip(isSelected ? null : dia)}
                      >
                        <View style={styles.barTrack}>
                          {registrosDia.length > 0 ? (
                            <View style={styles.barStackContainer}>
                              {registrosDia.map((reg, idx) => {
                                const alturaPorcentaje = (Number(reg.total) / maxTotalDiario) * 100;
                                const colorTurno = TURNO_COLORS[reg.turno || "M"] || MJM_BLUE;
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
                            <View style={[styles.barFill, { height: `${Math.min((totalDia / maxTotalDiario) * 100, 100)}%` }]} />
                          )}
                        </View>

                        <View style={styles.labelContainerFull}>
                          <ThemedText style={[styles.barLabelNumber, isSelected && { color: MJM_BLUE, fontWeight: "900" }]}>
                            {dia}
                          </ThemedText>
                          <ThemedText style={styles.barLabelDay}>{nombreDiaSemana}</ThemedText>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <ThemedText style={styles.emptyText}>No hay registros para este periodo.</ThemedText>
            )}

            {diaSeleccionadoTooltip !== null && (
              <View style={styles.tooltipCard}>
                <View style={styles.tooltipHeader}>
                  <ThemedText style={styles.tooltipTitle}>
                    Detalle del día {diaSeleccionadoTooltip} de {nombreMesActual}
                  </ThemedText>
                  <TouchableOpacity onPress={() => setDiaSeleccionadoTooltip(null)}>
                    <Ionicons name="close" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
                {evolucionDiaria
                  .filter((e) => Number(e.dia) === diaSeleccionadoTooltip)
                  .map((item, idx) => (
                    <ThemedText key={idx} style={styles.tooltipText}>
                      {item.turno ? `Turno [${item.turno}]:` : "Total:"} {item.total} ocurrencias
                    </ThemedText>
                  ))}
              </View>
            )}

            <ThemedText style={styles.chartTip}>💡 Toca cualquier barra para ver el detalle exacto del día</ThemedText>
          </View>
        ) : (
          /* VISTA 2: MATRIZ DE PRODUCTIVIDAD */
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="grid-outline" size={16} color={MJM_BLUE} />
              <ThemedText style={styles.sectionTitleText}>
                Matriz de Productividad (Mostrando {usuariosUnicosCargados.length} de {totalUsuariosServidor})
              </ThemedText>
            </View>
            <View style={styles.divider} />

            {usuariosUnicosCargados.length > 0 ? (
              <View style={{ width: "100%" }}>
                {/* ENCABEZADO MATRIZ */}
                <View style={styles.matrixRow}>
                  <View style={[styles.matrixCell, styles.matrixHeaderColFixed]}>
                    <ThemedText style={styles.matrixHeaderText}>Personal</ThemedText>
                  </View>
                  {diasArray.map((dia) => (
                    <View key={dia} style={[styles.matrixCell, styles.matrixHeaderColDay]}>
                      <ThemedText style={styles.matrixHeaderText}>{dia}</ThemedText>
                    </View>
                  ))}
                  <View style={[styles.matrixCell, styles.matrixHeaderColTotal]}>
                    <ThemedText style={styles.matrixHeaderText}>TOTAL</ThemedText>
                  </View>
                </View>

                {/* FILAS DE USUARIOS */}
                {usuariosUnicosCargados.map((usuario, uIndex) => {
                  let totalFilaUsuario = 0;
                  
                  return (
                    <View key={uIndex} style={styles.matrixRow}>
                      <View style={[styles.matrixCell, styles.matrixColFixed]}>
                        <ThemedText style={styles.matrixUserText} numberOfLines={1}>
                          {usuario}
                        </ThemedText>
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
                              cantidadTotal > 0 && { backgroundColor: "#eff6ff" }
                            ]}
                          >
                            <ThemedText 
                              style={[
                                styles.matrixValueText,
                                cantidadTotal > 0 && { color: MJM_BLUE, fontWeight: "bold" }
                              ]}
                            >
                              {cantidadTotal > 0 ? cantidadTotal : "-"}
                            </ThemedText>
                          </View>
                        );
                      })}

                      <View style={[styles.matrixCell, styles.matrixColTotal, { backgroundColor: "#f8fafc" }]}>
                        <ThemedText style={[styles.matrixValueText, { fontWeight: "900", color: MJM_BLUE }]}>
                          {totalFilaUsuario}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}

                {/* TOTAL POR DÍA */}
                <View style={styles.matrixRow}>
                  <View style={[styles.matrixCell, styles.matrixColFixed, { backgroundColor: "#f1f5f9" }]}>
                    <ThemedText style={[styles.matrixHeaderText, { textAlign: "left" }]}>TOTAL DÍA</ThemedText>
                  </View>
                  {diasArray.map((dia) => {
                    const totalColumnaDia = matrizUsuarios
                      .filter((m) => Number(m.dia) === dia)
                      .reduce((acc, curr) => acc + Number(curr.total || 0), 0);

                    return (
                      <View key={dia} style={[styles.matrixCell, styles.matrixColDay, { backgroundColor: "#f1f5f9" }]}>
                        <ThemedText style={[styles.matrixValueText, { fontWeight: "bold", color: "#0f172a" }]}>
                          {totalColumnaDia > 0 ? totalColumnaDia : "-"}
                        </ThemedText>
                      </View>
                    );
                  })}
                  <View style={[styles.matrixCell, styles.matrixColTotal, { backgroundColor: "#e2e8f0" }]}>
                    <ThemedText style={[styles.matrixValueText, { fontWeight: "900", color: "#0f172a" }]}>
                      {totalesMes.total_mes}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ) : (
              <ThemedText style={styles.emptyText}>No se encontró personal con ese filtro.</ThemedText>
            )}

            {hayMasUsuariosEnServidor && (
              <TouchableOpacity 
                style={styles.loadMoreButton} 
                onPress={() => {
                  const siguientePagina = paginaActual + 1;
                  setPaginaActual(siguientePagina);
                  fetchEstadisticasMensuales(siguientePagina, true, busquedaQuery);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-down-circle-outline" size={16} color="#024885" />
                <ThemedText style={styles.loadMoreText}>
                  Mostrar 10 más ({usuariosUnicosCargados.length} de {totalUsuariosServidor})
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL PERIODO */}
      <Modal visible={modalMesVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalMesVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Seleccionar Periodo</ThemedText>
            <View style={styles.yearSelector}>
              <TouchableOpacity onPress={() => setAnioSeleccionado(anioSeleccionado - 1)} style={styles.yearButton}>
                <Ionicons name="chevron-back" size={16} color={MJM_BLUE} />
              </TouchableOpacity>
              <ThemedText style={styles.yearText}>{anioSeleccionado}</ThemedText>
              <TouchableOpacity onPress={() => setAnioSeleccionado(anioSeleccionado + 1)} style={styles.yearButton}>
                <Ionicons name="chevron-forward" size={16} color={MJM_BLUE} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 250 }}>
              {MESES.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.modalItem, mesSeleccionado === m.value && styles.modalItemActive]}
                  onPress={() => {
                    setMesSeleccionado(m.value);
                    setModalMesVisible(false);
                  }}
                >
                  <ThemedText style={[styles.modalItemText, mesSeleccionado === m.value && { color: "white", fontWeight: "bold" }]}>
                    {m.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalMesVisible(false)}>
              <ThemedText style={styles.modalCloseText}>Cancelar</ThemedText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MODAL MODALIDAD */}
      <Modal visible={modalModalidadVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalModalidadVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Filtrar por Modalidad</ThemedText>
            <ScrollView style={{ maxHeight: 250 }}>
              <TouchableOpacity
                style={[styles.modalItem, modalidadFiltro === null && styles.modalItemActive]}
                onPress={() => {
                  setModalidadFiltro(null);
                  setModalModalidadVisible(false);
                }}
              >
                <ThemedText style={[styles.modalItemText, modalidadFiltro === null && { color: "white", fontWeight: "bold" }]}>
                  Todas las Modalidades
                </ThemedText>
              </TouchableOpacity>
              {modalidadesCatalogo.map((mod) => (
                <TouchableOpacity
                  key={mod.id}
                  style={[styles.modalItem, modalidadFiltro === mod.id && styles.modalItemActive]}
                  onPress={() => {
                    setModalidadFiltro(mod.id);
                    setModalModalidadVisible(false);
                  }}
                >
                  <ThemedText style={[styles.modalItemText, modalidadFiltro === mod.id && { color: "white", fontWeight: "bold" }]}>
                    {mod.nombre}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalModalidadVisible(false)}>
              <ThemedText style={styles.modalCloseText}>Cerrar</ThemedText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MODAL ORIGEN */}
      <Modal visible={modalOrigenVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalOrigenVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Filtrar por Origen</ThemedText>
            <ScrollView style={{ maxHeight: 250 }}>
              <TouchableOpacity
                style={[styles.modalItem, origenFiltro === null && styles.modalItemActive]}
                onPress={() => {
                  setOrigenFiltro(null);
                  setModalOrigenVisible(false);
                }}
              >
                <ThemedText style={[styles.modalItemText, origenFiltro === null && { color: "white", fontWeight: "bold" }]}>
                  Todos los Orígenes
                </ThemedText>
              </TouchableOpacity>
              {origenesCatalogo.map((orig) => (
                <TouchableOpacity
                  key={orig.id_origen}
                  style={[styles.modalItem, origenFiltro === orig.id_origen && styles.modalItemActive]}
                  onPress={() => {
                    setOrigenFiltro(orig.id_origen);
                    setModalOrigenVisible(false);
                  }}
                >
                  <ThemedText style={[styles.modalItemText, origenFiltro === orig.id_origen && { color: "white", fontWeight: "bold" }]}>
                    {orig.descripcion}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalOrigenVisible(false)}>
              <ThemedText style={styles.modalCloseText}>Cerrar</ThemedText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#f8fafc" },

  /* ESTILOS PROFESIONALES PARA EL GRÁFICO DIARIO */
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
    zIndex: 3,
    pointerEvents: "none",
  },
  valueLabelColumn: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  barValueBadge: {
    position: "absolute",
    // Aquí controlas la separación: al restarle -26 o -28, el número se eleva y se separa elegantemente de la bolita
    paddingHorizontal: 2,
    paddingVertical: -45,
  },
  barValueText: {
    fontSize: 9.5,           // Tamaño ideal para leer números de miles sin saturar
    color: MJM_BLUE,
   fontWeight: "bold",
    textAlign: "center",
  },
  scrollContent: { paddingHorizontal: 15, paddingVertical: 20 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  mainTitle: { fontSize: 14, fontWeight: "900", color: "#024885", letterSpacing: 1.1 },
  sectionSubtitle: { fontSize: 8, fontWeight: "bold", color: "#64748b", letterSpacing: 1.1, marginTop: 2 },
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
  
  modoSelectorContainer: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  modoButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modoButtonActive: {
    backgroundColor: MJM_BLUE,
  },
  modoText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#024885",
  },
  modoTextActive: {
    color: "white",
  },

  filterCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
  },
  filterChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 2,
  },
  filterChipText: {
    fontSize: 9,
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

  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignSelf: "flex-end",
  },
  clearFiltersText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#ef4444",
  },

  summaryCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 1,
  },
  summaryHeaderTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryTitleText: {
    fontSize: 11,
    fontWeight: "900",
    color: MJM_BLUE,
    textTransform: "uppercase",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  metricItem: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  metricValue: {
    fontSize: 15,
    fontWeight: "900",
    color: MJM_BLUE,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#64748b",
    textAlign: "center",
    marginTop: 2,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    height: 36,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: "#334155",
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
    paddingVertical: 10,
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
  sectionTitleText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", color: "#024885" },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 10 },
  emptyText: { fontSize: 11, color: "#94a3b8", textAlign: "center", paddingVertical: 20 },
  
  legendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
    marginBottom: 12,
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

/* Espaciado superior del badge para que nunca toque la bolita */

  /* Contenedor y ancho de la columna táctil para corregir el sombreado a la mitad */
  fullWidthChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 170,
    width: "100%",
    justifyContent: "space-between",
  },
  barColumnFull: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
    paddingHorizontal: 2,    // Asegura que abarque simétricamente todo el ancho de la columna
    borderRadius: 6,
  },
  barColumnSelected: {
    backgroundColor: "#e0f2fe", // Color de selección suave para toda la columna
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
    fontSize: 9,             // <--- Subido de 6.5 a 9 para que se lea perfecto
    color: "#475569",        // Un gris un poco más oscuro para mejor contraste
    fontWeight: "700",       // Más negrita para que no se vea débil
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

  /* ESTILOS DE LA MATRIZ */
  matrixRow: { flexDirection: "row", width: "100%" },
  matrixCell: { justifyContent: "center", alignItems: "center", paddingVertical: 8, borderWidth: 0.5, borderColor: "#f1f5f9" },
  matrixHeaderColFixed: { width: 120, backgroundColor: "#f1f5f9", alignItems: "flex-start", paddingLeft: 8 },
  matrixHeaderColDay: { flex: 1, minWidth: 24, backgroundColor: "#f1f5f9" },
  matrixHeaderColTotal: { width: 45, backgroundColor: "#e2e8f0" },
  
  matrixColFixed: { width: 120, alignItems: "flex-start", paddingLeft: 8, backgroundColor: "#ffffff" },
  matrixColDay: { flex: 1, minWidth: 24 },
  matrixColTotal: { width: 45 },

  matrixHeaderText: { fontSize: 9, fontWeight: "bold", color: "#334155", textAlign: "center" },
  matrixUserText: { fontSize: 10, fontWeight: "600", color: "#334155" },
  matrixValueText: { fontSize: 9, color: "#64748b", textAlign: "center" },

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
  modalTitle: { fontSize: 13, fontWeight: "bold", color: "#024885", marginBottom: 12, textAlign: "center" },
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