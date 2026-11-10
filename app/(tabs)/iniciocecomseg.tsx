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

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";

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
  [ID_CAMIONETA]: [1, 2, 3, 4, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  [ID_MOTOCICLETA]: [5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
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

export default function RegistroSerIn() {
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
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 1. ESTADO FORM PRINCIPAL (Declarado antes de usarse en validaciones)
  const [form, setForm] = useState({
    id_usuario: null as number | null,
    id_lugar: "604",
    id_modalidad: "139",
    id_origen: "9",
    id_tipo_patrullaje: null as number | null,
    id_modalidad_patrullaje: "2",
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

  // 2. VALIDACIONES DECLARADAS DESPUÉS DE 'form'
  const validation: Record<string, boolean> = {
    step1: !!form.grupo,
    step2: (() => {
      const { hora_alerta, hora_llegada, hora_repliegue } = form;
      if (!hora_alerta || !hora_llegada || !hora_repliegue) return false;

      const toMin = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      const tA = toMin(hora_alerta);
      let tL = toMin(hora_llegada);
      let tR = toMin(hora_repliegue);

      if (tL < tA) tL += 1440;
      if (tR < tA) tR += 1440;
      if (tR < tL) tR += 1440;

      const ordenValido = tA <= tL && tL <= tR;
      const diffAlertaLlegada = tL - tA;
      const diffLlegadaRepliegue = tR - tL;
      const duracionTotal = tR - tA;

      const tramo1Valido = diffAlertaLlegada >= 0 && diffAlertaLlegada <= 720;
      const tramo2Valido = diffLlegadaRepliegue >= 0 && diffLlegadaRepliegue <= 720;
      const totalValido = duracionTotal >= 0 && duracionTotal <= 720;

      const hayError = !(ordenValido && tramo1Valido && tramo2Valido && totalValido);
      return !hayError;
    })(),
    step3: !!form.id_lugar,
    step4: !!form.id_modalidad && form.descripcion?.length > 2,
  };

  const formCompleto =
    validation.step1 &&
    validation.step2 &&
    validation.step3 &&
    validation.step4;

  const limpiarFormulario = () => {
    setStep(1);
    fotos.forEach((f) => liberarUriPreview(f.uri));
    setFotos([]);
    setUnidadForm({
      id_tipo_vehiculo: null,
      id_unidad: null,
      placa: "",
      tipo_asignacion: "MUNICIPAL",
      id_pnp: null,
    });
    setForm({
      id_usuario: userData?.id || (userData as any)?.id_usuario || null,
      id_lugar: "604",
      id_modalidad: "139",
      id_origen: "9",
      id_tipo_patrullaje: null,
      id_modalidad_patrullaje: "2",
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
    obtenerGpsAutomatico();
  };

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
    if (form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO) {
      const primerVehiculo = form.vehiculos_detalle[0];
      const idTipoVehiculo = primerVehiculo?.id_tipo_vehiculo || unidadForm.id_tipo_vehiculo;
      if (idTipoVehiculo) {
        const zonasPermitidasVehiculo = ZONAS_POR_VEHICULO[idTipoVehiculo];
        if (zonasPermitidasVehiculo) {
          return zonasPermitidasVehiculo.includes(zona.value);
        }
      }
    }
    const zonasPermitidasPatrullaje = ZONAS_POR_PATRULLAJE[form.id_tipo_patrullaje as number];
    if (zonasPermitidasPatrullaje) {
      return zonasPermitidasPatrullaje.includes(zona.value);
    }
    return true;
  });

  const cargarCatalogosInit = async () => {
    try {
      const [resGral, resTiposV, resPnps, resRadios, resZonas] = await Promise.all([
        fetch(`${API_URL}/catalogos/completo/unificadov?tipoLugar=2&idTipoP=7`),
        fetch(`${API_URL}/catalogos/tipos-vehiculo`),
        fetch(`${API_URL}/catalogos/pnp-activos`),
        fetch(`${API_URL}/catalogos/radios`),
        fetch(`${API_URL}/catalogos/zonas`),
      ]);

      const dataGral = await resGral.json();
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

  const formatearHora24h = (horaStr: string) => {
    if (!horaStr) return "00:00";
    if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(horaStr)) {
      return horaStr;
    }
    return "00:00";
  };

  const tomarFoto = async () => {
    if (fotos.length >= MAX_FOTOS)
      return Alert.alert("Límite", `Máximo ${MAX_FOTOS} fotos.`);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted")
      return Alert.alert("Error", "Sin permiso de cámara");

    let res = await ImagePicker.launchCameraAsync({ quality: 1 });

    if (!res.canceled && res.assets[0]) {
      let uriPreview = "";
      try {
        const originalAsset = res.assets[0];
        const fotoProcesada = await comprimirImagen(
          Platform.OS === "web" ? (originalAsset.file as File) : originalAsset.uri
        );

        uriPreview =
          typeof fotoProcesada === "string"
            ? fotoProcesada
            : URL.createObjectURL(fotoProcesada as Blob);

        setFotos((p) => [...p, { uri: uriPreview, url_remota: null, uploading: true }]);

        const urlRemota = await subirFotoAlServidor(
          fotoProcesada,
          API_URL,
          form.id_modalidad,
          form.fecha_evento
        );

        setFotos((prev) =>
          prev.map((f) =>
            f.uri === uriPreview
              ? { ...f, url_remota: urlRemota, uploading: false }
              : f
          )
        );
      } catch (error) {
        console.error("Error al procesar/subir foto tomada:", error);
        if (uriPreview) liberarUriPreview(uriPreview);
        setFotos((prev) => prev.filter((f) => f.uri !== uriPreview));
        Alert.alert("Error", "No se pudo procesar o subir la foto. Intente nuevamente.");
      }
    }
  };

  const seleccionarGaleria = async () => {
    const espacioDisponible = MAX_FOTOS - fotos.length;
    if (espacioDisponible <= 0)
      return Alert.alert("Límite", `Máximo ${MAX_FOTOS} fotos.`);

    let res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: espacioDisponible,
    });

    if (!res.canceled && res.assets.length > 0) {
      const assetsAProcesar = res.assets.slice(0, espacioDisponible);
      const LOTE_MAXIMO = 2;

      for (let i = 0; i < assetsAProcesar.length; i += LOTE_MAXIMO) {
        const lote = assetsAProcesar.slice(i, i + LOTE_MAXIMO);

        await Promise.all(
          lote.map(async (asset) => {
            let uriPreview = "";
            try {
              const fotoProcesada = await comprimirImagen(
                Platform.OS === "web" ? (asset.file as File) : asset.uri
              );

              uriPreview =
                typeof fotoProcesada === "string"
                  ? fotoProcesada
                  : URL.createObjectURL(fotoProcesada as Blob);

              setFotos((p) => [...p, { uri: uriPreview, url_remota: null, uploading: true }]);

              const urlRemota = await subirFotoAlServidor(
                fotoProcesada,
                API_URL,
                form.id_modalidad,
                form.fecha_evento
              );

              setFotos((prev) =>
                prev.map((f) =>
                  f.uri === uriPreview
                    ? { ...f, url_remota: urlRemota, uploading: false }
                    : f
                )
              );
            } catch (err) {
              console.error("Error al subir foto de galería:", err);
              if (uriPreview) {
                liberarUriPreview(uriPreview);
                setFotos((prev) => prev.filter((f) => f.uri !== uriPreview));
              }
              Alert.alert("Aviso", "Una de las imágenes seleccionadas no pudo subirse.");
            }
          })
        );
      }
    }
  };

  const enviarRegistro = async () => {
    const idFinal = form.id_usuario || userData?.id || (userData as any)?.id_usuario;
    if (!idFinal) {
      return Alert.alert("Atención", "No se pudo identificar al usuario.");
    }

    const fotosPendientes = fotos.some((f) => f.uploading);
    if (fotosPendientes) {
      return Alert.alert("Espere", "Las fotos aún se están subiendo a la nube.");
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus("Subiendo...");
    setIsFinished(false);

    const interval = setInterval(() => setUploadProgress((p) => (p < 90 ? p + 10 : p)), 150);
    try {
      const urlsFotosFinales = fotos
        .map((f) => f.url_remota)
        .filter((url): url is string => url !== null);

      const res = await fetch(`${API_URL}/api/vehiculo/iniciar-servicio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          turno: form.turno,
          id_usuario: Number(idFinal),
          id_tipop: form.id_tipo_patrullaje,
          id_modalidadp: form.id_modalidad_patrullaje,
          id_camara: form.id_camara.map((c) => (c as any).value).join(","),
          fotos: urlsFotosFinales,
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
          limpiarFormulario();
          router.replace("/principal" as any);
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
    <ThemedView style={styles.mainContainer}>
      <Modal animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Cabecera del Modal */}
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>FIN SERVICIO</ThemedText>
              <Pressable>
                <Ionicons name="close-circle" size={30} color="#666" />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollForm}>
              <View style={styles.newStepperContainer}>
                {[1, 2, 3, 4].map((i) => {
                  const estaListo = validation[`step${i}`];
                  return (
                    <View key={i} style={styles.stepWrapper}>
                      <View style={[styles.circleMain, estaListo ? styles.circleComplete : styles.circlePending]}>
                        <ThemedText style={[styles.stepNumber, { color: estaListo ? "white" : "#024885" }]}>
                          {i}
                        </ThemedText>
                      </View>
                      {i < 4 && (
                        <View style={[styles.connectorLine, estaListo && { backgroundColor: "#024885" }]} />
                      )}
                    </View>
                  );
                })}
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollWeb} horizontal={false}>
                <View style={styles.webGridContainer}>
                  
                  {/* COLUMNA 1: DESPACHO */}
                  <View style={styles.webColumn}>
                    <View style={styles.headerStepWeb}>
                      <Ionicons name="megaphone" size={18} color="white" />
                      <ThemedText style={styles.headerStepText}>1. DESPACHO Y PERSONAL</ThemedText>
                    </View>
                    <View style={[styles.card, dynamicStyles.card]}>
                      <View style={styles.columnBody}>
                        <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
                          GRUPO:
                        </ThemedText>
                        <View style={{ marginBottom: 15 }}>
                          <ScrollView showsHorizontalScrollIndicator={false} contentContainerStyle={styles.label}>
                            {renderMosaicos(
                              [
                                { label: "GRUPO 1", value: "1" },
                                { label: "GRUPO 2", value: "2" },
                                { label: "GRUPO 3", value: "3" },
                                { label: "GRUPO 4", value: "4" },
                              ],
                              form.grupo,
                              "grupo",
                              "people-outline"
                            )}
                          </ScrollView>
                        </View>

                        <View style={{ height: 10 }} />

                        <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
                          ¿A QUÉ TURNO PERTENECE ESTE REPORTE?
                        </ThemedText>
                        <View style={{ marginBottom: 15 }}>
                          <ScrollView showsHorizontalScrollIndicator={false} contentContainerStyle={styles.label}>
                            {renderMosaicos(
                              [
                                { label: "MAÑANA", value: "M" },
                                { label: "TARDE", value: "T" },
                                { label: "NOCHE", value: "N" },
                              ],
                              form.turno,
                              "turno",
                              "time-outline"
                            )}
                          </ScrollView>
                        </View>

                        <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold", marginBottom: 5 }}>
                          TIPO DE PATRULLAJE
                        </ThemedText>
                        {renderMosaicos(
                          catalogos.tipos_patrullaje,
                          form.id_tipo_patrullaje,
                          "id_tipo_patrullaje",
                          "shield-checkmark-outline"
                        )}
                      </View>
                    </View>
                  </View>

                  {/* COLUMNA 2: TEMPORALIDAD */}
                  <View style={styles.webColumn}>
                    <View style={styles.headerStepWeb}>
                      <Ionicons name="time" size={18} color="white" />
                      <ThemedText style={styles.headerStepText}>2. TEMPORALIDAD</ThemedText>
                    </View>
                    <View style={styles.columnBody}>
                      <View style={styles.cascadaContainer}>
                        
                        {/* Campo Fecha */}
                        <View style={{ marginBottom: 15 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                            <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
                              FECHA:
                            </ThemedText>
                            <Pressable
                              onPress={() => setForm({ ...form, fecha_evento: getHoy() })}
                              style={{ backgroundColor: MJM_BLUE, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                            >
                              <ThemedText style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>
                                PONER HOY
                              </ThemedText>
                            </Pressable>
                          </View>

                          {Platform.OS === "web" ? (
                            <View style={{ width: "100%" }}>
                              <input
                                type="date"
                                value={form.fecha_evento}
                                max={getHoy()}
                                onChange={(e) => {
                                  const fechaSeleccionada = e.target.value;
                                  const hoyStr = getHoy();
                                  if (fechaSeleccionada > hoyStr) {
                                    Alert.alert("Atención", "No se pueden registrar ocurrencias con fechas futuras.");
                                    setForm({ ...form, fecha_evento: hoyStr });
                                  } else {
                                    setForm({ ...form, fecha_evento: fechaSeleccionada });
                                  }
                                }}
                                style={{
                                  height: 45,
                                  width: "100%",
                                  borderWidth: 1,
                                  borderColor: "#ccc",
                                  borderRadius: 8,
                                  fontSize: 16,
                                  backgroundColor: "#FFFFFF",
                                  color: "#000000",
                                  borderStyle: "solid",
                                }}
                              />
                            </View>
                          ) : (
                            <Pressable
                              onPress={() => {
                                setPickerMode("date");
                                setActiveField("fecha_evento");
                                setTempDate(new Date(form.fecha_evento + "T12:00:00"));
                                setShowPicker(true);
                              }}
                              style={[styles.inputShared, styles.pickerPressable, { borderColor: MJM_BLUE, backgroundColor: "#FFF" }, getDynamicBorderStyle(form.fecha_evento)]}
                            >
                              <Ionicons name="calendar-outline" size={20} color={MJM_BLUE} />
                              <ThemedText style={{ color: "#000", marginLeft: 10, flex: 1 }}>
                                {formatearFechaEspañol(form.fecha_evento)}
                              </ThemedText>
                              <Ionicons name="chevron-down" size={18} color="#ccc" />
                            </Pressable>
                          )}
                        </View>

                        {/* Campo Hora de Registro (Actualiza alerta, llegada y repliegue simultáneamente) */}
                        <View style={{ marginBottom: 15 }}>
                          <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold", marginBottom: 5 }}>
                            HORA REGISTRO
                          </ThemedText>

                          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                            {Platform.OS === "web" ? (
                              <View style={{ flex: 1 }}>
                                <input
                                  type="time"
                                  value={form.hora_alerta}
                                  onChange={(e) => {
                                    const nuevaHora = e.target.value;
                                    setForm((prev) => ({
                                      ...prev,
                                      hora_alerta: nuevaHora,
                                      hora_llegada: nuevaHora,
                                      hora_repliegue: nuevaHora,
                                    }));
                                  }}
                                  style={{
                                    width: "100%",
                                    height: 45,
                                    borderWidth: 1,
                                    borderColor: "#ccc",
                                    borderRadius: 8,
                                    backgroundColor: "#FFFFFF",
                                  }}
                                />
                              </View>
                            ) : (
                              <Pressable
                                onPress={() => {
                                  setPickerMode("time");
                                  setActiveField("hora_alerta");
                                  const currentTime = form.hora_alerta;
                                  const date = new Date();
                                  if (currentTime && currentTime !== "00:00") {
                                    const [hours, minutes] = currentTime.split(":");
                                    date.setHours(parseInt(hours), parseInt(minutes));
                                  }
                                  setTempDate(date);
                                  setShowPicker(true);
                                }}
                                style={[styles.pickerPressable, { flex: 1, backgroundColor: "#FFF", height: 45 }]}
                              >
                                <Ionicons name="time-outline" size={20} color={MJM_BLUE} />
                                <ThemedText style={{ color: form.hora_alerta ? "#000" : "#888", marginLeft: 10, flex: 1 }}>
                                  {formatearHora24h(form.hora_alerta) || "00:00"}
                                </ThemedText>
                                <Ionicons name="chevron-down" size={18} color="#ccc" />
                              </Pressable>
                            )}

                            {/* Botón Flash: guarda la hora actual en los 3 campos a la vez */}
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
                          </View>
                        </View>

                      </View>
                    </View>
                  </View>

                  {/* COLUMNA 3: UBICACIÓN */}
                  <View style={styles.webColumn}>
                    <View style={styles.headerStepWeb}>
                      <Ionicons name="location-sharp" size={18} color="white" />
                      <ThemedText style={styles.headerStepText}>3. UBICACIÓN</ThemedText>
                    </View>
                    <View style={styles.columnBody}>
                      <View style={styles.cascadaContainer}>
                        <View>
                          <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
                            REFERENCIA / INTERSECCIÓN:
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.textAreaSmall,
                              {
                                minHeight: 85,
                                textAlignVertical: "top",
                                color: "#000",
                                backgroundColor: "#FFF",
                                padding: 12,
                                fontSize: 14,
                                borderWidth: 1.5,
                                borderColor: form.referencia.length >= 3 ? MJM_BLUE : "#DDD",
                                borderRadius: 10,
                              },
                            ]}
                                      placeholder="Ej: Escriba una referencia cercana o indique el númeral exacto si lo conoce."
                            placeholderTextColor="#AAA"
                            value={form.referencia}
                            onChangeText={(t) => {
                              const capitalizedText = t.charAt(0).toUpperCase() + t.slice(1);
                              setForm({ ...form, referencia: capitalizedText });
                            }}
                            autoCapitalize="sentences"
                            multiline
                          />
                        </View>

                        {/* Sección Radio */}
                        <View style={{ marginTop: 10 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                            <ThemedText style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}>
                              RADIO <ThemedText style={{ fontSize: 9, fontWeight: "normal", color: "#666" }}>(O elija "No corresponde")</ThemedText>
                            </ThemedText>
                            <Pressable
                              style={{ backgroundColor: form.id_radio === 110 ? MJM_BLUE : "#e2e8f0", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                              onPress={() => setForm({ ...form, id_radio: 110 })}
                            >
                              <ThemedText style={{ fontSize: 9, fontWeight: "bold", color: form.id_radio === 110 ? "white" : "#475569" }}>
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
                            flatListProps={{ nestedScrollEnabled: true }}
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
                            flatListProps={{ nestedScrollEnabled: true }}
                          />
                        </View>

                      </View>
                    </View>
                  </View>

                  {/* COLUMNA 4: CIERRE Y EVIDENCIA */}
                  <View style={styles.webColumn}>
                    <View style={styles.headerStepWeb}>
                      <Ionicons name="checkmark-circle" size={18} color="white" />
                      <ThemedText style={styles.headerStepText}>4. ADJUNTAR EVIDENCIA (OPCIONAL)</ThemedText>
                    </View>
                    <View style={styles.columnBody}>
                      <View style={styles.cascadaContainer}>
                        <View style={[styles.photoActions, { marginTop: 5 }]}>
                          <Pressable
                            style={[styles.btnCamAction, { backgroundColor: "#024885" }]}
                            onPress={seleccionarGaleria}
                          >
                            <Ionicons name="images" size={20} color="white" />
                          </Pressable>
                        </View>

                        <ThemedText
                          style={[
                            styles.photoCounter,
                            { marginVertical: 5 },
                            fotos.length === MAX_FOTOS && { color: "red", fontWeight: "bold" },
                          ]}
                        >
                          {`${fotos.length} de ${MAX_FOTOS} fotos`}
                        </ThemedText>

                        {fotos.length > 0 && (
                          <ScrollView
                            keyboardShouldPersistTaps="handled"
                            horizontal
                            style={[styles.photoCarousel, { maxHeight: 100 }]}
                            showsHorizontalScrollIndicator={false}
                          >
                            {fotos.map((f, i) => (
                              <View key={i} style={styles.photoWrapper}>
                                <Image source={{ uri: f.uri }} style={styles.photoThumb} />
                                <Pressable
                                  style={styles.removePhoto}
                                  onPress={() => {
                                    const fotoAEliminar = fotos[i];
                                    liberarUriPreview(fotoAEliminar.uri);
                                    setFotos((prev) => prev.filter((_, idx) => idx !== i));
                                  }}
                                >
                                  <Ionicons name="close-circle" size={22} color="red" />
                                </Pressable>
                              </View>
                            ))}
                          </ScrollView>
                        )}

                        <Pressable
                          style={[
                            styles.btnSave,
                            {
                              marginTop: 15,
                              backgroundColor: formCompleto ? "#2E7D32" : "#A0A0A0",
                              opacity: formCompleto ? 1 : 0.6,
                            },
                          ]}
                          onPress={enviarRegistro}
                          disabled={!formCompleto || loading}
                        >
                          <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                            {loading ? "ENVIANDO..." : "ENVIAR"}
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                </View>
              </ScrollView>
            </ScrollView>
          </View>

          {loading && (
            <View style={styles.uploadOverlay}>
              <View style={styles.uploadCard}>
                <Ionicons
                  name={isFinished ? "checkmark-circle" : "cloud-upload"}
                  size={50}
                  color={isFinished ? "#024885" : "#024885"}
                />
                <ThemedText style={{ marginTop: 10, fontSize: 16, fontWeight: "bold", color: "#333" }}>
                  {uploadStatus}
                </ThemedText>
                <View style={styles.progressBarBackground}>
                  <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                </View>
                <ThemedText style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                  {uploadProgress}%
                </ThemedText>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  uploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  uploadCard: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 15,
    width: "80%",
    maxWidth: 320,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  progressBarBackground: {
    width: "100%",
    height: 8,
    backgroundColor: "#eee",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 15,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#024885",
  },
  mainContainer: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "flex-start", // 👈 Alinea el contenido desde la izquierda (dejando libre el sidebar)
    paddingLeft: "15%",       // 👈 Empuja el modal hacia la derecha para que respete el espacio de tu menú lateral (ajusta este porcentaje según el ancho de tu sidebar)
  },
  modalContent: {
    backgroundColor: "white",
    width: Platform.OS === "web" ? "92%" : "95%",
    maxHeight: "90%",
    borderRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "white",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: MJM_BLUE,
  },
  scrollForm: {
    padding: 20,
  },
  inputShared: {
    height: 50,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
  dropdown: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 8,
    marginTop: 5,
  },
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
  mosaicoGrid: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    width: "100%",
  },
  mosaicoItem: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#f0f0f0",
  },
  mosaicoSelected: {
    backgroundColor: MJM_BLUE,
    borderColor: MJM_BLUE,
  },
  mosaicoText: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 4,
    color: MJM_BLUE,
    textAlign: "center",
  },
  newStepperContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 5,
    backgroundColor: "#FFFFFF",
    marginTop: 2,
    marginBottom: 2,
  },
  stepWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  circleMain: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  circlePending: {
    backgroundColor: "white",
    borderColor: MJM_BLUE,
  },
  circleComplete: {
    backgroundColor: MJM_BLUE,
    borderColor: MJM_BLUE,
  },
  stepNumber: {
    fontWeight: "bold",
    fontSize: 15,
    textAlign: "center",
    includeFontPadding: false,
  },
  connectorLine: {
    width: 30,
    height: 2,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 4,
  },
  cascadaContainer: {
    marginTop: 15,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F9FBFF",
    borderWidth: 1,
    borderColor: "#E1E8F5",
  },
  btnTime: {
    backgroundColor: MJM_BLUE,
    padding: 10,
    borderRadius: 10,
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
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
  photoCounter: {
    fontSize: 10,
    color: "#888",
    marginTop: 8,
    textAlign: "right",
  },
  photoCarousel: {
    marginTop: 15,
  },
  photoWrapper: {
    marginRight: 15,
    position: "relative",
  },
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
  scrollWeb: {
    padding: 20,
  },
  webGridContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    alignItems: "flex-start",
  },
  webColumn: {
    flex: 1,
    minWidth: 280,
    padding: 15,
    marginHorizontal: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    overflow: "hidden",
  },
  headerStepWeb: {
    flexDirection: "row",
    backgroundColor: MJM_BLUE,
    padding: 12,
    alignItems: "center",
    gap: 10,
  },
  headerStepText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  columnBody: {
    padding: 15,
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 15,
    color: "#444",
  },
});