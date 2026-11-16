import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
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
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";

const ThemedText = ({ style, children, ...props }: any) => (
  <Text style={style} {...props}>
    {children}
  </Text>
);

const MJM_BLUE = "#024885";

interface Unidad {
  id_unidad: number | string;
  nombre_unidad: string;
}

interface Rol {
  id_rol: number | string;
  nombre_rol?: string;
  nombre?: string;
}

const str = (val: unknown): string =>
  val === null || val === undefined ? "" : String(val);

let cacheCatalogosPersona: {
  unidades: Unidad[];
  roles: Rol[];
  timestamp: number;
} | null = null;
const CACHE_TTL_CATALOGOS_MS = 5 * 60 * 1000;

const INITIAL_PERSONA_STATE = {
  nombres: "",
  apellido_paterno: "",
  apellido_materno: "",
  documento_numero: "",
  celular: "",
  id_unidad: "",
  regimen: "LOCADOR",
  estado_laboral: "ACTIVO",
};

export default function PersonaScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  const [modalUnidadesVisible, setModalUnidadesVisible] = useState(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);

  const [counts, setCounts] = useState({
    total: 0,
    activos: 0,
    inactivos: 0,
  });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [regimenSel, setRegimenSel] = useState("TODOS");
  const [estadoSel, setEstadoSel] = useState("TODOS");
  const [unidadSel, setUnidadSel] = useState("TODOS");

  const [modoAccion, setModoAccion] = useState<"GUARDAR" | "PASSWORD">(
    "GUARDAR"
  );
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success" as "success" | "error",
  });

  const [personaEdit, setPersonaEdit] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [nuevaPersona, setNuevaPersona] = useState(INITIAL_PERSONA_STATE);
  const [nuevaClaveAdmin, setNuevaClaveAdmin] = useState("");

  const isMountedRef = useRef(true);
  const pageRef = useRef(1);
  const loadingListRef = useRef(false);
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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPersonaEdit((prev: any) =>
        prev
          ? {
              ...prev,
              foto_perfil: asset.uri,
              ...(asset.base64
                ? {
                    foto_perfil_base64: `data:image/jpeg;base64,${asset.base64}`,
                  }
                : {}),
            }
          : prev
      );
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchText]);

  const cargarCatalogos = useCallback(async (forzar = false) => {
    const ahora = Date.now();
    if (
      !forzar &&
      cacheCatalogosPersona &&
      ahora - cacheCatalogosPersona.timestamp < CACHE_TTL_CATALOGOS_MS
    ) {
      setUnidades(cacheCatalogosPersona.unidades);
      setRoles(cacheCatalogosPersona.roles);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const [resUnidades, resRoles] = await Promise.all([
        fetch(`${API_URL}/unidades`, { signal: controller.signal }),
        fetch(`${API_URL}/admin/roles`, { signal: controller.signal }),
      ]);
      if (!resUnidades.ok || !resRoles.ok) {
        throw new Error("Error al cargar catálogos");
      }
      const [dataUnidades, dataRoles] = await Promise.all([
        resUnidades.json(),
        resRoles.json(),
      ]);
      if (!isMountedRef.current) return;

      const listaUnidades = Array.isArray(dataUnidades) ? dataUnidades : [];
      const listaRoles = Array.isArray(dataRoles) ? dataRoles : [];

      cacheCatalogosPersona = {
        unidades: listaUnidades,
        roles: listaRoles,
        timestamp: Date.now(),
      };

      setUnidades(listaUnidades);
      setRoles(listaRoles);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      console.error("Error al cargar catálogos:", e);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

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
          regimen: regimenSel,
          estado: estadoSel,
          unidad: unidadSel,
          page: nextPage.toString(),
        });

        const res = await fetch(`${API_URL}/personastotal?${query}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();

        if (!isMountedRef.current) return;

        setCounts({
          total: result.counts?.total ?? result.pagination?.totalRecords ?? 0,
          activos: result.counts?.activos || 0,
          inactivos: result.counts?.inactivos || 0,
        });

        const newRecords = Array.isArray(result.data) ? result.data : [];
        setPersonas((prev) => (reset ? newRecords : [...prev, ...newRecords]));

        const canFetchMore = result.pagination
          ? result.pagination.hasMore
          : result.hasMore;

        setHasMore(Boolean(canFetchMore));
        pageRef.current = nextPage + 1;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("Error al cargar personas:", e);
        if (isMountedRef.current) {
          notificar(
            "Error",
            "No se pudo cargar el listado de personal.",
            "error"
          );
        }
      } finally {
        clearTimeout(timer);
        if (listAbortRef.current === controller) {
          loadingListRef.current = false;
          if (isMountedRef.current) {
            setLoadingList(false);
          }
        }
      }
    },
    [debouncedSearch, regimenSel, estadoSel, unidadSel, notificar]
  );

  useEffect(() => {
    setHasMore(true);
    cargarDatos(true);
  }, [cargarDatos]);

  const handleLoadMore = () => {
    if (!loadingListRef.current && hasMore && personas.length > 0) {
      cargarDatos(false);
    }
  };

  const obtenerTodosLosDatosFiltrados = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const query = new URLSearchParams({
        q: debouncedSearch,
        regimen: regimenSel,
        estado: estadoSel,
        unidad: unidadSel,
        export: "true",
      });

      const res = await fetch(`${API_URL}/personastotal?${query}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      return Array.isArray(result.data) ? result.data : [];
    } finally {
      clearTimeout(timer);
    }
  };

  const exportarExcel = async () => {
    if (saving) return;
    try {
      setSaving(true);
      const dataCompleta = await obtenerTodosLosDatosFiltrados();

      if (!isMountedRef.current) return;

      if (!dataCompleta || dataCompleta.length === 0) {
        notificar(
          "Sin datos",
          "No hay datos filtrados para exportar.",
          "error"
        );
        return;
      }

      const datosFormato = dataCompleta.map((p: any) => ({
        DNI: p.documento_numero || "",
        "APELLIDO PATERNO": p.apellido_paterno || "",
        "APELLIDO MATERNO": p.apellido_materno || "",
        NOMBRES: p.nombres || "",
        CELULAR: p.celular || "",
        CORREO: p.correo || "",
        GENERO: p.genero || "",
        CARGO: p.nombre_unidad || p.cargo || "",
        RÉGIMEN: p.regimen || "",
        ESTADO: p.estado_laboral || "",
        USUARIO: p.usuario || p.username || "",
        ROL: p.nombre_rol || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(datosFormato);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Personal");

      XLSX.writeFile(workbook, "Reporte_Personal_Filtrado.xlsx");
    } catch (e) {
      console.error("Error al exportar:", e);
      if (isMountedRef.current) {
        notificar("Error", "No se pudo generar el reporte Excel.", "error");
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  };

  const abrirModalEditar = (item: any) => {
    setModoAccion("GUARDAR");
    setNuevaClaveAdmin("");
    setPersonaEdit({
      ...item,
      nombres: str(item.nombres),
      apellido_paterno: str(item.apellido_paterno),
      apellido_materno: str(item.apellido_materno),
      documento_numero: str(item.documento_numero),
      celular: str(item.celular),
      correo: str(item.correo),
    });
    setModalVisible(true);
  };

  const cerrarModalEditar = () => {
    if (saving) return;
    setModalVisible(false);
    setModoAccion("GUARDAR");
    setNuevaClaveAdmin("");
  };

  const handleAdminResetPassword = async () => {
    if (saving || !personaEdit) return;

    const claveLimpia = nuevaClaveAdmin.trim();
    if (claveLimpia.length > 0 && claveLimpia.length < 4) {
      notificar(
        "Clave Inválida",
        "Si ingresas una contraseña, debe tener al menos 4 caracteres.",
        "error"
      );
      return;
    }

    const payload: Record<string, any> = {};
    if (claveLimpia.length >= 4) {
      payload.nuevaClave = claveLimpia;
    }
    if (personaEdit.id_rol !== undefined && personaEdit.id_rol !== null) {
      payload.id_rol = personaEdit.id_rol;
    }
    if (
      personaEdit.acceso_habilitado !== undefined &&
      personaEdit.acceso_habilitado !== null
    ) {
      payload.acceso_habilitado = personaEdit.acceso_habilitado;
    }

    if (Object.keys(payload).length === 0) {
      notificar(
        "Atención",
        "Ingresa una nueva contraseña o selecciona un rol.",
        "error"
      );
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      setSaving(true);
      const res = await fetch(
        `${API_URL}/admin/reset-password/${personaEdit.id_persona}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // respuesta no JSON
      }

      if (!isMountedRef.current) return;

      if (res.ok) {
        const rolEncontrado = roles.find(
          (r) => String(r.id_rol) === String(personaEdit.id_rol)
        );
        const nombreRolNuevo = rolEncontrado
          ? rolEncontrado.nombre_rol || rolEncontrado.nombre
          : personaEdit.nombre_rol;

        setPersonas((prev) =>
          prev.map((p) =>
            p.id_persona === personaEdit.id_persona
              ? { ...p, id_rol: personaEdit.id_rol, nombre_rol: nombreRolNuevo }
              : p
          )
        );

        setNuevaClaveAdmin("");
        setModoAccion("GUARDAR");
        setModalVisible(false);
        notificar(
          "¡Éxito!",
          "Rol y/o contraseña actualizados correctamente.",
          "success"
        );
        cargarDatos(true);
      } else {
        notificar(
          "Error",
          data.error || data.message || "No se pudo actualizar los datos.",
          "error"
        );
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        notificar("Error", "El servidor tardó demasiado en responder.", "error");
      } else {
        notificar(
          "Error de Red",
          "No se pudo conectar con el servidor.",
          "error"
        );
      }
    } finally {
      clearTimeout(timer);
      if (isMountedRef.current) setSaving(false);
    }
  };

  const handleGuardarCambios = async () => {
    if (saving || !personaEdit) return;

    if (
      !String(personaEdit.nombres || "").trim() ||
      !String(personaEdit.apellido_paterno || "").trim() ||
      !String(personaEdit.documento_numero || "").trim()
    ) {
      notificar(
        "Campos Requeridos",
        "Nombres, apellido paterno y DNI son obligatorios.",
        "error"
      );
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      setSaving(true);
      const res = await fetch(
        `${API_URL}/updatepersona/${personaEdit.id_persona}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(personaEdit),
          signal: controller.signal,
        }
      );

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // respuesta no JSON
      }

      if (!isMountedRef.current) return;

      if (res.ok) {
        setModalVisible(false);
        setModoAccion("GUARDAR");
        setNuevaClaveAdmin("");
        notificar(
          "¡Éxito!",
          "La información se actualizó correctamente.",
          "success"
        );
        cargarDatos(true);
      } else {
        notificar(
          "Error",
          data.message || data.error || "No se pudieron guardar los cambios.",
          "error"
        );
      }
    } catch (e: any) {
      console.error(e);
      if (isMountedRef.current) {
        notificar(
          "Error de Red",
          e?.name === "AbortError"
            ? "El servidor tardó demasiado en responder."
            : "No se pudo conectar con el servidor.",
          "error"
        );
      }
    } finally {
      clearTimeout(timer);
      if (isMountedRef.current) setSaving(false);
    }
  };

  const handleGuardarNuevo = async () => {
    if (saving) return;

    const newErrors: Record<string, boolean> = {};
    const {
      nombres,
      apellido_paterno,
      apellido_materno,
      documento_numero,
      id_unidad,
    } = nuevaPersona;

    if (!nombres.trim()) newErrors.nombres = true;
    if (!apellido_paterno.trim()) newErrors.apellido_paterno = true;
    if (!apellido_materno.trim()) newErrors.apellido_materno = true;
    if (!documento_numero.trim() || documento_numero.trim().length < 8) {
      newErrors.documento_numero = true;
    }
    if (!id_unidad) newErrors.id_unidad = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notificar(
        "Campos Faltantes",
        "Complete los campos obligatorios marcados en rojo (DNI mínimo 8 dígitos).",
        "error"
      );
      return;
    }

    setErrors({});
    setSaving(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const checkRes = await fetch(
        `${API_URL}/personas/check/${encodeURIComponent(
          documento_numero.trim()
        )}`,
        { signal: controller.signal }
      );
      if (!checkRes.ok) throw new Error(`HTTP ${checkRes.status}`);
      const checkData = await checkRes.json();

      if (!isMountedRef.current) return;

      if (checkData.exists) {
        notificar(
          "DNI Duplicado",
          "Este número de documento ya está registrado en el sistema.",
          "error"
        );
        return;
      }

      const res = await fetch(`${API_URL}/insertpersonas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nuevaPersona,
          id_unidad: Number(nuevaPersona.id_unidad),
        }),
        signal: controller.signal,
      });

      let respData: any = {};
      try {
        respData = await res.json();
      } catch {
        // respuesta no JSON
      }

      if (!isMountedRef.current) return;

      if (res.ok) {
        setModalCrearVisible(false);
        setNuevaPersona(INITIAL_PERSONA_STATE);
        notificar(
          "¡Éxito!",
          "El personal ha sido registrado correctamente.",
          "success"
        );
        cargarDatos(true);
      } else {
        notificar(
          "Error",
          respData.error || respData.message || "No se pudo registrar.",
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
      if (isMountedRef.current) setSaving(false);
    }
  };

  const BadgeEstado = ({ estado }: { estado: string }) => (
    <View
      style={[
        styles.badge,
        { backgroundColor: estado === "ACTIVO" ? "#E8F5E9" : "#FFEBEE" },
      ]}
    >
      <Text
        style={{
          color: estado === "ACTIVO" ? "#2E7D32" : "#C62828",
          fontSize: 10,
          fontWeight: "bold",
        }}
      >
        {estado}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ThemedText style={styles.headerTitle}>Personal</ThemedText>

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
                { id: "ACTIVO", l: "ACTIVOS", c: counts.activos },
                { id: "INACTIVO", l: "INACTIVOS", c: counts.inactivos },
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
                    {e.l}
                  </Text>
                  <Text
                    style={[
                      styles.btnText,
                      estadoSel === e.id && { color: "white" },
                    ]}
                  >
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
              setNuevaPersona(INITIAL_PERSONA_STATE);
              setModalCrearVisible(true);
            }}
          >
            <Ionicons name="person-add" size={18} color="white" />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "column", gap: 8, marginBottom: 10 }}>
          <View style={[styles.searchBar, { width: "100%", marginBottom: 0 }]}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              placeholder="Buscar por DNI y/o Nombres"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              value={searchText ?? ""}
              onChangeText={setSearchText}
              autoComplete="off"
            />
            {searchText !== "" && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          {/* FILA 1: UNIDADES ORGÁNICAS */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Unidad:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <TouchableOpacity
                onPress={() => setUnidadSel("TODOS")}
                style={[
                  styles.btnChip,
                  unidadSel === "TODOS" && styles.btnActive,
                ]}
              >
                <Text
                  style={[
                    styles.btnText,
                    unidadSel === "TODOS" && { color: "#FFF" },
                  ]}
                >
                  TODOS
                </Text>
              </TouchableOpacity>

              {unidades.slice(0, 3).map((u) => {
                const idStr = String(u.id_unidad);
                const isSelected = String(unidadSel) === idStr;
                return (
                  <TouchableOpacity
                    key={idStr}
                    onPress={() => setUnidadSel(idStr)}
                    style={[styles.btnChip, isSelected && styles.btnActive]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.btnText, isSelected && { color: "#FFF" }]}
                    >
                      {u.nombre_unidad}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={() => setModalUnidadesVisible(true)}
                style={[
                  styles.btnChip,
                  unidadSel !== "TODOS" &&
                    !unidades
                      .slice(0, 3)
                      .some((u) => String(u.id_unidad) === String(unidadSel)) &&
                    styles.btnActive,
                ]}
              >
                <Text
                  style={[
                    styles.btnText,
                    unidadSel !== "TODOS" &&
                      !unidades
                        .slice(0, 3)
                        .some(
                          (u) => String(u.id_unidad) === String(unidadSel)
                        ) && { color: "#FFF" },
                  ]}
                >
                  📋 + Más ({unidades.length})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* FILA 2: RÉGIMEN LABORAL */}
          <View style={[styles.filterRow, { marginTop: 8 }]}>
            <Text style={styles.filterLabel}>Régimen:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {["TODOS", "CAS", "LOCADOR", "D.L. 728", "D.L. 276"].map((reg) => (
                <TouchableOpacity
                  key={reg}
                  onPress={() => setRegimenSel(reg)}
                  style={[
                    styles.btnChip,
                    regimenSel === reg && styles.btnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      regimenSel === reg && { color: "#FFF" },
                    ]}
                  >
                    {reg}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* MODAL DESPLEGABLE CON TODAS LAS UNIDADES */}
          <Modal
            visible={modalUnidadesVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setModalUnidadesVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Seleccionar Unidad Orgánica
                  </Text>
                  <TouchableOpacity
                    onPress={() => setModalUnidadesVisible(false)}
                  >
                    <Text style={styles.modalCloseBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={[
                    {
                      id_unidad: "TODOS",
                      nombre_unidad: "🔍 TODAS LAS UNIDADES",
                    },
                    ...unidades,
                  ]}
                  keyExtractor={(item) => String(item.id_unidad)}
                  renderItem={({ item }) => {
                    const idStr = String(item.id_unidad);
                    const isSelected = String(unidadSel) === idStr;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.modalItem,
                          isSelected && styles.modalItemSelected,
                        ]}
                        onPress={() => {
                          setUnidadSel(idStr);
                          setModalUnidadesVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalItemText,
                            isSelected && styles.modalItemTextSelected,
                          ]}
                        >
                          {item.nombre_unidad}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>
        </View>
      </View>

      {/* HEADER ESCRITORIO */}
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
            FOTO
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
              { flex: 0.8, textAlign: "center" },
            ]}
          >
            DNI
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 0.4, textAlign: "center" },
            ]}
          >
            GÉNERO
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 1.2, textAlign: "center" },
            ]}
          >
            CARGO
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 0.9, textAlign: "center" },
            ]}
          >
            USUARIO
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 0.9, textAlign: "center" },
            ]}
          >
            ROL
          </Text>
          <Text
            style={[
              styles.cell,
              styles.cellBorder,
              styles.headerText,
              { flex: 0.7, textAlign: "center" },
            ]}
          >
            RÉGIMEN
          </Text>
          <Text
            style={[
              styles.cell,
              styles.headerText,
              { flex: 0.6, textAlign: "center" },
            ]}
          >
            ESTADO
          </Text>
        </View>
      )}

      {/* FLATLIST */}
      <FlatList
        data={personas}
        keyExtractor={(item, index) => `${item.id_persona ?? "p"}-${index}`}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS !== "web"}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          !loadingList ? (
            <View style={{ padding: 30, alignItems: "center" }}>
              <Text style={{ color: "#64748B", fontSize: 13 }}>
                No se encontraron registros con los filtros seleccionados.
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
                <View
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 0.5, alignItems: "center" },
                  ]}
                >
                  <Image
                    source={
                      item.foto_perfil
                        ? { uri: item.foto_perfil }
                        : require("@/assets/images/roles/default.png")
                    }
                    style={styles.avatarTable}
                  />
                </View>

                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 2, fontWeight: "bold", color: "#000000" },
                  ]}
                  numberOfLines={1}
                >
                  {`${item.apellido_paterno || ""} ${
                    item.apellido_materno || ""
                  }, ${item.nombres || ""}`.toUpperCase()}
                </Text>

                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 0.8, color: "#000000" },
                  ]}
                >
                  {item.documento_numero}
                </Text>

                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 0.4, color: "#000000", textAlign: "center" },
                  ]}
                >
                  {item.genero === "M" ? "M" : item.genero === "F" ? "F" : "-"}
                </Text>

                <View style={[styles.cell, styles.cellBorder, { flex: 1.2 }]}>
                  <Text
                    style={{ color: "#000000", fontSize: 12 }}
                    numberOfLines={1}
                  >
                    {item.nombre_unidad || "SIN UNIDAD"}
                  </Text>
                  {item.cargo && (
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#64748B",
                        textAlign: "center",
                      }}
                      numberOfLines={1}
                    >
                      {item.cargo}
                    </Text>
                  )}
                </View>

                <View
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 0.9, alignItems: "center" },
                  ]}
                >
                  <View style={styles.badgeRolTabla}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "bold",
                        color: "#0085ca",
                      }}
                      numberOfLines={1}
                    >
                      {item.usuario || item.username || "sin_usuario"}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 0.9, color: "#000000", textAlign: "center" },
                  ]}
                  numberOfLines={1}
                >
                  {item.nombre_rol || "SIN ROL"}
                </Text>

                <Text
                  style={[
                    styles.cell,
                    styles.cellBorder,
                    { flex: 0.7, color: "#000000", textAlign: "center" },
                  ]}
                >
                  {item.regimen || "S/R"}
                </Text>

                <View style={[styles.cell, { flex: 0.6, alignItems: "center" }]}>
                  <BadgeEstado estado={item.estado_laboral} />
                </View>
              </>
            ) : (
              <View style={styles.cardContainer}>
                <Image
                  source={
                    item.foto_perfil
                      ? { uri: item.foto_perfil }
                      : require("@/assets/images/roles/default.png")
                  }
                  style={styles.avatarCard}
                />
                <View style={styles.cardInfo}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={[
                        styles.cardTitle,
                        { flex: 1, color: "#000000", fontWeight: "bold" },
                      ]}
                      numberOfLines={1}
                    >
                      {`${item.apellido_paterno || ""} ${
                        item.apellido_materno || ""
                      }, ${item.nombres || ""}`.toUpperCase()}
                    </Text>
                    <BadgeEstado estado={item.estado_laboral} />
                  </View>

                  <Text style={[styles.cardSubtitle, { color: "#000000" }]}>
                    DNI: {item.documento_numero} • Cel: {item.celular || "S/N"}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <View style={styles.badgeRolTabla}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "bold",
                          color: "#0085ca",
                        }}
                      >
                        👤 {item.usuario || item.username || "sin_usuario"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: "#000000" }}>|</Text>
                    <Text style={{ fontSize: 11, color: "#000000" }}>
                      {item.nombre_rol || "SIN ROL"}
                    </Text>
                  </View>

                  <Text
                    style={[styles.cardUnidad, { color: "#000000" }]}
                    numberOfLines={1}
                  >
                    🏢 {item.nombre_unidad || "SIN UNIDAD ASIGNADA"}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}
      />

      {/* MODAL EDITAR PERSONAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarModalEditar}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Editar Personal</ThemedText>
              <TouchableOpacity onPress={cerrarModalEditar} disabled={saving}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 15 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: "center",
                  backgroundColor:
                    modoAccion === "GUARDAR" ? MJM_BLUE : "#e2e8f0",
                }}
                onPress={() => setModoAccion("GUARDAR")}
              >
                <Text
                  style={{
                    fontWeight: "bold",
                    fontSize: 12,
                    color: modoAccion === "GUARDAR" ? "white" : "#64748b",
                  }}
                >
                  DATOS GENERALES
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: "center",
                  backgroundColor:
                    modoAccion === "PASSWORD" ? "#D32F2F" : "#e2e8f0",
                }}
                onPress={() => setModoAccion("PASSWORD")}
              >
                <Text
                  style={{
                    fontWeight: "bold",
                    fontSize: 12,
                    color: modoAccion === "PASSWORD" ? "white" : "#64748b",
                  }}
                >
                  RESET CONTRASEÑA
                </Text>
              </TouchableOpacity>
            </View>

            {personaEdit && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {modoAccion === "GUARDAR" ? (
                  <>
                    <View style={{ alignItems: "center", marginBottom: 15 }}>
                      <Image
                        source={
                          personaEdit.foto_perfil
                            ? { uri: personaEdit.foto_perfil }
                            : require("@/assets/images/roles/default.png")
                        }
                        style={styles.largeAvatar}
                      />
                      <TouchableOpacity onPress={pickImage}>
                        <Text
                          style={{
                            color: MJM_BLUE,
                            fontWeight: "bold",
                            fontSize: 12,
                          }}
                        >
                          CAMBIAR FOTO
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <ThemedText style={styles.label}>Nombres</ThemedText>
                    <TextInput
                      style={styles.modalInput}
                      maxLength={80}
                      value={personaEdit.nombres ?? ""}
                      onChangeText={(t) =>
                        setPersonaEdit((prev: any) => ({
                          ...prev,
                          nombres: t,
                        }))
                      }
                    />

                    <ThemedText style={styles.label}>Apellidos</ThemedText>
                    <View style={styles.rowForm}>
                      <TextInput
                        style={[styles.modalInput, { flex: 1 }]}
                        placeholder="Paterno"
                        placeholderTextColor="#999"
                        maxLength={60}
                        value={personaEdit.apellido_paterno ?? ""}
                        onChangeText={(t) =>
                          setPersonaEdit((prev: any) => ({
                            ...prev,
                            apellido_paterno: t,
                          }))
                        }
                      />
                      <TextInput
                        style={[styles.modalInput, { flex: 1 }]}
                        placeholder="Materno"
                        placeholderTextColor="#999"
                        maxLength={60}
                        value={personaEdit.apellido_materno ?? ""}
                        onChangeText={(t) =>
                          setPersonaEdit((prev: any) => ({
                            ...prev,
                            apellido_materno: t,
                          }))
                        }
                      />
                    </View>

                    <View style={styles.rowForm}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>DNI</ThemedText>
                        <TextInput
                          style={styles.modalInput}
                          value={personaEdit.documento_numero ?? ""}
                          keyboardType="numeric"
                          maxLength={10}
                          onChangeText={(t) =>
                            setPersonaEdit((prev: any) => ({
                              ...prev,
                              documento_numero: t.replace(/[^0-9]/g, ""),
                            }))
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.label}>Celular</ThemedText>
                        <TextInput
                          style={styles.modalInput}
                          value={personaEdit.celular ?? ""}
                          keyboardType="phone-pad"
                          maxLength={9}
                          onChangeText={(t) =>
                            setPersonaEdit((prev: any) => ({
                              ...prev,
                              celular: t.replace(/[^0-9]/g, ""),
                            }))
                          }
                        />
                      </View>
                    </View>

                    <ThemedText style={styles.label}>
                      Correo Electrónico
                    </ThemedText>
                    <TextInput
                      style={styles.modalInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="ejemplo@correo.com"
                      placeholderTextColor="#94A3B8"
                      maxLength={120}
                      value={personaEdit.correo ?? ""}
                      onChangeText={(t) =>
                        setPersonaEdit((prev: any) => ({
                          ...prev,
                          correo: t,
                        }))
                      }
                    />

                    <ThemedText style={styles.label}>Género</ThemedText>
                    <View
                      style={[
                        styles.modalPickerContainer,
                        { backgroundColor: "#FFFFFF" },
                      ]}
                    >
                      <Picker
                        selectedValue={personaEdit?.genero ?? ""}
                        style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                        itemStyle={{
                          color: "#000000",
                          backgroundColor: "#FFFFFF",
                        }}
                        dropdownIconColor="#000000"
                        onValueChange={(val) =>
                          setPersonaEdit((prev: any) => ({
                            ...prev,
                            genero: val || null,
                          }))
                        }
                      >
                        <Picker.Item
                          label="Seleccionar Género..."
                          value=""
                          color="#888888"
                        />
                        <Picker.Item
                          label="MASCULINO"
                          value="M"
                          color="#000000"
                        />
                        <Picker.Item
                          label="FEMENINO"
                          value="F"
                          color="#000000"
                        />
                      </Picker>
                    </View>

                    <ThemedText style={styles.label}>Estado Laboral</ThemedText>
                    <View
                      style={[
                        styles.modalPickerContainer,
                        { backgroundColor: "#FFFFFF" },
                      ]}
                    >
                      <Picker
                        selectedValue={personaEdit.estado_laboral ?? "ACTIVO"}
                        style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                        itemStyle={{
                          color: "#000000",
                          backgroundColor: "#FFFFFF",
                        }}
                        dropdownIconColor="#000000"
                        onValueChange={(val) =>
                          setPersonaEdit((prev: any) => ({
                            ...prev,
                            estado_laboral: val,
                          }))
                        }
                      >
                        <Picker.Item
                          label="ACTIVO"
                          value="ACTIVO"
                          color="#000000"
                        />
                        <Picker.Item
                          label="INACTIVO"
                          value="INACTIVO"
                          color="#000000"
                        />
                      </Picker>
                    </View>

                    <ThemedText style={styles.label}>Régimen</ThemedText>
                    <View
                      style={[
                        styles.modalPickerContainer,
                        { backgroundColor: "#FFFFFF" },
                      ]}
                    >
                      <Picker
                        selectedValue={personaEdit.regimen ?? "LOCADOR"}
                        style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                        itemStyle={{
                          color: "#000000",
                          backgroundColor: "#FFFFFF",
                        }}
                        dropdownIconColor="#000000"
                        onValueChange={(val) =>
                          setPersonaEdit((prev: any) => ({
                            ...prev,
                            regimen: val,
                          }))
                        }
                      >
                        <Picker.Item label="CAS" value="CAS" color="#000000" />
                        <Picker.Item
                          label="LOCADOR"
                          value="LOCADOR"
                          color="#000000"
                        />
                        <Picker.Item
                          label="D.L. 728"
                          value="D.L. 728"
                          color="#000000"
                        />
                        <Picker.Item
                          label="D.L. 276"
                          value="D.L. 276"
                          color="#000000"
                        />
                      </Picker>
                    </View>

                    <ThemedText style={styles.label}>Cargo / Unidad</ThemedText>
                    <View
                      style={[
                        styles.modalPickerContainer,
                        { backgroundColor: "#FFFFFF" },
                      ]}
                    >
                      <Picker
                        selectedValue={
                          personaEdit.id_unidad != null
                            ? String(personaEdit.id_unidad)
                            : ""
                        }
                        style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                        itemStyle={{
                          color: "#000000",
                          backgroundColor: "#FFFFFF",
                        }}
                        dropdownIconColor="#000000"
                        onValueChange={(val) =>
                          setPersonaEdit((prev: any) => ({
                            ...prev,
                            id_unidad: val,
                          }))
                        }
                      >
                        <Picker.Item
                          label="Seleccionar Unidad..."
                          value=""
                          color="#888888"
                        />
                        {unidades.map((u) => (
                          <Picker.Item
                            key={String(u.id_unidad)}
                            label={u.nombre_unidad || ""}
                            value={String(u.id_unidad)}
                            color="#000000"
                          />
                        ))}
                      </Picker>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.btnGuardar,
                        { marginTop: 20, opacity: saving ? 0.6 : 1 },
                      ]}
                      onPress={handleGuardarCambios}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <ThemedText
                          style={{ color: "white", fontWeight: "bold" }}
                        >
                          GUARDAR CAMBIOS
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={[styles.adminPasswordBox, { marginTop: 10 }]}>
                    <ThemedText
                      style={{
                        fontWeight: "bold",
                        color: MJM_BLUE,
                        fontSize: 13,
                        marginBottom: 10,
                      }}
                    >
                      Restablecer Contraseña / Rol
                    </ThemedText>

                    <ThemedText style={styles.label}>
                      Nueva Contraseña
                    </ThemedText>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Ingresar nueva contraseña (opcional si solo cambia rol)"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry
                      value={nuevaClaveAdmin ?? ""}
                      onChangeText={setNuevaClaveAdmin}
                      autoComplete="new-password"
                      textContentType="newPassword"
                    />

                    <ThemedText style={styles.label}>
                      Rol en el sistema
                    </ThemedText>
                    <View
                      style={[
                        styles.modalPickerContainer,
                        { backgroundColor: "#FFFFFF" },
                      ]}
                    >
                      <Picker
                        selectedValue={
                          personaEdit?.id_rol !== undefined &&
                          personaEdit?.id_rol !== null
                            ? String(personaEdit.id_rol)
                            : ""
                        }
                        style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                        itemStyle={{
                          color: "#000000",
                          backgroundColor: "#FFFFFF",
                        }}
                        dropdownIconColor="#000000"
                        onValueChange={(val) =>
                          setPersonaEdit((prev: any) => ({
                            ...prev,
                            id_rol: val ? Number(val) : null,
                          }))
                        }
                      >
                        <Picker.Item
                          label="Seleccionar Rol..."
                          value=""
                          color="#888888"
                        />
                        {roles.map((r) => (
                          <Picker.Item
                            key={String(r.id_rol)}
                            label={r.nombre_rol || r.nombre || ""}
                            value={String(r.id_rol)}
                            color="#000000"
                          />
                        ))}
                      </Picker>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.btnGuardar,
                        {
                          backgroundColor: "#D32F2F",
                          marginTop: 20,
                          opacity: saving ? 0.6 : 1,
                        },
                      ]}
                      onPress={handleAdminResetPassword}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <ThemedText
                          style={{ color: "white", fontWeight: "bold" }}
                        >
                          ACTUALIZAR ACCESO
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL CREAR NUEVO PERSONAL */}
      <Modal
        visible={modalCrearVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!saving) {
            setModalCrearVisible(false);
            setErrors({});
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>Nuevo Personal</ThemedText>
              <TouchableOpacity
                disabled={saving}
                onPress={() => {
                  setModalCrearVisible(false);
                  setErrors({});
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <ThemedText style={styles.label}>Nombres *</ThemedText>
              <TextInput
                autoCapitalize="characters"
                placeholder="Ingrese nombres"
                placeholderTextColor="#94A3B8"
                maxLength={80}
                style={[
                  styles.modalInput,
                  errors.nombres && {
                    borderColor: "#E53935",
                    borderWidth: 1.5,
                  },
                ]}
                value={nuevaPersona.nombres ?? ""}
                onChangeText={(t) => {
                  setNuevaPersona((prev) => ({ ...prev, nombres: t }));
                  if (errors.nombres)
                    setErrors((prev) => ({ ...prev, nombres: false }));
                }}
              />

              <ThemedText style={styles.label}>Apellido Paterno *</ThemedText>
              <TextInput
                autoCapitalize="characters"
                placeholder="Ingrese apellido paterno"
                placeholderTextColor="#94A3B8"
                maxLength={60}
                style={[
                  styles.modalInput,
                  errors.apellido_paterno && {
                    borderColor: "#E53935",
                    borderWidth: 1.5,
                  },
                ]}
                value={nuevaPersona.apellido_paterno ?? ""}
                onChangeText={(t) => {
                  setNuevaPersona((prev) => ({
                    ...prev,
                    apellido_paterno: t,
                  }));
                  if (errors.apellido_paterno)
                    setErrors((prev) => ({ ...prev, apellido_paterno: false }));
                }}
              />

              <ThemedText style={styles.label}>Apellido Materno *</ThemedText>
              <TextInput
                autoCapitalize="characters"
                placeholder="Ingrese apellido materno"
                placeholderTextColor="#94A3B8"
                maxLength={60}
                style={[
                  styles.modalInput,
                  errors.apellido_materno && {
                    borderColor: "#E53935",
                    borderWidth: 1.5,
                  },
                ]}
                value={nuevaPersona.apellido_materno ?? ""}
                onChangeText={(t) => {
                  setNuevaPersona((prev) => ({
                    ...prev,
                    apellido_materno: t,
                  }));
                  if (errors.apellido_materno)
                    setErrors((prev) => ({ ...prev, apellido_materno: false }));
                }}
              />

              <ThemedText style={styles.label}>DNI / Documento *</ThemedText>
              <TextInput
                placeholder="Mínimo 8 dígitos"
                placeholderTextColor="#94A3B8"
                style={[
                  styles.modalInput,
                  errors.documento_numero && {
                    borderColor: "#E53935",
                    borderWidth: 1.5,
                  },
                ]}
                keyboardType="numeric"
                maxLength={10}
                value={nuevaPersona.documento_numero ?? ""}
                onChangeText={(t) => {
                  const numericValue = t.replace(/[^0-9]/g, "");
                  setNuevaPersona((prev) => ({
                    ...prev,
                    documento_numero: numericValue,
                  }));
                  if (errors.documento_numero)
                    setErrors((prev) => ({ ...prev, documento_numero: false }));
                }}
              />

              <ThemedText style={styles.label}>Estado Laboral</ThemedText>
              <View
                style={[
                  styles.modalPickerContainer,
                  { backgroundColor: "#FFFFFF" },
                ]}
              >
                <Picker
                  selectedValue={nuevaPersona.estado_laboral ?? "ACTIVO"}
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) =>
                    setNuevaPersona((prev) => ({
                      ...prev,
                      estado_laboral: val,
                    }))
                  }
                >
                  <Picker.Item label="ACTIVO" value="ACTIVO" color="#000000" />
                  <Picker.Item
                    label="INACTIVO"
                    value="INACTIVO"
                    color="#000000"
                  />
                </Picker>
              </View>

              <ThemedText style={styles.label}>Régimen</ThemedText>
              <View
                style={[
                  styles.modalPickerContainer,
                  { backgroundColor: "#FFFFFF" },
                ]}
              >
                <Picker
                  selectedValue={nuevaPersona.regimen || "LOCADOR"}
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) =>
                    setNuevaPersona((prev) => ({ ...prev, regimen: val }))
                  }
                >
                  <Picker.Item
                    label="LOCADOR"
                    value="LOCADOR"
                    color="#000000"
                  />
                  <Picker.Item label="CAS" value="CAS" color="#000000" />
                  <Picker.Item
                    label="D.L. 728"
                    value="D.L. 728"
                    color="#000000"
                  />
                  <Picker.Item
                    label="D.L. 276"
                    value="D.L. 276"
                    color="#000000"
                  />
                </Picker>
              </View>

              <ThemedText style={styles.label}>Cargo / Unidad *</ThemedText>
              <View
                style={[
                  styles.modalPickerContainer,
                  { backgroundColor: "#FFFFFF" },
                  errors.id_unidad && {
                    borderColor: "#E53935",
                    borderWidth: 1.5,
                  },
                ]}
              >
                <Picker
                  selectedValue={
                    nuevaPersona.id_unidad
                      ? String(nuevaPersona.id_unidad)
                      : ""
                  }
                  style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
                  dropdownIconColor="#000000"
                  onValueChange={(val) => {
                    setNuevaPersona((prev) => ({ ...prev, id_unidad: val }));
                    if (errors.id_unidad)
                      setErrors((prev) => ({ ...prev, id_unidad: false }));
                  }}
                >
                  <Picker.Item
                    label="Seleccionar Unidad..."
                    value=""
                    color="#888888"
                  />
                  {unidades.map((u) => (
                    <Picker.Item
                      key={String(u.id_unidad)}
                      label={u.nombre_unidad || ""}
                      value={String(u.id_unidad)}
                      color="#000000"
                    />
                  ))}
                </Picker>
              </View>

              <TouchableOpacity
                style={[
                  styles.btnGuardar,
                  {
                    backgroundColor: "#024885",
                    marginTop: 25,
                    opacity: saving ? 0.6 : 1,
                  },
                ]}
                onPress={handleGuardarNuevo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                    REGISTRAR PERSONAL
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL ALERTAS (WEB) */}
      <Modal
        visible={customAlert.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setCustomAlert((prev) => ({ ...prev, visible: false }))
        }
      >
        <View style={styles.modalOverlay}>
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
                color: "#0F172A",
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
              style={[styles.btnGuardar, { width: "100%", marginTop: 18 }]}
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
  },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: MJM_BLUE },
  btnAdd: {
    backgroundColor: MJM_BLUE,
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  estadoToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  btnEstado: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnEstadoActive: { backgroundColor: MJM_BLUE },
  btnText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 13, color: "#0F172A" },
  modalPickerContainer: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    overflow: "hidden",
    height: 45,
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#024885",
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
  },
  headerText: { fontWeight: "bold", fontSize: 11, color: "#f9f9fa" },
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
  adminPasswordBox: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginBottom: 15,
  },
  avatarTable: { width: 32, height: 32, borderRadius: 16 },
  mobileCard: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardContainer: { flexDirection: "row", alignItems: "center" },
  avatarCard: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 13 },
  cardSubtitle: { fontSize: 11, color: "#64748B" },
  cardUnidad: { fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  filterRow: { flexDirection: "row", alignItems: "center" },
  filterLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B",
    width: 65,
  },
  btnChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxWidth: 200,
  },
  btnActive: { backgroundColor: MJM_BLUE },
  btnGuardar: {
    backgroundColor: MJM_BLUE,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
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
  alertContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  cellBorder: {
    borderRightWidth: 1,
    borderRightColor: "rgba(203, 213, 225, 0.4)",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
  },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 6 },
  rowForm: { flexDirection: "row", gap: 8 },
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
  modalCloseBtn: { fontSize: 18, color: "#64748B", padding: 4 },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    borderRadius: 6,
  },
  modalItemSelected: { backgroundColor: "#E2E8F0" },
  modalItemText: { fontSize: 14, color: "#334155" },
  modalItemTextSelected: { fontWeight: "bold", color: "#0F172A" },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#475569",
    marginTop: 8,
    marginBottom: 4,
  },
  badgeRolTabla: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
});