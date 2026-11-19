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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
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
const SCREEN_HEIGHT = Dimensions.get("window").height;

const normalizeText = (text: string): string =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeLugarText = (text: string): string =>
  normalizeText(text)
    .replace(/\./g, "")
    .replace(/\b(pq|porque)\b/g, "parque");

const formatearDateAYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatearHora24h = (horaStr: string) => {
  if (!horaStr) return "00:00";
  if (/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(horaStr)) {
    return horaStr;
  }
  return "00:00";
};

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

  const [modoBusquedaManual, setModoBusquedaManual] = useState(false);
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

  const [tiposVia, setTiposVia] = useState<any[]>([]);
  const [vias, setVias] = useState<any[]>([]);
  const [cuadras, setCuadras] = useState<any[]>([]);
  const [selTipoVia, setSelTipoVia] = useState<any>(null);
  const [selVia, setSelVia] = useState<any>(null);

  const [modalPlacaVisible, setModalPlacaVisible] = useState(false);
  const [busquedaPlaca, setBusquedaPlaca] = useState("");

  const [catalogos, setCatalogos] = useState({
    usuarios: [] as any[],
    modalidades: [] as any[],
    origenes: [] as any[],
    camaras: [] as any[],
    tipos_patrullaje: [] as any[],
    modalidades_patrullaje: [] as any[],
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

  const ESTADO_INICIAL = useMemo(
    () => ({
      id_usuario: userIdStable as number | null,
      id_lugar: null as any,
      id_modalidad: "89",
      id_origen: "10",
      id_tipo_patrullaje: null as any,
      id_modalidad_patrullaje: "1",
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
      unidad_encargada: "SERENAZGO",
      fecha_evento: getHoy(),
      grupo: null as any,
    }),
    [getHoy, userIdStable]
  );

  const [form, setForm] = useState(ESTADO_INICIAL);

  const fotosRef = useRef<FotoEstado[]>([]);
  fotosRef.current = fotos;

  const idsEnProcesoRef = useRef<Set<string>>(new Set());
  const catalogosCargadosRef = useRef(false);
  const isMountedRef = useRef(true);
  const submittingRef = useRef(false);
  const activeUploadControllersRef = useRef<Set<AbortController>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webCameraInputRef = useRef<HTMLInputElement | null>(null);

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

        let loc = await Location.getLastKnownPositionAsync({
          maxAge: 120000,
          requiredAccuracy: 150,
        });

        if (!loc) {
          loc = await conTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            5000,
            "Timeout GPS"
          );
        }

        lat = loc.coords.latitude;
        lon = loc.coords.longitude;

        if (isMountedRef.current) {
          setForm((prev) => ({
            ...prev,
            latitud_gps: lat.toString(),
            longitud_gps: lon.toString(),
          }));
        }

        try {
          const reverseGeocode = await conTimeout(
            Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }),
            4000,
            "Timeout Geocode"
          );

          if (reverseGeocode.length > 0) {
            const p = reverseGeocode[0] as any;
            direccionNombre = `${p.street || ""} ${p.streetNumber || ""}, ${
              p.district || p.city || ""
            }`.trim();
          }
        } catch {
          direccionNombre = "Ubicación identificada";
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
    setStep(1);
    fotosRef.current.forEach((f) => liberarUriPreview(f.uri));
    idsEnProcesoRef.current.clear();
    setFotos([]);
    setModoBusquedaManual(false);
    setSelTipoVia(null);
    setSelVia(null);
    setVias([]);
    setCuadras([]);
    setModalPlacaVisible(false);
    setBusquedaPlaca("");
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

  const cargarCatalogosInit = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const [resGral, resTiposV, resPnps] = await Promise.all([
        fetch(
          `${API_URL}/catalogos/completo/unificadov?tipoLugar=4&idTipoP=3`,
          { signal: controller.signal }
        ),
        fetch(`${API_URL}/catalogos/tipos-vehiculo`, {
          signal: controller.signal,
        }),
        fetch(`${API_URL}/catalogos/pnp-activos`, {
          signal: controller.signal,
        }),
      ]);

      const [data, tiposVehiculoData, pnpsData] = await Promise.all([
        resGral.json(),
        resTiposV.json(),
        resPnps.json(),
      ]);

      if (!isMountedRef.current) return;
      catalogosCargadosRef.current = true;

      const tiposVehiculoFiltrados = (tiposVehiculoData || []).filter(
        (t: any) => Number(t.value) === 4
      );

      setCatalogos({
        usuarios: data.usuarios || [],
        modalidades: data.modalidades || [],
        origenes: data.origenes || [],
        camaras: data.camaras || data.camara || [],
        tipos_patrullaje: data.tipos_patrullaje || [],
        modalidades_patrullaje: data.modalidades_patrullaje || [],
        tipos_vehiculo: tiposVehiculoFiltrados,
        unidades: [],
        pnps: pnpsData || [],
        lugares: data.lugares || [],
      });
      setTiposVia(data.tipos_via || []);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Error catálogos:", err);
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
  }, [userIdStable, getHoy]);

  useEffect(() => {
    if (!catalogosCargadosRef.current) {
      cargarCatalogosInit();
      obtenerGpsAutomatico();
    }
  }, [cargarCatalogosInit, obtenerGpsAutomatico]);

  // --- MEMOS PARA BÚSQUEDA RÁPIDA EN GAMA BAJA ---
  const tiposViaFiltrados = useMemo(
    () => (tiposVia || []).filter((item: any) => Number(item.value) !== 11),
    [tiposVia]
  );

  const labelNormMap = useMemo(() => {
    const map = new Map<string, string>();
    const indexar = (lista: any[]) => {
      for (const item of lista) {
        if (item?.label && !map.has(item.label)) {
          map.set(item.label, normalizeText(item.label));
        }
      }
    };
    indexar(catalogos.unidades);
    indexar(catalogos.pnps);
    indexar(vias);
    return map;
  }, [catalogos.unidades, catalogos.pnps, vias]);

  const lugarNormMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of catalogos.lugares) {
      if (item?.label && !map.has(item.label)) {
        map.set(item.label, normalizeLugarText(item.label));
      }
    }
    return map;
  }, [catalogos.lugares]);

  const filtroOptimizado = useCallback(
    (keyword: string, label: string) => {
      if (!keyword) return true;
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

  const filtroLugarOptimizado = useCallback(
    (keyword: string, label: string) => {
      if (!keyword) return true;
      const searchTerms = normalizeLugarText(keyword)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (searchTerms.length === 0) return true;
      const cleanLabel = lugarNormMap.get(label) ?? normalizeLugarText(label);
      return searchTerms.every((term) => cleanLabel.includes(term));
    },
    [lugarNormMap]
  );

  const placasFiltradas = useMemo(() => {
    const q = busquedaPlaca.trim();
    if (!q) return catalogos.unidades;
    return catalogos.unidades.filter((item: any) =>
      filtroOptimizado(q, item.label || "")
    );
  }, [catalogos.unidades, busquedaPlaca, filtroOptimizado]);

  const errorTiempos = useMemo(() => {
    if (!form.hora_alerta || !form.hora_llegada || !form.hora_repliegue) {
      return false;
    }
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
  }, [form.hora_alerta, form.hora_llegada, form.hora_repliegue]);

  const canAdvance = useCallback(() => {
    if (step === 1) {
      const hasBasics =
        !!form.id_tipo_patrullaje &&
        !!form.id_modalidad_patrullaje &&
        !!form.turno &&
        !!form.id_origen &&
        !!form.grupo;
      if (Number(form.id_tipo_patrullaje) === ID_PATRULLAJE_MOTORIZADO) {
        return hasBasics && form.vehiculos_detalle.length > 0;
      }
      return hasBasics;
    }

    if (step === 2) {
      const { hora_alerta, hora_llegada, hora_repliegue, fecha_evento } = form;
      const camposLlenos =
        !!hora_alerta && !!hora_llegada && !!hora_repliegue && !!fecha_evento;
      if (!camposLlenos) return false;
      return !errorTiempos;
    }

    if (step === 3) {
      const lugarValido = modoBusquedaManual
        ? cuadras.length > 0
          ? !!form.id_lugar
          : !!selVia
        : !!form.id_lugar;

      return lugarValido;
    }

    if (step === 4) {
      return form.descripcion.length > 3;
    }

    return false;
  }, [
    step,
    form,
    errorTiempos,
    modoBusquedaManual,
    cuadras.length,
    selVia,
  ]);

  const getDynamicBorderStyle = (value: any) => ({
    borderColor: value ? MJM_BLUE : "#ddd",
    borderWidth: value ? 1.5 : 1,
  });

  const procesarSeleccion = (selectedDate: Date) => {
    if (pickerMode === "date") {
      const hoy = new Date();
      const fechaFinal = selectedDate > hoy ? hoy : selectedDate;
      setForm((prev) => ({
        ...prev,
        fecha_evento: formatearDateAYYYYMMDD(fechaFinal),
      }));
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
      const fechaSeleccionadaStr = formatearDateAYYYYMMDD(tempDate);

      if (fechaSeleccionadaStr > hoyStr) {
        mostrarAlerta("Atención", "No se pueden seleccionar fechas futuras.");
        setForm((f) => ({ ...f, fecha_evento: hoyStr }));
      } else {
        setForm((f) => ({ ...f, fecha_evento: fechaSeleccionadaStr }));
      }
    } else if (activeField) {
      const horas = String(tempDate.getHours()).padStart(2, "0");
      const minutos = String(tempDate.getMinutes()).padStart(2, "0");
      setForm((f) => ({ ...f, [activeField]: `${horas}:${minutos}` }));
    }
    setShowPicker(false);
  };

  const fetchUnidades = async (idTipo: any) => {
    try {
      const res = await fetch(
        `${API_URL}/catalogos/vehiculos-por-tipo/${idTipo}`
      );
      const data = await res.json();
      if (isMountedRef.current) {
        setCatalogos((prev) => ({ ...prev, unidades: data || [] }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const agregarVehiculo = () => {
    if (!unidadForm.id_unidad) {
      return mostrarAlerta("Atención", "Seleccione una unidad/placa.");
    }

    const yaExiste = form.vehiculos_detalle.some(
      (v) => v.id_unidad === unidadForm.id_unidad
    );
    if (yaExiste) {
      return mostrarAlerta(
        "Atención",
        `La placa ${unidadForm.placa} ya ha sido agregada.`
      );
    }

    const esCamioneta =
      Number(unidadForm.id_tipo_vehiculo) === Number(ID_CAMIONETA);
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
                (p: any) => String(p.value) === String(pnpFinal)
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
      const data = await res.json();
      if (isMountedRef.current) setVias(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleViaChange = async (idVia: any) => {
    setSelVia(idVia);
    setForm((f) => ({ ...f, id_lugar: null }));
    try {
      const res = await fetch(`${API_URL}/catalogos/cuadras/${idVia}`);
      const data = await res.json();
      if (isMountedRef.current) setCuadras(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const capturarHoraActual = (campo: string) => {
    const now = new Date();
    const horas = String(now.getHours()).padStart(2, "0");
    const minutos = String(now.getMinutes()).padStart(2, "0");
    setForm((f) => ({ ...f, [campo]: `${horas}:${minutos}` }));
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
            f.id === id ? { ...f, url_remota: urlRemota, uploading: false } : f
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

    if (Platform.OS === "web") {
      webCameraInputRef.current?.click();
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return mostrarAlerta("Error", "Sin permiso de cámara.");
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
    });

    if (!res.canceled && res.assets[0]) {
      await procesarYSubirImagen(res.assets[0].uri);
    }
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
      quality: 0.75,
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

  const hayFotosSubiendo = fotos.some((f) => f.uploading);

  const enviarRegistro = async () => {
    if (submittingRef.current) return;

    const idFinal = form.id_usuario || userIdStable;
    if (!idFinal) {
      return mostrarAlerta("Atención", "No se pudo identificar al usuario.");
    }

    if (fotos.some((f) => f.uploading)) {
      return mostrarAlerta(
        "Espere un momento",
        "Las fotos aún se están subiendo a la nube. Reintente en unos segundos."
      );
    }

    submittingRef.current = true;
    limpiarTimers();
    setLoading(true);
    setUploadProgress(0);
    setUploadStatus("Subiendo...");
    setIsFinished(false);

    intervalRef.current = setInterval(
      () => setUploadProgress((p) => (p < 90 ? p + 10 : p)),
      150
    );

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
          id_camara: Array.isArray(form.id_camara)
            ? form.id_camara.map((c) => (c as any).value).join(",")
            : form.id_camara || "",
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
          obtenerGpsAutomatico();
          router.replace("/principal" as any);
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
            setForm((prev) => ({ ...prev, [field]: item.value }));
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

  const textoCentral = "POR ORDEN DE LA CENTRAL";
  const firmaCentralActiva = (form.descripcion || "").startsWith(textoCentral);
  const textoDescripcionLibre = firmaCentralActiva
    ? (form.descripcion || "")
        .replace(textoCentral, "")
        .replace(/^[\n\r]+/, "")
    : form.descripcion || "";

  return (
    <ThemedView
      style={[
        styles.main,
        {  backgroundColor: "#f4f7f6" },
      ]}
    >
      {Platform.OS === "web" && (
        <input
          ref={webCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) {
              await procesarYSubirImagen(file);
            }
          }}
        />
      )}

      <View style={styles.stepperContainer}>
        <ThemedText style={styles.stepperTitle}>
          CONDUCTOR AMBULANCIA:{" "}
        </ThemedText>
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
            <ThemedText style={styles.sectionTitle}>PASO 1: DESPACHO</ThemedText>

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
                <ThemedText
                  style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
                >
                  ENVIAR REPORTE DESDE:
                </ThemedText>
              </View>
              <ThemedText style={{ fontSize: 11, color: "#000000", marginTop: 2 }}>
                {form.nombre_punto_gps || "CSI MDJM"}
              </ThemedText>
            </View>

            <ThemedText style={styles.label}>GRUPO</ThemedText>
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

            <ThemedText style={styles.label}>
              ¿A QUÉ TURNO PERTENECE ESTE REPORTE?
            </ThemedText>
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

            <ThemedText style={[styles.label, { color: "#333333" }]}>
              TIPO DE PATRULLAJE
            </ThemedText>
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
                    UNIDADES ASIGNADAS
                  </ThemedText>
                </View>

                <Dropdown
                  style={[styles.dropdown, { backgroundColor: "white" }]}
                  data={catalogos.tipos_vehiculo}
                  labelField="label"
                  valueField="value"
                  placeholder="Seleccione Tipo Vehículo"
                  value={unidadForm.id_tipo_vehiculo}
                  onChange={(v) => {
                    setBusquedaPlaca("");
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
                            style={[styles.dropdown, { backgroundColor: "white" }]}
                            data={catalogos.pnps}
                            search
                            searchPlaceholder="Buscar efectivo PNP..."
                            searchQuery={filtroOptimizado}
                            labelField="label"
                            valueField="value"
                            placeholder="Seleccionar Efectivo PNP"
                            value={unidadForm.id_pnp}
                            onChange={(v) =>
                              setUnidadForm({ ...unidadForm, id_pnp: v.value })
                            }
                            flatListProps={{
                              nestedScrollEnabled: true,
                              keyboardShouldPersistTaps: "handled",
                              initialNumToRender: 15,
                              maxToRenderPerBatch: 15,
                              windowSize: 5,
                            }}
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
                        <Pressable
                          onPress={() => {
                            setBusquedaPlaca("");
                            setModalPlacaVisible(true);
                          }}
                          style={[
                            styles.dropdown,
                            {
                              backgroundColor: "white",
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            },
                          ]}
                        >
                          <ThemedText
                            numberOfLines={1}
                            style={{
                              fontSize: 14,
                              color: unidadForm.placa ? "#000" : "#666",
                              flex: 1,
                            }}
                          >
                            {unidadForm.placa || "Seleccione Placa"}
                          </ThemedText>
                          <Ionicons name="chevron-down" size={18} color="#666" />
                        </Pressable>
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
                        style={[styles.unitCard, { backgroundColor: "#fff" }]}
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
                              (_, i) => i !== index
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
          <View style={[styles.card, { backgroundColor: "#FFF" }]}>
            <ThemedText style={styles.sectionTitle}>PASO 2: TIEMPOS</ThemedText>

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
                  setForm((prev) => ({ ...prev, fecha_evento: getHoy() }));
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
                <ThemedText style={[styles.label, { color: "#333333" }]}>
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

            {errorTiempos && (
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
            )}
          </View>
        )}

        {step === 3 && (
          <View style={styles.cascadaContainer}>
            <ThemedText style={styles.sectionTitle}>
              PASO 3: UBICACIÓN
            </ThemedText>

            <View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <Ionicons name="location" size={18} color={MJM_BLUE} />
                  <ThemedText
                    style={[
                      styles.cascadaTitle,
                      { marginLeft: 5, flex: 1, fontSize: 11 },
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
                    style={{
                      color: MJM_BLUE,
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  >
                    {modoBusquedaManual ? "USAR LISTADO" : "POR CALLE/CUADRA"}
                  </ThemedText>
                </Pressable>
              </View>

              {!modoBusquedaManual && (
                <View style={{ marginBottom: 10 }}>
                  <Dropdown
                    maxHeight={320}
                    containerStyle={styles.dropdownContainer}
                    selectedTextStyle={{ color: "#000", fontSize: 14 }}
                    style={[
                      styles.dropdown,
                      { backgroundColor: "white", borderColor: MJM_BLUE },
                    ]}
                    data={catalogos.lugares}
                    search
                    searchPlaceholder="Buscar dirección..."
                    labelField="label"
                    valueField="value"
                    placeholder="Seleccione la ubicación..."
                    value={form.id_lugar}
                    onFocus={() => {
                      setForm((prev: any) => ({ ...prev, id_lugar: "" }));
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
                    searchQuery={filtroLugarOptimizado}
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
                      initialNumToRender: 15,
                      maxToRenderPerBatch: 15,
                      windowSize: 5,
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
                      data={tiposViaFiltrados}
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
                    <ThemedText style={styles.labelSubCascada}>
                      CALLE / VÍA
                    </ThemedText>
                    <Dropdown
                      maxHeight={280}
                      containerStyle={styles.dropdownContainer}
                      style={[
                        styles.dropdownCascadaItem,
                        !selTipoVia && styles.dropdownDisabled,
                      ]}
                      disable={!selTipoVia}
                      data={vias}
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
                      searchQuery={filtroOptimizado}
                      placeholderStyle={{ fontSize: 11, color: "#999" }}
                      selectedTextStyle={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: MJM_BLUE,
                      }}
                      flatListProps={{
                        nestedScrollEnabled: true,
                        keyboardShouldPersistTaps: "handled",
                        initialNumToRender: 15,
                        maxToRenderPerBatch: 15,
                        windowSize: 5,
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
                          setForm((prev: any) => ({
                            ...prev,
                            id_lugar: item.value,
                          }))
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
                  REFERENCIA
                </ThemedText>
              </View>
              <TextInput
                style={[
                  styles.textAreaSmall,
                  {
                    borderColor:
                      form.referencia.length >= 3 ? MJM_BLUE : "#DDD",
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
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>PASO 4: CIERRE</ThemedText>

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

              <Pressable
                onPress={() => {
                  const actual = form.descripcion || "";
                  if (actual.startsWith(textoCentral)) {
                    const limpio = actual
                      .replace(textoCentral, "")
                      .replace(/^[\n\r]+/, "")
                      .trimStart();
                    setForm((prev) => ({ ...prev, descripcion: limpio }));
                  } else {
                    const limpioActual = actual.trim();
                    const capitalizadoActual =
                      limpioActual.length > 0
                        ? limpioActual.charAt(0).toUpperCase() +
                          limpioActual.slice(1)
                        : limpioActual;
                    setForm((prev) => ({
                      ...prev,
                      descripcion:
                        capitalizadoActual.length === 0
                          ? textoCentral
                          : `${textoCentral}\n${capitalizadoActual}`,
                    }));
                  }
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  backgroundColor: firmaCentralActiva ? MJM_BLUE : "#E3F2FD",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 6,
                  marginBottom: 8,
                  gap: 6,
                }}
              >
                <Ionicons
                  name={
                    firmaCentralActiva ? "checkbox-outline" : "square-outline"
                  }
                  size={14}
                  color={firmaCentralActiva ? "#FFF" : MJM_BLUE}
                />
                <ThemedText
                  style={{
                    fontSize: 10,
                    fontWeight: "bold",
                    color: firmaCentralActiva ? "#FFF" : MJM_BLUE,
                  }}
                >
                  POR ORDEN DE LA CENTRAL
                </ThemedText>
              </Pressable>

              <View
                style={[
                  styles.textArea,
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
                {firmaCentralActiva && (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: "#F1F5F9",
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: 4,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: "#E2E8F0",
                    }}
                  >
                    <ThemedText
                      style={{
                        fontSize: 8,
                        fontWeight: "bold",
                        color: "#475569",
                      }}
                    >
                      {textoCentral}
                    </ThemedText>
                  </View>
                )}

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
                  value={textoDescripcionLibre}
                  onChangeText={(t) => {
                    const textoCapitalizado =
                      t.length > 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t;

                    setForm((prev) => ({
                      ...prev,
                      descripcion: firmaCentralActiva
                        ? textoCapitalizado.length > 0
                          ? `${textoCentral}\n${textoCapitalizado}`
                          : textoCentral
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

            <View style={[styles.photoActions, { marginTop: 5 }]}>
              <Pressable style={styles.btnCamAction} onPress={tomarFoto}>
                <Ionicons name="camera" size={20} color="white" />
              </Pressable>
              <Pressable
                style={[styles.btnCamAction, { backgroundColor: "#666" }]}
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

            {fotos.length > 0 && (
              <ScrollView
                horizontal
                style={[styles.photoCarousel, { maxHeight: 100 }]}
                showsHorizontalScrollIndicator={false}
              >
                {fotos.map((f, i) => (
                  <View key={f.id || i} style={styles.photoWrapper}>
                    <Image source={{ uri: f.uri }} style={styles.photoThumb} />
                    {f.uploading && (
                      <View style={styles.uploadingBadge}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    )}
                    <Pressable
                      style={styles.removePhoto}
                      onPress={() => {
                        liberarUriPreview(f.uri);
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
                  opacity:
                    canAdvance() && !hayFotosSubiendo && !loading ? 1 : 0.6,
                },
              ]}
              onPress={enviarRegistro}
              disabled={!canAdvance() || hayFotosSubiendo || loading}
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                {loading
                  ? "ENVIANDO..."
                  : hayFotosSubiendo
                  ? "SUBIENDO FOTO..."
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
            height: "auto",
            backgroundColor: "white",
            borderTopColor: "#eeeeee",
          },
        ]}
      >
        <Pressable
          style={[styles.navBtn, { borderColor: "#eeeeee" }]}
          onPress={() => setStep(step - 1)}
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
                backgroundColor: canAdvance() ? MJM_BLUE : "#cccccc",
                borderColor: canAdvance() ? MJM_BLUE : "#dddddd",
              },
            ]}
            onPress={() => setStep(step + 1)}
            disabled={!canAdvance()}
          >
            <ThemedText style={{ color: "white" }}>SIGUIENTE</ThemedText>
          </Pressable>
        )}
      </View>

      {/* MODAL SELECCIONAR PLACA / UNIDAD (VIRTUALIZADO) */}
      <Modal
        visible={modalPlacaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPlacaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalPlacaVisible(false)}
          />
          <View style={styles.modalPlacaBox}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <ThemedText
                style={{ fontSize: 15, fontWeight: "bold", color: MJM_BLUE }}
              >
                Seleccionar Placa / Unidad
              </ThemedText>
              <Pressable onPress={() => setModalPlacaVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#666" />
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.inputSearchStyle,
                {
                  borderWidth: 1,
                  borderColor: "#cbd5e1",
                  marginBottom: 10,
                },
              ]}
              placeholder="Buscar placa o N° unidad..."
              placeholderTextColor="#999"
              value={busquedaPlaca}
              onChangeText={setBusquedaPlaca}
              autoCapitalize="characters"
            />

            <FlatList
              data={placasFiltradas}
              keyExtractor={(item: any) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={15}
              maxToRenderPerBatch={15}
              windowSize={5}
              style={{ flex: 1, width: "100%" }}
              renderItem={({ item }: any) => {
                const seleccionada =
                  String(unidadForm.id_unidad) === String(item.value);
                return (
                  <Pressable
                    onPress={() => {
                      setUnidadForm((prev) => ({
                        ...prev,
                        id_unidad: item.value,
                        placa: item.label,
                      }));
                      setModalPlacaVisible(false);
                    }}
                    style={[
                      styles.dropdownItemContainer,
                      seleccionada && { backgroundColor: "#E3F2FD" },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.dropdownItemText,
                        seleccionada && {
                          color: MJM_BLUE,
                          fontWeight: "bold",
                        },
                      ]}
                    >
                      {item.label}
                    </ThemedText>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <ThemedText
                  style={{
                    textAlign: "center",
                    color: "#94a3b8",
                    marginTop: 20,
                    fontSize: 13,
                  }}
                >
                  No se encontraron placas.
                </ThemedText>
              }
            />
          </View>
        </View>
      </Modal>

      {/* MODAL PROGRESO */}
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

      {/* DATE/TIME PICKER NATIVO */}
      {showPicker &&
        (Platform.OS === "ios" ? (
          <Modal transparent animationType="fade" visible={showPicker}>
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
            >
              <View
                style={{
                  backgroundColor: "white",
                  padding: 20,
                  borderRadius: 12,
                  width: "85%",
                  alignItems: "center",
                }}
              >
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
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor: "#eee",
                    }}
                    onPress={() => setShowPicker(false)}
                  >
                    <ThemedText style={{ color: "#333" }}>Cancelar</ThemedText>
                  </Pressable>
                  <Pressable
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor: MJM_BLUE,
                    }}
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
        ) : (
          <DateTimePicker
            value={tempDate}
            mode={pickerMode}
            display={pickerMode === "date" ? "calendar" : "spinner"}
            is24Hour={true}
            maximumDate={pickerMode === "date" ? new Date() : undefined}
            locale="es-ES"
            themeVariant="light"
            onChange={(event, selectedDate) => {
              setShowPicker(false);
              if (event?.type !== "dismissed" && selectedDate) {
                procesarSeleccion(selectedDate);
              }
            }}
          />
        ))}
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
  photoCounter: {
    fontSize: 10,
    color: "#888",
    marginTop: 8,
    textAlign: "right",
  },
  photoCarousel: { marginTop: 15 },
  cascadaGrid: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#F0F7FF",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBDEFB",
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
  uploadingBadge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(2, 72, 133, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
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
  modalPlacaBox: {
    backgroundColor: "#FFFFFF",
    width: "92%",
    maxWidth: 480,
    height: Math.min(500, Math.round(SCREEN_HEIGHT * 0.72)),
    borderRadius: 16,
    padding: 16,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
    height: 44,
    fontSize: 14,
    borderRadius: 8,
    color: "#000",
    paddingHorizontal: 10,
    backgroundColor: "#F9F9F9",
  },
});