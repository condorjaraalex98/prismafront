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

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";
type FotoEstado = {
  uri: string;
  url_remota: string | null;
  uploading: boolean;
  base64?: string;
};
const MJM_BLUE = "#024885";
const ID_CAMIONETA = 1;
const ID_PATRULLAJE_MOTORIZADO = 3;
const MAX_FOTOS = 4;

export default function RegistroOcurrencia() {
  const [modoBusquedaManual, setModoBusquedaManual] = useState(false);
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

  const [tiposVia, setTiposVia] = useState([]);
  const [vias, setVias] = useState([]);
  const [cuadras, setCuadras] = useState([]);
  const [selTipoVia, setSelTipoVia] = useState<any>(null);
  const [selVia, setSelVia] = useState<any>(null);

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

  const [form, setForm] = useState({
    id_usuario: null,
    id_lugar: null,
    id_modalidad: "137",
    id_origen: "3",
    id_tipo_patrullaje: null,
    id_modalidad_patrullaje: "1",
    vehiculos_detalle: [] as any[],
    id_camara: [] as any[],
    descripcion: "",
    hora_alerta: "",
    hora_llegada: "",
    hora_repliegue: "",
    latitud_gps: "0",
    longitud_gps: "0",
    turno: null,
    nombre_punto_gps: "",
    estadoOcurrencia: "VERIFICADO",
    referencia: "",
    unidad_encargada: "SERENAZGO",
    fecha_evento: getHoy(),
    grupo: null,
    victimas: [] as any[],
    datos_importantes: {
      por_orden_central: false,
      control_fv_sv: false,
      inyectable: false,
      curacion_topica: false,
      traslado_urgencia: false,
      pertenece_muni: false,
    },
  });

  // --- LÓGICA DE VALIDACIÓN ---
  const canAdvance = () => {
    if (step === 1) {
      const hasBasics =
        !!form.id_tipo_patrullaje &&
        !!form.id_modalidad_patrullaje &&
        !!form.turno &&
        !!form.id_origen &&
        !!form.grupo;
      if (form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO)
        return hasBasics && form.vehiculos_detalle.length > 0;
      return hasBasics;
    }
    if (step === 2) {
      const { hora_alerta, hora_llegada, hora_repliegue, fecha_evento } = form;

      const camposLlenos =
        !!hora_alerta && !!hora_llegada && !!hora_repliegue && !!fecha_evento;
      if (!camposLlenos) return false;

      const aMinutos = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      let alerta = aMinutos(hora_alerta);
      let llegada = aMinutos(hora_llegada);
      let repliegue = aMinutos(hora_repliegue);

      if (llegada < alerta) llegada += 24 * 60;
      if (repliegue < llegada) repliegue += 24 * 60;

      const ordenCronologico = alerta <= llegada && llegada <= repliegue;
      const duracionValida = repliegue - alerta <= 12 * 60;

      return ordenCronologico && duracionValida;
    }

    if (step === 3) {
      const lugarValido = modoBusquedaManual
        ? (cuadras.length > 0 ? !!form.id_lugar : !!selVia)
        : !!form.id_lugar;

      return lugarValido && !!form.referencia;
    }
    if (step === 4) return form.descripcion.length > 3;
    return false;
  };

  const getDynamicBorderStyle = (value: any) => ({
    borderColor: value ? MJM_BLUE : isDark ? "#444" : "#ddd",
    borderWidth: value ? 1.5 : 1,
  });

  const formatearFechaEspañol = (fechaStr: string) => {
    if (!fechaStr) return "Seleccione fecha";

    const fecha = new Date(fechaStr + "T12:00:00");

    const diasSemana = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    const meses = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];

    const diaSemana = diasSemana[fecha.getDay()];
    const dia = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const año = fecha.getFullYear();

    return `${diaSemana}, ${dia} de ${mes} de ${año}`;
  };

  const formatearHora24h = (horaStr: string) => {
    if (!horaStr) return "00:00";
    if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(horaStr)) {
      return horaStr;
    }
    return "00:00";
  };

  const procesarSeleccion = (selectedDate: Date) => {
    if (pickerMode === "date") {
      const hoy = new Date();
      let fechaFinal = selectedDate > hoy ? hoy : selectedDate;

      const year = fechaFinal.getFullYear();
      const month = String(fechaFinal.getMonth() + 1).padStart(2, "0");
      const day = String(fechaFinal.getDate()).padStart(2, "0");

      setForm((prev) => ({ ...prev, fecha_evento: `${year}-${month}-${day}` }));
    } else if (activeField) {
      const horas = String(selectedDate.getHours()).padStart(2, "0");
      const minutos = String(selectedDate.getMinutes()).padStart(2, "0");
      
      setForm((prev) => ({ ...prev, [activeField]: `${horas}:${minutos}` }));
      setActiveField(null);
    }
  };

  const confirmIOSSelection = () => {
    if (activeField === "fecha_evento") {
      const hoyStr = getHoy();
      const offset = tempDate.getTimezoneOffset() * 60000;
      const fechaSeleccionadaStr = new Date(tempDate.getTime() - offset)
        .toISOString()
        .split("T")[0];

      if (fechaSeleccionadaStr > hoyStr) {
        Alert.alert("Atención", "No se pueden seleccionar fechas futuras.");
        setForm((f) => ({ ...f, fecha_evento: hoyStr }));
      } else {
        setForm((f) => ({ ...f, fecha_evento: fechaSeleccionadaStr }));
      }
    } else if (activeField) {
      const horaStr = tempDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setForm((f) => ({ ...f, [activeField]: horaStr }));
    }
    setShowPicker(false);
  };

  const limpiarFormulario = () => {
    setStep(1);
    fotos.forEach((f) => liberarUriPreview(f.uri));
    setFotos([]);
    setSelTipoVia(null);
    setSelVia(null);
    setUnidadForm({
      id_tipo_vehiculo: null,
      id_unidad: null,
      placa: "",
      tipo_asignacion: "MUNICIPAL",
      id_pnp: null,
    });
    setForm({
      id_usuario: userData?.id || (userData as any)?.id_usuario || null,
      id_lugar: null,
      id_modalidad: "137",
      id_origen: "3",
      id_tipo_patrullaje: null,
      id_modalidad_patrullaje: "1",
      vehiculos_detalle: [],
      id_camara: [],
      descripcion: "",
      hora_alerta: "",
      hora_llegada: "",
      hora_repliegue: "",
      latitud_gps: "0",
      longitud_gps: "0",
      turno: null,
      nombre_punto_gps: "",
      estadoOcurrencia: "VERIFICADO",
      referencia: "",
      unidad_encargada: "SERENAZGO",
      fecha_evento: getHoy(),
      grupo: null,
      victimas: [],
      datos_importantes: {
        por_orden_central: false,
        control_fv_sv: false,
        inyectable: false,
        curacion_topica: false,
        traslado_urgencia: false,
        pertenece_muni: false,
      },
    });
  };

  useEffect(() => {
    if (userData)
      setForm((prev) => ({
        ...prev,
        id_usuario: userData.id || (userData as any).id_usuario,
      }));
    setForm((prev) => ({ ...prev, fecha_evento: getHoy() }));
    limpiarFormulario();
    cargarCatalogosInit();
    obtenerGpsAutomatico();
  }, [userData]);

  const obtenerGpsAutomatico = async () => {
    try {
      let lat, lon;
      let direccionNombre = "";

      if (Platform.OS === "web") {
        lat = -12.073769;
        lon = -77.039673;
        direccionNombre = "CSI MDJM";
      } else {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          throw new Error("Permiso de ubicación denegado");
        }
        
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;

        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lon,
        });
        if (reverseGeocode.length > 0) {
          const p = reverseGeocode[0];
          direccionNombre = `${p.street || ""} ${p.streetNumber || ""}, ${p.district || p.city || ""}`.trim();
        }
      }

      setForm((prev) => ({
        ...prev,
        latitud_gps: lat.toString(),
        longitud_gps: lon.toString(),
        nombre_punto_gps: direccionNombre || "Ubicación identificada",
      }));
    } catch (e) {
      console.log("GPS no disponible, usando coordenadas por defecto:", e);
      
      // 📌 COORDENADAS POR DEFECTO (Ejemplo: Jesús María / Base central)
      setForm((prev) => ({
        ...prev,
        latitud_gps: "-12.073769",
        longitud_gps: "-77.039673",
        nombre_punto_gps: "CSI MDJM (Ubicación por defecto)",
      }));
    }
  };

  const cargarCatalogosInit = async () => {
    try {
      const [resGral, resTiposV, resPnps] = await Promise.all([
        fetch(`${API_URL}/catalogos/completo/unificadov?tipoLugar=4&idTipoP=6`),
        fetch(`${API_URL}/catalogos/tipos-vehiculo`),
        fetch(`${API_URL}/catalogos/pnp-activos`),
      ]);
      const tiposVehiculoData = await resTiposV.json();
      
      const tiposVehiculoFiltrados = (tiposVehiculoData || []).filter(
        (t: any) => Number(t.value) === 1 || Number(t.value) === 2
      );

      const data = await resGral.json();
      setCatalogos({
        usuarios: data.usuarios || [],
        modalidades: data.modalidades || [],
        origenes: data.origenes || [],
        camaras: data.camara || [],
        tipos_patrullaje: data.tipos_patrullaje || [],
        modalidades_patrullaje: data.modalidades_patrullaje || [],
        tipos_vehiculo: tiposVehiculoFiltrados,
        unidades: [],
        pnps: (await resPnps.json()) || [],
        lugares: data.lugares || [],
      });
      setTiposVia(data.tipos_via || []);
    } catch (err) {
      console.error("Error catálogos:", err);
    }
  };

  const fetchUnidades = async (idTipo: any) => {
    try {
      const res = await fetch(
        `${API_URL}/catalogos/vehiculos-por-tipo/${idTipo}`,
      );
      const data = await res.json();
      setCatalogos((prev) => ({ ...prev, unidades: data }));
    } catch (e) {
      console.error(e);
    }
  };

  const agregarVehiculo = () => {
    if (!unidadForm.id_unidad)
      return Alert.alert("Atención", "Seleccione una unidad/placa.");

    const yaExiste = form.vehiculos_detalle.some(
      (v) => v.id_unidad === unidadForm.id_unidad,
    );
    if (yaExiste)
      return Alert.alert(
        "Atención",
        `La placa ${unidadForm.placa} ya ha sido agregada.`,
      );

    const esCamioneta = unidadForm.id_tipo_vehiculo === ID_CAMIONETA;
    const asignacionFinal = esCamioneta
      ? unidadForm.tipo_asignacion
      : "MUNICIPAL";
    const pnpFinal =
      esCamioneta && asignacionFinal === "INTEGRADO" ? unidadForm.id_pnp : null;

    if (asignacionFinal === "INTEGRADO" && !pnpFinal)
      return Alert.alert("Atención", "Efectivo PNP requerido.");

    const nuevaModalidadPatrullaje =
      asignacionFinal === "INTEGRADO" ? "3" : "2";

    setForm((f) => ({
      ...f,
      id_modalidad_patrullaje: nuevaModalidadPatrullaje,
      vehiculos_detalle: [
        ...f.vehiculos_detalle,
        {
          ...unidadForm,
          tipo_asignacion: asignacionFinal,
          id_pnp: pnpFinal,
          nombre_pnp:
            (
              catalogos.pnps.find(
                (p: any) => String(p.value) === String(unidadForm.id_pnp),
              ) as any
            )?.label || "",
        },
      ],
    }));

    setUnidadForm({
      id_tipo_vehiculo: null,
      id_unidad: null,
      placa: "",
      tipo_asignacion: "MUNICIPAL",
      id_pnp: null,
    });
  };

  const handleTipoViaChange = async (idTipo: any) => {
    setSelTipoVia(idTipo);
    setSelVia(null);
    setCuadras([]);
    setForm((f) => ({ ...f, id_lugar: null }));
    try {
      const res = await fetch(`${API_URL}/catalogos/vias/${idTipo}`);
      setVias(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleViaChange = async (idVia: any) => {
    setSelVia(idVia);
    setForm((f) => ({ ...f, id_lugar: null }));
    try {
      const res = await fetch(`${API_URL}/catalogos/cuadras/${idVia}`);
      setCuadras(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const capturarHoraActual = (campo: string) => {
    const ahora = new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    setForm((f) => ({ ...f, [campo]: ahora }));
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
      Alert.alert("Atención", "No se pudo identificar al usuario.");
      return;
    }

    const fotosPendientes = fotos.some((f) => f.uploading);
    if (fotosPendientes) {
      return Alert.alert(
        "Espere un momento",
        "Las fotos aún se están subiendo a la nube. Reintente en unos segundos."
      );
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus("Subiendo...");
    setIsFinished(false);

    const interval = setInterval(
      () => setUploadProgress((p) => (p < 90 ? p + 10 : p)),
      150
    );

    try {
      const urlsFotosFinales = fotos
        .map((f) => f.url_remota)
        .filter((url): url is string => url !== null);

      // Combinación automática a formato: NOMBRE DNI: NRO
      const victimasProcesadas = (form.victimas || []).map((v) => {
        const nombreLimpio = (v.nombres || "").trim();
        const dniLimpio = (v.dni || "").trim();

        let nombreFinal = nombreLimpio;
        if (dniLimpio !== "") {
          nombreFinal = nombreLimpio !== "" ? `${nombreLimpio} DNI: ${dniLimpio}` : `DNI: ${dniLimpio}`;
        }

        return {
          nombre_victima: nombreFinal.toUpperCase(),
          edad: v.edad || null,
          placa_victima: (v.placa_victima || "").toUpperCase(),
          id_relacion_v: 2, // ID por defecto de Desconocido
        };
      });

      const res = await fetch(`${API_URL}/ocurrencias/registrar/modr2para`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          turno: form.turno,
          id_usuario: Number(idFinal),
          id_tipop: form.id_tipo_patrullaje,
          id_modalidadp: form.id_modalidad_patrullaje,
          id_camara: Array.isArray(form.id_camara)
            ? form.id_camara.map((c: any) => c.value).join(",")
            : form.id_camara || "",
          fotos: urlsFotosFinales,
          victimas_detalle: victimasProcesadas,
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
          obtenerGpsAutomatico();
          router.replace("/principal");
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

  const renderMosaicos = (
    data: any[],
    currentId: any,
    field: string,
    iconDefault: string,
  ) => (
    <View style={styles.mosaicoGrid}>
      {data.map((item: any) => (
        <Pressable
          key={item.value}
          onPress={() => {
            requestAnimationFrame(() => {
              setForm({ ...form, [field]: item.value });
            });
          }}
          style={[
            styles.mosaicoItem,
            currentId === item.value && styles.mosaicoSelected,
          ]}
        >
          <Ionicons
            name={iconDefault as any}
            size={18}
            color={currentId === item.value ? "white" : MJM_BLUE}
          />
          <ThemedText
            style={[
              styles.mosaicoText,
              currentId === item.value && { color: "white" },
            ]}
          >
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const dynamicStyles = {
    card: {
      backgroundColor: "white",
    },
    textInput: {
      backgroundColor: "white",
      color: "#000000",
      borderColor: isDark ? "#cccccc" : "#eeeeee",
    },
    label: {
      color: "#333333",
    },
    sectionTitle: {
      color: MJM_BLUE,
    },
    dropdown: {
      backgroundColor: "white",
      color: "#000000",
    },
    timeText: {
      color: MJM_BLUE,
    },
  };

  return (
    <ThemedView
      style={[
        styles.main,
        {
          paddingTop: insets.top,
          backgroundColor: isDark ? "#ffffff" : "#f4f7f6",
        },
      ]}
    >
      <View style={styles.stepperContainer}>
        <ThemedText
          style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
        >PARAMÉDICO: </ThemedText>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[styles.circle, step >= i && { backgroundColor: MJM_BLUE }]}
          >
            <ThemedText
              style={{ color: "white", fontWeight: "bold", fontSize: 11 }}
            >
              {i}
            </ThemedText>
          </View>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={[styles.card, dynamicStyles.card]}>
            <ThemedText
              style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
            >
              PASO 1: DESPACHO
            </ThemedText>
            <View
              style={{
                backgroundColor: isDark ? "#ffffff" : "#eef2ff",
                padding: 10,
                borderRadius: 8,
                marginBottom: 15,
                borderWidth: 1,
                borderColor: MJM_BLUE,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <Ionicons name="location" size={14} color={MJM_BLUE} />
                <ThemedText
                  style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
                >
                  ENVIAR REPORTE DESDE:
                </ThemedText>
              </View>
              <ThemedText
                style={{
                  fontSize: 11,
                  color: isDark ? "#000000" : "#000000",
                  marginTop: 2,
                }}
              >
                {form.nombre_punto_gps || "CSI MDJM"}
              </ThemedText>
            </View>
            <ThemedText style={styles.label}>GRUPO</ThemedText> 
                    
            <ScrollView
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.label}
            >
              {renderMosaicos(
                [
                  { label: "GRUPO 1", value: "1" },
                  { label: "GRUPO 2", value: "2" },
                  { label: "GRUPO 3", value: "3" },
                  { label: "GRUPO 4", value: "4" },
                ],
                form.grupo,
                "grupo",
                "people-outline",
              )}
            </ScrollView>
        
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
                form.turno,
                "turno",
                "time-outline",
              )}
            </ScrollView>

            <ThemedText style={[styles.label, dynamicStyles.label]}>
              TIPO DE PATRULLAJE
            </ThemedText>
            {renderMosaicos(
              catalogos.tipos_patrullaje,
              form.id_tipo_patrullaje,
              "id_tipo_patrullaje",
              "shield-checkmark-outline",
            )}

            {form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO && (
              <View
                style={[
                  styles.cascadaContainer,
                  getDynamicBorderStyle(form.vehiculos_detalle.length > 0),
                ]}
              >
                <View style={styles.cascadaHeader}>
                  <Ionicons name="car-sport" size={16} color={MJM_BLUE} />
                  <ThemedText style={styles.cascadaTitle}>
                    UNIDADES ASIGNADAS
                  </ThemedText>
                </View>

                <Dropdown
                  style={[styles.dropdown, dynamicStyles.dropdown]}
                  data={catalogos.tipos_vehiculo}
                  labelField="label"
                  valueField="value"
                  placeholder="Seleccione Tipo Vehículo"
                  value={unidadForm.id_tipo_vehiculo}
                  onChange={(v) => {
                    setUnidadForm({
                      ...unidadForm,
                      id_tipo_vehiculo: v.value,
                      id_unidad: null,
                      placa: "",
                      tipo_asignacion: "MUNICIPAL",
                      id_pnp: null,
                    });

                    setTimeout(() => {
                      fetchUnidades(v.value);
                    }, 50);
                  }}
                />

                {unidadForm.id_tipo_vehiculo && (
                  <>
                    {Number(unidadForm.id_tipo_vehiculo) ===
                      Number(ID_CAMIONETA) && (
                      <View style={{ marginTop: 15, gap: 10 }}>
                        <ThemedText
                          style={[
                            styles.label,
                            { fontSize: 11, marginBottom: 5 },
                          ]}
                        >
                          TIPO DE ASIGNACIÓN
                        </ThemedText>
                        <View style={styles.asignacionContainer}>
                          {["MUNICIPAL", "INTEGRADO"].map((tipo) => (
                            <Pressable
                              key={tipo}
                              onPress={() =>
                                setUnidadForm({
                                  ...unidadForm,
                                  tipo_asignacion: tipo as any,
                                  id_pnp: null,
                                })
                              }
                              style={[
                                styles.asignacionBtn,
                                unidadForm.tipo_asignacion === tipo &&
                                  styles.mosaicoSelected,
                              ]}
                            >
                              <ThemedText
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                style={[
                                  styles.asignacionText,
                                  {
                                    color:
                                      unidadForm.tipo_asignacion === tipo
                                        ? "white"
                                        : MJM_BLUE,
                                  },
                                ]}
                              >
                                {tipo}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>

                        {unidadForm.tipo_asignacion === "INTEGRADO" && (
                          <Dropdown
                            style={[styles.dropdown, dynamicStyles.dropdown]}
                            data={catalogos.pnps}
                            search
                            labelField="label"
                            valueField="value"
                            placeholder="Seleccionar Efectivo PNP"
                            value={unidadForm.id_pnp}
                            onChange={(v) =>
                              setUnidadForm({ ...unidadForm, id_pnp: v.value })
                            }
                          />
                        )}
                      </View>
                    )}

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
                        style={styles.btnAddUnit}
                        onPress={agregarVehiculo}
                      >
                        <Ionicons name="add" size={24} color="white" />
                      </Pressable>
                    </View>
                  </>
                )}

                {form.vehiculos_detalle.length > 0 && (
                  <View style={styles.listadoUnidadesContainer}>
                    <View style={styles.listadoHeader}>
                      <ThemedText style={styles.listadoTitle}>
                        UNIDADES EN EL REPORTE ({form.vehiculos_detalle.length})
                      </ThemedText>
                    </View>

                    {form.vehiculos_detalle.map((v, index) => (
                      <View
                        key={index}
                        style={[
                          styles.unitCard,
                          { backgroundColor: "#fff" },
                        ]}
                      >
                        <View style={styles.unitCardIcon}>
                          <Ionicons
                            name={
                              Number(v.id_tipo_vehiculo) ===
                              Number(ID_CAMIONETA)
                                ? "car"
                                : "bicycle"
                            }
                            size={20}
                            color={MJM_BLUE}
                          />
                        </View>

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <ThemedText style={styles.unitCardPlaca}>
                            {v.placa}
                          </ThemedText>
                          <ThemedText style={styles.unitCardSub}>
                            {v.tipo_asignacion}{" "}
                            {v.nombre_pnp ? `| PNP: ${v.nombre_pnp}` : ""}
                          </ThemedText>
                        </View>

                        <Pressable
                          onPress={() => {
                            const nuevos = form.vehiculos_detalle.filter(
                              (_, i) => i !== index,
                            );
                            setForm({ ...form, vehiculos_detalle: nuevos });
                          }}
                          style={styles.unitCardRemove}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#ff4444"
                          />
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
          <View
            style={[
              styles.card,
              dynamicStyles.card,
              { backgroundColor: "#FFF" },
            ]}
          >
            <ThemedText
              style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
            >
              PASO 2: TIEMPOS
            </ThemedText>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <ThemedText
                style={[styles.cascadaTitle, { marginLeft: 5, fontSize: 12 }]}
              >
                FECHA
              </ThemedText>
              <Pressable
                onPress={() => {
                  const fechaActualSistema = new Date()
                    .toISOString()
                    .split("T")[0];
                  const hoyStr =
                    typeof getHoy === "function"
                      ? getHoy()
                      : fechaActualSistema;
                  const fechaAAsignar =
                    hoyStr > fechaActualSistema ? fechaActualSistema : hoyStr;

                  setForm({ ...form, fecha_evento: fechaAAsignar });
                }}
                style={{
                  backgroundColor: MJM_BLUE,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                }}
              >
                <ThemedText
                  style={{ color: "white", fontSize: 11, fontWeight: "bold" }}
                >
                  PONER HOY
                </ThemedText>
              </Pressable>
            </View>

            {Platform.OS === "web" ? (
              <input
                type="date"
                value={form.fecha_evento}
                max={getHoy()}
                onChange={(e) =>
                  setForm({ ...form, fecha_evento: e.target.value })
                }
                style={{
                  height: 45,
                  borderWidth: 1,
                  borderColor: "#ccc",
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 16,
                  backgroundColor: "#FFFFFF",
                  color: "#000000",
                  width: "100%",
                  outline: "none",
                  borderStyle: "solid",
                }}
              />
            ) : (
              <Pressable
                onPress={() => {
                  setPickerMode("date");
                  setActiveField("fecha_evento");

                  const hoy = new Date();
                  const fechaForm = new Date(form.fecha_evento + "T12:00:00");
                  setTempDate(fechaForm > hoy ? hoy : fechaForm);

                  setShowPicker(true);
                }}
                style={[
                  styles.pickerPressable,
                  {
                    backgroundColor: "#FFFFFF",
                    borderColor: MJM_BLUE,
                    borderWidth: 1,
                  },
                  getDynamicBorderStyle(form.fecha_evento),
                ]}
              >
                <Ionicons name="calendar-outline" size={20} color={MJM_BLUE} />
                <ThemedText style={{ color: "#000", marginLeft: 10 }}>
                  {formatearFechaEspañol(form.fecha_evento)}
                </ThemedText>
              </Pressable>
            )}

            {["hora_alerta", "hora_llegada", "hora_repliegue"].map((k) => (
              <View key={k} style={{ marginTop: 15 }}>
                <ThemedText style={[styles.label, dynamicStyles.label]}>
                  {k.toUpperCase().replace("_", " ")}
                </ThemedText>
                <View style={styles.timeRow}>
                  {Platform.OS === "web" ? (
                    <input
                      type="time"
                      value={(form as any)[k]}
                      onChange={(e) =>
                        setForm({ ...form, [k]: e.target.value })
                      }
                      style={{
                        flex: 1,
                        height: 45,
                        borderWidth: 1,
                        borderStyle: "solid",
                        borderColor: "#ccc",
                        borderRadius: 8,
                        padding: 10,
                        backgroundColor: "#FFFFFF",
                        color: "#000000",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <Pressable
                      onPress={() => {
                        setPickerMode("time");
                        setActiveField(k);
                        const currentTime = (form as any)[k];
                        const date = new Date();
                        if (currentTime && currentTime !== "00:00") {
                          const [hours, minutes] = currentTime.split(":");
                          date.setHours(parseInt(hours), parseInt(minutes));
                        }
                        setTempDate(date);
                        setShowPicker(true);
                      }}
                      style={[
                        styles.pickerPressable,
                        { flex: 1, backgroundColor: "#FFF" },
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={MJM_BLUE}
                      />
                      <ThemedText style={{ color: "#000", marginLeft: 10 }}>
                        {formatearHora24h((form as any)[k]) || "00:00"}
                      </ThemedText>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.btnTime}
                    onPress={() => capturarHoraActual(k)}
                  >
                    <Ionicons name="flash" size={20} color="white" />
                  </Pressable>
                </View>
              </View>
            ))}

            {form.hora_alerta &&
            form.hora_llegada &&
            form.hora_repliegue &&
            (() => {
              const aMinutos = (t: string) => {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
              };

              let alerta = aMinutos(form.hora_alerta);
              let llegada = aMinutos(form.hora_llegada);
              let repliegue = aMinutos(form.hora_repliegue);

              if (llegada < alerta) llegada += 24 * 60;
              if (repliegue < llegada) repliegue += 24 * 60;

              const ordenCorrecto = alerta <= llegada && llegada <= repliegue;
              const duracionValida = repliegue - alerta <= 12 * 60;

              return !(ordenCorrecto && duracionValida);
            })() ? (
              <View
                style={{
                  backgroundColor: "#FFF5F5",
                  borderLeftWidth: 4,
                  borderLeftColor: "#D32F2F",
                  padding: 12,
                  borderRadius: 8,
                  marginTop: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              >
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color="#D32F2F"
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={{
                      color: "#D32F2F",
                      fontSize: 13,
                      fontWeight: "bold",
                      marginBottom: 4,
                    }}
                  >
                    Error en los intervalos de tiempo
                  </ThemedText>

                  <ThemedText
                    style={{ color: "#555", fontSize: 11, marginBottom: 2 }}
                  >
                    • El orden debe ser: Repliegue ≥ Llegada ≥ Alerta.
                  </ThemedText>

                  <ThemedText style={{ color: "#555", fontSize: 11 }}>
                    • La duración total entre Alerta y Repliegue no debe superar
                    las 12 horas.
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {step === 3 && (
          <View style={styles.cascadaContainer}>
            <ThemedText
              style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
            >
              PASO 3: UBICACIÓN
            </ThemedText>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 15,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }} />
            </View>

            <View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Ionicons name="location" size={18} color={MJM_BLUE} />
                  <ThemedText
                    style={[
                      styles.cascadaTitle,
                      { marginLeft: 5, flex: 1, fontSize: 11 }
                    ]}
                  >
                    {modoBusquedaManual
                      ? "BÚSQUEDA MANUAL"
                      : "DIRECCIÓN DIRECTA (AV, CA, JR, PSJ, PQ, PLZ, EDF, BLK)"}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => {
                    setModoBusquedaManual(!modoBusquedaManual);
                    setSelTipoVia(null);
                    setSelVia(null);
                    setVias([]);
                    setCuadras([]);
                    setForm((prev: any) => ({ ...prev, id_lugar: null }));
                  }}
                  style={[
                    styles.btnToggleModo,
                    modoBusquedaManual && { backgroundColor: "#E3F2FD" },
                  ]}
                >
                  <ThemedText
                    style={{ color: MJM_BLUE, fontSize: 10, fontWeight: "bold" }}
                  >
                    {modoBusquedaManual ? "USAR LISTADO" : "POR CALLE/CUADRA"}
                  </ThemedText>
                </Pressable>
              </View>

              {!modoBusquedaManual && (
                <View style={{ marginBottom: 10 }}>
                  <Dropdown
                    containerStyle={styles.dropdownContainer}
                    selectedTextStyle={{
                      color: "#000",
                      fontSize: 14,
                    }}
                    style={[
                      styles.dropdown,
                      dynamicStyles.dropdown,
                      { borderColor: MJM_BLUE },
                    ]}
                    data={catalogos?.lugares || []}
                    search
                    searchPlaceholder="Buscar dirección..."
                    labelField="label"
                    valueField="value"
                    placeholder="Seleccione la ubicación..."
                    value={form.id_lugar}
                    onFocus={() => {
                      setForm((prev: any) => ({
                        ...prev,
                        id_lugar: "",
                      }));
                    }}
                    renderInputSearch={(onSearch) => (
                      <TextInput
                        style={{
                          height: 40,
                          fontSize: 14,
                          borderRadius: 8,
                          color: "#000",
                          paddingHorizontal: 10,
                          backgroundColor: "#F9F9F9",
                          margin: 8,
                          borderWidth: 1,
                          borderColor: "#E0E0E0",
                        }}
                        placeholder="Buscar dirección..."
                        placeholderTextColor="#999"
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                        onChangeText={(text) => onSearch(text)}
                      />
                    )}
                    searchQuery={(keyword: string, label: string) => {
                      if (!keyword) return true;

                      const normalize = (text: string): string =>
                        text
                          .toLowerCase()
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .replace(/\./g, "")
                          .replace(/\b(pq|porque)\b/g, "parque");

                      const cleanLabel = normalize(label);
                      const cleanKeyword = normalize(keyword);
                      const searchTerms = cleanKeyword.trim().split(/\s+/);

                      return searchTerms.every((term) => cleanLabel.includes(term));
                    }}
                    placeholderStyle={{ color: "#666" }}
                    onChange={(item) => {
                      setForm((prev: any) => ({
                        ...prev,
                        id_lugar: item.value,
                      }));
                    }}
                    flatListProps={{
                      nestedScrollEnabled: true,
                      keyboardShouldPersistTaps: "handled",
                    }}
                    activeColor="#E3F2FD"
                  />
                </View>
              )}

              {modoBusquedaManual && (
                <View style={styles.cascadaGrid}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.labelSubCascada}>TIPO</ThemedText>
                    <Dropdown
                      containerStyle={styles.dropdownContainer}
                      style={styles.dropdownCascadaItem}
                      data={(tiposVia || []).filter((item: any) => Number(item.value) !== 11)}
                      labelField="label"
                      valueField="value"
                      placeholder="Tipo"
                      value={selTipoVia}
                      onFocus={() => {
                        setSelTipoVia(null);
                        setSelVia(null);
                        setVias([]);
                        setCuadras([]);
                        setForm((prev: any) => ({ ...prev, id_lugar: null }));
                      }}
                      onChange={(item) => {
                        setSelVia(null);
                        setVias([]);
                        setCuadras([]);
                        setForm((prev: any) => ({ ...prev, id_lugar: null }));
                        handleTipoViaChange(item.value);
                      }}
                      placeholderStyle={{ fontSize: 11, color: "#999" }}
                      selectedTextStyle={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: MJM_BLUE,
                      }}
                      flatListProps={{
                        nestedScrollEnabled: true,
                        keyboardShouldPersistTaps: "handled",
                      }}
                      activeColor="#E3F2FD"
                    />
                  </View>

                  <View style={{ flex: 2.2 }}>
                    <ThemedText style={styles.labelSubCascada}>CALLE / VÍA</ThemedText>
                    <Dropdown
                      containerStyle={styles.dropdownContainer}
                      style={[
                        styles.dropdownCascadaItem,
                        !selTipoVia && styles.dropdownDisabled,
                      ]}
                      disable={!selTipoVia}
                      data={vias || []}
                      search
                      searchPlaceholder="Calle..."
                      labelField="label"
                      valueField="value"
                      placeholder="Nombre de vía..."
                      value={selVia}
                      onFocus={() => {
                        setSelVia(null);
                        setCuadras([]);
                        setForm((prev: any) => ({ ...prev, id_lugar: null }));
                      }}
                      onChange={(item) => handleViaChange(item.value)}
                      searchQuery={(keyword: string, label: string) => {
                        const normalize = (text: string): string =>
                          text
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "");

                        const cleanLabel = normalize(label);
                        const cleanKeyword = normalize(keyword);
                        const searchTerms = cleanKeyword.trim().split(/\s+/);

                        return searchTerms.every((term) => cleanLabel.includes(term));
                      }}
                      placeholderStyle={{ fontSize: 11, color: "#999" }}
                      selectedTextStyle={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: MJM_BLUE,
                      }}
                      flatListProps={{
                        nestedScrollEnabled: true,
                        keyboardShouldPersistTaps: "handled",
                      }}
                      activeColor="#E3F2FD"
                      inputSearchStyle={{
                        height: 40,
                        fontSize: 14,
                        borderRadius: 8,
                        color: "#000",
                        paddingHorizontal: 10,
                        backgroundColor: "#F9F9F9",
                      }}
                    />
                  </View>

                  {cuadras && cuadras.length > 0 && (
                    <View style={{ flex: 0.9 }}>
                      <ThemedText style={styles.labelSubCascada}>CDRA</ThemedText>
                      <Dropdown
                        containerStyle={styles.dropdownContainer}
                        style={[
                          styles.dropdownCascadaItem,
                          !selVia && styles.dropdownDisabled,
                        ]}
                        disable={!selVia}
                        data={cuadras}
                        labelField="label"
                        valueField="value"
                        placeholder="N°"
                        value={form.id_lugar}
                        onFocus={() => {
                          setForm((prev: any) => ({ ...prev, id_lugar: "" }));
                        }}
                        onChange={(item) =>
                          setForm((prev: any) => ({ ...prev, id_lugar: item.value }))
                        }
                        placeholderStyle={{ fontSize: 11, color: "#999" }}
                        selectedTextStyle={{
                          fontSize: 11,
                          fontWeight: "bold",
                          color: MJM_BLUE,
                        }}
                        flatListProps={{
                          nestedScrollEnabled: true,
                          keyboardShouldPersistTaps: "handled",
                        }}
                        activeColor="#E3F2FD"
                      />
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={{ marginTop: 20 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 5,
                }}
              >
                <Ionicons name="map-outline" size={14} color={MJM_BLUE} />
                <ThemedText style={[styles.cascadaTitle, { marginLeft: 5 }]}>
                  {modoBusquedaManual ? "REFERENCIA(Obligatorio)" : "REFERENCIA(Obligatorio)"}
                </ThemedText>
              </View>
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
                    borderColor:
                      form.referencia.length >= 3 ? MJM_BLUE : "#DDD",
                    borderRadius: 10,
                  },
                ]}
                placeholder="Ej: Escriba una referencia cercana o indique el númeral exacto si lo conoce."
                placeholderTextColor="#AAA"
                value={form.referencia}
                onChangeText={(t) => setForm({ ...form, referencia: t })}
                multiline
              />
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={[styles.card, dynamicStyles.card]}>
            <ThemedText
              style={[styles.sectionTitle, dynamicStyles.sectionTitle]}
            >
              PASO 4: CIERRE
            </ThemedText>
            
            {/* SECCIÓN DE DATOS IMPORTANTES / ASISTENCIALES */}
            <View style={{ marginTop: 10, marginBottom: 15 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginVertical: 4,
                }}
              >
             
              </View>

              {(() => {
                const activo = form.datos_importantes.por_orden_central;
                return (
                  <Pressable
                    onPress={() => {
                      setForm({
                        ...form,
                        datos_importantes: {
                          ...form.datos_importantes,
                          por_orden_central: !activo,
                        },
                      });
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: activo ? MJM_BLUE : "#E3F2FD",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 6,
                      gap: 6,
                      marginBottom: 12,
                      alignSelf: "flex-start",
                    }}
                  >
                    <Ionicons
                      name={activo ? "checkbox-outline" : "square-outline"}
                      size={14}
                      color={activo ? "#FFF" : MJM_BLUE}
                    />
                    <ThemedText
                      style={{
                        fontSize: 10,
                        fontWeight: "bold",
                        color: activo ? "#FFF" : MJM_BLUE,
                      }}
                    >
                      POR ORDEN DE LA CENTRAL
                    </ThemedText>
                  </Pressable>
                );
              })()}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginVertical: 4,
                }}
              >
                <Ionicons name="medical-outline" size={14} color={MJM_BLUE} />
                <ThemedText
                  style={[
                    styles.cascadaTitle,
                    {
                      fontSize: 10,
                      color: MJM_BLUE,
                      fontWeight: "bold",
                      marginLeft: 0,
                    },
                  ]}
                >
                  TIPO DE ATENCIÓN REALIZADA
                </ThemedText>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {[
                  { key: "control_fv_sv", label: "CONTROL DE FV O SV" },
                  { key: "inyectable", label: "INYECTABLE" },
                  { key: "curacion_topica", label: "CURACIÓN TÓPICA" },
                  { key: "traslado_urgencia", label: "TRASLADO URG. / EME." },
                ].map((item) => {
                  const activo = (form.datos_importantes as any)[item.key];
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        setForm({
                          ...form,
                          datos_importantes: {
                            ...form.datos_importantes,
                            [item.key]: !activo,
                          },
                        });
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: activo ? MJM_BLUE : "#E3F2FD",
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 6,
                        gap: 5,
                      }}
                    >
                      <Ionicons
                        name={activo ? "checkbox-outline" : "square-outline"}
                        size={13}
                        color={activo ? "#FFF" : MJM_BLUE}
                      />
                      <ThemedText
                        style={{
                          fontSize: 9,
                          fontWeight: "bold",
                          color: activo ? "#FFF" : MJM_BLUE,
                        }}
                      >
                        {item.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => {
                  setForm({
                    ...form,
                    datos_importantes: {
                      ...form.datos_importantes,
                      pertenece_muni: !form.datos_importantes.pertenece_muni,
                    },
                  });
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: form.datos_importantes.pertenece_muni ? MJM_BLUE : "#E3F2FD",
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: MJM_BLUE,
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                <Ionicons
                  name={form.datos_importantes.pertenece_muni ? "checkbox" : "square-outline"}
                  size={18}
                  color={form.datos_importantes.pertenece_muni ? "#FFF" : MJM_BLUE}
                />
                <ThemedText
                  style={{
                    fontSize: 11,
                    fontWeight: "bold",
                    color: form.datos_importantes.pertenece_muni ? "#FFF" : MJM_BLUE,
                  }}
                >
                  ¿Paciente atendido pertenece a la Municipalidad?
                </ThemedText>
              </Pressable>
            </View>

            {/* SECCIÓN DE VÍCTIMAS (CAMPOS EN UNA SOLA FILA COMPACTA) */}
            <View style={{ marginTop: 5, marginBottom: 15, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <ThemedText style={{ fontSize: 11, color: MJM_BLUE, fontWeight: "bold" }}>
                  PACIENTE(S) ({(form.victimas || []).length}/5)
                </ThemedText>
                {(form.victimas || []).length < 5 && (
                  <Pressable
                    onPress={() => {
                      setForm((prev) => ({
                        ...prev,
                        victimas: [
                          ...(prev.victimas || []),
                          { nombres: "", dni: "", edad: "", placa_victima: "" },
                        ],
                      }));
                    }}
                    style={{ backgroundColor: MJM_BLUE, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 }}
                  >
                    <ThemedText style={{ color: "#FFF", fontSize: 10, fontWeight: "bold" }}>➕ Agregar Paciente</ThemedText>
                  </Pressable>
                )}
              </View>

              {(form.victimas || []).map((vic, index) => (
                <View key={`vic-${index}`} style={{ backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 6, padding: 6, marginBottom: 6 }}>
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    <TextInput
                      style={{ flex: 2, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6, fontSize: 10, backgroundColor: "#FFF", color: "#000" }}
                      placeholder="NOMBRES"
                      placeholderTextColor="#999"
                      value={vic.nombres}
                      onChangeText={(t) => {
                        const nuevas = [...form.victimas];
                        nuevas[index] = { ...nuevas[index], nombres: t };
                        setForm((prev) => ({ ...prev, victimas: nuevas }));
                      }}
                    />
                    <TextInput
                      style={{ flex: 1.2, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6, fontSize: 10, backgroundColor: "#FFF", color: "#000" }}
                      placeholder="DNI"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      value={vic.dni}
                      onChangeText={(t) => {
                        const val = t.replace(/\D/g, "");
                        const nuevas = [...form.victimas];
                        nuevas[index] = { ...nuevas[index], dni: val };
                        setForm((prev) => ({ ...prev, victimas: nuevas }));
                      }}
                    />
                    <TextInput
                      style={{ flex: 0.7, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6, fontSize: 10, backgroundColor: "#FFF", color: "#000" }}
                      placeholder="EDAD"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={3}
                      value={vic.edad}
                      onChangeText={(t) => {
                        const val = t.replace(/\D/g, "");
                        const nuevas = [...form.victimas];
                        nuevas[index] = { ...nuevas[index], edad: val };
                        setForm((prev) => ({ ...prev, victimas: nuevas }));
                      }}
                    />
                    <TextInput
                      style={{ flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6, fontSize: 10, backgroundColor: "#FFF", color: "#000" }}
                      placeholder="PLACA"
                      placeholderTextColor="#999"
                      value={vic.placa_victima}
                      onChangeText={(t) => {
                        const nuevas = [...form.victimas];
                        nuevas[index] = { ...nuevas[index], placa_victima: t.toUpperCase() };
                        setForm((prev) => ({ ...prev, victimas: nuevas }));
                      }}
                    />
                    <Pressable
                      onPress={() => {
                        const nuevas = form.victimas.filter((_, i) => i !== index);
                        setForm((prev) => ({ ...prev, victimas: nuevas }));
                      }}
                      style={{ width: 26, height: 28, backgroundColor: "#fee2e2", justifyContent: "center", alignItems: "center", borderRadius: 4 }}
                    >
                      <ThemedText style={{ color: "#dc2626", fontWeight: "bold", fontSize: 11 }}>✕</ThemedText>
                    </Pressable>
                    
                  </View>
                  
                </View>

              ))}
            </View>
            
            {/* DESCRIPCIÓN / DETALLES LIBRES */}
            <View>
             
              
              <View
                style={[
                  styles.textArea,
                  dynamicStyles.textInput,
                  {
                    backgroundColor: "#FFFFFF",
                    height: 80,
                    maxHeight: 120,
                    padding: 12,
                    justifyContent: "flex-start",
                    overflow: "hidden",
                  },
                  getDynamicBorderStyle((form.descripcion || "").length >= 3),
                ]}
              >
                <TextInput
                  style={[
                    {
                      borderWidth: 0,
                      borderColor: "transparent",
                      backgroundColor: "transparent",
                      color: "#000000",
                      fontSize: 14,
                      textAlignVertical: "top",
                      padding: 0,
                      margin: 0,
                      flex: 1,
                    },
                    Platform.OS === "web" &&
                      ({
                        outlineStyle: "none",
                        boxShadow: "none",
                      } as any),
                  ]}
                  placeholder="Registre el número del formato y otros detalles"
                  placeholderTextColor="#999999"
                  multiline={true}
                  scrollEnabled={true}
                  value={form.descripcion}
                  onChangeText={(t) => {
                    const textoCapitalizado = t.length > 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t;
                    setForm({ ...form, descripcion: textoCapitalizado });
                  }}
                />
              </View>
            
              <ThemedText
                style={{
                  fontSize: 10,
                  textAlign: "right",
                  marginTop: 2,
                  color: "#888",
                }}
              >
                {`${(form.descripcion || "").length} caracteres`}
              </ThemedText>
            </View>

            {/* ACCIONES DE FOTOS */}
            <View style={[styles.photoActions, { marginTop: 5 }]}>
              <Pressable style={styles.btnCamAction} onPress={tomarFoto}>
                <Ionicons name="camera" size={20} color="white" />
                <ThemedText style={styles.btnCamText}>FOTO</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.btnCamAction, { backgroundColor: "#666" }]}
                onPress={seleccionarGaleria}
              >
                <Ionicons name="images" size={20} color="white" />
                <ThemedText style={styles.btnCamText}>GALERÍA</ThemedText>
              </Pressable>
            </View>

            <ThemedText
              style={[
                styles.photoCounter,
                { marginVertical: 5 },
                fotos.length === MAX_FOTOS && {
                  color: "red",
                  fontWeight: "bold",
                },
              ]}
            >
              {`${fotos.length} de ${MAX_FOTOS} fotos`}
            </ThemedText>

            {fotos.length > 0 && (
              <ScrollView
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
                { marginTop: 15, opacity: canAdvance() ? 1 : 0.6 },
              ]}
              onPress={enviarRegistro}
              disabled={!canAdvance() || loading}
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                {loading ? "ENVIANDO..." : "FINALIZAR REGISTRO"}
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.navContainer,
          {
            paddingBottom: insets.bottom + 25,
            height: "auto",
            backgroundColor: "white",
            borderTopColor: isDark ? "#cccccc" : "#eeeeee",
          },
        ]}
      >
        <Pressable
          style={[
            styles.navBtn,
            { borderColor: isDark ? "#bbbbbb" : "#eeeeee" },
          ]}
          onPress={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ThemedText
            style={{
              color: step === 1 ? (isDark ? "#999" : "#ccc") : MJM_BLUE,
            }}
          >
            ANTERIOR
          </ThemedText>
        </Pressable>

        {step < 4 && (
          <Pressable
            style={[
              styles.navBtn,
              {
                backgroundColor: canAdvance()
                  ? MJM_BLUE
                  : isDark
                    ? "#dddddd"
                    : "#cccccc",
                borderColor: canAdvance()
                  ? MJM_BLUE
                  : isDark
                    ? "#dddddd"
                    : "#dddddd",
              },
            ]}
            onPress={() => setStep(step + 1)}
            disabled={!canAdvance()}
          >
            <ThemedText style={{ color: "white" }}>SIGUIENTE</ThemedText>
          </Pressable>
        )}
      </View>

      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: "#FFFFFF" }]}>
            <ThemedText style={[styles.progressTitle, { color: MJM_BLUE }]}>
              {uploadStatus}
            </ThemedText>

            {!isFinished ? (
              <>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${uploadProgress}%` },
                    ]}
                  />
                </View>
                <ThemedText style={styles.progressPercentage}>
                  {uploadProgress}%
                </ThemedText>
              </>
            ) : (
              <Ionicons name="checkmark-circle" size={60} color={MJM_BLUE} />
            )}
          </View>
        </View>
      </Modal>

      {showPicker && (
        Platform.OS === "ios" ? (
          <Modal transparent animationType="fade" visible={showPicker}>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
              <View style={{ backgroundColor: "white", padding: 20, borderRadius: 12, width: "85%", alignItems: "center" }}>
                <DateTimePicker
                  value={tempDate}
                  mode={pickerMode}
                  display="spinner"
                  maximumDate={pickerMode === "date" ? new Date() : undefined}
                  locale="es-ES"
                  themeVariant="light"
                  onChange={(_, selectedDate) => {
                    if (selectedDate) setTempDate(selectedDate);
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 15 }}>
                  <Pressable
                    style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#eee" }}
                    onPress={() => setShowPicker(false)}
                  >
                    <ThemedText style={{ color: "#333" }}>Cancelar</ThemedText>
                  </Pressable>
                  <Pressable
                    style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: "center", backgroundColor: MJM_BLUE }}
                    onPress={confirmIOSSelection}
                  >
                    <ThemedText style={{ color: "white", fontWeight: "bold" }}>Confirmar</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={tempDate}
            mode={pickerMode}
            display={pickerMode === "date" ? "calendar" : "spinner"}
            is24Hour={true}
            maximumDate={pickerMode === "date" ? new Date() : undefined}
            locale="es-ES"
            themeVariant="light"
            onValueChange={(event, selectedDate) => {
              setShowPicker(false);
              if (selectedDate && (event as any).type !== "dismissed") {
                procesarSeleccion(selectedDate);
              }
            }}
            onDismiss={() => setShowPicker(false)}
          />
        )
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  dropdownDisabled: { backgroundColor: "#F5F5F5", borderColor: "#CCC" },
  textAreaSmall: {
    minHeight: 85,
    textAlignVertical: "top",
    color: "#000",
    backgroundColor: "#FFF",
    padding: 12,
    fontSize: 14,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  main: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  filaMosaicos: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
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
  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 15,
    elevation: 0,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  cascadaContainer: {
    marginTop: 15,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F9FBFF",
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
    backgroundColor: "#F0F5FF",
    justifyContent: "center",
    alignItems: "center",
  },
  labelSubCascada: {
    fontSize: 9,
    color: MJM_BLUE,
    fontWeight: "800",
    marginBottom: 3,
    marginLeft: 2,
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
  dropdownUbicacionDirecta: {
    borderColor: MJM_BLUE,
    borderWidth: 1,
    backgroundColor: "#F9FCFF",
    height: 45,
    borderRadius: 8,
    paddingHorizontal: 10,
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
  btnToggleModo: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    borderWidth: 1.5,
    borderColor: MJM_BLUE,
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
  cascadaGrid: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#F0F7FF",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBDEFB",
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
  dropdownCascadaItem: {
    height: 42,
    backgroundColor: "#FFF",
    borderColor: MJM_BLUE,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
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
    gap: 12,
    marginTop: 10,
    justifyContent: "flex-start",
  },
  mosaicoItem: {
    width: "48%",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
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
    backgroundColor: "#FFFFFF",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    width: "85%",
    elevation: 10,
    shadowColor: "#000",
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
});