import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dropdown } from "react-native-element-dropdown";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";
const MJM_BLUE = "#024885";

interface CatalogoItem {
  value: number | string;
  label: string;
}

interface CamposIpcopResponse {
  medios: CatalogoItem[];
  lugares: CatalogoItem[];
  consecuencias: CatalogoItem[];
  resultados: CatalogoItem[];
  relaciones: CatalogoItem[];
  registro?: any;
}

export interface AgresorDetalle {
  id_detalle_agresor?: number | string;
  nombre_agresor?: string;
  placa_agresor?: string;
  edad?: number | string;
}

export interface VictimaDetalle {
  id_detalle_victima?: number | string;
  nombre_victima?: string;
  placa_victima?: string;
  edad?: number | string;
  id_relacion_v?: number | string;
}

export interface Ocurrencia {
  id_ocurrencia: number | string;
  fecha_reporte: string;
  turnr: string;
  nombre_victima?: string;
  vehiculo_tipo: string;
  vehiculo_placa: string;
  coordenada?: number | string;
  id_modalidad?: number | string;
  distancia_metros?: number;
  placa_con_tipo?: string;
  tipo_asignacion?: string;
  codigo_seguimiento?: string;
  origen_descripcion?: string;
  fecha_evento: string;
  hora_alerta?: string;
  hora_llegada?: string;
  hora_repliegue?: string;
  ocurrencia_descripcion?: string;
  nombre_lugar?: string;
  unidad_encargada?: string;
  referencia?: string;
  persona_nombre_completo: string;
  persona_dni: string;
  numero_telefono: number;
  foto_1: string;
  foto_2: string;
  foto_3: string;
  foto_4: string;
  estado_involucrados: string;
  pnp_datos: string;
  cat_generica_nombre: string;
  cat_especifica_nombre: string;
  nombre_informante: string;
  modalidad_nombre: string;
  via_nombre?: string;
  cuadra?: string | number;
  tipo_patrullaje_nombre?: string;
  mod_patrullaje_nombre?: string;
  victimas_edades: string;
  victimas_placas: string;
  victimas_relacion: string;
  agresores_nombres: string;
  agresores_edades: string;
  agresores_placas: string;
  value?: number;
  label?: string;
  total_fotos?: number;
  foto_principal?: string;
  consecuencia_des?: string;
  medio_des?: string;
  id_lugarsip?: number | string;
  lugar_des?: string;
  codmod?: string;
  resultado_des?: string;
  pnp_nombre_completo?: string;
  descripcion?: string;
  victimas_nombres?: string;
  placa_victima?: string;
  edad_victima?: number | string;
  relacion_victima?: string;
  tipo_servicio_global: string;
  edad_agresor?: number | string;
  nombre_agresor?: string;
  placa_agresor?: string;
  edad?: number | string;
  agresores?: AgresorDetalle[];
  victimas?: VictimaDetalle[];
  id_medio?: number | string;
  id_consecuencia?: number | string;
  id_resultado?: number | string;
  id_relacion_v?: number | string;
  estado?: string;
  patrimonio_real?: string;
  arresto_ciudadano?: string;
  medios?: any;
  consecuencia_nombre?: string;
  resultado_nombre?: string;
  relacion_nombre?: string;
}

const listaEstados = [
  { id: 1, nombre: "PENDIENTE" },
  { id: 2, nombre: "VERIFICADO" },
  { id: 3, nombre: "SIPCOP" },
  { id: 4, nombre: "ANULADO" },
];

const listaArrestos = [
  { id: 1, nombre: "SI" },
  { id: 2, nombre: "NO" },
];

const listaPatrimonio = [
  { id: 1, nombre: "SI" },
  { id: 2, nombre: "NO" },
];

const listaEstadosDisponibles = ["PENDIENTE", "VERIFICADO", "SIPCOP", "ANULADO"];

