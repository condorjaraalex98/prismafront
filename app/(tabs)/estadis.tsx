import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState, useMemo } from "react";
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    Dimensions,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "${API_URL}";
const MJM_BLUE = "#024885";
const MJM_DARK = "#0f172a";
const COLOR_M = "#38bdf8"; // Mañana
const COLOR_T = "#fbbf24"; // Tarde
const COLOR_N = "#94a3b8"; // Noche

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 60;

interface TurnoItem {
  dia: number;
  turno: "M" | "T" | "N";
  total: number;
}

interface MatrizItem {
  usuario: string;
  dia: number;
  turno: "M" | "T" | "N";
  total: number;
  id_modalidad?: number;
  nombre_modalidad?: string;
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

const MESES = [
  { label: "Enero", value: 1 }, { label: "Febrero", value: 2 },
  { label: "Marzo", value: 3 }, { label: "Abril", value: 4 },
  { label: "Mayo", value: 5 }, { label: "Junio", value: 6 },
  { label: "Julio", value: 7 }, { label: "Agosto", value: 8 },
  { label: "Setiembre", value: 9 }, { label: "Octubre", value: 10 },
  { label: "Noviembre", value: 11 }, { label: "Diciembre", value: 12 },
];

export default function GraficoEstadisticasScreen() {
  const [evolucionTurnos, setEvolucionTurnos] = useState<TurnoItem[]>([]);
  const [matrizUsuarios, setMatrizUsuarios] = useState<MatrizItem[]>([]);
  const [totalesMes, setTotalesMes] = useState<TotalesMes>({ total_mes: 0, total_mañana: 0, total_tarde: 0, total_noche: 0 });
  const [modalidadesCatalogo, setModalidadesCatalogo] = useState<ModalidadItem[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [vistaActual, setVistaActual] = useState<"grafico" | "personal">("grafico");

  // Filtros
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(new Date().getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(new Date().getFullYear());
  const [modalidadFiltro, setModalidadFiltro] = useState<number | null>(null);
  const [busquedaUsuario, setBusquedaUsuario] = useState<string>("");
  
  // Día seleccionado para desglose
  const [diaSeleccionadoDetalle, setDiaSeleccionadoDetalle] = useState<number | null>(null);
  
  // Modales
  const [modalPersonalVisible, setModalPersonalVisible] = useState(false);
  const [modalidadSeleccionadaDetalle, setModalidadSeleccionadaDetalle] = useState<{ id: number; nombre: string } | null>(null);

  const [verTodosPersonal, setVerTodosPersonal] = useState(false);
  const [verTodosModalidadesDia, setVerTodosModalidadesDia] = useState(false);

  const [modalMesVisible, setModalMesVisible] = useState(false);
  const [modalModalidadVisible, setModalModalidadVisible] = useState(false);

  const fetchEstadisticasMensuales = useCallback(async () => {
    try {
      let url = `${API_URL}/ocurrencias/estadisticas-mensuales3?mes=${mesSeleccionado}&anio=${anioSeleccionado}`;
      if (modalidadFiltro) url += `&id_modalidad=${modalidadFiltro}`;

      const response = await fetch(url);
      const data = await response.json();

      setEvolucionTurnos(data.evolucion_diaria_turnos || []);
      setMatrizUsuarios(data.matriz_usuarios || []);
      setTotalesMes(data.totales_mes || { total_mes: 0, total_mañana: 0, total_tarde: 0, total_noche: 0 });
      
      if (data.modalidades_catalogo && data.modalidades_catalogo.length > 0) {
        setModalidadesCatalogo(data.modalidades_catalogo);
      } else {
        const unicas = Array.from(new Set(data.matriz_usuarios?.map((m: MatrizItem) => m.id_modalidad).filter(Boolean))).map(id => {
          const item = data.matriz_usuarios.find((m: MatrizItem) => m.id_modalidad === id);
          return { id: Number(id), nombre: item?.nombre_modalidad || `Modalidad ${id}` };
        });
        setModalidadesCatalogo(unicas);
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mesSeleccionado, anioSeleccionado, modalidadFiltro]);

  useEffect(() => {
    fetchEstadisticasMensuales();
  }, [fetchEstadisticasMensuales]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEstadisticasMensuales();
  };

  const diasEnMes = new Date(anioSeleccionado, mesSeleccionado, 0).getDate();
  const diasArray = Array.from({ length: diasEnMes }, (_, i) => i + 1);

  const totalesPorDiaMap: { [dia: number]: number } = {};
  evolucionTurnos.forEach((item) => {
    totalesPorDiaMap[item.dia] = (totalesPorDiaMap[item.dia] || 0) + item.total;
  });

  // Datos adaptados para LineChart
  const lineChartData = useMemo(() => {
    return diasArray.map((dia) => {
      const total = totalesPorDiaMap[dia] || 0;
      return {
        value: total,
        label: dia % 5 === 0 || dia === 1 ? `${dia}` : "",
        dataPointText: total > 0 ? `${total}` : "",
        onPress: () => {
          setDiaSeleccionadoDetalle(diaSeleccionadoDetalle === dia ? null : dia);
          setVerTodosModalidadesDia(false);
        },
      };
    });
  }, [diasArray, totalesPorDiaMap, diaSeleccionadoDetalle]);

  // Cálculos para la distribución de turnos
  const datosDistribucionTurnos = useMemo(() => {
    let m = 0;
    let t = 0;
    let n = 0;

    if (diaSeleccionadoDetalle !== null) {
      const registrosDia = evolucionTurnos.filter(e => e.dia === diaSeleccionadoDetalle);
      m = registrosDia.find(r => r.turno === 'M')?.total || 0;
      t = registrosDia.find(r => r.turno === 'T')?.total || 0;
      n = registrosDia.find(r => r.turno === 'N')?.total || 0;
    } else {
      m = totalesMes.total_mañana;
      t = totalesMes.total_tarde;
      n = totalesMes.total_noche;
    }

    const total = m + t + n;
    return {
      m,
      t,
      n,
      total,
      percM: total > 0 ? (m / total) * 100 : 0,
      percT: total > 0 ? (t / total) * 100 : 0,
      percN: total > 0 ? (n / total) * 100 : 0,
    };
  }, [evolucionTurnos, totalesMes, diaSeleccionadoDetalle]);

  // Filtrado general de usuarios
  const usuariosUnicos = Array.from(new Set(matrizUsuarios.map((item) => item.usuario))).filter((u) =>
    u.toLowerCase().includes(busquedaUsuario.toLowerCase())
  );

  const consolidadoPersonal = usuariosUnicos.map((usuario) => {
    const registrosUsuario = matrizUsuarios.filter((m) => m.usuario === usuario && (diaSeleccionadoDetalle === null || m.dia === diaSeleccionadoDetalle));
    const mCount = registrosUsuario.filter(r => r.turno === 'M').reduce((acc, r) => acc + r.total, 0);
    const tCount = registrosUsuario.filter(r => r.turno === 'T').reduce((acc, r) => acc + r.total, 0);
    const nCount = registrosUsuario.filter(r => r.turno === 'N').reduce((acc, r) => acc + r.total, 0);
    const totalDia = mCount + tCount + nCount;
    return { usuario, mCount, tCount, nCount, totalDia };
  }).filter(d => d.totalDia > 0);

  const modalidadesDelDiaRanking = (() => {
    if (!diaSeleccionadoDetalle) return [];
    const registrosDia = matrizUsuarios.filter(m => m.dia === diaSeleccionadoDetalle);
    const mapaModalidades: { [id: number]: { id: number; nombre: string; total: number; m: number; t: number; n: number } } = {};

    registrosDia.forEach(reg => {
      const modId = reg.id_modalidad || 0;
      const modNombre = reg.nombre_modalidad || modalidadesCatalogo.find(m => m.id === modId)?.nombre || `Modalidad ID ${modId}`;
      if (!mapaModalidades[modId]) {
        mapaModalidades[modId] = { id: modId, nombre: modNombre, total: 0, m: 0, t: 0, n: 0 };
      }
      mapaModalidades[modId].total += reg.total;
      if (reg.turno === 'M') mapaModalidades[modId].m += reg.total;
      if (reg.turno === 'T') mapaModalidades[modId].t += reg.total;
      if (reg.turno === 'N') mapaModalidades[modId].n += reg.total;
    });

    return Object.values(mapaModalidades).sort((a, b) => b.total - a.total);
  })();

  const personalPorModalidadSeleccionada = (() => {
    if (!diaSeleccionadoDetalle || !modalidadSeleccionadaDetalle) return [];
    const filtrados = matrizUsuarios.filter(m => m.dia === diaSeleccionadoDetalle && m.id_modalidad === modalidadSeleccionadaDetalle.id);
    
    const mapaUsuarios: { [usuario: string]: { usuario: string; m: number; t: number; n: number; total: number } } = {};
    filtrados.forEach(f => {
      if (!mapaUsuarios[f.usuario]) {
        mapaUsuarios[f.usuario] = { usuario: f.usuario, m: 0, t: 0, n: 0, total: 0 };
      }
      mapaUsuarios[f.usuario].total += f.total;
      if (f.turno === 'M') mapaUsuarios[f.usuario].m += f.total;
      if (f.turno === 'T') mapaUsuarios[f.usuario].t += f.total;
      if (f.turno === 'N') mapaUsuarios[f.usuario].n += f.total;
    });

    return Object.values(mapaUsuarios).sort((a, b) => b.total - a.total);
  })();

  const nombreMesActual = MESES.find((m) => m.value === mesSeleccionado)?.label || "";

  return (
    <ThemedView style={styles.main}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MJM_BLUE} />}
      >
        {/* ENCABEZADO CORPORATIVO */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.liveIndicator} />
            <View>
              <ThemedText style={styles.mainTitle}>DASHBOARD EJECUTIVO</ThemedText>
              <ThemedText style={styles.sectionSubtitle}>SISTEMA SIPCOP • MUNICIPALIDAD</ThemedText>
            </View>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.8}>
            <Ionicons name="sync" size={14} color="white" />
            <ThemedText style={styles.refreshButtonText}>Sincronizar</ThemedText>
          </TouchableOpacity>
        </View>

        {/* FILTROS Y CONTROLES SUPERIORES */}
        <View style={styles.filterCard}>
          <View style={styles.filterRow}>
            <TouchableOpacity style={styles.filterChip} onPress={() => setModalMesVisible(true)}>
              <Ionicons name="calendar" size={13} color={MJM_BLUE} />
              <ThemedText style={styles.filterChipText}>{nombreMesActual} {anioSeleccionado}</ThemedText>
              <Ionicons name="chevron-down" size={11} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.filterChip, modalidadFiltro !== null && styles.filterChipActive]} onPress={() => setModalModalidadVisible(true)}>
              <Ionicons name="shield-checkmark" size={13} color={modalidadFiltro !== null ? "white" : MJM_BLUE} />
              <ThemedText style={[styles.filterChipText, modalidadFiltro !== null && { color: "white" }]} numberOfLines={1}>
                {modalidadFiltro ? modalidadesCatalogo.find(m => m.id === modalidadFiltro)?.nombre || "Modalidad" : "Todas las Modalidades"}
              </ThemedText>
              <Ionicons name="chevron-down" size={11} color={modalidadFiltro !== null ? "white" : "#64748b"} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={14} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar agente operativo en la base de datos..."
              placeholderTextColor="#94a3b8"
              value={busquedaUsuario}
              onChangeText={setBusquedaUsuario}
            />
            {busquedaUsuario.length > 0 && (
              <TouchableOpacity onPress={() => setBusquedaUsuario("")}>
                <Ionicons name="close-circle" size={14} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* BENTO GRID DE KPIS SUPERIORES */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiMainCard}>
            <View style={styles.kpiCardHeader}>
              <ThemedText style={styles.kpiLabel}>TOTAL INCIDENCIAS</ThemedText>
              <Ionicons name="analytics" size={18} color={MJM_BLUE} />
            </View>
            <ThemedText style={styles.kpiMainValue}>{totalesMes.total_mes}</ThemedText>
            <ThemedText style={styles.kpiSubValue}>Acumulado oficial en {nombreMesActual}</ThemedText>
          </View>

          <View style={styles.kpiSideColumn}>
            <View style={styles.kpiMiniCard}>
              <View style={[styles.miniDot, { backgroundColor: COLOR_M }]} />
              <View>
                <ThemedText style={styles.kpiMiniLabel}>MAÑANA</ThemedText>
                <ThemedText style={styles.kpiMiniValue}>{totalesMes.total_mañana}</ThemedText>
              </View>
            </View>
            <View style={styles.kpiMiniCard}>
              <View style={[styles.miniDot, { backgroundColor: COLOR_T }]} />
              <View>
                <ThemedText style={styles.kpiMiniLabel}>TARDE</ThemedText>
                <ThemedText style={styles.kpiMiniValue}>{totalesMes.total_tarde}</ThemedText>
              </View>
            </View>
            <View style={styles.kpiMiniCard}>
              <View style={[styles.miniDot, { backgroundColor: COLOR_N }]} />
              <View>
                <ThemedText style={styles.kpiMiniLabel}>NOCHE</ThemedText>
                <ThemedText style={styles.kpiMiniValue}>{totalesMes.total_noche}</ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* SELECTOR DE VISTA PROFESIONAL */}
        <View style={styles.tabSelector}>
          <TouchableOpacity style={[styles.tabButton, vistaActual === "grafico" && styles.tabActive]} onPress={() => setVistaActual("grafico")}>
            <Ionicons name="pie-chart-outline" size={14} color={vistaActual === "grafico" ? "white" : MJM_BLUE} />
            <ThemedText style={[styles.tabText, vistaActual === "grafico" && styles.tabTextActive]}>Panel Analítico</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tabButton, vistaActual === "personal" && styles.tabActive]} onPress={() => setVistaActual("personal")}>
            <Ionicons name="people-outline" size={14} color={vistaActual === "personal" ? "white" : MJM_BLUE} />
            <ThemedText style={[styles.tabText, vistaActual === "personal" && styles.tabTextActive]}>Rendimiento del Personal</ThemedText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={MJM_BLUE} style={{ marginVertical: 40 }} />
        ) : vistaActual === "grafico" ? (
          <>
         

            {/* GRÁFICO PROFESIONAL DE LÍNEA Y TENDENCIA */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="stats-chart" size={16} color={MJM_BLUE} />
                <ThemedText style={styles.sectionTitleText}>Línea de Tendencia Diaria</ThemedText>
              </View>
              <View style={styles.divider} />

              {evolucionTurnos.length > 0 ? (
                <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                  <LineChart
                    data={lineChartData}
                    height={180}
                    width={CHART_WIDTH}
                    spacing={28}
                    initialSpacing={10}
                    color={MJM_BLUE}
                    thickness={3}
                    startFillColor="rgba(2, 72, 133, 0.3)"
                    endFillColor="rgba(2, 72, 133, 0.0)"
                    areaChart
                    curved
                    isAnimated
                    animationDuration={1200}
                    dataPointsColor={MJM_BLUE}
                    dataPointsRadius={4}
                    textStyle={{ fontSize: 8, color: '#64748b' } as any}
                    xAxisColor="#cbd5e1"
                    yAxisColor="#cbd5e1"
                    yAxisTextStyle={{ fontSize: 9, color: '#64748b' }}
                    noOfSections={4}
                    rulesColor="#f1f5f9"
                    rulesType="solid"
                    pointerConfig={{
                      pointerStripHeight: 160,
                      pointerStripColor: '#cbd5e1',
                      pointerStripWidth: 2,
                      pointerColor: MJM_BLUE,
                      radius: 6,
                      pointerLabelComponent: (items: any) => {
                        return (
                          <View style={styles.tooltipContainer}>
                            <ThemedText style={styles.tooltipText}>{items[0].value} incidencias</ThemedText>
                          </View>
                        );
                      },
                    }}
                  />
                </View>
              ) : (
                <ThemedText style={styles.emptyText}>No hay registros para este periodo.</ThemedText>
              )}
              <ThemedText style={styles.chartTip}>💡 Toca cualquier punto de la curva para aislar los datos operativos del día.</ThemedText>

              {/* RANKING DE MODALIDADES DEL DÍA SELECCIONADO */}
              {diaSeleccionadoDetalle && (
                <View style={styles.detalleContainer}>
                  <View style={styles.detalleHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.detalleTitle}>Incidencias por Modalidad (Día {diaSeleccionadoDetalle})</ThemedText>
                      <ThemedText style={styles.detalleSubDesc}>Desglose jerárquico de eventos registrados.</ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => setDiaSeleccionadoDetalle(null)}>
                      <ThemedText style={styles.clearFilterText}>Cerrar Detalle</ThemedText>
                    </TouchableOpacity>
                  </View>

                  {modalidadesDelDiaRanking.length > 0 ? (
                    <View>
                      {(verTodosModalidadesDia ? modalidadesDelDiaRanking : modalidadesDelDiaRanking.slice(0, 4)).map((item, index) => (
                        <TouchableOpacity 
                          key={item.id} 
                          style={styles.modalidadRankingCard}
                          onPress={() => {
                            setModalidadSeleccionadaDetalle({ id: item.id, nombre: item.nombre });
                            setModalPersonalVisible(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.modalidadRankingLeft}>
                            <View style={styles.rankingPositionBadge}>
                              <ThemedText style={styles.rankingPositionText}>0{index + 1}</ThemedText>
                            </View>
                            <ThemedText style={styles.modalidadRankingName} numberOfLines={1}>{item.nombre}</ThemedText>
                          </View>

                          <View style={styles.modalidadRankingRight}>
                            <ThemedText style={[styles.miniBadgeText, { color: MJM_BLUE }]}>M:{item.m}</ThemedText>
                            <ThemedText style={[styles.miniBadgeText, { color: '#d97706' }]}>T:{item.t}</ThemedText>
                            <ThemedText style={[styles.miniBadgeText, { color: '#475569' }]}>N:{item.n}</ThemedText>
                            <View style={styles.totalPill}>
                              <ThemedText style={styles.totalPillText}>{item.total}</ThemedText>
                            </View>
                            <Ionicons name="chevron-forward" size={13} color="#64748b" />
                          </View>
                        </TouchableOpacity>
                      ))}

                      {modalidadesDelDiaRanking.length > 4 && (
                        <TouchableOpacity 
                          style={styles.verMasButton} 
                          onPress={() => setVerTodosModalidadesDia(!verTodosModalidadesDia)}
                        >
                          <ThemedText style={styles.verMasButtonText}>
                            {verTodosModalidadesDia ? "Mostrar menos" : `Ver ${modalidadesDelDiaRanking.length - 4} modalidades más`}
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <ThemedText style={styles.emptyText}>Sin incidencias de modalidades en esta fecha.</ThemedText>
                  )}
                </View>
              )}
            </View>
          </>
        ) : (
          /* VISTA 2: RENDIMIENTO DE PERSONAL */
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={16} color={MJM_BLUE} />
              <ThemedText style={styles.sectionTitleText}>Productividad Acumulada por Agente</ThemedText>
            </View>
            <View style={styles.divider} />

            {consolidadoPersonal.length > 0 ? (
              <View>
                <ThemedText style={styles.listSubTip}>Total agentes listados: {consolidadoPersonal.length}</ThemedText>
                {(verTodosPersonal ? consolidadoPersonal : consolidadoPersonal.slice(0, 5)).map((item, index) => (
                  <View key={index} style={styles.personalCardItem}>
                    <View style={styles.personalInfoContainer}>
                      <View style={styles.avatarMini}>
                        <Ionicons name="shield-outline" size={12} color="white" />
                      </View>
                      <ThemedText style={styles.personalNameText} numberOfLines={1}>{item.usuario}</ThemedText>
                    </View>

                    <View style={styles.personalMetricsRow}>
                      <View style={[styles.miniBadge, { backgroundColor: '#e0f2fe' }]}>
                        <ThemedText style={[styles.miniBadgeText, { color: MJM_BLUE }]}>M: {item.mCount}</ThemedText>
                      </View>
                      <View style={[styles.miniBadge, { backgroundColor: '#fef3c7' }]}>
                        <ThemedText style={[styles.miniBadgeText, { color: '#d97706' }]}>T: {item.tCount}</ThemedText>
                      </View>
                      <View style={[styles.miniBadge, { backgroundColor: '#f1f5f9' }]}>
                        <ThemedText style={[styles.miniBadgeText, { color: '#475569' }]}>N: {item.nCount}</ThemedText>
                      </View>
                      <View style={styles.totalPill}>
                        <ThemedText style={styles.totalPillText}>{item.totalDia}</ThemedText>
                      </View>
                    </View>
                  </View>
                ))}

                {consolidadoPersonal.length > 5 && (
                  <TouchableOpacity 
                    style={styles.verMasButton} 
                    onPress={() => setVerTodosPersonal(!verTodosPersonal)}
                  >
                    <ThemedText style={styles.verMasButtonText}>
                      {verTodosPersonal ? "Mostrar menos" : `Ver ${consolidadoPersonal.length - 5} agentes más`}
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ThemedText style={styles.emptyText}>No se encontraron agentes activos con los filtros aplicados.</ThemedText>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL DETALLE DE PERSONAL POR MODALIDAD */}
      <Modal visible={modalPersonalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.modalMainTitle} numberOfLines={1}>{modalidadSeleccionadaDetalle?.nombre}</ThemedText>
                <ThemedText style={styles.modalSubTitle}>Agentes operativos involucrados (Día {diaSeleccionadoDetalle})</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setModalPersonalVisible(false)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={18} color="#334155" />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
              {personalPorModalidadSeleccionada.length > 0 ? (
                personalPorModalidadSeleccionada.map((p, idx) => (
                  <View key={idx} style={styles.personalCardItem}>
                    <View style={styles.personalInfoContainer}>
                      <View style={styles.avatarMini}><Ionicons name="person" size={11} color="white" /></View>
                      <ThemedText style={styles.personalNameText} numberOfLines={1}>{p.usuario}</ThemedText>
                    </View>
                    <View style={styles.personalMetricsRow}>
                      <ThemedText style={[styles.miniBadgeText, { color: MJM_BLUE }]}>M:{p.m}</ThemedText>
                      <ThemedText style={[styles.miniBadgeText, { color: '#d97706' }]}>T:{p.t}</ThemedText>
                      <ThemedText style={[styles.miniBadgeText, { color: '#475569' }]}>N:{p.n}</ThemedText>
                      <View style={styles.totalPill}>
                        <ThemedText style={styles.totalPillText}>{p.total}</ThemedText>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <ThemedText style={styles.emptyText}>No hay agentes registrados en esta modalidad.</ThemedText>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalPersonalVisible(false)}>
              <ThemedText style={styles.modalCloseText}>Cerrar Panel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL SELECCIÓN DE MES */}
      <Modal visible={modalMesVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Seleccionar Periodo Oficial</ThemedText>
            <View style={styles.yearSelector}>
              <TouchableOpacity onPress={() => setAnioSeleccionado(anioSeleccionado - 1)} style={styles.yearButton}><Ionicons name="chevron-back" size={15} color={MJM_BLUE} /></TouchableOpacity>
              <ThemedText style={styles.yearText}>{anioSeleccionado}</ThemedText>
              <TouchableOpacity onPress={() => setAnioSeleccionado(anioSeleccionado + 1)} style={styles.yearButton}><Ionicons name="chevron-forward" size={15} color={MJM_BLUE} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 240 }}>
              {MESES.map((m) => (
                <TouchableOpacity key={m.value} style={[styles.modalItem, mesSeleccionado === m.value && styles.modalItemActive]} onPress={() => { setMesSeleccionado(m.value); setModalMesVisible(false); }}>
                  <ThemedText style={[styles.modalItemText, mesSeleccionado === m.value && { color: "white", fontWeight: "bold" }]}>{m.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalMesVisible(false)}><ThemedText style={styles.modalCloseText}>Cancelar</ThemedText></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL SELECCIÓN DE MODALIDAD */}
      <Modal visible={modalModalidadVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Filtrar por Modalidad</ThemedText>
            <ScrollView style={{ maxHeight: 240 }}>
              <TouchableOpacity style={[styles.modalItem, modalidadFiltro === null && styles.modalItemActive]} onPress={() => { setModalidadFiltro(null); setModalModalidadVisible(false); }}>
                <ThemedText style={[styles.modalItemText, modalidadFiltro === null && { color: "white", fontWeight: "bold" }]}>Todas las Modalidades</ThemedText>
              </TouchableOpacity>
              {modalidadesCatalogo.map((mod) => (
                <TouchableOpacity key={mod.id} style={[styles.modalItem, modalidadFiltro === mod.id && styles.modalItemActive]} onPress={() => { setModalidadFiltro(mod.id); setModalModalidadVisible(false); }}>
                  <ThemedText style={[styles.modalItemText, modalidadFiltro === mod.id && { color: "white", fontWeight: "bold" }]}>{mod.nombre}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalModalidadVisible(false)}><ThemedText style={styles.modalCloseText}>Cerrar</ThemedText></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#f1f5f9" },
  scrollContent: { paddingHorizontal: 12, paddingVertical: 15 },
  
  headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, backgroundColor: "white", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  headerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  mainTitle: { fontSize: 12, fontWeight: "900", color: MJM_BLUE, letterSpacing: 0.8 },
  sectionSubtitle: { fontSize: 8, fontWeight: "bold", color: "#64748b", letterSpacing: 0.5, marginTop: 1 },
  refreshButton: { backgroundColor: MJM_BLUE, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  refreshButtonText: { color: "white", fontSize: 10, fontWeight: "bold" },

  filterCard: { backgroundColor: "white", borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8fafc", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: "#e2e8f0" },
  filterChipActive: { backgroundColor: MJM_BLUE, borderColor: MJM_BLUE },
  filterChipText: { fontSize: 10, fontWeight: "bold", color: "#334155", flex: 1 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 8, paddingHorizontal: 10, marginTop: 8, borderWidth: 1, borderColor: "#e2e8f0", height: 35, gap: 6 },
  searchInput: { flex: 1, fontSize: 10, color: "#334155" },

  kpiGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  kpiMainCard: { flex: 1.2, backgroundColor: "white", borderRadius: 12, padding: 14, justifyContent: "space-between", borderWidth: 1, borderColor: "#e2e8f0", elevation: 1 },
  kpiCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kpiLabel: { fontSize: 8, fontWeight: "bold", color: "#64748b", letterSpacing: 0.5 },
  kpiMainValue: { fontSize: 24, fontWeight: "900", color: MJM_BLUE, marginVertical: 4 },
  kpiSubValue: { fontSize: 8, color: "#94a3b8" },

  kpiSideColumn: { flex: 1, gap: 6 },
  kpiMiniCard: { flex: 1, backgroundColor: "white", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  miniDot: { width: 7, height: 7, borderRadius: 3.5 },
  kpiMiniLabel: { fontSize: 7, fontWeight: "bold", color: "#64748b" },
  kpiMiniValue: { fontSize: 13, fontWeight: "900", color: "#0f172a" },

  tabSelector: { flexDirection: "row", backgroundColor: "#e2e8f0", borderRadius: 10, padding: 3, marginBottom: 12, gap: 3 },
  tabButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 7, borderRadius: 7, gap: 5 },
  tabActive: { backgroundColor: "white", elevation: 1 },
  tabText: { fontSize: 10, fontWeight: "bold", color: "#64748b" },
  tabTextActive: { color: MJM_BLUE },

  darkControlCard: { backgroundColor: MJM_DARK, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#334155" },
  sectionHeaderDark: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitleTextDark: { fontSize: 11, fontWeight: "bold", color: "white" },
  dividerDark: { height: 1, backgroundColor: "#334155", marginVertical: 10 },
  clearBadgeDark: { backgroundColor: "#334155", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  clearBadgeText: { fontSize: 8, fontWeight: "bold", color: "#38bdf8" },
  progressBarContainerDark: { height: 12, backgroundColor: "#1e293b", borderRadius: 6, flexDirection: "row", overflow: "hidden", marginBottom: 10 },
  distributionLegendRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  distLegendItemDark: { flexDirection: "row", alignItems: "center", gap: 5 },
  distLegendTextDark: { fontSize: 9, color: "#94a3b8" },
  emptyTextDark: { fontSize: 10, color: "#94a3b8", textAlign: "center", marginVertical: 10 },

  sectionCard: { backgroundColor: "white", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", elevation: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitleText: { fontSize: 11, fontWeight: "bold", color: "#0f172a" },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 10 },

  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  chartTip: { fontSize: 8, color: "#94a3b8", textAlign: "center", marginTop: 8 },
  tooltipContainer: { backgroundColor: MJM_BLUE, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 5 },
  tooltipText: { color: 'white', fontSize: 9, fontWeight: 'bold' },

  detalleContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 10 },
  detalleHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  detalleTitle: { fontSize: 10, fontWeight: "bold", color: MJM_BLUE },
  detalleSubDesc: { fontSize: 8, color: "#64748b", marginTop: 1 },
  clearFilterText: { fontSize: 9, fontWeight: "bold", color: "#ef4444" },

  modalidadRankingCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: 7, borderRadius: 8, marginBottom: 5, borderWidth: 1, borderColor: "#e2e8f0" },
  modalidadRankingLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, marginRight: 6 },
  rankingPositionBadge: { backgroundColor: "#e2e8f0", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  rankingPositionText: { fontSize: 8, fontWeight: "bold", color: "#334155" },
  modalidadRankingName: { fontSize: 9, fontWeight: "bold", color: "#334155", flex: 1 },
  modalidadRankingRight: { flexDirection: "row", alignItems: "center", gap: 5 },

  personalCardItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: 7, borderRadius: 8, marginBottom: 5, borderWidth: 1, borderColor: "#e2e8f0" },
  personalInfoContainer: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, marginRight: 6 },
  avatarMini: { width: 20, height: 20, borderRadius: 10, backgroundColor: MJM_BLUE, justifyContent: "center", alignItems: "center" },
  personalNameText: { fontSize: 9, fontWeight: "bold", color: "#334155", flex: 1 },
  personalMetricsRow: { flexDirection: "row", alignItems: "center", gap: 4 },

  miniBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  miniBadgeText: { fontSize: 8, fontWeight: "bold" },
  totalPill: { backgroundColor: MJM_BLUE, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  totalPillText: { fontSize: 8, fontWeight: "bold", color: "white" },

  listSubTip: { fontSize: 8, color: "#64748b", marginBottom: 6 },
  verMasButton: { paddingVertical: 7, backgroundColor: "#f1f5f9", borderRadius: 8, marginTop: 4, alignItems: "center" },
  verMasButtonText: { fontSize: 9, fontWeight: "bold", color: MJM_BLUE },
  progressSegment: { height: "100%" },

  emptyText: { fontSize: 9, color: "#94a3b8", textAlign: "center", marginVertical: 12 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: "white", borderRadius: 12, padding: 14, maxHeight: "80%" },
  modalContentLarge: { backgroundColor: "white", borderRadius: 12, padding: 14, maxHeight: "85%" },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalMainTitle: { fontSize: 11, fontWeight: "bold", color: "#0f172a" },
  modalSubTitle: { fontSize: 8, color: "#64748b", marginTop: 2 },
  closeIconBtn: { padding: 4 },
  modalTitle: { fontSize: 11, fontWeight: "bold", color: "#0f172a", marginBottom: 10, textAlign: "center" },
  yearSelector: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 10 },
  yearButton: { padding: 4, backgroundColor: "#f1f5f9", borderRadius: 6 },
  yearText: { fontSize: 11, fontWeight: "bold", color: MJM_BLUE },
  modalItem: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 7, marginBottom: 3 },
  modalItemActive: { backgroundColor: MJM_BLUE },
  modalItemText: { fontSize: 10, color: "#334155" },
  modalCloseButton: { backgroundColor: "#f1f5f9", paddingVertical: 9, borderRadius: 8, alignItems: "center", marginTop: 10 },
  modalCloseText: { fontSize: 10, fontWeight: "bold", color: "#334155" },
});