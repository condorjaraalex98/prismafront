import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as XLSX from "xlsx";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
const ThemedText = ({ style, children, ...props }: any) => (
  <Text style={style} {...props}>
    {children}
  </Text>
);

const MJM_BLUE = "#024885";

const GRADOS_LIST = [
  "GEN POL", "TGRAL", "GRAL", "CRNL", "CMDTE", "MY",
  "CAP", "TTE", "ALFZ", "S3ER", "SBRIG", "ST1",
  "ST2", "ST3", "SO1", "SO2", "SO3",
];

const INITIAL_PNP_STATE = {
  grado: "SO3",
  nombres: "",
  apellidos: "",
  dni: "",
  estado: 1,
};

export default function PnpScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  const [modalGradosVisible, setModalGradosVisible] = useState<boolean>(false);
  const [personalPnp, setPersonalPnp] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({ total: 0, activos: 0, inactivos: 0 });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gradoSel, setGradoSel] = useState("TODOS");
  const [estadoSel, setEstadoSel] = useState("TODOS");

  // Paginación y Carga
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modales y Formularios
  const [errors, setErrors] = useState<any>({});
  const [dniDuplicadoMsg, setDniDuplicadoMsg] = useState("");
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success",
  });

  const [pnpEdit, setPnpEdit] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [nuevoPnp, setNuevoPnp] = useState(INITIAL_PNP_STATE);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchText), 350);
    return () => clearTimeout(handler);
  }, [searchText]);

  const cargarDatos = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const nextPage = reset ? 1 : page;
        const query = new URLSearchParams({
          q: debouncedSearch,
          grado: gradoSel,
          estado: estadoSel,
          page: nextPage.toString(),
        });

        const res = await fetch(`${API_URL}/pnptotal?${query}`);
        const result = await res.json();

        setCounts({
          total: result.pagination?.totalRecords || result.counts?.total || 0,
          activos: result.counts?.activos || 0,
          inactivos: result.counts?.inactivos || 0,
        });

        const newRecords = result.data || [];
        setPersonalPnp((prev) => (reset ? newRecords : [...prev, ...newRecords]));
        setHasMore(Boolean(result.pagination?.hasMore ?? result.hasMore));
        setPage(nextPage + 1);
      } catch (e) {
        console.error("Error al cargar catálogo PNP:", e);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, gradoSel, estadoSel, page, loading]
  );

  useEffect(() => {
    setHasMore(true);
    setPage(1);
    cargarDatos(true);
  }, [debouncedSearch, gradoSel, estadoSel]);

  const handleLoadMore = () => {
    if (!loading && hasMore) cargarDatos(false);
  };

  const exportarExcel = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        q: debouncedSearch,
        grado: gradoSel,
        estado: estadoSel,
        export: "true",
      });

      const res = await fetch(`${API_URL}/pnptotal?${query}`);
      const result = await res.json();
      const dataCompleta = result.data || [];

      if (dataCompleta.length === 0) {
        setCustomAlert({
          visible: true,
          title: "Sin datos",
          message: "No hay datos filtrados para exportar.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      setTimeout(() => {
        const datosFormato = dataCompleta.map((p: any) => ({
          ID: p.id_pnp,
          GRADO: p.grado || "",
          APELLIDOS: p.apellidos || "",
          NOMBRES: p.nombres || "",
          DNI: p.dni || "",
          ESTADO: p.estado === 1 ? "ACTIVO" : "INACTIVO",
        }));

        const worksheet = XLSX.utils.json_to_sheet(datosFormato);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Catálogo PNP");

        XLSX.writeFile(workbook, "Reporte_Personal_PNP.xlsx");
        setLoading(false);
      }, 50);
    } catch (e) {
      console.error("Error al exportar:", e);
      setLoading(false);
    }
  };

  // Verificación de DNI al momento de escribir
  const handleDniChange = async (text: string) => {
    const cleanDni = text.replace(/[^0-9]/g, "");
    setNuevoPnp({ ...nuevoPnp, dni: cleanDni });

    if (errors.dni) setErrors({ ...errors, dni: false });
    setDniDuplicadoMsg("");

    if (cleanDni.length === 8) {
      try {
        const res = await fetch(`${API_URL}/checkdnipnp/${cleanDni}`);
        const data = await res.json();
        if (data.existe) {
          setErrors((prev: any) => ({ ...prev, dni: true }));
          setDniDuplicadoMsg("⚠️ EL DNI INGRESADO YA SE ENCUENTRA REGISTRADO");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleGuardarCambios = async () => {
    if (!pnpEdit) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/updatepnp/${pnpEdit.id_pnp}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pnpEdit),
      });

      if (res.ok) {
        setModalVisible(false);
        setCustomAlert({
          visible: true,
          title: "¡Éxito!",
          message: "Registro actualizado correctamente.",
          type: "success",
        });
        cargarDatos(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarNuevo = async () => {
    let newErrors: any = {};
    const { nombres, apellidos, dni } = nuevoPnp;

    if (!nombres.trim()) newErrors.nombres = true;
    if (!apellidos.trim()) newErrors.apellidos = true;
    if (!dni.trim()) newErrors.dni = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setCustomAlert({
        visible: true,
        title: "Campos Faltantes",
        message: "Por favor complete los campos obligatorios.",
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("${API_URL}/insertpnp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoPnp),
      });

      const data = await res.json();

      // Manejo de Error: DNI Ya registrado
      if (!res.ok) {
        if (res.status === 409 || data.code === "DNI_DUPLICADO") {
          setErrors({ dni: true });
          setDniDuplicadoMsg("⚠️ EL DNI INGRESADO YA SE ENCUENTRA REGISTRADO");
          setCustomAlert({
            visible: true,
            title: "DNI Registrado",
            message: data.message || "El DNI ingresado ya existe en la base de datos.",
            type: "error",
          });
          return;
        }

        setCustomAlert({
          visible: true,
          title: "Error",
          message: data.message || "Ocurrió un error al guardar.",
          type: "error",
        });
        return;
      }

      setModalCrearVisible(false);
      setNuevoPnp(INITIAL_PNP_STATE);
      setDniDuplicadoMsg("");
      setCustomAlert({
        visible: true,
        title: "¡Éxito!",
        message: "Efectivo PNP registrado correctamente.",
        type: "success",
      });
      cargarDatos(true);
    } catch (e) {
      setCustomAlert({
        visible: true,
        title: "Error de Red",
        message: "No se pudo conectar con el servidor.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const BadgeEstado = ({ estado }: { estado: number }) => (
    <View style={[styles.badge, { backgroundColor: estado === 1 ? "#E8F5E9" : "#FFEBEE" }]}>
      <Text style={{ color: estado === 1 ? "#2E7D32" : "#C62828", fontSize: 10, fontWeight: "bold" }}>
        {estado === 1 ? "ACTIVO" : "INACTIVO"}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ThemedText style={styles.headerTitle}>Cat. PNP</ThemedText>
            {Platform.OS === "web" && (
              <TouchableOpacity
                onPress={exportarExcel}
                style={[styles.btnAdd, { backgroundColor: MJM_BLUE, width: 34, height: 34 }]}
              >
                <Ionicons name="document-text" size={16} color="white" />
              </TouchableOpacity>
            )}
          <View style={styles.estadoToggle}>
  {[
    { id: "TODOS", l: "TODOS", c: counts.total },
    { id: "ACTIVO", l: "ACTIVOS", c: counts.activos },
    { id: "INACTIVO", l: "INACTIVOS", c: counts.inactivos },
  ].map((e) => (
    <TouchableOpacity
      key={e.id}
      onPress={() => setEstadoSel(e.id)}
      style={[styles.btnEstado, estadoSel === e.id && styles.btnEstadoActive]}
    >
      <Text style={[styles.btnText, estadoSel === e.id && { color: "white" }]}>
        {e.l}
      </Text>
      <Text style={[styles.btnText, estadoSel === e.id && { color: "white" }]}>
        {e.c}
      </Text>
    </TouchableOpacity>
  ))}
</View>
          </View>

          <TouchableOpacity
            style={styles.btnAdd}
            onPress={() => {
              setErrors({});
              setDniDuplicadoMsg("");
              setModalCrearVisible(true);
            }}
          >
            <Ionicons name="person-add" size={18} color="white" />
          </TouchableOpacity>
        </View>

        {/* BÚSQUEDA */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            placeholder="Buscar por DNI, Nombres o Apellidos"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== "" && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        {/* FILTRO GRADOS */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Grado:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setGradoSel("TODOS")}
              style={[styles.btnChip, gradoSel === "TODOS" && styles.btnActive]}
            >
              <Text style={[styles.btnText, gradoSel === "TODOS" && { color: "#FFF" }]}>TODOS</Text>
            </TouchableOpacity>
            {GRADOS_LIST.slice(0, 4).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGradoSel(g)}
                style={[styles.btnChip, gradoSel === g && styles.btnActive]}
              >
                <Text style={[styles.btnText, gradoSel === g && { color: "#FFF" }]}>{g}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setModalGradosVisible(true)}
              style={[
                styles.btnChip,
                gradoSel !== "TODOS" && !GRADOS_LIST.slice(0, 4).includes(gradoSel) && styles.btnActive,
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  gradoSel !== "TODOS" && !GRADOS_LIST.slice(0, 4).includes(gradoSel) && { color: "#FFF" },
                ]}
              >
                📋 + Más
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* CABECERA DESKTOP */}
      {isDesktop && (
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.8, textAlign: "center" }]}>
            GRADO
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 2, textAlign: "center" }]}>
            APELLIDOS Y NOMBRES
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1, textAlign: "center" }]}>
            DNI
          </Text>
          <Text style={[styles.cell, styles.headerText, { flex: 0.8, textAlign: "center" }]}>
            ESTADO
          </Text>
        </View>
      )}

      {/* LISTA */}
      <FlatList
        data={personalPnp}
        keyExtractor={(item, index) => `${item.id_pnp}-${index}`}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={isDesktop ? styles.tableRow : styles.mobileCard}
            onPress={() => {
              setPnpEdit(item);
              setModalVisible(true);
            }}
          >
            {isDesktop ? (
              <>
                <Text style={[styles.cell, styles.cellBorder, { flex: 0.8, fontWeight: "bold", textAlign: "center" }]}>
                  {item.grado}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 2 }]} numberOfLines={1}>
                  {`${item.apellidos}, ${item.nombres}`.toUpperCase()}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1, textAlign: "center" }]}>
                  {item.dni || "-"}
                </Text>
                <View style={[styles.cell, { flex: 0.8, alignItems: "center" }]}>
                  <BadgeEstado estado={item.estado} />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 13 }}>
                    {item.grado} - {`${item.apellidos}, ${item.nombres}`.toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                    DNI: {item.dni || "S/N"}
                  </Text>
                </View>
                <BadgeEstado estado={item.estado} />
              </View>
            )}
          </TouchableOpacity>
        )}
        ListFooterComponent={loading ? <ActivityIndicator size="small" color={MJM_BLUE} style={{ margin: 15 }} /> : null}
      />

      {/* MODAL EDITAR */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Editar Efectivo PNP</ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {pnpEdit && (
              <ScrollView>
                <ThemedText style={styles.label}>Grado</ThemedText>
                <View style={styles.modalPickerContainer}>
                  <Picker
                    selectedValue={pnpEdit.grado}
                    onValueChange={(val) => setPnpEdit({ ...pnpEdit, grado: val })}
                  >
                    {GRADOS_LIST.map((g) => (
                      <Picker.Item key={g} label={g} value={g} />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Nombres</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={pnpEdit.nombres}
                  onChangeText={(t) => setPnpEdit({ ...pnpEdit, nombres: t })}
                />

                <ThemedText style={styles.label}>Apellidos</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={pnpEdit.apellidos}
                  onChangeText={(t) => setPnpEdit({ ...pnpEdit, apellidos: t })}
                />

                <ThemedText style={styles.label}>DNI</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={pnpEdit.dni}
                  keyboardType="numeric"
                  maxLength={10}
                  onChangeText={(t) => setPnpEdit({ ...pnpEdit, dni: t.replace(/[^0-9]/g, "") })}
                />

                <ThemedText style={styles.label}>Estado</ThemedText>
                <View style={styles.modalPickerContainer}>
                  <Picker
                    selectedValue={pnpEdit.estado}
                    onValueChange={(val) => setPnpEdit({ ...pnpEdit, estado: Number(val) })}
                  >
                    <Picker.Item label="ACTIVO" value={1} />
                    <Picker.Item label="INACTIVO" value={0} />
                  </Picker>
                </View>

                <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardarCambios}>
                  <ThemedText style={{ color: "white", fontWeight: "bold" }}>GUARDAR CAMBIOS</ThemedText>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL CREAR */}
      <Modal visible={modalCrearVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Nuevo Efectivo PNP</ThemedText>
              <TouchableOpacity onPress={() => setModalCrearVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <ThemedText style={styles.label}>Grado *</ThemedText>
              <View style={styles.modalPickerContainer}>
                <Picker
                  selectedValue={nuevoPnp.grado}
                  onValueChange={(val) => setNuevoPnp({ ...nuevoPnp, grado: val })}
                >
                  {GRADOS_LIST.map((g) => (
                    <Picker.Item key={g} label={g} value={g} />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.label}>Nombres *</ThemedText>
              <TextInput
                style={[styles.modalInput, errors.nombres && styles.inputError]}
                value={nuevoPnp.nombres}
                onChangeText={(t) => {
                  setNuevoPnp({ ...nuevoPnp, nombres: t });
                  if (errors.nombres) setErrors({ ...errors, nombres: false });
                }}
              />

              <ThemedText style={styles.label}>Apellidos *</ThemedText>
              <TextInput
                style={[styles.modalInput, errors.apellidos && styles.inputError]}
                value={nuevoPnp.apellidos}
                onChangeText={(t) => {
                  setNuevoPnp({ ...nuevoPnp, apellidos: t });
                  if (errors.apellidos) setErrors({ ...errors, apellidos: false });
                }}
              />

              <ThemedText style={styles.label}>DNI *</ThemedText>
              <TextInput
                style={[styles.modalInput, errors.dni && styles.inputError]}
                keyboardType="numeric"
                maxLength={10}
                value={nuevoPnp.dni}
                onChangeText={handleDniChange}
              />
              
              {/* MENSAJE DE ERROR EN ROJO SI EL DNI YA EXISTE */}
              {dniDuplicadoMsg !== "" && (
                <Text style={styles.errorTextRed}>{dniDuplicadoMsg}</Text>
              )}

              <ThemedText style={styles.label}>Estado</ThemedText>
              <View style={styles.modalPickerContainer}>
                <Picker
                  selectedValue={nuevoPnp.estado}
                  onValueChange={(val) => setNuevoPnp({ ...nuevoPnp, estado: Number(val) })}
                >
                  <Picker.Item label="ACTIVO" value={1} />
                  <Picker.Item label="INACTIVO" value={0} />
                </Picker>
              </View>

              <TouchableOpacity
                style={[
                  styles.btnGuardar,
                  errors.dni && { backgroundColor: "#E53935" }, // Cambia el botón a Rojo
                ]}
                onPress={handleGuardarNuevo}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                    {errors.dni ? "DNI YA REGISTRADO" : "REGISTRAR PNP"}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL SELECCIONAR GRADOS */}
      <Modal visible={modalGradosVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Grado</Text>
              <TouchableOpacity onPress={() => setModalGradosVisible(false)}>
                <Text style={{ fontSize: 18, color: "#64748B" }}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={["TODOS", ...GRADOS_LIST]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, gradoSel === item && { backgroundColor: "#E2E8F0" }]}
                  onPress={() => {
                    setGradoSel(item);
                    setModalGradosVisible(false);
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL ALERTA DE MENSAJES */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Ionicons
              name={customAlert.type === "success" ? "checkmark-circle" : "alert-circle"}
              size={55}
              color={customAlert.type === "success" ? "#2E7D32" : "#E53935"}
            />
            <ThemedText style={{ fontSize: 16, fontWeight: "bold", marginTop: 10, color: customAlert.type === "error" ? "#E53935" : "#0F172A" }}>
              {customAlert.title}
            </ThemedText>
            <ThemedText style={{ textAlign: "center", color: "#64748B", marginTop: 8, fontSize: 13 }}>
              {customAlert.message}
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.btnGuardar,
                { width: "100%", marginTop: 18 },
                customAlert.type === "error" && { backgroundColor: "#E53935" },
              ]}
              onPress={() => setCustomAlert({ ...customAlert, visible: false })}
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>ENTENDIDO</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: MJM_BLUE },
  btnAdd: { backgroundColor: MJM_BLUE, width: 38, height: 38, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  estadoToggle: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 8, padding: 3, gap: 4 },
  btnEstado: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnEstadoActive: { backgroundColor: MJM_BLUE },
  btnText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 10, height: 40, marginBottom: 8 },
  input: { flex: 1, marginLeft: 8, fontSize: 13, color: "#0F172A" },
  filterRow: { flexDirection: "row", alignItems: "center" },
  filterLabel: { fontSize: 12, fontWeight: "bold", color: "#64748B", width: 50 },
  btnChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  btnActive: { backgroundColor: MJM_BLUE },
  tableHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#024885" },
  headerText: { fontWeight: "bold", fontSize: 11, color: "#FFFFFF" },
  tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  cell: { flex: 1, padding: 8, justifyContent: "center" },
  cellBorder: { borderRightWidth: 1, borderRightColor: "rgba(203, 213, 225, 0.4)" },
  mobileCard: { backgroundColor: "#FFFFFF", padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 15 },
  modalContent: { backgroundColor: "white", borderRadius: 16, padding: 18, width: "100%", maxWidth: 480, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#0F172A" },
  modalItem: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalPickerContainer: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, backgroundColor: "#F8FAFC", height: 45, justifyContent: "center" },
  modalInput: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  inputError: { borderColor: "#E53935", borderWidth: 1.5, backgroundColor: "#FFEBEE" },
  errorTextRed: { color: "#E53935", fontSize: 11, fontWeight: "bold", marginTop: 4 },
  label: { fontSize: 11, fontWeight: "bold", color: "#475569", marginTop: 8, marginBottom: 4 },
  btnGuardar: { backgroundColor: MJM_BLUE, paddingVertical: 11, borderRadius: 8, alignItems: "center", marginTop: 20 },
  alertContent: { backgroundColor: "white", borderRadius: 16, padding: 20, width: "100%", maxWidth: 320, alignItems: "center" },
});