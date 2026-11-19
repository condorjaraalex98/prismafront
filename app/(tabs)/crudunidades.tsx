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

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";

const DEFAULT_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

const ThemedText = ({ style, children, ...props }: any) => (
  <Text style={style} {...props}>
    {children}
  </Text>
);

const MJM_BLUE = "#024885";

const INITIAL_FLOTA_STATE = {
  placa: "",
  id_tipo_vehiculo: "",
  numero_unidad: "",
  tipo_servicio: "MUNICIPAL",
  marca: "",
  modelo: "",
  año: new Date().getFullYear().toString(),
  estado: 1,
};

const str = (val: unknown): string =>
  val === null || val === undefined ? "" : String(val);

export default function FlotaScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
  const insets = useContext(SafeAreaInsetsContext) ?? DEFAULT_INSETS;

  const [flota, setFlota] = useState<any[]>([]);
  const [tiposVehiculo, setTiposVehiculo] = useState<any[]>([]);
  const [counts, setCounts] = useState({ total: 0, activos: 0, inactivos: 0 });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [estadoSel, setEstadoSel] = useState("TODOS");
  const [tipoVehiculoSel, setTipoVehiculoSel] = useState("TODOS");

  // Carga separada: listado vs mutaciones
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modales y Estados
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [placaDuplicadaMsg, setPlacaDuplicadaMsg] = useState("");
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success" as "success" | "error",
  });

  const [unidadEdit, setUnidadEdit] = useState<any>(null);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [nuevaUnidad, setNuevaUnidad] = useState(INITIAL_FLOTA_STATE);

  const isMountedRef = useRef(true);
  const pageRef = useRef(1);
  const loadingListRef = useRef(false);
  const savingRef = useRef(false);
  const listAbortRef = useRef<AbortController | null>(null);
  const placaAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      listAbortRef.current?.abort();
      placaAbortRef.current?.abort();
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

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchText), 350);
    return () => clearTimeout(handler);
  }, [searchText]);

  // Cargar Tipos de Vehículo
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const cargarTipos = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/tiposvehiculo`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!isMountedRef.current) return;
        setTiposVehiculo(data.data || data || []);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error("Error al cargar tipos de vehículo:", e);
        }
      } finally {
        clearTimeout(timer);
      }
    };

    cargarTipos();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

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
          estado: estadoSel,
          id_tipo_vehiculo: tipoVehiculoSel,
          page: nextPage.toString(),
        });

        const res = await fetch(`${API_BASE_URL}/flotatotal?${query}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();

        if (!isMountedRef.current) return;

        setCounts({
          total: result.pagination?.totalRecords ?? result.counts?.total ?? 0,
          activos: result.counts?.activos || 0,
          inactivos: result.counts?.inactivos || 0,
        });

        const newRecords = Array.isArray(result.data) ? result.data : [];
        setFlota((prev) => (reset ? newRecords : [...prev, ...newRecords]));
        setHasMore(Boolean(result.pagination?.hasMore ?? result.hasMore));
        pageRef.current = nextPage + 1;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("Error al cargar flota:", e);
        if (isMountedRef.current) {
          notificar("Error", "No se pudo cargar el listado de flota.", "error");
        }
      } finally {
        clearTimeout(timer);
        if (listAbortRef.current === controller) {
          loadingListRef.current = false;
          if (isMountedRef.current) setLoadingList(false);
        }
      }
    },
    [debouncedSearch, estadoSel, tipoVehiculoSel, notificar]
  );

  useEffect(() => {
    setHasMore(true);
    cargarDatos(true);
  }, [cargarDatos]);

  const handleLoadMore = () => {
    if (!loadingListRef.current && hasMore && flota.length > 0) {
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
        estado: estadoSel,
        id_tipo_vehiculo: tipoVehiculoSel,
        export: "true",
      });

      const res = await fetch(`${API_BASE_URL}/flotatotal?${query}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const dataCompleta = Array.isArray(result.data) ? result.data : [];

      if (!isMountedRef.current) return;

      if (dataCompleta.length === 0) {
        notificar("Sin datos", "No hay datos filtrados para exportar.", "error");
        return;
      }

      const datosFormato = dataCompleta.map((f: any) => ({
        ID: f.id_unidad,
        PLACA: f.placa || "",
        TIPO_VEHICULO: f.tipo_vehiculo_nombre || "",
        NUMERO_UNIDAD: f.numero_unidad || "",
        TIPO_SERVICIO: f.tipo_servicio || "",
        MARCA: f.marca || "",
        MODELO: f.modelo || "",
        AÑO: f.año || "",
        ESTADO: Number(f.estado) === 1 ? "ACTIVO" : "INACTIVO",
      }));

      const worksheet = XLSX.utils.json_to_sheet(datosFormato);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Flota Municipal");

      XLSX.writeFile(workbook, "Reporte_Flota_Municipal.xlsx");
    } catch (e: any) {
      if (e?.name === "AbortError") {
        notificar("Error", "La exportación tardó demasiado.", "error");
      } else {
        console.error("Error al exportar:", e);
        notificar("Error", "No se pudo exportar el Excel.", "error");
      }
    } finally {
      clearTimeout(timer);
      savingRef.current = false;
      if (isMountedRef.current) setSaving(false);
    }
  };

  const handlePlacaChange = async (text: string) => {
    const cleanPlaca = text.toUpperCase().trim();
    setNuevaUnidad((prev) => ({ ...prev, placa: cleanPlaca }));
    setErrors((prev) => (prev.placa ? { ...prev, placa: false } : prev));
    setPlacaDuplicadaMsg("");

    placaAbortRef.current?.abort();
    if (cleanPlaca.length < 6) return;

    const controller = new AbortController();
    placaAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(
        `${API_BASE_URL}/checkplacacop/${encodeURIComponent(cleanPlaca)}`,
        { signal: controller.signal }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!isMountedRef.current || placaAbortRef.current !== controller) return;

      if (data.existe) {
        setErrors((prev) => ({ ...prev, placa: true }));
        setPlacaDuplicadaMsg("⚠️ LA PLACA INGRESADA YA SE ENCUENTRA REGISTRADA");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      clearTimeout(timer);
    }
  };

  const handleGuardarNuevo = async () => {
    if (savingRef.current) return;

    const newErrors: Record<string, boolean> = {};
    const { placa, id_tipo_vehiculo, numero_unidad } = nuevaUnidad;

    if (!placa.trim()) newErrors.placa = true;
    if (!id_tipo_vehiculo) newErrors.id_tipo_vehiculo = true;
    if (!numero_unidad.trim()) newErrors.numero_unidad = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notificar(
        "Campos Faltantes",
        "Por favor ingrese la Placa, Tipo de Unidad y Número de Unidad.",
        "error"
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${API_BASE_URL}/insertflota`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaUnidad),
        signal: controller.signal,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      if (!isMountedRef.current) return;

      if (!res.ok) {
        if (res.status === 409 || data.code === "PLACA_DUPLICADA") {
          setErrors({ placa: true });
          setPlacaDuplicadaMsg("⚠️ LA PLACA INGRESADA YA SE ENCUENTRA REGISTRADA");
          notificar(
            "Registro Duplicado",
            data.message || "La placa ingresada ya existe.",
            "error"
          );
          return;
        }

        notificar(
          "Error",
          data.message || data.error || "No se pudo registrar la unidad.",
          "error"
        );
        return;
      }

      setModalCrearVisible(false);
      setNuevaUnidad(INITIAL_FLOTA_STATE);
      setPlacaDuplicadaMsg("");
      setErrors({});
      notificar("¡Éxito!", "Unidad registrada correctamente.", "success");
      cargarDatos(true);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      notificar(
        "Error de Red",
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

  const handleGuardarCambios = async () => {
    if (!unidadEdit || savingRef.current) return;

    if (
      !String(unidadEdit.placa || "").trim() ||
      !unidadEdit.id_tipo_vehiculo ||
      !String(unidadEdit.numero_unidad || "").trim()
    ) {
      notificar(
        "Campos Requeridos",
        "Placa, Tipo de Unidad y Número de Unidad son obligatorios.",
        "error"
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(
        `${API_BASE_URL}/updateflota/${unidadEdit.id_unidad}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(unidadEdit),
          signal: controller.signal,
        }
      );

      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      if (!isMountedRef.current) return;

      if (res.ok) {
        setModalEditarVisible(false);
        notificar("¡Éxito!", "Unidad actualizada correctamente.", "success");
        cargarDatos(true);
      } else {
        notificar(
          "Error",
          data.message || data.error || "No se pudo actualizar la unidad.",
          "error"
        );
      }
    } catch (e: any) {
      if (!isMountedRef.current) return;
      notificar(
        "Error de Red",
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
            <ThemedText style={styles.headerTitle}>Flota M.</ThemedText>

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
                { id: "1", l: "ACTIVOS", c: counts.activos },
                { id: "0", l: "INACTIVOS", c: counts.inactivos },
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
              setErrors({});
              setPlacaDuplicadaMsg("");
              setNuevaUnidad(INITIAL_FLOTA_STATE);
              setModalCrearVisible(true);
            }}
          >
            <Ionicons name="car-sport" size={18} color="white" />
          </TouchableOpacity>
        </View>

        {/* BADGES TIPO DE VEHÍCULO */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 10 }}
        >
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              onPress={() => setTipoVehiculoSel("TODOS")}
              style={[
                styles.badgeTipo,
                tipoVehiculoSel === "TODOS" && styles.badgeTipoActive,
              ]}
            >
              <Text
                style={[
                  styles.badgeTipoText,
                  tipoVehiculoSel === "TODOS" && { color: "white" },
                ]}
              >
                TODOS LOS TIPOS
              </Text>
            </TouchableOpacity>

            {tiposVehiculo.map((tv: any) => (
              <TouchableOpacity
                key={tv.id_tipo_vehiculo}
                onPress={() => setTipoVehiculoSel(String(tv.id_tipo_vehiculo))}
                style={[
                  styles.badgeTipo,
                  tipoVehiculoSel === String(tv.id_tipo_vehiculo) &&
                    styles.badgeTipoActive,
                ]}
              >
                <Text
                  style={[
                    styles.badgeTipoText,
                    tipoVehiculoSel === String(tv.id_tipo_vehiculo) && {
                      color: "white",
                    },
                  ]}
                >
                  {tv.descripcion?.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* BUSCADOR */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            placeholder="Buscar por Placa, N° Unidad, Marca o Modelo"
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
      </View>

      {/* CABECERA DESKTOP */}
      {isDesktop && (
        <View style={styles.tableHeader}>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 0.5, textAlign: "center" },
            ]}
          >
            ID
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 1, textAlign: "center" },
            ]}
          >
            PLACA
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 1.5, textAlign: "center" },
            ]}
          >
            TIPO UNIDAD
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 1, textAlign: "center" },
            ]}
          >
            N° UNIDAD
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 1.2, textAlign: "center" },
            ]}
          >
            MARCA / MODELO
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 1, textAlign: "center" },
            ]}
          >
            SERVICIO
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

      {/* LISTA VIRTUALIZADA */}
      <FlatList
        data={flota}
        keyExtractor={(item, index) => `${item.id_unidad ?? "u"}-${index}`}
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
                No se encontraron unidades con los filtros seleccionados.
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
            onPress={() => {
              setUnidadEdit({
                id_unidad: item.id_unidad,
                placa: str(item.placa),
                id_tipo_vehiculo: item.id_tipo_vehiculo || "",
                numero_unidad: str(item.numero_unidad),
                tipo_servicio: str(item.tipo_servicio) || "MUNICIPAL",
                marca: str(item.marca),
                modelo: str(item.modelo),
                año: str(item.año),
                estado: item.estado ?? 1,
              });
              setModalEditarVisible(true);
            }}
          >
            {isDesktop ? (
              <>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 0.5, textAlign: "center", color: "#64748B" },
                  ]}
                >
                  {item.id_unidad}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 1, fontWeight: "bold", textAlign: "center" },
                  ]}
                >
                  {item.placa}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 1.5, textAlign: "center" },
                  ]}
                >
                  {item.tipo_vehiculo_nombre || "-"}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 1, textAlign: "center" },
                  ]}
                >
                  {item.numero_unidad || "-"}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 1.2, textAlign: "center" },
                  ]}
                >
                  {`${item.marca || ""} ${item.modelo || ""}`.trim() || "-"}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 1, textAlign: "center" },
                  ]}
                >
                  {item.tipo_servicio}
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
                  <Text style={{ fontWeight: "bold", fontSize: 13 }}>
                    {item.placa} ({item.numero_unidad || "S/N"})
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}
                  >
                    {item.tipo_vehiculo_nombre || "S/T"}
                  </Text>
                </View>
                <BadgeEstado estado={item.estado} />
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* MODAL CREAR */}
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
              <ThemedText style={styles.headerTitle}>
                Registrar Unidad
              </ThemedText>
              <TouchableOpacity
                disabled={saving}
                onPress={() => setModalCrearVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <ThemedText style={styles.label}>Placa *</ThemedText>
              <TextInput
                style={[styles.modalInput, errors.placa && styles.inputError]}
                value={nuevaUnidad.placa ?? ""}
                autoCapitalize="characters"
                maxLength={15}
                onChangeText={handlePlacaChange}
              />
              {placaDuplicadaMsg !== "" && (
                <Text style={styles.errorTextRed}>{placaDuplicadaMsg}</Text>
              )}

              <ThemedText style={styles.label}>Tipo de Unidad *</ThemedText>
              <View
                style={[
                  styles.modalPickerContainer,
                  { backgroundColor: "#FFFFFF" },
                  errors.id_tipo_vehiculo && styles.inputError,
                ]}
              >
                <Picker
                  selectedValue={
                    nuevaUnidad.id_tipo_vehiculo
                      ? String(nuevaUnidad.id_tipo_vehiculo)
                      : ""
                  }
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) => {
                    setNuevaUnidad((prev) => ({
                      ...prev,
                      id_tipo_vehiculo: val,
                    }));
                    if (errors.id_tipo_vehiculo)
                      setErrors((prev) => ({
                        ...prev,
                        id_tipo_vehiculo: false,
                      }));
                  }}
                >
                  <Picker.Item
                    label="-- SELECCIONE --"
                    value=""
                    color="#888888"
                  />
                  {tiposVehiculo.map((tv: any) => (
                    <Picker.Item
                      key={String(tv.id_tipo_vehiculo)}
                      label={tv.descripcion || ""}
                      value={String(tv.id_tipo_vehiculo)}
                      color="#000000"
                    />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.label}>Número de Unidad *</ThemedText>
              <TextInput
                style={[
                  styles.modalInput,
                  errors.numero_unidad && styles.inputError,
                ]}
                value={nuevaUnidad.numero_unidad ?? ""}
                maxLength={20}
                onChangeText={(t) => {
                  setNuevaUnidad((prev) => ({ ...prev, numero_unidad: t }));
                  if (errors.numero_unidad)
                    setErrors((prev) => ({ ...prev, numero_unidad: false }));
                }}
              />

              <TouchableOpacity
                style={[
                  styles.btnGuardar,
                  errors.placa && { backgroundColor: "#E53935" },
                  { opacity: saving ? 0.6 : 1 },
                ]}
                onPress={handleGuardarNuevo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                    {errors.placa ? "PLACA YA REGISTRADA" : "REGISTRAR UNIDAD"}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR */}
      <Modal
        visible={modalEditarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setModalEditarVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!saving) setModalEditarVisible(false);
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>
                Editar Unidad #{unidadEdit?.id_unidad}
              </ThemedText>
              <TouchableOpacity
                disabled={saving}
                onPress={() => setModalEditarVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {unidadEdit && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <ThemedText style={styles.label}>ID Unidad</ThemedText>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: "#E2E8F0" }]}
                  value={str(unidadEdit.id_unidad)}
                  editable={false}
                />

                <ThemedText style={styles.label}>Placa</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={unidadEdit.placa ?? ""}
                  autoCapitalize="characters"
                  maxLength={15}
                  onChangeText={(t) =>
                    setUnidadEdit((prev: any) => ({
                      ...prev,
                      placa: t.toUpperCase(),
                    }))
                  }
                />

                <ThemedText style={styles.label}>Tipo de Unidad</ThemedText>
                <View
                  style={[
                    styles.modalPickerContainer,
                    { backgroundColor: "#FFFFFF" },
                  ]}
                >
                  <Picker
                    selectedValue={
                      unidadEdit.id_tipo_vehiculo
                        ? String(unidadEdit.id_tipo_vehiculo)
                        : ""
                    }
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) =>
                      setUnidadEdit((prev: any) => ({
                        ...prev,
                        id_tipo_vehiculo: val,
                      }))
                    }
                  >
                    <Picker.Item
                      label="-- SELECCIONE --"
                      value=""
                      color="#888888"
                    />
                    {tiposVehiculo.map((tv: any) => (
                      <Picker.Item
                        key={String(tv.id_tipo_vehiculo)}
                        label={tv.descripcion || ""}
                        value={String(tv.id_tipo_vehiculo)}
                        color="#000000"
                      />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Número de Unidad</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  maxLength={20}
                  value={unidadEdit.numero_unidad ?? ""}
                  onChangeText={(t) =>
                    setUnidadEdit((prev: any) => ({
                      ...prev,
                      numero_unidad: t,
                    }))
                  }
                />

                <ThemedText style={styles.label}>Tipo Servicio</ThemedText>
                <View
                  style={[
                    styles.modalPickerContainer,
                    { backgroundColor: "#FFFFFF" },
                  ]}
                >
                  <Picker
                    selectedValue={
                      unidadEdit.tipo_servicio
                        ? String(unidadEdit.tipo_servicio)
                        : "MUNICIPAL"
                    }
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) =>
                      setUnidadEdit((prev: any) => ({
                        ...prev,
                        tipo_servicio: val,
                      }))
                    }
                  >
                    <Picker.Item
                      label="MUNICIPAL"
                      value="MUNICIPAL"
                      color="#000000"
                    />
                    <Picker.Item
                      label="INTEGRADO"
                      value="INTEGRADO"
                      color="#000000"
                    />
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Marca</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  maxLength={40}
                  value={unidadEdit.marca ?? ""}
                  onChangeText={(t) =>
                    setUnidadEdit((prev: any) => ({ ...prev, marca: t }))
                  }
                />

                <ThemedText style={styles.label}>Modelo</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  maxLength={40}
                  value={unidadEdit.modelo ?? ""}
                  onChangeText={(t) =>
                    setUnidadEdit((prev: any) => ({ ...prev, modelo: t }))
                  }
                />

                <ThemedText style={styles.label}>Año</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={unidadEdit.año ?? ""}
                  keyboardType="numeric"
                  maxLength={4}
                  onChangeText={(t) =>
                    setUnidadEdit((prev: any) => ({
                      ...prev,
                      año: t.replace(/[^0-9]/g, ""),
                    }))
                  }
                />

                <ThemedText style={styles.label}>Estado</ThemedText>
                <View
                  style={[
                    styles.modalPickerContainer,
                    { backgroundColor: "#FFFFFF" },
                  ]}
                >
                  <Picker
                    selectedValue={String(unidadEdit.estado ?? 1)}
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) =>
                      setUnidadEdit((prev: any) => ({
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
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
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
    padding: 3,
    gap: 4,
    flexWrap: "wrap",
  },
  btnEstado: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  btnEstadoActive: { backgroundColor: MJM_BLUE },
  btnText: { fontSize: 11, fontWeight: "600", color: "#64748B" },
  badgeTipo: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  badgeTipoActive: {
    backgroundColor: MJM_BLUE,
    borderColor: MJM_BLUE,
  },
  badgeTipoText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#475569",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 13, color: "#0F172A" },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#024885",
  },
  headerText: { fontWeight: "bold", fontSize: 11, color: "#FFFFFF" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  cell: { flex: 1, padding: 8, justifyContent: "center" },
  cellBorder: {
    borderRightWidth: 1,
    borderRightColor: "rgba(203, 213, 225, 0.4)",
  },
  mobileCard: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
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
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A",
  },
  inputError: {
    borderColor: "#E53935",
    borderWidth: 1.5,
    backgroundColor: "#FFEBEE",
  },
  errorTextRed: {
    color: "#E53935",
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 8,
    marginBottom: 4,
  },
  btnGuardar: {
    backgroundColor: MJM_BLUE,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  alertContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
});