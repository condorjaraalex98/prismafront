import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  
  Image,
  Modal,      // 👈 Agregar si falta
  FlatList,   // 👈 Agregar si falta
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
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "${API_URL}";
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

export default function PersonaScreen() {
  
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;
const [modalUnidadesVisible, setModalUnidadesVisible] = useState<boolean>(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [counts, setCounts] = useState<any>({
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
    const [roles, setRoles] = useState<Rol[]>([]); 
const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPersonaEdit({
        ...personaEdit,
        foto_perfil: result.assets[0].uri,
        foto_perfil_base64: `data:image/jpeg;base64,${result.assets[0].base64}`,
      });
    }
  };
  // Paginación y Carga
  const [modoAccion, setModoAccion] = useState('GUARDAR'); // 'GUARDAR' | 'PASSWORD'
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Formularios y Modales
  const [errors, setErrors] = useState<any>({});
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success",
  });

  const [personaEdit, setPersonaEdit] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  
// ❌ BORRA O REEMPLAZA ESTO:
// ✅ PÓNLO ASÍ:
const INITIAL_PERSONA_STATE = {
  nombres: "",
  apellido_paterno: "",
  apellido_materno: "",
  documento_numero: "",
  celular: "",
  id_unidad: "26",
  regimen: "LOCADOR",
  estado_laboral: "ACTIVO",
};

// ... dentro de tu componente PersonaScreen():

