import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
  import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { comprimirImagen } from "@/utils/compressImage";
import { subirFotoAlServidor } from "@/utils/subirFotoServidor";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/userContext";

interface ChecklistItem {
  id_item: number;
  id_categoria: number;
  nombre_categoria: string;
  nombre_item: string;
}

interface Respuesta {
  conforme: boolean;
  obs: string;
}

interface Unidad {
  id_unidad: string | number;
  id_tipo_vehiculo: string | number;
  placa: string;
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
type FotoEstado = {
  uri: string;
  url_remota: string | null;
  uploading: boolean;
  base64?: string;
};
const MJM_BLUE = "#024885";
const ID_CAMIONETA = 1;
const ID_MOTOCICLETA = 2;
const ID_PATRULLAJE_MOTORIZADO = 3;
const MAX_FOTOS = 1;

const ZONAS_POR_VEHICULO: Record<number, number[]> = {
  [ID_CAMIONETA]: [1,2,3,4,25, 26, 27, 28, 29, 30, 31, 32, 33],
  [ID_MOTOCICLETA]: [5,25,26,27,28,29,30,31,32,33], 
};

const ZONAS_POR_PATRULLAJE: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  2: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],

   4: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  5: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],

   6: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  8: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
   3: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  7: [10, 11, 12, 13, 34, 35, 36, 37, 38, 39, 40, 41, 42],
};

