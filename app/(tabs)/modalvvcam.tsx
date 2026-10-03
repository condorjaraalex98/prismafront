import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
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
interface RegistroProps {
  visible: boolean;
  onClose: () => void;
  initialData?: any;
}

export default function RegistroOcurrencia({
  visible,
  onClose,
  initialData,
}: RegistroProps) {
  useEffect(() => {
    if (visible && initialData && !form.id_lugar) {
      setForm((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [visible]);
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

const limpiarFormulario = () => {
    // 1. Liberar memoria web de todas las fotos activas antes de vaciar el estado
    fotos.forEach((f) => liberarUriPreview(f.uri)); 
    setFotos([]);
    
    // 2. Restablecer el formulario a su estado inicial
    setForm({
      id_usuario: userData?.id || (userData as any)?.id_usuario || null,
      id_lugar: null,
      id_modalidad: "",
      id_origen: "1",
      id_tipo_patrullaje: "7",
      id_modalidad_patrullaje: "6",
      vehiculos_detalle: [],
      id_personal_operativo: [],
      id_camara: [],
      descripcion: "",
      hora_alerta: "",
      hora_llegada: "",
      hora_repliegue: "",
      latitud_gps: "0",
      longitud_gps: "0",
      turno: null,
      nombre_punto_gps: "",
      estadoOcurrencia: "PENDIENTE",
      referencia: "",
      detalle_llamada: { numero_telefono: "", nombre_informante: "" },
      unidad_encargada: "SERENAZGO",
      fecha_evento: getHoy(),
      grupo: null,
    });
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
  const [derivarUnidad, setDerivarUnidad] = useState(false);
  const [tiposVia, setTiposVia] = useState([]);
  const [vias, setVias] = useState([]);
  const [cuadras, setCuadras] = useState([]);
  const [selTipoVia, setSelTipoVia] = useState<any>(null);
  const [selVia, setSelVia] = useState<any>(null);
  const normalize = (text: string): string =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
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
    id_personal_operativo: [],
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

  const ESTADO_INICIAL = {
    id_usuario: null,
    id_lugar: null,
    id_modalidad: "",
    id_origen: "1",
    id_tipo_patrullaje: "7",
    id_modalidad_patrullaje: "6",
    vehiculos_detalle: [],
    id_personal_operativo: [],
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
    detalle_llamada: { numero_telefono: "", nombre_informante: "" },
    unidad_encargada: "SERENAZGO",
    fecha_evento: new Date().toISOString().split("T")[0],
    grupo: null,
  };

  const [form, setForm] = useState({
    id_usuario: null,
    id_lugar: null,
    id_modalidad: "",
    id_origen: "1",
    id_tipo_patrullaje: "7",
    id_modalidad_patrullaje: "6",
    vehiculos_detalle: [] as any[],
    id_personal_operativo: [] as any[],
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
    detalle_llamada: { numero_telefono: "", nombre_informante: "" },
    unidad_encargada: "SERENAZGO",
    fecha_evento: getHoy(),
    grupo: null,
  });
  const [showPersonalDropdown, setShowPersonalDropdown] = useState(false);
  const [searchFocus, setSearchFocus] = useState<string | null>(null);

  const validation: Record<string, boolean> = {
    step1: !!form.grupo && form.id_camara.length > 0 &&!!form.turno ,
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

      // Permitir igualdad estricta en la secuencia cronológica
      const ordenValido = tA <= tL && tL <= tR;

      const diffAlertaLlegada = tL - tA;
      const diffLlegadaRepliegue = tR - tL;
      const duracionTotal = tR - tA;

      // Permite tramos de 0 minutos (cuando son iguales) hasta un máximo de 720 minutos (12 horas)
      const tramo1Valido = diffAlertaLlegada >= 0 && diffAlertaLlegada <= 720;
      const tramo2Valido =
        diffLlegadaRepliegue >= 0 && diffLlegadaRepliegue <= 720;
      const totalValido = duracionTotal >= 0 && duracionTotal <= 720;

      const hayError = !(
        ordenValido &&
        tramo1Valido &&
        tramo2Valido &&
        totalValido
      );
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
  const canAdvance = () => {
    if (step === 1) {
      const hasBasics = !!form.grupo;

      if (!hasBasics) {
        Alert.alert(
          "Atención",
          "Debe seleccionar al menos una cámara para continuar.",
        );
      }

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

      const alerta = aMinutos(hora_alerta);
      let llegada = aMinutos(hora_llegada);
      let repliegue = aMinutos(hora_repliegue);

      // 1. Si la llegada es menor que la alerta, cruzó al día siguiente
      if (llegada < alerta) {
        llegada += 1440; // 24 * 60
      }

      // 2. Si el repliegue es menor o igual a la llegada (o menor que la alerta),
      // significa que el repliegue ocurrió en la madrugada del día siguiente.
      if (repliegue <= llegada || repliegue < alerta) {
        repliegue += 1440;
      }

      // 3. Validar orden cronológico estricto: Alerta <= Llegada <= Repliegue
      const ordenValido = alerta <= llegada && llegada <= repliegue;

      // 4. Validar que la duración total entre Alerta y Repliegue NO supere las 12 horas (720 min)
      const duracion = repliegue - alerta;
      const limiteValido = duracion > 0 && duracion <= 720;

      // Retorna TRUE si HAY UN ERROR (para activar el aviso rojo)
      const hayError = !(ordenValido && limiteValido);
      return hayError;
    }

     if (step === 3) return !!form.id_lugar && form.referencia.length > 3;
    if (step === 4) return !!form.id_modalidad && form.descripcion.length > 3;
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

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (selectedDate) {
      const fechaStr = selectedDate.toISOString().split("T")[0];

      if (Platform.OS === "android") {
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
        setTimeout(() => {
          setForm((f) => ({ ...f, [activeField!]: horaStr }));
          setActiveField(null);
        }, 100);
      } else {
        setForm((f) => ({ ...f, [activeField!]: horaStr }));
      }
    }

    if (Platform.OS === "ios") {
      setTempDate(selectedTime || new Date());
    }
  };

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

  useEffect(() => {
    if (userData)
      setForm((prev) => ({
        ...prev,
        id_usuario: userData.id || (userData as any).id_usuario,
      }));
    setForm((prev) => ({ ...prev, fecha_evento: getHoy() }));
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
        fetch(`${API_URL}/catalogos/completo/unificadov?tipoLugar=4`),
        fetch(`${API_URL}/catalogos/tipos-vehiculo`),
        fetch(`${API_URL}/catalogos/pnp-activos`),
      ]);

      const data = await resGral.json();
      const dataTiposV = await resTiposV.json();
      const dataPnps = await resPnps.json();

      const miId =
        userData?.id ||
        (userData as any)?.id_persona ||
        (userData as any)?.id_usuario;

      setCatalogos({
        usuarios: data.usuarios || [],
        modalidades: data.modalidades || [],
        origenes: data.origenes || [],
        camaras: data.camaras || [],
        tipos_patrullaje: data.tipos_patrullaje || [],
        modalidades_patrullaje: data.modalidades_patrullaje || [],

        id_personal_operativo: (data.personal_operativo || []).filter(
          (persona: any) => Number(persona.value) !== Number(miId),
        ),

        tipos_vehiculo: dataTiposV || [],
        unidades: [],
        pnps: dataPnps || [],
        lugares: data.lugares || [],
      });

      if (data.tipos_via) setTiposVia(data.tipos_via);
    } catch (err) {
      console.error("Error al cargar datos:", err);
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

    setForm((f) => ({
      ...f,
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
  const idFinal = form.id_usuario || userData?.id || (userData as any)?.id_usuario;

  if (!idFinal) {
    Alert.alert("Atención", "No se pudo identificar al usuario.");
    return;
  }

  // 1. Asegurar que las fotos ya terminaron de subir (si usas subida en segundo plano)
  const fotosPendientes = fotos.some((f) => f.uploading);
  if (fotosPendientes) {
    return Alert.alert("Espere", "Las fotos aún se están subiendo a la nube.");
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
    // 2. Extraer SOLAMENTE las URLs remotas limpias (evita enviar base64)
    const urlsFotosFinales = fotos
      .map((f) => f.url_remota)
      .filter((url): url is string => url !== null);

    const bodyEnviar = {
      ...form,
      id_usuario: Number(idFinal),
      id_tipop: form.id_tipo_patrullaje,
      id_modalidadp: form.id_modalidad_patrullaje,
      id_personal_ids: form.id_personal_operativo.map((p) => Number(p.value)),
      id_camara: form.id_camara.map((c) => c.value).join(","),
      detalle_llamada: form.detalle_llamada,
      fotos: urlsFotosFinales, // 👈 ¡Aquí van solo las URLs cortas, no el Base64!
    };

    const res = await fetch(`${API_URL}/ocurrencias/registrar/modr2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyEnviar),
    });

    clearInterval(interval);

    if (res.ok) {
      setUploadProgress(100);
      setUploadStatus("¡Listo! Guardado");
      setIsFinished(true);

      setTimeout(() => {
        setForm(ESTADO_INICIAL);
        setFotos([]);
        setLoading(false);
         limpiarFormulario();
       
        onClose();
        router.replace("/cecomdoceh");
      }, 2000);
    } else {
      const errorData = await res.json();
      clearInterval(interval);
      setLoading(false);
      Alert.alert("Error", errorData.error || "No se pudo guardar.");
    }
  } catch (e) {
    clearInterval(interval);
    setLoading(false);
    console.error("Error de conexión:", e);
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
          onPress={() => setForm({ ...form, [field]: item.value })}
          style={[
            styles.mosaicoItem,
            currentId === item.value && styles.mosaicoSelected,
          ]}
        >
          <Ionicons
            name={iconDefault as any}
            size={15}
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
    <ThemedView style={styles.mainContainer}>
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Cabecera del Modal */}
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>VV. CÁMARA</ThemedText>
              <Pressable onPress={onClose}>
                <Ionicons name="close-circle" size={30} color="#666" />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollForm}
            >
              <View style={styles.newStepperContainer}>
                {[1, 2, 3, 4].map((i) => {
                  const estaListo = validation[`step${i}`];

                  return (
                    <View key={i} style={styles.stepWrapper}>
                      {/* CÍRCULO: Se pinta de azul sólido si está listo, o queda con borde azul si falta */}
                      <View
                        style={[
                          styles.circleMain,
                          estaListo
                            ? styles.circleComplete
                            : styles.circlePending,
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.stepNumber,
                            { color: estaListo ? "white" : "#024885" },
                          ]}
                        >
                          {i}
                        </ThemedText>
                      </View>

                      {/* LÍNEA: También se pinta de azul si el paso está completado */}
                      {i < 4 && (
                        <View
                          style={[
                            styles.connectorLine,
                            estaListo && { backgroundColor: "#024885" },
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
              {/* CABECERA ESTÁTICA */}

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollWeb}
                horizontal={false}
              >
                <View style={styles.webGridContainer}>
                  {/* COLUMNA 1: DESPACHO */}
                  <View style={styles.webColumn}>
                    <View style={styles.headerStepWeb}>
                      <Ionicons name="megaphone" size={18} color="white" />
                      <ThemedText style={styles.headerStepText}>
                        1. DESPACHO Y PERSONAL
                      </ThemedText>
                    </View>
                    <View style={styles.columnBody}>
                      {/* step1 */}
                      <View style={styles.cascadaContainer}>
                        <ThemedText
                          style={{
                            fontSize: 10,
                            color: MJM_BLUE,
                            fontWeight: "bold",
                          }}
                        >
                          PERSONAL REPORTANDO:{" "}
                        </ThemedText>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 10,
                          }}
                        >
                          <View
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor:  "#f0f0f0",
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              height: 45,
                              borderWidth: 1,
                              borderColor: isDark ? "#444" : "#ddd",
                            }}
                          >
                            <Ionicons
                              name="person-circle"
                              size={20}
                              color={MJM_BLUE}
                            />
                            <ThemedText
                              numberOfLines={1}
                              style={{
                                flex: 1,
                                marginLeft: 8,
                                fontSize: 13,
                                color: isDark ? "#aaa" : "#666",
                              }}
                            >
                              {`${userData?.apellido_paterno || ""} ${userData?.apellido_materno || ""}, ${userData?.nombres || ""}`}{" "}
                              (TÚ)
                            </ThemedText>
                            <Ionicons
                              name="lock-closed"
                              size={12}
                              color="#999"
                            />
                          </View>
                          {/* BOTÓN QUE ACTIVA/DESACTIVA EL DROPDOWN */}
                          <Pressable
                            onPress={() =>
                              setShowPersonalDropdown(!showPersonalDropdown)
                            }
                            style={({ pressed }) => ({
                              backgroundColor: showPersonalDropdown
                                ? "#E53935"
                                : MJM_BLUE,
                              width: 45,
                              height: 45,
                              borderRadius: 10,
                              justifyContent: "center",
                              alignItems: "center",
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Ionicons
                              name={
                                showPersonalDropdown ? "close" : "person-add"
                              }
                              size={20}
                              color="white"
                            />
                          </Pressable>
                        </View>

                        {/* SELECTOR DE APOYO MEJORADO CON BÚSQUEDA FLEXIBLE */}
                        {showPersonalDropdown && (
                          <Dropdown
                            containerStyle={styles.dropdownContainer}
                            itemTextStyle={styles.itemText}
                            itemContainerStyle={styles.itemContainer}
                            style={[
                              styles.inputShared,
                              { borderColor: MJM_BLUE },
                            ]}
                            data={catalogos.id_personal_operativo}
                            search
                            labelField="label"
                            valueField="value"
                            placeholder="Agregar personal de apoyo"
                            searchPlaceholder="Escribe iniciales o apellidos..."
                            searchQuery={(keyword, label) => {
                              const cleanLabel = label.toLowerCase();
                              const searchTerms = keyword
                                .toLowerCase()
                                .trim()
                                .split(/\s+/);

                              return searchTerms.every((term) =>
                                cleanLabel.includes(term),
                              );
                            }}
                            onChange={(item) => {
                              if (
                                !form.id_personal_operativo.find(
                                  (p) => p.value === item.value,
                                )
                              ) {
                                setForm((prev) => ({
                                  ...prev,
                                  id_personal_operativo: [
                                    ...prev.id_personal_operativo,
                                    item,
                                  ],
                                }));
                              }
                              setShowPersonalDropdown(false);
                            }}
                            renderLeftIcon={() => (
                              <Ionicons
                                name="search"
                                size={18}
                                color={MJM_BLUE}
                              />
                            )}
                          />
                        )}

                        {/* CHIPS DE PERSONAL SELECCIONADO */}
                        <View style={styles.chipsRow}>
                          {form.id_personal_operativo.map((p) => (
                            <Pressable
                              key={p.value}
                              style={[
                                styles.chip,
                                { backgroundColor: "#2E7D32", marginBottom: 5 },
                              ]}
                              onPress={() => {
                                setForm((f) => ({
                                  ...f,
                                  id_personal_operativo:
                                    f.id_personal_operativo.filter(
                                      (x) => x.value !== p.value,
                                    ),
                                }));
                              }}
                            >
                              <ThemedText style={styles.chipText}>
                                {p.label}
                              </ThemedText>
                              <Ionicons
                                name="close-circle"
                                size={14}
                                color="white"
                              />
                            </Pressable>
                          ))}
                        </View>

                        {/* ... Resto de Grupos y Cámaras ... */}
                        <ThemedText
                          style={{
                            fontSize: 10,
                            color: MJM_BLUE,
                            fontWeight: "bold",
                          }}
                        >
                          GRUPO:{" "}
                        </ThemedText>
                        <View style={{ marginBottom: 15 }}>
                          {renderMosaicos(
                            [
                              { label: "G1", value: "1" },
                              { label: "G2", value: "2" },
                              { label: "G3", value: "3" },
                              { label: "G4", value: "4" },
                            ],
                            form.grupo,
                            "grupo",
                            "people-outline",
                          )}
                        </View>
      <ThemedText
                          style={{
                            fontSize: 10,
                            color: MJM_BLUE,
                            fontWeight: "bold",
                          }}
                        >
                       ¿A QUÉ TURNO PERTENECE ESTE REPORTE?{" "}
                        </ThemedText>
                    <View style={{ marginBottom: 15 }}>
  {renderMosaicos(
    [
      { label: "MAÑANA", value: "M", icon: "sunny-outline" },    // Ícono de sol
      { label: "TARDE", value: "T", icon: "partly-sunny-outline" }, // Ícono de tarde/sol parcial
      { label: "NOCHE", value: "N", icon: "moon-outline" },      // Ícono de luna
    ],
    form.turno,
    "turno",
    "time-outline" // Este quedará como respaldo por si alguno no tuviera icono
  )}
</View>
                        <View style={styles.sectionContainer}>
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
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <Ionicons
                                name="person-circle"
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
                                CÁMARA MONITOREADA:
                              </ThemedText>
                            </View>
                            {/* CÁMARA MONITOREADA CON BÚSQUEDA FLEXIBLE */}
                            <Dropdown
                              containerStyle={styles.dropdownContainer}
                              itemTextStyle={styles.itemText}
                              itemContainerStyle={styles.itemContainer}
                              style={[styles.dropdown, dynamicStyles.dropdown]}
                              data={catalogos.camaras}
                              search
                              labelField="label"
                              valueField="value"
                              value={null}
                              placeholder="Seleccionar cámara..."
                              searchQuery={(keyword, label) => {
                                const cleanLabel = label.toLowerCase();
                                const searchTerms = keyword
                                  .toLowerCase()
                                  .trim()
                                  .split(/\s+/);
                                return searchTerms.every((term) =>
                                  cleanLabel.includes(term),
                                );
                              }}
                              onChange={(item) => {
                                if (
                                  !form.id_camara.find(
                                    (c) => c.value === item.value,
                                  )
                                ) {
                                  setForm((prev) => ({
                                    ...prev,
                                    id_camara: [...prev.id_camara, item],
                                  }));
                                }
                              }}
                              renderLeftIcon={() => (
                                <Ionicons
                                  name="videocam-outline"
                                  size={18}
                                  color={MJM_BLUE}
                                  style={{ marginRight: 8 }}
                                />
                              )}
                            />
                            <View style={styles.chipsRow}>
                              {form.id_camara.map((c) => (
                                <Pressable
                                  key={c.value}
                                  style={styles.chip}
                                  onPress={() =>
                                    setForm((f) => ({
                                      ...f,
                                      id_camara: f.id_camara.filter(
                                        (x) => x.value !== c.value,
                                      ),
                                    }))
                                  }
                                >
                                  <ThemedText style={styles.chipText}>
                                    {c.label}
                                  </ThemedText>
                                  <Ionicons
                                    name="close-circle"
                                    size={14}
                                    color="white"
                                  />
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* COLUMNA 2: TEMPORALIDAD */}
                  <View style={styles.webColumn}>
                    <View style={styles.headerStepWeb}>
                      <Ionicons name="time" size={18} color="white" />
                      <ThemedText style={styles.headerStepText}>
                        2. TEMPORALIDAD
                      </ThemedText>
                    </View>
                    <View style={styles.columnBody}>
                      <View style={styles.cascadaContainer}>
                        {/* Cabecera Fecha */}
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 10,
                          }}
                        >
                          <ThemedText
                            style={{
                              fontSize: 10,
                              color: MJM_BLUE,
                              fontWeight: "bold",
                            }}
                          >
                            FECHA:
                          </ThemedText>
                          <Pressable
                            onPress={() =>
                              setForm({ ...form, fecha_evento: getHoy() })
                            }
                            style={{
                              backgroundColor: MJM_BLUE,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 6,
                            }}
                          >
                            <ThemedText
                              style={{
                                color: "white",
                                fontSize: 11,
                                fontWeight: "bold",
                              }}
                            >
                              PONER HOY
                            </ThemedText>
                          </Pressable>
                        </View>

                        {/* Selector de Fecha Web / Móvil */}
                        <View>
                          {Platform.OS === "web" ? (
                            <View style={{ width: "100%" }}>
                              <input
                                type="date"
                                value={form.fecha_evento}
                                max={new Date().toISOString().split("T")[0]} // 👈 Validación para bloquear fechas futuras en la web
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    fecha_evento: e.target.value,
                                  })
                                }
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
                                setTempDate(
                                  new Date(form.fecha_evento + "T12:00:00"),
                                );
                                setShowPicker(true);
                              }}
                              style={[
                                styles.inputShared,
                                { borderColor: MJM_BLUE },
                                getDynamicBorderStyle(form.fecha_evento),
                              ]}
                            >
                              <Ionicons
                                name="calendar-outline"
                                size={20}
                                color={MJM_BLUE}
                              />
                              <ThemedText
                                style={{
                                  color: "#000",
                                  marginLeft: 10,
                                  flex: 1,
                                }}
                              >
                                {formatearFechaEspañol(form.fecha_evento)}
                              </ThemedText>
                              <Ionicons
                                name="chevron-down"
                                size={18}
                                color="#ccc"
                              />
                            </Pressable>
                          )}
                        </View>

                        {/* Mapeo de Horas */}
                        <View>
                          {(
                            [
                              "hora_alerta",
                              "hora_llegada",
                              "hora_repliegue",
                            ] as const
                          ).map((k) => (
                            <View key={k} style={{ marginTop: 15 }}>
                              <ThemedText
                                style={{
                                  fontSize: 10,
                                  color: MJM_BLUE,
                                  fontWeight: "bold",
                                }}
                              >
                                {k.toUpperCase().replace("_", " ")}
                              </ThemedText>

                              <View style={styles.timeRow}>
                                {Platform.OS === "web" ? (
                                  <View style={{ flex: 1 }}>
                                    <input
                                      type="time"
                                      value={(form as any)[k]}
                                      onChange={(e) =>
                                        setForm({
                                          ...form,
                                          [k]: e.target.value,
                                        })
                                      }
                                      style={{
                                        width: "100%",
                                        maxWidth: 400,
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
                                      setActiveField(k);
                                      const currentTime = (form as any)[k];
                                      const date = new Date();
                                      if (
                                        currentTime &&
                                        currentTime !== "00:00"
                                      ) {
                                        const [hours, minutes] =
                                          currentTime.split(":");
                                        date.setHours(
                                          parseInt(hours),
                                          parseInt(minutes),
                                        );
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
                                    <ThemedText
                                      style={{ color: "#000", marginLeft: 10 }}
                                    >
                                      {formatearHora24h((form as any)[k]) ||
                                        "00:00"}
                                    </ThemedText>
                                  </Pressable>
                                )}
                                <Pressable
                                  style={styles.btnTime}
                                  onPress={() => capturarHoraActual(k)}
                                >
                                  <Ionicons
                                    name="flash"
                                    size={20}
                                    color="white"
                                  />
                                </Pressable>
                              </View>
                            </View>
                          ))}
                        </View>

                        {/* Alerta de validación condicional */}
                        <View>
                          {form.hora_alerta &&
                          form.hora_llegada &&
                          form.hora_repliegue &&
                          !validation.step2 ? (
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
                                  style={{
                                    color: "#555",
                                    fontSize: 11,
                                    marginBottom: 2,
                                  }}
                                >
                                  • El orden debe ser: Repliegue ≥ Llegada ≥
                                  Alerta.
                                </ThemedText>

                                <ThemedText
                                  style={{ color: "#555", fontSize: 11 }}
                                >
                                  • La duración total entre Alerta y Repliegue
                                  no debe superar las 12 horas.
                                </ThemedText>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* COLUMNA 3: UBICACIÓN */}
                  <View style={styles.webColumn}>
                    <View style={styles.headerStepWeb}>
                      <Ionicons name="location-sharp" size={18} color="white" />
                      <ThemedText style={styles.headerStepText}>
                        3. UBICACIÓN
                      </ThemedText>
                    </View>
                    <View style={styles.columnBody}>
                      <View style={styles.cascadaContainer}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 15,
                          }}
                        >
                          <ThemedText
                            style={{
                              fontSize: 10,
                              color: MJM_BLUE,
                              fontWeight: "bold",
                            }}
                          >
                            LUGAR CONSOLIDADO (AV, CA, JR, PSJ, PQ, PLZ, EDF,
                            BLK):
                          </ThemedText>
                        </View>

                        {!modoBusquedaManual && (
                          <View style={{ marginBottom: 10 }}>
                            <Dropdown
                              containerStyle={styles.dropdownContainer}
                              itemTextStyle={[
                                styles.itemText,
                                { color: "#000" },
                              ]}
                              selectedTextStyle={{
                                color: "#000",
                                fontSize: 14,
                              }}
                              itemContainerStyle={styles.itemContainer}
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
                                const searchTerms = cleanKeyword
                                  .trim()
                                  .split(/\s+/);

                                return searchTerms.every((term) =>
                                  cleanLabel.includes(term),
                                );
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
                        )}

                        {/* REFERENCIA */}
                        <View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginBottom: 5,
                            }}
                          >
                            <ThemedText
                              style={{
                                fontSize: 10,
                                color: MJM_BLUE,
                                fontWeight: "bold",
                              }}
                            >
                              REFERENCIA / INTERSECCIÓN:{" "}
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
                                  form.referencia.length >= 3
                                    ? MJM_BLUE
                                    : "#DDD",
                                borderRadius: 10,
                              },
                            ]}
                            placeholder="Ej: A media cuadra del ..."
                            placeholderTextColor="#AAA"
                            value={form.referencia}
                            onChangeText={(t) => {
                              const capitalizedText =
                                t.charAt(0).toUpperCase() + t.slice(1);
                              setForm({ ...form, referencia: capitalizedText });
                            }}
                            autoCapitalize="sentences"
                            multiline
                          />
                        </View>

                        {/* UNIDAD / DERIVACIÓN */}
                        <View
                          style={{
                            marginTop: 10,
                            marginBottom: 15,
                            backgroundColor: "#f9f9f9",
                            padding: 12,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: "#ddd",
                          }}
                        >
                          <ThemedText
                            style={{
                              fontSize: 10,
                              color: MJM_BLUE,
                              fontWeight: "bold",
                            }}
                          >
                            UNIDAD PRINCIPAL:{" "}
                          </ThemedText>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              height: 40,
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              backgroundColor: MJM_BLUE,
                              marginBottom: 12,
                            }}
                          >
                            <Ionicons
                              name="checkbox"
                              size={20}
                              color="white"
                              style={{ marginRight: 8 }}
                            />
                            <ThemedText
                              style={{
                                fontSize: 12,
                                fontWeight: "bold",
                                color: "white",
                              }}
                            >
                              Serenazgo
                            </ThemedText>
                          </View>

                          <Pressable
                            onPress={() => {
                              const nuevoEstado = !derivarUnidad;
                              setDerivarUnidad(nuevoEstado);
                              if (!nuevoEstado) {
                                setForm((f) => ({
                                  ...f,
                                  unidad_encargada: "SERENAZGO",
                                }));
                              } else {
                                setForm((f) => ({
                                  ...f,
                                  unidad_encargada: "FISCALIZACION",
                                }));
                              }
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              paddingTop: 4,
                            }}
                          >
                            <Ionicons
                              name={
                                derivarUnidad ? "checkbox" : "square-outline"
                              }
                              size={22}
                              color={MJM_BLUE}
                            />
                            <View style={{ flex: 1 }}>
                              <ThemedText
                                style={{
                                  fontSize: 12,
                                  fontWeight: "bold",
                                  color: MJM_BLUE,
                                }}
                              >
                                ¿Derivar esta ocurrencia a otra área?
                              </ThemedText>
                            </View>
                          </Pressable>

                          {derivarUnidad && (
                            <View
                              style={{
                                marginTop: 12,
                                borderTopWidth: 1,
                                borderTopColor: "#eee",
                                paddingTop: 10,
                              }}
                            >
                              <ThemedText
                                style={{
                                  fontSize: 10,
                                  fontWeight: "bold",
                                  color: "#555",
                                  marginBottom: 8,
                                }}
                              >
                                SELECCIONE EL ÁREA DESTINO:
                              </ThemedText>

                              <View style={{ flexDirection: "row", gap: 8 }}>
                                <Pressable
                                  onPress={() =>
                                    setForm((f) => ({
                                      ...f,
                                      unidad_encargada: "FISCALIZACION",
                                    }))
                                  }
                                  style={[
                                    {
                                      flex: 1,
                                      height: 40,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: "#ccc",
                                      backgroundColor: "white",
                                      justifyContent: "center",
                                      alignItems: "center",
                                    },
                                    form.unidad_encargada ===
                                      "FISCALIZACION" && {
                                      backgroundColor: MJM_BLUE,
                                      borderColor: MJM_BLUE,
                                    },
                                  ]}
                                >
                                  <ThemedText
                                    style={{
                                      fontSize: 11,
                                      fontWeight: "bold",
                                      textAlign: "center",
                                      color:
                                        form.unidad_encargada ===
                                        "FISCALIZACION"
                                          ? "white"
                                          : "#333",
                                    }}
                                  >
                                    Fiscalización
                                  </ThemedText>
                                </Pressable>

                                <Pressable
                                  onPress={() =>
                                    setForm((f) => ({
                                      ...f,
                                      unidad_encargada: "CONTROL URBANO",
                                    }))
                                  }
                                  style={[
                                    {
                                      flex: 1,
                                      height: 40,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: "#ccc",
                                      backgroundColor: "white",
                                      justifyContent: "center",
                                      alignItems: "center",
                                    },
                                    form.unidad_encargada ===
                                      "CONTROL URBANO" && {
                                      backgroundColor: MJM_BLUE,
                                      borderColor: MJM_BLUE,
                                    },
                                  ]}
                                >
                                  <ThemedText
                                    style={{
                                      fontSize: 11,
                                      fontWeight: "bold",
                                      textAlign: "center",
                                      color:
                                        form.unidad_encargada ===
                                        "CONTROL URBANO"
                                          ? "white"
                                          : "#333",
                                    }}
                                  >
                                    Control Urbano
                                  </ThemedText>
                                </Pressable>

                                <Pressable
                                  onPress={() =>
                                    setForm((f) => ({
                                      ...f,
                                      unidad_encargada: "LIMPIEZA PUBLICA",
                                    }))
                                  }
                                  style={[
                                    {
                                      flex: 1,
                                      height: 40,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: "#ccc",
                                      backgroundColor: "white",
                                      justifyContent: "center",
                                      alignItems: "center",
                                    },
                                    form.unidad_encargada ===
                                      "LIMPIEZA PUBLICA" && {
                                      backgroundColor: MJM_BLUE,
                                      borderColor: MJM_BLUE,
                                    },
                                  ]}
                                >
                                  <ThemedText
                                    style={{
                                      fontSize: 11,
                                      fontWeight: "bold",
                                      textAlign: "center",
                                      color:
                                        form.unidad_encargada ===
                                        "LIMPIEZA PUBLICA"
                                          ? "white"
                                          : "#333",
                                    }}
                                  >
                                    Limpieza Pública
                                  </ThemedText>
                                </Pressable>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* COLUMNA 4: CIERRE Y EVIDENCIA */}
                  <View style={styles.webColumn}>
                    <View style={styles.headerStepWeb}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="white"
                      />
                      <ThemedText style={styles.headerStepText}>
                        4. CIERRE DE REGISTRO
                      </ThemedText>
                    </View>
                    <View style={styles.columnBody}>
                      <View style={styles.cascadaContainer}>
                        <ThemedText
                          style={{
                            fontSize: 10,
                            color: MJM_BLUE,
                            fontWeight: "bold",
                          }}
                        >
                          MODALIDAD:{" "}
                        </ThemedText>
                        <Dropdown
                          containerStyle={styles.dropdownContainer}
                          itemTextStyle={[styles.itemText, { color: "#000" }]}
                          itemContainerStyle={styles.itemContainer}
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

                            return keywords.every((word) =>
                              cleanLabel.includes(word),
                            );
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
                          <ThemedText
                            style={{
                              fontSize: 10,
                              color: MJM_BLUE,
                              fontWeight: "bold",
                            }}
                          >
                            DATOS IMPORTANTES:{" "}
                          </ThemedText>
                          <TextInput
                            style={[
                              styles.textArea,
                              dynamicStyles.textInput,
                              {
                                backgroundColor: "#FFFFFF",
                                color: "#000000",
                                minHeight: 120,
                                textAlignVertical: "top",
                                padding: 12,
                                fontSize: 14,
                              },
                              getDynamicBorderStyle(
                                form.descripcion.length >= 3,
                              ),
                            ]}
                            placeholder="Escribe todos los detalles aquí..."
                            placeholderTextColor="#999999"
                            multiline={true}
                            autoCapitalize="sentences"
                            value={form.descripcion}
                            onChangeText={(t) => {
                              const capitalizedText =
                                t.charAt(0).toUpperCase() + t.slice(1);
                              setForm({
                                ...form,
                                descripcion: capitalizedText,
                              });
                            }}
                          />
                          <ThemedText
                            style={{
                              fontSize: 10,
                              textAlign: "right",
                              marginTop: 2,
                              color: "#888",
                            }}
                          >
                            {`${form.descripcion.length} caracteres`}
                          </ThemedText>
                        </View>

                        {/* ACCIONES DE FOTOS (Etiqueta vacía eliminada) */}
                        <View style={[styles.photoActions, { marginTop: 5 }]}>
                          <Pressable
                            style={[
                              styles.btnCamAction,
                              { backgroundColor: "#024885" },
                            ]}
                            onPress={seleccionarGaleria}
                          >
                            <Ionicons name="images" size={20} color="white" />
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
                            keyboardShouldPersistTaps="handled"
                            horizontal
                            style={[styles.photoCarousel, { maxHeight: 100 }]}
                            showsHorizontalScrollIndicator={false}
                          >
                            {fotos.map((f, i) => (
                              <View key={i} style={styles.photoWrapper}>
                                <Image
                                  source={{ uri: f.uri }}
                                  style={styles.photoThumb}
                                />
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
                              backgroundColor: formCompleto
                                ? "#2E7D32"
                                : "#A0A0A0",
                              opacity: formCompleto ? 1 : 0.6,
                            },
                          ]}
                          onPress={enviarRegistro}
                          disabled={!formCompleto || loading}
                        >
                          <ThemedText
                            style={{ color: "white", fontWeight: "bold" }}
                          >
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
                <ThemedText
                  style={{
                    marginTop: 10,
                    fontSize: 16,
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  {uploadStatus}
                </ThemedText>

                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${uploadProgress}%` },
                    ]}
                  />
                </View>

                <ThemedText
                  style={{ marginTop: 8, fontSize: 12, color: "#666" }}
                >
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

export const styles = StyleSheet.create({
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
  main: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 15,
    paddingBottom: 100,
  },
  sectionContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
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
    alignItems: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    width: Platform.OS === "web" ? "92%" : "95%",
    maxHeight: "90%", // Cambiado de height: "99%" a maxHeight para adaptarse al espacio disponible
    borderRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    overflow: "hidden",
  },
columnLayout: {
  flexDirection: "row",
  justifyContent: "space-between",
  width: "100%",
  gap: 10,                 // Espaciado dinámico entre columnas
},
cardItem: {
  flex: 1,                 // Obliga a las 4 tarjetas a repartirse el espacio disponible por igual
  minWidth: 200,           // Evita que se aplasten demasiado
},
  confirmModalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  confirmModalContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    width: "80%",
    maxWidth: 300,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalCenterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalPickerContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "85%",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  pickerTitle: {
    fontWeight: "bold",
    marginBottom: 15,
    color: MJM_BLUE,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f4f7f6",
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
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  footer: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
    marginLeft: 4,
  },
  inputBase: {
    height: 45,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  input: {
    height: 48,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: "#333",
  },
  disabledInput: {
    backgroundColor: "#f8f9fa",
    color: "#aaa",
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },
  fieldContainer: {
    marginBottom: 15,
    width: "100%",
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
  dropdownContainer: {
    borderRadius: 10,
    overflow: "hidden",
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
  itemContainer: {
    paddingVertical: 2,
  },
  itemText: {
    fontSize: 12,
    color: "#333",
  },
  selectedTextStyle: {
    fontSize: 14,
    color: "#000",
    marginLeft: 10,
    flex: 1,
    marginRight: 35,
    flexWrap: "nowrap",
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
    borderRadius: 8,
    color: "black",
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
  stepperContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 12,
    gap: 12,
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
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
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

  chipsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  chip: {
    backgroundColor: MJM_BLUE,
    padding: 8,
    borderRadius: 15,
    gap: 5,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
  },
  chipText: {
    color: "white",
    fontSize: 12,
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
  cascadaContainer: {
    marginTop: 15,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F9FBFF",
    borderWidth: 1,
    borderColor: "#E1E8F5",
  },
  cascadaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  cascadaTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: MJM_BLUE,
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
  listadoUnidadesContainer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 15,
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
  asignacionContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "space-between",
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
  asignacionText: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    color: MJM_BLUE,
  },
  btnAddUnit: {
    backgroundColor: MJM_BLUE,
    padding: 10,
    borderRadius: 10,
  },
  btnInsertar: {
    backgroundColor: MJM_BLUE,
    flexDirection: "row",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    margin: 20,
    gap: 10,
    elevation: 4,
  },
  btnInsertarText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  btnEnviar: {
    backgroundColor: MJM_BLUE,
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  btnEnviarText: {
    color: "white",
    fontWeight: "bold",
  },
  btnConfirmIOS: {
    backgroundColor: MJM_BLUE,
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    width: "100%",
    alignItems: "center",
  },
  btnTime: {
    backgroundColor: MJM_BLUE,
    padding: 10,
    borderRadius: 10,
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
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeText: {
    fontSize: 16,
    color: MJM_BLUE,
    fontWeight: "bold",
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: MJM_BLUE,
  },

  progressPercentage: {
    marginTop: 10,
    fontSize: 12,
    color: "#666",
    fontWeight: "bold",
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
  btnCamText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
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

  webHeader: {
    backgroundColor: MJM_BLUE,
    padding: 15,
    alignItems: "center",
    elevation: 4,
  },
  webTitle: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
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
    // Remueve o ajusta el maxHeight estricto si causa problemas, 
    // o asegúrate de que el contenido interno use ScrollView:
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
  labelWeb: {
    fontSize: 11,
    fontWeight: "bold",
    color: MJM_BLUE,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  webBtnSave: {
    backgroundColor: "#28a745",
    padding: 18,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  webBtnSaveText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 15,
  },
  labelSmall: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 10,
    color: "#666",
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 15,
    color: "#444",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: MJM_BLUE,
    marginBottom: 15,
    textAlign: "center",
  },
});
