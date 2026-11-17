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
const ID_MOTOCICLETA = 2;
const ID_PATRULLAJE_MOTORIZADO = 3;
const MAX_FOTOS = 1;
const SCREEN_HEIGHT = Dimensions.get("window").height;

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

const normalizeText = (text: string): string =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatearDateAYYYYMMDD = (d: Date): string => {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
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
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(mensajeError)), ms);
    promesa.then(
      (resultado) => {
        clearTimeout(timeoutId);
        resolve(resultado);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });

export default function RegistroInicioServicio() {
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
  const [selTipoLugar, setSelTipoLugar] = useState<any>(null);
  const [fotos, setFotos] = useState<FotoEstado[]>([]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("Subiendo...");
  const [isFinished, setIsFinished] = useState(false);

const [showPicker, setShowPicker] = useState(false);
const [pickerMode] = useState<"time" | "date">("time");
const [tempDate, setTempDate] = useState<Date>(new Date());
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [checklistRespuestas, setChecklistRespuestas] = useState<
    Record<number, Respuesta>
  >({});
  const [modalChecklistVisible, setModalChecklistVisible] = useState(false);
  const [mostrarFallas, setMostrarFallas] = useState(false);
  const [odometroInicial, setOdometroInicial] = useState("");
  const [unidadTemporal, setUnidadTemporal] = useState<any>(null);

  const [modalPlacaVisible, setModalPlacaVisible] = useState(false);
  const [busquedaPlaca, setBusquedaPlaca] = useState("");

  const [cuadras, setCuadras] = useState<any[]>([]);

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
    radios: [] as any[],
    zonas: [] as any[],
    tipos_lugar: [] as any[],
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
      id_usuario: userIdStable as any,
      id_lugar: null as string | null,
      id_modalidad: "139",
      id_origen: "9",
      id_tipo_patrullaje: null as number | null,
      id_modalidad_patrullaje: "2",
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
      sector_asignado: null as any,
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
  const activeUploadControllersRef = useRef<Map<string, AbortController>>(new Map());
  const uploadTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const uploadsCanceladosRef = useRef<Set<string>>(new Set());
  const submitControllerRef = useRef<AbortController | null>(null);
  const activeRequestControllersRef = useRef<Map<string, AbortController>>(new Map());
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
      submitControllerRef.current?.abort();
      submitControllerRef.current = null;
      activeUploadControllersRef.current.forEach((controller) => controller.abort());
      activeUploadControllersRef.current.clear();
      uploadTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      uploadTimeoutsRef.current.clear();
      activeRequestControllersRef.current.forEach((controller) => controller.abort());
      activeRequestControllersRef.current.clear();
      fotosRef.current.forEach((f) => liberarUriPreview(f.uri));
    };
  }, [liberarUriPreview, limpiarTimers]);

  const limpiarFormulario = useCallback(() => {
    setStep(1);
    fotosRef.current.forEach((f) => liberarUriPreview(f.uri));
    idsEnProcesoRef.current.clear();
    setFotos([]);
    setModoBusquedaManual(false);
    setSelTipoLugar(null);
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
            const calle = (p.street || "").trim();
            let numeral = (p.streetNumber || "").trim();

            if (!numeral && p.name) {
              const matchNumero = String(p.name)
                .trim()
                .match(/\b\d+[A-Za-z]?\b/);
              if (matchNumero && !calle.includes(matchNumero[0])) {
                numeral = matchNumero[0];
              }
            }

            const distrito = (p.district || p.city || "").trim();
            const viaConNumero = [calle, numeral].filter(Boolean).join(" ");

            direccionNombre =
              [viaConNumero, distrito].filter(Boolean).join(", ") ||
              p.formattedAddress ||
              "Ubicación identificada";
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

  const cargarCatalogosInit = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const [resGral, resTiposV, resTiposL, resPnps, resRadios, resZonas] =
        await Promise.all([
          fetch(
            `${API_URL}/catalogos/completo/unificadov?tipoLugar=7,8,9,10&idTipoP=1,2,3,4,6,8`,
            { signal: controller.signal }
          ),
          fetch(`${API_URL}/catalogos/tipos-vehiculo`, {
            signal: controller.signal,
          }),
          fetch(`${API_URL}/catalogos/tipos-lugar`, {
            signal: controller.signal,
          }),
          fetch(`${API_URL}/catalogos/pnp-activos`, {
            signal: controller.signal,
          }),
          fetch(`${API_URL}/catalogos/radios`, {
            signal: controller.signal,
          }),
          fetch(`${API_URL}/catalogos/zonas`, {
            signal: controller.signal,
          }),
        ]);

      const respuestas = [resGral, resTiposV, resTiposL, resPnps, resRadios, resZonas];
      const respuestaFallida = respuestas.find((respuesta) => !respuesta.ok);
      if (respuestaFallida) {
        throw new Error(`Error HTTP ${respuestaFallida.status} al cargar catálogos.`);
      }

      const [dataGral, dataTiposV, dataTiposL, dataPnps, dataRadios, dataZonas] =
        await Promise.all(respuestas.map((respuesta) => respuesta.json()));

      if (!isMountedRef.current) return;
      catalogosCargadosRef.current = true;

      setCatalogos({
        usuarios: dataGral.usuarios || [],
        modalidades: dataGral.modalidades || [],
        origenes: dataGral.origenes || [],
        camaras: dataGral.camaras || [],
        tipos_patrullaje: dataGral.tipos_patrullaje || [],
        modalidades_patrullaje: dataGral.modalidades_patrullaje || [],
        tipos_vehiculo: (dataTiposV || []).filter(
          (t: any) => Number(t.value) === 1 || Number(t.value) === 2
        ),
        unidades: [],
        pnps: dataPnps || [],
        lugares: dataGral.lugares || [],
        radios: dataRadios || [],
        zonas: dataZonas || [],
        tipos_lugar: (dataTiposL || []).filter((tl: any) =>
          [7, 8, 9, 10].includes(Number(tl.id_tipo || tl.value))
        ),
      });
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

  // Pre-indexado para búsqueda instantánea
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
    indexar(catalogos.unidades);
    indexar(catalogos.radios);
    indexar(catalogos.zonas);
    indexar(cuadras);
    return map;
  }, [catalogos.lugares, catalogos.unidades, catalogos.radios, catalogos.zonas, cuadras]);

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

  const placasFiltradas = useMemo(() => {
    const q = busquedaPlaca.trim();
    if (!q) return catalogos.unidades;
    return catalogos.unidades.filter((item: any) =>
      filtroOptimizado(q, item.label || "")
    );
  }, [catalogos.unidades, busquedaPlaca, filtroOptimizado]);

  const zonasFiltradas = useMemo(() => {
    if (!form.id_tipo_patrullaje) return catalogos.zonas;
    if (form.id_tipo_patrullaje === ID_PATRULLAJE_MOTORIZADO) {
      const primerVehiculo = form.vehiculos_detalle[0];
      const idTipoVehiculo =
        primerVehiculo?.id_tipo_vehiculo || unidadForm.id_tipo_vehiculo;
      if (idTipoVehiculo) {
        const permitidas = ZONAS_POR_VEHICULO[idTipoVehiculo];
        if (permitidas) {
          return catalogos.zonas.filter((z: any) =>
            permitidas.includes(Number(z.value))
          );
        }
      }
    }
    const permitidasPatrullaje =
      ZONAS_POR_PATRULLAJE[form.id_tipo_patrullaje as number];
    if (permitidasPatrullaje) {
      return catalogos.zonas.filter((z: any) =>
        permitidasPatrullaje.includes(Number(z.value))
      );
    }
    return catalogos.zonas;
  }, [
    catalogos.zonas,
    form.id_tipo_patrullaje,
    form.vehiculos_detalle,
    unidadForm.id_tipo_vehiculo,
  ]);

  const canAdvance = useCallback(() => {
    if (step === 1) {
      const hasBasics =
        !!form.id_tipo_patrullaje &&
        !!form.grupo &&
        !!form.id_origen &&
        !!form.sector_asignado &&
        !!form.turno;
      if (Number(form.id_tipo_patrullaje) === ID_PATRULLAJE_MOTORIZADO) {
        return hasBasics && form.vehiculos_detalle.length > 0;
      }
      return hasBasics;
    }

    if (step === 2) {
      const tieneLugar =
        form.id_lugar !== null &&
        form.id_lugar !== undefined &&
        String(form.id_lugar).trim() !== "";
      return !!form.hora_alerta && !!form.fecha_evento && tieneLugar;
    }

    if (step === 3) {
      if (!form.id_radio || !form.id_zona) return false;
      const esMotorizado =
        Number(form.id_tipo_patrullaje) === ID_PATRULLAJE_MOTORIZADO;
      if (esMotorizado) {
        return fotos.length > 0;
      }
      return true;
    }

    return false;
  }, [
    step,
    form.id_tipo_patrullaje,
    form.grupo,
    form.id_origen,
    form.sector_asignado,
    form.turno,
    form.vehiculos_detalle.length,
    form.id_lugar,
    form.hora_alerta,
    form.fecha_evento,
    form.id_radio,
    form.id_zona,
    fotos.length,
  ]);

  const handleTipoLugarChange = async (idTipoLugar: any) => {
    setSelTipoLugar(idTipoLugar);
    setForm((f) => ({ ...f, id_lugar: null }));
    activeRequestControllersRef.current.get("lugares")?.abort();
    const controller = new AbortController();
    activeRequestControllersRef.current.set("lugares", controller);

    try {
      const res = await fetch(
        `${API_URL}/catalogos/lugares?tipo=${encodeURIComponent(String(idTipoLugar))}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error(`Error HTTP ${res.status} al cargar lugares.`);
      const data = await res.json();
      if (
        isMountedRef.current &&
        activeRequestControllersRef.current.get("lugares") === controller
      ) {
        setCuadras(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Error cargando lugares por tipo:", err);
        if (isMountedRef.current && activeRequestControllersRef.current.get("lugares") === controller) {
          setCuadras([]);
        }
      }
    } finally {
      if (activeRequestControllersRef.current.get("lugares") === controller) {
        activeRequestControllersRef.current.delete("lugares");
      }
    }
  };

  const fetchUnidades = async (idTipo: any) => {
    activeRequestControllersRef.current.get("unidades")?.abort();
    const controller = new AbortController();
    activeRequestControllersRef.current.set("unidades", controller);

    try {
      const res = await fetch(
        `${API_URL}/catalogos/vehiculos-por-tipo/${encodeURIComponent(String(idTipo))}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error(`Error HTTP ${res.status} al cargar unidades.`);
      const data = await res.json();
      if (
        isMountedRef.current &&
        activeRequestControllersRef.current.get("unidades") === controller
      ) {
        setCatalogos((prev) => ({ ...prev, unidades: Array.isArray(data) ? data : [] }));
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("Error cargando unidades:", e);
    } finally {
      if (activeRequestControllersRef.current.get("unidades") === controller) {
        activeRequestControllersRef.current.delete("unidades");
      }
    }
  };

  const cargarChecklist = async (idTipoVehiculo: string | number) => {
    activeRequestControllersRef.current.get("checklist")?.abort();
    const controller = new AbortController();
    activeRequestControllersRef.current.set("checklist", controller);
    setLoadingChecklist(true);
    setChecklistItems([]);

    try {
      const response = await fetch(
        `${API_URL}/catalogos/checklist-itemsfiltro1?id_tipo_vehiculo=${encodeURIComponent(String(idTipoVehiculo))}`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error(`Error HTTP ${response.status} al cargar checklist.`);
      const data = await response.json();
      if (
        isMountedRef.current &&
        activeRequestControllersRef.current.get("checklist") === controller
      ) {
        setChecklistItems(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error al cargar checklist:", error);
        if (isMountedRef.current && activeRequestControllersRef.current.get("checklist") === controller) {
          mostrarAlerta("Error", "No se pudo cargar el checklist de la unidad.");
        }
      }
    } finally {
      if (activeRequestControllersRef.current.get("checklist") === controller) {
        activeRequestControllersRef.current.delete("checklist");
        if (isMountedRef.current) setLoadingChecklist(false);
      }
    }
  };

  const abrirChecklist = (unidad: Unidad) => {
    setUnidadTemporal(unidad);
    setChecklistRespuestas({});
    setOdometroInicial("");
    setModalChecklistVisible(true);
    void cargarChecklist(unidad.id_tipo_vehiculo);
  };

  const confirmarChecklistUnidad = () => {
    if (loadingChecklist) {
      return mostrarAlerta("Espere", "El checklist todavía se está cargando.");
    }
    if (!odometroInicial.trim()) {
      return mostrarAlerta("Atención", "Ingrese el odómetro inicial.");
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
          checklist_items,
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

  const procesarYSubirImagen = useCallback(
    async (origen: File | string) => {
      const idsTotales = new Set([
        ...fotosRef.current.map((f) => f.id),
        ...idsEnProcesoRef.current,
      ]);
      if (idsTotales.size >= MAX_FOTOS) return;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      idsEnProcesoRef.current.add(id);

      const uploadController = new AbortController();
      activeUploadControllersRef.current.set(id, uploadController);
      let uriPreview = "";
      let subidaExitosa = false;

      try {
        const fotoProcesada = await conTimeout(
          comprimirImagen(origen),
          15000,
          "La compresión de la imagen tardó demasiado."
        );

        if (uploadController.signal.aborted || !isMountedRef.current) return;

        uriPreview =
          typeof fotoProcesada === "string"
            ? fotoProcesada
            : URL.createObjectURL(fotoProcesada as Blob);

        setFotos((prev) => [
          ...prev,
          { id, uri: uriPreview, url_remota: null, uploading: true },
        ]);

        const uploadTimeoutId = setTimeout(
          () => uploadController.abort(),
          25000
        );
        uploadTimeoutsRef.current.set(id, uploadTimeoutId);

        const urlRemota = await subirFotoAlServidor(
          fotoProcesada,
          API_URL,
          form.id_modalidad,
          form.fecha_evento,
          uploadController.signal
        );

        if (uploadController.signal.aborted || !isMountedRef.current) return;
        if (!urlRemota) {
          throw new Error("El servidor no devolvió la URL de la imagen.");
        }

        subidaExitosa = true;
        setFotos((prev) =>
          prev.map((foto) =>
            foto.id === id
              ? { ...foto, url_remota: urlRemota, uploading: false }
              : foto
          )
        );
      } catch (err: any) {
        const fueCancelada =
          uploadController.signal.aborted || uploadsCanceladosRef.current.has(id);
        if (!fueCancelada) {
          const msg = err?.message || "Una imagen no pudo procesarse o subirse.";
          console.error("Error al procesar/subir imagen:", err);
          if (isMountedRef.current) mostrarAlerta("Error al subir imagen", msg);
        }
        if (uriPreview) liberarUriPreview(uriPreview);
      } finally {
        idsEnProcesoRef.current.delete(id);
        const timeoutId = uploadTimeoutsRef.current.get(id);
        if (timeoutId) clearTimeout(timeoutId);
        uploadTimeoutsRef.current.delete(id);
        activeUploadControllersRef.current.delete(id);
        uploadsCanceladosRef.current.delete(id);

        if (!subidaExitosa && isMountedRef.current) {
          setFotos((prev) => prev.filter((foto) => foto.id !== id));
        }
      }
    },
    [form.id_modalidad, form.fecha_evento, liberarUriPreview]
  );

  const eliminarFoto = useCallback(
    (id: string) => {
      uploadsCanceladosRef.current.add(id);
      activeUploadControllersRef.current.get(id)?.abort();

      const timeoutId = uploadTimeoutsRef.current.get(id);
      if (timeoutId) clearTimeout(timeoutId);
      uploadTimeoutsRef.current.delete(id);

      const foto = fotosRef.current.find((item) => item.id === id);
      if (foto) liberarUriPreview(foto.uri);

      setFotos((prev) => prev.filter((item) => item.id !== id));
    },
    [liberarUriPreview]
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

    intervalRef.current = setInterval(
      () => setUploadProgress((p) => (p < 90 ? p + 10 : p)),
      150
    );

    const controller = new AbortController();
    submitControllerRef.current = controller;
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
      if (submitControllerRef.current === controller) {
        submitControllerRef.current = null;
      }
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
            setForm((prev) => ({
              ...prev,
              [field]: item.value,
              id_zona: field === "id_tipo_patrullaje" ? null : prev.id_zona,
            }));
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

  const getDynamicBorderStyle = (value: any) => ({
    borderColor: value ? MJM_BLUE : "#ddd",
    borderWidth: value ? 1.5 : 1,
  });

  const textoCentralFirma = "Inicio de servicio";
  const firmaActiva = (form.descripcion || "").startsWith(textoCentralFirma);
  const textoDescripcionLibre = firmaActiva
    ? (form.descripcion || "")
        .replace(textoCentralFirma, "")
        .replace(/^[\n\r]+/, "")
    : form.descripcion || "";

  return (
    <ThemedView
      style={[
        styles.main,
        { paddingTop: insets.top, backgroundColor: "#f4f7f6" },
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
        <ThemedText style={styles.sectionTitle}>
          INICIO DE SERVICIO:
        </ThemedText>
        {[1, 2, 3].map((i) => (
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

            <View>
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

              <ThemedText style={styles.label}>SECTOR</ThemedText>
              {renderMosaicos(
                [
                  { label: "SECTOR 1", value: "1" },
                  { label: "SECTOR 2", value: "2" },
                  { label: "SECTOR 3", value: "3" },
                  { label: "RESIDENCIAL SAN FELIPE", value: "RF" },
                  { label: "GENERAL", value: "GENERAL" },
                ],
                form.sector_asignado,
                "sector_asignado",
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

              <ThemedText
                style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
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

            {Number(form.id_tipo_patrullaje) === ID_PATRULLAJE_MOTORIZADO && (
              <View
                style={[
                  styles.cascadaContainer,
                  getDynamicBorderStyle(form.vehiculos_detalle.length > 0),
                ]}
              >
                <View style={styles.cascadaHeader}>
                  <Ionicons name="car-sport" size={16} color={MJM_BLUE} />
                  <ThemedText
                    style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
                  >
                    ELEGIR UNIDADES
                  </ThemedText>
                </View>

                {form.vehiculos_detalle.length === 0 ? (
                  <>
                    <Dropdown
                      style={styles.dropdown}
                      data={catalogos.tipos_vehiculo}
                      labelField="label"
                      valueField="value"
                      placeholder="Tipo Vehículo"
                      value={unidadForm.id_tipo_vehiculo}
                      onChange={(v) => {
                        setBusquedaPlaca("");
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
                        <Pressable
                          onPress={() => {
                            if (!unidadForm.id_tipo_vehiculo) {
                              return mostrarAlerta(
                                "Atención",
                                "Primero seleccione el Tipo de Vehículo."
                              );
                            }
                            setBusquedaPlaca("");
                            setModalPlacaVisible(true);
                          }}
                          style={[
                            styles.dropdown,
                            {
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
                        style={[
                          styles.btnAddUnit,
                          (!unidadForm.id_unidad || !unidadForm.id_tipo_vehiculo) && {
                            opacity: 0.4,
                          },
                        ]}
                        disabled={
                          !unidadForm.id_unidad || !unidadForm.id_tipo_vehiculo
                        }
                        onPress={() => {
                          if (!unidadForm.id_unidad || !unidadForm.id_tipo_vehiculo) {
                            return;
                          }
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
                  </>
                ) : null}

                {form.vehiculos_detalle.length > 0 && (
                  <View style={styles.listadoUnidadesContainer}>
                    <View style={styles.listadoHeader}>
                      <ThemedText
                        style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
                      >
                        UNIDADES ASIGNADAS ({form.vehiculos_detalle.length})
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
                              Number(v.id_tipo_vehiculo) === ID_CAMIONETA
                                ? "car"
                                : Number(v.id_tipo_vehiculo) === 3 ||
                                  Number(v.id_tipo_vehiculo) === 4
                                ? "bus"
                                : "bicycle"
                            }
                            size={20}
                            color={MJM_BLUE}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <ThemedText style={styles.unitCardPlaca}>
                            {v.placa}{" "}
                            {v.odometro_inicial ? `(KM: ${v.odometro_inicial})` : ""}
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => {
                            const nuevos = form.vehiculos_detalle.filter(
                              (_, i) => i !== index
                            );
                            setForm((prev) => ({ ...prev, vehiculos_detalle: nuevos }));
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
            <ThemedText style={styles.sectionTitle}>
              PASO 2: TEMPORALIDAD Y LUGAR
            </ThemedText>

            <View style={{ gap: 15, marginBottom: 15 }}>
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
                        ? "BUSCAR POR TIPO"
                        : "SELECCIONE (CASETA, LOCAL, PUESTO O MÓDULO)"}
                    </ThemedText>
                  </View>

                  <Pressable
                    style={{
                      backgroundColor:
                        String(form.id_lugar) === "2120" ? MJM_BLUE : "#e2e8f0",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      marginRight: 6,
                    }}
                    onPress={() => {
                      setModoBusquedaManual(false);
                      setSelTipoLugar(null);
                      setCuadras([]);
                      setForm((prev: any) => ({ ...prev, id_lugar: 2120 }));
                    }}
                  >
                    <ThemedText
                      style={{
                        fontSize: 9,
                        fontWeight: "bold",
                        color:
                          String(form.id_lugar) === "2120" ? "white" : "#475569",
                      }}
                    >
                      {String(form.id_lugar) === "2120"
                        ? "✓ Sin puesto fijo"
                        : "+ Sin puesto fijo"}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setModoBusquedaManual(!modoBusquedaManual);
                      setSelTipoLugar(null);
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
                      {modoBusquedaManual ? "USAR LISTADO" : "POR TIPO LUGAR"}
                    </ThemedText>
                  </Pressable>
                </View>

                {!modoBusquedaManual && (
                  <View style={{ marginBottom: 10, marginTop: 10 }}>
                    <Dropdown
                      maxHeight={320}
                      containerStyle={styles.dropdownContainer}
                      itemContainerStyle={styles.dropdownItemContainer}
                      itemTextStyle={styles.dropdownItemText}
                      selectedTextProps={{ numberOfLines: 1 }}
                      selectedTextStyle={{ color: "#000", fontSize: 14 }}
                      style={[styles.dropdown, { borderColor: MJM_BLUE }]}
                      data={catalogos.lugares}
                      search
                      searchPlaceholder="Buscar caseta, local o puesto..."
                      labelField="label"
                      valueField="value"
                      placeholder="Seleccione la ubicación..."
                      value={form.id_lugar}
                      onFocus={() => {
                        setForm((prev: any) => ({ ...prev, id_lugar: null }));
                      }}
                      searchQuery={filtroOptimizado}
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
                      inputSearchStyle={styles.inputSearchStyle}
                    />
                  </View>
                )}

                {modoBusquedaManual && (
                  <View
                    style={[styles.cascadaGrid, { marginTop: 10, gap: 10 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.labelSubCascada}>
                        TIPO LUGAR
                      </ThemedText>
                      <Dropdown
                        maxHeight={260}
                        containerStyle={styles.dropdownContainer}
                        itemContainerStyle={styles.dropdownItemContainer}
                        itemTextStyle={styles.dropdownItemText}
                        style={styles.dropdownCascadaItem}
                        data={catalogos.tipos_lugar}
                        search
                        searchPlaceholder="Filtrar tipo..."
                        searchQuery={filtroOptimizado}
                        labelField="label"
                        valueField="value"
                        placeholder="Tipo..."
                        value={selTipoLugar}
                        onFocus={() => {
                          setSelTipoLugar(null);
                          setCuadras([]);
                          setForm((prev: any) => ({ ...prev, id_lugar: null }));
                        }}
                        onChange={(item) => handleTipoLugarChange(item.value)}
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
                        inputSearchStyle={styles.inputSearchStyle}
                      />
                    </View>

                    <View style={{ flex: 1.5 }}>
                      <ThemedText style={styles.labelSubCascada}>
                        NOMBRE DEL LUGAR
                      </ThemedText>
                      <Dropdown
                        maxHeight={260}
                        containerStyle={styles.dropdownContainer}
                        itemContainerStyle={styles.dropdownItemContainer}
                        itemTextStyle={styles.dropdownItemText}
                        style={[
                          styles.dropdownCascadaItem,
                          !selTipoLugar && styles.dropdownDisabled,
                        ]}
                        disable={!selTipoLugar}
                        data={cuadras}
                        search
                        searchPlaceholder={
                          selTipoLugar ? "Buscar..." : "Primero elija tipo..."
                        }
                        searchQuery={filtroOptimizado}
                        labelField="label"
                        valueField="value"
                        placeholder={selTipoLugar ? "Lugar..." : "..."}
                        value={form.id_lugar}
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
                        inputSearchStyle={styles.inputSearchStyle}
                      />
                    </View>
                  </View>
                )}
              </View>

              <View>
                <ThemedText
                  style={{
                    fontSize: 10,
                    color: MJM_BLUE,
                    fontWeight: "bold",
                    marginBottom: 5,
                  }}
                >
                  FECHA
                </ThemedText>
                <View
                  style={[
                    styles.pickerPressable,
                    {
                      backgroundColor: "#F0F0F0",
                      borderColor: "#CCC",
                      borderWidth: 1,
                    },
                  ]}
                >
                  <ThemedText style={{ color: "#555" }}>
                    {formatearFechaEspañol(getHoy())}
                  </ThemedText>
                </View>
              </View>

              <View>
                <ThemedText
                  style={{
                    fontSize: 10,
                    color: MJM_BLUE,
                    fontWeight: "bold",
                    marginBottom: 5,
                  }}
                >
                  HORA REGISTRO
                </ThemedText>
                <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                  {Platform.OS === "web" ? (
                    <View
                      style={{
                        flex: 1,
                        height: 45,
                        borderWidth: 1,
                        borderColor: "#ccc",
                        borderRadius: 8,
                        backgroundColor: "#F5F5F5",
                        justifyContent: "center",
                        paddingHorizontal: 12,
                      }}
                    >
                      <ThemedText style={{ fontSize: 16, color: "#333333" }}>
                        {form.hora_alerta || "--:--"}
                      </ThemedText>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        const currentTime = form.hora_alerta;
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
                        {formatearHora24h(form.hora_alerta) || "00:00"}
                      </ThemedText>
                      <Ionicons name="chevron-down" size={18} color="#ccc" />
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
                    onPress={() => {
                      const now = new Date();
                      const timeString = now.toTimeString().slice(0, 5);
                      setForm((prev: any) => ({
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
        )}

        {step === 3 && (
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>
              PASO 3: DETALLES FINALIZACIÓN
            </ThemedText>

            <View style={{ marginTop: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 5,
                }}
              >
                <ThemedText
                  style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
                >
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
                      Number(form.id_radio) === 110 ? MJM_BLUE : "#e2e8f0",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                  }}
                  onPress={() => setForm((prev) => ({ ...prev, id_radio: 110 }))}
                >
                  <ThemedText
                    style={{
                      fontSize: 9,
                      fontWeight: "bold",
                      color:
                        Number(form.id_radio) === 110 ? "white" : "#475569",
                    }}
                  >
                    {Number(form.id_radio) === 110
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
                onChange={(v) => setForm((prev) => ({ ...prev, id_radio: v.value }))}
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

            <View style={{ marginTop: 15 }}>
              <ThemedText
                style={{
                  fontSize: 10,
                  color: MJM_BLUE,
                  fontWeight: "bold",
                  marginBottom: 5,
                }}
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
                onChange={(v) => setForm((prev) => ({ ...prev, id_zona: v.value }))}
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

            <View style={{ marginTop: 15 }}>
              <ThemedText
                style={{
                  fontSize: 10,
                  color: MJM_BLUE,
                  fontWeight: "bold",
                  marginBottom: 5,
                }}
              >
                DATOS IMPORTANTES
              </ThemedText>
              <Pressable
                onPress={() => {
                  const actual = form.descripcion || "";
                  if (actual.startsWith(textoCentralFirma)) {
                    const limpio = actual
                      .replace(textoCentralFirma, "")
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
                          ? `${textoCentralFirma}\n\n`
                          : `${textoCentralFirma}\n\n${capitalizadoActual}`,
                    }));
                  }
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
                  Inicio de servicio
                </ThemedText>
              </Pressable>

              <View
                style={[
                  {
                    backgroundColor: "#FFFFFF",
                    padding: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#DDDDDD",
                    height: 140,
                    maxHeight: 140,
                    justifyContent: "flex-start",
                    overflow: "hidden",
                  },
                  getDynamicBorderStyle((form.descripcion || "").trim().length >= 3),
                ]}
              >
                {firmaActiva && (
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
                      {textoCentralFirma}
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
                      ({ outlineStyle: "none", boxShadow: "none" } as any),
                  ]}
                  placeholder="Registre los datos de la persona que relevó u otros datos importantes"
                  placeholderTextColor="#999999"
                  multiline={true}
                  maxLength={1500}
                  scrollEnabled={true}
                  value={textoDescripcionLibre}
                  onChangeText={(t) => {
                    const textoCapitalizado =
                      t.length > 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t;

                    setForm((prev) => ({
                      ...prev,
                      descripcion: firmaActiva
                        ? textoCapitalizado.length > 0
                          ? `${textoCentralFirma}\n${textoCapitalizado}`
                          : textoCentralFirma
                        : textoCapitalizado,
                    }));
                  }}
                />
              </View>
            </View>

            <View style={{ marginTop: 15 }}>
              <ThemedText
                style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
              >
                EVIDENCIA FOTOGRÁFICA{" "}
                <ThemedText
                  style={{
                    fontSize: 9,
                    fontWeight: "normal",
                    color:
                      Number(form.id_tipo_patrullaje) ===
                      ID_PATRULLAJE_MOTORIZADO
                        ? "#d9534f"
                        : "#666",
                  }}
                >
                  {Number(form.id_tipo_patrullaje) === ID_PATRULLAJE_MOTORIZADO
                    ? "(Obligatorio: Foto del panel)"
                    : "(Opcional)"}
                </ThemedText>
              </ThemedText>

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

              <ScrollView
                horizontal
                style={{ marginTop: 10 }}
                showsHorizontalScrollIndicator={false}
              >
                {fotos.map((f, i) => (
                  <View key={f.id || i} style={styles.wrapperFoto}>
                    <Image source={{ uri: f.uri }} style={styles.previewFoto} />
                    {f.uploading && (
                      <View style={styles.uploadingBadge}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    )}
                    <Pressable
                      style={styles.btnBorrarFoto}
                      onPress={() => eliminarFoto(f.id)}
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
              <ThemedText style={{ color: MJM_BLUE, fontWeight: "bold" }}>
                Atrás
              </ThemedText>
            </Pressable>
          )}

          {step < 3 ? (
            <Pressable
              style={[styles.btnNext, !canAdvance() && styles.btnDisabled]}
              disabled={!canAdvance()}
              onPress={() => setStep(step + 1)}
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                Siguiente
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.btnNext,
                { backgroundColor: "#28a745" },
                (!canAdvance() || hayFotosSubiendo || loading) &&
                  styles.btnDisabled,
              ]}
              disabled={!canAdvance() || hayFotosSubiendo || loading}
              onPress={enviarRegistro}
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                {loading
                  ? "Subiendo..."
                  : hayFotosSubiendo
                  ? "Subiendo foto..."
                  : "Finalizar"}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* MODAL SELECCIONAR PLACA / UNIDAD (AMPLIO Y RÁPIDO) */}
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

      {/* MODAL CHECKLIST */}
      <Modal
        animationType="slide"
        transparent
        visible={modalChecklistVisible}
        onRequestClose={() => {
          setModalChecklistVisible(false);
          setMostrarFallas(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { width: "94%", maxHeight: "90%", padding: 0 },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: "#eee",
              }}
            >
              <View>
                <ThemedText
                  style={{ fontSize: 18, fontWeight: "bold", color: MJM_BLUE }}
                >
                  📋 CHECKLIST OPERATIVO
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: "#666" }}>
                  UNIDAD: {unidadTemporal?.placa}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => {
                  setModalChecklistVisible(false);
                  setMostrarFallas(false);
                }}
                style={{
                  padding: 8,
                  backgroundColor: "#f0f0f0",
                  borderRadius: 20,
                }}
              >
                <Ionicons name="close" size={20} color="#333" />
              </Pressable>
            </View>

            {loadingChecklist && (
              <View style={{ padding: 18, alignItems: "center" }}>
                <ActivityIndicator color={MJM_BLUE} />
                <ThemedText style={{ marginTop: 8, color: "#666" }}>
                  Cargando checklist...
                </ThemedText>
              </View>
            )}
            <ScrollView
              style={{ padding: 20 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ marginBottom: 20 }}>
                <ThemedText
                  style={{ fontSize: 10, color: MJM_BLUE, fontWeight: "bold" }}
                >
                  ODÓMETRO INICIAL
                </ThemedText>
                <TextInput
                  style={[
                    styles.modalInputText,
                    { backgroundColor: "#f8fafc", fontSize: 16 },
                  ]}
                  placeholder="Ingrese kilometraje..."
                  keyboardType="numeric"
                  value={odometroInicial}
                  onChangeText={(text) =>
                    setOdometroInicial(text.replace(/[^0-9]/g, ""))
                  }
                />
              </View>

              <Pressable
                style={{
                  backgroundColor: mostrarFallas ? "#fee2e2" : "#f1f5f9",
                  padding: 14,
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: mostrarFallas ? "#fca5a5" : "#cbd5e1",
                  marginBottom: 20,
                }}
                onPress={() => setMostrarFallas(!mostrarFallas)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={20}
                    color={mostrarFallas ? "#dc2626" : MJM_BLUE}
                  />
                  <ThemedText
                    style={{
                      fontSize: 13,
                      fontWeight: "bold",
                      color: mostrarFallas ? "#991b1b" : MJM_BLUE,
                    }}
                  >
                    {mostrarFallas
                      ? "Ocultar Reporte de Fallas"
                      : "Reportar Falla (Opcional)"}
                  </ThemedText>
                </View>
                <Ionicons
                  name={mostrarFallas ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={mostrarFallas ? "#991b1b" : "#64748b"}
                />
              </Pressable>

              {mostrarFallas && (
                <View>
                  {Object.entries(
                    (checklistItems || []).reduce(
                      (acc: Record<string, any[]>, item: any) => {
                        const cat = item.nombre_categoria || "GENERAL";
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(item);
                        return acc;
                      },
                      {}
                    )
                  ).map(([categoria, items]) => (
                    <View key={categoria} style={{ marginBottom: 20 }}>
                      <ThemedText
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: MJM_BLUE,
                          marginBottom: 10,
                          backgroundColor: "#eef2ff",
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 4,
                        }}
                      >
                        {categoria.toUpperCase()}
                      </ThemedText>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                        }}
                      >
                        {items.map((item: any) => {
                          const resp = checklistRespuestas[item.id_item] || {
                            conforme: true,
                            obs: "",
                          };
                          return (
                            <View
                              key={item.id_item}
                              style={{ width: "48%", marginBottom: 15 }}
                            >
                              <Pressable
                                style={{
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: resp.conforme
                                    ? "#fff"
                                    : "#fff5f5",
                                  padding: 10,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: resp.conforme
                                    ? "#e2e8f0"
                                    : "#feb2b2",
                                  minHeight: 85,
                                }}
                                onPress={() =>
                                  setChecklistRespuestas((prev) => ({
                                    ...prev,
                                    [item.id_item]: {
                                      conforme: !(
                                        prev[item.id_item]?.conforme ?? true
                                      ),
                                      obs: !(prev[item.id_item]?.conforme ?? true)
                                        ? ""
                                        : prev[item.id_item]?.obs || "",
                                    },
                                  }))
                                }
                              >
                                <Ionicons
                                  name={
                                    resp.conforme
                                      ? "checkmark-circle"
                                      : "alert-circle"
                                  }
                                  size={28}
                                  color={
                                    resp.conforme ? "#22c55e" : "#ef4444"
                                  }
                                />
                                <ThemedText
                                  style={{
                                    fontSize: 11,
                                    textAlign: "center",
                                    marginTop: 6,
                                    color: resp.conforme
                                      ? "#334155"
                                      : "#c53030",
                                  }}
                                >
                                  {item.nombre_item}
                                </ThemedText>
                              </Pressable>
                              {!resp.conforme && (
                                <TextInput
                                  style={{
                                    marginTop: 5,
                                    backgroundColor: "#fff",
                                    borderWidth: 1,
                                    borderColor: "#feb2b2",
                                    padding: 8,
                                    borderRadius: 8,
                                    fontSize: 10,
                                  }}
                                  placeholder="Falla..."
                                  value={resp.obs}
                                  onChangeText={(text) =>
                                    setChecklistRespuestas((prev) => ({
                                      ...prev,
                                      [item.id_item]: {
                                        conforme: false,
                                        obs: text,
                                      },
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
                </View>
              )}
            </ScrollView>

            <View
              style={{
                padding: 20,
                borderTopWidth: 1,
                borderTopColor: "#eee",
              }}
            >
              <Pressable
                onPress={confirmarChecklistUnidad}
                disabled={loadingChecklist}
                style={{
                  backgroundColor: loadingChecklist ? "#94a3b8" : MJM_BLUE,
                  paddingVertical: 15,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <ThemedText
                  style={{ color: "white", fontWeight: "bold", fontSize: 16 }}
                >
                  GUARDAR CHECKLIST
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL PROGRESO */}
      <Modal
        transparent
        visible={loading && uploadProgress > 0}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.progressTitle}>{uploadStatus}</ThemedText>
            <View style={styles.progressBarBackground}>
              <View
                style={[styles.progressBarFill, { width: `${uploadProgress}%` }]}
              />
            </View>
            <ThemedText style={styles.progressPercentage}>
              {uploadProgress}%
            </ThemedText>
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
                  is24Hour={true}
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
                    onPress={() => {
                      const horas = String(tempDate.getHours()).padStart(2, "0");
                      const minutos = String(tempDate.getMinutes()).padStart(2, "0");
                      const timeString = `${horas}:${minutos}`;
                      setForm((prev: any) => ({
                        ...prev,
                        hora_alerta: timeString,
                        hora_llegada: timeString,
                        hora_repliegue: timeString,
                      }));
                      setShowPicker(false);
                    }}
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
            mode="time"
            display="spinner"
            is24Hour={true}
            locale="es-ES"
            themeVariant="light"
            onChange={(event, selectedDate) => {
              setShowPicker(false);
              if (event?.type !== "dismissed" && selectedDate) {
                const horas = String(selectedDate.getHours()).padStart(2, "0");
                const minutos = String(selectedDate.getMinutes()).padStart(2, "0");
                const timeString = `${horas}:${minutos}`;
                setForm((prev: any) => ({
                  ...prev,
                  hora_alerta: timeString,
                  hora_llegada: timeString,
                  hora_repliegue: timeString,
                }));
              }
            }}
          />
        ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    paddingHorizontal: 15,
    paddingBottom: 100,
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
  card: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 15,
    elevation: 0,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    marginBottom: 15,
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 15,
    color: "#444",
  },
  labelSubCascada: {
    fontSize: 9,
    color: MJM_BLUE,
    fontWeight: "800",
    marginBottom: 3,
    marginLeft: 2,
  },
  mosaicoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginTop: 10,
  },
  mosaicoItem: {
    width: "48.2%",
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
  mosaicoSelected: {
    backgroundColor: MJM_BLUE,
    borderColor: MJM_BLUE,
  },
  mosaicoText: {
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 6,
    color: MJM_BLUE,
    textAlign: "center",
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
  cascadaGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  btnToggleModo: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: MJM_BLUE,
  },
  dropdown: {
    height: 44,
    borderBottomWidth: 1.5,
    borderBottomColor: "#eee",
    marginTop: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
  dropdownCascadaItem: {
    height: 42,
    backgroundColor: "#FFF",
    borderColor: MJM_BLUE,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  dropdownDisabled: {
    backgroundColor: "#F5F5F5",
    borderColor: "#CCC",
  },
  dropdownContainer: {
    borderRadius: 12,
    marginTop: 5,
    elevation: 5,
    backgroundColor: "white",
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
  btnAddUnit: {
    backgroundColor: MJM_BLUE,
    padding: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
    marginTop: 15,
  },
  btnBack: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: MJM_BLUE,
    justifyContent: "center",
    alignItems: "center",
  },
  btnNext: {
    flex: 1,
    height: 48,
    backgroundColor: MJM_BLUE,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnTime: {
    backgroundColor: MJM_BLUE,
    padding: 10,
    borderRadius: 10,
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
    borderColor: "#ccc",
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
  wrapperFoto: {
    marginRight: 10,
    position: "relative",
  },
  previewFoto: {
    width: 70,
    height: 70,
    borderRadius: 8,
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
    borderRadius: 8,
  },
  btnBorrarFoto: {
    position: "absolute",
    top: -5,
    right: -5,
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
  inputSearchStyle: {
    height: 44,
    fontSize: 14,
    borderRadius: 8,
    color: "#000",
    paddingHorizontal: 10,
    backgroundColor: "#F9F9F9",
  },
  modalInputText: {
    width: "100%",
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: "#333",
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
  progressBarFill: {
    height: "100%",
    backgroundColor: MJM_BLUE,
  },
  progressPercentage: {
    marginTop: 10,
    fontSize: 12,
    color: "#666",
    fontWeight: "bold",
  },
});