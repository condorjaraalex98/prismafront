import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import * as XLSX from "xlsx";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";
const MJM_BLUE = "#024885";
const DEFAULT_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

const ThemedText = ({ style, children, ...props }: any) => (
  <Text style={style} {...props}>
    {children}
  </Text>
);

const INITIAL_VIA_STATE = {
  nombre_via: "",
  id_tipo_via: null as number | null,
  id_distrito: null as number | null,
  estado: 1,
};

const str = (val: unknown): string =>
  val === null || val === undefined ? "" : String(val);

export default function ViaScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
  const insets = useContext(SafeAreaInsetsContext) ?? DEFAULT_INSETS;

  // Catálogos
  const [tiposVia, setTiposVia] = useState<any[]>([]);
  const [distritos, setDistritos] = useState<any[]>([]);

  // Datos principales y conteos
  const [vias, setVias] = useState<any[]>([]);
  const [counts, setCounts] = useState({ total: 0, activos: 0, inactivos: 0 });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tipoViaSel, setTipoViaSel] = useState("TODOS");
  const [estadoSel, setEstadoSel] = useState("TODOS");

  // Carga separada: listado vs mutaciones
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modales y Alertas
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success" as "success" | "error",
  });

  const [viaEdit, setViaEdit] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [nuevaVia, setNuevaVia] = useState<any>(INITIAL_VIA_STATE);

  const isMountedRef = useRef(true);
  const pageRef = useRef(1);
  const loadingListRef = useRef(false);
  const savingRef = useRef(false);
  const listAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      listAbortRef.current?.abort();
    };
  }, []);

  const notificar = useCallback(
    (
      title: string,
      message: string,
      type: "success" | "error" = "success"
    ) => {
      if (Platform.OS !== "web") {
        Alert.alert(title, message);
      } else {
        setCustomAlert({ visible: true, title, message, type });
      }
    },
    []
  );

  // 1. Cargar Catálogos
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    fetch(`${API_URL}/lugar-vias`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMountedRef.current) return;
        const tVias = Array.isArray(data.tiposVia) ? data.tiposVia : [];
        const dLista = Array.isArray(data.distritos) ? data.distritos : [];
        setTiposVia(tVias);
        setDistritos(dLista);

        setNuevaVia((prev: any) => ({
          ...prev,
          id_tipo_via: prev.id_tipo_via ?? tVias[0]?.id_tipo_via ?? null,
          id_distrito: prev.id_distrito ?? dLista[0]?.id_distrito ?? null,
        }));
      })
      .catch((e: any) => {
        if (e?.name !== "AbortError") {
          console.error("❌ Error cargando catálogos de vías:", e);
        }
      })
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const abrirModalEditar = (item: any) => {
    setViaEdit({
      ...item,
      id_distrito: item.id_distrito || distritos[0]?.id_distrito || null,
      nombre_via: str(item.nombre_via),
      id_tipo_via: item.id_tipo_via || tiposVia[0]?.id_tipo_via || null,
      estado: item.estado !== undefined && item.estado !== null ? Number(item.estado) : 1,
    });
    setModalVisible(true);
  };

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchText), 350);
    return () => clearTimeout(handler);
  }, [searchText]);

  const cargarDatos = useCallback(
    async (reset = false) => {
      if (!reset && loadingListRef.current) return;

      if (reset) {
        listAbortRef.current?.abort();
        pageRef.current = 1;
      }

      const controller = new AbortController();
      listAbortRef.current = controller;
      const timer = setTimeout(() => controller.abort(), 15000);

      loadingListRef.current = true;
      setLoadingList(true);

      try {
        const nextPage = reset ? 1 : pageRef.current;
        const query = new URLSearchParams({
          q: debouncedSearch,
          tipo_via: tipoViaSel,
          estado: estadoSel,
          page: nextPage.toString(),
        });

        const res = await fetch(`${API_URL}/viastotal?${query}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();

        if (!isMountedRef.current) return;

        setCounts({
          total: result.counts?.total || 0,
          activos: result.counts?.activos || 0,
          inactivos: result.counts?.inactivos || 0,
        });

        const newRecords = Array.isArray(result.data) ? result.data : [];
        setVias((prev) => (reset ? newRecords : [...prev, ...newRecords]));
        setHasMore(Boolean(result.pagination?.hasMore));
        pageRef.current = nextPage + 1;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("❌ Error al cargar /viastotal:", e);
        if (isMountedRef.current) {
          notificar("Error", "No se pudo cargar el listado de vías.", "error");
        }
      } finally {
        clearTimeout(timer);
        if (listAbortRef.current === controller) {
          loadingListRef.current = false;
          if (isMountedRef.current) setLoadingList(false);
        }
      }
    },
    [debouncedSearch, tipoViaSel, estadoSel, notificar]
  );

  useEffect(() => {
    setHasMore(true);
    cargarDatos(true);
  }, [cargarDatos]);

  const handleLoadMore = () => {
    if (!loadingListRef.current && hasMore && vias.length > 0) {
      cargarDatos(false);
    }
  };

  const exportarExcel = async () => {
    if (savingRef.current) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      savingRef.current = true;
      setSaving(true);
      const query = new URLSearchParams({
        q: debouncedSearch,
        tipo_via: tipoViaSel,
        estado: estadoSel,
        export: "true",
      });

      const res = await fetch(`${API_URL}/viastotal?${query}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const dataCompleta = Array.isArray(result.data) ? result.data : [];

      if (!isMountedRef.current) return;

      if (dataCompleta.length === 0) {
        notificar(
          "Sin datos",
          "No existen registros para exportar con los filtros seleccionados.",
          "error"
        );
        return;
      }

      const datosFormato = dataCompleta.map((v: any) => ({
        ID: v.id_via,
        DISTRITO: v.nombre_distrito || "",
        "NOMBRE VÍA": v.nombre_via || "",
        "TIPO VÍA": v.nombre_tipo_via || v.abreviatura || "",
        ESTADO: Number(v.estado) === 1 ? "ACTIVO" : "INACTIVO",
      }));

      const worksheet = XLSX.utils.json_to_sheet(datosFormato);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Vias");
      XLSX.writeFile(workbook, "Reporte_Vias.xlsx");
    } catch (e: any) {
      if (e?.name === "AbortError") {
        notificar("Error", "La exportación tardó demasiado.", "error");
      } else {
        console.error("Error exportando excel:", e);
        notificar("Error", "No se pudo generar el Excel.", "error");
      }
    } finally {
      clearTimeout(timer);
      savingRef.current = false;
      if (isMountedRef.current) setSaving(false);
    }
  };

  const handleGuardarCambios = async () => {
    if (savingRef.current) return;

    if (
      !viaEdit ||
      !String(viaEdit.nombre_via || "").trim() ||
      !viaEdit.id_tipo_via ||
      !viaEdit.id_distrito
    ) {
      notificar(
        "Campos Obligatorios",
        "Por favor complete Distrito, Nombre y Tipo de Vía.",
        "error"
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${API_URL}/updatevia/${viaEdit.id_via}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(viaEdit),
        signal: controller.signal,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      if (!isMountedRef.current) return;

      if (!res.ok) {
        notificar(
          "Atención",
          data.message || "Ocurrió un error al actualizar.",
          "error"
        );
        return;
      }

      setModalVisible(false);
      notificar("¡Éxito!", "Vía actualizada correctamente.", "success");
      cargarDatos(true);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      notificar(
        "Error de Conexión",
        e?.name === "AbortError"
          ? "El servidor tardó demasiado en responder."
          : "No se pudo conectar con el servidor.",
        "error"
      );
    } finally {
      clearTimeout(timer);
      savingRef.current = false;
      if (isMountedRef.current) setSaving(false);
    }
  };

  const handleGuardarNuevo = async () => {
    if (savingRef.current) return;

    if (
      !String(nuevaVia.nombre_via || "").trim() ||
      !nuevaVia.id_tipo_via ||
      !nuevaVia.id_distrito
    ) {
      notificar(
        "Campos Obligatorios",
        "Por favor seleccione Distrito, Tipo de Vía e ingrese el Nombre.",
        "error"
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${API_URL}/insertvia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaVia),
        signal: controller.signal,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      if (!isMountedRef.current) return;

      if (!res.ok) {
        notificar(
          "Atención",
          data.message || "No se pudo registrar la vía.",
          "error"
        );
        return;
      }

      setModalCrearVisible(false);
      setNuevaVia({
        ...INITIAL_VIA_STATE,
        id_tipo_via: tiposVia[0]?.id_tipo_via || null,
        id_distrito: distritos[0]?.id_distrito || null,
      });

      notificar("¡Éxito!", "Vía registrada correctamente.", "success");
      cargarDatos(true);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      notificar(
        "Error de Red",
        e?.name === "AbortError"
          ? "El servidor tardó demasiado en responder."
          : "No se pudo procesar la solicitud.",
        "error"
      );
    } finally {
      clearTimeout(timer);
      savingRef.current = false;
      if (isMountedRef.current) setSaving(false);
    }
  };

  const BadgeEstado = ({ estado }: { estado: number }) => (
    <View
      style={[
        styles.badge,
        { backgroundColor: Number(estado) === 1 ? "#E8F5E9" : "#FFEBEE" },
      ]}
    >
      <Text
        style={{
          color: Number(estado) === 1 ? "#2E7D32" : "#C62828",
          fontSize: 10,
          fontWeight: "bold",
        }}
      >
        {Number(estado) === 1 ? "ACTIVO" : "INACTIVO"}
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 0 : insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              flex: 1,
            }}
          >
            <ThemedText style={styles.headerTitle}>Cat. Vías</ThemedText>

            {Platform.OS === "web" && (
              <TouchableOpacity
                onPress={exportarExcel}
                disabled={saving}
                style={[
                  styles.btnAdd,
                  {
                    backgroundColor: MJM_BLUE,
                    width: 34,
                    height: 34,
                    opacity: saving ? 0.6 : 1,
                  },
                ]}
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
                  style={[
                    styles.btnEstado,
                    estadoSel === e.id && styles.btnEstadoActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      estadoSel === e.id && { color: "white" },
                    ]}
                  >
                    {e.l} {e.c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.btnAdd}
            onPress={() => {
              setNuevaVia({
                ...INITIAL_VIA_STATE,
                id_tipo_via: tiposVia[0]?.id_tipo_via || null,
                id_distrito: distritos[0]?.id_distrito || null,
              });
              setModalCrearVisible(true);
            }}
          >
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
            value={searchText ?? ""}
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            <TouchableOpacity
              onPress={() => setTipoViaSel("TODOS")}
              style={[
                styles.btnChip,
                tipoViaSel === "TODOS" && styles.btnActive,
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  tipoViaSel === "TODOS" && { color: "#FFF" },
                ]}
              >
                TODOS
              </Text>
            </TouchableOpacity>
            {tiposVia.map((tv) => (
              <TouchableOpacity
                key={tv.id_tipo_via}
                onPress={() => setTipoViaSel(String(tv.id_tipo_via))}
                style={[
                  styles.btnChip,
                  tipoViaSel === String(tv.id_tipo_via) && styles.btnActive,
                ]}
              >
                <Text
                  style={[
                    styles.btnText,
                    tipoViaSel === String(tv.id_tipo_via) && { color: "#FFF" },
                  ]}
                >
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
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 0.6, textAlign: "center" },
            ]}
          >
            ID
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 1.2, textAlign: "center" },
            ]}
          >
            DISTRITO
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 2, textAlign: "center" },
            ]}
          >
            NOMBRE VÍA
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 1.2, textAlign: "center" },
            ]}
          >
            TIPO VÍA
          </Text>
          <Text
            style={[
              styles.cell,
              styles.headerText,
              { flex: 0.8, textAlign: "center" },
            ]}
          >
            ESTADO
          </Text>
        </View>
      )}

      {/* LISTADO DE VÍAS */}
      <FlatList
        data={vias}
        keyExtractor={(item, index) => `${item.id_via ?? "v"}-${index}`}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={5}
        removeClippedSubviews={Platform.OS !== "web"}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          !loadingList ? (
            <View style={{ padding: 30, alignItems: "center" }}>
              <Text style={{ color: "#64748B", fontSize: 13 }}>
                No se encontraron vías con los filtros seleccionados.
              </Text>
            </View>
          ) : undefined
        }
        ListFooterComponent={
          loadingList ? (
            <ActivityIndicator
              size="small"
              color={MJM_BLUE}
              style={{ margin: 15 }}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={isDesktop ? styles.tableRow : styles.mobileCard}
            onPress={() => abrirModalEditar(item)}
          >
            {isDesktop ? (
              <>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 0.6, fontWeight: "bold", textAlign: "center" },
                  ]}
                >
                  {item.id_via}
                </Text>
                <Text
                  style={[styles.cell, styles.cellBorder, { flex: 1.2 }]}
                  numberOfLines={1}
                >
                  {item.nombre_distrito || "-"}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 2, fontWeight: "600" },
                  ]}
                  numberOfLines={1}
                >
                  {item.nombre_via || "-"}
                </Text>
                <Text
                  style={[styles.cell, styles.cellBorder, { flex: 1.2 }]}
                  numberOfLines={1}
                >
                  {item.nombre_tipo_via || item.abreviatura || "-"}
                </Text>
                <View style={[styles.cell, { flex: 0.8, alignItems: "center" }]}>
                  <BadgeEstado estado={item.estado} />
                </View>
              </>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text
                    style={{
                      fontWeight: "bold",
                      fontSize: 13,
                      color: "#0F172A",
                    }}
                  >
                    {item.nombre_via || "Sin nombre"}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}
                  >
                    Distrito: {item.nombre_distrito || "-"} | Tipo:{" "}
                    {item.nombre_tipo_via || item.abreviatura}
                  </Text>
                </View>
                <BadgeEstado estado={item.estado} />
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* MODAL EDITAR VÍA */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!saving) setModalVisible(false);
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>Editar Vía</ThemedText>
              <TouchableOpacity
                disabled={saving}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {viaEdit && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <ThemedText style={styles.label}>Distrito *</ThemedText>
                <View
                  style={[
                    styles.modalPickerContainer,
                    { backgroundColor: "#FFFFFF" },
                  ]}
                >
                  <Picker
                    selectedValue={
                      viaEdit.id_distrito ? String(viaEdit.id_distrito) : ""
                    }
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) =>
                      setViaEdit((prev: any) => ({
                        ...prev,
                        id_distrito: val ? Number(val) : null,
                      }))
                    }
                  >
                    <Picker.Item
                      label="-- SELECCIONE DISTRITO --"
                      value=""
                      color="#888888"
                    />
                    {distritos.map((d: any) => (
                      <Picker.Item
                        key={String(d.id_distrito)}
                        label={d.nombre_distrito || ""}
                        value={String(d.id_distrito)}
                        color="#000000"
                      />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Nombre de Vía *</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ej: AV. ..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  maxLength={120}
                  value={viaEdit.nombre_via ?? ""}
                  onChangeText={(t) =>
                    setViaEdit((prev: any) => ({ ...prev, nombre_via: t }))
                  }
                />

                <ThemedText style={styles.label}>Tipo de Vía *</ThemedText>
                <View
                  style={[
                    styles.modalPickerContainer,
                    { backgroundColor: "#FFFFFF" },
                  ]}
                >
                  <Picker
                    selectedValue={
                      viaEdit.id_tipo_via ? String(viaEdit.id_tipo_via) : ""
                    }
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) =>
                      setViaEdit((prev: any) => ({
                        ...prev,
                        id_tipo_via: val ? Number(val) : null,
                      }))
                    }
                  >
                    <Picker.Item
                      label="-- SELECCIONE TIPO --"
                      value=""
                      color="#888888"
                    />
                    {tiposVia.map((tv: any) => (
                      <Picker.Item
                        key={String(tv.id_tipo_via)}
                        label={tv.descripcion || tv.abreviatura || ""}
                        value={String(tv.id_tipo_via)}
                        color="#000000"
                      />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Estado</ThemedText>
                <View
                  style={[
                    styles.modalPickerContainer,
                    { backgroundColor: "#FFFFFF" },
                  ]}
                >
                  <Picker
                    selectedValue={String(viaEdit.estado ?? 1)}
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) =>
                      setViaEdit((prev: any) => ({
                        ...prev,
                        estado: Number(val),
                      }))
                    }
                  >
                    <Picker.Item label="ACTIVO" value="1" color="#000000" />
                    <Picker.Item label="INACTIVO" value="0" color="#000000" />
                  </Picker>
                </View>

                <TouchableOpacity
                  style={[styles.btnGuardar, { opacity: saving ? 0.6 : 1 }]}
                  onPress={handleGuardarCambios}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                      GUARDAR CAMBIOS
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL CREAR VÍA */}
      <Modal
        visible={modalCrearVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setModalCrearVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!saving) setModalCrearVisible(false);
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>Nueva Vía</ThemedText>
              <TouchableOpacity
                disabled={saving}
                onPress={() => setModalCrearVisible(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <ThemedText style={styles.label}>Distrito *</ThemedText>
              <View
                style={[
                  styles.modalPickerContainer,
                  { backgroundColor: "#FFFFFF" },
                ]}
              >
                <Picker
                  selectedValue={
                    nuevaVia.id_distrito !== null &&
                    nuevaVia.id_distrito !== undefined
                      ? String(nuevaVia.id_distrito)
                      : ""
                  }
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) =>
                    setNuevaVia((prev: any) => ({
                      ...prev,
                      id_distrito: val ? Number(val) : null,
                    }))
                  }
                >
                  <Picker.Item
                    label="-- SELECCIONE DISTRITO --"
                    value=""
                    color="#888888"
                  />
                  {distritos.map((d: any) => (
                    <Picker.Item
                      key={String(d.id_distrito)}
                      label={d.nombre_distrito || ""}
                      value={String(d.id_distrito)}
                      color="#000000"
                    />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.label}>Nombre de Vía *</ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="Ingrese el nombre de la vía"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                maxLength={120}
                value={nuevaVia.nombre_via ?? ""}
                onChangeText={(t) =>
                  setNuevaVia((prev: any) => ({ ...prev, nombre_via: t }))
                }
              />

              <ThemedText style={styles.label}>Tipo de Vía *</ThemedText>
              <View
                style={[
                  styles.modalPickerContainer,
                  { backgroundColor: "#FFFFFF" },
                ]}
              >
                <Picker
                  selectedValue={
                    nuevaVia.id_tipo_via !== null &&
                    nuevaVia.id_tipo_via !== undefined
                      ? String(nuevaVia.id_tipo_via)
                      : ""
                  }
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) =>
                    setNuevaVia((prev: any) => ({
                      ...prev,
                      id_tipo_via: val ? Number(val) : null,
                    }))
                  }
                >
                  <Picker.Item
                    label="-- SELECCIONE TIPO --"
                    value=""
                    color="#888888"
                  />
                  {tiposVia.map((tv: any) => (
                    <Picker.Item
                      key={String(tv.id_tipo_via)}
                      label={tv.descripcion || tv.abreviatura || ""}
                      value={String(tv.id_tipo_via)}
                      color="#000000"
                    />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.label}>Estado</ThemedText>
              <View
                style={[
                  styles.modalPickerContainer,
                  { backgroundColor: "#FFFFFF" },
                ]}
              >
                <Picker
                  selectedValue={String(nuevaVia.estado ?? 1)}
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) =>
                    setNuevaVia((prev: any) => ({
                      ...prev,
                      estado: Number(val),
                    }))
                  }
                >
                  <Picker.Item label="ACTIVO" value="1" color="#000000" />
                  <Picker.Item label="INACTIVO" value="0" color="#000000" />
                </Picker>
              </View>

              <TouchableOpacity
                style={[styles.btnGuardar, { opacity: saving ? 0.6 : 1 }]}
                onPress={handleGuardarNuevo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                    REGISTRAR VÍA
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ALERTA CUSTOM (WEB) */}
      <Modal
        visible={customAlert.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setCustomAlert((prev) => ({ ...prev, visible: false }))
        }
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() =>
              setCustomAlert((prev) => ({ ...prev, visible: false }))
            }
          />
          <View style={styles.alertContent}>
            <Ionicons
              name={
                customAlert.type === "success"
                  ? "checkmark-circle"
                  : "alert-circle"
              }
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
            <ThemedText
              style={{
                textAlign: "center",
                color: "#64748B",
                marginTop: 8,
                fontSize: 13,
              }}
            >
              {customAlert.message}
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.btnGuardar,
                { width: "100%", marginTop: 18 },
                customAlert.type === "error" && { backgroundColor: "#E53935" },
              ]}
              onPress={() =>
                setCustomAlert((prev) => ({ ...prev, visible: false }))
              }
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                ENTENDIDO
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: MJM_BLUE },
  btnAdd: {
    backgroundColor: MJM_BLUE,
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  estadoToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 2,
    gap: 2,
    flexWrap: "wrap",
  },
  btnEstado: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: "center",
  },
  btnEstadoActive: { backgroundColor: MJM_BLUE },
  btnText: { fontSize: 10, fontWeight: "600", color: "#64748B" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  input: { flex: 1, marginLeft: 8, color: "#0F172A", fontSize: 13 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: "bold", color: "#64748B" },
  btnChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  btnActive: { backgroundColor: MJM_BLUE },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#024885",
  },
  headerText: { fontWeight: "bold", fontSize: 11, color: "#FFFFFF" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "center",
  },
  mobileCard: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cell: { fontSize: 12, color: "#334155", paddingHorizontal: 4 },
  cellBorder: { borderRightWidth: 1, borderRightColor: "#E2E8F0" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
  },
  alertContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  modalPickerContainer: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    overflow: "hidden",
    height: 45,
  },
  btnGuardar: {
    backgroundColor: MJM_BLUE,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
});