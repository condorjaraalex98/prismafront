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

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
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
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
  };
  const [form, setForm] = useState({
    id_usuario: null,
    id_lugar: null,
    id_modalidad: "",
    id_origen: "8",
    id_tipo_patrullaje: null,
    id_modalidad_patrullaje: "10",
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
     estadoOcurrencia: "PENDIENTE",referencia: "",
    unidad_encargada: "SERENAZGO",
    fecha_evento: getHoy(),
    grupo: null,
  });

  // --- LÓGICA DE VALIDACIÓN ---
  const canAdvance = () => {
    if (step === 1) {
      const hasBasics =
        !!form.id_tipo_patrullaje &&
        !!form.id_modalidad_patrullaje &&
       
        !!form.turno &&
        !!form.id_origen 
      if (form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO)
        return hasBasics && form.vehiculos_detalle.length > 0;
      return hasBasics;
    }
    if (step === 2) {
      const { hora_alerta, hora_llegada, hora_repliegue, fecha_evento } = form;

      // Primero: ¿Están todos los campos llenos?
      const camposLlenos =
        !!hora_alerta && !!hora_llegada && !!hora_repliegue && !!fecha_evento;
      if (!camposLlenos) return false;

      // Segundo: Convertir horas a minutos para validar cruce de medianoche y rango de 12h
      const aMinutos = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      let alerta = aMinutos(hora_alerta);
      let llegada = aMinutos(hora_llegada);
      let repliegue = aMinutos(hora_repliegue);

      // Si pasa al día siguiente
      if (llegada < alerta) llegada += 24 * 60;
      if (repliegue < llegada) repliegue += 24 * 60;

      const ordenCronologico = alerta <= llegada && llegada <= repliegue;
      const duracionValida = repliegue - alerta <= 12 * 60;

      return ordenCronologico && duracionValida;
    }

     if (step === 3) return !!form.id_lugar && form.referencia.length > 3;
    if (step === 4) return !!form.id_modalidad && form.descripcion.length > 3;
    return false;
  };

  const getDynamicBorderStyle = (value: any) => ({
    borderColor: value ? MJM_BLUE : isDark ? "#444" : "#ddd",
    borderWidth: value ? 1.5 : 1,
  });

  // --- FUNCIÓN PARA FORMATEAR FECHA EN ESPAÑOL ---
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

  // --- FUNCIÓN PARA FORMATEAR HORA EN 24H ---
  const formatearHora24h = (horaStr: string) => {
    if (!horaStr) return "00:00";
    // Si ya está en formato HH:MM, lo devolvemos
    if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(horaStr)) {
      return horaStr;
    }
    return "00:00";
  };

  // --- MANEJADOR DE CAMBIO DE FECHA ---
  // --- MANEJADOR DE CAMBIO DE FECHA ---
   const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (selectedDate) {
      const fechaStr = selectedDate.toISOString().split("T")[0];

      if (Platform.OS === "android") {
        // Retraso para evitar crash al cerrar el modal
        setTimeout(() => {
          setForm((f) => ({ ...f, fecha_evento: fechaStr }));
        }, 100);
      } else {
        setForm((f) => ({ ...f, fecha_evento: fechaStr }));
      }
    }

    if (Platform.OS === "ios") {
      setTempDate(selectedDate || new Date());
    }
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
    // Formato estricto 24 horas HH:mm
    const horas = String(selectedDate.getHours()).padStart(2, "0");
    const minutos = String(selectedDate.getMinutes()).padStart(2, "0");
    
    setForm((prev) => ({ ...prev, [activeField]: `${horas}:${minutos}` }));
    setActiveField(null);
  }
};
 
  // --- MANEJADOR DE CAMBIO DE HORA ---
  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (selectedTime && activeField) {
      const horaStr = selectedTime.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      if (Platform.OS === "android") {
        // El setTimeout es vital aquí para que no se quede trabado en "24h"
        setTimeout(() => {
          setForm((f) => ({ ...f, [activeField!]: horaStr }));
          setActiveField(null); // <--- Agrega esto para "soltar" el foco del input
        }, 100);
      } else {
        setForm((f) => ({ ...f, [activeField!]: horaStr }));
      }
    }

    if (Platform.OS === "ios") {
      setTempDate(selectedTime || new Date());
    }
  };
  // --- CONFIRMAR SELECCIÓN EN iOS ---