const [nuevaPersona, setNuevaPersona] = useState(INITIAL_PERSONA_STATE);
  // Debounce para la búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchText]);

  // Carga de catálogo de unidades
  const cargarCatalogos = async () => {
    try {
      const [resUnidades, resRoles] = await Promise.all([
        fetch("${API_URL}/unidades"),
        fetch("${API_URL}/admin/roles"), // Asegúrate de tener este endpoint
      ]);
      const dataUnidades = await resUnidades.json();
      const dataRoles = await resRoles.json();

      setUnidades(dataUnidades || []);
      setRoles(dataRoles || []);
    } catch (e) {
      console.error("Error al cargar catálogos:", e);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  // Función principal de carga de datos
  const cargarDatos = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const nextPage = reset ? 1 : page;
        const query = new URLSearchParams({
          q: debouncedSearch,
          regimen: regimenSel,
          estado: estadoSel,
          unidad: unidadSel,
          page: nextPage.toString(),
        });

        const res = await fetch(`${API_URL}/personastotal?${query}`);
        const result = await res.json();

        setCounts({
          total: result.pagination?.total || result.counts?.total || 0,
          activos: result.counts?.activos || 0,
          inactivos: result.counts?.inactivos || 0,
        });

        const newRecords = result.data || [];
        setPersonas((prev) => (reset ? newRecords : [...prev, ...newRecords]));

        const canFetchMore = result.pagination
          ? result.pagination.hasMore
          : result.hasMore;

        setHasMore(Boolean(canFetchMore));
        setPage(nextPage + 1);
      } catch (e) {
        console.error("Error al cargar personas:", e);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, regimenSel, estadoSel, unidadSel, page, loading]
  );

  // Re-cargar datos ante cambios de filtros
  useEffect(() => {
    setHasMore(true);
    setPage(1);
    cargarDatos(true);
  }, [debouncedSearch, regimenSel, estadoSel, unidadSel]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      cargarDatos(false);
    }
  };

  // Función auxiliar asíncrona para obtener TODOS los registros antes de exportar
  const obtenerTodosLosDatosFiltrados = async () => {
    const query = new URLSearchParams({
      q: debouncedSearch,
      regimen: regimenSel,
      estado: estadoSel,
      unidad: unidadSel,
      export: "true",
    });

    const res = await fetch(`${API_URL}/personastotal?${query}`);
    const result = await res.json();
    return result.data || [];
  };

  // Exportar Excel Estándar Asíncrono
  const exportarExcel = async () => {
    try {
      setLoading(true);
      const dataCompleta = await obtenerTodosLosDatosFiltrados();

      if (!dataCompleta || dataCompleta.length === 0) {
        setCustomAlert({
          visible: true,
          title: "Sin datos",
          message: "No hay datos filtrados para exportar.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      // Proceso asíncrono en cola para no bloquear el hilo de renderizado
      setTimeout(() => {
        const datosFormato = dataCompleta.map((p: any) => ({
          DNI: p.documento_numero || "",
          "APELLIDO PATERNO": p.apellido_paterno || "",
          "APELLIDO MATERNO": p.apellido_materno || "",
          NOMBRES: p.nombres || "",
          CELULAR: p.celular || "",
           CORREO: p.correo|| "",
            GENERO: p.genero || "",
          "CARGO": p.nombre_unidad || p.cargo || "",
          RÉGIMEN: p.regimen || "",
          ESTADO: p.estado_laboral || "",
          USUARIO: p.usuario || p.username || "",
          ROL: p.nombre_rol || "",
        }));

        const worksheet = XLSX.utils.json_to_sheet(datosFormato);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Personal");

        XLSX.writeFile(workbook, "Reporte_Personal_Filtrado.xlsx");
        setLoading(false);
      }, 50);
    } catch (e) {
      console.error("Error al exportar:", e);
      setLoading(false);
    }
  };

  const [nuevaClaveAdmin, setNuevaClaveAdmin] = useState("");
  // Exportar Excel SIPCOP-M Asíncrono
  
const handleAdminResetPassword = async () => {
  if (nuevaClaveAdmin && nuevaClaveAdmin.trim().length > 0 && nuevaClaveAdmin.trim().length < 4) {
    setCustomAlert({
      visible: true,
      title: "Clave Inválida",
      message: "Si ingresas una contraseña, debe tener al menos 4 caracteres.",
      type: "error",
    });
    return;
  }

  try {
    setLoading(true);

    const payload: Record<string, any> = {};

    if (nuevaClaveAdmin && nuevaClaveAdmin.trim().length >= 4) {
      payload.nuevaClave = nuevaClaveAdmin.trim();
    }
    if (personaEdit?.id_rol !== undefined && personaEdit?.id_rol !== null) {
      payload.id_rol = personaEdit.id_rol;
    }
    if (personaEdit?.acceso_habilitado !== undefined && personaEdit?.acceso_habilitado !== null) {
      payload.acceso_habilitado = personaEdit.acceso_habilitado;
    }

    const res = await fetch(
      `${API_URL}/admin/reset-password/${personaEdit.id_persona}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();

    if (res.ok) {
      // 1. Buscamos el nombre del nuevo rol asignado en el array local 'roles'
      const rolEncontrado = roles.find(
        (r) => String(r.id_rol) === String(personaEdit.id_rol)
      );
      const nombreRolNuevo = rolEncontrado
        ? rolEncontrado.nombre_rol || rolEncontrado.nombre
        : personaEdit.nombre_rol;

      // 2. Actualizamos el registro en el FlatList (estado 'personas') de forma instantánea
      setPersonas((prevPersonas) =>
        prevPersonas.map((p) =>
          p.id_persona === personaEdit.id_persona
            ? { ...p, id_rol: personaEdit.id_rol, nombre_rol: nombreRolNuevo }
            : p
        )
      );

      // 3. Limpiamos variables y cerramos modal
      setNuevaClaveAdmin("");
      setModalVisible(false);

      // 4. Liberamos 'loading' antes de recargar la lista de la API
      setLoading(false);

      // 5. Mostramos la alerta de confirmación
      setCustomAlert({
        visible: true,
        title: "¡Éxito!",
        message: "Rol y/o contraseña actualizados correctamente.",
        type: "success",
      });

      // 6. Volvemos a pedir los datos a la API para asegurar sincronización total con el servidor
      cargarDatos(true);
    } else {
      setCustomAlert({
        visible: true,
        title: "Error",
        message: data.error || "No se pudo actualizar los datos.",
        type: "error",
      });
    }
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
  const handleGuardarCambios = async () => {
    if (!personaEdit) return;
    try {
      setLoading(true);
      const res = await fetch(
        `${API_URL}/updatepersona/${personaEdit.id_persona}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(personaEdit),
        }
      );

      if (res.ok) {
        setModalVisible(false);
        setCustomAlert({
          visible: true,
          title: "¡Éxito!",
          message: "La información se actualizó correctamente.",
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

  // Función handleGuardarNuevo tal como la definiste
  const handleGuardarNuevo = async () => {
    let newErrors: any = {};
    const {
      nombres,
      apellido_paterno,
      apellido_materno,
      documento_numero,
      
    } = nuevaPersona;

    if (!nombres.trim()) newErrors.nombres = true;
    if (!apellido_paterno.trim()) newErrors.apellido_paterno = true;
    if (!apellido_materno.trim()) newErrors.apellido_materno = true;
    if (!documento_numero.trim()) newErrors.documento_numero = true;
   

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setCustomAlert({
        visible: true,
        title: "Campos Faltantes",
        message: "Por favor complete los campos marcados en rojo.",
        type: "error",
      });
      return;
    }

    setErrors({});

    try {
      setLoading(true);
      const checkRes = await fetch(
        `${API_URL}/personas/check/${documento_numero}`
      );
      const checkData = await checkRes.json();

      if (checkData.exists) {
        setCustomAlert({
          visible: true,
          title: "DNI Duplicado",
          message: "Este número de documento ya está registrado.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      const res = await fetch("${API_URL}/insertpersonas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaPersona),
      });

      if (res.ok) {
        setModalCrearVisible(false);
        setNuevaPersona(INITIAL_PERSONA_STATE);
        setNuevaPersona({
          nombres: "",
          apellido_paterno: "",
          apellido_materno: "",
          documento_numero: "",
          celular: "",
          id_unidad: "",
          regimen: "CAS",
          estado_laboral: "ACTIVO",
        });
        setCustomAlert({
          visible: true,
          title: "¡Éxito!",
          message: "El personal ha sido registrado correctamente.",
          type: "success",
        });
        cargarDatos(true);
      }
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
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
     <ThemedText style={styles.headerTitle}>Personal</ThemedText>

  {/* EXPORTACIÓN EXCLUSIVA WEB */}
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
              setModalCrearVisible(true);
            }}
          >
            <Ionicons name="person-add" size={18} color="white" />
          </TouchableOpacity>
        </View>

        {/* ESTADO TOGGLE */}
     {/* BÚSQUEDA Y ESTADO TOGGLE */}
<View style={{ flexDirection: "column", gap: 8, marginBottom: 10 }}>
  {/* BÚSQUEDA (Ocupa el 100% del ancho en móvil) */}
  <View style={[styles.searchBar, { width: "100%", marginBottom: 0 }]}>
    <Ionicons name="search" size={18} color="#64748B" />
    <TextInput
      placeholder="Buscar por DNI y/o Nombres"
      placeholderTextColor="#94A3B8"
      style={styles.input}
      value={searchText}
      onChangeText={setSearchText}
      autoComplete="off"
    />
    {searchText !== "" && (
      <TouchableOpacity onPress={() => setSearchText("")}>
        <Ionicons name="close-circle" size={18} color="#888" />
      </TouchableOpacity>
    )}
  </View>

  {/* FILTROS DE ESTADO */}
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
   
  </ScrollView>
</View>

<View style={{ marginTop: 10 }}>

  {/* FILA 1: UNIDADES ORGÁNICAS (Top 3 + Desplegable) */}
  <View style={styles.filterRow}>
    <Text style={styles.filterLabel}>Unidad:</Text>
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {/* 1. Opción TODAS */}
      <TouchableOpacity
        onPress={() => setUnidadSel("TODOS")}
        style={[styles.btnChip, unidadSel === "TODOS" && styles.btnActive]}
      >
        <Text style={[styles.btnText, unidadSel === "TODOS" && { color: "#FFF" }]}>
          TODOS
        </Text>
      </TouchableOpacity>

      {/* 2. Primeras 3 unidades */}
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

      {/* 3. Botón Desplegable (+ Más) */}
      <TouchableOpacity
        onPress={() => setModalUnidadesVisible(true)}
        style={[
          styles.btnChip, 
          unidadSel !== "TODOS" && 
          !unidades.slice(0, 3).some(u => String(u.id_unidad) === String(unidadSel)) && 
          styles.btnActive
        ]}
      >
        <Text style={[
          styles.btnText, 
          unidadSel !== "TODOS" && 
          !unidades.slice(0, 3).some(u => String(u.id_unidad) === String(unidadSel)) && 
          { color: "#FFF" }
        ]}>
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
          style={[styles.btnChip, regimenSel === reg && styles.btnActive]}
        >
          <Text style={[styles.btnText, regimenSel === reg && { color: "#FFF" }]}>
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
          <Text style={styles.modalTitle}>Seleccionar Unidad Orgánica</Text>
          <TouchableOpacity onPress={() => setModalUnidadesVisible(false)}>
            <Text style={styles.modalCloseBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={[{ id_unidad: "TODOS", nombre_unidad: "🔍 TODAS LAS UNIDADES" }, ...unidades]}
          keyExtractor={(item) => String(item.id_unidad)}
          renderItem={({ item }) => {
            const idStr = String(item.id_unidad);
            const isSelected = String(unidadSel) === idStr;
            return (
              <TouchableOpacity
                style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                onPress={() => {
                  setUnidadSel(idStr);
                  setModalUnidadesVisible(false);
                }}
              >
                <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
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
    <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.5, textAlign: "center" }]}>
      FOTO
    </Text>
    <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 2, textAlign: "center" }]}>
      APELLIDOS Y NOMBRES
    </Text>
    <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.8, textAlign: "center" }]}>
      DNI
    </Text>
    <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.4, textAlign: "center" }]}>
      GÉNERO
    </Text>
    <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1.2, textAlign: "center" }]}>
      CARGO
    </Text>
    <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.9, textAlign: "center" }]}>
      USUARIO
    </Text>
    <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.9, textAlign: "center" }]}>
      ROL
    </Text>
    <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.7, textAlign: "center" }]}>
      RÉGIMEN
    </Text>
    <Text style={[styles.cell, styles.headerText, { flex: 0.6, textAlign: "center" }]}>
      ESTADO
    </Text>
  </View>
)}

      {/* FLATLIST CON OPTIMIZACIONES */}
     <FlatList
  data={personas}
  keyExtractor={(item, index) => `${item.id_persona}-${index}`}
  onEndReached={handleLoadMore}
  onEndReachedThreshold={0.4}
  initialNumToRender={15}
  maxToRenderPerBatch={10}
  windowSize={5}
  removeClippedSubviews={Platform.OS !== "web"}
  contentContainerStyle={{ paddingBottom: 20 }}
  ListFooterComponent={
    loading ? (
      <ActivityIndicator size="small" color={MJM_BLUE} style={{ marginVertical: 15 }} />
    ) : null
  }
  renderItem={({ item }) => (
    <TouchableOpacity
      style={isDesktop ? styles.tableRow : styles.mobileCard}
      onPress={() => {
        setPersonaEdit(item);
        setModalVisible(true);
      }}
    >
      {isDesktop ? (
        <>
          {/* FOTO (flex: 0.5) */}
          <View style={[styles.cell, styles.cellBorder, { flex: 0.5, alignItems: "center" }]}>
            <Image
              source={
                item.foto_perfil
                  ? { uri: item.foto_perfil }
                  : require("@/assets/images/roles/default.png")
              }
              style={styles.avatarTable}
            />
          </View>

          {/* APELLIDOS Y NOMBRES (flex: 1.8) */}
          <Text
            style={[styles.cell, styles.cellBorder, { flex: 2, fontWeight: "bold", color: "#000000" }]}
            numberOfLines={1}
          >
            {`${item.apellido_paterno} ${item.apellido_materno || ""}, ${item.nombres}`.toUpperCase()}
          </Text>

          {/* DNI (flex: 0.8) */}
          <Text style={[styles.cell, styles.cellBorder, { flex: 0.8, color: "#000000" }]}>
            {item.documento_numero}
          </Text>

          {/* GÉNERO (flex: 0.6) */}
          <Text style={[styles.cell, styles.cellBorder, { flex: 0.4, color: "#000000", textAlign: "center" }]}>
            {item.genero === "M" ? "M" : item.genero === "F" ? "F" : "-"}
          </Text>

          {/* CARGO (flex: 1.2) */}
          <View style={[styles.cell, styles.cellBorder, { flex: 1.2}]}>
            <Text style={{ color: "#000000", fontSize: 12}} numberOfLines={1}>
              {item.nombre_unidad || "SIN UNIDAD"}
            </Text>
            {item.cargo && (
              <Text style={{ fontSize: 10, color: "#64748B", textAlign: "center" }} numberOfLines={1}>
                {item.cargo}
              </Text>
            )}
          </View>

          {/* USUARIO (flex: 0.9) */}
          <View style={[styles.cell, styles.cellBorder, { flex: 0.9, alignItems: "center" }]}>
            <View style={styles.badgeRolTabla}>
              <Text style={{ fontSize: 10, fontWeight: "bold", color: "#0085ca" }} numberOfLines={1}>
                {item.usuario || item.username || "sin_usuario"}
              </Text>
            </View>
          </View>

          {/* ROL (flex: 0.9) */}
          <Text style={[styles.cell, styles.cellBorder, { flex: 0.9, color: "#000000", textAlign: "center" }]} numberOfLines={1}>
            {item.nombre_rol || "SIN ROL"}
          </Text>

          {/* RÉGIMEN (flex: 0.7) */}
          <Text style={[styles.cell, styles.cellBorder, { flex: 0.7, color: "#000000", textAlign: "center" }]}>
            {item.regimen || "S/R"}
          </Text>

          {/* ESTADO (flex: 0.6) - Sin celda con borde vertical al final */}
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.cardTitle, { flex: 1, color: "#000000", fontWeight: "bold" }]} numberOfLines={1}>
                {`${item.apellido_paterno} ${item.apellido_materno || ""}, ${item.nombres}`.toUpperCase()}
              </Text>
              <BadgeEstado estado={item.estado_laboral} />
            </View>

            <Text style={[styles.cardSubtitle, { color: "#000000" }]}>
              DNI: {item.documento_numero} • Cel: {item.celular || "S/N"}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <View style={styles.badgeRolTabla}>
                <Text style={{ fontSize: 10, fontWeight: "bold", color: "#0085ca" }}>
                  👤 {item.usuario || item.username || "sin_usuario"}
                </Text>
              </View>
              <Text style={{ fontSize: 10, color: "#000000" }}>|</Text>
              <Text style={{ fontSize: 11, color: "#000000" }}>
                {item.nombre_rol || "SIN ROL"}
              </Text>
            </View>

            <Text style={[styles.cardUnidad, { color: "#000000" }]} numberOfLines={1}>
              🏢 {item.nombre_unidad || "SIN UNIDAD ASIGNADA"}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 3 }}>
              <Text style={{ fontSize: 10, color: "#000000" }}>
                Régimen: {item.regimen || "S/R"}
              </Text>
              {item.cargo && (
                <Text style={{ fontSize: 10, color: "#000000" }} numberOfLines={1}>
                  • Cargo: {item.cargo}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  )}
