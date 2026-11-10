import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
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

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";
const MJM_BLUE = "#024885";

const ThemedText = ({ style, children, ...props }: any) => (
  <Text style={style} {...props}>
    {children}
  </Text>
);

const INITIAL_VIA_STATE = {
  nombre_via: "",
  id_tipo_via: null,
  id_distrito: null,
  estado: 1,
};

export default function ViaScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  // Catálogos
  const [tiposVia, setTiposVia] = useState<any[]>([]);
  const [distritos, setDistritos] = useState<any[]>([]);

  // Datos principales y conteos
  const [vias, setVias] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({ total: 0, activos: 0, inactivos: 0 });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tipoViaSel, setTipoViaSel] = useState("TODOS");
  const [estadoSel, setEstadoSel] = useState("TODOS");

  // Paginación y Carga
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modales y Alertas
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success",
  });

  const [viaEdit, setViaEdit] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [nuevaVia, setNuevaVia] = useState<any>(INITIAL_VIA_STATE);

  // 1. Cargar Catálogos
  useEffect(() => {
    fetch(`${API_URL}/lugar-vias`)
      .then((res) => res.json())
      .then((data) => {
        const tVias = data.tiposVia || [];
        const dLista = data.distritos || [];
        setTiposVia(tVias);
        setDistritos(dLista);

        setNuevaVia((prev: any) => ({
          ...prev,
          id_tipo_via: tVias[0]?.id_tipo_via || null,
          id_distrito: dLista[0]?.id_distrito || null,
        }));
      })
      .catch((e) => console.error("❌ Error cargando catálogos de vías:", e));
  }, []);

  const abrirModalEditar = (item: any) => {
    setViaEdit({
      ...item,
      id_distrito: item.id_distrito || distritos[0]?.id_distrito || null,
      nombre_via: item.nombre_via || "",
      id_tipo_via: item.id_tipo_via || tiposVia[0]?.id_tipo_via || null,
      estado: item.estado !== undefined ? item.estado : 1,
    });
    setModalVisible(true);
  };

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
          tipo_via: tipoViaSel,
          estado: estadoSel,
          page: nextPage.toString(),
        });

        const res = await fetch(`${API_URL}/viastotal?${query}`);
        const result = await res.json();

        setCounts({
          total: result.counts?.total || 0,
          activos: result.counts?.activos || 0,
          inactivos: result.counts?.inactivos || 0,
        });

        const newRecords = result.data || [];
        setVias((prev) => (reset ? newRecords : [...prev, ...newRecords]));
        setHasMore(Boolean(result.pagination?.hasMore));
        setPage(nextPage + 1);
      } catch (e) {
        console.error("❌ Error al cargar /viastotal:", e);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, tipoViaSel, estadoSel, page, loading]
  );

  useEffect(() => {
    setHasMore(true);
    setPage(1);
    cargarDatos(true);
  }, [debouncedSearch, tipoViaSel, estadoSel]);

  const handleLoadMore = () => {
    if (!loading && hasMore) cargarDatos(false);
  };

  const exportarExcel = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        q: debouncedSearch,
        tipo_via: tipoViaSel,
        estado: estadoSel,
        export: "true",
      });

      const res = await fetch(`${API_URL}/viastotal?${query}`);
      const result = await res.json();
      const dataCompleta = result.data || [];

      if (dataCompleta.length === 0) {
        setCustomAlert({
          visible: true,
          title: "Sin datos",
          message: "No existen registros para exportar con los filtros seleccionados.",
          type: "error",
        });
        return;
      }

      const datosFormato = dataCompleta.map((v: any) => ({
        ID: v.id_via,
        DISTRITO: v.nombre_distrito || "",
        "NOMBRE VÍA": v.nombre_via || "",
        "TIPO VÍA": v.nombre_tipo_via || v.abreviatura || "",
        ESTADO: v.estado === 1 ? "ACTIVO" : "INACTIVO",
      }));

      const worksheet = XLSX.utils.json_to_sheet(datosFormato);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Vias");
      XLSX.writeFile(workbook, "Reporte_Vias.xlsx");
    } catch (e) {
      console.error("Error exportando excel:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarCambios = async () => {
    if (!viaEdit || !viaEdit.nombre_via || !viaEdit.id_tipo_via || !viaEdit.id_distrito) {
      setCustomAlert({
        visible: true,
        title: "Campos Obligatorios",
        message: "Por favor complete Distrito, Nombre y Tipo de Vía.",
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/updatevia/${viaEdit.id_via}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(viaEdit),
      });

      const data = await res.json();

      if (!res.ok) {
        setCustomAlert({
          visible: true,
          title: "Atención",
          message: data.message || "Ocurrió un error al actualizar.",
          type: "error",
        });
        return;
      }

      setModalVisible(false);
      setCustomAlert({
        visible: true,
        title: "¡Éxito!",
        message: "Vía actualizada correctamente.",
        type: "success",
      });
      cargarDatos(true);
    } catch (e) {
      setCustomAlert({
        visible: true,
        title: "Error de Conexión",
        message: "No se pudo conectar con el servidor.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarNuevo = async () => {
    if (!nuevaVia.nombre_via || !nuevaVia.id_tipo_via || !nuevaVia.id_distrito) {
      setCustomAlert({
        visible: true,
        title: "Campos Obligatorios",
        message: "Por favor seleccione Distrito, Tipo de Vía e ingrese el Nombre.",
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/insertvia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaVia),
      });

      const data = await res.json();

      if (!res.ok) {
        setCustomAlert({
          visible: true,
          title: "Atención",
          message: data.message || "No se pudo registrar la vía.",
          type: "error",
        });
        return;
      }

      setModalCrearVisible(false);
      setNuevaVia({
        ...INITIAL_VIA_STATE,
        id_tipo_via: tiposVia[0]?.id_tipo_via || null,
        id_distrito: distritos[0]?.id_distrito || null,
      });

      setCustomAlert({
        visible: true,
        title: "¡Éxito!",
        message: "Vía registrada correctamente.",
        type: "success",
      });
      cargarDatos(true);
    } catch (e) {
      setCustomAlert({
        visible: true,
        title: "Error de Red",
        message: "No se pudo procesar la solicitud.",
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
            <ThemedText style={styles.headerTitle}>Cat. Vías</ThemedText>
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
                { id: "1", l: "ACT.", c: counts.activos },
                { id: "0", l: "INAC.", c: counts.inactivos },
              ].map((e) => (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => setEstadoSel(e.id)}
                  style={[styles.btnEstado, estadoSel === e.id && styles.btnEstadoActive]}
                >
                  <Text style={[styles.btnText, estadoSel === e.id && { color: "white" }]}>
                    {e.l} {e.c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.btnAdd} onPress={() => setModalCrearVisible(true)}>
            <Ionicons name="add" size={22} color="white" />
          </TouchableOpacity>
        </View>

        {/* BÚSQUEDA */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            placeholder="Buscar por nombre de vía..."
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

        {/* FILTROS POR TIPO DE VÍA */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Tipo:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setTipoViaSel("TODOS")}
              style={[styles.btnChip, tipoViaSel === "TODOS" && styles.btnActive]}
            >
              <Text style={[styles.btnText, tipoViaSel === "TODOS" && { color: "#FFF" }]}>TODOS</Text>
            </TouchableOpacity>
            {tiposVia.map((tv) => (
              <TouchableOpacity
                key={tv.id_tipo_via}
                onPress={() => setTipoViaSel(tv.id_tipo_via.toString())}
                style={[styles.btnChip, tipoViaSel === tv.id_tipo_via.toString() && styles.btnActive]}
              >
                <Text style={[styles.btnText, tipoViaSel === tv.id_tipo_via.toString() && { color: "#FFF" }]}>
                  {tv.abreviatura || tv.descripcion}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* ENCABEZADO ESCRITORIO */}
      {isDesktop && (
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.6, textAlign: "center" }]}>
            ID
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1.2, textAlign: "center" }]}>
            DISTRITO
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 2, textAlign: "center" }]}>
            NOMBRE VÍA
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1.2, textAlign: "center" }]}>
            TIPO VÍA
          </Text>
          <Text style={[styles.cell, styles.headerText, { flex: 0.8, textAlign: "center" }]}>
            ESTADO
          </Text>
        </View>
      )}

      {/* LISTADO DE VÍAS */}
      <FlatList
        data={vias}
        keyExtractor={(item, index) => `${item.id_via}-${index}`}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={isDesktop ? styles.tableRow : styles.mobileCard}
            onPress={() => abrirModalEditar(item)}
          >
            {isDesktop ? (
              <>
                <Text style={[styles.cell, styles.cellBorder, { flex: 0.6, fontWeight: "bold", textAlign: "center" }]}>
                  {item.id_via}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1.2 }]} numberOfLines={1}>
                  {item.nombre_distrito || "-"}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 2, fontWeight: "600" }]} numberOfLines={1}>
                  {item.nombre_via || "-"}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1.2 }]} numberOfLines={1}>
                  {item.nombre_tipo_via || item.abreviatura || "-"}
                </Text>
                <View style={[styles.cell, { flex: 0.8, alignItems: "center" }]}>
                  <BadgeEstado estado={item.estado} />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 13, color: "#0F172A" }}>
                    {item.nombre_via || "Sin nombre"}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                    Distrito: {item.nombre_distrito || "-"} | Tipo: {item.nombre_tipo_via || item.abreviatura}
                  </Text>
                </View>
                <BadgeEstado estado={item.estado} />
              </View>
            )}
          </TouchableOpacity>
        )}
        ListFooterComponent={loading ? <ActivityIndicator size="small" color={MJM_BLUE} style={{ margin: 15 }} /> : undefined}
      />

      {/* MODAL EDITAR VÍA */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => { if (Platform.OS === 'web') e.stopPropagation(); }}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>Editar Vía</ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {viaEdit && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <ThemedText style={styles.label}>Distrito *</ThemedText>
                <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
                  <Picker
                    selectedValue={viaEdit.id_distrito ? String(viaEdit.id_distrito) : ""}
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) => setViaEdit({ ...viaEdit, id_distrito: val ? Number(val) : null })}
                  >
                    <Picker.Item label="-- SELECCIONE DISTRITO --" value="" color="#888888" />
                    {distritos.map((d: any) => (
                      <Picker.Item key={String(d.id_distrito)} label={d.nombre_distrito || ""} value={String(d.id_distrito)} color="#000000" />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Nombre de Vía *</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ej: AV. ..."
                  value={viaEdit.nombre_via}
                  onChangeText={(t) => setViaEdit({ ...viaEdit, nombre_via: t })}
                />

                <ThemedText style={styles.label}>Tipo de Vía *</ThemedText>
                <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
                  <Picker
                    selectedValue={viaEdit.id_tipo_via ? String(viaEdit.id_tipo_via) : ""}
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) => setViaEdit({ ...viaEdit, id_tipo_via: val ? Number(val) : null })}
                  >
                    <Picker.Item label="-- SELECCIONE TIPO --" value="" color="#888888" />
                    {tiposVia.map((tv: any) => (
                      <Picker.Item key={String(tv.id_tipo_via)} label={tv.descripcion || tv.abreviatura || ""} value={String(tv.id_tipo_via)} color="#000000" />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Estado</ThemedText>
                <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
                  <Picker
                    selectedValue={viaEdit.estado !== null && viaEdit.estado !== undefined ? String(viaEdit.estado) : ""}
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) => setViaEdit({ ...viaEdit, estado: val !== "" && val !== null ? Number(val) : 0 })}
                  >
                    <Picker.Item label="-- SELECCIONE ESTADO --" value="" color="#888888" />
                    <Picker.Item label="ACTIVO" value="1" color="#000000" />
                    <Picker.Item label="INACTIVO" value="0" color="#000000" />
                  </Picker>
                </View>

                <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardarCambios} disabled={loading}>
                  {loading ? <ActivityIndicator color="white" /> : <ThemedText style={{ color: "white", fontWeight: "bold" }}>GUARDAR CAMBIOS</ThemedText>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MODAL CREAR VÍA */}
      <Modal visible={modalCrearVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalCrearVisible(false)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => { if (Platform.OS === 'web') e.stopPropagation(); }}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>Nueva Vía</ThemedText>
              <TouchableOpacity onPress={() => setModalCrearVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.label}>Distrito *</ThemedText>
              <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
                <Picker
                  selectedValue={nuevaVia.id_distrito !== null && nuevaVia.id_distrito !== undefined ? String(nuevaVia.id_distrito) : ""}
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) => setNuevaVia({ ...nuevaVia, id_distrito: val ? Number(val) : null })}
                >
                  <Picker.Item label="-- SELECCIONE DISTRITO --" value="" color="#888888" />
                  {distritos.map((d: any) => (
                    <Picker.Item key={String(d.id_distrito)} label={d.nombre_distrito || ""} value={String(d.id_distrito)} color="#000000" />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.label}>Nombre de Vía *</ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="Ingrese el nombre de la vía"
                value={nuevaVia.nombre_via}
                onChangeText={(t) => setNuevaVia({ ...nuevaVia, nombre_via: t })}
              />

              <ThemedText style={styles.label}>Tipo de Vía *</ThemedText>
              <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
                <Picker
                  selectedValue={nuevaVia.id_tipo_via !== null && nuevaVia.id_tipo_via !== undefined ? String(nuevaVia.id_tipo_via) : ""}
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) => setNuevaVia({ ...nuevaVia, id_tipo_via: val ? Number(val) : null })}
                >
                  <Picker.Item label="-- SELECCIONE TIPO --" value="" color="#888888" />
                  {tiposVia.map((tv: any) => (
                    <Picker.Item key={String(tv.id_tipo_via)} label={tv.descripcion || tv.abreviatura || ""} value={String(tv.id_tipo_via)} color="#000000" />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.label}>Estado</ThemedText>
              <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
                <Picker
                  selectedValue={nuevaVia.estado !== null && nuevaVia.estado !== undefined ? String(nuevaVia.estado) : ""}
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) => setNuevaVia({ ...nuevaVia, estado: val !== "" && val !== null ? Number(val) : 0 })}
                >
                  <Picker.Item label="-- SELECCIONE ESTADO --" value="" color="#888888" />
                  <Picker.Item label="ACTIVO" value="1" color="#000000" />
                  <Picker.Item label="INACTIVO" value="0" color="#000000" />
                </Picker>
              </View>

              <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardarNuevo} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : <ThemedText style={{ color: "white", fontWeight: "bold" }}>REGISTRAR VÍA</ThemedText>}
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ALERTA CUSTOM */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCustomAlert({ ...customAlert, visible: false })}>
          <TouchableOpacity style={styles.alertContent} activeOpacity={1} onPress={(e) => { if (Platform.OS === 'web') e.stopPropagation(); }}>
            <Ionicons
              name={customAlert.type === "success" ? "checkmark-circle" : "alert-circle"}
              size={55}
              color={customAlert.type === "success" ? "#2E7D32" : "#E53935"}
            />
            <ThemedText
              style={{
                fontSize: 16,
                fontWeight: "bold",
                marginTop: 10,
                color: customAlert.type === "error" ? "#E53935" : "#0F172A",
              }}
            >
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { padding: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: MJM_BLUE },
  btnAdd: { backgroundColor: MJM_BLUE, width: 38, height: 38, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  estadoToggle: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 8, padding: 2, gap: 2, flexShrink: 1 },
  btnEstado: { paddingHorizontal: 6, paddingVertical: 5, borderRadius: 6, alignItems: "center" },
  btnEstadoActive: { backgroundColor: MJM_BLUE },
  btnText: { fontSize: 10, fontWeight: "600", color: "#64748B" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 12, height: 40, marginBottom: 8 },
  input: { flex: 1, marginLeft: 8, color: "#0F172A", fontSize: 13 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: "bold", color: "#64748B" },
  btnChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F1F5F9" },
  btnActive: { backgroundColor: MJM_BLUE },
  tableHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#024885" },
  headerText: { fontWeight: "bold", fontSize: 11, color: "#FFFFFF" },
  tableRow: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderColor: "#F1F5F9", alignItems: "center" },
  mobileCard: { backgroundColor: "#FFFFFF", padding: 14, marginHorizontal: 16, marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  cell: { fontSize: 12, color: "#334155", paddingHorizontal: 4 },
  cellBorder: { borderRightWidth: 1, borderRightColor: "#E2E8F0" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 16 },
  modalContent: { backgroundColor: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 500, maxHeight: "90%" },
  alertContent: { backgroundColor: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360, alignItems: "center" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "bold", color: "#475569", marginTop: 8, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 10, fontSize: 13, color: "#0F172A" },
  modalPickerContainer: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    overflow: "hidden",
    height: 45,
  },
  btnGuardar: { backgroundColor: MJM_BLUE, padding: 12, borderRadius: 8, alignItems: "center", marginTop: 16 },
});