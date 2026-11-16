import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";
const MJM_BLUE = "#024885";

interface Ocurrencia {
  id_ocurrencia: number | string;
  id_lugar?: number | string | null;
  fecha_reporte: string;
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
  nombre_informante: string;
  modalidad_nombre: string;
  via_nombre?: string;
  camaras?: string[] | string;
  fotos_json?: string | string[];
  lista_fotos?: string[];
  fotos?: string[];
  cuadra?: string | number;
  tipo_patrullaje_nombre?: string;
  mod_patrullaje_nombre?: string;
  value?: number;
  label?: string;
  total_fotos?: number;
  foto_principal?: string;
  pnp_nombre_completo?: string;
  descripcion?: string;
}

interface LugarOption {
  value: number | string;
  label: string;
}

const parseFechaPeru = (fechaStr?: string | null): Date | null => {
  if (!fechaStr) return null;
  const s = String(fechaStr).trim();

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

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const esUrlSegura = (url?: string | null): boolean =>
  typeof url === "string" &&
  (/^https?:\/\//i.test(url.trim()) || /^data:image\//i.test(url.trim()));

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
    } else if (item.foto_principal) {
      fotosArray = [item.foto_principal];
    }
  } catch {
    fotosArray = item.foto_principal ? [item.foto_principal] : [];
  }

  return (Array.isArray(fotosArray) ? fotosArray : [])
    .map((f) => (typeof f === "string" ? f : f?.url_imagen || f?.url || ""))
    .filter((u) => u && u !== "null" && esUrlSegura(u));
};

const comprimirImagenBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 1000;
        let { width, height } = img;

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });

const validarTiempos = (
  alerta?: string,
  llegada?: string,
  repliegue?: string
): boolean => {
  if (!alerta || !llegada || !repliegue) return false;
  const aMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return Number.isNaN(h) || Number.isNaN(m) ? NaN : h * 60 + m;
  };
  const tA = aMin(alerta);
  let tL = aMin(llegada);
  let tR = aMin(repliegue);
  if (Number.isNaN(tA) || Number.isNaN(tL) || Number.isNaN(tR)) return true;

  if (tL < tA) tL += 1440;
  if (tR < tA) tR += 1440;
  if (tR < tL) tR += 1440;

  return !(tA <= tL && tL <= tR && tR - tA <= 12 * 60);
};