export default function RegistroOcurrencia() {
  const insets = useSafeAreaInsets();
  const { userData } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
   const isDark = colorScheme === "dark";

  const liberarUriPreview = (uri: string) => {
  if (Platform.OS === "web" && uri && uri.startsWith("blob:")) {
    URL.revokeObjectURL(uri);
  }
};
const [fotos, setFotos] = useState<FotoEstado[]>([]);
  // --- ESTADOS ---
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("Subiendo...");
  const [isFinished, setIsFinished] = useState(false);
 

  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"time" | "date">("time");
  const [activeField, setActiveField] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistRespuestas, setChecklistRespuestas] = useState<Record<number, Respuesta>>({});
  const [modalChecklistVisible, setModalChecklistVisible] = useState(false);
  const [odometroInicial, setOdometroInicial] = useState("");
  const [unidadTemporal, setUnidadTemporal] = useState<any>(null);

  const [catalogos, setCatalogos] = useState({
    usuarios: [],
    modalidades: [],
    origenes: [],
    camaras: [],
    tipos_patrullaje: [],
    modalidades_patrullaje: [],
    tipos_vehiculo: [],
    unidades: [],
    pnps: [],
    lugares: [],
    radios: [],
    zonas: [],
  });

  const [unidadForm, setUnidadForm] = useState({
    id_tipo_vehiculo: null as number | null,
    id_unidad: null as number | null,
    placa: "",
    tipo_asignacion: "MUNICIPAL" as "MUNICIPAL" | "INTEGRADO",
    id_pnp: null as number | null,
  });

  const getHoy = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
  };

  const [form, setForm] = useState({
    id_usuario: null as number | null,
    id_lugar: "604",
    id_modalidad: "139",
    id_origen: "9",
    id_tipo_patrullaje: null as number | null,
    id_modalidad_patrullaje: "7",  
    vehiculos_detalle: [] as any[],
    id_camara: [] as any[],
    descripcion: "Inicio de Servicio",
    hora_alerta: "",
    hora_llegada: "",
    hora_repliegue: "",
    latitud_gps: "0",
    longitud_gps: "0",
 turno: null,
    nombre_punto_gps: "",
    estadoOcurrencia: "VERIFICADO",
    referencia: "",
    id_radio: null as number | string | null,
    id_zona: null as number | string | null,
    unidad_encargada: "SERENAZGO",
    fecha_evento: getHoy(),
    grupo: null,
  });

  const resetFormulario = () => {
    setForm({
      id_usuario: userData?.id || (userData as any)?.id_usuario || null,
      id_lugar: "604",
      id_modalidad: "139",
      id_origen: "9",
      id_tipo_patrullaje: null,
      id_modalidad_patrullaje: "7",
      vehiculos_detalle: [],
      id_camara: [],
      descripcion: "Inicio de Servicio",
      hora_alerta: "",
      hora_llegada: "",
      hora_repliegue: "",
      latitud_gps: "0",
      longitud_gps: "0",
 turno: null,
      nombre_punto_gps: "",
      estadoOcurrencia: "VERIFICADO",
      referencia: "",
      id_radio: null,
      id_zona: null,
      unidad_encargada: "SERENAZGO",
      fecha_evento: getHoy(),
      grupo: null,
    });

    setUnidadForm({
      id_tipo_vehiculo: null,
      id_unidad: null,
      placa: "",
      tipo_asignacion: "MUNICIPAL",
      id_pnp: null,
    });

    setFotos([]);
    setStep(1);
  };

  // --- CARGA Y PETICIONES ---
  const cargarChecklist = async (idTipoVehiculo: string | number) => {
    try {
      const response = await fetch(
        `${API_URL}/catalogos/checklist-itemsfiltro1?id_tipo_vehiculo=${idTipoVehiculo}`
      );
      const data = await response.json();
      setChecklistItems(data);
    } catch (error) {
      console.error("Error al cargar checklist:", error);
    }
  };

  const zonasFiltradas = catalogos.zonas.filter((zona: any) => {
  if (!form.id_tipo_patrullaje) return true;

  // 1. Si es patrullaje motorizado, la restricción del vehículo MANDA PRIMERO
  if (form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO) {
    const primerVehiculo = form.vehiculos_detalle[0];
    const idTipoVehiculo = primerVehiculo?.id_tipo_vehiculo || unidadForm.id_tipo_vehiculo;

    if (idTipoVehiculo) {
      const zonasPermitidasVehiculo = ZONAS_POR_VEHICULO[idTipoVehiculo];
      
      // Si el vehículo tiene una restricción explícita definida, devolver SOLO esas zonas
      if (zonasPermitidasVehiculo) {
        return zonasPermitidasVehiculo.includes(zona.value);
      }
    }
  }

  // 2. Si no es un vehículo con zona restringida, aplicar el filtro por tipo de patrullaje
  const zonasPermitidasPatrullaje = ZONAS_POR_PATRULLAJE[form.id_tipo_patrullaje as number];
  
  if (zonasPermitidasPatrullaje) {
    return zonasPermitidasPatrullaje.includes(zona.value);
  }

  return true;
});

  const abrirChecklist = (unidad: Unidad) => {
    setUnidadTemporal(unidad);
    setChecklistRespuestas({});
    cargarChecklist(unidad.id_tipo_vehiculo);
    setModalChecklistVisible(true);
  };

  const cargarCatalogosInit = async () => {
    try {
      const [resGral, resTiposV, resPnps, resRadios, resZonas] = await Promise.all([
        fetch(`${API_URL}/catalogos/completo/unificadov?tipoLugar=2&idTipoP=5`),
        fetch(`${API_URL}/catalogos/tipos-vehiculo`),
        fetch(`${API_URL}/catalogos/pnp-activos`),
        fetch(`${API_URL}/catalogos/radios`),
        fetch(`${API_URL}/catalogos/zonas`),
      ]);

      const dataGral = await resGral.json();router
      const dataTiposV = await resTiposV.json();
      const dataPnps = await resPnps.json();
      const dataRadios = await resRadios.json();
      const dataZonas = await resZonas.json();

      setCatalogos({
        usuarios: dataGral.usuarios || [],
        modalidades: dataGral.modalidades || [],
        origenes: dataGral.origenes || [],
        camaras: dataGral.camara || [],
        tipos_patrullaje: dataGral.tipos_patrullaje || [],
        modalidades_patrullaje: dataGral.modalidades_patrullaje || [],
        tipos_vehiculo: dataTiposV || [],
        unidades: [],
        pnps: dataPnps || [],
        lugares: dataGral.lugares || [],
        radios: dataRadios || [],
        zonas: dataZonas || [],
      });
    } catch (err) {
      console.error("Error catálogos:", err);
    }
  };

  const fetchUnidades = async (idTipo: any) => {
    try {
      const res = await fetch(`${API_URL}/catalogos/vehiculos-por-tipo/${idTipo}`);
      const data = await res.json();
      setCatalogos((prev) => ({ ...prev, unidades: data }));
    } catch (e) {
      console.error(e);
    }
  };

  const obtenerGpsAutomatico = async () => {
    try {
      let lat, lon;
      if (Platform.OS === "web") {
        lat = -12.073769;
        lon = -77.039673;
      } else {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }
      setForm((prev) => ({
        ...prev,
        latitud_gps: lat.toString(),
        longitud_gps: lon.toString(),
      }));
      const reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (reverseGeocode.length > 0) {
        const p = reverseGeocode[0];
        const direccionNombre = `${p.street || ""} ${p.streetNumber || ""}, ${p.district || p.city || ""}`.trim();
        setForm((prev) => ({
          ...prev,
          nombre_punto_gps: direccionNombre || "Ubicación identificada",
        }));
      }
    } catch (e) {
      console.error("Error GPS:", e);
    }
  };

  useEffect(() => {
    if (userData) {
      setForm((prev) => ({
        ...prev,
        id_usuario: userData.id || (userData as any).id_usuario,
      }));
    }
    setForm((prev) => ({ ...prev, fecha_evento: getHoy() }));
    cargarCatalogosInit();
    obtenerGpsAutomatico();
  }, [userData]);

  // --- VALIDACIÓN Y NAVEGACIÓN ---
  const canAdvance = () => {
    if (step === 1) {
      const hasBasics = !!form.id_tipo_patrullaje && !!form.id_modalidad_patrullaje && !!form.id_origen;
      if (form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO) {
        return hasBasics && form.vehiculos_detalle.length > 0;
      }
      return hasBasics;
    }
    if (step === 2) {
      return !!form.hora_alerta && !!form.fecha_evento;
    }
    if (step === 3) {
      if (!form.id_radio || !form.id_zona) return false;
      const esMotorizado = form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO;
      if (esMotorizado) {
        return fotos.length > 0;
      }
      return true;
    }
    return false;
  };

  const getDynamicBorderStyle = (value: any) => ({
    borderColor: value ? MJM_BLUE : isDark ? "#444" : "#ddd",
    borderWidth: value ? 1.5 : 1,
  });

  const formatearFechaEspañol = (fechaStr: string) => {
    if (!fechaStr) return "Seleccione fecha";
    const fecha = new Date(fechaStr + "T12:00:00");
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${diasSemana[fecha.getDay()]}, ${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`;
  };

  const confirmarChecklistUnidad = () => {
    if (!odometroInicial.trim()) {
      return Alert.alert("Atención", "Ingrese el odómetro inicial.");
    }
    const checklist_items = checklistItems.map((item) => {
      const respuesta = checklistRespuestas[item.id_item];
      const esConforme = respuesta !== undefined ? respuesta.conforme : true;
      return {
        id_item: item.id_item,
        esta_conforme: esConforme ? 1 : 0,
        observacion: respuesta?.obs || "",
      };
    });

    setForm((prev: any) => ({
      ...prev,
      vehiculos_detalle: [
        ...prev.vehiculos_detalle,
        {
          ...unidadTemporal,
          odometro_inicial: odometroInicial,
          checklist_items: checklist_items,
        },
      ],
    }));

    setOdometroInicial("");
    setUnidadForm({
      id_tipo_vehiculo: null,
      id_unidad: null,
      placa: "",
      tipo_asignacion: "MUNICIPAL",
      id_pnp: null,
    });
    setModalChecklistVisible(false);
  };

  const tomarFoto = async () => {
    if (fotos.length >= MAX_FOTOS) return Alert.alert("Límite", "Máximo 1 foto.");
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return Alert.alert("Error", "Sin permiso de cámara");
    let res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.3 });
    if (!res.canceled) {
      setFotos((p) => [...p, { uri: res.assets[0].uri, base64: `data:image/jpeg;base64,${res.assets[0].base64}` }]);
    }
  };

  const seleccionarGaleria = async () => {
    if (fotos.length >= MAX_FOTOS) return Alert.alert("Límite", "Máximo 1 foto.");
    let res = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      allowsMultipleSelection: false,
      quality: 0.3,
    });
    if (!res.canceled) {
      const nuevas = res.assets.map((a) => ({ uri: a.uri, base64: `data:image/jpeg;base64,${a.base64}` }));
      setFotos((p) => [...p, ...nuevas].slice(0, MAX_FOTOS));
    }
  };

  const enviarRegistro = async () => {
    const idFinal = form.id_usuario || userData?.id || (userData as any)?.id_usuario;
    if (!idFinal) {
      return Alert.alert("Atención", "No se pudo identificar al usuario.");
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus("Subiendo...");
    setIsFinished(false);

    const interval = setInterval(() => setUploadProgress((p) => (p < 90 ? p + 10 : p)), 150);
    try {
      const res = await fetch(`${API_URL}/api/vehiculo/iniciar-servicio-checkcompleto123`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id_usuario: Number(idFinal),
          id_tipop: form.id_tipo_patrullaje,
          id_modalidadp: form.id_modalidad_patrullaje,
          id_camara: form.id_camara.map((c) => (c as any).value).join(","),
          fotos: fotos.map((f) => ({ base64_data: f.base64 })),
          id_radio: form.id_radio,
          id_zona: form.id_zona,
        }),
      });
      clearInterval(interval);

      if (res.ok) {
        setUploadProgress(100);
        setUploadStatus("¡Listo! Subido");
        setIsFinished(true);

        setTimeout(() => {
          setLoading(false);
          resetFormulario();
          router.replace("/principalDron");
        }, 1200);
      } else {
        const errorData = await res.json();
        setLoading(false);
        Alert.alert("Error", errorData.error || "No se pudo guardar el registro.");
      }
    } catch (e) {
      clearInterval(interval);
      setLoading(false);
      Alert.alert("Error", "Error de conexión con el servidor.");
    }
  };

  const renderMosaicos = (data: any[], currentId: any, field: string, iconDefault: string) => (
    <View style={styles.mosaicoGrid}>
      {data.map((item: any) => (
        <Pressable
          key={item.value}
          onPress={() => {
            setForm((prev) => ({
              ...prev,
              [field]: item.value,
              id_zona: null,
            }));
          }}
          style={[styles.mosaicoItem, currentId === item.value && styles.mosaicoSelected]}
        >
          <Ionicons name={iconDefault as any} size={18} color={currentId === item.value ? "white" : MJM_BLUE} />
          <ThemedText style={[styles.mosaicoText, currentId === item.value && { color: "white" }]}>
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const dynamicStyles = {
    card: { backgroundColor: "white" },
    sectionTitle: { color: MJM_BLUE },
    dropdown: { backgroundColor: "white", color: "#000000" },
  };

  return (
      <ThemedView style={[styles.main, { paddingTop: insets.top, backgroundColor: isDark ? "#ffffff" : "#f4f7f6" }]}>
        <View style={styles.stepperContainer}>
          <ThemedText style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>INICIO DE SERVICIO:</ThemedText>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.circle, step >= i && { backgroundColor: MJM_BLUE }]}>
              <ThemedText style={{ color: "white", fontWeight: "bold", fontSize: 11 }}>{i}</ThemedText>
            </View>
          ))}
        </View>
  
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 1 && (
    <View style={[styles.card, dynamicStyles.card]}>
      <ThemedText style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
        PASO 1: DESPACHO
      </ThemedText>
  
      <View
        style={{
          backgroundColor: "#eef2ff",
          padding: 10,
          borderRadius: 8,
          marginBottom: 15,
          borderWidth: 1,
          borderColor: MJM_BLUE,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="location" size={14} color={MJM_BLUE} />
          <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
            ENVIAR REPORTE DESDE:
          </ThemedText>
        </View>
        <ThemedText style={{ fontSize: 11, color: "#000000", marginTop: 2 }}>
          {form.nombre_punto_gps || "CSI MDJM"}
        </ThemedText>
      </View>
  
      <View>
         <ThemedText style={styles.label}>¿A QUÉ TURNO PERTENECE ESTE REPORTE?</ThemedText>
          <ScrollView
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.label}
            >
              {renderMosaicos(
                [
                  { label: "MAÑANA", value: "M" },
                  { label: "TARDE", value: "T" },
                  { label: "NOCHE", value: "N" },
                ],
                form.turno, // Asegúrate de usar la propiedad correcta del estado, por ejemplo form.turno
                "turno",    // El nombre del campo que actualizará en tu formulario
                "time-outline", // Cambié el ícono opcionalmente a uno de reloj/tiempo
              )}
            </ScrollView>
        <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
          TIPO DE PATRULLAJE
        </ThemedText>
        {renderMosaicos(
          catalogos.tipos_patrullaje,
          form.id_tipo_patrullaje,
          "id_tipo_patrullaje",
          "shield-checkmark-outline"
        )}
      </View>
  
      {form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO && (
        <View
          style={[
            styles.cascadaContainer,
            getDynamicBorderStyle(form.vehiculos_detalle.length > 0),
          ]}
        >
          <View style={styles.cascadaHeader}>
            <Ionicons name="car-sport" size={16} color={MJM_BLUE} />
            <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
              ELEGIR UNIDADES
            </ThemedText>
          </View>
  
          <Dropdown
            style={[styles.dropdown, dynamicStyles.dropdown]}
            data={catalogos.tipos_vehiculo}
            labelField="label"
            valueField="value"
            placeholder="Tipo Vehículo"
            value={unidadForm.id_tipo_vehiculo}
            onChange={(v) => {
              setUnidadForm({
                ...unidadForm,
                id_tipo_vehiculo: v.value,
                id_unidad: null,
                placa: "",
              });
              fetchUnidades(v.value);
            }}
          />
  
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-end",
              marginTop: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Dropdown
                style={[styles.dropdown, dynamicStyles.dropdown]}
                data={catalogos.unidades}
                labelField="label"
                valueField="value"
                placeholder="Seleccione Placa"
                value={unidadForm.id_unidad}
                onChange={(v) =>
                  setUnidadForm({
                    ...unidadForm,
                    id_unidad: v.value,
                    placa: v.label,
                  })
                }
              />
            </View>
            <Pressable
              style={[
                styles.btnAddUnit,
                { backgroundColor: MJM_BLUE },
                (!unidadForm.id_unidad || !unidadForm.id_tipo_vehiculo) && { opacity: 0.4 },
              ]}
              disabled={!unidadForm.id_unidad || !unidadForm.id_tipo_vehiculo}
              onPress={() => {
                if (!unidadForm.id_unidad || !unidadForm.id_tipo_vehiculo) return;
  
                abrirChecklist({
                  ...unidadForm,
                  id_unidad: unidadForm.id_unidad,
                  id_tipo_vehiculo: unidadForm.id_tipo_vehiculo,
                } as Unidad);
              }}
            >
              <Ionicons name="checkbox" size={24} color="white" />
            </Pressable>
          </View>
  
          {form.vehiculos_detalle.length > 0 && (
            <View style={styles.listadoUnidadesContainer}>
              <View style={styles.listadoHeader}>
                <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
                  UNIDADES ASIGNADAS ({form.vehiculos_detalle.length})
                </ThemedText>
              </View>
              {form.vehiculos_detalle.map((v, index) => (
                <View key={index} style={[styles.unitCard, { backgroundColor: "#fff" }]}>
                  <View style={styles.unitCardIcon}>
                    <Ionicons
                      name={v.id_tipo_vehiculo === ID_CAMIONETA ? "car" : "bicycle"}
                      size={20}
                      color={MJM_BLUE}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <ThemedText style={styles.unitCardPlaca}>
                      {v.placa} {v.odometro_inicial ? `(KM: ${v.odometro_inicial})` : ""}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => {
                      const nuevos = form.vehiculos_detalle.filter((_, i) => i !== index);
                      setForm({ ...form, vehiculos_detalle: nuevos });
                      setUnidadForm({
                        id_tipo_vehiculo: null,
                        id_unidad: null,
                        placa: "",
                        tipo_asignacion: "MUNICIPAL",
                        id_pnp: null,
                      });
                    }}
                    style={styles.unitCardRemove}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ff4444" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  )}
  
        {step === 2 && (
    <View style={[styles.card, dynamicStyles.card]}>
      <ThemedText style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
        PASO 2: TEMPORALIDAD
      </ThemedText>
  
      {/* Formulario en columna (uno debajo de otro) */}
      <View style={{ gap: 15, marginBottom: 15 }}>
        {/* Campo Fecha */}
        <View>
          <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold", marginBottom: 5 }}>
            FECHA
          </ThemedText>
          <View style={[styles.pickerPressable, { backgroundColor: "#F0F0F0", borderColor: "#CCC", borderWidth: 1 }]}>
            <ThemedText style={{ color: "#555" }}>
              {formatearFechaEspañol(getHoy())}
            </ThemedText>
          </View>
        </View>
  
        {/* Campo Hora de Registro y Botón de Captura */}
        <View>
          <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold", marginBottom: 5 }}>
            HORA REGISTRO
          </ThemedText>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <View style={[{ flex: 1 }, styles.pickerPressable, { backgroundColor: "#F0F0F0", borderColor: "#CCC", borderWidth: 1 }]}>
              <ThemedText style={{ color: form.hora_alerta ? "#000" : "#888" }}>
                {form.hora_alerta || "00:00"}
              </ThemedText>
            </View>
  
            {!form.hora_alerta && (
              <Pressable
                style={[styles.btnTime, { paddingHorizontal: 15, height: 45, justifyContent: "center" }]}
                onPress={() => {
                  const now = new Date();
                  const timeString = now.toTimeString().slice(0, 5);
                  setForm((prev) => ({
                    ...prev,
                    hora_alerta: timeString,
                    hora_llegada: timeString,
                    hora_repliegue: timeString,
                  }));
                }}
              >
                <Ionicons name="flash" size={20} color="white" />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  )}
  
     {step === 3 && (
    <View style={[styles.card, dynamicStyles.card]}>
      <ThemedText style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
        PASO 3: DETALLES FINALIZACIÓN
      </ThemedText>
  
      {/* Sección Radio */}
      <View style={{ marginTop: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
            RADIO{" "}
            <ThemedText style={{ fontSize: 9, fontWeight: "normal", color: "#666" }}>
              (O elija "No corresponde")
            </ThemedText>
          </ThemedText>
  
          {/* Botón para seleccionar rápidamente el ID 110 */}
          <Pressable
            style={{
              backgroundColor: form.id_radio === 110 ? MJM_BLUE : "#e2e8f0",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
            }}
            onPress={() => setForm({ ...form, id_radio: 110 })}
          >
            <ThemedText
              style={{
                fontSize: 9,
                fontWeight: "bold",
                color: form.id_radio === 110 ? "white" : "#475569",
              }}
            >
              {form.id_radio === 110 ? "✓ No corresponde" : "+ No corresponde"}
            </ThemedText>
          </Pressable>
        </View>
  
        <Dropdown
          style={[styles.dropdown, dynamicStyles.dropdown]}
          data={catalogos.radios}
          search
          labelField="label"
          valueField="value"
          placeholder="Seleccione Radio"
          value={form.id_radio}
          onChange={(v) => setForm({ ...form, id_radio: v.value })}
          flatListProps={{
            nestedScrollEnabled: true, // Evita que la lista salte al inicio al hacer scroll
          }}
        />
      </View>
  
      {/* Sección Zona de Responsabilidad */}
      <View style={{ marginTop: 15 }}>
        <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold", marginBottom: 5 }}>
          ZONA DE RESPONSABILIDAD
        </ThemedText>
        <Dropdown
          style={[styles.dropdown, dynamicStyles.dropdown]}
          data={zonasFiltradas}
          search
          labelField="label"
          valueField="value"
          placeholder="Seleccione Zona"
          value={form.id_zona}
          onChange={(v) => setForm({ ...form, id_zona: v.value })}
          flatListProps={{
            nestedScrollEnabled: true,
          }}
        />
      </View>
  
      {/* Sección Evidencia Fotográfica */}
      <View style={{ marginTop: 15 }}>
        <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
          EVIDENCIA FOTOGRÁFICA{" "}
          <ThemedText
            style={{
              fontSize: 9,
              fontWeight: "normal",
              color: form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO ? "#d9534f" : "#666",
            }}
          >
            {form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO
              ? "(Obligatorio: Foto del panel)"
              : "(Opcional)"}
          </ThemedText>
        </ThemedText>
  
        <View style={[styles.photoActions, { marginTop: 5 }]}>
          <Pressable style={styles.btnCamAction} onPress={tomarFoto}>
            <Ionicons name="camera" size={20} color="white" />
          </Pressable>
          <Pressable style={[styles.btnCamAction, { backgroundColor: "#666" }]} onPress={seleccionarGaleria}>
            <Ionicons name="images" size={20} color="white" />
          </Pressable>
        </View>
  
        <ScrollView horizontal style={{ marginTop: 10 }} showsHorizontalScrollIndicator={false}>
          {fotos.map((f, i) => (
            <View key={i} style={styles.wrapperFoto}>
              <Image source={{ uri: f.uri }} style={styles.previewFoto} />
              <Pressable
                style={styles.btnBorrarFoto}
                onPress={() => setFotos((p) => p.filter((_, idx) => idx !== i))}
              >
                <Ionicons name="close-circle" size={20} color="red" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  )}
          <View style={styles.navRow}>
            {step > 1 && (
              <Pressable style={styles.btnBack} onPress={() => setStep(step - 1)}>
                <ThemedText style={{ color: MJM_BLUE, fontWeight: "bold" }}>Atrás</ThemedText>
              </Pressable>
            )}
  
            {step < 3 ? (
              <Pressable
                style={[styles.btnNext, !canAdvance() && styles.btnDisabled]}
                disabled={!canAdvance()}
                onPress={() => setStep(step + 1)}
              >
                <ThemedText style={{ color: "white", fontWeight: "bold" }}>Siguiente</ThemedText>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.btnNext, { backgroundColor: "#28a745" }, !canAdvance() && styles.btnDisabled]}
                disabled={!canAdvance() || loading}
                onPress={enviarRegistro}
              >
                <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                  {loading ? "Subiendo..." : "Finalizar"}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ScrollView>
  
        {/* MODAL CHECKLIST */}
        <Modal animationType="slide" transparent visible={modalChecklistVisible} onRequestClose={() => setModalChecklistVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { width: "94%", maxHeight: "90%", padding: 0 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#eee" }}>
                <View>
                  <ThemedText style={{ fontSize: 18, fontWeight: "bold", color: MJM_BLUE }}>📋 CHECKLIST OPERATIVO</ThemedText>
                  <ThemedText style={{ fontSize: 12, color: "#666" }}>UNIDAD: {unidadTemporal?.placa}</ThemedText>
                </View>
                <Pressable onPress={() => setModalChecklistVisible(false)} style={{ padding: 8, backgroundColor: "#f0f0f0", borderRadius: 20 }}>
                  <Ionicons name="close" size={20} color="#333" />
                </Pressable>
              </View>
  
              <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                <View style={{ marginBottom: 25 }}>
                  <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>ODÓMETRO INICIAL</ThemedText>
                  <TextInput
                    style={[styles.modalInputText, { backgroundColor: "#f8fafc", fontSize: 16 }]}
                    placeholder="Ingrese kilometraje..."
                    keyboardType="numeric"
                    value={odometroInicial}
                    onChangeText={(text) => setOdometroInicial(text.replace(/[^0-9]/g, ""))}
                  />
                </View>
  
                {Object.entries(
                  (checklistItems || []).reduce((acc: Record<string, any[]>, item: any) => {
                    const cat = item.nombre_categoria || "GENERAL";
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                  }, {})
                ).map(([categoria, items]) => (
                  <View key={categoria} style={{ marginBottom: 20 }}>
                    <ThemedText style={{ fontSize: 12, fontWeight: "800", color: MJM_BLUE, marginBottom: 10, backgroundColor: "#eef2ff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 }}>
                      {categoria.toUpperCase()}
                    </ThemedText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                      {items.map((item: any) => {
                        const resp = checklistRespuestas[item.id_item] || { conforme: true, obs: "" };
                        return (
                          <View key={item.id_item} style={{ width: "48%", marginBottom: 15 }}>
                            <Pressable
                              style={{
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: resp.conforme ? "#fff" : "#fff5f5",
                                padding: 10,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: resp.conforme ? "#e2e8f0" : "#feb2b2",
                                minHeight: 85,
                              }}
                              onPress={() =>
                                setChecklistRespuestas((prev) => ({
                                  ...prev,
                                  [item.id_item]: {
                                    conforme: !(prev[item.id_item]?.conforme ?? true),
                                    obs: !(prev[item.id_item]?.conforme ?? true) ? "" : prev[item.id_item]?.obs || "",
                                  },
                                }))
                              }
                            >
                              <Ionicons name={resp.conforme ? "checkmark-circle" : "alert-circle"} size={28} color={resp.conforme ? "#22c55e" : "#ef4444"} />
                              <ThemedText style={{ fontSize: 11, textAlign: "center", marginTop: 6, color: resp.conforme ? "#334155" : "#c53030" }}>
                                {item.nombre_item}
                              </ThemedText>
                            </Pressable>
                            {!resp.conforme && (
                              <TextInput
                                style={{ marginTop: 5, backgroundColor: "#fff", borderWidth: 1, borderColor: "#feb2b2", padding: 8, borderRadius: 8, fontSize: 10 }}
                                placeholder="Falla..."
                                value={resp.obs}
                                onChangeText={(text) =>
                                  setChecklistRespuestas((prev) => ({
                                    ...prev,
                                    [item.id_item]: { conforme: false, obs: text },
                                  }))
                                }
                              />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>
  
              <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: "#eee" }}>
                <Pressable style={{ backgroundColor: MJM_BLUE, paddingVertical: 15, borderRadius: 12, alignItems: "center" }} onPress={confirmarChecklistUnidad}>
                  <ThemedText style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>GUARDAR CHECKLIST</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
  
        {/* MODAL PROGRESO */}
        <Modal transparent visible={loading && uploadProgress > 0} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.progressTitle}>{uploadStatus}</ThemedText>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
              </View>
              <ThemedText style={styles.progressPercentage}>{uploadProgress}%</ThemedText>
            </View>
          </View>
        </Modal>
      </ThemedView>
    );
}



const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: "#FFFFFF", // Blanco total para combatir el oscurecimiento
  },

  filaMosaicos: {
    flexDirection: "row", // Fuerza la alineación horizontal
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  // Asegúrate de que el estilo del mosaico individual NO tenga width: '100%'
  // Lo ideal es un ancho fijo para que quepan varios en la fila
  mosaicoIndividual: {
    width: 100,
    marginHorizontal: 5,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  scroll: { paddingHorizontal: 15, paddingBottom: 100 },

  // Cambié todos los fondos sutiles por blanco sólido o gris muy brillante
  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 15,
    elevation: 0, // Quitamos elevación si se ve "sucio"
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  cascadaContainer: {
    marginTop: 15,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F9FBFF", // Fondo casi blanco para contraste suave [cite: 377]
    borderWidth: 1,
    borderColor: "#E1E8F5",
  },
  unitCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },

  unitCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F5FF", // Azul muy claro pero sólido
    justifyContent: "center",
    alignItems: "center",
  },

  asignacionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: MJM_BLUE,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  listadoUnidadesContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 15,
  },

  asignacionContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "space-between",
  },

  asignacionText: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    color: MJM_BLUE,
  },

  listadoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  listadoTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#888",
    letterSpacing: 1,
  },

  labelSmall: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 10,
    color: "#666",
  },

  disabledInput: {
    backgroundColor: "#f8f9fa",
    color: "#aaa",
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },

  unitCardPlaca: {
    fontSize: 14,
    fontWeight: "bold",
    color: MJM_BLUE,
  },

  unitCardSub: {
    fontSize: 11,
    color: "#666",
  },

  unitCardRemove: {
    padding: 8,
  },

  stepperContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 12,
    gap: 12,
  },

  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: MJM_BLUE,
    marginBottom: 15,
    textAlign: "center",
  },

  label: { fontSize: 11, fontWeight: "bold", marginTop: 15, color: "#444" },

  timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  btnTime: { backgroundColor: MJM_BLUE, padding: 10, borderRadius: 10 },

  timeText: { fontSize: 16, color: MJM_BLUE, fontWeight: "bold" },

  pickerPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#f4f4f4",
    borderRadius: 10,
    marginTop: 5,
    borderWidth: 1,
  },

  dropdown: {
    height: 40,
    borderBottomWidth: 1.5,
    borderBottomColor: "#eee",
    marginTop: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },

  textArea: {
    borderWidth: 1.5,
    borderColor: "#eee",
    height: 100,
    marginTop: 15,
    padding: 12,
    borderRadius: 10,
    textAlignVertical: "top",
    backgroundColor: "white",
  },

  textAreaSmall: {
    borderWidth: 1.5,
    borderColor: "#eee",
    height: 60,
    marginTop: 15,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "white",
  },

  photoActions: { flexDirection: "row", gap: 10, marginTop: 20 },

  btnCamAction: {
    flex: 1,
    backgroundColor: "#444",
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  btnCamText: { color: "white", fontSize: 12, fontWeight: "bold" },

  photoCounter: {
    fontSize: 10,
    color: "#888",
    marginTop: 8,
    textAlign: "right",
  },

  photoCarousel: { marginTop: 15 },

  selectedUnitsContainer: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },

  selectedUnitsTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
  },

  chipsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  unitChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MJM_BLUE,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginBottom: 5,
  },

  unitChipText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },

  photoWrapper: { marginRight: 15, position: "relative" },

  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  removePhoto: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "white",
    borderRadius: 12,
  },

  btnSave: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
    width: "100%",
  },

  navContainer: {
    flexDirection: "row",
    padding: 15,
    gap: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
bloqueCompacto: {
    width: "32%",          // Cada uno ocupa casi un tercio para que los tres sumen el 100%
    backgroundColor: "#fff",
    paddingVertical: 8,    
    paddingHorizontal: 4,  
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#f0f0f0",
  },
  navBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#eee",
  },

  cascadaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },

  cascadaTitle: { fontSize: 11, fontWeight: "bold", color: MJM_BLUE },

  btnAddUnit: { backgroundColor: MJM_BLUE, padding: 10, borderRadius: 10 },


mosaicoGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 12,           // Espacio uniforme entre filas y columnas
  marginTop: 10,
  justifyContent: "flex-start", // Alineados a la izquierda para que el de 3 elementos no se spitee raro
},
mosaicoItem: {
  width: "48%",      // <-- LA CLAVE: 48% fuerza a que entren exactamente 2 por fila (2 x 48% + gap = 100%)
  backgroundColor: "#fff",
  paddingVertical: 14,
  paddingHorizontal: 8,
  borderRadius: 12,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1.5,
  borderColor: "#e5e7eb",
  
  // Sombra opcional
  elevation: 2,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 2,
},
  mosaicoSelected: { backgroundColor: MJM_BLUE, borderColor: MJM_BLUE },

  mosaicoText: {
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 6,
    color: MJM_BLUE,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    backgroundColor: "#FFFFFF", // Blanco forzado [cite: 334]
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    width: "85%",
    // Sombras para resaltar sobre el fondo oscuro del celular
    elevation: 10, // Sombra en Android
    shadowColor: "#000", // Sombra en iOS
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: MJM_BLUE,
  },
  progressBarBackground: {
    width: "100%",
    height: 10,
    backgroundColor: "#eee",
    borderRadius: 5,
    overflow: "hidden",
  },

  progressBarFill: { height: "100%", backgroundColor: MJM_BLUE },

  progressPercentage: {
    marginTop: 10,
    fontSize: 12,
    color: "#666",
    fontWeight: "bold",
  },
  dropdownContainer: {
    borderRadius: 12,
    marginTop: 5,
    elevation: 5,
    backgroundColor: "white",
  },

  inputSearchStyle: {
    height: 40,
    fontSize: 16,
    borderRadius: 8,
    color: "black",
  },

  modalPickerContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "85%",
    alignItems: "center",
  },

  pickerTitle: { fontWeight: "bold", marginBottom: 15, color: MJM_BLUE },

  btnConfirmIOS: {
    backgroundColor: MJM_BLUE,
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    width: "100%",
    alignItems: "center",
  },

wrapperFoto: { marginRight: 10, position: "relative" },
  previewFoto: { width: 70, height: 70, borderRadius: 8 },
  btnBorrarFoto: { position: "absolute", top: -5, right: -5 },
  navRow: { flexDirection: "row", justifyContent: "space-between", gap: 15, marginTop: 15 },
  btnBack: { flex: 1, height: 48, borderRadius: 8, borderWidth: 1.5, borderColor: MJM_BLUE, justifyContent: "center", alignItems: "center" },
  btnNext: { flex: 1, height: 48, backgroundColor: MJM_BLUE, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  btnDisabled: { opacity: 0.4 },
   modalInputText: { width: "100%", borderColor: "#CBD5E1", borderWidth: 1, borderRadius: 10, padding: 12, color: "#333" },

});