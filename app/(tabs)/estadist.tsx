import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "${API_URL}";
const MJM_BLUE = "#024885";

interface EvolucionItem {
  fecha: string;
  dia: number;
  total: number;
}

interface MatrizItem {
  usuario: string;
  dia: number;
  total: number;
}

interface ModalidadItem {
  id: number;
  nombre: string;
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

export default function GraficoEstadisticasScreen() {
  const [evolucionDiaria, setEvolucionDiaria] = useState<EvolucionItem[]>([]);
  const [matrizUsuarios, setMatrizUsuarios] = useState<MatrizItem[]>([]);
  const [modalidadesCatalogo, setModalidadesCatalogo] = useState<ModalidadItem[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [vistaActual, setVistaActual] = useState<"grafico" | "matriz">("grafico");

  // Filtros de fecha y categoría
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(new Date().getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(new Date().getFullYear());
  const [modalidadFiltro, setModalidadFiltro] = useState<number | null>(null);
  const [busquedaUsuario, setBusquedaUsuario] = useState<string>("");

  // Modales de selección
  const [modalMesVisible, setModalMesVisible] = useState(false);
  const [modalModalidadVisible, setModalModalidadVisible] = useState(false);

  const fetchEstadisticasMensuales = useCallback(async () => {
    try {
      let url = `${API_URL}/ocurrencias/estadisticas-mensuales1?mes=${mesSeleccionado}&anio=${anioSeleccionado}`;
      if (modalidadFiltro) {
        url += `&id_modalidad=${modalidadFiltro}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      setEvolucionDiaria(data.evolucion_diaria || []);
      setMatrizUsuarios(data.matriz_usuarios || []);
      setModalidadesCatalogo(data.modalidades_catalogo || []);
    } catch (error) {
      console.error("Error al cargar estadísticas mensuales:", error);
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

  // Calcular días del mes seleccionado considerando años bisiestos
  const diasEnMes = new Date(anioSeleccionado, mesSeleccionado, 0).getDate();
  const diasArray = Array.from({ length: diasEnMes }, (_, i) => i + 1);

  // Extraer usuarios únicos y filtrar por el buscador (para soportar 500+ personas sin trabarse)
  const usuariosUnicos = Array.from(
    new Set(matrizUsuarios.map((item) => item.usuario))
  ).filter((usuario) =>
    usuario.toLowerCase().includes(busquedaUsuario.toLowerCase())
  );

  const maxTotalDiario =
    evolucionDiaria.length > 0
      ? Math.max(...evolucionDiaria.map((item) => Number(item.total) || 0), 1)
      : 1;

  const nombreMesActual = MESES.find((m) => m.value === mesSeleccionado)?.label || "";

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
            <ThemedText style={styles.mainTitle}>RENDIMIENTO MENSUAL</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              MONITOREO Y FILTROS AVANZADOS
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.8}>
            <Ionicons name="refresh" size={16} color="white" />
            <ThemedText style={styles.refreshButtonText}>Actualizar</ThemedText>
          </TouchableOpacity>
        </View>

        {/* BARRA DE FILTROS (MES, AÑO Y MODALIDAD) */}
        <View style={styles.filterCard}>
          <View style={styles.filterRow}>
            {/* Selector de Mes */}
            <TouchableOpacity 
              style={styles.filterChip} 
              onPress={() => setModalMesVisible(true)}
            >
              <Ionicons name="calendar-outline" size={14} color={MJM_BLUE} />
              <ThemedText style={styles.filterChipText}>{nombreMesActual} {anioSeleccionado}</ThemedText>
              <Ionicons name="chevron-down" size={12} color="#64748b" />
            </TouchableOpacity>

            {/* Selector de Modalidad */}
            <TouchableOpacity 
              style={[styles.filterChip, modalidadFiltro !== null && styles.filterChipActive]} 
              onPress={() => setModalModalidadVisible(true)}
            >
              <Ionicons name="shield-outline" size={14} color={modalidadFiltro !== null ? "white" : MJM_BLUE} />
              <ThemedText style={[styles.filterChipText, modalidadFiltro !== null && { color: "white" }]} numberOfLines={1}>
                {modalidadFiltro 
                  ? modalidadesCatalogo.find(m => m.id === modalidadFiltro)?.nombre || "Modalidad"
                  : "Todas las Modalidades"}
              </ThemedText>
              <Ionicons name="chevron-down" size={12} color={modalidadFiltro !== null ? "white" : "#64748b"} />
            </TouchableOpacity>
          </View>

          {/* Buscador de Personal (Escalable para 500+ registros) */}
          {vistaActual === "matriz" && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={14} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar personal por nombre o apellido..."
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
          /* VISTA 1: GRÁFICO DE BARRAS */
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up-outline" size={16} color={MJM_BLUE} />
              <ThemedText style={styles.sectionTitleText}>
                Evolución Diaria ({nombreMesActual} {anioSeleccionado})
              </ThemedText>
            </View>
            <View style={styles.divider} />

            {evolucionDiaria.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.nativeChartContainer}>
                  {diasArray.map((dia) => {
                    const encontrado = evolucionDiaria.find((e) => e.dia === dia);
                    const total = encontrado ? Number(encontrado.total) : 0;

                    return (
                      <View key={dia} style={styles.barColumn}>
                        <ThemedText style={styles.barValueText}>{total > 0 ? total : ""}</ThemedText>
                        <View style={styles.barTrack}>
                          <View 
                            style={[
                              styles.barFill, 
                              { height: `${Math.min((total / maxTotalDiario) * 100, 100)}%` }
                            ]} 
                          />
                        </View>
                        <ThemedText style={styles.barLabelText}>{dia}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <ThemedText style={styles.emptyText}>No hay registros para este periodo.</ThemedText>
            )}
            <ThemedText style={styles.chartTip}>💡 Desliza horizontalmente para ver todos los días</ThemedText>
          </View>
        ) : (
          /* VISTA 2: MATRIZ DE DÍAS X PERSONAL */
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="grid-outline" size={16} color={MJM_BLUE} />
              <ThemedText style={styles.sectionTitleText}>
                Matriz de Productividad ({usuariosUnicos.length} registros mostrados)
              </ThemedText>
            </View>
            <View style={styles.divider} />

            {usuariosUnicos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  {/* Encabezado de días */}
                  <View style={styles.matrixRow}>
                    <View style={[styles.matrixCell, styles.matrixHeaderColFixed]}>
                      <ThemedText style={styles.matrixHeaderText}>Personal</ThemedText>
                    </View>
                    {diasArray.map((dia) => (
                      <View key={dia} style={[styles.matrixCell, styles.matrixHeaderColDay]}>
                        <ThemedText style={styles.matrixHeaderText}>{dia}</ThemedText>
                      </View>
                    ))}
                  </View>

                  {/* Filas de usuarios filtrados */}
                  {usuariosUnicos.map((usuario, uIndex) => (
                    <View key={uIndex} style={styles.matrixRow}>
                      <View style={[styles.matrixCell, styles.matrixColFixed]}>
                        <ThemedText style={styles.matrixUserText} numberOfLines={1}>
                          {usuario}
                        </ThemedText>
                      </View>
                      {diasArray.map((dia) => {
                        const itemEncontrado = matrizUsuarios.find(
                          (m) => m.usuario === usuario && m.dia === dia
                        );
                        const cantidad = itemEncontrado ? itemEncontrado.total : 0;
                        return (
                          <View 
                            key={dia} 
                            style={[
                              styles.matrixCell, 
                              styles.matrixColDay,
                              cantidad > 0 && { backgroundColor: "#eff6ff" }
                            ]}
                          >
                            <ThemedText 
                              style={[
                                styles.matrixValueText,
                                cantidad > 0 && { color: MJM_BLUE, fontWeight: "bold" }
                              ]}
                            >
                              {cantidad > 0 ? cantidad : "-"}
                            </ThemedText>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <ThemedText style={styles.emptyText}>No se encontró personal con ese filtro.</ThemedText>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL PARA SELECCIONAR MES Y AÑO */}
      <Modal visible={modalMesVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Seleccionar Periodo</ThemedText>
            
            {/* Selector de Año rápido */}
            <View style={styles.yearSelector}>
              <TouchableOpacity 
                onPress={() => setAnioSeleccionado(anioSeleccionado - 1)}
                style={styles.yearButton}
              >
                <Ionicons name="chevron-back" size={16} color={MJM_BLUE} />
              </TouchableOpacity>
              <ThemedText style={styles.yearText}>{anioSeleccionado}</ThemedText>
              <TouchableOpacity 
                onPress={() => setAnioSeleccionado(anioSeleccionado + 1)}
                style={styles.yearButton}
              >
                <Ionicons name="chevron-forward" size={16} color={MJM_BLUE} />
              </TouchableOpacity>
            </View>

            {/* Lista de Meses */}
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

            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setModalMesVisible(false)}
            >
              <ThemedText style={styles.modalCloseText}>Cancelar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL PARA SELECCIONAR MODALIDAD */}
      <Modal visible={modalModalidadVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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

            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setModalModalidadVisible(false)}
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
  scrollContent: { paddingHorizontal: 15, paddingVertical: 20 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
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
  
  // Filtros y Buscador
  filterCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: MJM_BLUE,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#334155",
    flex: 1,
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
    marginBottom: 15,
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
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 12 },
  emptyText: { fontSize: 11, color: "#94a3b8", textAlign: "center", paddingVertical: 20 },
  
  nativeChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 190,
    paddingVertical: 10,
    gap: 12,
    paddingHorizontal: 5,
  },
  barColumn: {
    alignItems: "center",
    width: 24,
    height: "100%",
    justifyContent: "flex-end",
  },
  barValueText: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 4,
    fontWeight: "bold",
  },
  barTrack: {
    width: 10,
    height: 130,
    backgroundColor: "#f1f5f9",
    borderRadius: 5,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    backgroundColor: MJM_BLUE,
    borderRadius: 5,
  },
  barLabelText: {
    fontSize: 10,
    color: "#334155",
    marginTop: 6,
    fontWeight: "600",
  },
  chartTip: {
    fontSize: 9,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 10,
    fontStyle: "italic",
  },

  matrixRow: { flexDirection: "row" },
  matrixCell: { justifyContent: "center", alignItems: "center", paddingVertical: 8, borderWidth: 0.5, borderColor: "#f1f5f9" },
  matrixHeaderColFixed: { width: 130, backgroundColor: "#f1f5f9", alignItems: "flex-start", paddingLeft: 8 },
  matrixHeaderColDay: { width: 32, backgroundColor: "#f1f5f9" },
  matrixColFixed: { width: 130, alignItems: "flex-start", paddingLeft: 8, backgroundColor: "#ffffff" },
  matrixColDay: { width: 32 },
  matrixHeaderText: { fontSize: 10, fontWeight: "bold", color: "#334155" },
  matrixUserText: { fontSize: 10, fontWeight: "600", color: "#334155" },
  matrixValueText: { fontSize: 10, color: "#64748b" },

  // Estilos de los Modales
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