export default function ReportesWebScreen() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busquedaActiva, setBusquedaActiva] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("Actualizando...");
  const [isFinished, setIsFinished] = useState(false);
  const [listaUbicaciones, setListaUbicaciones] = useState<LugarOption[]>([]);

  const [registroEditar, setRegistroEditar] = useState<Ocurrencia | null>(null);
  const [reportesCompletos, setReportesCompletos] = useState<Ocurrencia[]>([]);
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25);
  const [totalRegistrosBD, setTotalRegistrosBD] = useState(0);
  const [cargandoExcel, setCargandoExcel] = useState(false);

  const [detalleSeleccionado, setDetalleSeleccionado] = useState<Ocurrencia | null>(null);
  const [modalConfirmacionOpen, setModalConfirmacionOpen] = useState(false);
  const [mostrarDesplegable, setMostrarDesplegable] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");

  const [fechaInicioInput, setFechaInicioInput] = useState("");
  const [fechaFinInput, setFechaFinInput] = useState("");
  const [fechasFiltro, setFechasFiltro] = useState<{
    inicio: string;
    fin: string;
  } | null>(null);

  const isMountedRef = useRef(true);
  const savingRef = useRef(false);
  const listAbortRef = useRef<AbortController | null>(null);
  const lugaresCargadosRef = useRef(false);
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
      listAbortRef.current?.abort();
    };
  }, [limpiarTimers]);

  const hoyStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const formatearFechaConDia = useCallback((fechaStr?: string | null) => {
    if (!fechaStr) return "S/F";
    const fechaObjReal = parseFechaPeru(fechaStr);
    if (!fechaObjReal) return fechaStr;

    const diaSemana = fechaObjReal
      .toLocaleDateString("es-PE", { weekday: "short" })
      .replace(".", "")
      .toLowerCase();
    const fechaNumerica = fechaObjReal.toLocaleDateString("es-PE");
    return `${diaSemana} ${fechaNumerica}`;
  }, []);

  const fetchLugares = useCallback(async () => {
    if (lugaresCargadosRef.current) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${API_URL}/catalogos/lugares?tipo=4`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Error al obtener lugares");

      const data = await response.json();
      const lista = Array.isArray(data) ? data : data.data || [];

      const opcionesUbicaciones: LugarOption[] = lista.map((item: any) => ({
        value: item.id || item.id_lugar || item.value,
        label:
          item.nombre ||
          item.descripcion ||
          item.direccion ||
          item.label ||
          `Lugar #${item.id}`,
      }));

      if (!isMountedRef.current) return;
      lugaresCargadosRef.current = true;
      setListaUbicaciones(opcionesUbicaciones);
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error al cargar lugares:", error);
      }
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    fetchLugares();
  }, [fetchLugares]);

  const textoPeriodo = useMemo(() => {
    if (!fechasFiltro?.inicio || !fechasFiltro?.fin) return "Periodo";
    const fIni = fechasFiltro.inicio.split(" ")[0];
    const fFin = fechasFiltro.fin.split(" ")[0];
    if (fIni === fFin) {
      const [year, mes, dia] = fIni.split("-");
      return `Fecha: ${dia}/${mes}/${year}`;
    }
    return "Periodo";
  }, [fechasFiltro]);

  const fetchOcurrencias = useCallback(
    async (page = paginaActual, limit = registrosPorPagina) => {
      if (!fechasFiltro) return;

      listAbortRef.current?.abort();
      const controller = new AbortController();
      listAbortRef.current = controller;
      const timer = setTimeout(() => controller.abort(), 20000);

      setLoading(true);
      try {
        let url = `${API_URL}/ocurrencias/listar/tablasipcop-rango?page=${page}&limit=${limit}`;
        if (fechasFiltro.inicio && fechasFiltro.fin) {
          url += `&fecha_inicio=${encodeURIComponent(
            fechasFiltro.inicio
          )}&fecha_fin=${encodeURIComponent(fechasFiltro.fin)}`;
        }

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();

        if (!isMountedRef.current) return;

        if (json && json.success && Array.isArray(json.data)) {
          setReportesCompletos(json.data);
          setTotalRegistrosBD(json.total || 0);
        } else {
          setReportesCompletos([]);
          setTotalRegistrosBD(0);
        }
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        console.error("Error al obtener datos operativos:", error);
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
    },
    [paginaActual, registrosPorPagina, fechasFiltro]
  );

  useEffect(() => {
    if (fechasFiltro) {
      fetchOcurrencias(paginaActual, registrosPorPagina);
    }
  }, [fetchOcurrencias, paginaActual, registrosPorPagina, fechasFiltro]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetalleSeleccionado(null);
        if (!savingRef.current) {
          setModalConfirmacionOpen(false);
          setRegistroEditar(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(
        `${API_URL}/ocurrencias/editar/${registroEditar.id_ocurrencia}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registroEditar),
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
          fetchOcurrencias(paginaActual, registrosPorPagina);
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
          : "No se pudo conectar con el servidor. Verifica la IP."
      );
    } finally {
      clearTimeout(timer);
    }
  };

  const totalPaginas = useMemo(() => {
    const paginas = Math.ceil(totalRegistrosBD / registrosPorPagina);
    return paginas > 0 ? paginas : 1;
  }, [totalRegistrosBD, registrosPorPagina]);

  const exportarExcel = async () => {
    if (!fechasFiltro?.inicio || !fechasFiltro?.fin) {
      window.alert("Por favor, selecciona un rango de fechas antes de exportar.");
      return;
    }
    if (cargandoExcel) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    try {
      setCargandoExcel(true);
      const url = `${API_URL}/ocurrencias/exportar-excel-total?fecha_inicio=${encodeURIComponent(
        fechasFiltro.inicio
      )}&fecha_fin=${encodeURIComponent(fechasFiltro.fin)}`;

      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Error al generar el archivo en el servidor."
        );
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Reporte_SIPCOP_General_${fechasFiltro.inicio.split(" ")[0]}_al_${fechasFiltro.fin.split(" ")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        window.alert("La descarga del Excel tardó demasiado. Intenta un rango menor.");
      } else {
        console.error("Error al exportar el Excel:", err);
        window.alert(`Error: ${err?.message || "Ocurrió un error desconocido"}`);
      }
    } finally {
      clearTimeout(timer);
      if (isMountedRef.current) setCargandoExcel(false);
    }
  };

  const handleLimpiarFechas = () => {
    listAbortRef.current?.abort();
    setBusquedaActiva(false);
    setFechaInicioInput("");
    setFechaFinInput("");
    setFechasFiltro(null);
    setPaginaActual(1);
    setReportesCompletos([]);
    setTotalRegistrosBD(0);
  };

  const handleBuscarPorFechas = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fechaInicioInput || !fechaFinInput) return;

    if (fechaInicioInput > hoyStr || fechaFinInput > hoyStr) {
      window.alert("No puedes seleccionar fechas futuras.");
      return;
    }

    if (fechaInicioInput > fechaFinInput) {
      window.alert("La fecha inicial no puede ser mayor que la fecha final.");
      return;
    }

    setFechasFiltro({
      inicio: `${fechaInicioInput} 00:00:00`,
      fin: `${fechaFinInput} 23:59:59`,
    });
    setPaginaActual(1);
    setBusquedaActiva(true);
  };

  const handleFileChangeEdicion = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !registroEditar) return;

    const fotosArray = registroEditar.lista_fotos || [];
    const espacioDisponible = 4 - fotosArray.length;

    if (espacioDisponible <= 0) {
      window.alert("Ya has alcanzado el límite máximo de 4 fotos.");
      e.target.value = "";
      return;
    }

    const archivosAProcesar = Array.from(files).slice(0, espacioDisponible);
    try {
      const nuevasFotosComprimidas = await Promise.all(
        archivosAProcesar.map((file) => comprimirImagenBase64(file))
      );

      setRegistroEditar((prev) =>
        prev
          ? {
              ...prev,
              lista_fotos: [
                ...(prev.lista_fotos || []),
                ...nuevasFotosComprimidas,
              ],
            }
          : null
      );

      if (files.length > espacioDisponible) {
        window.alert(
          `Solo se pudieron agregar ${espacioDisponible} foto(s) más para respetar el límite máximo de 4.`
        );
      }
    } catch (error) {
      console.error("Error comprimiendo fotos:", error);
      window.alert("No se pudo procesar una de las imágenes.");
    } finally {
      e.target.value = "";
    }
  };

  const ubicacionesFiltradas = useMemo(() => {
    const q = filtroTexto.toLowerCase().trim();
    if (!q) return listaUbicaciones;
    return listaUbicaciones.filter((l) =>
      (l.label || "").toLowerCase().includes(q)
    );
  }, [listaUbicaciones, filtroTexto]);

  const tiemposEdicionInvalidos = useMemo(() => {
    if (!registroEditar) return false;
    return validarTiempos(
      registroEditar.hora_alerta,
      registroEditar.hora_llegada,
      registroEditar.hora_repliegue
    );
  }, [registroEditar]);

  return (
    <div style={styles.container}>
      <style>{`
        .fila-tabla-operativa:hover {
          background-color: #f1f5f9 !important;
          transition: background-color 0.15s ease-in-out;
        }
        .link-evidencia-foto:hover {
          background-color: #e2e8f0 !important;
        }
        .link-evidencia-foto:hover + .tooltip-miniatura,
        .tooltip-miniatura:hover,
        .link-evidencia-edicion:hover + .tooltip-miniatura-edicion,
        .tooltip-miniatura-edicion:hover {
          display: block !important;
        }
      `}</style>

      {/* Cabecera Principal */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <h2 style={{ color: MJM_BLUE, margin: 0, fontWeight: 700, fontSize: "22px" }}>
            {textoPeriodo}:{" "}
            <span style={{ fontSize: "29px", fontWeight: "bold" }}>
              {totalRegistrosBD}
            </span>{" "}
            registro(s) en total
          </h2>
          <button
            type="button"
            onClick={exportarExcel}
            disabled={cargandoExcel || !fechasFiltro}
            title="Exportar Excel"
            style={{
              backgroundColor: fechasFiltro ? "#16a34a" : "#94a3b8",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 14px",
              fontWeight: 600,
              cursor: fechasFiltro ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Ionicons name="document-text-outline" size={16} color="#fff" />
          </button>
        </div>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => fetchOcurrencias(paginaActual, registrosPorPagina)}
            disabled={!fechasFiltro || loading}
            style={{
              border: "none",
              background: "transparent",
              cursor: fechasFiltro ? "pointer" : "not-allowed",
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
            }}
            title="Actualizar tabla"
          >
            <Ionicons name="reload" size={17} color="#024885" />
          </button>
          <span
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: 600,
              backgroundColor: MJM_BLUE,
              color: "#ffffff",
              fontSize: "13px",
            }}
          >
            TODOS
          </span>
        </div>
      </div>

      {/* Formulario Rango de Fechas */}
      <form
        onSubmit={handleBuscarPorFechas}
        style={{
          marginBottom: 20,
          display: "flex",
          gap: 15,
          alignItems: "center",
          background: "#f8fafc",
          padding: 15,
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          flexWrap: "wrap",
        }}
      >
        <div>
          <label style={{ marginRight: 8, fontWeight: "600", fontSize: 13, color: "#334155" }}>
            Desde:
          </label>
          <input
            type="date"
            value={fechaInicioInput ?? ""}
            disabled={busquedaActiva}
            max={hoyStr}
            onChange={(e) => setFechaInicioInput(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 4,
              border: "1px solid #cbd5e1",
              backgroundColor: busquedaActiva ? "#f1f5f9" : "#fff",
              cursor: busquedaActiva ? "not-allowed" : "text",
            }}
          />
        </div>

        <div>
          <label style={{ marginRight: 8, fontWeight: "600", fontSize: 13, color: "#334155" }}>
            Hasta:
          </label>
          <input
            type="date"
            value={fechaFinInput ?? ""}
            disabled={busquedaActiva}
            max={hoyStr}
            onChange={(e) => setFechaFinInput(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 4,
              border: "1px solid #cbd5e1",
              backgroundColor: busquedaActiva ? "#f1f5f9" : "#fff",
              cursor: busquedaActiva ? "not-allowed" : "text",
            }}
          />
        </div>

        {!busquedaActiva ? (
          <button
            type="submit"
            disabled={!fechaInicioInput || !fechaFinInput}
            style={{
              background: fechaInicioInput && fechaFinInput ? MJM_BLUE : "#94a3b8",
              color: "#fff",
              border: "none",
              padding: "8px 18px",
              borderRadius: 4,
              fontWeight: "600",
              cursor: fechaInicioInput && fechaFinInput ? "pointer" : "not-allowed",
            }}
          >
            Buscar Rango
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLimpiarFechas}
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              padding: "8px 18px",
              borderRadius: 4,
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Tabla */}
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
                <th style={{ ...styles.th, width: "5%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  N°
                </th>
                <th style={{ ...styles.th, width: "11%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  FECHA REGISTRO
                </th>
                <th style={{ ...styles.th, width: "15%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  PERSONAL
                </th>
                <th style={{ ...styles.th, width: "10%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  ORIGEN
                </th>
                <th style={{ ...styles.th, width: "18%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  MODALIDAD
                </th>
                <th style={{ ...styles.th, width: "7%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  FECHA
                </th>
                <th style={{ ...styles.th, width: "5%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  HORA
                </th>
                <th style={{ ...styles.th, width: "21%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  UBICACIÓN
                </th>
                <th style={{ ...styles.th, width: "4%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  FOTOS
                </th>
                <th style={{ ...styles.th, width: "4%", textAlign: "center" }}>
                  EDITAR
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "#024885",
                      backgroundColor: "#f8fafc",
                      fontWeight: "600",
                    }}
                  >
                    Cargando registros del periodo... Por favor espere.
                  </td>
                </tr>
              ) : reportesCompletos.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    {fechasFiltro
                      ? "No se encontraron registros. Seleccione otro periodo."
                      : "Seleccione un rango de fechas (Desde / Hasta) y presione Buscar Rango."}
                  </td>
                </tr>
              ) : (
                reportesCompletos.map((item) => {
                  const fotosItem = extraerFotos(item);
                  const fechaRepObj = parseFechaPeru(item.fecha_reporte);
                  const fechaRepTxt = fechaRepObj
                    ? `${fechaRepObj
                        .toLocaleDateString("es-PE", { weekday: "short" })
                        .replace(".", "")
                        .toLowerCase()} ${fechaRepObj.toLocaleDateString("es-PE")} - ${fechaRepObj.toLocaleTimeString(
                        "es-PE",
                        { hour: "2-digit", minute: "2-digit", hour12: false }
                      )}`
                    : item.fecha_reporte || item.fecha_evento || "S/F";

                  return (
                    <tr
                      key={item.id_ocurrencia}
                      className="fila-tabla-operativa"
                      style={styles.tr}
                      onClick={() => setDetalleSeleccionado(item)}
                    >
                      <td
                        style={{
                          ...styles.td,
                          textAlign: "center",
                          verticalAlign: "top",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={styles.txtB}>#{item.id_ocurrencia}</div>
                      </td>

                      <td style={{ ...styles.td, verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {fechaRepTxt}
                        </div>
                      </td>

                      <td style={{ ...styles.td, verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {item.persona_nombre_completo}
                        </div>
                        <div style={{ ...styles.txtS, whiteSpace: "normal", wordBreak: "break-word" }}>
                          DNI: {item.persona_dni}
                        </div>
                      </td>

                      <td style={{ ...styles.td, verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {item.tipo_patrullaje_nombre || "---"}
                        </div>
                        <div style={{ ...styles.txtS, color: "#024885", fontWeight: "500", whiteSpace: "normal" }}>
                          {item.origen_descripcion}
                        </div>
                        <div style={{ ...styles.txtS, color: "#024885", fontWeight: "500", whiteSpace: "normal" }}>
                          {item.placa_con_tipo}
                        </div>
                      </td>

                      <td style={{ ...styles.td, verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                        <span
                          style={{
                            ...styles.badge,
                            display: "inline-block",
                            maxWidth: "100%",
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            backgroundColor: (() => {
                              const mod = String(item.modalidad_nombre || "").toUpperCase();
                              if (mod.includes("CUADERNO")) return "#dc2626";
                              if (mod.includes("TÁCTICO")) return "#024885";
                              if (mod.includes("PROTECCIÓN ESCOLAR")) return "#eab308";
                              return "#f1f5f9";
                            })(),
                            color: (() => {
                              const mod = String(item.modalidad_nombre || "").toUpperCase();
                              if (mod.includes("PROTECCIÓN ESCOLAR")) return "#1e293b";
                              if (!mod.includes("CUADERNO") && !mod.includes("TÁCTICO")) return "#475569";
                              return "white";
                            })(),
                            fontWeight: "700",
                          }}
                        >
                          {item.modalidad_nombre}
                        </span>
                        {(String(item.modalidad_nombre || "").toUpperCase().includes("PROTECCIÓN") ||
                          String(item.modalidad_nombre || "").toUpperCase().includes("TÁCTICO") ||
                          String(item.modalidad_nombre || "").toUpperCase().includes("CUADERNO")) &&
                        item.distancia_metros ? (
                          <div style={{ ...styles.txtS, marginTop: "2px", fontWeight: "700", color: "#024885" }}>
                            ({item.distancia_metros}m)
                          </div>
                        ) : null}
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          textAlign: "center",
                          backgroundColor: "#e8f5fd",
                          borderLeft: "3px solid #024885",
                        }}
                      >
                        <div style={{ ...styles.txtB, whiteSpace: "normal" }}>
                          {formatearFechaConDia(item.fecha_evento)}
                        </div>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          textAlign: "center",
                          backgroundColor: "#e8f5fd",
                          borderLeft: "3px solid #024885",
                        }}
                      >
                        <div style={styles.txtB}>
                          {item.hora_llegada ? String(item.hora_llegada).slice(0, 5) : "S/H"}
                        </div>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          borderRight: "1px solid #e2e8f0",
                          backgroundColor: "#e8f5fd",
                          borderLeft: "3px solid #024885",
                        }}
                      >
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {item.nombre_lugar || "---"}
                        </div>
                        <div style={{ ...styles.txtS, whiteSpace: "normal", wordBreak: "break-word" }}>
                          Ref: {item.referencia || "Sin referencia"}
                        </div>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign: "center",
                          borderLeft: "3px solid #024885",
                          verticalAlign: "top",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {fotosItem.length > 0 ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              backgroundColor: "#e0f2fe",
                              color: "#0369a1",
                              padding: "3px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "700",
                            }}
                          >
                            📷 {fotosItem.length}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>0</span>
                        )}
                      </td>

                      <td style={{ ...styles.td, textAlign: "center", verticalAlign: "top" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiltroTexto("");
                            setMostrarDesplegable(false);
                            setRegistroEditar({
                              ...item,
                              lista_fotos: fotosItem,
                              hora_alerta: item.hora_alerta ? String(item.hora_alerta).slice(0, 5) : "",
                              hora_llegada: item.hora_llegada ? String(item.hora_llegada).slice(0, 5) : "",
                              hora_repliegue: item.hora_repliegue ? String(item.hora_repliegue).slice(0, 5) : "",
                            });
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

        {/* Paginación */}
        <div style={styles.tableFooterPagination}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "auto" }}>
            <span style={{ fontSize: "12px", color: "#475569", fontWeight: "600" }}>Mostrar:</span>
            <select
              value={registrosPorPagina}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRegistrosPorPagina(val > 50 ? 50 : val);
                setPaginaActual(1);
              }}
              style={{ padding: 6, borderRadius: 6, backgroundColor: "#fff", border: "1px solid #e2e8f0" }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div style={styles.paginationFlex}>
            <button
              type="button"
              disabled={paginaActual === 1}
              onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
              style={styles.btnPageNew}
            >
              <Ionicons name="chevron-back" size={15} color={paginaActual === 1 ? "#cbd5e1" : "#334155"} />
            </button>

            <div style={styles.pageInfoWrapper}>
              Página {paginaActual} de {totalPaginas}
            </div>

            <button
              type="button"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
              style={styles.btnPageNew}
            >
              <Ionicons name="chevron-forward" size={15} color={paginaActual >= totalPaginas ? "#cbd5e1" : "#334155"} />
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
                N° de Ocurrencia: {detalleSeleccionado.codigo_seguimiento ?? ""}-SGS-GSC
              </h3>
              <button type="button" onClick={() => setDetalleSeleccionado(null)} style={styles.btnClose}>
                ✕
              </button>
            </div>

            <div style={styles.modalBodyScrollable}>
              <div style={styles.modalGridDobleFila}>
                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Personal:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.persona_nombre_completo || "---"} (
                    {detalleSeleccionado.persona_dni || "---"})
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span
                    style={{
                      ...styles.infoValue,
                      fontWeight: "700",
                      color: "#024885",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "250px",
                      display: "inline-block",
                    }}
                    title={detalleSeleccionado.modalidad_nombre || "---"}
                  >
                    {detalleSeleccionado.modalidad_nombre || "---"}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Unidad / Placa:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.placa_con_tipo || "---"}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Personal PNP:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.pnp_nombre_completo || "---"}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Origen Alerta:</span>
                  <span style={styles.infoValue}>
                    {Array.isArray(detalleSeleccionado.camaras) &&
                    detalleSeleccionado.camaras.length > 0
                      ? detalleSeleccionado.camaras.join(", ")
                      : detalleSeleccionado.origen_descripcion || "---"}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Tipo de patrullaje:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.tipo_patrullaje_nombre || "---"}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Fecha:</span>
                  <span style={styles.infoValue}>
                    {formatearFechaConDia(detalleSeleccionado.fecha_evento)}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Horas (Alert / Lleg / Repl):</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.hora_alerta || "S/H"} /{" "}
                    {detalleSeleccionado.hora_llegada || "S/H"} /{" "}
                    {detalleSeleccionado.hora_repliegue || "S/H"}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Contribuyente:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.nombre_informante || "---"} -{" "}
                    {detalleSeleccionado.numero_telefono || "---"}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Encargado:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.unidad_encargada || "---"}
                  </span>
                </div>

                <div style={{ ...styles.infoRowGrid, gridColumn: "span 2" }}>
                  <span style={styles.infoLabel}>Ubicación:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.nombre_lugar || "---"}
                    <span style={{ color: "#64748b", fontSize: "12px" }}>
                      {" "}
                      (Ref: {detalleSeleccionado.referencia || "Sin referencia"})
                    </span>
                  </span>
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <strong style={styles.sectionTitle}>Datos Importantes:</strong>
                <div style={{ ...styles.descBox, whiteSpace: "pre-line" }}>
                  {detalleSeleccionado.ocurrencia_descripcion || "Sin descripción detallada."}
                </div>
              </div>

              {(() => {
                const fotosArray = extraerFotos(detalleSeleccionado);
                if (fotosArray.length === 0) return null;

                return (
                  <div style={{ marginTop: "16px" }}>
                    <strong style={styles.sectionTitle}>
                      Evidencias Adjuntas ({fotosArray.length}):
                    </strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                      {fotosArray.map((urlFoto, idx) => (
                        <div key={idx} style={{ position: "relative", display: "inline-block" }}>
                          <a
                            href={urlFoto}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "6px 12px",
                              backgroundColor: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              color: "#024885",
                              fontSize: "12px",
                              fontWeight: "600",
                              textDecoration: "none",
                            }}
                            className="link-evidencia-foto"
                          >
                            <span>📷 Ver Foto {idx + 1}</span>
                          </a>

                          <div
                            className="tooltip-miniatura"
                            style={{
                              display: "none",
                              position: "absolute",
                              bottom: "105%",
                              left: "50%",
                              transform: "translateX(-50%)",
                              padding: "4px",
                              background: "#fff",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                              zIndex: 100,
                              width: "130px",
                              height: "130px",
                            }}
                          >
                            <img
                              src={urlFoto}
                              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
                              alt={`Preview ${idx + 1}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN */}
      {registroEditar && (
        <div
          style={styles.overlay}
          onClick={() => {
            if (!saving) setRegistroEditar(null);
          }}
        >
          <div
            style={{
              ...styles.modalDetail,
              maxWidth: "1300px",
              width: "min(95vw, calc(100vw - 265px))",
              height: "75vh",
              display: "flex",
              flexDirection: "column",
              marginLeft: "250px",
              padding: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                gap: "15px",
                flex: 1,
                overflow: "hidden",
                padding: "20px",
              }}
            >
              {/* COLUMNA 1: Bloqueados */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "4px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#024885",
                      fontWeight: "700",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={registroEditar.modalidad_nombre ?? ""}
                  >
                    {registroEditar.modalidad_nombre ?? ""}
                  </div>
                </div>

                {[
                  {
                    label: "N° de Ocurrencia:",
                    value: `${registroEditar.codigo_seguimiento ?? ""}-SGS-GSC`,
                  },
                  {
                    label: "Apellidos y Nombres:",
                    value: `${registroEditar.persona_nombre_completo ?? ""} - ${registroEditar.persona_dni ?? ""}`,
                  },
                  { label: "Origen:", value: registroEditar.origen_descripcion ?? "" },
                  { label: "Tipo Patrullaje:", value: registroEditar.tipo_patrullaje_nombre ?? "" },
                  { label: "Unidad:", value: registroEditar.placa_con_tipo ?? "" },
                  { label: "Efectivo PNP:", value: registroEditar.pnp_nombre_completo ?? "" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "4px",
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#64748b" }}>{item.label}</div>
                    <div style={{ fontSize: "13px", fontWeight: "600", wordBreak: "break-word" }}>
                      {item.value || "---"}
                    </div>
                  </div>
                ))}
              </div>

              {/* COLUMNA 2: Fechas, Horas, Dirección */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "4px", backgroundColor: "#fff" }}>
                  <div style={{ fontSize: "12px", color: "#024885", marginBottom: "4px", fontWeight: "bold" }}>
                    FECHA DEL EVENTO
                  </div>
                  <input
                    type="date"
                    max={hoyStr}
                    value={
                      registroEditar.fecha_evento && registroEditar.fecha_evento !== "S/F"
                        ? registroEditar.fecha_evento.split("T")[0]
                        : ""
                    }
                    onChange={(e) => {
                      const fechaSel = e.target.value;
                      if (fechaSel > hoyStr) {
                        window.alert("No puedes seleccionar una fecha posterior al día de hoy.");
                        return;
                      }
                      setRegistroEditar((prev) =>
                        prev ? { ...prev, fecha_evento: fechaSel } : null
                      );
                    }}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(["hora_alerta", "hora_llegada", "hora_repliegue"] as const).map((campo) => (
                    <div
                      key={campo}
                      style={{
                        padding: "10px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "4px",
                        backgroundColor: "#fff",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#024885", marginBottom: "4px", fontWeight: "bold" }}>
                        {campo.replace("_", " ").toUpperCase()}
                      </div>
                      <input
                        type="time"
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          padding: "4px",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                        value={String(registroEditar[campo] ?? "").slice(0, 5)}
                        onChange={(e) =>
                          setRegistroEditar((prev) =>
                            prev ? { ...prev, [campo]: e.target.value } : null
                          )
                        }
                      />
                    </div>
                  ))}
                </div>

                {tiemposEdicionInvalidos && (
                  <div
                    style={{
                      backgroundColor: "#FFF5F5",
                      borderLeft: "4px solid #D32F2F",
                      padding: "12px",
                      borderRadius: "4px",
                      border: "1px solid #f5c6cb",
                    }}
                  >
                    <div style={{ color: "#D32F2F", fontSize: "12px", fontWeight: "bold" }}>
                      Error en secuencia o rango de tiempo
                    </div>
                    <div style={{ color: "#555", fontSize: "11px", marginTop: "2px" }}>
                      Secuencia: Alerta ➔ Llegada ➔ Repliegue (máximo 12 horas en total).
                    </div>
                  </div>
                )}

                <div
                  style={{
                    padding: "12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    backgroundColor: "#fff",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#024885", marginBottom: "4px", fontWeight: "bold" }}>
                    DIRECCIÓN
                  </div>
                  <div style={{ position: "relative", width: "100%", marginBottom: "8px" }}>
                    <input
                      type="text"
                      placeholder="Haga clic para seleccionar o escribir..."
                      value={
                        mostrarDesplegable
                          ? filtroTexto ?? ""
                          : registroEditar?.nombre_lugar ?? ""
                      }
                      onFocus={() => {
                        setFiltroTexto("");
                        setMostrarDesplegable(true);
                      }}
                      onChange={(e) => {
                        setFiltroTexto(e.target.value);
                        if (!mostrarDesplegable) setMostrarDesplegable(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setMostrarDesplegable(false), 200);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 30px 8px 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                        backgroundColor: "#fff",
                        boxSizing: "border-box",
                        fontSize: "14px",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        color: "#64748b",
                        fontSize: "12px",
                      }}
                    >
                      ▼
                    </span>

                    {mostrarDesplegable && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          maxHeight: "200px",
                          overflowY: "auto",
                          backgroundColor: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "0 0 6px 6px",
                          boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                          zIndex: 1000,
                          marginTop: "2px",
                        }}
                      >
                        {ubicacionesFiltradas.length > 0 ? (
                          ubicacionesFiltradas.map((lugar, index) => (
                            <div
                              key={lugar.value ?? index}
                              onMouseDown={() => {
                                setRegistroEditar((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        nombre_lugar: lugar.label,
                                        id_lugar: lugar.value,
                                      }
                                    : null
                                );
                                setMostrarDesplegable(false);
                              }}
                              style={{
                                padding: "10px 12px",
                                cursor: "pointer",
                                borderBottom: "1px solid #f1f5f9",
                                fontSize: "13px",
                                color: "#334155",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor = "#f8fafc")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = "#ffffff")
                              }
                            >
                              {lugar.label}
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: "10px", color: "#94a3b8", fontSize: "13px", textAlign: "center" }}>
                            No se encontraron ubicaciones
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: "12px", color: "#024885", marginBottom: "4px", fontWeight: "bold" }}>
                    REFERENCIA
                  </div>
                  <input
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                    placeholder="Referencia"
                    maxLength={300}
                    value={registroEditar.referencia ?? ""}
                    onChange={(e) =>
                      setRegistroEditar((prev) =>
                        prev ? { ...prev, referencia: e.target.value } : null
                      )
                    }
                  />
                </div>
              </div>

              {/* COLUMNA 3: Descripción */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f1f5f9",
                    fontWeight: "bold",
                    color: "#024885",
                    fontSize: "12px",
                    borderBottom: "1px solid #e2e8f0",
                    textAlign: "center",
                  }}
                >
                  DATOS IMPORTANTES
                </div>
                <textarea
                  style={{
                    width: "100%",
                    flex: 1,
                    padding: "12px",
                    border: "none",
                    resize: "none",
                    overflowY: "auto",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                  maxLength={1500}
                  value={registroEditar.ocurrencia_descripcion ?? ""}
                  onChange={(e) =>
                    setRegistroEditar((prev) =>
                      prev ? { ...prev, ocurrencia_descripcion: e.target.value } : null
                    )
                  }
                />
              </div>

              {/* COLUMNA 4: Evidencias */}
              <div
                style={{
                  width: "280px",
                  minWidth: "280px",
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f1f5f9",
                    fontWeight: "bold",
                    color: "#024885",
                    fontSize: "12px",
                    borderBottom: "1px solid #e2e8f0",
                    textAlign: "center",
                  }}
                >
                  EVIDENCIAS ({(registroEditar.lista_fotos || []).length} / 4)
                </div>

                <div style={{ padding: "10px", flex: 1, overflowY: "auto" }}>
                  <input
                    type="file"
                    id="fileInputEvidencias"
                    style={{ display: "none" }}
                    accept="image/*"
                    multiple
                    onChange={handleFileChangeEdicion}
                  />

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(registroEditar.lista_fotos || []).map((urlFoto, index) => (
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
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#024885",
                            textDecoration: "none",
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
                            right: "40px",
                            top: "50%",
                            transform: "translateY(-50%)",
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
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
                            alt={`Preview ${index + 1}`}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setRegistroEditar((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    lista_fotos: (prev.lista_fotos || []).filter(
                                      (_, i) => i !== index
                                    ),
                                  }
                                : null
                            )
                          }
                          style={{
                            backgroundColor: "rgba(239,68,68,0.9)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "50%",
                            width: "22px",
                            height: "22px",
                            fontSize: "12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                          }}
                          title="Eliminar foto"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {(registroEditar.lista_fotos || []).length < 4 && (
                      <button
                        type="button"
                        onClick={() =>
                          document.getElementById("fileInputEvidencias")?.click()
                        }
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: "6px",
                          border: "2px dashed #cbd5e1",
                          backgroundColor: "#f8fafc",
                          color: "#64748b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "bold",
                          gap: "6px",
                        }}
                      >
                        <span style={{ fontSize: "16px" }}>+</span>
                        Agregar Foto ({(registroEditar.lista_fotos || []).length}/4)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                gap: "10px",
                borderTop: "1px solid #e2e8f0",
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
                disabled={saving || tiemposEdicionInvalidos}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: tiemposEdicionInvalidos ? "#94a3b8" : "#024885",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: tiemposEdicionInvalidos ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
                onClick={() => setModalConfirmacionOpen(true)}
              >
                Actualizar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN */}
      {modalConfirmacionOpen && (
        <div style={styles.confirmOverlay}>
          <div style={styles.confirmBox}>
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

      {/* OVERLAY PROGRESO AL GUARDAR O EXPORTAR EXCEL */}
      {(saving || cargandoExcel) && (
        <div style={{ ...styles.confirmOverlay, zIndex: 10000 }}>
          <div style={{ ...styles.confirmBox, width: "320px", padding: "28px" }}>
            <Ionicons
              name={
                cargandoExcel
                  ? "document-text"
                  : isFinished
                  ? "checkmark-circle"
                  : "cloud-upload"
              }
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
              {cargandoExcel ? "Generando Excel en servidor..." : uploadStatus}
            </div>
            {!cargandoExcel && (
              <>
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
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "#64748b",
                    fontWeight: "bold",
                  }}
                >
                  {uploadProgress}%
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties | any> = {
  container: {
    padding: "24px",
    backgroundColor: "#f9fbfc",
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "15px",
    flexShrink: 0,
  },
  tabs: {
    display: "flex",
    gap: "4px",
    backgroundColor: "#e2e8f0",
    padding: "4px",
    borderRadius: "8px",
    alignItems: "center",
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
  },
  tableScrollContainer: {
    overflowX: "auto",
    overflowY: "auto",
    minHeight: "545px",
    maxHeight: "71vh",
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
    color: "#64748b",
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
    fontSize: "12px",
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
  confirmOverlay: {
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
  },
  confirmBox: {
    backgroundColor: "white",
    padding: "24px",
    borderRadius: "16px",
    width: "380px",
    textAlign: "center",
    boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
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
  modalGridDobleFila: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0px 24px",
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
  sectionTitle: {
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    display: "block",
    marginBottom: "6px",
  },
  descBox: {
    color: "#334155",
    fontSize: "13px",
    backgroundColor: "#f8fafc",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    lineHeight: "1.5",
    margin: 0,
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
};