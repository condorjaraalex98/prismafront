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

interface RegistroSerInProps {
  visible: boolean;
  onClose: () => void;
  initialData?: any;
}

const MJM_BLUE = "#024885";
const MAX_FOTOS = 1;

const ZONAS_POR_PATRULLAJE: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  2: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  3: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  4: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  5: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  6: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
  7: [10, 11, 12, 13, 34, 35, 36, 37, 38, 39, 40, 41, 42],
  8: [1, 2, 3, 4, 5, 25, 26, 27, 28, 29, 30, 31, 32, 33],
};

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

export default function RegistroSerIn({
  visible,
  onClose,
  initialData,
}: RegistroSerInProps) {
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
      id_modalidad: "139",
      id_origen: "9",
      id_tipo_patrullaje: null as number | null,
      id_modalidad_patrullaje: "",
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
      estadoOcurrencia: "VERIFICADO",
      referencia: "",
      id_radio: null as number | string | null,
      id_zona: null as number | string | null,
      unidad_encargada: "SERENAZGO",
      fecha_evento: getHoy(),
      grupo: null as any,
    }),
    [getHoy, userIdStable]
  );

  const [form, setForm] = useState(ESTADO_INICIAL);
  const [fotos, setFotos] = useState<FotoEstado[]>([]);

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("Subiendo...");
  const [isFinished, setIsFinished] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const [catalogos, setCatalogos] = useState({
    tipos_patrullaje: [] as any[],
    lugares: [] as any[],
    radios: [] as any[],
    zonas: [] as any[],
  });

  const fotosRef = useRef<FotoEstado[]>([]);
  fotosRef.current = fotos;

  const idsEnProcesoRef = useRef<Set<string>>(new Set());
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

  const limpiarFormulario = useCallback(() => {
    fotosRef.current.forEach((f) => liberarUriPreview(f.uri));
    idsEnProcesoRef.current.clear();
    setFotos([]);
    setForm({
      ...ESTADO_INICIAL,
      id_usuario: userIdStable,
      fecha_evento: getHoy(),
    });
  }, [liberarUriPreview, ESTADO_INICIAL, userIdStable, getHoy]);

  const cargarCatalogosInit = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const [resGral, resRadios, resZonas] = await Promise.all([
        fetch(`${API_URL}/catalogos/completo/lugarcecom?idTipoP=7`, {
          signal: controller.signal,
        }),
        fetch(`${API_URL}/catalogos/radios`, { signal: controller.signal }),
        fetch(`${API_URL}/catalogos/zonas`, { signal: controller.signal }),
      ]);

      if (!resGral.ok || !resRadios.ok || !resZonas.ok) {
        throw new Error("Error HTTP al cargar catálogos");
      }

      const [dataGral, dataRadios, dataZonas] = await Promise.all([
        resGral.json(),
        resRadios.json(),
        resZonas.json(),
      ]);

      if (!isMountedRef.current) return;
      catalogosCargadosRef.current = true;
      setCatalogos({
        tipos_patrullaje: dataGral.tipos_patrullaje || [],
        lugares: dataGral.lugares || [],
        radios: Array.isArray(dataRadios) ? dataRadios : [],
        zonas: Array.isArray(dataZonas) ? dataZonas : [],
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
    if (!visible) return;

    setForm((prev) => ({
      ...prev,
      ...(userIdStable ? { id_usuario: userIdStable } : {}),
      fecha_evento: getHoy(),
    }));

    if (!catalogosCargadosRef.current) {
      cargarCatalogosInit();
    }
    obtenerGpsAutomatico();
  }, [visible, userIdStable, getHoy, cargarCatalogosInit, obtenerGpsAutomatico]);

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
    indexar(catalogos.radios);
    indexar(catalogos.zonas);
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

  const zonasFiltradas = useMemo(() => {
    return catalogos.zonas.filter((zona: any) => {
      if (!form.id_tipo_patrullaje) return true;
      const zonasPermitidas =
        ZONAS_POR_PATRULLAJE[Number(form.id_tipo_patrullaje)];
      if (zonasPermitidas) {
        return zonasPermitidas.includes(Number(zona.value));
      }
      return true;
    });
  }, [catalogos.zonas, form.id_tipo_patrullaje]);

  const validation: Record<string, boolean> = useMemo(() => {
    const step1 = !!form.grupo && !!form.turno && !!form.id_tipo_patrullaje;

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

    const step3 = !!form.id_lugar && !!form.id_radio && !!form.id_zona;
    const step4 = (form.descripcion || "").trim().length >= 3;

    return { step1, step2, step3, step4 };
  }, [
    form.grupo,
    form.turno,
    form.id_tipo_patrullaje,
    form.hora_alerta,
    form.hora_llegada,
    form.hora_repliegue,
    form.fecha_evento,
    form.id_lugar,
    form.id_radio,
    form.id_zona,
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
  const formCompletoParaEnviar = formCompleto && !hayFotosSubiendo;

  const textoCentralFirma = "inicio de servicio";
  const firmaActiva = (form.descripcion || "").startsWith(textoCentralFirma);
  const textoDescripcionLibre = firmaActiva
    ? (form.descripcion || "")
        .replace(textoCentralFirma, "")
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

  const aplicarHoraRegistro = useCallback((selectedTime: Date) => {
    const horaStr = selectedTime.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    setForm((prev) => ({
      ...prev,
      hora_alerta: horaStr,
      hora_llegada: horaStr,
      hora_repliegue: horaStr,
    }));
  }, []);

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event?.type === "dismissed" || !selectedTime) return;
      aplicarHoraRegistro(selectedTime);
      return;
    }
    if (selectedTime) {
      setTempDate(selectedTime);
    }
  };

  const confirmIOSSelection = () => {
    aplicarHoraRegistro(tempDate);
    setShowPicker(false);
  };

  const capturarHoraActual = useCallback(() => {
    const ahora = new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    setForm((prev) => ({
      ...prev,
      hora_alerta: ahora,
      hora_llegada: ahora,
      hora_repliegue: ahora,
    }));
  }, []);

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
      return mostrarAlerta("Límite", `Máximo ${MAX_FOTOS} foto.`);
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
      return mostrarAlerta("Límite", `Máximo ${MAX_FOTOS} foto.`);
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
      return mostrarAlerta("Límite", `Máximo ${MAX_FOTOS} foto.`);
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: MAX_FOTOS > 1,
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
          onClose();
          router.replace("/cecomdoceh" as any);
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
          onPress={() =>
            setForm((prev) => ({
              ...prev,
              [field]: item.value,
              ...(field === "id_tipo_patrullaje" ? { id_zona: null } : {}),
            }))
          }
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
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!loading) onClose();
          }}
        />

        <View style={styles.modalContent}>
          {/* Cabecera del Modal */}
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>INICIO SERVICIO</ThemedText>
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
            {/* Stepper */}
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

                    <ThemedText
                      style={[styles.labelMicro, { marginBottom: 5 }]}
                    >
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
                  <ThemedText style={styles.headerStepText}>
                    2. TEMPORALIDAD
                  </ThemedText>
                </View>

                <View style={styles.columnBody}>
                  <View style={styles.cascadaContainer}>
                    <ThemedText
                      style={[styles.labelMicro, { marginBottom: 5 }]}
                    >
                      FECHA:
                    </ThemedText>

                    {Platform.OS === "web" ? (
                      <View style={{ width: "100%", marginBottom: 15 }}>
                        <input
                          type="date"
                          value={form.fecha_evento}
                          min={getHoy()}
                          max={getHoy()}
                          readOnly
                          style={webReadonlyInputStyle}
                        />
                      </View>
                    ) : (
                      <View style={styles.readonlyDateBox}>
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color={MJM_BLUE}
                        />
                        <ThemedText
                          style={{ color: "#333", marginLeft: 10, flex: 1 }}
                        >
                          {formatearFechaEspañol(form.fecha_evento)}
                        </ThemedText>
                        <Ionicons name="lock-closed" size={14} color="#888" />
                      </View>
                    )}

                    {/* Campo Hora de Registro */}
                    <View style={{ marginBottom: 15 }}>
                      <ThemedText
                        style={[styles.labelMicro, { marginBottom: 5 }]}
                      >
                        HORA REGISTRO:
                      </ThemedText>

                      <View style={styles.timeRow}>
                        {Platform.OS === "web" ? (
                          <View style={styles.webReadonlyTimeBox}>
                            <ThemedText
                              style={{ fontSize: 16, color: "#333333" }}
                            >
                              {form.hora_alerta || "--:--"}
                            </ThemedText>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => {
                              const currentTime = form.hora_alerta;
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
                              { flex: 1, backgroundColor: "#FFF", height: 45 },
                            ]}
                          >
                            <Ionicons
                              name="time-outline"
                              size={20}
                              color={MJM_BLUE}
                            />
                            <ThemedText
                              style={{
                                color: form.hora_alerta ? "#000" : "#888",
                                marginLeft: 10,
                                flex: 1,
                              }}
                            >
                              {formatearHora24h(form.hora_alerta)}
                            </ThemedText>
                            <Ionicons
                              name="chevron-down"
                              size={18}
                              color="#ccc"
                            />
                          </Pressable>
                        )}

                        <Pressable
                          style={[
                            styles.btnTime,
                            {
                              paddingHorizontal: 15,
                              height: 45,
                              justifyContent: "center",
                            },
                          ]}
                          onPress={capturarHoraActual}
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
                          setForm((prev) => ({
                            ...prev,
                            id_lugar: "",
                          }));
                        }}
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
                        inputSearchStyle={styles.dropdownSearchInput}
                      />
                    </View>

                    {/* Sección Radio */}
                    <View style={{ marginTop: 10 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 5,
                        }}
                      >
                        <ThemedText style={styles.labelMicro}>
                          RADIO{" "}
                          <ThemedText
                            style={{
                              fontSize: 9,
                              fontWeight: "normal",
                              color: "#666",
                            }}
                          >
                            (O elija "No corresponde")
                          </ThemedText>
                        </ThemedText>
                        <Pressable
                          style={{
                            backgroundColor:
                              form.id_radio === 110 ? MJM_BLUE : "#e2e8f0",
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                          onPress={() =>
                            setForm((prev) => ({ ...prev, id_radio: 110 }))
                          }
                        >
                          <ThemedText
                            style={{
                              fontSize: 9,
                              fontWeight: "bold",
                              color:
                                form.id_radio === 110 ? "white" : "#475569",
                            }}
                          >
                            {form.id_radio === 110
                              ? "✓ No corresponde"
                              : "+ No corresponde"}
                          </ThemedText>
                        </Pressable>
                      </View>

                      <Dropdown
                                    maxHeight={280}
                                    containerStyle={styles.dropdownContainer}
                                    itemContainerStyle={styles.dropdownItemContainer}
                                    itemTextStyle={styles.dropdownItemText}
                                    selectedTextProps={{ numberOfLines: 1 }}
                                    style={styles.dropdown}
                                    data={catalogos.radios}
                                    search
                                    searchPlaceholder="Buscar radio..."
                                    searchQuery={filtroOptimizado}
                                    labelField="label"
                                    valueField="value"
                                    placeholder="Seleccione Radio"
                                    value={form.id_radio}
                                    onFocus={() => {
                                      setForm((prev) => ({ ...prev, id_radio: null }));
                                    }}
                                    onChange={(v) => setForm({ ...form, id_radio: v.value })}
                                    placeholderStyle={{ color: "#666", fontSize: 14 }}
                                    selectedTextStyle={{
                                      color: "#000",
                                      fontSize: 14,
                                   
                                    }}
                                    flatListProps={{
                                      nestedScrollEnabled: true,
                                      keyboardShouldPersistTaps: "handled",
                                    }}
                                    activeColor="#E3F2FD"
                                    inputSearchStyle={styles.inputSearchStyle}
                                  />
                    </View>

                    {/* Sección CARGO - RESPONSABILIDAD */}
                    <View style={{ marginTop: 15 }}>
                      <ThemedText
                        style={[styles.labelMicro, { marginBottom: 5 }]}
                      >
                        CARGO - RESPONSABILIDAD
                      </ThemedText>
                      <Dropdown
                                    maxHeight={280}
                                    containerStyle={styles.dropdownContainer}
                                    itemContainerStyle={styles.dropdownItemContainer}
                                    itemTextStyle={styles.dropdownItemText}
                                    selectedTextProps={{ numberOfLines: 1 }}
                                    style={styles.dropdown}
                                    data={zonasFiltradas}
                                    search
                                    searchPlaceholder="Buscar zona..."
                                    searchQuery={filtroOptimizado}
                                    labelField="label"
                                    valueField="value"
                                    placeholder="Seleccione Zona"
                                    value={form.id_zona}
                                    onFocus={() => {
                                      setForm((prev) => ({ ...prev, id_zona: null }));
                                    }}
                                    onChange={(v) => setForm({ ...form, id_zona: v.value })}
                                    placeholderStyle={{ color: "#666", fontSize: 14 }}
                                    selectedTextStyle={{
                                      color: "#000",
                                      fontSize: 14,
                               
                                    }}
                                    flatListProps={{
                                      nestedScrollEnabled: true,
                                      keyboardShouldPersistTaps: "handled",
                                    }}
                                    activeColor="#E3F2FD"
                                    inputSearchStyle={styles.inputSearchStyle}
                                  />
                    </View>
                  </View>
                </View>
              </View>

              {/* COLUMNA 4: CIERRE Y EVIDENCIA */}
              <View style={styles.webColumn}>
                <View style={styles.headerStepWeb}>
                  <Ionicons name="checkmark-circle" size={18} color="white" />
                  <ThemedText style={styles.headerStepText}>
                    4. CIERRE DE REGISTRO
                  </ThemedText>
                </View>

                <View style={styles.columnBody}>
                  <View style={styles.cascadaContainer}>
                    {/* DESCRIPCIÓN */}
                    <View style={{ marginBottom: 10 }}>
                      <ThemedText
                        style={[styles.labelMicro, { marginBottom: 5 }]}
                      >
                        DATOS IMPORTANTES
                      </ThemedText>

                      <Pressable
                        onPress={() => {
                          setForm((prev) => {
                            const actual = prev.descripcion || "";
                            if (actual.startsWith(textoCentralFirma)) {
                              const limpio = actual
                                .replace(textoCentralFirma, "")
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
                                  ? `${textoCentralFirma}\n\n`
                                  : `${textoCentralFirma}\n\n${capitalizadoActual}`,
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
                          marginBottom: 6,
                          gap: 6,
                        }}
                      >
                        <Ionicons
                          name={
                            firmaActiva ? "checkbox-outline" : "square-outline"
                          }
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
                          inicio de servicio
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
                              {textoCentralFirma}
                            </ThemedText>
                          </View>
                        )}

                        <TextInput
                          style={[
                            styles.descripcionInput,
                            Platform.OS === "web" &&
                              ({
                                outlineStyle: "none",
                                boxShadow: "none",
                              } as any),
                          ]}
                          placeholder="Registre los datos de la persona que relevó u otros datos importantes"
                          placeholderTextColor="#999999"
                          multiline={true}
                          maxLength={1500}
                          scrollEnabled={true}
                          value={textoDescripcionLibre}
                          onChangeText={(t) => {
                            const textoCapitalizado =
                              t.length > 0
                                ? t.charAt(0).toUpperCase() + t.slice(1)
                                : t;

                            setForm((prev) => ({
                              ...prev,
                              descripcion: prev.descripcion.startsWith(
                                textoCentralFirma
                              )
                                ? textoCapitalizado.length > 0
                                  ? `${textoCentralFirma}\n${textoCapitalizado}`
                                  : textoCentralFirma
                                : textoCapitalizado,
                            }));
                          }}
                        />
                      </View>
                    </View>

                    {/* ZONA DE FOTOS */}
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

                        <View style={styles.dropZoneContainer}>
                          <Ionicons
                            name="cloud-upload-outline"
                            size={24}
                            color={MJM_BLUE}
                          />
                          <ThemedText style={styles.dropZoneText}>
                            O arrastra tu imagen aquí
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
                          onPress={tomarFoto}
                        >
                          <Ionicons name="camera" size={20} color="white" />
                          <ThemedText style={styles.btnCamText}>
                            Cámara
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.btnCamAction,
                            { backgroundColor: "#444" },
                          ]}
                          onPress={seleccionarGaleria}
                        >
                          <Ionicons name="images" size={20} color="white" />
                          <ThemedText style={styles.btnCamText}>
                            Galería
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
            mode="time"
            is24Hour={true}
            onChange={handleTimeChange}
          />
        )}

        {Platform.OS === "ios" && showPicker && (
          <Modal transparent animationType="fade" visible={showPicker}>
            <View style={styles.modalCenterOverlay}>
              <View style={styles.modalPickerContent}>
                <ThemedText style={styles.pickerTitle}>
                  Seleccionar Hora
                </ThemedText>
                <DateTimePicker
                  value={tempDate}
                  mode="time"
                  display="spinner"
                  is24Hour={true}
                  onChange={handleTimeChange}
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

        {/* Overlay de progreso */}
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

const webReadonlyInputStyle: CSSProperties = {
  height: 45,
  width: "100%",
  boxSizing: "border-box",
  borderWidth: 1,
  borderColor: "#ccc",
  borderStyle: "solid",
  borderRadius: 8,
  fontSize: 15,
  padding: "0 10px",
  backgroundColor: "#F5F5F5",
  color: "#333333",
  cursor: "not-allowed",
};

export const styles = StyleSheet.create({
modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "flex-end", // Mantiene el anclaje a la derecha
    paddingRight: 280,      // <--- Aumenta este número para mover el modal más a la izquierda (antes 200)
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
    alignItems: "stretch",
  },
  webColumn: {
    width: 315,
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
  inputSearchStyle: {
    height: 44,
    fontSize: 14,
    borderRadius: 8,
    color: "#000",
    paddingHorizontal: 10,
    backgroundColor: "#F9F9F9",
  },
  labelMicro: {
    fontSize: 10,
    color: MJM_BLUE,
    fontWeight: "bold",
  },
  readonlyDateBox: {
    height: 45,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  webReadonlyTimeBox: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    paddingHorizontal: 12,
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
  dropdownItemContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#1e293b",
    lineHeight: 20,
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
  },
  btnTime: {
    backgroundColor: MJM_BLUE,
    padding: 10,
    borderRadius: 10,
  },
  descripcionBox: {
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 8,
    height: 140,
    maxHeight: 140,
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