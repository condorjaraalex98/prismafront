import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
const ID_CAMIONETA = 1;
const ID_PATRULLAJE_MOTORIZADO = 3;
const MAX_FOTOS = 4;
const TEXTO_CENTRAL_FIRMA = "Por orden de la central";

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

export default function RegistroOcurrencia() {
  const insets = useSafeAreaInsets();
  const { userData } = useAuth();
  const router = useRouter();

  const userIdStable = userData?.id || (userData as any)?.id_usuario || null;

  const liberarUriPreview = useCallback((uri: string) => {
    if (Platform.OS === "web" && uri && uri.startsWith("blob:")) {
      URL.revokeObjectURL(uri);
    }
  }, []);

  const getHoy = useCallback(() => formatearDateAYYYYMMDD(new Date()), []);

  const ESTADO_INICIAL = useMemo(
    () => ({
      id_usuario: userIdStable as number | null,
      id_lugar: null as any,
      id_modalidad: "",
      id_origen: "8",
      id_tipo_patrullaje: null as number | null,
      id_modalidad_patrullaje: "10",
      vehiculos_detalle: [] as any[],
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
      unidad_encargada: "SERENAZGO",
      fecha_evento: getHoy(),
      grupo: null as any,
    }),
    [getHoy, userIdStable]
  );

  const [form, setForm] = useState(ESTADO_INICIAL);
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

  const [catalogos, setCatalogos] = useState({
    modalidades: [] as any[],
    tipos_patrullaje: [] as any[],
    tipos_vehiculo: [] as any[],
    unidades: [] as any[],
    pnps: [] as any[],
    lugares: [] as any[],
  });

  const [unidadForm, setUnidadForm] = useState({
    id_tipo_vehiculo: null as number | null,
    id_unidad: null as number | null,
    placa: "",
    tipo_asignacion: "MUNICIPAL" as "MUNICIPAL" | "INTEGRADO",
    id_pnp: null as number | null,
  });

  const fotosRef = useRef<FotoEstado[]>([]);
  fotosRef.current = fotos;

  const idsEnProcesoRef = useRef<Set<string>>(new Set());
  const catalogosCargadosRef = useRef(false);
  const isMountedRef = useRef(true);
  const submittingRef = useRef(false);
  const activeUploadControllersRef = useRef<Set<AbortController>>(new Set());
  const unidadesControllerRef = useRef<AbortController | null>(null);
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
      unidadesControllerRef.current?.abort();
      activeUploadControllersRef.current.forEach((c) => c.abort());
      activeUploadControllersRef.current.clear();
      fotosRef.current.forEach((f) => liberarUriPreview(f.uri));
    };
  }, [liberarUriPreview, limpiarTimers]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
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
  }, []);

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
      const [resGral, resTiposV, resPnps] = await Promise.all([
        fetch(
          `${API_URL}/catalogos/completo/unificadov?tipoLugar=4&idTipoP=1&idTipoP=2&idTipoP=3&idTipoP=4`,
          { signal: controller.signal }
        ),
        fetch(`${API_URL}/catalogos/tipos-vehiculo`, {
          signal: controller.signal,
        }),
        fetch(`${API_URL}/catalogos/pnp-activos`, {
          signal: controller.signal,
        }),
      ]);

      if (!resGral.ok || !resTiposV.ok || !resPnps.ok) {
        throw new Error("Error HTTP al cargar catálogos");
      }

      const [data, tiposVehiculoData, pnpsData] = await Promise.all([
        resGral.json(),
        resTiposV.json(),
        resPnps.json(),
      ]);

      const tiposVehiculoFiltrados = (
        Array.isArray(tiposVehiculoData) ? tiposVehiculoData : []
      ).filter((t: any) => Number(t.value) === 1 || Number(t.value) === 2);

      if (!isMountedRef.current) return;
      catalogosCargadosRef.current = true;
      setCatalogos({
        modalidades: data.modalidades || [],
        tipos_patrullaje: data.tipos_patrullaje || [],
        tipos_vehiculo: tiposVehiculoFiltrados,
        unidades: [],
        pnps: Array.isArray(pnpsData) ? pnpsData : [],
        lugares: data.lugares || [],
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
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      ...(userIdStable ? { id_usuario: userIdStable } : {}),
      fecha_evento: prev.fecha_evento || getHoy(),
    }));

    if (!catalogosCargadosRef.current) {
      cargarCatalogosInit();
    }
    obtenerGpsAutomatico();
  }, [userIdStable, getHoy, cargarCatalogosInit, obtenerGpsAutomatico]);

  const limpiarFormulario = useCallback(() => {
    fotosRef.current.forEach((f) => liberarUriPreview(f.uri));
    idsEnProcesoRef.current.clear();
    setStep(1);
    setFotos([]);
    setUnidadForm({
      id_tipo_vehiculo: null,
      id_unidad: null,
      placa: "",
      tipo_asignacion: "MUNICIPAL",
      id_pnp: null,
    });
    setForm({
      ...ESTADO_INICIAL,
      id_usuario: userIdStable,
      fecha_evento: getHoy(),
    });
  }, [liberarUriPreview, ESTADO_INICIAL, userIdStable, getHoy]);

  const labelNormMap = useMemo(() => {
    const map = new Map<string, string>();
    const indexar = (lista: any[]) => {
      for (const item of lista) {
        if (item?.label && !map.has(item.label)) {
          map.set(item.label, normalizeText(item.label));
        }
      }
    };
    indexar(catalogos.lugares);
    indexar(catalogos.modalidades);
    indexar(catalogos.pnps);
    indexar(catalogos.unidades);
    return map;
  }, [
    catalogos.lugares,
    catalogos.modalidades,
    catalogos.pnps,
    catalogos.unidades,
  ]);

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

  const tiemposInvalidos = useMemo(() => {
    const { hora_alerta, hora_llegada, hora_repliegue } = form;
    if (!hora_alerta || !hora_llegada || !hora_repliegue) return false;

    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
      return h * 60 + m;
    };

    const tA = toMin(hora_alerta);
    let tL = toMin(hora_llegada);
    let tR = toMin(hora_repliegue);
    if (Number.isNaN(tA) || Number.isNaN(tL) || Number.isNaN(tR)) return true;

    if (tL < tA) tL += 1440;
    if (tR < tA) tR += 1440;
    if (tR < tL) tR += 1440;

    const ordenValido = tA <= tL && tL <= tR;
    const diffAlertaLlegada = tL - tA;
    const diffLlegadaRepliegue = tR - tL;
    const duracionTotal = tR - tA;

    return !(
      ordenValido &&
      diffAlertaLlegada >= 0 &&
      diffAlertaLlegada <= 720 &&
      diffLlegadaRepliegue >= 0 &&
      diffLlegadaRepliegue <= 720 &&
      duracionTotal >= 0 &&
      duracionTotal <= 720
    );
  }, [form.hora_alerta, form.hora_llegada, form.hora_repliegue]);

  const hayFotosSubiendo = fotos.some((f) => f.uploading);

  const canAdvance = useMemo(() => {
    if (step === 1) {
      const hasBasics =
        !!form.id_tipo_patrullaje &&
        !!form.id_modalidad_patrullaje &&
        !!form.turno &&
        !!form.id_origen;
      if (Number(form.id_tipo_patrullaje) === ID_PATRULLAJE_MOTORIZADO) {
        return hasBasics && form.vehiculos_detalle.length > 0;
      }
      return hasBasics;
    }
    if (step === 2) {
      const camposLlenos =
        !!form.hora_alerta &&
        !!form.hora_llegada &&
        !!form.hora_repliegue &&
        !!form.fecha_evento;
      return camposLlenos && !tiemposInvalidos;
    }
    if (step === 3) {
      return !!form.id_lugar && (form.referencia || "").trim().length >= 3;
    }
    if (step === 4) {
      return (
        !!form.id_modalidad &&
        (form.descripcion || "").trim().length >= 3 &&
        !hayFotosSubiendo
      );
    }
    return false;
  }, [
    step,
    form.id_tipo_patrullaje,
    form.id_modalidad_patrullaje,
    form.turno,
    form.id_origen,
    form.vehiculos_detalle.length,
    form.hora_alerta,
    form.hora_llegada,
    form.hora_repliegue,
    form.fecha_evento,
    form.id_lugar,
    form.referencia,
    form.id_modalidad,
    form.descripcion,
    tiemposInvalidos,
    hayFotosSubiendo,
  ]);

  const firmaActiva = (form.descripcion || "").startsWith(TEXTO_CENTRAL_FIRMA);
  const textoDescripcionLibre = firmaActiva
    ? (form.descripcion || "")
        .replace(TEXTO_CENTRAL_FIRMA, "")
        .replace(/^[\n\r]+/, "")
    : form.descripcion || "";

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

  const fetchUnidades = useCallback(async (idTipo: number | string) => {
    unidadesControllerRef.current?.abort();
    const controller = new AbortController();
    unidadesControllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(
        `${API_URL}/catalogos/vehiculos-por-tipo/${idTipo}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isMountedRef.current) return;
      setCatalogos((prev) => ({
        ...prev,
        unidades: Array.isArray(data) ? data : [],
      }));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      console.error("Error al cargar unidades:", e);
      mostrarAlerta("Error", "No se pudieron cargar las placas del vehículo.");
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const agregarVehiculo = () => {
    if (!unidadForm.id_unidad) {
      return mostrarAlerta("Atención", "Seleccione una unidad/placa.");
    }

    const yaExiste = form.vehiculos_detalle.some(
      (v) => Number(v.id_unidad) === Number(unidadForm.id_unidad)
    );
    if (yaExiste) {
      return mostrarAlerta(
        "Atención",
        `La placa ${unidadForm.placa} ya ha sido agregada.`
      );
    }

    const esCamioneta = Number(unidadForm.id_tipo_vehiculo) === ID_CAMIONETA;
    const asignacionFinal = esCamioneta
      ? unidadForm.tipo_asignacion
      : "MUNICIPAL";
    const pnpFinal =
      esCamioneta && asignacionFinal === "INTEGRADO" ? unidadForm.id_pnp : null;

    if (asignacionFinal === "INTEGRADO" && !pnpFinal) {
      return mostrarAlerta("Atención", "Efectivo PNP requerido.");
    }

    const nuevaModalidadPatrullaje =
      asignacionFinal === "INTEGRADO" ? "3" : "2";

    const nombrePnp =
      (
        catalogos.pnps.find(
          (p: any) => String(p.value) === String(unidadForm.id_pnp)
        ) as any
      )?.label || "";

    setForm((f) => ({
      ...f,
      id_modalidad_patrullaje: nuevaModalidadPatrullaje,
      vehiculos_detalle: [
        ...f.vehiculos_detalle,
        {
          ...unidadForm,
          tipo_asignacion: asignacionFinal,
          id_pnp: pnpFinal,
          nombre_pnp: nombrePnp,
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

  const tomarFoto = async () => {
    const ocupados = new Set([
      ...fotosRef.current.map((f) => f.id),
      ...idsEnProcesoRef.current,
    ]).size;
    if (ocupados >= MAX_FOTOS) {
      return mostrarAlerta("Límite", `Máximo ${MAX_FOTOS} fotos.`);
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return mostrarAlerta("Error", "Sin permiso de cámara.");
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      await procesarYSubirImagen(
        Platform.OS === "web" ? asset.file || asset.uri : asset.uri
      );
    }
  };

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
      return mostrarAlerta(
        "Atención",
        "No se pudo identificar al usuario. Verifique su conexión o reinicie sesión."
      );
    }

    if (fotos.some((f) => f.uploading)) {
      return mostrarAlerta(
        "Espere",
        "Las fotos aún se están subiendo a la nube."
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

      const res = await fetch(`${API_URL}/ocurrencias/registrar/modr2`, {
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
        }),
        signal: controller.signal,
      });

      limpiarTimers();
      if (!isMountedRef.current) return;

      if (res.ok) {
        setUploadProgress(100);
        setUploadStatus("¡Listo! Subido");
        setIsFinished(true);

        timeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          submittingRef.current = false;
          setLoading(false);
          limpiarFormulario();
          router.replace("/principalmovilidad");
        }, 1200);
      } else {
        let mensajeError = "No se pudo guardar el registro.";
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
          onPress={() => {
            setForm((prev) => {
              if (
                field === "id_tipo_patrullaje" &&
                Number(item.value) !== ID_PATRULLAJE_MOTORIZADO
              ) {
                return {
                  ...prev,
                  [field]: item.value,
                  vehiculos_detalle: [],
                  id_modalidad_patrullaje: "10",
                };
              }
              return { ...prev, [field]: item.value };
            });
          }}
          style={[
            styles.mosaicoItem,
            currentId === item.value && styles.mosaicoSelected,
          ]}
        >
          <Ionicons
            name={(item.icon || iconDefault) as any}
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

  return (
    <ThemedView
      style={[
        styles.main,
        {
          
          backgroundColor: "#f4f7f6",
        },
      ]}
    >
      <View style={styles.stepperContainer}>
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
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>
              PASO 1: DESPACHO
            </ThemedText>

            <View style={styles.gpsBox}>
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
              <ThemedText style={{ fontSize: 11, color: "#000", marginTop: 2 }}>
                {form.nombre_punto_gps || "CSI MDJM"}
              </ThemedText>
            </View>

            <ThemedText style={styles.label}>
              ¿A QUÉ TURNO PERTENECE ESTE REPORTE?
            </ThemedText>
            <View style={{ marginBottom: 10 }}>
              {renderMosaicos(
                [
                  { label: "MAÑANA", value: "M" },
                  { label: "TARDE", value: "T"},
                  { label: "NOCHE", value: "N"},
                ],
                form.turno,
                "turno",
                "time-outline"
              )}
            </View>

            <ThemedText style={styles.label}>TIPO DE PATRULLAJE</ThemedText>
            {renderMosaicos(
              catalogos.tipos_patrullaje,
              form.id_tipo_patrullaje,
              "id_tipo_patrullaje",
              "shield-checkmark-outline"
            )}

            {Number(form.id_tipo_patrullaje) === ID_PATRULLAJE_MOTORIZADO && (
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

                {form.vehiculos_detalle.length === 0 ? (
                  <>
                    <Dropdown
                      containerStyle={styles.dropdownContainer}
                      itemTextStyle={styles.itemText}
                      selectedTextStyle={styles.selectedTextStyle}
                      placeholderStyle={{ color: "#666", fontSize: 14 }}
                      style={[styles.dropdown, styles.dropdownWhite]}
                      data={catalogos.tipos_vehiculo}
                      labelField="label"
                      valueField="value"
                      placeholder="Seleccione Tipo Vehículo"
                      value={unidadForm.id_tipo_vehiculo}
                      activeColor="#E3F2FD"
                      onChange={(v) => {
                        setUnidadForm({
                          id_tipo_vehiculo: v.value,
                          id_unidad: null,
                          placa: "",
                          tipo_asignacion: "MUNICIPAL",
                          id_pnp: null,
                        });
                        fetchUnidades(v.value);
                      }}
                    />

                    {unidadForm.id_tipo_vehiculo && (
                      <>
                        {Number(unidadForm.id_tipo_vehiculo) ===
                          ID_CAMIONETA && (
                          <View style={{ marginTop: 15, gap: 10 }}>
                            <ThemedText
                              style={[
                                styles.label,
                                { fontSize: 11, marginBottom: 5, marginTop: 0 },
                              ]}
                            >
                              TIPO DE ASIGNACIÓN
                            </ThemedText>
                            <View style={styles.asignacionContainer}>
                              {(["MUNICIPAL", "INTEGRADO"] as const).map(
                                (tipo) => (
                                  <Pressable
                                    key={tipo}
                                    onPress={() =>
                                      setUnidadForm((prev) => ({
                                        ...prev,
                                        tipo_asignacion: tipo,
                                        id_pnp: null,
                                      }))
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
                                )
                              )}
                            </View>

                            {unidadForm.tipo_asignacion === "INTEGRADO" && (
                              <Dropdown
                                containerStyle={styles.dropdownContainer}
                                itemTextStyle={styles.itemText}
                                selectedTextStyle={styles.selectedTextStyle}
                                placeholderStyle={{
                                  color: "#666",
                                  fontSize: 14,
                                }}
                                inputSearchStyle={styles.inputSearchStyle}
                                style={[styles.dropdown, styles.dropdownWhite]}
                                data={catalogos.pnps}
                                search
                                searchPlaceholder="Buscar efectivo PNP..."
                                searchQuery={filtroOptimizado}
                                labelField="label"
                                valueField="value"
                                placeholder="Seleccionar Efectivo PNP"
                                value={unidadForm.id_pnp}
                                activeColor="#E3F2FD"
                                flatListProps={{
                                  nestedScrollEnabled: true,
                                  keyboardShouldPersistTaps: "handled",
                                  initialNumToRender: 15,
                                  maxToRenderPerBatch: 15,
                                  windowSize: 5,
                                }}
                                onChange={(v) =>
                                  setUnidadForm((prev) => ({
                                    ...prev,
                                    id_pnp: v.value,
                                  }))
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
                              containerStyle={styles.dropdownContainer}
                              itemTextStyle={styles.itemText}
                              selectedTextStyle={styles.selectedTextStyle}
                              placeholderStyle={{ color: "#666", fontSize: 14 }}
                              inputSearchStyle={styles.inputSearchStyle}
                              style={[styles.dropdown, styles.dropdownWhite]}
                              data={catalogos.unidades}
                              search
                              searchPlaceholder="Buscar placa..."
                              searchQuery={filtroOptimizado}
                              labelField="label"
                              valueField="value"
                              placeholder="Seleccione Placa"
                              value={unidadForm.id_unidad}
                              activeColor="#E3F2FD"
                              flatListProps={{
                                nestedScrollEnabled: true,
                                keyboardShouldPersistTaps: "handled",
                                initialNumToRender: 15,
                                maxToRenderPerBatch: 15,
                                windowSize: 5,
                              }}
                              onChange={(v) =>
                                setUnidadForm((prev) => ({
                                  ...prev,
                                  id_unidad: v.value,
                                  placa: v.label,
                                }))
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

                {form.vehiculos_detalle.length > 0 && (
                  <View style={styles.listadoUnidadesContainer}>
                    <View style={styles.listadoHeader}>
                      <ThemedText style={styles.listadoTitle}>
                        UNIDAD REGISTRADA EN EL REPORTE (1)
                      </ThemedText>
                    </View>

                    {form.vehiculos_detalle.map((v, index) => (
                      <View key={v.id_unidad ?? index} style={styles.unitCard}>
                        <View style={styles.unitCardIcon}>
                          <Ionicons
                            name={
                              Number(v.id_tipo_vehiculo) === ID_CAMIONETA
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
                          onPress={() =>
                            setForm((prev) => ({
                              ...prev,
                              id_modalidad_patrullaje: "10",
                              vehiculos_detalle: prev.vehiculos_detalle.filter(
                                (_, i) => i !== index
                              ),
                            }))
                          }
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
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>PASO 2: TIEMPOS</ThemedText>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <ThemedText
                style={[styles.cascadaTitle, { marginLeft: 5, fontSize: 12 }]}
              >
                FECHA
              </ThemedText>
              <Pressable
                onPress={() =>
                  setForm((prev) => ({ ...prev, fecha_evento: getHoy() }))
                }
                style={styles.btnHoy}
              >
                <ThemedText style={styles.btnHoyText}>PONER HOY</ThemedText>
              </Pressable>
            </View>

            {Platform.OS === "web" ? (
              <input
                type="date"
                value={form.fecha_evento ?? ""}
                max={getHoy()}
                onChange={(e) => {
                  const fechaSeleccionada = e.target.value;
                  const hoyStr = getHoy();
                  if (!fechaSeleccionada) {
                    setForm((prev) => ({ ...prev, fecha_evento: hoyStr }));
                  } else if (fechaSeleccionada > hoyStr) {
                    mostrarAlerta(
                      "Atención",
                      "No se pueden registrar ocurrencias con fechas futuras."
                    );
                    setForm((prev) => ({ ...prev, fecha_evento: hoyStr }));
                  } else {
                    setForm((prev) => ({
                      ...prev,
                      fecha_evento: fechaSeleccionada,
                    }));
                  }
                }}
                style={webInputStyle}
              />
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
                  styles.pickerPressable,
                  { backgroundColor: "#FFFFFF" },
                  getDynamicBorderStyle(form.fecha_evento),
                ]}
              >
                <Ionicons name="calendar-outline" size={20} color={MJM_BLUE} />
                <ThemedText style={{ color: "#000", marginLeft: 10, flex: 1 }}>
                  {formatearFechaEspañol(form.fecha_evento)}
                </ThemedText>
              </Pressable>
            )}

            {(["hora_alerta", "hora_llegada", "hora_repliegue"] as const).map(
              (k) => (
                <View key={k} style={{ marginTop: 15 }}>
                  <ThemedText style={styles.label}>
                    {k.toUpperCase().replace("_", " ")}
                  </ThemedText>
                  <View style={styles.timeRow}>
                    {Platform.OS === "web" ? (
                      <input
                        type="time"
                        value={form[k] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((prev) => ({ ...prev, [k]: val }));
                        }}
                        style={{ ...webInputStyle, flex: 1 }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => {
                          setPickerMode("time");
                          setActiveField(k);
                          const currentTime = form[k];
                          const date = new Date();
                          if (currentTime && currentTime !== "00:00") {
                            const [hours, minutes] = currentTime.split(":");
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
                        <ThemedText style={{ color: "#000", marginLeft: 10 }}>
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
              )
            )}

            {form.hora_alerta &&
            form.hora_llegada &&
            form.hora_repliegue &&
            tiemposInvalidos ? (
              <View style={styles.timeErrorBox}>
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color="#D32F2F"
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.timeErrorTitle}>
                    Error en los intervalos de tiempo
                  </ThemedText>
                  <ThemedText style={styles.timeErrorText}>
                    • El orden debe ser: Repliegue ≥ Llegada ≥ Alerta.
                  </ThemedText>
                  <ThemedText style={styles.timeErrorText}>
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
            <ThemedText style={styles.sectionTitle}>
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
                  flex: 1,
                }}
              >
                LUGAR CONSOLIDADO (AV. , CA. , JR. , PSJ. , PQ. , PLZ. , EDF. ,
                BLK.):
              </ThemedText>
            </View>

            <View style={{ marginBottom: 10 }}>
              <Dropdown
                containerStyle={styles.dropdownContainer}
                itemTextStyle={styles.itemText}
                selectedTextStyle={{ color: "#000", fontSize: 14 }}
                style={[
                  styles.dropdown,
                  styles.dropdownWhite,
                  getDynamicBorderStyle(form.id_lugar),
                ]}
                data={catalogos.lugares}
                search
                searchPlaceholder="Buscar dirección..."
                labelField="label"
                valueField="value"
                placeholder="Seleccione la ubicación..."
                value={form.id_lugar}
                onFocus={() =>
                  setForm((prev) => ({
                    ...prev,
                    id_lugar: null,
                  }))
                }
                searchQuery={filtroOptimizado}
                placeholderStyle={{ color: "#666" }}
                onChange={(item) =>
                  setForm((prev) => ({
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
                inputSearchStyle={styles.inputSearchStyle}
              />
            </View>

            <View style={{ marginTop: 20 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginVertical: 4,
                }}
              >
                <Ionicons name="location-outline" size={14} color={MJM_BLUE} />
                <ThemedText
                  style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
                >
                  REFERENCIA:
                </ThemedText>
              </View>
              <TextInput
                style={[
                  styles.textAreaSmall,
                  {
                    borderColor:
                      (form.referencia || "").trim().length >= 3
                        ? MJM_BLUE
                        : "#DDD",
                  },
                ]}
                placeholder="Ej: Escriba una referencia cercana o indique el numeral exacto si lo conoce."
                placeholderTextColor="#AAA"
                maxLength={300}
                value={form.referencia ?? ""}
                onChangeText={(t) => {
                  const cap = t.charAt(0).toUpperCase() + t.slice(1);
                  setForm((prev) => ({ ...prev, referencia: cap }));
                }}
                multiline
              />
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>PASO 4: CIERRE</ThemedText>

            <ThemedText
              style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
            >
              MODALIDAD:
            </ThemedText>
            <Dropdown
              containerStyle={styles.dropdownContainer}
              itemTextStyle={styles.itemText}
              selectedTextProps={{ numberOfLines: 1 }}
              selectedTextStyle={{
                color: "#000",
                fontSize: 14,
                flex: 1,
                marginRight: 15,
              }}
              style={[
                styles.dropdown,
                styles.dropdownWhite,
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
              onFocus={() => setForm((prev) => ({ ...prev, id_modalidad: "" }))}
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
              inputSearchStyle={styles.inputSearchStyle}
            />

            {/* DESCRIPCIÓN */}
            <View style={{ marginTop: 15, marginBottom: 10 }}>
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
                  style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
                >
                  DATOS IMPORTANTES
                </ThemedText>
              </View>

              <Pressable
                onPress={() => {
                  setForm((prev) => {
                    const actual = prev.descripcion || "";
                    if (actual.startsWith(TEXTO_CENTRAL_FIRMA)) {
                      const limpio = actual
                        .replace(TEXTO_CENTRAL_FIRMA, "")
                        .replace(/^[\n\r]+/, "")
                        .trimStart();
                      return { ...prev, descripcion: limpio };
                    }
                    const limpioActual = actual.trim();
                    const capitalizadoActual =
                      limpioActual.length > 0
                        ? limpioActual.charAt(0).toUpperCase() +
                          limpioActual.slice(1)
                        : limpioActual;
                    return {
                      ...prev,
                      descripcion:
                        capitalizadoActual.length === 0
                          ? TEXTO_CENTRAL_FIRMA
                          : `${TEXTO_CENTRAL_FIRMA}\n${capitalizadoActual}`,
                    };
                  });
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  backgroundColor: firmaActiva ? MJM_BLUE : "#E3F2FD",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 6,
                  marginBottom: 8,
                  gap: 6,
                }}
              >
                <Ionicons
                  name={firmaActiva ? "checkbox-outline" : "square-outline"}
                  size={14}
                  color={firmaActiva ? "#FFF" : MJM_BLUE}
                />
                <ThemedText
                  style={{
                    fontSize: 10,
                    fontWeight: "bold",
                    color: firmaActiva ? "#FFF" : MJM_BLUE,
                  }}
                >
                  POR ORDEN DE LA CENTRAL
                </ThemedText>
              </Pressable>

              <View
                style={[
                  styles.descripcionBox,
                  getDynamicBorderStyle(
                    (form.descripcion || "").trim().length >= 3
                  ),
                ]}
              >
                {firmaActiva && (
                  <View style={styles.firmaBadge}>
                    <ThemedText
                      style={{
                        fontSize: 8,
                        fontWeight: "bold",
                        color: "#475569",
                      }}
                    >
                      {TEXTO_CENTRAL_FIRMA}
                    </ThemedText>
                  </View>
                )}

                <TextInput
                  style={[
                    styles.descripcionInput,
                    Platform.OS === "web" &&
                      ({ outlineStyle: "none", boxShadow: "none" } as any),
                  ]}
                  placeholder="Escribe todos los detalles aquí..."
                  placeholderTextColor="#999999"
                  multiline={true}
                  maxLength={1500}
                  scrollEnabled={true}
                  value={textoDescripcionLibre ?? ""}
                  onChangeText={(t) => {
                    const textoCapitalizado =
                      t.length > 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t;

                    setForm((prev) => ({
                      ...prev,
                      descripcion: (prev.descripcion || "").startsWith(
                        TEXTO_CENTRAL_FIRMA
                      )
                        ? textoCapitalizado.length > 0
                          ? `${TEXTO_CENTRAL_FIRMA}\n${textoCapitalizado}`
                          : TEXTO_CENTRAL_FIRMA
                        : textoCapitalizado,
                    }));
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
                <Pressable
                  style={[styles.btnCamAction, { backgroundColor: MJM_BLUE }]}
                  onPress={seleccionarGaleria}
                >
                  <Ionicons name="images" size={20} color="white" />
                  <ThemedText style={styles.btnCamText}>
                    Examinar Archivos
                  </ThemedText>
                </Pressable>

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
                  style={[styles.btnCamAction, { backgroundColor: MJM_BLUE }]}
                  onPress={tomarFoto}
                >
                  <Ionicons name="camera" size={20} color="white" />
                  <ThemedText style={styles.btnCamText}>Cámara</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.btnCamAction, { backgroundColor: "#444" }]}
                  onPress={seleccionarGaleria}
                >
                  <Ionicons name="images" size={20} color="white" />
                  <ThemedText style={styles.btnCamText}>Galería</ThemedText>
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
              <ScrollView
                horizontal
                style={[styles.photoCarousel, { maxHeight: 110 }]}
                contentContainerStyle={{ paddingTop: 8, gap: 12 }}
                showsHorizontalScrollIndicator={false}
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
                        <ActivityIndicator size="small" color="#FFFFFF" />
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
                  backgroundColor: canAdvance ? "#2E7D32" : "#A0A0A0",
                  opacity: canAdvance ? 1 : 0.6,
                },
              ]}
              onPress={enviarRegistro}
              disabled={!canAdvance || loading}
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                {loading
                  ? "ENVIANDO..."
                  : hayFotosSubiendo
                  ? "SUBIENDO FOTOS..."
                  : "FINALIZAR REGISTRO"}
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
            backgroundColor: "white",
            borderTopColor: "#eeeeee",
          },
        ]}
      >
        <Pressable
          style={[styles.navBtn, { borderColor: "#bbbbbb" }]}
          onPress={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          <ThemedText style={{ color: step === 1 ? "#ccc" : MJM_BLUE }}>
            ANTERIOR
          </ThemedText>
        </Pressable>

        {step < 4 && (
          <Pressable
            style={[
              styles.navBtn,
              {
                backgroundColor: canAdvance ? MJM_BLUE : "#cccccc",
                borderColor: canAdvance ? MJM_BLUE : "#dddddd",
              },
            ]}
            onPress={() => setStep((s) => Math.min(4, s + 1))}
            disabled={!canAdvance}
          >
            <ThemedText style={{ color: "white" }}>SIGUIENTE</ThemedText>
          </Pressable>
        )}
      </View>

      {/* MODAL DE PROGRESO */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.progressTitle}>{uploadStatus}</ThemedText>
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

      {/* DATE/TIME PICKER NATIVO */}
      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={tempDate}
          mode={pickerMode}
          display={pickerMode === "date" ? "calendar" : "spinner"}
          is24Hour={true}
          maximumDate={pickerMode === "date" ? new Date() : undefined}
          onChange={pickerMode === "date" ? handleDateChange : handleTimeChange}
        />
      )}

      {Platform.OS === "ios" && showPicker && (
        <Modal transparent animationType="fade" visible={showPicker}>
          <View style={styles.modalOverlay}>
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
                locale="es-ES"
                themeVariant="light"
                onChange={
                  pickerMode === "date" ? handleDateChange : handleTimeChange
                }
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 15 }}>
                <Pressable
                  style={styles.btnCancelIOS}
                  onPress={() => {
                    setShowPicker(false);
                    setActiveField(null);
                  }}
                >
                  <ThemedText style={{ color: "#333" }}>Cancelar</ThemedText>
                </Pressable>
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
          </View>
        </Modal>
      )}
    </ThemedView>
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
  padding: "0 10px",
  fontSize: 16,
  backgroundColor: "#FFFFFF",
  color: "#000000",
  outline: "none",
};

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scroll: { paddingHorizontal: 15, paddingBottom: 100 },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  gpsBox: {
    backgroundColor: "#eef2ff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: MJM_BLUE,
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
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  stepperTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: MJM_BLUE,
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
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnTime: { backgroundColor: MJM_BLUE, padding: 10, borderRadius: 10 },
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
  timeErrorBox: {
    backgroundColor: "#FFF5F5",
    borderLeftWidth: 4,
    borderLeftColor: "#D32F2F",
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
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
  dropdown: {
    height: 44,
    borderWidth: 1,
    borderColor: "#ddd",
    marginTop: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  dropdownWhite: {
    backgroundColor: "white",
  },
  descripcionBox: {
    borderWidth: 1.5,
    borderColor: "#eee",
    backgroundColor: "#FFFFFF",
    height: 140,
    maxHeight: 140,
    padding: 12,
    borderRadius: 10,
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  firmaBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  descripcionInput: {
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
  photoCarousel: { marginTop: 15 },
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
    maxWidth: 320,
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
  itemText: {
    fontSize: 12,
    color: "#000",
  },
  selectedTextStyle: {
    fontSize: 14,
    color: "#000",
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 14,
    borderRadius: 8,
    color: "#000",
    paddingHorizontal: 10,
    backgroundColor: "#F9F9F9",
  },
  modalPickerContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "85%",
    alignItems: "center",
  },
  pickerTitle: { fontWeight: "bold", marginBottom: 15, color: MJM_BLUE },
  btnCancelIOS: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#eee",
  },
  btnConfirmIOS: {
    flex: 1,
    backgroundColor: MJM_BLUE,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
});