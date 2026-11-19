import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import * as XLSX from "xlsx";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";

const ThemedText = ({ style, children, ...props }: any) => (
  <Text style={style} {...props}>
    {children}
  </Text>
);

const MJM_BLUE = "#024885";

const GRADOS_LIST = [
  "GEN POL",
  "TGRAL",
  "GRAL",
  "CRNL",
  "CMDTE",
  "CAP",
  "TTE",
  "ALFZ",
  "S3ER",
  "SBRIG",
  "ST1",
  "ST2",
  "ST3",
  "SO1",
  "SO2",
  "SO3",
];

const INITIAL_PNP_STATE = {
  grado: "SO3",
  nombres: "",
  apellidos: "",
  dni: "",
  estado: 1,
};

const str = (val: unknown): string =>
  val === null || val === undefined ? "" : String(val);

export default function PnpScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  const [modalGradosVisible, setModalGradosVisible] = useState(false);
  const [personalPnp, setPersonalPnp] = useState<any[]>([]);
  const [counts, setCounts] = useState({ total: 0, activos: 0, inactivos: 0 });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gradoSel, setGradoSel] = useState("TODOS");
  const [estadoSel, setEstadoSel] = useState("TODOS");

  // Carga separada: listado vs mutaciones
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modales y Formularios
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [dniDuplicadoMsg, setDniDuplicadoMsg] = useState("");
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success" as "success" | "error",
  });

  const [pnpEdit, setPnpEdit] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [nuevoPnp, setNuevoPnp] = useState(INITIAL_PNP_STATE);

  const isMountedRef = useRef(true);
  const pageRef = useRef(1);
  const loadingListRef = useRef(false);
  const savingRef = useRef(false);
  const listAbortRef = useRef<AbortController | null>(null);
  const dniAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      listAbortRef.current?.abort();
      dniAbortRef.current?.abort();
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
          grado: gradoSel,
          estado: estadoSel,
          page: nextPage.toString(),
        });

        const res = await fetch(`${API_URL}/pnptotal?${query}`, {
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
        setPersonalPnp((prev) =>
          reset ? newRecords : [...prev, ...newRecords]
        );
        setHasMore(Boolean(result.pagination?.hasMore ?? result.hasMore));
        pageRef.current = nextPage + 1;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("Error al cargar catálogo PNP:", e);
        if (isMountedRef.current) {
          notificar("Error", "No se pudo cargar el catálogo PNP.", "error");
        }
      } finally {
        clearTimeout(timer);
        if (listAbortRef.current === controller) {
          loadingListRef.current = false;
          if (isMountedRef.current) setLoadingList(false);
        }
      }
    },
    [debouncedSearch, gradoSel, estadoSel, notificar]
  );

  useEffect(() => {
    setHasMore(true);
    cargarDatos(true);
  }, [cargarDatos]);

  const handleLoadMore = () => {
    if (!loadingListRef.current && hasMore && personalPnp.length > 0) {
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
        grado: gradoSel,
        estado: estadoSel,
        export: "true",
      });

      const res = await fetch(`${API_URL}/pnptotal?${query}`, {
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

      const datosFormato = dataCompleta.map((p: any) => ({
        ID: p.id_pnp,
        GRADO: p.grado || "",
        APELLIDOS: p.apellidos || "",
        NOMBRES: p.nombres || "",
        DNI: p.dni || "",
        ESTADO: Number(p.estado) === 1 ? "ACTIVO" : "INACTIVO",
      }));

      const worksheet = XLSX.utils.json_to_sheet(datosFormato);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Catálogo PNP");

      XLSX.writeFile(workbook, "Reporte_Personal_PNP.xlsx");
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

  const handleDniChange = async (text: string) => {
    const cleanDni = text.replace(/[^0-9]/g, "");
    setNuevoPnp((prev) => ({ ...prev, dni: cleanDni }));
    setErrors((prev) => (prev.dni ? { ...prev, dni: false } : prev));
    setDniDuplicadoMsg("");

    dniAbortRef.current?.abort();
    if (cleanDni.length !== 8) return;

    const controller = new AbortController();
    dniAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(
        `${API_URL}/checkdnipnp/${encodeURIComponent(cleanDni)}`,
        { signal: controller.signal }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!isMountedRef.current || dniAbortRef.current !== controller) return;

      if (data.existe) {
        setErrors((prev) => ({ ...prev, dni: true }));
        setDniDuplicadoMsg("⚠️ EL DNI INGRESADO YA SE ENCUENTRA REGISTRADO");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      clearTimeout(timer);
    }
  };

  const handleGuardarCambios = async () => {
    if (!pnpEdit || savingRef.current) return;

    if (
      !String(pnpEdit.grado || "").trim() ||
      !String(pnpEdit.nombres || "").trim() ||
      !String(pnpEdit.apellidos || "").trim() ||
      String(pnpEdit.dni || "").trim().length < 8
    ) {
      notificar(
        "Campos Requeridos",
        "Grado, nombres, apellidos y DNI (mínimo 8 dígitos) son obligatorios.",
        "error"
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${API_URL}/updatepnp/${pnpEdit.id_pnp}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pnpEdit),
        signal: controller.signal,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      if (!isMountedRef.current) return;

      if (res.ok) {
        setModalVisible(false);
        notificar("¡Éxito!", "Registro actualizado correctamente.", "success");
        cargarDatos(true);
      } else {
        notificar(
          "Error",
          data.message || data.error || "No se pudo actualizar el registro.",
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

  const handleGuardarNuevo = async () => {
    if (savingRef.current) return;

    const newErrors: Record<string, boolean> = {};
    const { grado, nombres, apellidos, dni } = nuevoPnp;

    if (!grado.trim()) newErrors.grado = true;
    if (!nombres.trim()) newErrors.nombres = true;
    if (!apellidos.trim()) newErrors.apellidos = true;
    if (!dni.trim() || dni.trim().length < 8) newErrors.dni = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notificar(
        "Campos Faltantes",
        "Complete los campos obligatorios (DNI mínimo 8 dígitos).",
        "error"
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${API_URL}/insertpnp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoPnp),
        signal: controller.signal,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      if (!isMountedRef.current) return;

      if (!res.ok) {
        if (res.status === 409 || data.code === "DNI_DUPLICADO") {
          setErrors({ dni: true });
          setDniDuplicadoMsg("⚠️ EL DNI INGRESADO YA SE ENCUENTRA REGISTRADO");
          notificar(
            "DNI Registrado",
            data.message || "El DNI ingresado ya existe en la base de datos.",
            "error"
          );
          return;
        }

        notificar(
          "Error",
          data.message || "Ocurrió un error al guardar.",
          "error"
        );
        return;
      }

      setModalCrearVisible(false);
      setNuevoPnp(INITIAL_PNP_STATE);
      setDniDuplicadoMsg("");
      setErrors({});
      notificar("¡Éxito!", "Efectivo PNP registrado correctamente.", "success");
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
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
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
            <ThemedText style={styles.headerTitle}>Cat. PNP</ThemedText>

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
              setDniDuplicadoMsg("");
              setNuevoPnp(INITIAL_PNP_STATE);
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
            value={searchText ?? ""}
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            <TouchableOpacity
              onPress={() => setGradoSel("TODOS")}
              style={[
                styles.btnChip,
                gradoSel === "TODOS" && styles.btnActive,
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  gradoSel === "TODOS" && { color: "#FFF" },
                ]}
              >
                TODOS
              </Text>
            </TouchableOpacity>

            {GRADOS_LIST.slice(0, 4).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGradoSel(g)}
                style={[styles.btnChip, gradoSel === g && styles.btnActive]}
              >
                <Text
                  style={[styles.btnText, gradoSel === g && { color: "#FFF" }]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setModalGradosVisible(true)}
              style={[
                styles.btnChip,
                gradoSel !== "TODOS" &&
                  !GRADOS_LIST.slice(0, 4).includes(gradoSel) &&
                  styles.btnActive,
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  gradoSel !== "TODOS" &&
                    !GRADOS_LIST.slice(0, 4).includes(gradoSel) && {
                      color: "#FFF",
                    },
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
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 0.8, textAlign: "center" },
            ]}
          >
            GRADO
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 2, textAlign: "center" },
            ]}
          >
            APELLIDOS Y NOMBRES
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 1, textAlign: "center" },
            ]}
          >
            DNI
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
        data={personalPnp}
        keyExtractor={(item, index) => `${item.id_pnp ?? "pnp"}-${index}`}
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
                No se encontraron efectivos PNP con los filtros actuales.
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
              setPnpEdit({
                ...item,
                grado: str(item.grado),
                nombres: str(item.nombres),
                apellidos: str(item.apellidos),
                dni: str(item.dni),
              });
              setModalVisible(true);
            }}
          >
            {isDesktop ? (
              <>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 0.8, fontWeight: "bold", textAlign: "center" },
                  ]}
                >
                  {item.grado}
                </Text>
                <Text
                  style={[styles.cell, styles.cellBorder, { flex: 2 }]}
                  numberOfLines={1}
                >
                  {`${item.apellidos || ""}, ${item.nombres || ""}`.toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 1, textAlign: "center" },
                  ]}
                >
                  {item.dni || "-"}
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
                    {item.grado} -{" "}
                    {`${item.apellidos || ""}, ${item.nombres || ""}`.toUpperCase()}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}
                  >
                    DNI: {item.dni || "S/N"}
                  </Text>
                </View>
                <BadgeEstado estado={item.estado} />
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* MODAL EDITAR */}
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
              <ThemedText style={styles.headerTitle}>Editar PNP</ThemedText>
              <TouchableOpacity
                disabled={saving}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {pnpEdit && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <ThemedText style={styles.label}>Grado</ThemedText>
                <View
                  style={[
                    styles.modalPickerContainer,
                    { backgroundColor: "#FFFFFF" },
                  ]}
                >
                  <Picker
                    selectedValue={
                      pnpEdit.grado != null ? String(pnpEdit.grado) : ""
                    }
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) =>
                      setPnpEdit((prev: any) => ({ ...prev, grado: val }))
                    }
                  >
                    <Picker.Item
                      label="Seleccionar Grado..."
                      value=""
                      color="#888888"
                    />
                    {GRADOS_LIST.map((g) => (
                      <Picker.Item
                        key={String(g)}
                        label={String(g)}
                        value={String(g)}
                        color="#000000"
                      />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Nombres</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  autoCapitalize="characters"
                  maxLength={80}
                  value={pnpEdit.nombres ?? ""}
                  onChangeText={(t) =>
                    setPnpEdit((prev: any) => ({ ...prev, nombres: t }))
                  }
                />

                <ThemedText style={styles.label}>Apellidos</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  autoCapitalize="characters"
                  maxLength={80}
                  value={pnpEdit.apellidos ?? ""}
                  onChangeText={(t) =>
                    setPnpEdit((prev: any) => ({ ...prev, apellidos: t }))
                  }
                />

                <ThemedText style={styles.label}>DNI</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={pnpEdit.dni ?? ""}
                  keyboardType="numeric"
                  maxLength={10}
                  onChangeText={(t) =>
                    setPnpEdit((prev: any) => ({
                      ...prev,
                      dni: t.replace(/[^0-9]/g, ""),
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
                    selectedValue={
                      pnpEdit.estado != null ? String(pnpEdit.estado) : "1"
                    }
                    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                    dropdownIconColor="#000000"
                    onValueChange={(val) =>
                      setPnpEdit((prev: any) => ({
                        ...prev,
                        estado: val !== "" ? Number(val) : 1,
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
                Nuevo Registro PNP
              </ThemedText>
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
              <ThemedText style={styles.label}>Grado *</ThemedText>
              <View
                style={[
                  styles.modalPickerContainer,
                  { backgroundColor: "#FFFFFF" },
                  errors.grado && styles.inputError,
                ]}
              >
                <Picker
                  selectedValue={nuevoPnp.grado ?? "SO3"}
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) =>
                    setNuevoPnp((prev) => ({ ...prev, grado: val }))
                  }
                >
                  <Picker.Item
                    label="Seleccionar Grado..."
                    value=""
                    color="#888888"
                  />
                  {GRADOS_LIST.map((g) => (
                    <Picker.Item
                      key={g}
                      label={g}
                      value={g}
                      color="#000000"
                    />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.label}>Nombres *</ThemedText>
              <TextInput
                style={[styles.modalInput, errors.nombres && styles.inputError]}
                autoCapitalize="characters"
                maxLength={80}
                value={nuevoPnp.nombres ?? ""}
                onChangeText={(t) => {
                  setNuevoPnp((prev) => ({ ...prev, nombres: t }));
                  if (errors.nombres)
                    setErrors((prev) => ({ ...prev, nombres: false }));
                }}
              />

              <ThemedText style={styles.label}>Apellidos *</ThemedText>
              <TextInput
                style={[
                  styles.modalInput,
                  errors.apellidos && styles.inputError,
                ]}
                autoCapitalize="characters"
                maxLength={80}
                value={nuevoPnp.apellidos ?? ""}
                onChangeText={(t) => {
                  setNuevoPnp((prev) => ({ ...prev, apellidos: t }));
                  if (errors.apellidos)
                    setErrors((prev) => ({ ...prev, apellidos: false }));
                }}
              />

              <ThemedText style={styles.label}>DNI *</ThemedText>
              <TextInput
                style={[styles.modalInput, errors.dni && styles.inputError]}
                keyboardType="numeric"
                maxLength={10}
                value={nuevoPnp.dni ?? ""}
                onChangeText={handleDniChange}
              />

              {dniDuplicadoMsg !== "" && (
                <Text style={styles.errorTextRed}>{dniDuplicadoMsg}</Text>
              )}

              <ThemedText style={styles.label}>Estado</ThemedText>
              <View
                style={[
                  styles.modalPickerContainer,
                  { backgroundColor: "#FFFFFF" },
                ]}
              >
                <Picker
                  selectedValue={String(nuevoPnp.estado ?? 1)}
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) =>
                    setNuevoPnp((prev) => ({
                      ...prev,
                      estado: val !== "" ? Number(val) : 1,
                    }))
                  }
                >
                  <Picker.Item label="ACTIVO" value="1" color="#000000" />
                  <Picker.Item label="INACTIVO" value="0" color="#000000" />
                </Picker>
              </View>

              <TouchableOpacity
                style={[
                  styles.btnGuardar,
                  errors.dni && { backgroundColor: "#E53935" },
                  { opacity: saving ? 0.6 : 1 },
                ]}
                onPress={handleGuardarNuevo}
                disabled={saving}
              >
                {saving ? (
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
      <Modal
        visible={modalGradosVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalGradosVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalGradosVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Grado</Text>
              <TouchableOpacity onPress={() => setModalGradosVisible(false)}>
                <Text style={{ fontSize: 18, color: "#64748B", padding: 4 }}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={["TODOS", ...GRADOS_LIST]}
              keyExtractor={(item) => item}
              initialNumToRender={16}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    gradoSel === item && { backgroundColor: "#E2E8F0" },
                  ]}
                  onPress={() => {
                    setGradoSel(item);
                    setModalGradosVisible(false);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: gradoSel === item ? "bold" : "normal",
                      color: "#0F172A",
                    }}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL ALERTA (WEB) */}
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
    </SafeAreaView>
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 8,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 13, color: "#0F172A" },
  filterRow: { flexDirection: "row", alignItems: "center" },
  filterLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B",
    width: 50,
  },
  btnChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#0F172A" },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
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