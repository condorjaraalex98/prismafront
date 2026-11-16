import { ThemedText } from "@/components/themed-text";
import { comprimirImagen } from "@/utils/compressImage";
import { subirFotoAlServidor } from "@/utils/subirFotoServidor";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useAuth } from "../../context/userContext";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";

type FotoEstado = {
  id: string;
  uri: string;
  url_remota: string | null;
  uploading: boolean;
};

const MJM_BLUE = "#024885";
const MAX_FOTOS = 4;

interface RegistroProps {
  visible: boolean;
  onClose: () => void;
  initialData?: any;
}

const normalizeText = (text: string): string =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatearDateAYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const mostrarAlerta = (titulo: string, mensaje: string) => {
  if (Platform.OS === "web") {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
};

const conTimeout = <T,>(
  promesa: Promise<T>,
  ms: number,
  mensajeError: string
): Promise<T> =>
  Promise.race([
    promesa,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(mensajeError)), ms)
    ),
  ]);

export default function RegistroOcurrencia({
  visible,
  onClose,
  initialData,
}: RegistroProps) {
  const { userData } = useAuth();
  const router = useRouter();

  const userIdStable = userData?.id || (userData as any)?.id_usuario || null;
  const miPersonaId =
    userData?.id ||
    (userData as any)?.id_persona ||
    (userData as any)?.id_usuario ||
    null;

  const liberarUriPreview = useCallback((uri: string) => {
    if (Platform.OS === "web" && uri && uri.startsWith("blob:")) {
      URL.revokeObjectURL(uri);
    }
  }, []);

  const getHoy = useCallback(() => formatearDateAYYYYMMDD(new Date()), []);

  const ESTADO_INICIAL = useMemo(
    () => ({
      id_usuario: userIdStable as any,
      id_lugar: null as any,
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
      turno: null as any,
      nombre_punto_gps: "",
      estadoOcurrencia: "PENDIENTE",
      referencia: "",
      detalle_llamada: { numero_telefono: "", nombre_informante: "" },
      unidad_encargada: "SERENAZGO",
      fecha_evento: getHoy(),
      grupo: null as any,
    }),
    [getHoy, userIdStable]
  );

  const [form, setForm] = useState(ESTADO_INICIAL);
  const [fotos, setFotos] = useState<FotoEstado[]>([]);
  const [derivarUnidad, setDerivarUnidad] = useState(false);
  const [showPersonalDropdown, setShowPersonalDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("Subiendo...");
  const [isFinished, setIsFinished] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"time" | "date">("time");
  const [activeField, setActiveField] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const [catalogos, setCatalogos] = useState({
    modalidades: [] as any[],
    camaras: [] as any[],
    lugares: [] as any[],
    id_personal_operativo: [] as any[],
  });

  const fotosRef = useRef<FotoEstado[]>([]);
  fotosRef.current = fotos;

  const catalogosCargadosRef = useRef(false);
  const inicializadoRef = useRef(false);
  const isMountedRef = useRef(true);
  const submittingRef = useRef(false);
  const activeUploadControllersRef = useRef<Set<AbortController>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      limpiarTimers();
      activeUploadControllersRef.current.forEach((c) => c.abort());
      activeUploadControllersRef.current.clear();
      fotosRef.current.forEach((f) => liberarUriPreview(f.uri));
    };
  }, [liberarUriPreview, limpiarTimers]);

  // Aplicar initialData una sola vez por apertura del modal (protegido contra onFocus)
  useEffect(() => {
    if (!visible) {
      inicializadoRef.current = false;
      return;
    }
    if (initialData && !inicializadoRef.current) {
      inicializadoRef.current = true;
      setForm((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [visible, initialData]);

  // Bloqueo global para evitar que el navegador abra imágenes arrastradas fuera de la zona
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    const preventDefaultGlobal = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("dragover", preventDefaultGlobal);
    window.addEventListener("drop", preventDefaultGlobal);

    return () => {
      window.removeEventListener("dragover", preventDefaultGlobal);
      window.removeEventListener("drop", preventDefaultGlobal);
    };
  }, [visible]);

  const limpiarFormulario = useCallback(() => {
    fotosRef.current.forEach((f) => liberarUriPreview(f.uri));
    setFotos([]);
    setDerivarUnidad(false);
    setShowPersonalDropdown(false);
    setForm({
      ...ESTADO_INICIAL,
      id_usuario: userIdStable,
      fecha_evento: getHoy(),
    });
  }, [liberarUriPreview, ESTADO_INICIAL, userIdStable, getHoy]);

  const obtenerGpsAutomatico = useCallback(async () => {
    try {
      let lat: number;
      let lon: number;
      let direccionNombre = "";

      if (Platform.OS === "web") {
        lat = -12.073769;
        lon = -77.039673;
        direccionNombre = "CSI MDJM";
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
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
          direccionNombre = `${p.street || ""} ${p.streetNumber || ""}, ${
            p.district || p.city || ""
          }`.trim();
        }
      }

      if (!isMountedRef.current) return;
      setForm((prev) => ({
        ...prev,
        latitud_gps: lat.toString(),
        longitud_gps: lon.toString(),
        nombre_punto_gps: direccionNombre || "Ubicación identificada",
      }));
    } catch {
      if (!isMountedRef.current) return;
      setForm((prev) => ({
        ...prev,
        latitud_gps: "-12.073769",
        longitud_gps: "-77.039673",
        nombre_punto_gps: "CSI MDJM (Ubicación por defecto)",
      }));
    }
  }, []);

  const cargarCatalogosInit = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const resGral = await fetch(
        `${API_URL}/catalogos/completo/unificadov?tipoLugar=4`,
        { signal: controller.signal }
      );
      if (!resGral.ok) {
        throw new Error(`Error HTTP ${resGral.status}`);
      }
      const data = await resGral.json();

      if (!isMountedRef.current) return;
      catalogosCargadosRef.current = true;
      setCatalogos({
        modalidades: data.modalidades || [],
        camaras: data.camaras || [],
        lugares: data.lugares || [],
        id_personal_operativo: (data.personal_operativo || []).filter(
          (persona: any) => Number(persona.value) !== Number(miPersonaId)
        ),
      });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Error al cargar catálogos:", err);
      mostrarAlerta(
        "Error",
        "No se pudieron cargar los catálogos del servidor."
      );
    } finally {
      clearTimeout(timer);
    }
  }, [miPersonaId]);

  // Carga catálogos y GPS solo cuando el modal se abre
  useEffect(() => {
    if (!visible) return;

    setForm((prev) => ({
      ...prev,
      ...(userIdStable ? { id_usuario: userIdStable } : {}),
      fecha_evento: prev.fecha_evento || getHoy(),
    }));

    if (!catalogosCargadosRef.current) {
      cargarCatalogosInit();
    }
    obtenerGpsAutomatico();
  }, [visible, userIdStable, getHoy, cargarCatalogosInit, obtenerGpsAutomatico]);

  // Caché de etiquetas normalizadas para búsqueda rápida en Dropdowns
  const labelNormMap = useMemo(() => {
    const map = new Map<string, string>();
    const indexar = (lista: any[]) => {
      for (const item of lista) {
        if (item?.label && !map.has(item.label)) {
          map.set(item.label, normalizeText(item.label));
        }
      }
    };
    indexar(catalogos.id_personal_operativo);
    indexar(catalogos.camaras);
    indexar(catalogos.lugares);
    indexar(catalogos.modalidades);
    return map;
  }, [catalogos]);

  const filtroOptimizado = useCallback(
    (keyword: string, label: string) => {
      const searchTerms = normalizeText(keyword)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (searchTerms.length === 0) return true;
      const cleanLabel = labelNormMap.get(label) ?? normalizeText(label);
      return searchTerms.every((term) => cleanLabel.includes(term));
    },
    [labelNormMap]
  );

  // Validaciones por sección
  const validation: Record<string, boolean> = useMemo(() => {
    const step1 = !!form.grupo && form.id_camara.length > 0 && !!form.turno;

    const step2 = (() => {
      const { hora_alerta, hora_llegada, hora_repliegue, fecha_evento } = form;
      if (!hora_alerta || !hora_llegada || !hora_repliegue || !fecha_evento) {
        return false;
      }

      const toMin = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
        return h * 60 + m;
      };

      const tA = toMin(hora_alerta);
      let tL = toMin(hora_llegada);
      let tR = toMin(hora_repliegue);
      if (Number.isNaN(tA) || Number.isNaN(tL) || Number.isNaN(tR)) return false;

      if (tL < tA) tL += 1440;
      if (tR < tA) tR += 1440;
      if (tR < tL) tR += 1440;

      const ordenValido = tA <= tL && tL <= tR;
      const diffAlertaLlegada = tL - tA;
      const diffLlegadaRepliegue = tR - tL;
      const duracionTotal = tR - tA;

      return (
        ordenValido &&
        diffAlertaLlegada >= 0 &&
        diffAlertaLlegada <= 720 &&
        diffLlegadaRepliegue >= 0 &&
        diffLlegadaRepliegue <= 720 &&
        duracionTotal >= 0 &&
        duracionTotal <= 720
      );
    })();

    const step3 = !!form.id_lugar && form.referencia.trim().length >= 3;
    const step4 = !!form.id_modalidad && form.descripcion.trim().length >= 3;

    return { step1, step2, step3, step4 };
  }, [
    form.grupo,
    form.id_camara.length,
    form.turno,
    form.hora_alerta,
    form.hora_llegada,
    form.hora_repliegue,
    form.fecha_evento,
    form.id_lugar,
    form.referencia,
    form.id_modalidad,
    form.descripcion,
  ]);

  const formCompleto = useMemo(
    () =>
      validation.step1 &&
      validation.step2 &&
      validation.step3 &&
      validation.step4,
    [validation]
  );

  const hayFotosSubiendo = fotos.some((f) => f.uploading);
  const formCompletoParaEnviar =
    formCompleto && !hayFotosSubiendo && fotos.length > 0;

  const getDynamicBorderStyle = (value: any) => ({
    borderColor: value ? MJM_BLUE : "#ddd",
    borderWidth: value ? 1.5 : 1,
  });

  const formatearFechaEspañol = (fechaStr: string) => {
    if (!fechaStr) return "Seleccione fecha";
    const fecha = new Date(fechaStr + "T12:00:00");
    if (Number.isNaN(fecha.getTime())) return "Seleccione fecha";
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

    return `${diasSemana[fecha.getDay()]}, ${fecha.getDate()} de ${
      meses[fecha.getMonth()]
    } de ${fecha.getFullYear()}`;
  };

  const formatearHora24h = (horaStr: string) => {
    if (!horaStr) return "00:00";
    if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(horaStr)) {
      return horaStr;
    }
    return "00:00";
  };

  const aplicarFechaSeleccionada = (selectedDate: Date) => {
    const fechaStr = formatearDateAYYYYMMDD(selectedDate);
    const hoyStr = getHoy();
    if (fechaStr > hoyStr) {
      mostrarAlerta(
        "Atención",
        "No se pueden registrar ocurrencias con fechas futuras."
      );
      setForm((f) => ({ ...f, fecha_evento: hoyStr }));
    } else {
      setForm((f) => ({ ...f, fecha_evento: fechaStr }));
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event?.type === "dismissed" || !selectedDate) return;
      aplicarFechaSeleccionada(selectedDate);
      return;
    }
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event?.type === "dismissed" || !selectedTime || !activeField) {
        setActiveField(null);
        return;
      }
      const horaStr = selectedTime.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const field = activeField;
      setActiveField(null);
      setForm((f) => ({ ...f, [field]: horaStr }));
      return;
    }
    if (selectedTime) {
      setTempDate(selectedTime);
    }
  };

  const confirmIOSSelection = () => {
    if (activeField === "fecha_evento") {
      aplicarFechaSeleccionada(tempDate);
    } else if (activeField) {
      const horaStr = tempDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setForm((f) => ({ ...f, [activeField]: horaStr }));
    }
    setShowPicker(false);
    setActiveField(null);
  };

  const capturarHoraActual = useCallback((campo: string) => {
    const ahora = new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    setForm((f) => ({ ...f, [campo]: ahora }));
  }, []);