const confirmIOSSelection = () => {
  if (activeField === "fecha_evento") {
    const hoy = new Date();
    const fechaValida = tempDate > hoy ? hoy : tempDate;

    const offset = fechaValida.getTimezoneOffset() * 60000;
    const fechaStr = new Date(fechaValida.getTime() - offset)
      .toISOString()
      .split("T")[0];

    setForm((f) => ({ ...f, fecha_evento: fechaStr }));
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
    fotos.forEach((f) => liberarUriPreview(f.uri)); // 👈 Libera memoria web
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
      id_modalidad: "",
      id_origen: "8",
      id_tipo_patrullaje: null,
      id_modalidad_patrullaje: "10",
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
       estadoOcurrencia: "PENDIENTE",referencia: "",
      unidad_encargada: "SERENAZGO",
      fecha_evento: getHoy(),
      grupo: null,
    });
  };
  // --- EFECTOS E INICIALIZACIÓN ---
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
      if (Platform.OS === "web") {
        lat = -12.073769;
        lon = -77.039673;
      } else {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }
      setForm((prev) => ({
        ...prev,
        latitud_gps: lat.toString(),
        longitud_gps: lon.toString(),
      }));
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lon,
      });
      if (reverseGeocode.length > 0) {
        const p = reverseGeocode[0];
        const direccionNombre =
          `${p.street || ""} ${p.streetNumber || ""}, ${p.district || p.city || ""}`.trim();
        setForm((prev) => ({
          ...prev,
          nombre_punto_gps: direccionNombre || "Ubicación identificada",
        }));
      }
    } catch (e) {
      console.error("Error GPS:", e);
    }
  };

  const cargarCatalogosInit = async () => {
    try {
      const [resGral, resTiposV, resPnps] = await Promise.all([
        fetch(`${API_URL}/catalogos/completo/unificadov?tipoLugar=4&idTipoP=1&idTipoP=2&idTipoP=3&idTipoP=4`),
        fetch(`${API_URL}/catalogos/tipos-vehiculo`),
        fetch(`${API_URL}/catalogos/pnp-activos`),
      ]);
    const tiposVehiculoData = await resTiposV.json();
      
      // 👈 Filtramos para quedarnos solo con el ID 1 y el ID 2
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
        tipos_vehiculo: tiposVehiculoFiltrados, // 👈 Usamos la lista filtrada (1 y 2)
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

  // --- ACCIONES DE FORMULARIO ---
  const agregarVehiculo = () => {
    if (!unidadForm.id_unidad)
      return Alert.alert("Atención", "Seleccione una unidad/placa.");

    // --- VALIDACIÓN DE DUPLICADOS ---
    const yaExiste = form.vehiculos_detalle.some(
      (v) => v.id_unidad === unidadForm.id_unidad,
    );
    if (yaExiste)
      return Alert.alert(
        "Atención",
        `La placa ${unidadForm.placa} ya ha sido agregada.`,
      );
    // --------------------------------

    const esCamioneta = unidadForm.id_tipo_vehiculo === ID_CAMIONETA;
    const asignacionFinal = esCamioneta
      ? unidadForm.tipo_asignacion
      : "MUNICIPAL";
    const pnpFinal =
      esCamioneta && asignacionFinal === "INTEGRADO" ? unidadForm.id_pnp : null;

    if (asignacionFinal === "INTEGRADO" && !pnpFinal)
      return Alert.alert("Atención", "Efectivo PNP requerido.");

    // Definir la modalidad de patrullaje según si es integrado o no
    const nuevaModalidadPatrullaje =
      asignacionFinal === "INTEGRADO" ? "3" : "2";

    setForm((f) => ({
      ...f,
      id_modalidad_patrullaje: nuevaModalidadPatrullaje, // Actualiza el campo general del form
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

    // Resetear formulario de unidad
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
  const obtenerFechaLocal = () => {
    const fecha = new Date();
    const offset = fecha.getTimezoneOffset();
    const fechaLocal = new Date(fecha.getTime() - offset * 60 * 1000);
    return fechaLocal.toISOString().split("T")[0];
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

      // 1. Mostrar preview en estado "Cargando..."
      setFotos((p) => [...p, { uri: uriPreview, url_remota: null, uploading: true }]);

      // 2. Subir al servidor R2
      const urlRemota = await subirFotoAlServidor(fotoProcesada, API_URL);

      // 3. Actualizar con la URL remota exitosa
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
    const LOTE_MAXIMO = 2; // 👈 Control de concurrencia: máximo 2 subidas simultáneas

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

            const urlRemota = await subirFotoAlServidor(fotoProcesada, API_URL);

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
    // --- RESCATE DE ID PARA ANDROID ---
    // Si form.id_usuario es null, intentamos obtenerlo de userData directamente
    const idFinal =
      form.id_usuario || userData?.id || (userData as any)?.id_usuario;

    if (!idFinal) {
      Alert.alert(
        "Atención",
        "No se pudo identificar al usuario. Verifique su conexión o reinicie sesión.",
      );
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus("Subiendo...");
    setIsFinished(false);

    const interval = setInterval(
      () => setUploadProgress((p) => (p < 90 ? p + 10 : p)),
      150,
    );

    try {
      const res = await fetch(`${API_URL}/ocurrencias/registrar/modr2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          turno: form.turno,
          id_usuario: Number(idFinal), // Forzamos que sea un número y no null
          id_tipop: form.id_tipo_patrullaje,
          id_modalidadp: form.id_modalidad_patrullaje,
          id_camara: form.id_camara.map((c) => (c as any).value).join(","),
          fotos: fotos.map((f) => ({ base64_data: f.base64 })),
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
          router.replace("/principalmovilidad");
        }, 1200);
      } else {
        const errorData = await res.json();
        setLoading(false);
        Alert.alert(
          "Error",
          errorData.error || "No se pudo guardar el registro.",
        );
      }
    } catch (e) {
      clearInterval(interval);
      setLoading(false);
      Alert.alert("Error", "Error de conexión con el servidor.");
    }
  };
  // --- RENDER HELPERS ---
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
          onPress={() => setForm({ ...form, [field]: item.value })}
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

  // --- ESTILOS DINÁMICOS PARA MODO OSCURO ---
  const dynamicStyles = {
    card: {
      backgroundColor: "white",
    },
    textInput: {
      // El fondo es blanco, por lo tanto la letra DEBE ser negra
      backgroundColor: "white",

      color: "#000000",
      borderColor: isDark ? "#cccccc" : "#eeeeee",
    },
    label: {
      // Un gris oscuro para que sea legible sobre el fondo claro
      color: "#333333",
    },
    sectionTitle: {
      color: MJM_BLUE,
    },
    dropdown: {
      backgroundColor: "white",
      // CAMBIO AQUÍ: Tenías #ffffff (Blanco), por eso no se veía nada.
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
        ></ThemedText>
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
                                          UNIDAD ASIGNADA
                                        </ThemedText>
                                      </View>
                      
                                      {/* Si ya se registró la unidad (máximo 1), se bloquea el formulario de selección */}
                                      {form.vehiculos_detalle.length === 0 ? (
                                        <>
                                          {/* 1. SELECCIÓN DE TIPO DE VEHÍCULO (Siempre visible primero) */}
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
                                              fetchUnidades(v.value);
                                            }}
                                          />
                      
                                          {/* 2. LAS PLACAS Y OPCIONES SOLO APARECEN SI YA SE ELIGIÓ EL TIPO DE VEHÍCULO */}
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
                                                      style={[
                                                        styles.dropdown,
                                                        dynamicStyles.dropdown,
                                                      ]}
                                                      data={catalogos.pnps}
                                                      search
                                                      labelField="label"
                                                      valueField="value"
                                                      placeholder="Seleccionar Efectivo PNP"
                                                      value={unidadForm.id_pnp}
                                                      onChange={(v) =>
                                                        setUnidadForm({
                                                          ...unidadForm,
                                                          id_pnp: v.value,
                                                        })
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
                                        </>
                                      ) : null}
                      
                                      {/* 3. TARJETA DE LA UNIDAD REGISTRADA */}
                                      {form.vehiculos_detalle.length > 0 && (
                                        <View style={styles.listadoUnidadesContainer}>
                                          <View style={styles.listadoHeader}>
                                            <ThemedText style={styles.listadoTitle}>
                                              UNIDAD REGISTRADA EN EL REPORTE (1)
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
    max={getHoy()} // 👈 Usa la fecha local formateada, NO .toISOString()
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

          // Ajuste para evitar despasamientos de hora en la comparación de iOS
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
                alignItems: "center",
                gap: 6,
                marginVertical: 4,
              }}
            >
              <Ionicons name="location" size={18} color={MJM_BLUE} />
              <ThemedText
                style={{
                  fontSize: 10,
                  color: MJM_BLUE,
                  fontWeight: "bold",
                }}
              >
                LUGAR CONSOLIDADO (AV. , CA. , JR. , PSJ. , PQ. , PLZ. , EDF. , BLK.):
              </ThemedText>
            </View>
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

            {/* --- REFERENCIA --- */}
            <View style={{ marginTop: 20 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 5,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginVertical: 4,
                  }}
                >
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={MJM_BLUE}
                  />
                  <ThemedText
                    style={{
                      fontSize: 10,
                      color: MJM_BLUE,
                      fontWeight: "bold",
                    }}
                  >
                    REFERENCIA:
                  </ThemedText>
                </View>
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
                placeholder="Ej: A media cuadra del grifo Primax..."
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
  <ThemedText
              style={{
                fontSize: 10,
                color: MJM_BLUE,
                fontWeight: "bold",
              }}
            >
              MODALIDAD:
            </ThemedText>
            <Dropdown
              containerStyle={styles.dropdownContainer}
              selectedTextProps={{ numberOfLines: 1 }}
              selectedTextStyle={{
                color: "#000",
                fontSize: 14,
                flex: 1,
                marginRight: 15,
              }}
              style={[
                styles.dropdown,
                dynamicStyles.dropdown,
                getDynamicBorderStyle(form.id_modalidad),
              ]}
              data={catalogos.modalidades || []}
              value={form.id_modalidad}
              labelField="label"
              valueField="value"
              placeholder="Seleccione Modalidad"
              placeholderStyle={{ color: "#666", fontSize: 14 }}
              search
              searchPlaceholder="Buscar modalidad..."
              searchQuery={(keyword: string, label: string) => {
                const normalize = (text: string): string =>
                  text
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");

                const cleanLabel = normalize(label);
                const cleanKeyword = normalize(keyword);
                const keywords = cleanKeyword
                  .split(" ")
                  .filter((word) => word.length > 0);

                return keywords.every((word) => cleanLabel.includes(word));
              }}
              onFocus={() => {
                setForm((prev) => ({ ...prev, id_modalidad: "" }));
              }}
              onChange={(item) => {
                setForm((prev) => ({
                  ...prev,
                  id_modalidad: item.value,
                }));
              }}
              activeColor="#E3F2FD"
              flatListProps={{
                nestedScrollEnabled: true,
                keyboardShouldPersistTaps: "handled",
              }}
              inputSearchStyle={{
                height: 40,
                fontSize: 14,
                borderRadius: 8,
                color: "#000",
                paddingHorizontal: 10,
                backgroundColor: "#F9F9F9",
              }}
            />
            {/* DESCRIPCIÓN */}
            <View style={{ marginTop: 15, marginBottom: 10 }}>
              {/* Cabecera y Título */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginVertical: 4,
                }}
              >
                <Ionicons name="options-outline" size={14} color={MJM_BLUE} />
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
                  {modoBusquedaManual ? "BÚSQUEDA MANUAL" : "DATOS IMPORTANTES"}
                </ThemedText>
              </View>

             {/* BOTÓN INTERRUPTOR */}
<Pressable
  onPress={() => {
    const textoCentral = "Por orden de la central";
    const actual = form.descripcion || "";
    const estaActivo = actual.startsWith(textoCentral);

    if (estaActivo) {
      const limpio = actual
        .replace(textoCentral, "")
        .replace(/^[\n\r]+/, "")
        .trimStart();
      setForm({ ...form, descripcion: limpio });
    } else {
      const limpioActual = actual.trim();
      const capitalizadoActual =
        limpioActual.length > 0
          ? limpioActual.charAt(0).toUpperCase() + limpioActual.slice(1)
          : limpioActual;
      
      setForm({
        ...form,
        descripcion: capitalizadoActual.length === 0 ? textoCentral : `${textoCentral}\n${capitalizadoActual}`,
      });
    }
  }}
  style={{
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: (form.descripcion || "").startsWith(
      "Por orden de la central",
    )
      ? MJM_BLUE
      : "#E3F2FD",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 8,
    gap: 6,
  }}
>
  <Ionicons
    name={
      (form.descripcion || "").startsWith(
        "Por orden de la central",
      )
        ? "checkbox-outline"
        : "square-outline"
    }
    size={14}
    color={
      (form.descripcion || "").startsWith(
        "Por orden de la central",
      )
        ? "#FFF"
        : MJM_BLUE
    }
  />
  <ThemedText
    style={{
      fontSize: 10,
      fontWeight: "bold",
      color: (form.descripcion || "").startsWith(
        "Por orden de la central",
      )
        ? "#FFF"
        : MJM_BLUE,
    }}
  >
    POR ORDEN DE LA CENTRAL
  </ThemedText>
</Pressable>

{/* Contenedor Único con altura fija y scroll interno anti-desborde de cámara */}
<View
  style={[
    styles.textArea,
    dynamicStyles.textInput,
    {
      backgroundColor: "#FFFFFF",
      height: 140,
      maxHeight: 140,
      padding: 12,
      justifyContent: "flex-start",
      overflow: "hidden",
    },
    getDynamicBorderStyle((form.descripcion || "").length >= 3),
  ]}
>
  {/* 1. ETIQUETA FIJA SUPERIOR COMPACTA (Inborrable por teclado) */}
  {(() => {
    const desc = form.descripcion || "";
    const textoCentral = "Por orden de la central";
    const estaActivo = desc.startsWith(textoCentral);

    return (
      estaActivo && (
        <View 
          style={{ 
            alignSelf: "flex-start",
            backgroundColor: "#F1F5F9", 
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderRadius: 4,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: "#E2E8F0"
          }}
        >
          <ThemedText style={{ fontSize: 8, fontWeight: "bold", color: "#475569" }}>
            {textoCentral}
          </ThemedText>
        </View>
      )
    );
  })()}

  {/* 2. TEXTINPUT DE ESCRITURA LIBRE ABAJO */}
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
    placeholder="Escribe todos los detalles aquí..."
    placeholderTextColor="#999999"
    multiline={true}
    scrollEnabled={true}
    value={(() => {
      const desc = form.descripcion || "";
      const textoCentral = "Por orden de la central";
      const estaActivo = desc.startsWith(textoCentral);

      return estaActivo ? desc.replace(textoCentral, "").replace(/^[\n\r]+/, "") : desc;
    })()}
    onChangeText={(t) => {
      const desc = form.descripcion || "";
      const textoCentral = "Por orden de la central";
      const estaActivo = desc.startsWith(textoCentral);

      const textoCapitalizado =
        t.length > 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t;

      if (estaActivo) {
        setForm({
          ...form,
          descripcion: textoCapitalizado.length > 0 ? `${textoCentral}\n${textoCapitalizado}` : textoCentral,
        });
      } else {
        setForm({ ...form, descripcion: textoCapitalizado });
      }
    }}
  />
</View>

              {/* Contador de caracteres */}
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
                <ThemedText style={styles.btnCamText}></ThemedText>
              </Pressable>
              <Pressable
                style={[styles.btnCamAction, { backgroundColor: "#666" }]}
                onPress={seleccionarGaleria}
              >
                <Ionicons name="images" size={20} color="white" />
                <ThemedText style={styles.btnCamText}></ThemedText>
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

            {/* CAROUSEL DE FOTOS */}
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
            height: "auto", // Deja que el padding maneje la altura
            // Cambiado: siempre blanco, ignorando isDark
            backgroundColor: "white",
            // Borde sutil para que se vea sobre el fondo blanco
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
              // Si está deshabilitado, un gris; si no, el azul MJM_BLUE
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
                // El botón "Siguiente" mantiene su lógica de color
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

      {/* MODALES Y PICKERS */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {/* Forzamos el fondo blanco aquí directamente */}
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
              /* Icono de éxito en azul para resaltar sobre el blanco */
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
});