const normalizeText = (text: string): string =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parseFechaPeru = (fechaStr?: string | null): Date | null => {
  if (!fechaStr) return null;
  const s = String(fechaStr).trim();

  const matchDMY = s.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (matchDMY) {
    const [, dd, mm, yyyy, hh = "12", mi = "00", ss = "00"] = matchDMY;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const matchYMD = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (matchYMD) {
    const [, yyyy, mm, dd, hh = "12", mi = "00", ss = "00"] = matchYMD;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const esUrlSegura = (url?: string | null): boolean =>
  typeof url === "string" && /^https?:\/\//i.test(url.trim());

const extraerFotos = (item: any): string[] => {
  if (!item) return [];
  let fotosArray: any[] = [];
  try {
    const fotosVal = item.fotos_json;
    if (fotosVal) {
      fotosArray = typeof fotosVal === "string" ? JSON.parse(fotosVal) : fotosVal;
    } else if (Array.isArray(item.lista_fotos)) {
      fotosArray = item.lista_fotos;
    } else if (Array.isArray(item.fotos)) {
      fotosArray = item.fotos;
    } else {
      fotosArray = [item.foto_1, item.foto_2, item.foto_3, item.foto_4].filter(Boolean);
    }
  } catch {
    fotosArray = [item.foto_1, item.foto_2, item.foto_3, item.foto_4].filter(Boolean);
  }

  return (Array.isArray(fotosArray) ? fotosArray : [])
    .map((f) => (typeof f === "string" ? f : f?.url_imagen || f?.url || ""))
    .filter((u) => esUrlSegura(u));
};

export default function ReportesWebScreen() {
  const [saving, setSaving] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("Actualizando...");
  const [loading, setLoading] = useState(false);
  const [reportesCompletos, setReportesCompletos] = useState<any[]>([]);
  const [conteosPorEstado, setConteosPorEstado] = useState<Record<string, number>>({});
  const [esBusqueda12Horas, setEsBusqueda12Horas] = useState(true);
  const [modalConfirmacionOpen, setModalConfirmacionOpen] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25);
  const [totalRegistrosBD, setTotalRegistrosBD] = useState(0);

  const hoy = new Date();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
    hoy.getDate()
  ).padStart(2, "0")}`;

  // Modales
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<any | null>(null);
  const [registroEditar, setRegistroEditar] = useState<any | null>(null);
  const [listaUbicaciones, setListaUbicaciones] = useState<CatalogoItem[]>([]);
  const [listaModalidadesDisponibles, setListaModalidadesDisponibles] = useState<string[]>([]);

  // Estados del formulario de filtros
  const [fechaReporteInicio, setFechaReporteInicio] = useState("");
  const [fechaReporteFin, setFechaReporteFin] = useState("");
  const [fechaEventoInicio, setFechaEventoInicio] = useState("");
  const [fechaEventoFin, setFechaEventoFin] = useState("");
  const [patrimonioFiltro, setPatrimonioFiltro] = useState("");
  const [arrestoFiltro, setArrestoFiltro] = useState("");
  const [soloRoboHurto, setSoloRoboHurto] = useState(false);

  const [listaMedios, setListaMedios] = useState<CatalogoItem[]>([]);
  const [listaUbisipcop, setListaUbisipcop] = useState<CatalogoItem[]>([]);
  const [listaConsecuencias, setListaConsecuencias] = useState<CatalogoItem[]>([]);
  const [listaResultados, setListaResultados] = useState<CatalogoItem[]>([]);
  const [listaRelaciones, setListaRelaciones] = useState<CatalogoItem[]>([]);

  const [modalidadesSeleccionadas, setModalidadesSeleccionadas] = useState<string[]>([]);
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<string[]>([]);
  const [dropdownModalidadesOpen, setDropdownModalidadesOpen] = useState(false);
  const [dropdownEstadosOpen, setDropdownEstadosOpen] = useState(false);

  const [filtrosAplicados, setFiltrosAplicados] = useState({
    fechaReporteInicio: "",
    fechaReporteFin: "",
    fechaEventoInicio: "",
    fechaEventoFin: "",
    patrimonio: "",
    arresto: "",
    roboHurto: false,
    modalidades: [] as string[],
    estados: [] as string[],
  });

  const isMountedRef = useRef(true);
  const savingRef = useRef(false);
  const listAbortRef = useRef<AbortController | null>(null);
  const camposAbortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const camposCargadosRef = useRef(false);

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
      listAbortRef.current?.abort();
      camposAbortRef.current?.abort();
    };
  }, [limpiarTimers]);

  // Una sola carga de modalidades para filtros y dropdown de edición
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    fetch(`${API_URL}/catalogos/modalidad`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMountedRef.current) return;
        const lista = Array.isArray(data) ? data : data?.data || [];
        const items: CatalogoItem[] = lista.map((m: any) => ({
          value: m.value ?? m.id,
          label: String(m.label ?? m.nombre ?? ""),
        }));
        setListaUbicaciones(items);
        setListaModalidadesDisponibles(
          items.map((m) => m.label).filter(Boolean)
        );
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Error al cargar modalidades:", err);
        }
      })
      .finally(() => clearTimeout(timer));

    return () => controller.abort();
  }, []);

  const fetchCamposIpcop = useCallback(async (idOcurrencia?: string) => {
    camposAbortRef.current?.abort();
    const controller = new AbortController();
    camposAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const url = idOcurrencia
        ? `${API_URL}/catalogos/camposipcop?id=${encodeURIComponent(idOcurrencia)}`
        : `${API_URL}/catalogos/camposipcop`;

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: CamposIpcopResponse = await response.json();

      if (!isMountedRef.current) return;

      if (!camposCargadosRef.current || (data.medios?.length ?? 0) > 0) {
        camposCargadosRef.current = true;
        setListaMedios(data.medios || []);
        setListaUbisipcop(data.lugares || []);
        setListaConsecuencias(data.consecuencias || []);
        setListaResultados(data.resultados || []);
        setListaRelaciones(data.relaciones || []);
      }

      if (idOcurrencia && data.registro) {
        const reg = data.registro;
        setRegistroEditar((prev: any) => {
          if (!prev) return prev;
          const fusionado = {
            ...prev,
            ...reg,
            id_resultado: prev.id_resultado ?? reg.id_resultado_real ?? null,
            id_consecuencia: prev.id_consecuencia ?? reg.id_consecuencia_real ?? null,
            id_lugarsip: prev.id_lugarsip ?? reg.id_lugar_real ?? null,
            id_medio: prev.id_medio ?? reg.id_medio_real ?? null,
          };
          const tieneInv =
            (fusionado.victimas?.length || 0) > 0 ||
            (fusionado.agresores?.length || 0) > 0;
          return {
            ...fusionado,
            identificado:
              fusionado.identificado ||
              (tieneInv ? "IDENTIFICADO" : "NO_IDENTIFICADO"),
          };
        });
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error al cargar los campos SIPCOP:", error);
      }
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const fetchOcurrencias = useCallback(async () => {
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);

    setLoading(true);
    try {
      let url = `${API_URL}/ocurrencias/listar/tablasipcop-avanzado?page=${paginaActual}&limit=${registrosPorPagina}`;

      if (filtrosAplicados.fechaReporteInicio)
        url += `&fecha_reporte_inicio=${encodeURIComponent(filtrosAplicados.fechaReporteInicio)}`;
      if (filtrosAplicados.fechaReporteFin)
        url += `&fecha_reporte_fin=${encodeURIComponent(filtrosAplicados.fechaReporteFin)}`;
      if (filtrosAplicados.fechaEventoInicio)
        url += `&fecha_evento_inicio=${encodeURIComponent(filtrosAplicados.fechaEventoInicio)}`;
      if (filtrosAplicados.fechaEventoFin)
        url += `&fecha_evento_fin=${encodeURIComponent(filtrosAplicados.fechaEventoFin)}`;
      if (filtrosAplicados.patrimonio)
        url += `&patrimonio=${encodeURIComponent(filtrosAplicados.patrimonio)}`;
      if (filtrosAplicados.arresto)
        url += `&arresto=${encodeURIComponent(filtrosAplicados.arresto)}`;
      if (filtrosAplicados.roboHurto) url += `&delito=robo_hurto`;

      if (filtrosAplicados.modalidades.length > 0) {
        url += `&modalidades=${encodeURIComponent(filtrosAplicados.modalidades.join(","))}`;
      }
      if (filtrosAplicados.estados.length > 0) {
        url += `&estados=${encodeURIComponent(filtrosAplicados.estados.join(","))}`;
      }

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();

      if (!isMountedRef.current) return;

      if (json && json.success) {
        setReportesCompletos(json.data || []);
        setTotalRegistrosBD(json.total || 0);
        setConteosPorEstado(json.conteosPorEstado || {});
        setEsBusqueda12Horas(Boolean(json.es12Horas));
      } else {
        setReportesCompletos([]);
        setTotalRegistrosBD(0);
        setConteosPorEstado({});
        setEsBusqueda12Horas(false);
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      console.error("Error al obtener registros:", error);
      if (isMountedRef.current) {
        setReportesCompletos([]);
        setTotalRegistrosBD(0);
      }
    } finally {
      clearTimeout(timer);
      if (listAbortRef.current === controller && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [paginaActual, registrosPorPagina, filtrosAplicados]);

  useEffect(() => {
    fetchOcurrencias();
  }, [fetchOcurrencias]);

  useEffect(() => {
    if (!dropdownModalidadesOpen && !dropdownEstadosOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("#dropdown-modalidades-container")) {
        setDropdownModalidadesOpen(false);
      }
      if (!target.closest("#dropdown-estados-container")) {
        setDropdownEstadosOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [dropdownModalidadesOpen, dropdownEstadosOpen]);

  const handleGuardarCambios = async () => {
    if (!registroEditar || savingRef.current) return;

    savingRef.current = true;
    limpiarTimers();
    setSaving(true);
    setUploadProgress(0);
    setUploadStatus("Actualizando...");
    setIsFinished(false);

    intervalRef.current = setInterval(() => {
      setUploadProgress((p) => (p < 90 ? p + 10 : p));
    }, 100);

    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(
        `${API_URL}/ocurrencias/editarseguro-sipcop/${registroEditar.id_ocurrencia}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_modalidad: registroEditar.id_modalidad,
            id_resultado_real: registroEditar.id_resultado,
            id_consecuencia_real: registroEditar.id_consecuencia,
            id_lugar_real: registroEditar.id_lugarsip,
            id_medio_real: registroEditar.id_medio,
            estado: registroEditar.estado,
            patrimonio_real: registroEditar.patrimonio_real,
            arresto_ciudadano: registroEditar.arresto_ciudadano,
            victimas: registroEditar.victimas || [],
            agresores: registroEditar.agresores || [],
          }),
          signal: controller.signal,
        }
      );

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        // respuesta no JSON
      }

      limpiarTimers();
      if (!isMountedRef.current) return;

      if (response.ok && data.success) {
        setUploadProgress(100);
        setUploadStatus("¡Correcto!");
        setIsFinished(true);

        timeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          savingRef.current = false;
          setSaving(false);
          setRegistroEditar(null);
          fetchOcurrencias();
        }, 600);
      } else {
        savingRef.current = false;
        setSaving(false);
        window.alert(
          "Error del servidor: " + (data.error || "No se pudo actualizar")
        );
      }
    } catch (error: any) {
      limpiarTimers();
      if (!isMountedRef.current) return;
      savingRef.current = false;
      setSaving(false);
      console.error("Error de conexión:", error);
      window.alert(
        error?.name === "AbortError"
          ? "El servidor tardó demasiado en responder."
          : "No se pudo conectar con el servidor."
      );
    } finally {
      clearTimeout(requestTimeout);
    }
  };

  const tieneFechasSeleccionadas = useMemo(() => {
    const hayFechasReporte = Boolean(fechaReporteInicio && fechaReporteFin);
    const hayFechasEvento = Boolean(fechaEventoInicio && fechaEventoFin);
    return hayFechasReporte || hayFechasEvento;
  }, [fechaReporteInicio, fechaReporteFin, fechaEventoInicio, fechaEventoFin]);

  const formatearFechaDDMMYYYY = (fechaStr: string) => {
    if (!fechaStr) return "";
    const d = parseFechaPeru(fechaStr);
    if (!d) return fechaStr;
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const labelNormMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of listaUbicaciones) {
      if (item?.label && !map.has(item.label)) {
        map.set(item.label, normalizeText(item.label));
      }
    }
    return map;
  }, [listaUbicaciones]);

  const filtroModalidadOptimizado = useCallback(
    (keyword: string, label: string) => {
      const terms = normalizeText(keyword).trim().split(/\s+/).filter(Boolean);
      if (terms.length === 0) return true;
      const cleanLabel = labelNormMap.get(label) ?? normalizeText(label);
      return terms.every((w) => cleanLabel.includes(w));
    },
    [labelNormMap]
  );

  const totalPaginas = useMemo(() => {
    const paginas = Math.ceil(totalRegistrosBD / registrosPorPagina);
    return paginas > 0 ? paginas : 1;
  }, [totalRegistrosBD, registrosPorPagina]);

  const toggleModalidadFiltro = (mod: string) => {
    setModalidadesSeleccionadas((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const toggleEstadoFiltro = (est: string) => {
    setEstadosSeleccionados((prev) =>
      prev.includes(est) ? prev.filter((e) => e !== est) : [...prev, est]
    );
  };

  const handleEjecutarBusqueda = () => {
    if (!tieneFechasSeleccionadas) return;

    if (
      fechaReporteInicio &&
      fechaReporteFin &&
      fechaReporteInicio > fechaReporteFin
    ) {
      window.alert(
        "La fecha de inicio de registro no puede ser mayor a la fecha fin."
      );
      return;
    }

    if (
      fechaEventoInicio &&
      fechaEventoFin &&
      fechaEventoInicio > fechaEventoFin
    ) {
      window.alert(
        "La fecha de inicio de ocurrencia no puede ser mayor a la fecha fin."
      );
      return;
    }

    setDropdownModalidadesOpen(false);
    setDropdownEstadosOpen(false);
    setPaginaActual(1);
    setFiltrosAplicados({
      fechaReporteInicio: fechaReporteInicio.trim(),
      fechaReporteFin: fechaReporteFin.trim(),
      fechaEventoInicio: fechaEventoInicio.trim(),
      fechaEventoFin: fechaEventoFin.trim(),
      patrimonio: patrimonioFiltro.trim(),
      arresto: arrestoFiltro.trim(),
      roboHurto: soloRoboHurto,
      modalidades: [...modalidadesSeleccionadas],
      estados: [...estadosSeleccionados],
    });
  };

  const handleLimpiarFiltros = () => {
    setFechaReporteInicio("");
    setFechaReporteFin("");
    setFechaEventoInicio("");
    setFechaEventoFin("");
    setPatrimonioFiltro("");
    setArrestoFiltro("");
    setSoloRoboHurto(false);
    setModalidadesSeleccionadas([]);
    setEstadosSeleccionados([]);
    setDropdownModalidadesOpen(false);
    setDropdownEstadosOpen(false);
    setPaginaActual(1);

    setFiltrosAplicados({
      fechaReporteInicio: "",
      fechaReporteFin: "",
      fechaEventoInicio: "",
      fechaEventoFin: "",
      patrimonio: "",
      arresto: "",
      roboHurto: false,
      modalidades: [],
      estados: [],
    });
  };

  const cantidadFiltrosActivos = useMemo(() => {
    let count = 0;
    if (fechaReporteInicio || fechaReporteFin) count++;
    if (fechaEventoInicio || fechaEventoFin) count++;
    if (patrimonioFiltro) count++;
    if (arrestoFiltro) count++;
    if (soloRoboHurto) count++;
    if (modalidadesSeleccionadas.length > 0)
      count += modalidadesSeleccionadas.length;
    if (estadosSeleccionados.length > 0) count += estadosSeleccionados.length;
    return count;
  }, [
    fechaReporteInicio,
    fechaReporteFin,
    fechaEventoInicio,
    fechaEventoFin,
    patrimonioFiltro,
    arrestoFiltro,
    soloRoboHurto,
    modalidadesSeleccionadas,
    estadosSeleccionados,
  ]);

  return (
    <div style={styles.container}>
      <style>{`
        .link-evidencia-foto:hover {
          background-color: #f1f5f9 !important;
          border-color: #024885 !important;
          color: #024885 !important;
        }
        .link-evidencia-foto:hover + .tooltip-miniatura,
        .tooltip-miniatura:hover,
        .link-evidencia-edicion:hover + .tooltip-miniatura-edicion,
        .tooltip-miniatura-edicion:hover {
          display: block !important;
        }
      `}</style>

      {/* CABECERA DINÁMICA */}
      <div style={styles.header}>
        <h2
          style={{
            color: MJM_BLUE,
            margin: 0,
            fontWeight: 700,
            fontSize: "20px",
          }}
        >
          {esBusqueda12Horas
            ? `Total Registros (Últimas 12 horas): ${totalRegistrosBD} registros`
            : `Total Registros: ${totalRegistrosBD} registros`}
        </h2>
      </div>

      {/* PANEL DE FILTROS */}
      <div style={styles.filterCard}>
        <div style={styles.filterRow}>
          <div>
            <label style={styles.filterLabel}>FECHA REGISTRO:</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="date"
                max={fechaHoy}
                value={fechaReporteInicio ?? ""}
                onChange={(e) => setFechaReporteInicio(e.target.value)}
                style={styles.inputDate}
              />
              <span>-</span>
              <input
                type="date"
                max={fechaHoy}
                value={fechaReporteFin ?? ""}
                onChange={(e) => setFechaReporteFin(e.target.value)}
                style={styles.inputDate}
              />
            </div>
          </div>

          <div>
            <label style={styles.filterLabel}>FECHA OCURRENCIA:</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="date"
                max={fechaHoy}
                value={fechaEventoInicio ?? ""}
                onChange={(e) => setFechaEventoInicio(e.target.value)}
                style={styles.inputDate}
              />
              <span>-</span>
              <input
                type="date"
                max={fechaHoy}
                value={fechaEventoFin ?? ""}
                onChange={(e) => setFechaEventoFin(e.target.value)}
                style={styles.inputDate}
              />
            </div>
          </div>

          <div>
            <label style={styles.filterLabel}>PATRIMONIO:</label>
            <select
              value={patrimonioFiltro ?? ""}
              onChange={(e) => setPatrimonioFiltro(e.target.value)}
              disabled={!tieneFechasSeleccionadas}
              style={{
                ...styles.selectRows,
                opacity: tieneFechasSeleccionadas ? 1 : 0.5,
                cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed",
              }}
            >
              <option value="">TODOS</option>
              <option value="SI">SI</option>
              <option value="NO">NO</option>
            </select>
          </div>

          <div>
            <label style={styles.filterLabel}>ARRESTO:</label>
            <select
              value={arrestoFiltro ?? ""}
              onChange={(e) => setArrestoFiltro(e.target.value)}
              disabled={!tieneFechasSeleccionadas}
              style={{
                ...styles.selectRows,
                opacity: tieneFechasSeleccionadas ? 1 : 0.5,
                cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed",
              }}
            >
              <option value="">TODOS</option>
              <option value="SI">SI</option>
              <option value="NO">NO</option>
            </select>
          </div>

          <div>
            <label style={styles.filterLabel}>DELITO DESCRIPCIÓN:</label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: "600",
                cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed",
                marginTop: "6px",
                opacity: tieneFechasSeleccionadas ? 1 : 0.5,
              }}
            >
              <input
                type="checkbox"
                checked={soloRoboHurto}
                disabled={!tieneFechasSeleccionadas}
                onChange={(e) => setSoloRoboHurto(e.target.checked)}
              />
              Robo / Hurto
            </label>
          </div>

          {/* DESPLEGABLE MODALIDADES */}
          <div
            id="dropdown-modalidades-container"
            style={{
              ...styles.dropdownContainer,
              opacity: tieneFechasSeleccionadas ? 1 : 0.5,
            }}
          >
            <button
              type="button"
              onClick={() =>
                tieneFechasSeleccionadas &&
                setDropdownModalidadesOpen((prev) => !prev)
              }
              disabled={!tieneFechasSeleccionadas}
              style={{
                ...styles.dropdownButton,
                cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed",
              }}
            >
              <span>
                {modalidadesSeleccionadas.length === 0
                  ? "Filtrar Modalidades"
                  : `Modalidades (${modalidadesSeleccionadas.length})`}
              </span>
              <Ionicons
                name={dropdownModalidadesOpen ? "chevron-up" : "chevron-down"}
                size={14}
                color="#334155"
              />
            </button>
            {dropdownModalidadesOpen && tieneFechasSeleccionadas && (
              <div style={styles.dropdownMenu}>
                <div style={styles.dropdownHeaderMenu}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#024885",
                    }}
                  >
                    MODALIDADES
                  </span>
                  {modalidadesSeleccionadas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setModalidadesSeleccionadas([])}
                      style={styles.btnClearSelection}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div style={styles.dropdownListScroll}>
                  {listaModalidadesDisponibles.map((mod) => (
                    <label key={mod} style={styles.dropdownCheckboxItem}>
                      <input
                        type="checkbox"
                        checked={modalidadesSeleccionadas.includes(mod)}
                        onChange={() => toggleModalidadFiltro(mod)}
                      />
                      <span style={{ fontSize: "10px" }}>{mod}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DESPLEGABLE ESTADOS */}
          <div
            id="dropdown-estados-container"
            style={{
              ...styles.dropdownContainer,
              opacity: tieneFechasSeleccionadas ? 1 : 0.5,
            }}
          >
            <button
              type="button"
              onClick={() =>
                tieneFechasSeleccionadas &&
                setDropdownEstadosOpen((prev) => !prev)
              }
              disabled={!tieneFechasSeleccionadas}
              style={{
                ...styles.dropdownButton,
                cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed",
              }}
            >
              <span>
                {estadosSeleccionados.length === 0
                  ? "Filtrar Estados"
                  : `Estados (${estadosSeleccionados.length})`}
              </span>
              <Ionicons
                name={dropdownEstadosOpen ? "chevron-up" : "chevron-down"}
                size={14}
                color="#334155"
              />
            </button>
            {dropdownEstadosOpen && tieneFechasSeleccionadas && (
              <div style={styles.dropdownMenu}>
                <div style={styles.dropdownHeaderMenu}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#024885",
                    }}
                  >
                    ESTADOS
                  </span>
                  {estadosSeleccionados.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEstadosSeleccionados([])}
                      style={styles.btnClearSelection}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div style={styles.dropdownListScroll}>
                  {listaEstadosDisponibles.map((est) => (
                    <label key={est} style={styles.dropdownCheckboxItem}>
                      <input
                        type="checkbox"
                        checked={estadosSeleccionados.includes(est)}
                        onChange={() => toggleEstadoFiltro(est)}
                      />
                      <span style={{ fontSize: "10px" }}>{est}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BOTONES BUSCAR Y LIMPIAR */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "flex-end",
              marginTop: "auto",
            }}
          >
            <button
              type="button"
              onClick={handleEjecutarBusqueda}
              disabled={!tieneFechasSeleccionadas || loading}
              style={{
                ...styles.btnSearch,
                backgroundColor: tieneFechasSeleccionadas
                  ? MJM_BLUE
                  : "#94a3b8",
                cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed",
              }}
            >
              <Ionicons name="search" size={14} color="white" /> Buscar
            </button>
            {cantidadFiltrosActivos > 0 && (
              <button
                type="button"
                onClick={handleLimpiarFiltros}
                style={styles.btnClearFilters}
              >
                <Ionicons name="reload" size={14} color="white" /> Limpiar (
                {cantidadFiltrosActivos})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div style={styles.tableCard}>
        <div style={styles.tableScrollContainer}>
          <table
            style={{
              ...styles.table,
              tableLayout: "fixed",
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={styles.thead}>
                <th
                  style={{
                    ...styles.th,
                    width: "3.5%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  N°
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "9%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  FECHA REGISTRO
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "16%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  DATOS IMPORTANTES
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "16%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  MODALIDAD
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "5%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  FECHA OCURRENCIA
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "5%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  VÍCTIMA
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "5%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  AGRESOR
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "3%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  CONTRA. PTR.
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "3%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  ARREST. C.
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "5.5%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  ESTADO
                </th>
                <th style={{ ...styles.th, width: "4%", textAlign: "center" }}>
                  EDITAR
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: "30px" }}>
                    Cargando registros...
                  </td>
                </tr>
              ) : reportesCompletos.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: "30px" }}>
                    No se encontraron registros.
                  </td>
                </tr>
              ) : (
                reportesCompletos.map((item) => {
                  const fotosItem = extraerFotos(item);
                  const fechaRepObj = parseFechaPeru(item.fecha_reporte);
                  const fechaRepFormateada = fechaRepObj
                    ? `${fechaRepObj
                        .toLocaleDateString("es-PE", { weekday: "short" })
                        .replace(".", "")
                        .toLowerCase()} ${fechaRepObj.toLocaleDateString(
                        "es-PE"
                      )} - ${fechaRepObj.toLocaleTimeString("es-PE", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}`
                    : item.fecha_reporte || item.fecha_evento || "S/F";

                  const fechaEvtFormateada = item.fecha_evento
                    ? formatearFechaDDMMYYYY(item.fecha_evento)
                    : "S/F";

                  return (
                    <tr
                      key={item.id_ocurrencia}
                      style={styles.tr}
                      onClick={() => setDetalleSeleccionado(item)}
                    >
                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            ...styles.txtB,
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={String(item.id_ocurrencia)}
                        >
                          #{item.id_ocurrencia}
                        </div>
                      </td>

                      {/* Fecha Registro */}
                      <td
                        style={{
                          ...styles.td,
                          overflow: "hidden",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={styles.celdaTruncadaContainer}>
                          <div
                            style={{
                              ...styles.txtB,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {fechaRepFormateada}
                          </div>
                        </div>
                      </td>

                      {/* Datos Importantes */}
                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          verticalAlign: "middle",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div
                            style={{
                              ...styles.txtB,
                              display: "-webkit-box",
                              WebkitLineClamp: "3",
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              fontSize: "11px",
                            }}
                            title={item.ocurrencia_descripcion || "---"}
                          >
                            {item.ocurrencia_descripcion || "---"}
                          </div>

                          {fotosItem.length > 0 && (
                            <span
                              style={{
                                color: "#024885",
                                fontWeight: "700",
                                fontSize: "11px",
                              }}
                            >
                              ({fotosItem.length} fotos adjuntas)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Modalidad */}
                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          verticalAlign: "middle",
                        }}
                      >
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: "#f1f5f9",
                            color: "#475569",
                            fontWeight: "700",
                            display: "-webkit-box",
                            WebkitLineClamp: "3",
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            fontSize: "11px",
                          }}
                          title={item.modalidad_nombre}
                        >
                          {item.modalidad_nombre || "---"}
                        </span>
                      </td>

                      {/* Fecha Evento */}
                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            ...styles.txtB,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontSize: "12px",
                          }}
                          title={fechaEvtFormateada}
                        >
                          {fechaEvtFormateada}
                        </div>
                      </td>

                      {/* Víctima */}
                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          overflow: "hidden",
                          backgroundColor: "#e8f5fd",
                          borderLeft: "3px solid #024885",
                        }}
                      >
                        <div style={{ overflow: "hidden" }}>
                          <div
                            style={{
                              ...styles.txtB,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontSize: "12px",
                            }}
                            title={item.nombre_victima || ""}
                          >
                            {item.victimas && item.victimas.length > 0 && (
                              <span
                                style={{
                                  color: "#dc2626",
                                  fontSize: "0.85em",
                                  fontWeight: "bold",
                                  marginRight: "4px",
                                }}
                              >
                                ({item.victimas.length})
                              </span>
                            )}
                            {item.nombre_victima || ""}
                          </div>
                          <div
                            style={{
                              ...styles.txtS,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontSize: "11px",
                            }}
                          >
                            {item.edad_victima ? `Edad: ${item.edad_victima}` : ""}
                          </div>
                        </div>
                      </td>

                      {/* Agresor */}
                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          overflow: "hidden",
                          backgroundColor: "#e8f5fd",
                        }}
                      >
                        <div style={{ overflow: "hidden" }}>
                          <div
                            style={{
                              ...styles.txtB,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontSize: "12px",
                            }}
                            title={item.nombre_agresor || ""}
                          >
                            {item.agresores && item.agresores.length > 0 && (
                              <span
                                style={{
                                  color: "#dc2626",
                                  fontSize: "0.85em",
                                  fontWeight: "bold",
                                  marginRight: "4px",
                                }}
                              >
                                ({item.agresores.length})
                              </span>
                            )}
                            {item.nombre_agresor || ""}
                          </div>
                          <div
                            style={{
                              ...styles.txtS,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontSize: "11px",
                            }}
                          >
                            {item.edad_agresor ? `Edad: ${item.edad_agresor}` : ""}{" "}
                            {item.placa_agresor ? `Placa: ${item.placa_agresor}` : ""}
                          </div>
                        </div>
                      </td>

                      {/* Patrimonio */}
                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          backgroundColor: "#e8f5fd",
                          borderLeft: "3px solid #024885",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            ...styles.txtB,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontSize: "12px",
                          }}
                          title={item.patrimonio_real || "---"}
                        >
                          {item.patrimonio_real || "---"}
                        </div>
                      </td>

                      {/* Arresto */}
                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          backgroundColor: "#e8f5fd",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            ...styles.txtB,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            fontSize: "12px",
                          }}
                          title={item.arresto_ciudadano || "---"}
                        >
                          {item.arresto_ciudadano || "---"}
                        </div>
                      </td>

                      {/* Estado */}
                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          borderLeft: "3px solid #024885",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            ...styles.badge,
                            display: "inline-block",
                            maxWidth: "100%",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            backgroundColor: (() => {
                              const estado = String(item.estado || "").toUpperCase();
                              if (estado.includes("SIPCOP")) return "#024885";
                              if (estado.includes("VERIFICADO")) return "#16a34a";
                              if (estado.includes("ANULADO")) return "#dc2626";
                              return "#ababab";
                            })(),
                            color: "white",
                            fontWeight: "700",
                          }}
                          title={item.estado || "---"}
                        >
                          {item.estado || "---"}
                        </span>
                      </td>

                      {/* Editar */}
                      <td
                        style={{
                          ...styles.td,
                          textAlign: "center",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const tieneVictimasAgresores =
                              (item.victimas?.length || 0) > 0 ||
                              (item.agresores?.length || 0) > 0;
                            setRegistroEditar({
                              ...item,
                              fotos: fotosItem,
                              identificado:
                                item.identificado ||
                                (tieneVictimasAgresores
                                  ? "IDENTIFICADO"
                                  : "NO_IDENTIFICADO"),
                            });
                            fetchCamposIpcop(String(item.id_ocurrencia));
                          }}
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            cursor: "pointer",
                            padding: "5px 10px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                          }}
                          title="Editar registro"
                        >
                          <Ionicons name="pencil" size={15} color="#024885" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER Y CONTADORES */}
        <div style={styles.tableFooterPagination}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginRight: "auto",
            }}
          >
            <span style={{ fontSize: "11px", color: "#475569", fontWeight: "600" }}>
              Mostrar:
            </span>
            <select
              value={registrosPorPagina}
              onChange={(e) => {
                setRegistrosPorPagina(Number(e.target.value));
                setPaginaActual(1);
              }}
              style={styles.selectRows}
            >
              <option value={10}>10 registros</option>
              <option value={25}>25 registros</option>
              <option value={50}>50 registros</option>
              <option value={100}>100 registros</option>
            </select>

            <span style={{ fontSize: "12px", color: "#024885", marginLeft: "10px" }}>
              Total encontrados: <strong>{totalRegistrosBD}</strong>
              {filtrosAplicados.fechaReporteInicio &&
                filtrosAplicados.fechaReporteFin && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      fontWeight: "normal",
                      marginLeft: "6px",
                    }}
                  >
                    (Reg: {formatearFechaDDMMYYYY(filtrosAplicados.fechaReporteInicio)} al{" "}
                    {formatearFechaDDMMYYYY(filtrosAplicados.fechaReporteFin)})
                  </span>
                )}
              {filtrosAplicados.fechaEventoInicio &&
                filtrosAplicados.fechaEventoFin && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      fontWeight: "normal",
                      marginLeft: "6px",
                    }}
                  >
                    (Ocurrencia:{" "}
                    {formatearFechaDDMMYYYY(filtrosAplicados.fechaEventoInicio)} al{" "}
                    {formatearFechaDDMMYYYY(filtrosAplicados.fechaEventoFin)})
                  </span>
                )}
            </span>

            <div
              style={{
                display: "flex",
                gap: "6px",
                flexWrap: "wrap",
                marginLeft: "8px",
              }}
            >
              {Object.entries(conteosPorEstado).map(([estado, cantidad]) => {
                const isPendiente = estado === "PENDIENTE";
                return (
                  <span
                    key={estado}
                    style={{
                      fontSize: "11px",
                      backgroundColor: isPendiente ? "#64748b" : "#024885",
                      color: "#ffffff",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontWeight: "600",
                    }}
                  >
                    {estado}: <strong>{cantidad}</strong>
                  </span>
                );
              })}
            </div>
          </div>

          <div style={styles.paginationFlex}>
            <button
              type="button"
              disabled={paginaActual === 1}
              onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
              style={styles.btnPageNew}
            >
              <Ionicons
                name="chevron-back"
                size={15}
                color={paginaActual === 1 ? "#cbd5e1" : "#334155"}
              />
            </button>
            <span style={styles.pageInfoWrapper}>
              Página {paginaActual} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
              style={styles.btnPageNew}
            >
              <Ionicons
                name="chevron-forward"
                size={15}
                color={paginaActual >= totalPaginas ? "#cbd5e1" : "#334155"}
              />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DETALLE */}
      {detalleSeleccionado && (
        <div style={styles.overlay} onClick={() => setDetalleSeleccionado(null)}>
          <div style={styles.modalDetail} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, color: "#024885", fontWeight: 700 }}>
                N° de Ocurrencia:{" "}
                {detalleSeleccionado.codigo_seguimiento
                  ? `${detalleSeleccionado.codigo_seguimiento}-SGS-GSC`
                  : "---"}
              </h3>
              <button
                type="button"
                onClick={() => setDetalleSeleccionado(null)}
                style={styles.btnClose}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBodyScrollable}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                {/* 1. DATOS GENERALES */}
                <div
                  style={{
                    gridColumn: "span 2",
                    marginTop: "4px",
                    padding: "12px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                >
                  <strong
                    style={{
                      color: "#024885",
                      fontSize: "13px",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        ...styles.infoValue,
                        fontWeight: "700",
                        color: "#024885",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                        display: "inline-block",
                        verticalAlign: "bottom",
                      }}
                      title={detalleSeleccionado.modalidad_nombre || "---"}
                    >
                      {detalleSeleccionado.modalidad_nombre || "---"}
                    </span>
                  </strong>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>DNI Personal:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.persona_nombre_completo || "---"} -{" "}
                      {detalleSeleccionado.persona_dni || "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Origen Alerta:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.origen_descripcion || "---"} ({" "}
                      {detalleSeleccionado.tipo_patrullaje_nombre || "---"})
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Modalidad:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.mod_patrullaje_nombre || "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Unidad / Placa:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.placa_con_tipo ||
                        detalleSeleccionado.vehiculo_placa ||
                        "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Personal PNP:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.pnp_nombre_completo ||
                        detalleSeleccionado.pnp_datos ||
                        "---"}
                    </span>
                  </div>
                </div>

                {/* 2. UBICACIÓN Y TEMPORALIDAD */}
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                >
                  <strong
                    style={{
                      color: "#024885",
                      fontSize: "13px",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    Ubicación y temporalidad:
                  </strong>

                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Fecha Evento:</span>
                    <span style={styles.infoValue}>
                      {(() => {
                        const d = parseFechaPeru(detalleSeleccionado.fecha_evento);
                        return d
                          ? d.toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : detalleSeleccionado.fecha_evento || "S/F";
                      })()}
                    </span>
                  </div>

                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>
                      Horas (Alert / Lleg / Repl):
                    </span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.hora_alerta
                        ? String(detalleSeleccionado.hora_alerta).substring(0, 5)
                        : "S/H"}{" "}
                      /{" "}
                      {detalleSeleccionado.hora_llegada
                        ? String(detalleSeleccionado.hora_llegada).substring(0, 5)
                        : "S/H"}{" "}
                      /{" "}
                      {detalleSeleccionado.hora_repliegue
                        ? String(detalleSeleccionado.hora_repliegue).substring(0, 5)
                        : "S/H"}
                    </span>
                  </div>

                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Ubicación / Lugar:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.nombre_lugar || "---"}
                      <span style={{ color: "#64748b", fontSize: "12px" }}>
                        {" "}
                        (Ref: {detalleSeleccionado.referencia || "Sin referencia"})
                      </span>
                    </span>
                  </div>
                </div>

                {/* 3. SIPCOP (Clasificación) */}
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                >
                  <strong
                    style={{
                      color: "#024885",
                      fontSize: "13px",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    Sipcop:
                  </strong>

                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Resultado:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.resultado_des || "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Consecuencia:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.consecuencia_des || "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Lugar:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.lugar_des || "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Medio:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.medio_des || "---"}
                    </span>
                  </div>
                </div>

                {/* 4. CONTACTO Y DERIVACIÓN */}
                <div
                  style={{
                    gridColumn: "span 2",
                    padding: "12px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                >
                  <strong
                    style={{
                      color: "#024885",
                      fontSize: "13px",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    Contacto y Derivación:
                  </strong>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div style={styles.infoRowGrid}>
                      <span style={styles.infoLabel}>Contribuyente:</span>
                      <span style={styles.infoValue}>
                        {detalleSeleccionado.nombre_informante || "---"} -{" "}
                        {detalleSeleccionado.numero_telefono || "---"}
                      </span>
                    </div>
                    <div style={styles.infoRowGrid}>
                      <span style={styles.infoLabel}>Derivado:</span>
                      <span style={styles.infoValue}>
                        {detalleSeleccionado.unidad_encargada || "---"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. VÍCTIMAS Y AGRESORES */}
                <div
                  style={{
                    gridColumn: "span 2",
                    padding: "16px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                  }}
                >
                  <strong
                    style={{
                      color: "#024885",
                      fontSize: "13px",
                      display: "block",
                      marginBottom: "12px",
                    }}
                  >
                    Información de Involucrados:
                  </strong>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "14px",
                    }}
                  >
                    {/* Víctimas */}
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#024885",
                          fontWeight: "700",
                          fontSize: "12px",
                          marginBottom: "10px",
                          borderBottom: "2px solid #f1f5f9",
                          paddingBottom: "6px",
                        }}
                      >
                        VICTIMA(S)
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          fontSize: "12px",
                        }}
                      >
                        <div>
                          <span style={{ color: "#64748b", fontWeight: "600", display: "block" }}>
                            Nombres:
                          </span>
                          <span style={{ color: "#1e293b", paddingLeft: "6px", borderLeft: "2px solid #e2e8f0", display: "block" }}>
                            {detalleSeleccionado.victimas_nombres ||
                              detalleSeleccionado.nombre_victima ||
                              "---"}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "#64748b", fontWeight: "600", display: "block" }}>
                            Edad(es):
                          </span>
                          <span style={{ color: "#1e293b", paddingLeft: "6px", borderLeft: "2px solid #e2e8f0", display: "block" }}>
                            {detalleSeleccionado.victimas_edades ||
                              detalleSeleccionado.edad_victima ||
                              "---"}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "#64748b", fontWeight: "600", display: "block" }}>
                            Placa(s):
                          </span>
                          <span style={{ color: "#1e293b", paddingLeft: "6px", borderLeft: "2px solid #e2e8f0", display: "block" }}>
                            {detalleSeleccionado.victimas_placas ||
                              detalleSeleccionado.placa_victima ||
                              "---"}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "#64748b", fontWeight: "600", display: "block" }}>
                            Relación c/ Agresor:
                          </span>
                          <span style={{ color: "#1e293b", paddingLeft: "6px", borderLeft: "2px solid #e2e8f0", display: "block" }}>
                            {detalleSeleccionado.victimas_relacion || "---"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Agresores */}
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          color: "#024885",
                          fontWeight: "700",
                          fontSize: "12px",
                          marginBottom: "10px",
                          borderBottom: "2px solid #f1f5f9",
                          paddingBottom: "6px",
                        }}
                      >
                        AGRESOR(ES)
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          fontSize: "12px",
                        }}
                      >
                        <div>
                          <span style={{ color: "#64748b", fontWeight: "600", display: "block" }}>
                            Nombres:
                          </span>
                          <span style={{ color: "#1e293b", paddingLeft: "6px", borderLeft: "2px solid #e2e8f0", display: "block" }}>
                            {detalleSeleccionado.agresores_nombres ||
                              detalleSeleccionado.nombre_agresor ||
                              "---"}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "#64748b", fontWeight: "600", display: "block" }}>
                            Edad(es):
                          </span>
                          <span style={{ color: "#1e293b", paddingLeft: "6px", borderLeft: "2px solid #e2e8f0", display: "block" }}>
                            {detalleSeleccionado.agresores_edades ||
                              detalleSeleccionado.edad_agresor ||
                              "---"}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "#64748b", fontWeight: "600", display: "block" }}>
                            Placa(s):
                          </span>
                          <span style={{ color: "#1e293b", paddingLeft: "6px", borderLeft: "2px solid #e2e8f0", display: "block" }}>
                            {detalleSeleccionado.agresores_placas ||
                              detalleSeleccionado.placa_agresor ||
                              "---"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. DATOS IMPORTANTES */}
                <div
                  style={{
                    gridColumn: "span 2",
                    padding: "12px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                >
                  <strong
                    style={{
                      color: "#024885",
                      fontSize: "13px",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    Datos Importantes:
                  </strong>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.ocurrencia_descripcion ||
                      "Sin descripción detallada."}
                  </span>
                </div>

                {/* 7. ADJUNTOS */}
                <div
                  style={{
                    gridColumn: "span 2",
                    padding: "16px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                  }}
                >
                  <strong
                    style={{
                      color: "#024885",
                      fontSize: "13px",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    Adjuntos
                  </strong>

                  {(() => {
                    const fotosArray = extraerFotos(detalleSeleccionado);
                    if (fotosArray.length === 0) {
                      return (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#94a3b8",
                            fontStyle: "italic",
                          }}
                        >
                          No hay archivos adjuntos registrados para esta ocurrencia.
                        </span>
                      );
                    }

                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {fotosArray.map((urlFoto, idx) => (
                          <div
                            key={idx}
                            style={{ position: "relative", display: "inline-block" }}
                          >
                            <a
                              href={urlFoto}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 14px",
                                backgroundColor: "#f8fafc",
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                color: "#024885",
                                fontSize: "12px",
                                fontWeight: "600",
                                textDecoration: "none",
                                cursor: "pointer",
                              }}
                              className="link-evidencia-foto"
                            >
                              <Ionicons name="camera-outline" size={14} color="#024885" />
                              <span>Ver Foto {idx + 1}</span>
                              <Ionicons name="open-outline" size={12} color="#64748b" />
                            </a>

                            <div
                              className="tooltip-miniatura"
                              style={{
                                display: "none",
                                position: "absolute",
                                bottom: "115%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                padding: "6px",
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "10px",
                                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                                zIndex: 100,
                                width: "140px",
                                height: "140px",
                              }}
                            >
                              <img
                                src={urlFoto}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  borderRadius: "6px",
                                }}
                                alt={`Preview ${idx + 1}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN */}
      {registroEditar && (
        <div
          style={{
            ...styles.overlay,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={() => {
            if (!saving) setRegistroEditar(null);
          }}
        >
          <div
            style={{
              ...styles.modalDetail,
              width: "min(calc(100vw - 265px), 1750px)",
              minWidth: "900px",
              height: "92vh",
              marginLeft: "250px",
              marginRight: "1px",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              overflow: "hidden",
              padding: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div
              style={{
                padding: "12px 20px",
                backgroundColor: "#024885",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>TIPIFICAR REGISTRO DE OCURRENCIA</span>
              <button
                type="button"
                onClick={() => {
                  if (!saving) setRegistroEditar(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* 4 VENTANAS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(260px, 1fr))",
                gap: "16px",
                flex: 1,
                overflowY: "auto",
                padding: "15px",
              }}
            >
              {/* VENTANA 1: DATOS IMPORTANTES + FOTOS */}
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#024885",
                    fontWeight: "bold",
                    borderBottom: "2px solid #e2e8f0",
                    paddingBottom: "6px",
                  }}
                >
                  1. DATOS IMPORTANTES
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "#024885", fontWeight: "bold" }}>
                    DESCRIPCIÓN DE LA OCURRENCIA
                  </label>
                  <textarea
                    readOnly
                    style={{
                      width: "100%",
                      padding: "6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      resize: "none",
                      height: "280px",
                      marginTop: "4px",
                      backgroundColor: "#ffffff",
                      color: "#334155",
                      cursor: "text",
                      outline: "none",
                    }}
                    value={registroEditar.ocurrencia_descripcion ?? ""}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "#024885", fontWeight: "bold" }}>
                    DIRECCIÓN
                  </label>
                  <input
                    type="text"
                    disabled
                    style={{
                      width: "100%",
                      padding: "6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                      marginTop: "4px",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      backgroundColor: "#f1f5f9",
                      color: "#64748b",
                      cursor: "not-allowed",
                    }}
                    value={registroEditar?.nombre_lugar ?? ""}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "#024885", fontWeight: "bold" }}>
                    REFERENCIA
                  </label>
                  <textarea
                    disabled
                    style={{
                      width: "100%",
                      padding: "6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                      marginTop: "4px",
                      textTransform: "uppercase",
                      fontSize: "11px",
                      resize: "none",
                      height: "70px",
                      backgroundColor: "#f1f5f9",
                      color: "#64748b",
                      cursor: "not-allowed",
                    }}
                    value={registroEditar?.referencia ?? ""}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "11px",
                      color: "#024885",
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "6px",
                    }}
                  >
                    FOTOS ADJUNTAS
                  </label>
                  {(() => {
                    const fotosArray = extraerFotos(registroEditar);
                    if (fotosArray.length === 0) {
                      return (
                        <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                          Sin fotos adjuntas
                        </span>
                      );
                    }
                    return (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: "8px",
                        }}
                      >
                        {fotosArray.map((urlFoto, index) => (
                          <div
                            key={index}
                            style={{
                              position: "relative",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px",
                              backgroundColor: "#f8fafc",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                            }}
                          >
                            <a
                              href={urlFoto}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: "10px",
                                fontWeight: "600",
                                color: "#024885",
                                textDecoration: "none",
                                cursor: "pointer",
                              }}
                              className="link-evidencia-edicion"
                            >
                              Ver Foto N° {index + 1}
                            </a>

                            <div
                              className="tooltip-miniatura-edicion"
                              style={{
                                display: "none",
                                position: "absolute",
                                bottom: "115%",
                                left: "50%",
                                transform: "translateX(-50%)",
                                padding: "4px",
                                background: "#fff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                zIndex: 100,
                                width: "90px",
                                height: "90px",
                              }}
                            >
                              <img
                                src={urlFoto}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  borderRadius: "4px",
                                }}
                                alt={`Preview ${index + 1}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* VENTANA 2: MODALIDAD Y CAMPOS SIPCOP */}
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  width: "100%",
                  boxSizing: "border-box",
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    textAlign: "center",
                    color: "#024885",
                    fontWeight: "bold",
                    borderBottom: "2px solid #e2e8f0",
                    paddingBottom: "6px",
                  }}
                >
                  2. MODALIDAD
                </div>

                <div style={{ width: "100%", minWidth: 0 }}>
                  <div
                    style={{ position: "relative", zIndex: 99999, width: "100%" }}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Dropdown
                      containerStyle={dropdownStyles.dropdownContainer}
                      itemTextStyle={dropdownStyles.itemText}
                      itemContainerStyle={dropdownStyles.itemContainer}
                      selectedTextProps={{ numberOfLines: 1 }}
                      selectedTextStyle={dropdownStyles.selectedText}
                      style={[
                        dropdownStyles.dropdown,
                        {
                          borderColor: registroEditar?.id_modalidad
                            ? "#024885"
                            : "#cbd5e1",
                          borderWidth: registroEditar?.id_modalidad ? 1.5 : 1,
                        },
                      ]}
                      data={listaUbicaciones}
                      value={registroEditar?.id_modalidad ?? ""}
                      labelField="label"
                      valueField="value"
                      placeholder="SELECCIONE UNA MODALIDAD..."
                      placeholderStyle={{ color: "#666", fontSize: 12 }}
                      search
                      searchPlaceholder="Buscar modalidad..."
                      maxHeight={160}
                      searchQuery={filtroModalidadOptimizado}
                      onChange={(item) => {
                        const selectedId = item.value ?? item.id;
                        const selectedLabel = String(
                          item.label ?? item.nombre ?? ""
                        ).toUpperCase();
                        setRegistroEditar((prev: any) =>
                          prev
                            ? {
                                ...prev,
                                id_modalidad: selectedId,
                                modalidad_nombre: selectedLabel,
                              }
                            : null
                        );
                      }}
                      activeColor="#E3F2FD"
                      flatListProps={{
                        nestedScrollEnabled: true,
                        keyboardShouldPersistTaps: "handled",
                        initialNumToRender: 15,
                        maxToRenderPerBatch: 15,
                        windowSize: 5,
                        style: { maxHeight: 140 },
                      }}
                      inputSearchStyle={dropdownStyles.inputSearch}
                      showsVerticalScrollIndicator={false}
                      autoScroll={false}
                    />
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    textAlign: "center",
                    color: "#024885",
                    fontWeight: "bold",
                    borderBottom: "2px solid #e2e8f0",
                    paddingBottom: "6px",
                  }}
                >
                  3. CAMPOS SIPCOP
                </div>

                {/* RESULTADO */}
                <div style={{ width: "100%", minWidth: 0 }}>
                  <label style={styles.subFieldLabel}>RESULTADO:</label>
                  <div style={styles.mosaicGrid2}>
                    {listaResultados.map((item: any) => {
                      const val = item.value ?? item.id ?? item;
                      const label = String(item.label ?? item.nombre ?? item).toUpperCase();
                      const seleccionado =
                        (registroEditar?.id_resultado !== undefined &&
                          registroEditar?.id_resultado !== null &&
                          String(registroEditar.id_resultado).trim() ===
                            String(val).trim()) ||
                        (registroEditar?.resultado_des &&
                          String(registroEditar.resultado_des)
                            .trim()
                            .toUpperCase() === label);

                      return (
                        <div
                          key={val}
                          onClick={() =>
                            setRegistroEditar((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    id_resultado: val,
                                    resultado_des: label,
                                  }
                                : null
                            )
                          }
                          style={styles.mosaicBtn(seleccionado)}
                          title={label}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CONSECUENCIA */}
                <div style={{ width: "100%", minWidth: 0 }}>
                  <label style={styles.subFieldLabel}>CONSECUENCIA:</label>
                  <div style={styles.mosaicGrid2}>
                    {listaConsecuencias.map((item: any) => {
                      const val = item.value ?? item.id ?? item;
                      const label = String(item.label ?? item.nombre ?? item).toUpperCase();
                      const idActual = registroEditar?.id_consecuencia;
                      const descActual = String(registroEditar?.consecuencia_des ?? "")
                        .trim()
                        .toUpperCase();
                      const seleccionado =
                        (idActual !== undefined &&
                          idActual !== null &&
                          String(idActual).trim() === String(val).trim()) ||
                        (descActual !== "" && descActual === label);

                      return (
                        <div
                          key={val}
                          onClick={() =>
                            setRegistroEditar((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    id_consecuencia: val,
                                    consecuencia_des: label,
                                  }
                                : null
                            )
                          }
                          style={styles.mosaicBtn(seleccionado)}
                          title={label}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* LUGAR */}
                <div style={{ width: "100%", minWidth: 0 }}>
                  <label style={styles.subFieldLabel}>LUGAR:</label>
                  <div style={styles.mosaicGrid2}>
                    {listaUbisipcop.map((item: any) => {
                      const val = item.value ?? item.id ?? item;
                      const label = String(item.label ?? item.nombre ?? item).toUpperCase();
                      const idActual = registroEditar?.id_lugarsip;
                      const descActual = String(registroEditar?.lugar_des ?? "")
                        .trim()
                        .toUpperCase();
                      const seleccionado =
                        (idActual !== undefined &&
                          idActual !== null &&
                          String(idActual).trim() === String(val).trim()) ||
                        (descActual !== "" && descActual === label);

                      return (
                        <div
                          key={val}
                          onClick={() =>
                            setRegistroEditar((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    id_lugarsip: val,
                                    lugar_des: label,
                                  }
                                : null
                            )
                          }
                          style={styles.mosaicBtn(seleccionado)}
                          title={label}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* MEDIO */}
                <div style={{ width: "100%", minWidth: 0 }}>
                  <label style={styles.subFieldLabel}>MEDIO:</label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "4px",
                      border: "1px solid #e2e8f0",
                      padding: "4px",
                      borderRadius: "4px",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {listaMedios.map((item: any) => {
                      const val = item.value ?? item.id ?? item;
                      const label = String(item.label ?? item.nombre ?? item).toUpperCase();
                      const idActual = registroEditar?.id_medio;
                      const descActual = String(registroEditar?.medio_des ?? "")
                        .trim()
                        .toUpperCase();
                      const seleccionado =
                        (idActual !== undefined &&
                          idActual !== null &&
                          String(idActual).trim() === String(val).trim()) ||
                        (descActual !== "" && descActual === label);

                      return (
                        <div
                          key={val}
                          onClick={() =>
                            setRegistroEditar((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    id_medio: val,
                                    medio_des: label,
                                  }
                                : null
                            )
                          }
                          style={styles.mosaicBtn(seleccionado)}
                          title={label}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* VENTANA 3: INVOLUCRADOS */}
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#024885",
                    fontWeight: "bold",
                    borderBottom: "2px solid #e2e8f0",
                    paddingBottom: "6px",
                  }}
                >
                  4. INVOLUCRADOS
                </div>

                <div>
                  <label style={styles.subFieldLabel}>¿IDENTIFICADO?</label>
                  <div style={styles.mosaicGrid2}>
                    {[
                      { id: "IDENTIFICADO", label: "IDENTIFICADO" },
                      { id: "NO_IDENTIFICADO", label: "NO IDENTIFICADO" },
                    ].map((item) => {
                      const tieneRegistros =
                        (registroEditar?.victimas?.length || 0) > 0 ||
                        (registroEditar?.agresores?.length || 0) > 0;
                      const estadoBruto = String(registroEditar?.identificado || "")
                        .trim()
                        .toUpperCase();
                      const esIdentificadoReal =
                        tieneRegistros ||
                        estadoBruto === "IDENTIFICADO" ||
                        estadoBruto === "1" ||
                        estadoBruto === "TRUE";
                      const estadoActual = esIdentificadoReal
                        ? "IDENTIFICADO"
                        : "NO_IDENTIFICADO";
                      const seleccionado = estadoActual === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (tieneRegistros && item.id === "NO_IDENTIFICADO")
                              return;
                            setRegistroEditar((prev: any) => ({
                              ...(prev || {}),
                              identificado: item.id,
                              ...(item.id === "NO_IDENTIFICADO" && {
                                victimas: [],
                                agresores: [],
                              }),
                            }));
                          }}
                          style={{
                            ...styles.mosaicBtn(seleccionado),
                            cursor:
                              tieneRegistros && item.id === "NO_IDENTIFICADO"
                                ? "not-allowed"
                                : "pointer",
                            opacity:
                              tieneRegistros && item.id === "NO_IDENTIFICADO"
                                ? 0.6
                                : 1,
                          }}
                        >
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const tieneRegistros =
                    (registroEditar?.victimas?.length || 0) > 0 ||
                    (registroEditar?.agresores?.length || 0) > 0;
                  const estadoBruto = String(registroEditar?.identificado || "")
                    .trim()
                    .toUpperCase();
                  const mostrarSeccion =
                    tieneRegistros ||
                    estadoBruto === "IDENTIFICADO" ||
                    estadoBruto === "1" ||
                    estadoBruto === "TRUE";

                  if (!mostrarSeccion) return null;

                  return (
                    <>
                      {/* VÍCTIMAS */}
                      <div
                        style={{
                          borderTop: "2px solid #e2e8f0",
                          paddingTop: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <label
                            style={{
                              fontSize: "11px",
                              color: "#024885",
                              fontWeight: "bold",
                            }}
                          >
                            VÍCTIMA(S) ({(registroEditar?.victimas || []).length}/5)
                          </label>
                          {(registroEditar?.victimas || []).length < 5 && (
                            <button
                              type="button"
                              onClick={() =>
                                setRegistroEditar((prev: any) => ({
                                  ...prev,
                                  identificado: "IDENTIFICADO",
                                  victimas: [
                                    ...(prev?.victimas || []),
                                    {
                                      nombre_victima: "",
                                      placa_victima: "",
                                      edad: "",
                                      id_relacion_v: 2,
                                    },
                                  ],
                                }))
                              }
                              style={styles.btnAddSmall}
                            >
                              ➕ Agregar Víctima
                            </button>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {(registroEditar?.victimas || []).map(
                            (victima: any, index: number) => {
                              const nombreVictimaVal = String(
                                victima?.nombre_victima ??
                                  victima?.nombre ??
                                  victima?.nombres ??
                                  ""
                              );
                              const placaVictimaVal = String(
                                victima?.placa_victima ?? victima?.placa ?? ""
                              );
                              const edadVal = String(victima?.edad ?? "");
                              const relacionVal =
                                victima?.id_relacion_v ?? victima?.relacion ?? 2;

                              return (
                                <div
                                  key={`victima-${victima?.id_detalle_victima ?? index}`}
                                  style={styles.involucradoCard}
                                >
                                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                    <input
                                      type="text"
                                      placeholder="NOMBRE VÍCTIMA O DNI"
                                      style={styles.inputMini(2)}
                                      value={nombreVictimaVal}
                                      onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setRegistroEditar((prev: any) => {
                                          const nuevas = [...(prev.victimas || [])];
                                          nuevas[index] = { ...nuevas[index], nombre_victima: val };
                                          return {
                                            ...prev,
                                            identificado: "IDENTIFICADO",
                                            victimas: nuevas,
                                          };
                                        });
                                      }}
                                    />
                                    <input
                                      type="text"
                                      placeholder="PLACA"
                                      style={styles.inputMini(1)}
                                      value={placaVictimaVal}
                                      onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setRegistroEditar((prev: any) => {
                                          const nuevas = [...(prev.victimas || [])];
                                          nuevas[index] = { ...nuevas[index], placa_victima: val };
                                          return {
                                            ...prev,
                                            identificado: "IDENTIFICADO",
                                            victimas: nuevas,
                                          };
                                        });
                                      }}
                                    />
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="EDAD"
                                      style={styles.inputEdad}
                                      value={edadVal}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                                        setRegistroEditar((prev: any) => {
                                          const nuevas = [...(prev.victimas || [])];
                                          nuevas[index] = { ...nuevas[index], edad: val };
                                          return {
                                            ...prev,
                                            identificado: "IDENTIFICADO",
                                            victimas: nuevas,
                                          };
                                        });
                                      }}
                                    />
                                    <button
                                      type="button"
                                      title="Eliminar víctima"
                                      onClick={() =>
                                        setRegistroEditar((prev: any) => ({
                                          ...prev,
                                          victimas: (prev.victimas || []).filter(
                                            (_: any, i: number) => i !== index
                                          ),
                                        }))
                                      }
                                      style={styles.btnDeleteMini}
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <div>
                                    <span style={{ fontSize: "9px", color: "#64748b", fontWeight: "bold" }}>
                                      RELACIÓN CON EL AGRESOR:
                                    </span>
                                    <select
                                      style={{
                                        width: "100%",
                                        padding: "5px",
                                        fontSize: "10px",
                                        border: "1px solid #cbd5e1",
                                        borderRadius: "4px",
                                        backgroundColor: "#fff",
                                        textTransform: "uppercase",
                                        boxSizing: "border-box",
                                        marginTop: "2px",
                                      }}
                                      value={relacionVal ?? 2}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setRegistroEditar((prev: any) => {
                                          const nuevas = [...(prev.victimas || [])];
                                          nuevas[index] = { ...nuevas[index], id_relacion_v: val };
                                          return {
                                            ...prev,
                                            identificado: "IDENTIFICADO",
                                            victimas: nuevas,
                                          };
                                        });
                                      }}
                                    >
                                      {listaRelaciones.map((itemRel: any, idxRel: number) => {
                                        const valRel = itemRel.value ?? itemRel.id ?? itemRel;
                                        const labelRel = String(
                                          itemRel.label ?? itemRel.nombre ?? itemRel
                                        ).toUpperCase();
                                        return (
                                          <option key={`rel-vic-${valRel}-${idxRel}`} value={valRel}>
                                            {labelRel}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>

                      {/* AGRESORES */}
                      <div
                        style={{
                          borderTop: "2px solid #e2e8f0",
                          paddingTop: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <label
                            style={{
                              fontSize: "11px",
                              color: "#024885",
                              fontWeight: "bold",
                            }}
                          >
                            AGRESOR(ES) ({(registroEditar?.agresores || []).length}/5)
                          </label>
                          {(registroEditar?.agresores || []).length < 5 && (
                            <button
                              type="button"
                              onClick={() =>
                                setRegistroEditar((prev: any) => ({
                                  ...prev,
                                  identificado: "IDENTIFICADO",
                                  agresores: [
                                    ...(prev?.agresores || []),
                                    { nombre_agresor: "", placa_agresor: "", edad: "" },
                                  ],
                                }))
                              }
                              style={styles.btnAddSmall}
                            >
                              ➕ Agregar Agresor
                            </button>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {(registroEditar?.agresores || []).map(
                            (agresor: any, index: number) => {
                              const nombreAgresorVal = String(
                                agresor?.nombre_agresor ??
                                  agresor?.nombre ??
                                  agresor?.nombres ??
                                  ""
                              );
                              const placaAgresorVal = String(
                                agresor?.placa_agresor ?? agresor?.placa ?? ""
                              );
                              const edadAgresorVal = String(agresor?.edad ?? "");

                              return (
                                <div
                                  key={`agresor-${agresor?.id_detalle_agresor ?? index}`}
                                  style={styles.involucradoCard}
                                >
                                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                    <input
                                      type="text"
                                      placeholder="NOMBRE AGRESOR O DNI"
                                      style={styles.inputMini(2)}
                                      value={nombreAgresorVal}
                                      onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setRegistroEditar((prev: any) => {
                                          const nuevas = [...(prev.agresores || [])];
                                          nuevas[index] = { ...nuevas[index], nombre_agresor: val };
                                          return {
                                            ...prev,
                                            identificado: "IDENTIFICADO",
                                            agresores: nuevas,
                                          };
                                        });
                                      }}
                                    />
                                    <input
                                      type="text"
                                      placeholder="PLACA"
                                      style={styles.inputMini(1)}
                                      value={placaAgresorVal}
                                      onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setRegistroEditar((prev: any) => {
                                          const nuevas = [...(prev.agresores || [])];
                                          nuevas[index] = { ...nuevas[index], placa_agresor: val };
                                          return {
                                            ...prev,
                                            identificado: "IDENTIFICADO",
                                            agresores: nuevas,
                                          };
                                        });
                                      }}
                                    />
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="EDAD"
                                      style={styles.inputEdad}
                                      value={edadAgresorVal}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                                        setRegistroEditar((prev: any) => {
                                          const nuevas = [...(prev.agresores || [])];
                                          nuevas[index] = { ...nuevas[index], edad: val };
                                          return {
                                            ...prev,
                                            identificado: "IDENTIFICADO",
                                            agresores: nuevas,
                                          };
                                        });
                                      }}
                                    />
                                    <button
                                      type="button"
                                      title="Eliminar agresor"
                                      onClick={() =>
                                        setRegistroEditar((prev: any) => ({
                                          ...prev,
                                          agresores: (prev.agresores || []).filter(
                                            (_: any, i: number) => i !== index
                                          ),
                                        }))
                                      }
                                      style={styles.btnDeleteMini}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* VENTANA 4: RESULTADO FINAL Y ESTADO */}
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "#024885",
                    fontWeight: "bold",
                    borderBottom: "2px solid #e2e8f0",
                    paddingBottom: "6px",
                  }}
                >
                  5. CLASIFICACIÓN Y CIERRE
                </div>

                {/* CONTRA EL PATRIMONIO */}
                <div>
                  <label style={styles.subFieldLabel}>CONTRA EL PATRIMONIO</label>
                  <div style={styles.mosaicGrid2}>
                    {listaPatrimonio.map((item) => {
                      const label = item.nombre.toUpperCase();
                      const valorActual = String(registroEditar?.patrimonio_real ?? "")
                        .trim()
                        .toUpperCase();
                      const seleccionado =
                        valorActual === label || valorActual === String(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() =>
                            setRegistroEditar((prev: any) => ({
                              ...(prev || {}),
                              patrimonio_real: label,
                            }))
                          }
                          style={styles.mosaicBtn(seleccionado)}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ARRESTO */}
                <div>
                  <label style={styles.subFieldLabel}>ARRESTO</label>
                  <div style={styles.mosaicGrid2}>
                    {listaArrestos.map((item) => {
                      const label = item.nombre.toUpperCase();
                      const valorActual = String(registroEditar?.arresto_ciudadano ?? "")
                        .trim()
                        .toUpperCase();
                      const seleccionado = valorActual === label;
                      return (
                        <div
                          key={item.id}
                          onClick={() =>
                            setRegistroEditar((prev: any) => ({
                              ...(prev || {}),
                              arresto_ciudadano: label,
                            }))
                          }
                          style={styles.mosaicBtn(seleccionado)}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ESTADO */}
                <div>
                  <label style={styles.subFieldLabel}>ESTADO</label>
                  <div style={styles.mosaicGrid2}>
                    {listaEstados.map((item) => {
                      const label = item.nombre.toUpperCase();
                      const valorActual = String(registroEditar?.estado ?? "")
                        .trim()
                        .toUpperCase();
                      const seleccionado =
                        valorActual === label || valorActual === String(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() =>
                            setRegistroEditar((prev: any) => ({
                              ...(prev || {}),
                              estado: label,
                            }))
                          }
                          style={styles.mosaicBtn(seleccionado)}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* BOTONES */}
                <div
                  style={{
                    padding: "20px 0 0 0",
                    display: "flex",
                    gap: "10px",
                    borderTop: "1px solid #e2e8f0",
                    marginTop: "auto",
                  }}
                >
                  <button
                    type="button"
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: "10px",
                      backgroundColor: "#e2e8f0",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "600",
                      color: "#334155",
                    }}
                    onClick={() => setRegistroEditar(null)}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: "10px",
                      backgroundColor: "#024885",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      opacity: saving ? 0.6 : 1,
                    }}
                    onClick={() => {
                      if (!registroEditar?.identificado) {
                        window.alert(
                          "Por favor seleccione si está IDENTIFICADO o NO IDENTIFICADO."
                        );
                        return;
                      }
                      if (!registroEditar?.patrimonio_real) {
                        window.alert(
                          "Por favor seleccione una opción de Contra el Patrimonio."
                        );
                        return;
                      }
                      if (!registroEditar?.estado) {
                        window.alert("Por favor seleccione un Estado.");
                        return;
                      }
                      if (!registroEditar?.arresto_ciudadano) {
                        window.alert("Por favor seleccione una opción de Arresto.");
                        return;
                      }

                      if (registroEditar.identificado === "IDENTIFICADO") {
                        const victimas = registroEditar.victimas || [];
                        for (let i = 0; i < victimas.length; i++) {
                          const v = victimas[i];
                          if (!v.nombre_victima && !v.edad && !v.id_relacion_v) {
                            window.alert(
                              `Ingrese al menos un dato (Nombre, Edad o Relación) para la víctima #${
                                i + 1
                              }`
                            );
                            return;
                          }
                        }
                      }

                      setModalConfirmacionOpen(true);
                    }}
                  >
                    {saving ? "Guardando..." : "Actualizar cambios"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN */}
      {modalConfirmacionOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "16px",
              width: "380px",
              textAlign: "center",
              boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
            }}
          >
            <h3 style={{ color: "#024885", marginTop: 0, marginBottom: "12px", fontSize: "18px" }}>
              ¿Confirmar cambios?
            </h3>
            <p style={{ color: "#475569", fontSize: "13px", marginBottom: "20px", lineHeight: "1.4" }}>
              ¿Estás seguro de que deseas actualizar la información de este registro?
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#e2e8f0",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600",
                  color: "#334155",
                }}
                onClick={() => setModalConfirmacionOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#024885",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
                onClick={() => {
                  setModalConfirmacionOpen(false);
                  handleGuardarCambios();
                }}
              >
                Sí, actualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY PROGRESO AL GUARDAR */}
      {saving && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.55)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              padding: "28px",
              borderRadius: "16px",
              width: "320px",
              textAlign: "center",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <Ionicons
              name={isFinished ? "checkmark-circle" : "cloud-upload"}
              size={44}
              color={MJM_BLUE}
            />
            <div
              style={{
                fontSize: "15px",
                fontWeight: "bold",
                color: MJM_BLUE,
                marginTop: "10px",
                marginBottom: "14px",
              }}
            >
              {uploadStatus}
            </div>
            <div
              style={{
                width: "100%",
                height: "8px",
                backgroundColor: "#e2e8f0",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: "100%",
                  backgroundColor: MJM_BLUE,
                  transition: "width 0.15s ease",
                }}
              />
            </div>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b", fontWeight: "bold" }}>
              {uploadProgress}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const dropdownStyles = {
  dropdownContainer: {
    borderRadius: 8,
    overflow: "hidden" as const,
    backgroundColor: "#FFFFFF",
    maxHeight: 180,
  },
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 45,
    width: "100%" as const,
  },
  itemContainer: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  itemText: {
    color: "#000000",
    fontSize: 12,
  },
  selectedText: {
    color: "#000000",
    fontSize: 12,
    flex: 1,
    marginRight: 10,
  },
  inputSearch: {
    height: 38,
    fontSize: 13,
    borderRadius: 6,
    color: "#000000",
    paddingHorizontal: 10,
    backgroundColor: "#F9F9F9",
  },
};

const styles: Record<string, any> = {
  btnSearch: {
    padding: "7px 14px",
    backgroundColor: MJM_BLUE,
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "600",
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
  },
  container: {
    padding: "24px",
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "15px",
  },
  tableCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
    height: "800px",
  },
  tableScrollContainer: {
    overflowX: "auto",
    overflowY: "auto",
    flex: 1,
  },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  thead: {
    backgroundColor: "#024885",
    borderBottom: "2px solid #013663",
    textAlign: "left",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  th: {
    padding: "14px 16px",
    fontSize: "10px",
    fontWeight: "700",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  td: {
    padding: "14px 16px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
    overflow: "hidden",
  },
  tr: { cursor: "pointer", transition: "background-color 0.2s" },
  celdaTruncadaContainer: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  txtB: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#1e293b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
    width: "100%",
  },
  txtS: {
    fontSize: "11px",
    color: "#024885",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
    width: "100%",
  },
  tableFooterPagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    borderTop: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
    position: "relative",
    flexShrink: 0,
  },
  selectRows: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
    color: "#334155",
    fontSize: "10px",
    fontWeight: "600",
    outline: "none",
    cursor: "pointer",
  },
  paginationFlex: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  btnPageNew: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgb(0 0 0 / 0.05)",
  },
  pageInfoWrapper: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#475569",
    width: "110px",
    textAlign: "center",
    display: "inline-block",
    userSelect: "none",
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    backdropFilter: "blur(3px)",
  },
  modalDetail: {
    backgroundColor: "white",
    padding: "24px",
    borderRadius: "16px",
    width: "720px",
    height: "580px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "14px",
    flexShrink: 0,
  },
  modalBodyScrollable: {
    flex: 1,
    overflowY: "auto",
    marginTop: "14px",
    paddingRight: "4px",
  },
  btnClose: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: "#94a3b8",
  },
  infoRowGrid: {
    display: "flex",
    flexDirection: "row",
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
    alignItems: "center",
  },
  infoLabel: {
    width: "110px",
    flexShrink: 0,
    fontWeight: "700",
    color: "#475569",
  },
  infoValue: {
    color: "#1e293b",
    fontWeight: "500",
    wordBreak: "break-word",
    whiteSpace: "normal",
  },
  badge: {
    padding: "3px 8px",
    borderRadius: "12px",
    color: "white",
    fontSize: "10px",
    fontWeight: "700",
    display: "inline-block",
    marginTop: "4px",
  },
  filterCard: {
    backgroundColor: "white",
    padding: "16px 20px",
    borderRadius: "12px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgb(0 0 0 / 0.1)",
    border: "1px solid #e2e8f0",
  },
  filterRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    display: "block",
    marginBottom: "4px",
  },
  inputDate: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "10px",
    color: "#1e293b",
    outline: "none",
  },
  btnClearFilters: {
    padding: "6px 12px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: "600",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  },
  dropdownContainer: { position: "relative", display: "inline-block" },
  dropdownButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "7px 12px",
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "10px",
    fontWeight: "600",
    color: "#334155",
    minWidth: "180px",
  },
  dropdownMenu: {
    position: "absolute",
    top: "calc(100% + 4px)",
    right: 0,
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    zIndex: 100,
    width: "240px",
    padding: "8px",
  },
  dropdownHeaderMenu: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "6px",
    borderBottom: "1px solid #f1f5f9",
    marginBottom: "6px",
  },
  btnClearSelection: {
    background: "none",
    border: "none",
    color: "#ef4444",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  dropdownListScroll: {
    maxHeight: "160px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  dropdownCheckboxItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 6px",
    borderRadius: "4px",
    cursor: "pointer",
  },
  subFieldLabel: {
    fontSize: "10px",
    color: "#024885",
    fontWeight: "bold",
    display: "block",
    marginBottom: "4px",
  },
  mosaicGrid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "4px",
    border: "1px solid #e2e8f0",
    padding: "4px",
    borderRadius: "4px",
    width: "100%",
    boxSizing: "border-box",
  },
  mosaicBtn: (seleccionado: boolean) => ({
    padding: "7px 6px",
    fontSize: "10px",
    fontWeight: seleccionado ? "700" : "500",
    backgroundColor: seleccionado ? "#024885" : "#f8fafc",
    color: seleccionado ? "#fff" : "#1e293b",
    border: "1px solid",
    borderColor: seleccionado ? "#024885" : "#cbd5e1",
    borderRadius: "4px",
    cursor: "pointer",
    textAlign: "center" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    minWidth: 0,
  }),
  btnAddSmall: {
    backgroundColor: "#024885",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    padding: "4px 8px",
    fontSize: "10px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  involucradoCard: {
    backgroundColor: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "8px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
    boxSizing: "border-box" as const,
  },
  inputMini: (flexVal: number) => ({
    flex: `${flexVal} 1 0%`,
    minWidth: 0,
    padding: "5px",
    fontSize: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    textTransform: "uppercase" as const,
    boxSizing: "border-box" as const,
  }),
  inputEdad: {
    width: "45px",
    flexShrink: 0,
    minWidth: 0,
    padding: "5px",
    fontSize: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    textAlign: "center" as const,
    boxSizing: "border-box" as const,
  },
  btnDeleteMini: {
    flexShrink: 0,
    width: "26px",
    height: "26px",
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    border: "1px solid #fca5a5",
    borderRadius: "4px",
    padding: 0,
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box" as const,
  },
};