/>
 {/* MODAL EDITAR PERSONAL */}
  <Modal visible={modalVisible} transparent animationType="slide">
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      
      {/* HEADER DEL MODAL */}
      <View style={styles.modalHeader}>
        <ThemedText style={styles.modalTitle}>Editar Personal</ThemedText>
        <TouchableOpacity onPress={() => setModalVisible(false)}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* TABS SUPERIORES / BOTONES DE SELECCIÓN */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 15 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 8,
            alignItems: "center",
            backgroundColor: modoAccion === "GUARDAR" ? MJM_BLUE : "#e2e8f0",
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
            backgroundColor: modoAccion === "PASSWORD" ? "#D32F2F" : "#e2e8f0",
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
        <ScrollView showsVerticalScrollIndicator={false}>
          
          {/* MODO 1: EDITAR DATOS GENERALES */}
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
                  <Text style={{ color: MJM_BLUE, fontWeight: "bold", fontSize: 12 }}>
                    CAMBIAR FOTO
                  </Text>
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.label}>Nombres</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={personaEdit.nombres}
                onChangeText={(t) => setPersonaEdit({ ...personaEdit, nombres: t })}
              />

              <ThemedText style={styles.label}>Apellidos</ThemedText>
              <View style={styles.rowForm}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="Paterno"
                  placeholderTextColor="#999"
                  value={personaEdit.apellido_paterno}
                  onChangeText={(t) =>
                    setPersonaEdit({ ...personaEdit, apellido_paterno: t })
                  }
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="Materno"
                  placeholderTextColor="#999"
                  value={personaEdit.apellido_materno}
                  onChangeText={(t) =>
                    setPersonaEdit({ ...personaEdit, apellido_materno: t })
                  }
                />
              </View>

              <View style={styles.rowForm}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>DNI</ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    value={personaEdit.documento_numero}
                    keyboardType="numeric"
                    maxLength={10}
                    onChangeText={(t) =>
                      setPersonaEdit({
                        ...personaEdit,
                        documento_numero: t.replace(/[^0-9]/g, ""),
                      })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Celular</ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    value={personaEdit.celular}
                    keyboardType="phone-pad"
                    maxLength={9}
                    onChangeText={(t) =>
                      setPersonaEdit({
                        ...personaEdit,
                        celular: t.replace(/[^0-9]/g, ""),
                      })
                    }
                  />
                </View>
              </View>

              {/* CAMPO AGREGADO: Correo */}
              <ThemedText style={styles.label}>Correo Electrónico</ThemedText>
              <TextInput
                style={styles.modalInput}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="ejemplo@correo.com"
                value={personaEdit.correo || ""}
                onChangeText={(t) =>
                  setPersonaEdit({ ...personaEdit, correo: t })
                }
              />

              {/* CAMPO AGREGADO: Género */}
            <ThemedText style={styles.label}>Género</ThemedText>
<View style={styles.modalPickerContainer}>
  <Picker
    selectedValue={personaEdit?.genero ?? ""}
    onValueChange={(val) =>
      setPersonaEdit((prev: any) => ({
        ...prev,
        genero: val || null,
      }))
    }
  >
    <Picker.Item label="Seleccionar Género..." value="" />
    <Picker.Item label="MASCULINO" value="M" />
    <Picker.Item label="FEMENINO" value="F" />
  </Picker>
</View>

              <ThemedText style={styles.label}>Estado Laboral</ThemedText>
              <View style={styles.modalPickerContainer}>
                <Picker
                  selectedValue={personaEdit.estado_laboral}
                  onValueChange={(val) =>
                    setPersonaEdit({ ...personaEdit, estado_laboral: val })
                  }
                >
                  <Picker.Item label="ACTIVO" value="ACTIVO" />
                  <Picker.Item label="INACTIVO" value="INACTIVO" />
                </Picker>
              </View>

              <ThemedText style={styles.label}>Régimen</ThemedText>
              <View style={styles.modalPickerContainer}>
                <Picker
                  selectedValue={personaEdit.regimen}
                  onValueChange={(val) =>
                    setPersonaEdit({ ...personaEdit, regimen: val })
                  }
                >
                  <Picker.Item label="CAS" value="CAS" />
                  <Picker.Item label="LOCADOR" value="LOCADOR" />
                  <Picker.Item label="D.L. 728" value="D.L. 728" />
                  <Picker.Item label="D.L. 276" value="D.L. 276" />
                </Picker>
              </View>

              <ThemedText style={styles.label}>Cargo</ThemedText>
              <View style={styles.modalPickerContainer}>
                <Picker
                  selectedValue={
                    personaEdit.id_unidad != null ? String(personaEdit.id_unidad) : null
                  }
                  onValueChange={(val) =>
                    setPersonaEdit({ ...personaEdit, id_unidad: val })
                  }
                >
                  <Picker.Item label="Seleccionar Unidad..." value={null} />
                  {unidades.map((u) => (
                    <Picker.Item
                      key={String(u.id_unidad)}
                      label={u.nombre_unidad || ""}
                      value={String(u.id_unidad)}
                    />
                  ))}
                </Picker>
              </View>

              <TouchableOpacity
                style={[styles.btnGuardar, { marginTop: 20 }]}
                onPress={handleGuardarCambios}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                    GUARDAR CAMBIOS
                  </ThemedText>
                )}
              </TouchableOpacity>
            </>
          ) : (
            
            /* MODO 2: RESTABLECER CONTRASEÑA Y ROL */
            <View style={[styles.adminPasswordBox, { marginTop: 10 }]}>
              <ThemedText style={{ fontWeight: "bold", color: MJM_BLUE, fontSize: 13, marginBottom: 10 }}>
                Restablecer Contraseña Olvidada
              </ThemedText>
              
              <ThemedText style={styles.label}>Nueva Contraseña</ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="Ingresar nueva contraseña"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={nuevaClaveAdmin}
                onChangeText={setNuevaClaveAdmin}
                autoComplete="new-password"     
  textContentType="newPassword"
              />

              <ThemedText style={styles.label}> Rol en el sistema</ThemedText>
              <View style={styles.modalPickerContainer}>
                <Picker
  selectedValue={
    personaEdit?.id_rol !== undefined && personaEdit?.id_rol !== null
      ? String(personaEdit.id_rol)
      : personaEdit?.rol_id !== undefined && personaEdit?.rol_id !== null
      ? String(personaEdit.rol_id)
      : ""
  }
  onValueChange={(val) =>
    setPersonaEdit((prev: any) => ({
      ...prev,
      id_rol: val ? Number(val) : null,
    }))
  }
>
  <Picker.Item label="Seleccionar Rol..." value="" />
  {roles?.map((r) => (
    <Picker.Item
      key={String(r.id_rol)}
      label={r.nombre_rol || r.nombre || ""}
      value={String(r.id_rol)}
    />
  ))}
</Picker>
              </View>

              <TouchableOpacity
                style={[styles.btnGuardar, { backgroundColor: "#D32F2F", marginTop: 20 }]}
                onPress={handleAdminResetPassword}
              >
                <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                  CAMBIAR CONTRASEÑA
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      )}
    </View>
  </View>