const idsEnProcesoRef = useRef<Set<string>>(new Set());
const procesarYSubirImagen = useCallback(
    async (origen: File | string) => {
      const idsTotales = new Set([
        ...fotosRef.current.map((f) => f.id),
        ...idsEnProcesoRef.current,
      ]);
      if (idsTotales.size >= MAX_FOTOS) {
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      idsEnProcesoRef.current.add(id);

      let uriPreview = "";
      let subidaExitosa = false;
      const uploadController = new AbortController();
      let uploadTimeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        const fotoProcesada = await conTimeout(
          comprimirImagen(origen),
          15000,
          "La compresión de la imagen tardó demasiado."
        );

        uriPreview =
          typeof fotoProcesada === "string"
            ? fotoProcesada
            : URL.createObjectURL(fotoProcesada as Blob);

        if (!isMountedRef.current) {
          liberarUriPreview(uriPreview);
          return;
        }

        setFotos((prev) => [
          ...prev,
          { id, uri: uriPreview, url_remota: null, uploading: true },
        ]);

        activeUploadControllersRef.current.add(uploadController);
        uploadTimeoutId = setTimeout(() => uploadController.abort(), 25000);

        const urlRemota = await subirFotoAlServidor(
          fotoProcesada,
          API_URL,
          form.id_modalidad,
          form.fecha_evento,
          uploadController.signal
        );

        if (!urlRemota) {
          throw new Error("El servidor no devolvió la URL de la imagen.");
        }

        if (!isMountedRef.current) {
          liberarUriPreview(uriPreview);
          return;
        }

        subidaExitosa = true;
        setFotos((prev) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, url_remota: urlRemota, uploading: false }
              : f
          )
        );
      } catch (err: any) {
        const msg =
          err?.name === "AbortError"
            ? "La subida al servidor tardó demasiado."
            : err?.message || "Una imagen no pudo procesarse o subirse.";
        console.error("Error al procesar/subir imagen:", err);
        if (uriPreview) {
          liberarUriPreview(uriPreview);
        }
        if (isMountedRef.current) {
          mostrarAlerta("Error al subir imagen", msg);
        }
      } finally {
        idsEnProcesoRef.current.delete(id);
        if (uploadTimeoutId) clearTimeout(uploadTimeoutId);
        activeUploadControllersRef.current.delete(uploadController);
        if (!subidaExitosa && isMountedRef.current) {
          setFotos((prev) => prev.filter((f) => f.id !== id));
        }
      }
    },
    [form.id_modalidad, form.fecha_evento, liberarUriPreview]
  );

  const handleDropWeb = async (e: any) => {
    if (Platform.OS !== "web") return;
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const archivosImagen = Array.from(files as FileList).filter(
      (file) =>
        file.type.startsWith("image/") ||
        /\.(jpe?g|png|gif|webp|bmp|heic|heif|jfif)$/i.test(file.name)
    );

    if (archivosImagen.length === 0) {
      return mostrarAlerta(
        "Formato inválido",
        "Solo se permiten archivos de imagen."
      );
    }

    const ocupados = new Set([
      ...fotosRef.current.map((f) => f.id),
      ...idsEnProcesoRef.current,
    ]).size;
    const espacioDisponible = MAX_FOTOS - ocupados;

    if (espacioDisponible <= 0) {
      return mostrarAlerta("Límite", `Máximo ${MAX_FOTOS} fotos.`);
    }

    const archivosAProcesar = archivosImagen.slice(0, espacioDisponible);
    await Promise.all(archivosAProcesar.map((file) => procesarYSubirImagen(file)));
  };

  const seleccionarGaleria = async () => {
    const ocupados = new Set([
      ...fotosRef.current.map((f) => f.id),
      ...idsEnProcesoRef.current,
    ]).size;
    const espacioDisponible = MAX_FOTOS - ocupados;

    if (espacioDisponible <= 0) {
      return mostrarAlerta("Límite", `Máximo ${MAX_FOTOS} fotos.`);
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      selectionLimit: espacioDisponible,
    });

    if (!res.canceled && res.assets.length > 0) {
      const assetsAProcesar = res.assets.slice(0, espacioDisponible);
      await Promise.all(
        assetsAProcesar.map((asset) =>
          procesarYSubirImagen(
            Platform.OS === "web" ? asset.file || asset.uri : asset.uri
          )
        )
      );
    }
  };



  const enviarRegistro = async () => {
    if (submittingRef.current) return;

    const idFinal = form.id_usuario || userIdStable;
    if (!idFinal) {
      return mostrarAlerta("Atención", "No se pudo identificar al usuario.");
    }

    if (fotos.some((f) => f.uploading)) {
      return mostrarAlerta(
        "Espere",
        "Las fotos aún se están subiendo a la nube."
      );
    }

    if (fotos.length === 0) {
      return mostrarAlerta(
        "Atención",
        "Debe adjuntar al menos una imagen de evidencia."
      );
    }

    submittingRef.current = true;
    limpiarTimers();
    setLoading(true);
    setUploadProgress(0);
    setUploadStatus("Subiendo...");
    setIsFinished(false);

    intervalRef.current = setInterval(() => {
      setUploadProgress((p) => (p < 90 ? p + 10 : p));
    }, 150);

    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 30000);

    try {
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
        fotos: urlsFotosFinales,
      };

      const res = await fetch(`${API_URL}/ocurrencias/registrar/modr2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyEnviar),
        signal: controller.signal,
      });

      limpiarTimers();
      if (!isMountedRef.current) return;

      if (res.ok) {
        setUploadProgress(100);
        setUploadStatus("¡Listo! Guardado");
        setIsFinished(true);

        timeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          submittingRef.current = false;
          setLoading(false);
          limpiarFormulario();
          onClose();
          router.replace("/cecomdoceh");
        }, 1500);
      } else {
        let mensajeError = "No se pudo guardar.";
        try {
          const errorData = await res.json();
          mensajeError = errorData.error || errorData.message || mensajeError;
        } catch {
          // respuesta no JSON
        }
        submittingRef.current = false;
        setLoading(false);
        mostrarAlerta("Error", mensajeError);
      }
    } catch (e: any) {
      limpiarTimers();
      if (!isMountedRef.current) return;
      submittingRef.current = false;
      setLoading(false);
      console.error("Error de conexión:", e);
      mostrarAlerta(
        "Error",
        e?.name === "AbortError"
          ? "El servidor tardó demasiado en responder."
          : "Error de conexión con el servidor."
      );
    } finally {
      clearTimeout(requestTimeout);
    }
  };

  const renderMosaicos = (
    data: any[],
    currentId: any,
    field: string,
    iconDefault: string
  ) => (
    <View style={styles.mosaicoGrid}>
      {data.map((item: any) => (
        <Pressable
          key={item.value}
          onPress={() => setForm((prev) => ({ ...prev, [field]: item.value }))}
          style={[
            styles.mosaicoItem,
            currentId === item.value && styles.mosaicoSelected,
          ]}
        >
          <Ionicons
            name={(item.icon || iconDefault) as any}
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

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop para cerrar al presionar fuera del modal */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!loading) onClose();
          }}
        />

        <View style={styles.modalContent}>
          {/* Cabecera del Modal */}
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>VV. CÁMARA</ThemedText>
            <Pressable
              onPress={() => {
                if (!loading) onClose();
              }}
            >
              <Ionicons name="close-circle" size={30} color="#666" />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollForm}
          >
            {/* Indicador de progreso de las 4 secciones */}
            <View style={styles.newStepperContainer}>
              {[1, 2, 3, 4].map((i) => {
                const estaListo = validation[`step${i}`];
                return (
                  <View key={i} style={styles.stepWrapper}>
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
                          { color: estaListo ? "white" : MJM_BLUE },
                        ]}
                      >
                        {i}
                      </ThemedText>
                    </View>
                    {i < 4 && (
                      <View
                        style={[
                          styles.connectorLine,
                          estaListo && { backgroundColor: MJM_BLUE },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.webGridContainer}>
              {/* COLUMNA 1: DESPACHO Y PERSONAL */}
              <View style={styles.webColumn}>
                <View style={styles.headerStepWeb}>
                  <Ionicons name="megaphone" size={18} color="white" />
                  <ThemedText style={styles.headerStepText}>
                    1. DESPACHO Y PERSONAL
                  </ThemedText>
                </View>

                <View style={styles.columnBody}>
                  <View style={styles.cascadaContainer}>
                    <ThemedText style={styles.labelMicro}>
                      PERSONAL REPORTANDO:
                    </ThemedText>

                    <View style={styles.personalRow}>
                      <View style={styles.personalReadonlyBox}>
                        <Ionicons
                          name="person-circle"
                          size={20}
                          color={MJM_BLUE}
                        />
                        <ThemedText
                          numberOfLines={1}
                          style={styles.personalReadonlyText}
                        >
                          {`${userData?.apellido_paterno || ""} ${
                            userData?.apellido_materno || ""
                          }, ${userData?.nombres || ""}`}{" "}
                          (TÚ)
                        </ThemedText>
                        <Ionicons name="lock-closed" size={12} color="#888" />
                      </View>

                      <Pressable
                        onPress={() =>
                          setShowPersonalDropdown((prev) => !prev)
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
                          name={showPersonalDropdown ? "close" : "person-add"}
                          size={20}
                          color="white"
                        />
                      </Pressable>
                    </View>

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
                        searchQuery={filtroOptimizado}
                        flatListProps={{
                          initialNumToRender: 15,
                          maxToRenderPerBatch: 15,
                          windowSize: 5,
                        }}
                        onChange={(item) => {
                          if (
                            !form.id_personal_operativo.find(
                              (p) => p.value === item.value
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

                    <View style={styles.chipsRow}>
                      {form.id_personal_operativo.map((p) => (
                        <Pressable
                          key={p.value}
                          style={[
                            styles.chip,
                            { backgroundColor: "#2E7D32", marginBottom: 5 },
                          ]}
                          onPress={() =>
                            setForm((f) => ({
                              ...f,
                              id_personal_operativo:
                                f.id_personal_operativo.filter(
                                  (x) => x.value !== p.value
                                ),
                            }))
                          }
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

                    <ThemedText style={styles.labelMicro}>GRUPO:</ThemedText>
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
                        "people-outline"
                      )}
                    </View>

                    <ThemedText style={styles.labelMicro}>
                      ¿A QUÉ TURNO PERTENECE ESTE REPORTE?
                    </ThemedText>
                    <View style={{ marginBottom: 15 }}>
                      {renderMosaicos(
                        [
                          {
                            label: "MAÑANA",
                            value: "M",
                          
                          },
                          {
                            label: "TARDE",
                            value: "T",
                          
                          },
                          {
                            label: "NOCHE",
                            value: "N",
                          
                          },
                        ],
                        form.turno,
                        "turno",
                        "time-outline"
                      )}
                    </View>

                    <View style={styles.sectionContainer}>
                      <View style={styles.camaraBox}>
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
                          <ThemedText style={styles.labelMicro}>
                            CÁMARA MONITOREADA:
                          </ThemedText>
                        </View>

                        <Dropdown
                          containerStyle={styles.dropdownContainer}
                          itemTextStyle={styles.itemText}
                          itemContainerStyle={styles.itemContainer}
                          style={styles.dropdown}
                          data={catalogos.camaras}
                          search
                          labelField="label"
                          valueField="value"
                          value={null}
                          placeholder="Seleccionar cámara..."
                          searchQuery={filtroOptimizado}
                          flatListProps={{
                            initialNumToRender: 15,
                            maxToRenderPerBatch: 15,
                            windowSize: 5,
                          }}
                          onChange={(item) => {
                            if (
                              !form.id_camara.find(
                                (c) => c.value === item.value
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

                        <View style={[styles.chipsRow, { marginTop: 8 }]}>
                          {form.id_camara.map((c) => (
                            <Pressable
                              key={c.value}
                              style={styles.chip}
                              onPress={() =>
                                setForm((f) => ({
                                  ...f,
                                  id_camara: f.id_camara.filter(
                                    (x) => x.value !== c.value
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
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <ThemedText style={styles.labelMicro}>FECHA:</ThemedText>
                      <Pressable
                        onPress={() =>
                          setForm((prev) => ({
                            ...prev,
                            fecha_evento: getHoy(),
                          }))
                        }
                        style={styles.btnHoy}
                      >
                        <ThemedText style={styles.btnHoyText}>
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
                            if (!fechaSeleccionada) {
                              setForm((prev) => ({
                                ...prev,
                                fecha_evento: hoyStr,
                              }));
                            } else if (fechaSeleccionada > hoyStr) {
                              mostrarAlerta(
                                "Atención",
                                "No se pueden registrar ocurrencias con fechas futuras."
                              );
                              setForm((prev) => ({
                                ...prev,
                                fecha_evento: hoyStr,
                              }));
                            } else {
                              setForm((prev) => ({
                                ...prev,
                                fecha_evento: fechaSeleccionada,
                              }));
                            }
                          }}
                          style={webInputStyle}
                        />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setPickerMode("date");
                          setActiveField("fecha_evento");
                          const d = new Date(
                            (form.fecha_evento || getHoy()) + "T12:00:00"
                          );
                          setTempDate(Number.isNaN(d.getTime()) ? new Date() : d);
                          setShowPicker(true);
                        }}
                        style={[
                          styles.inputShared,
                          getDynamicBorderStyle(form.fecha_evento),
                        ]}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color={MJM_BLUE}
                        />
                        <ThemedText
                          style={{ color: "#000", marginLeft: 10, flex: 1 }}
                        >
                          {formatearFechaEspañol(form.fecha_evento)}
                        </ThemedText>
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color="#999"
                        />
                      </Pressable>
                    )}

                    {(
                      [
                        "hora_alerta",
                        "hora_llegada",
                        "hora_repliegue",
                      ] as const
                    ).map((k) => (
                      <View key={k} style={{ marginTop: 15 }}>
                        <ThemedText style={styles.labelMicro}>
                          {k.toUpperCase().replace("_", " ")}
                        </ThemedText>

                        <View style={styles.timeRow}>
                          {Platform.OS === "web" ? (
                            <View style={{ flex: 1 }}>
                              <input
                                type="time"
                                value={form[k]}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setForm((prev) => ({ ...prev, [k]: val }));
                                }}
                                style={webInputStyle}
                              />
                            </View>
                          ) : (
                            <Pressable
                              onPress={() => {
                                setPickerMode("time");
                                setActiveField(k);
                                const currentTime = form[k];
                                const date = new Date();
                                if (currentTime && currentTime !== "00:00") {
                                  const [hours, minutes] =
                                    currentTime.split(":");
                                  date.setHours(
                                    parseInt(hours, 10),
                                    parseInt(minutes, 10)
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
                                {formatearHora24h(form[k])}
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
                    !validation.step2 ? (
                      <View style={styles.timeErrorBox}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.timeErrorTitle}>
                            Error en los intervalos de tiempo
                          </ThemedText>
                          <ThemedText style={styles.timeErrorText}>
                            • El orden debe ser: Repliegue ≥ Llegada ≥ Alerta.
                          </ThemedText>
                          <ThemedText style={styles.timeErrorText}>
                            • La duración total entre Alerta y Repliegue no
                            debe superar las 12 horas.
                          </ThemedText>
                        </View>
                      </View>
                    ) : null}
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
                    <ThemedText
                      style={[styles.labelMicro, { marginBottom: 10 }]}
                    >
                      LUGAR CONSOLIDADO (AV, CA, JR, PSJ, PQ, PLZ, EDF, BLK):
                    </ThemedText>

                    <View style={{ marginBottom: 10 }}>
                      <Dropdown
                        containerStyle={styles.dropdownContainer}
                        itemTextStyle={[styles.itemText, { color: "#000" }]}
                        selectedTextStyle={{ color: "#000", fontSize: 14 }}
                        itemContainerStyle={styles.itemContainer}
                        style={[
                          styles.dropdown,
                          getDynamicBorderStyle(form.id_lugar),
                        ]}
                        data={catalogos.lugares}
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
                        searchQuery={filtroOptimizado}
                        placeholderStyle={{ color: "#666" }}
                        onChange={(item) =>
                          setForm((prev: any) => ({
                            ...prev,
                            id_lugar: item.value,
                          }))
                        }
                        flatListProps={{
                          nestedScrollEnabled: true,
                          keyboardShouldPersistTaps: "handled",
                          initialNumToRender: 15,
                          maxToRenderPerBatch: 15,
                          windowSize: 5,
                        }}
                        activeColor="#E3F2FD"
                        inputSearchStyle={styles.dropdownSearchInput}
                      />
                    </View>

                    <View>
                      <ThemedText
                        style={[styles.labelMicro, { marginBottom: 5 }]}
                      >
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
                            borderColor:
                              form.referencia.trim().length >= 3
                                ? MJM_BLUE
                                : "#DDD",
                            borderRadius: 10,
                            marginTop: 0,
                          },
                        ]}
                        placeholder="Ej: Escriba una referencia cercana o indique el numeral exacto si lo conoce."
                        placeholderTextColor="#AAA"
                        value={form.referencia}
                        maxLength={300}
                        onChangeText={(t) => {
                          const capitalizedText =
                            t.charAt(0).toUpperCase() + t.slice(1);
                          setForm((prev) => ({
                            ...prev,
                            referencia: capitalizedText,
                          }));
                        }}
                        autoCapitalize="sentences"
                        multiline
                      />
                    </View>

                    {/* UNIDAD / DERIVACIÓN */}
                    <View style={styles.unidadBox}>
                      <ThemedText style={styles.labelMicro}>
                        UNIDAD PRINCIPAL:
                      </ThemedText>
                      <View style={styles.unidadSerenazgoBadge}>
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
                          setForm((f) => ({
                            ...f,
                            unidad_encargada: nuevoEstado
                              ? "FISCALIZACION"
                              : "SERENAZGO",
                          }));
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingTop: 4,
                        }}
                      >
                        <Ionicons
                          name={derivarUnidad ? "checkbox" : "square-outline"}
                          size={22}
                          color={MJM_BLUE}
                        />
                        <ThemedText
                          style={{
                            fontSize: 12,
                            fontWeight: "bold",
                            color: MJM_BLUE,
                            flex: 1,
                          }}
                        >
                          ¿Derivar esta ocurrencia a otra área?
                        </ThemedText>
                      </Pressable>

                      {derivarUnidad && (
                        <View style={styles.derivarAreasContainer}>
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
                            {[
                              { label: "Fiscalización", val: "FISCALIZACION" },
                              {
                                label: "Control Urbano",
                                val: "CONTROL URBANO",
                              },
                              {
                                label: "Limpieza Pública",
                                val: "LIMPIEZA PUBLICA",
                              },
                            ].map((area) => {
                              const activa =
                                form.unidad_encargada === area.val;
                              return (
                                <Pressable
                                  key={area.val}
                                  onPress={() =>
                                    setForm((f) => ({
                                      ...f,
                                      unidad_encargada: area.val,
                                    }))
                                  }
                                  style={[
                                    styles.areaBtn,
                                    activa && {
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
                                      color: activa ? "white" : "#333",
                                    }}
                                  >
                                    {area.label}
                                  </ThemedText>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* COLUMNA 4: CIERRE DE REGISTRO */}
              <View style={styles.webColumn}>
                <View style={styles.headerStepWeb}>
                  <Ionicons name="checkmark-circle" size={18} color="white" />
                  <ThemedText style={styles.headerStepText}>
                    4. CIERRE DE REGISTRO
                  </ThemedText>
                </View>

                <View style={styles.columnBody}>
                  <View style={styles.cascadaContainer}>
                    <ThemedText style={styles.labelMicro}>
                      MODALIDAD:
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
                        getDynamicBorderStyle(form.id_modalidad),
                      ]}
                      data={catalogos.modalidades}
                      value={form.id_modalidad}
                      labelField="label"
                      valueField="value"
                      placeholder="Seleccione Modalidad"
                      placeholderStyle={{ color: "#666", fontSize: 14 }}
                      search
                      searchPlaceholder="Buscar modalidad..."
                      searchQuery={filtroOptimizado}
                      onFocus={() => {
                        setForm((prev) => ({ ...prev, id_modalidad: "" }));
                      }}
                      onChange={(item) =>
                        setForm((prev) => ({
                          ...prev,
                          id_modalidad: item.value,
                        }))
                      }
                      activeColor="#E3F2FD"
                      flatListProps={{
                        nestedScrollEnabled: true,
                        keyboardShouldPersistTaps: "handled",
                        initialNumToRender: 15,
                        maxToRenderPerBatch: 15,
                        windowSize: 5,
                      }}
                      inputSearchStyle={styles.dropdownSearchInput}
                    />

                    {/* DESCRIPCIÓN */}
                    <View style={{ marginTop: 15, marginBottom: 10 }}>
                      <ThemedText style={styles.labelMicro}>
                        DATOS IMPORTANTES:
                      </ThemedText>
                      <TextInput
                        style={[
                          styles.textArea,
                          {
                            backgroundColor: "#FFFFFF",
                            color: "#000000",
                            minHeight: 120,
                            textAlignVertical: "top",
                            padding: 12,
                            fontSize: 14,
                            marginTop: 5,
                          },
                          getDynamicBorderStyle(
                            form.descripcion.trim().length >= 3
                          ),
                        ]}
                        placeholder="Escribe todos los detalles aquí..."
                        placeholderTextColor="#999999"
                        multiline={true}
                        maxLength={1500}
                        autoCapitalize="sentences"
                        value={form.descripcion}
                        onChangeText={(t) => {
                          const capitalizedText =
                            t.charAt(0).toUpperCase() + t.slice(1);
                          setForm((prev) => ({
                            ...prev,
                            descripcion: capitalizedText,
                          }));
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

                    {/* ZONA DE FOTOS + DRAG & DROP */}
                    {Platform.OS === "web" ? (
                      <div
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer) {
                            e.dataTransfer.dropEffect = "copy";
                          }
                        }}
                        onDrop={handleDropWeb}
                        style={{ width: "100%", marginTop: 5 }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 10,
                            width: "100%",
                          }}
                        >
                          <Pressable
                            style={[
                              styles.btnCamAction,
                              { backgroundColor: MJM_BLUE },
                            ]}
                            onPress={seleccionarGaleria}
                          >
                            <Ionicons name="images" size={20} color="white" />
                            <ThemedText style={styles.btnCamText}>
                              Examinar Archivos
                            </ThemedText>
                          </Pressable>
                        </View>

                        <View style={styles.dropZoneContainer}>
                          <Ionicons
                            name="cloud-upload-outline"
                            size={24}
                            color={MJM_BLUE}
                          />
                          <ThemedText style={styles.dropZoneText}>
                            O arrastra tus imágenes aquí
                          </ThemedText>
                        </View>
                      </div>
                    ) : (
                      <View style={[styles.photoActions, { marginTop: 5 }]}>
                        <Pressable
                          style={[
                            styles.btnCamAction,
                            { backgroundColor: MJM_BLUE },
                          ]}
                          onPress={seleccionarGaleria}
                        >
                          <Ionicons name="images" size={20} color="white" />
                          <ThemedText style={styles.btnCamText}>
                            Examinar Archivos
                          </ThemedText>
                        </Pressable>
                      </View>
                    )}

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
                      <View style={{ marginTop: 10 }}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={true}
                          contentContainerStyle={{
                            gap: 12,
                            paddingRight: 20,
                            paddingTop: 8,
                          }}
                          style={{ width: "100%" }}
                        >
                          {fotos.map((f) => (
                            <View key={f.id} style={styles.photoWrapper}>
                              <Image
                                source={{ uri: f.uri }}
                                style={styles.photoThumb}
                                resizeMode="cover"
                              />

                              {f.uploading && (
                                <View style={styles.uploadingBadge}>
                                  <ActivityIndicator
                                    size="small"
                                    color="#FFFFFF"
                                  />
                                  <ThemedText
                                    style={{
                                      color: "white",
                                      fontSize: 9,
                                      fontWeight: "bold",
                                    }}
                                  >
                                    Subiendo...
                                  </ThemedText>
                                </View>
                              )}

                              <Pressable
                                style={styles.removePhoto}
                                onPress={() => {
                                  liberarUriPreview(f.uri);
                                  setFotos((prev) =>
                                    prev.filter((item) => item.id !== f.id)
                                  );
                                }}
                              >
                                <Ionicons
                                  name="close-circle"
                                  size={22}
                                  color="red"
                                />
                              </Pressable>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    <Pressable
                      style={[
                        styles.btnSave,
                        {
                          marginTop: 15,
                          backgroundColor: formCompletoParaEnviar
                            ? "#2E7D32"
                            : "#A0A0A0",
                          opacity: formCompletoParaEnviar ? 1 : 0.6,
                        },
                      ]}
                      onPress={enviarRegistro}
                      disabled={!formCompletoParaEnviar || loading}
                    >
                      <ThemedText
                        style={{ color: "white", fontWeight: "bold" }}
                      >
                        {loading
                          ? "ENVIANDO..."
                          : hayFotosSubiendo
                          ? "SUBIENDO FOTOS..."
                          : "ENVIAR"}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Date/Time Picker nativo para Android e iOS */}
        {Platform.OS === "android" && showPicker && (
          <DateTimePicker
            value={tempDate}
            mode={pickerMode}
            is24Hour={true}
            maximumDate={pickerMode === "date" ? new Date() : undefined}
            onChange={
              pickerMode === "date" ? handleDateChange : handleTimeChange
            }
          />
        )}

        {Platform.OS === "ios" && showPicker && (
          <Modal transparent animationType="fade" visible={showPicker}>
            <View style={styles.modalCenterOverlay}>
              <View style={styles.modalPickerContent}>
                <ThemedText style={styles.pickerTitle}>
                  {pickerMode === "date"
                    ? "Seleccionar Fecha"
                    : "Seleccionar Hora"}
                </ThemedText>
                <DateTimePicker
                  value={tempDate}
                  mode={pickerMode}
                  display="spinner"
                  is24Hour={true}
                  maximumDate={pickerMode === "date" ? new Date() : undefined}
                  onChange={
                    pickerMode === "date" ? handleDateChange : handleTimeChange
                  }
                />
                <Pressable
                  style={styles.btnConfirmIOS}
                  onPress={confirmIOSSelection}
                >
                  <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                    Confirmar
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}

        {/* Overlay de progreso al enviar */}
        {loading && (
          <View style={styles.uploadOverlay}>
            <View style={styles.uploadCard}>
              <Ionicons
                name={isFinished ? "checkmark-circle" : "cloud-upload"}
                size={50}
                color={MJM_BLUE}
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

              <ThemedText style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                {uploadProgress}%
              </ThemedText>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const webInputStyle: CSSProperties = {
  height: 45,
  width: "100%",
  boxSizing: "border-box",
  borderWidth: 1,
  borderColor: "#ccc",
  borderStyle: "solid",
  borderRadius: 8,
  fontSize: 15,
  padding: "0 10px",
  backgroundColor: "#FFFFFF",
  color: "#000000",
};

export const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    padding: 20,
  },
   modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "flex-end", // <--- Lo mueve hacia el lado derecho
    paddingRight: 200,
    padding: Platform.OS === "web" ? 20 : 10,
  },
  modalContent: {
    backgroundColor: "white",
    width: "100%",
    maxWidth: 1380,
    maxHeight: "92%",
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
    padding: 16,
  },
  newStepperContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
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
webGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 16,
    alignItems: "stretch", // <--- Esto obliga a que todas las columnas midan la misma altura de forma automática
  },
  webColumn: {
    width: 315,                   // <--- Ancho fijo exacto en píxeles para todas las columnas
    minWidth: 315,
    maxWidth: 315,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
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
    padding: 12,
  },
  cascadaContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F9FBFF",
    borderWidth: 1,
    borderColor: "#E1E8F5",
  },
  labelMicro: {
    fontSize: 10,
    color: MJM_BLUE,
    fontWeight: "bold",
  },
  personalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  personalReadonlyBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 45,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  personalReadonlyText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: "#555",
  },
  sectionContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 4,
    marginVertical: 6,
  },
  camaraBox: {
    backgroundColor: "#eef2ff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MJM_BLUE,
  },
  inputShared: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
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
  dropdownSearchInput: {
    height: 40,
    fontSize: 14,
    borderRadius: 8,
    color: "#000",
    paddingHorizontal: 10,
    backgroundColor: "#F9F9F9",
  },
  itemContainer: {
    paddingVertical: 2,
  },
  itemText: {
    fontSize: 12,
    color: "#333",
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
  btnHoy: {
    backgroundColor: MJM_BLUE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnHoyText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  pickerPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#f4f4f4",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 5,
  },
  btnTime: {
    backgroundColor: MJM_BLUE,
    padding: 10,
    borderRadius: 10,
  },
  timeErrorBox: {
    backgroundColor: "#FFF5F5",
    borderLeftWidth: 4,
    borderLeftColor: "#D32F2F",
    padding: 12,
    borderRadius: 8,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  timeErrorTitle: {
    color: "#D32F2F",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
  },
  timeErrorText: {
    color: "#555",
    fontSize: 11,
    marginBottom: 2,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: "#eee",
    height: 100,
    padding: 12,
    borderRadius: 10,
    textAlignVertical: "top",
    backgroundColor: "white",
  },
  textAreaSmall: {
    borderWidth: 1.5,
    borderColor: "#eee",
    height: 60,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "white",
  },
  unidadBox: {
    marginTop: 12,
    marginBottom: 5,
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  unidadSerenazgoBadge: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: MJM_BLUE,
    marginTop: 6,
    marginBottom: 12,
  },
  derivarAreasContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
  },
  areaBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
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
  dropZoneContainer: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: MJM_BLUE,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F5FF",
    gap: 4,
  },
  dropZoneText: {
    fontSize: 11,
    color: MJM_BLUE,
    fontWeight: "600",
  },
  photoCounter: {
    fontSize: 10,
    color: "#888",
    marginTop: 8,
    textAlign: "right",
  },
  photoWrapper: {
    width: 80,
    height: 80,
    position: "relative",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f0f0f0",
  },
  photoThumb: {
    width: "100%",
    height: "100%",
    borderRadius: 11,
  },
  uploadingBadge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(2, 72, 133, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    borderRadius: 11,
  },
  removePhoto: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "white",
    borderRadius: 12,
    zIndex: 2,
  },
  btnSave: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
    width: "100%",
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
  btnConfirmIOS: {
    backgroundColor: MJM_BLUE,
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    width: "100%",
    alignItems: "center",
  },
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
    backgroundColor: MJM_BLUE,
  },
});