</Modal>

      {/* MODAL CREAR PERSONAL CON TU CÓDIGO Y CAMPOS ADICIONALES */}
      <Modal visible={modalCrearVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>Nuevo Personal</ThemedText>
              <TouchableOpacity
                onPress={() => {
                  setModalCrearVisible(false);
                  setErrors({});
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.label}>Nombres *</ThemedText>
              <TextInput
                style={[
                  styles.modalInput,
                  errors.nombres && {
                    borderColor: "#E53935",
                    borderWidth: 1.5,
                  },
                ]}
                placeholder=""
                value={nuevaPersona.nombres}
                onChangeText={(t) => {
                  setNuevaPersona({ ...nuevaPersona, nombres: t });
                  if (errors.nombres) setErrors({ ...errors, nombres: false });
                }}
              />

              <ThemedText style={styles.label}>Apellido Paterno *</ThemedText>
              <TextInput
                autoCapitalize="characters"
                style={[
                  styles.modalInput,
                  errors.apellido_paterno && {
                    borderColor: "#E53935",
                    borderWidth: 1.5,
                  },
                ]}
                placeholder=""
                value={nuevaPersona.apellido_paterno}
                onChangeText={(t) => {
                  setNuevaPersona({ ...nuevaPersona, apellido_paterno: t });
                  if (errors.apellido_paterno) setErrors({ ...errors, apellido_paterno: false });
                }}
              />

              <ThemedText style={styles.label}>Apellido Materno *</ThemedText>
              <TextInput
                style={[
                  styles.modalInput,
                  errors.apellido_materno && {
                    borderColor: "#E53935",
                    borderWidth: 1.5,
                  },
                ]}
                placeholder=""
                value={nuevaPersona.apellido_materno}
                onChangeText={(t) => {
                  setNuevaPersona({ ...nuevaPersona, apellido_materno: t });
                  if (errors.apellido_materno) setErrors({ ...errors, apellido_materno: false });
                }}
              />

              <ThemedText style={styles.label}>DNI / Documento *</ThemedText>
              <TextInput
                style={[
                  styles.modalInput,
                  errors.documento_numero && {
                    borderColor: "#E53935",
                    borderWidth: 1.5,
                  },
                ]}
                keyboardType="numeric"
                maxLength={10}
                value={nuevaPersona.documento_numero}
                onChangeText={(t) => {
                  const numericValue = t.replace(/[^0-9]/g, "");
                  setNuevaPersona({
                    ...nuevaPersona,
                    documento_numero: numericValue,
                  });
                  if (errors.documento_numero) {
                    setErrors({ ...errors, documento_numero: false });
                  }
                }}
              />

           
              <ThemedText style={styles.label}>Estado Laboral</ThemedText>
              <View style={styles.modalPickerContainer}>
                <Picker
                  selectedValue={nuevaPersona.estado_laboral}
                  onValueChange={(val) =>
                    setNuevaPersona({ ...nuevaPersona, estado_laboral: val })
                  }
                >
                  <Picker.Item label="ACTIVO" value="ACTIVO" />
                  <Picker.Item label="INACTIVO" value="INACTIVO" />
                </Picker>
              </View>

              <ThemedText style={styles.label}>Régimen</ThemedText>
             <View style={styles.modalPickerContainer}>
  <Picker
    selectedValue={nuevaPersona.regimen || 'LOCADOR'}
    onValueChange={(val) =>
      setNuevaPersona({ ...nuevaPersona, regimen: val })
    }
  >
    <Picker.Item label="LOCADOR" value="LOCADOR" />
    <Picker.Item label="CAS" value="CAS" />
    <Picker.Item label="D.L. 728" value="D.L. 728" />
    <Picker.Item label="D.L. 276" value="D.L. 276" />
  </Picker>
</View>

              <ThemedText style={styles.label}>Cargo</ThemedText>
              <View style={styles.modalPickerContainer}>
                <Picker
                  selectedValue={nuevaPersona.id_unidad}
                  onValueChange={(val) =>
                    setNuevaPersona({ ...nuevaPersona, id_unidad: val })
                  }
                >
                  <Picker.Item label="Seleccionar Unidad..." value="" />
                  {unidades.map((u) => (
                    <Picker.Item
                      key={String(u.id_unidad)}
                      label={u.nombre_unidad || ""}
                      value={u.id_unidad}
                    />
                  ))}
                </Picker>
              </View>

              <TouchableOpacity
                style={[
                  styles.btnGuardar,
                  { backgroundColor: "#024885", marginTop: 25 },
                ]}
                onPress={handleGuardarNuevo}
                disabled={loading}
              >
                {loading ? (
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

      {/* MODAL ALERTAS */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Ionicons
              name={customAlert.type === "success" ? "checkmark-circle" : "alert-circle"}
              size={55}
              color={customAlert.type === "success" ? "#2E7D32" : "#E53935"}
            />
            <ThemedText style={{ fontSize: 16, fontWeight: "bold", marginTop: 10, color: "#0F172A" }}>
              {customAlert.title}
            </ThemedText>
            <ThemedText style={{ textAlign: "center", color: "#64748B", marginTop: 8, fontSize: 13 }}>
              {customAlert.message}
            </ThemedText>
            <TouchableOpacity
              style={[styles.btnGuardar, { width: "100%", marginTop: 18 }]}
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
  btnReg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#F1F5F9", marginRight: 6 },
  btnActive: { backgroundColor: MJM_BLUE },
  btnText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 10, height: 40 },
  input: { flex: 1, marginLeft: 8, fontSize: 13, color: "#0F172A" },modalPickerContainer: {
  borderWidth: 1,
  minWidth: 0,
  borderColor: "#CBD5E1",
  borderRadius: 8,
  backgroundColor: "#F8FAFC",
  justifyContent: "center",
  overflow: "hidden",
  paddingVertical: 0,
  height: 45, // 👈 Forzar una altura fija compacta para que no ocupe toda la pantalla
},

pickerStyle: {
  height: 45,
  marginTop: Platform.OS === "ios" ? -80 : 0, // 👈 Compensa el offset vertical del Wheel en iOS
},
  tableHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#024885", borderBottomWidth: 1, borderBottomColor: "#CBD5E1" },
  
  
  
  headerText: { fontWeight: "bold", fontSize: 11, color: "#f9f9fa" },
  tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  cell: {
  flex: 1,
  padding: 8,
  justifyContent: 'center',
},
adminPasswordBox: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginBottom: 15,
  },
  avatarTable: { width: 32, height: 32, borderRadius: 16 },
  mobileCard: { backgroundColor: "#FFFFFF", padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  cardContainer: { flexDirection: "row", alignItems: "center" },
  avatarCard: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 13 },
  cardSubtitle: { fontSize: 11, color: "#64748B" },
  cardUnidad: { fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

filterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748B",
    width: 65, // Alinea las dos filas verticalmente
  },
  
  btnChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxWidth: 200, // Limita el ancho si el nombre de la subgerencia es muy largo
  },
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
    borderRightColor: "rgba(203, 213, 225, 0.4)", // Borde suave adaptable
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
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
  },
  modalCloseBtn: {
    fontSize: 18,
    color: "#64748B",
    padding: 4,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    borderRadius: 6,
  },
  modalItemSelected: {
    backgroundColor: "#E2E8F0",
  },
  modalItemText: {
    fontSize: 14,
    color: "#334155",
  },
  modalItemTextSelected: {
    fontWeight: "bold",
    color: "#0F172A",
  },
label: { fontSize: 11, fontWeight: "bold", color: "#475569", marginTop: 8, marginBottom: 4 },
  badgeRolTabla: { backgroundColor: "#E0F2FE", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
});