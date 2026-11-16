import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { comprimirImagen } from "@/utils/compressImage";
import { subirFotoAlServidor } from "@/utils/subirFotoServidor";
import { useAuth } from "../../context/userContext";

import RegistroBoton from "./modalboton";
import RegistroRedes from "./modalredes";
import RegistroOcurrenciat from "./modaltele";
import RegistroOcurrencia from "./modalvvcam";
import RegistroOperador from "./modaloper";
import RegistroSerIn from "./modaliniciocecom";
import RegistroSerFi from "./modalfincecom";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";
const MJM_BLUE = "#024885";
const R2_DOMAIN_DEFAULT = "pub-bce5ad6110584baca6912e8944cd2051.r2.dev";

interface Ocurrencia {
  id_ocurrencia: number | string;
  fecha_reporte: string;
  distancia_metros?: number;
  placa_con_tipo?: string;
  tipo_asignacion?: string;
  camaras_json?: string | string[];
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
  vehiculos_json?: string | string[];
  vehiculos?: string[];
  numero_telefono: number;
  id_usuario: string;
  nombre_informante: string;
  modalidad_nombre: string;
  via_nombre?: string;
  camaras?: string[];
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

const getHoyLocal = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const obtenerUrlFoto = (foto: any): string => {
  if (!foto) return "";
  let ruta =
    typeof foto === "string"
      ? foto
      : foto?.url_imagen || foto?.url || foto?.path || "";
  if (!ruta) return "";

  ruta = String(ruta).replace(/[\[\]'"]+/g, "").trim();
  const firstIndex = ruta.indexOf(R2_DOMAIN_DEFAULT);
  if (firstIndex !== -1) {
    const protocolIndex = ruta.lastIndexOf("http", firstIndex);
    const startIndex = protocolIndex !== -1 ? protocolIndex : firstIndex;
    const cleanSub = ruta.slice(startIndex);
    const matchExt = cleanSub.match(
      /^(https?:\/\/[^\s\)]+?\.(jpg|jpeg|png|webp|gif))/i
    );
    if (matchExt && matchExt[1]) {
      ruta = matchExt[1];
    } else {
      const secondIndex = cleanSub.indexOf(
        R2_DOMAIN_DEFAULT,
        R2_DOMAIN_DEFAULT.length
      );
      ruta = secondIndex !== -1 ? cleanSub.slice(0, secondIndex) : cleanSub;
    }
  }

  if (
    ruta.startsWith("http://") ||
    ruta.startsWith("https://") ||
    ruta.startsWith("data:image")
  ) {
    return ruta;
  }

  return `${API_URL.replace(/\/+$/, "")}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
};

const formatearFechaConDia = (fechaStr: string): string => {
  if (!fechaStr) return "S/F";
  const soloFecha = String(fechaStr).split("T")[0].split(" ")[0];
  const fechaLimpia = soloFecha.replace(/-/g, "/");
  const fechaObjReal = new Date(fechaLimpia);
  if (Number.isNaN(fechaObjReal.getTime())) return fechaStr;

  const diaSemana = fechaObjReal
    .toLocaleDateString("es-PE", { weekday: "short" })
    .replace(".", "")
    .toLowerCase();
  const fechaNumerica = fechaObjReal.toLocaleDateString("es-PE");
  return `${diaSemana} ${fechaNumerica}`;
};

const formatearFechaRegistro = (fechaReporte?: string, fallbackEvento?: string): string => {
  if (!fechaReporte) return fallbackEvento || "S/F";
  const isoCompat = String(fechaReporte).trim().replace(" ", "T");
  const fechaObj = new Date(isoCompat);
  if (Number.isNaN(fechaObj.getTime())) return fechaReporte;

  const diaSemana = fechaObj
    .toLocaleDateString("es-PE", { weekday: "short" })
    .replace(".", "")
    .toLowerCase();
  const fechaNumerica = fechaObj.toLocaleDateString("es-PE");
  const hora = fechaObj.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${diaSemana} ${fechaNumerica} - ${hora}`;
};

export default function ReportesWebScreen() {
  const { userData } = useAuth();
  const userIdStable = userData?.id || null;

  const [loading, setLoading] = useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [subiendoFotoEdicion, setSubiendoFotoEdicion] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("Actualizando...");
  const [isFinished, setIsFinished] = useState(false);

  const [totalMisRegistros, setTotalMisRegistros] = useState(0);
  const [totalSinRestriccionBD, setTotalSinRestriccionBD] = useState(0);
  const [listaUbicaciones, setListaUbicaciones] = useState<
    { value: any; label: string }[]
  >([]);

  const [registroEditar, setRegistroEditar] = useState<Ocurrencia | null>(null);
  const [reportesCompletos, setReportesCompletos] = useState<Ocurrencia[]>([]);

  const [filtroPropietario, setFiltroPropietario] = useState<"TODOS" | "MIOS">(
    "TODOS"
  );
  const [reporteServicioActivo, setReporteServicioActivo] = useState(false);

  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);
  const [totalRegistrosBD, setTotalRegistrosBD] = useState(0);

  const [modalInsertOpen, setModalInsertOpen] = useState<string | null>(null);
  const [detalleSeleccionado, setDetalleSeleccionado] =
    useState<Ocurrencia | null>(null);
  const [modalConfirmacionOpen, setModalConfirmacionOpen] = useState(false);
  const [mostrarDesplegable, setMostrarDesplegable] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");

  const isMountedRef = useRef(true);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const lugaresCargadosRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarTimersEdicion = useCallback(() => {
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
      fetchAbortRef.current?.abort();
      limpiarTimersEdicion();
    };
  }, [limpiarTimersEdicion]);

  const fetchLugares = useCallback(async (tipoLugarId: string) => {
    if (lugaresCargadosRef.current) return;
    try {
      const queryTipo =
        tipoLugarId && tipoLugarId !== "default" ? tipoLugarId : "4";
      const response = await fetch(
        `${API_URL}/catalogos/lugares?tipo=${queryTipo}`
      );
      if (!response.ok) throw new Error("Error al obtener lugares");
      const data = await response.json();
      const lista = Array.isArray(data) ? data : data.data || [];

      const opcionesUbicaciones = lista.map((item: any) => ({
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
    } catch (error) {
      console.error("Error al cargar lugares:", error);
    }
  }, []);

  const fetchContadores = useCallback(async () => {
    try {
      const promesas: Promise<Response>[] = [
        fetch(`${API_URL}/ocurrencias/listar/tablasipcop-rango12h?limit=1`),
      ];
      if (userIdStable) {
        promesas.push(
          fetch(
            `${API_URL}/ocurrencias/listar/tablasipcop-rango12h?limit=1&id_usuario=${encodeURIComponent(
              userIdStable
            )}`
          )
        );
      }

      const [resTotal, resMios] = await Promise.all(promesas);
      const jsonTotal = await resTotal.json();
      const jsonMios = resMios ? await resMios.json() : null;

      if (!isMountedRef.current) return;
      if (jsonTotal?.success) setTotalSinRestriccionBD(jsonTotal.total || 0);
      if (jsonMios?.success) setTotalMisRegistros(jsonMios.total || 0);
    } catch (err) {
      console.error("Error al obtener contadores:", err);
    }
  }, [userIdStable]);

  useEffect(() => {
    fetchContadores();
  }, [fetchContadores]);

  const fetchOcurrencias = useCallback(
    async (page: number, limit: number) => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setLoading(true);

      try {
        let url = `${API_URL}/ocurrencias/listar/tablasipcop-rango12h?page=${page}&limit=${limit}`;

        if (filtroPropietario === "MIOS" && userIdStable) {
          url += `&id_usuario=${encodeURIComponent(userIdStable)}`;
        } else if (reporteServicioActivo) {
          url += `&filtro_modalidad=SOLO_139_140`;
        } else {
          url += `&filtro_modalidad=EXCLUIR_139_140`;
        }

        const response = await fetch(url, { signal: controller.signal });
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
        if (isMountedRef.current && fetchAbortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [filtroPropietario, reporteServicioActivo, userIdStable]
  );

  useEffect(() => {
    fetchOcurrencias(paginaActual, registrosPorPagina);
  }, [paginaActual, registrosPorPagina, fetchOcurrencias]);

  // Refresco seguro al cerrar cualquiera de los 7 modales sin doble petición
  const handleCloseModalInsert = useCallback(() => {
    setModalInsertOpen(null);
    fetchContadores();

    if (filtroPropietario === "TODOS" && paginaActual === 1) {
      fetchOcurrencias(1, registrosPorPagina);
    } else {
      setFiltroPropietario("TODOS");
      setPaginaActual(1);
    }
  }, [
    filtroPropietario,
    paginaActual,
    registrosPorPagina,
    fetchContadores,
    fetchOcurrencias,
  ]);

  // Validación de horas para el modal de edición (bloquea el botón Guardar)
  const horasEdicionInvalidas = useMemo(() => {
    if (
      !registroEditar?.hora_alerta ||
      !registroEditar?.hora_llegada ||
      !registroEditar?.hora_repliegue
    ) {
      return false;
    }

    const aMinutos = (horaStr: string) => {
      const [h, m] = horaStr.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
      return h * 60 + m;
    };

    const alerta = aMinutos(registroEditar.hora_alerta);
    let llegada = aMinutos(registroEditar.hora_llegada);
    let repliegue = aMinutos(registroEditar.hora_repliegue);
    if (Number.isNaN(alerta) || Number.isNaN(llegada) || Number.isNaN(repliegue)) {
      return true;
    }

    if (llegada < alerta) llegada += 1440;
    if (repliegue < alerta) repliegue += 1440;
    if (repliegue < llegada) repliegue += 1440;

    const secuenciaCorrecta = alerta <= llegada && llegada <= repliegue;
    const dentroDe12Horas = repliegue - alerta <= 12 * 60;
    return !secuenciaCorrecta || !dentroDe12Horas;
  }, [
    registroEditar?.hora_alerta,
    registroEditar?.hora_llegada,
    registroEditar?.hora_repliegue,
  ]);

  const ubicacionesFiltradas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    if (!q) return listaUbicaciones;
    return listaUbicaciones.filter((l) =>
      (l.label || "").toLowerCase().includes(q)
    );
  }, [listaUbicaciones, filtroTexto]);

  // Subida directa a R2 en el modal de edición (sin mandar Base64 pesado al PUT)
  const handleFileChangeEdicion = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !registroEditar) return;

      const fotosActuales = registroEditar.lista_fotos || [];
      const espacioDisponible = 4 - fotosActuales.length;
      if (espacioDisponible <= 0) {
        alert("Ya has alcanzado el límite máximo de 4 fotos.");
        e.target.value = "";
        return;
      }

      const archivosAProcesar = Array.from(files).slice(0, espacioDisponible);
      setSubiendoFotoEdicion(true);

      try {
        const urlsSubidas = await Promise.all(
          archivosAProcesar.map(async (file) => {
            const comprimida = await comprimirImagen(file);
            return subirFotoAlServidor(
              comprimida,
              API_URL,
              undefined,
              registroEditar.fecha_evento?.split("T")[0]
            );
          })
        );

        if (!isMountedRef.current) return;
        setRegistroEditar((prev) =>
          prev
            ? {
                ...prev,
                lista_fotos: [...(prev.lista_fotos || []), ...urlsSubidas],
              }
            : null
        );
      } catch (error: any) {
        console.error("Error subiendo fotos en edición:", error);
        alert(error?.message || "No se pudo subir una o más imágenes.");
      } finally {
        if (isMountedRef.current) setSubiendoFotoEdicion(false);
        e.target.value = "";
      }
    },
    [registroEditar]
  );

  const handleGuardarCambios = async () => {
    if (!registroEditar || guardandoEdicion || subiendoFotoEdicion) return;
    if (horasEdicionInvalidas) {
      alert("Corrige la secuencia u horario antes de guardar.");
      return;
    }

    limpiarTimersEdicion();
    setGuardandoEdicion(true);
    setUploadProgress(0);
    setUploadStatus("Actualizando...");
    setIsFinished(false);

    intervalRef.current = setInterval(
      () => setUploadProgress((p) => (p < 90 ? p + 10 : p)),
      100
    );

    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), 30000);

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

      const data = await response.json();
      limpiarTimersEdicion();

      if (!isMountedRef.current) return;

      if (data.success) {
        setUploadProgress(100);
        setUploadStatus("¡Correcto!");
        setIsFinished(true);

        timeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          setGuardandoEdicion(false);
          setRegistroEditar(null);
          fetchContadores();
          fetchOcurrencias(paginaActual, registrosPorPagina);
        }, 600);
      } else {
        setGuardandoEdicion(false);
        alert("Error del servidor: " + (data.error || "No se pudo actualizar"));
      }
    } catch (error: any) {
      limpiarTimersEdicion();
      if (!isMountedRef.current) return;
      setGuardandoEdicion(false);
      console.error("Error de conexión:", error);
      alert(
        error?.name === "AbortError"
          ? "El servidor tardó demasiado en responder."
          : "No se pudo conectar con el servidor."
      );
    } finally {
      clearTimeout(abortTimeout);
    }
  };

  useEffect(() => {
    const estiloHover = document.createElement("style");
    estiloHover.innerText = `
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
    `;
    document.head.appendChild(estiloHover);
    return () => {
      document.head.removeChild(estiloHover);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (modalConfirmacionOpen) {
          setModalConfirmacionOpen(false);
        } else if (registroEditar && !guardandoEdicion) {
          setRegistroEditar(null);
        } else {
          setDetalleSeleccionado(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalConfirmacionOpen, registroEditar, guardandoEdicion]);

  const totalPaginas = useMemo(() => {
    const paginas = Math.ceil(totalRegistrosBD / registrosPorPagina);
    return paginas > 0 ? paginas : 1;
  }, [totalRegistrosBD, registrosPorPagina]);

  const hoyLocal = getHoyLocal();

  return (
    <div style={styles.container}>
      {/* Accesos Rápidos */}
      <div style={styles.grid}>
        <button
          onClick={() => setModalInsertOpen("camara")}
          style={{ ...styles.card, backgroundColor: MJM_BLUE }}
        >
          <Ionicons name="videocam" size={26} color="white" />
          <div style={styles.cardLab}>CÁMARA</div>
        </button>
        <button
          onClick={() => setModalInsertOpen("telefono")}
          style={{ ...styles.card, backgroundColor: MJM_BLUE }}
        >
          <Ionicons name="call" size={26} color="white" />
          <div style={styles.cardLab}>TELÉFONO</div>
        </button>
        <button
          onClick={() => setModalInsertOpen("boton")}
          style={{ ...styles.card, backgroundColor: MJM_BLUE }}
        >
          <Ionicons name="alert-circle" size={26} color="white" />
          <div style={styles.cardLab}>BOTÓN DE PÁNICO</div>
        </button>
        <button
          onClick={() => setModalInsertOpen("redes")}
          style={{ ...styles.card, backgroundColor: MJM_BLUE }}
        >
          <Ionicons name="share-social" size={26} color="white" />
          <div style={styles.cardLab}>REDES SOCIALES</div>
        </button>
        <button
          onClick={() => setModalInsertOpen("operador")}
          style={{ ...styles.card, backgroundColor: MJM_BLUE }}
        >
          <Ionicons name="megaphone" size={26} color="white" />
          <div style={styles.cardLab}>RADIOPERADOR</div>
        </button>

        <div
          style={{
            ...styles.card,
            backgroundColor: MJM_BLUE,
            display: "flex",
            flexDirection: "row",
            padding: 0,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setModalInsertOpen("servicioIn")}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              color: "white",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "15px 10px",
              cursor: "pointer",
              borderRight: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <Ionicons name="play-circle" size={24} color="white" />
            <div style={{ ...styles.cardLab, marginTop: 5 }}>INICIO SERVICIO</div>
          </button>
          <button
            onClick={() => setModalInsertOpen("servicioFi")}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              color: "white",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "15px 10px",
              cursor: "pointer",
            }}
          >
            <div style={{ ...styles.cardLab, marginTop: 5 }}>REPORTAR FALLAS / CIERRE</div>
          </button>
        </div>
      </div>

      {/* Cabecera Principal */}
      <div style={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h2 style={{ color: MJM_BLUE, margin: 0, fontWeight: 700, fontSize: "22px" }}>
            Últimas 12 horas: {totalSinRestriccionBD} registro(s) en total
          </h2>

          {filtroPropietario === "TODOS" && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={() => {
                  setReporteServicioActivo((prev) => !prev);
                  setPaginaActual(1);
                }}
                style={{
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  backgroundColor: reporteServicioActivo ? MJM_BLUE : "#e2e8f0",
                  color: reporteServicioActivo ? "#ffffff" : "#475569",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                <Ionicons
                  name={reporteServicioActivo ? "checkbox" : "square-outline"}
                  size={16}
                  color={reporteServicioActivo ? "#ffffff" : "#475569"}
                />
                Inicio / Fin Servicio
              </button>
            </div>
          )}
        </div>

        {/* PESTAÑAS DE PROPIETARIO */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={styles.tabs}>
            <button
              onClick={() => {
                fetchOcurrencias(paginaActual, registrosPorPagina);
                fetchContadores();
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Actualizar tabla"
            >
              <Ionicons name="reload" size={17} color={MJM_BLUE} />
            </button>
            <button
              onClick={() => {
                setFiltroPropietario("TODOS");
                setPaginaActual(1);
              }}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: "none",
                fontWeight: 600,
                fontSize: "11px",
                cursor: "pointer",
                backgroundColor:
                  filtroPropietario === "TODOS" ? MJM_BLUE : "#e2e8f0",
                color: filtroPropietario === "TODOS" ? "#ffffff" : "#475569",
              }}
            >
              SOLO OCURRENCIAS
            </button>

            <button
              onClick={() => {
                setFiltroPropietario("MIOS");
                setPaginaActual(1);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                fontWeight: 600,
                fontSize: "11px",
                cursor: "pointer",
                backgroundColor:
                  filtroPropietario === "MIOS" ? MJM_BLUE : "#e2e8f0",
                color: filtroPropietario === "MIOS" ? "#ffffff" : "#475569",
              }}
            >
              MIS REGISTROS ({totalMisRegistros})
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Datos */}
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
                <th style={{ ...styles.th, width: "4%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>N°</th>
                <th style={{ ...styles.th, width: "12%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>FECHA REGISTRO</th>
                <th style={{ ...styles.th, width: "15%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>PERSONAL</th>
                <th style={{ ...styles.th, width: "10%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>ORIGEN</th>
                <th style={{ ...styles.th, width: "18%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>MODALIDAD</th>
                <th style={{ ...styles.th, width: "7%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>FECHA</th>
                <th style={{ ...styles.th, width: "5%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>HORA</th>
                <th style={{ ...styles.th, width: "19%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>UBICACIÓN</th>
                <th
                  style={{
                    ...styles.th,
                    width: "4%",
                    textAlign: "center",
                    borderRight: filtroPropietario === "MIOS" ? "1px solid #cbd5e1" : "none",
                  }}
                >
                  FOTOS
                </th>
                {filtroPropietario === "MIOS" && (
                  <th style={{ ...styles.th, width: "5%", textAlign: "center" }}>EDITAR</th>
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={filtroPropietario === "MIOS" ? 10 : 9}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: MJM_BLUE,
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        fontWeight: "600",
                        fontSize: "15px",
                      }}
                    >
                      <span>Cargando registros del periodo... Por favor espere.</span>
                    </div>
                  </td>
                </tr>
              ) : reportesCompletos.length === 0 ? (
                <tr>
                  <td
                    colSpan={filtroPropietario === "MIOS" ? 10 : 9}
                    style={{ textAlign: "center", padding: "30px", color: "#64748b" }}
                  >
                    No se encontraron registros.
                  </td>
                </tr>
              ) : (
                reportesCompletos.map((item) => {
                  const vehiculosTexto = Array.isArray(item.vehiculos)
                    ? item.vehiculos.join(", ")
                    : item.placa_con_tipo || "";

                  return (
                    <tr
                      key={item.id_ocurrencia}
                      className="fila-tabla-operativa"
                      style={styles.tr}
                      onClick={() => setDetalleSeleccionado(item)}
                    >
                      <td style={{ ...styles.td, textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                        <div style={styles.txtB} title={String(item.id_ocurrencia)}>
                          #{item.id_ocurrencia}
                        </div>
                      </td>

                      <td style={{ ...styles.td, verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                        <div style={styles.celdaTruncadaContainer}>
                          <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }}>
                            {formatearFechaRegistro(item.fecha_reporte, item.fecha_evento)}
                          </div>
                        </div>
                      </td>

                      <td style={{ ...styles.td, verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                        <div style={styles.celdaTruncadaContainer}>
                          <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }} title={item.persona_nombre_completo}>
                            {item.persona_nombre_completo}
                          </div>
                        </div>
                      </td>

                      <td style={{ ...styles.td, verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                        <div style={styles.celdaTruncadaContainer}>
                          <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word", fontSize: "11px" }} title={item.tipo_patrullaje_nombre || "---"}>
                            {item.tipo_patrullaje_nombre || "---"}
                          </div>
                          <div style={{ ...styles.txtS, color: MJM_BLUE, fontWeight: "600", whiteSpace: "normal", wordBreak: "break-word", fontSize: "13px" }} title={item.origen_descripcion}>
                            {item.origen_descripcion}
                          </div>
                          {vehiculosTexto && vehiculosTexto !== "Sin dato" ? (
                            <div style={{ ...styles.txtS, color: MJM_BLUE, fontWeight: "500", whiteSpace: "normal", wordBreak: "break-word" }} title={vehiculosTexto}>
                              {vehiculosTexto}
                            </div>
                          ) : null}
                        </div>
                      </td>

                      <td style={{ ...styles.td, verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                        <div style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
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
                                if (mod.includes("TÁCTICO")) return MJM_BLUE;
                                if (mod.includes("PROTECCIÓN ESCOLAR")) return "#eab308";
                                return "#f1f5f9";
                              })(),
                              color: (() => {
                                const mod = String(item.modalidad_nombre || "").toUpperCase();
                                if (mod.includes("PROTECCIÓN ESCOLAR")) return "#1e293b";
                                if (!mod.includes("CUADERNO") && !mod.includes("TÁCTICO")) return "#37393b";
                                return "white";
                              })(),
                              fontWeight: "700",
                            }}
                          >
                            {item.modalidad_nombre}
                          </span>
                        </div>
                      </td>

                      <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", textAlign: "center", backgroundColor: "#e8f5fd", borderLeft: `3px solid ${MJM_BLUE}` }}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word", fontWeight: "bold" }}>
                          {formatearFechaConDia(item.fecha_evento)}
                        </div>
                      </td>

                      <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", textAlign: "center", backgroundColor: "#e8f5fd", borderLeft: `3px solid ${MJM_BLUE}` }}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word", fontWeight: "bold" }}>
                          {item.hora_llegada ? String(item.hora_llegada).slice(0, 5) : "S/H"}
                        </div>
                      </td>

                      <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", backgroundColor: "#e8f5fd", borderLeft: `3px solid ${MJM_BLUE}` }}>
                        <div style={styles.celdaTruncadaContainer}>
                          <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }} title={item.label || item.via_nombre || "---"}>
                            {item.nombre_lugar || "---"}
                          </div>
                          <div style={{ ...styles.txtS, whiteSpace: "normal", wordBreak: "break-word" }} title={item.referencia || "Sin referencia"}>
                            Ref: {item.referencia || "Sin referencia"}
                          </div>
                        </div>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign: "center",
                          borderLeft: `3px solid ${MJM_BLUE}`,
                          verticalAlign: "top",
                          borderRight: filtroPropietario === "MIOS" ? "1px solid #e2e8f0" : "none",
                        }}
                      >
                        {(() => {
                          const total = Array.isArray(item.fotos)
                            ? item.fotos.filter((f) => f && f !== "null").length
                            : Number(item.total_fotos || 0);

                          return total > 0 ? (
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
                              📷 {total}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>0</span>
                          );
                        })()}
                      </td>

                      {filtroPropietario === "MIOS" && (
                        <td style={{ ...styles.td, textAlign: "center", verticalAlign: "top" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRegistroEditar({
                                ...item,
                                lista_fotos: item.lista_fotos || item.fotos || [],
                              });
                              fetchLugares("default");
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
                            <Ionicons name="pencil" size={15} color={MJM_BLUE} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN */}
        <div style={styles.tableFooterPagination}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "auto" }}>
            <span style={{ fontSize: "12px", color: "#475569", fontWeight: "600" }}>
              Mostrar:
            </span>
            <select
              value={registrosPorPagina}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRegistrosPorPagina(val > 50 ? 50 : val);
                setPaginaActual(1);
              }}
              style={{ padding: 6, borderRadius: 6, backgroundColor: "#fff" }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div style={styles.paginationFlex}>
            <button
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

            <div style={styles.pageInfoWrapper}>
              Página {paginaActual} de {totalPaginas}
            </div>

            <button
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
              <h3 style={{ margin: 0, color: MJM_BLUE, fontWeight: 700 }}>
                N° de Ocurrencia:{" "}
                {detalleSeleccionado.codigo_seguimiento
                  ? `${detalleSeleccionado.codigo_seguimiento}-SGS-GSC`
                  : "---"}
              </h3>
              <button onClick={() => setDetalleSeleccionado(null)} style={styles.btnClose}>
                ✕
              </button>
            </div>

            <div style={styles.modalBodyScrollable}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
                  <strong style={{ color: MJM_BLUE, fontSize: "13px", display: "block", marginBottom: "10px" }}>
                    <span
                      style={{
                        ...styles.infoValue,
                        fontWeight: "700",
                        color: MJM_BLUE,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                        display: "inline-block",
                      }}
                      title={detalleSeleccionado.modalidad_nombre || "---"}
                    >
                      {detalleSeleccionado.modalidad_nombre || "---"}
                    </span>
                  </strong>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Datos Personales:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.persona_nombre_completo || "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Origen:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.origen_descripcion || "---"} ({" "}
                      {detalleSeleccionado.tipo_patrullaje_nombre || "---"})
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Unidad Vehicular:</span>
                    <span style={styles.infoValue}>
                      {Array.isArray(detalleSeleccionado.vehiculos)
                        ? detalleSeleccionado.vehiculos.join(", ") || "---"
                        : detalleSeleccionado.placa_con_tipo || "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Personal PNP:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.pnp_nombre_completo || "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Cámara(s):</span>
                    <span style={styles.infoValue}>
                      {Array.isArray(detalleSeleccionado.camaras) &&
                      detalleSeleccionado.camaras.length > 0 ? (
                        <ol style={{ margin: 0, paddingLeft: "20px" }}>
                          {detalleSeleccionado.camaras.map((camara, index) => (
                            <li key={index}>{camara}</li>
                          ))}
                        </ol>
                      ) : (
                        <span>---</span>
                      )}
                    </span>
                  </div>
                </div>

                <div style={{ padding: "12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <strong style={{ color: MJM_BLUE, fontSize: "13px", display: "block", marginBottom: "10px" }}>
                    Ubicación y temporalidad:
                  </strong>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Fecha Evento:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.fecha_evento
                        ? formatearFechaConDia(detalleSeleccionado.fecha_evento)
                        : "S/F"}
                    </span>
                  </div>

                  <div style={{ ...styles.infoRowGrid, display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <span style={styles.infoLabel}>Hora Alerta:</span>
                      <div style={styles.infoValue}>
                        {detalleSeleccionado.hora_alerta
                          ? String(detalleSeleccionado.hora_alerta).substring(0, 5)
                          : "S/H"}
                      </div>
                    </div>
                    <div style={{ textAlign: "center", flex: 1, borderLeft: "1px solid #eee", borderRight: "1px solid #eee" }}>
                      <span style={styles.infoLabel}>Hora Llegada:</span>
                      <div style={styles.infoValue}>
                        {detalleSeleccionado.hora_llegada
                          ? String(detalleSeleccionado.hora_llegada).substring(0, 5)
                          : "S/H"}
                      </div>
                    </div>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <span style={styles.infoLabel}>Hora Repliegue:</span>
                      <div style={styles.infoValue}>
                        {detalleSeleccionado.hora_repliegue
                          ? String(detalleSeleccionado.hora_repliegue).substring(0, 5)
                          : "S/H"}
                      </div>
                    </div>
                  </div>

                  <div style={styles.infoRowGrid}>
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

                <div style={{ padding: "12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <strong style={{ color: MJM_BLUE, fontSize: "13px", display: "block", marginBottom: "10px" }}>
                    Contacto y derivación:
                  </strong>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Contribuyente:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.nombre_informante || "-"} -{" "}
                      {detalleSeleccionado.numero_telefono}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Derivado:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.unidad_encargada || "S/H"}
                    </span>
                  </div>
                </div>
              </div>

              {/* EVIDENCIAS */}
              {(() => {
                const fotosArray = (
                  detalleSeleccionado.lista_fotos ||
                  detalleSeleccionado.fotos ||
                  []
                ).filter((f) => f && f !== "null");

                if (fotosArray.length === 0) return null;

                return (
                  <div style={{ marginTop: "16px" }}>
                    <strong style={styles.sectionTitle}>
                      Evidencias Adjuntas ({fotosArray.length}):
                    </strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                      {fotosArray.map((foto: any, idx: number) => {
                        const urlFotoFinal = obtenerUrlFoto(foto);
                        return (
                          <div key={idx} style={{ position: "relative", display: "inline-block" }}>
                            <a
                              href={urlFotoFinal}
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
                                color: MJM_BLUE,
                                fontSize: "12px",
                                fontWeight: "600",
                                textDecoration: "none",
                                cursor: "pointer",
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
                                src={urlFotoFinal}
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
                                alt={`Preview ${idx + 1}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginTop: "16px" }}>
                <strong style={styles.sectionTitle}>Descripción / Suceso:</strong>
                <div
                  style={{
                    ...styles.descBox,
                    width: "100%",
                    padding: "12px",
                    fontSize: "13px",
                    color: "#1e293b",
                    boxSizing: "border-box",
                    whiteSpace: "pre-line",
                  }}
                >
                  {detalleSeleccionado.ocurrencia_descripcion ||
                    "Sin descripción detallada."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN */}
      {registroEditar && (
        <div
          style={styles.overlay}
          onClick={() => {
            if (!guardandoEdicion) setRegistroEditar(null);
          }}
        >
          <div
            key={registroEditar.id_ocurrencia}
            style={{
              ...styles.modalDetail,
              maxWidth: "1260px",
              width: "95%",
              height: "78vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", gap: "15px", flex: 1, overflow: "hidden", padding: "12px" }}>
              {/* COLUMNA 1 */}
              <div style={{ flex: 1, minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      color: MJM_BLUE,
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
                  { label: "N° de Ocurrencia:", value: `${registroEditar.codigo_seguimiento ?? ""}-SGS-GSC` },
                  { label: "Apellidos y Nombres:", value: `${registroEditar.persona_nombre_completo ?? ""} - ${registroEditar.persona_dni ?? ""}` },
                  { label: "Origen:", value: `${registroEditar.origen_descripcion ?? ""}` },
                  { label: "Tipo Patrullaje:", value: `${registroEditar.tipo_patrullaje_nombre ?? ""}` },
                  {
                    label: "Unidad:",
                    value: Array.isArray(registroEditar.vehiculos)
                      ? registroEditar.vehiculos.join(", ") || "---"
                      : registroEditar.placa_con_tipo ?? "",
                  },
                  { label: "Efectivo PNP:", value: `${registroEditar.pnp_nombre_completo ?? ""}` },
                ].map((item, idx) => (
                  <div key={idx} style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "4px", backgroundColor: "#f8fafc" }}>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>{item.label}</div>
                    <div style={{ fontSize: "13px", fontWeight: "600", wordBreak: "break-word" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* COLUMNA 2 */}
              <div style={{ flex: 1, minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "4px", backgroundColor: "#fff" }}>
                  <div style={{ fontSize: "12px", color: MJM_BLUE, marginBottom: "4px", fontWeight: "bold" }}>
                    FECHA DEL EVENTO
                  </div>
                  <input
                    type="date"
                    max={hoyLocal}
                    value={registroEditar.fecha_evento ? registroEditar.fecha_evento.split("T")[0] : ""}
                    onChange={(e) => {
                      const fechaSeleccionada = e.target.value;
                      if (fechaSeleccionada > hoyLocal) {
                        alert("No puedes seleccionar una fecha posterior al día de hoy.");
                        return;
                      }
                      setRegistroEditar((prev) =>
                        prev ? { ...prev, fecha_evento: fechaSeleccionada } : null
                      );
                    }}
                    style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(["hora_alerta", "hora_llegada", "hora_repliegue"] as const).map((campo) => (
                    <div key={campo} style={{ padding: "10px", border: "1px solid #e2e8f0", borderRadius: "4px", backgroundColor: "#fff" }}>
                      <div style={{ fontSize: "11px", color: MJM_BLUE, marginBottom: "4px", fontWeight: "bold" }}>
                        {campo.replace("_", " ").toUpperCase()}
                      </div>
                      <input
                        type="time"
                        style={{ border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px", width: "100%", boxSizing: "border-box" }}
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

                {horasEdicionInvalidas && (
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

                <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "4px", backgroundColor: "#fff", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: "12px", color: MJM_BLUE, marginBottom: "4px", fontWeight: "bold" }}>
                    DIRECCIÓN
                  </div>
                  <div style={{ position: "relative", width: "100%", marginBottom: "8px" }}>
                    <input
                      type="text"
                      placeholder="Haga clic para seleccionar o escribir..."
                      value={mostrarDesplegable ? filtroTexto : registroEditar.nombre_lugar ?? ""}
                      onFocus={() => {
                        setFiltroTexto("");
                        setMostrarDesplegable(true);
                      }}
                      onChange={(e) => {
                        setFiltroTexto(e.target.value);
                        if (!mostrarDesplegable) setMostrarDesplegable(true);
                      }}
                      onBlur={() => setTimeout(() => setMostrarDesplegable(false), 200)}
                      style={{ width: "100%", padding: "8px 30px 8px 10px", border: "1px solid #cbd5e1", borderRadius: "4px", backgroundColor: "#fff", boxSizing: "border-box", fontSize: "14px", cursor: "pointer" }}
                    />
                    <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748b", fontSize: "12px" }}>
                      ▼
                    </span>

                    {mostrarDesplegable && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: "200px", overflowY: "auto", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0 0 6px 6px", boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)", zIndex: 1000, marginTop: "2px" }}>
                        {ubicacionesFiltradas.length > 0 ? (
                          ubicacionesFiltradas.map((lugar, index) => (
                            <div
                              key={lugar.value || index}
                              onMouseDown={() => {
                                setRegistroEditar((prev) =>
                                  prev ? { ...prev, nombre_lugar: lugar.label, value: lugar.value } : null
                                );
                                setMostrarDesplegable(false);
                              }}
                              style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", fontSize: "13px", color: "#334155" }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
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

                  <div style={{ fontSize: "12px", color: MJM_BLUE, marginBottom: "4px", fontWeight: "bold" }}>
                    REFERENCIA
                  </div>
                  <input
                    style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px", boxSizing: "border-box" }}
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

              {/* COLUMNA 3 */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
                <div style={{ padding: "12px", backgroundColor: "#f1f5f9", fontWeight: "bold", color: MJM_BLUE, fontSize: "12px", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>
                  DATOS IMPORTANTES
                </div>
                <textarea
                  style={{ width: "100%", flex: 1, padding: "12px", border: "none", resize: "none", overflowY: "auto", boxSizing: "border-box" }}
                  maxLength={1500}
                  value={registroEditar.ocurrencia_descripcion ?? ""}
                  onChange={(e) =>
                    setRegistroEditar((prev) =>
                      prev ? { ...prev, ocurrencia_descripcion: e.target.value } : null
                    )
                  }
                />
              </div>

              {/* COLUMNA 4: EVIDENCIAS */}
              <div style={{ width: "280px", minWidth: "260px", display: "flex", flexDirection: "column", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
                <div style={{ padding: "12px", backgroundColor: "#f1f5f9", fontWeight: "bold", color: MJM_BLUE, fontSize: "12px", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>
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
                    {(registroEditar.lista_fotos || []).map((foto: any, index: number) => {
                      const urlFoto = obtenerUrlFoto(foto);
                      return (
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
                            style={{ fontSize: "12px", fontWeight: "600", color: MJM_BLUE, textDecoration: "none", cursor: "pointer" }}
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
                            <img src={urlFoto} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }} alt={`Preview ${index + 1}`} />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setRegistroEditar((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      lista_fotos: (prev.lista_fotos || []).filter((_, i) => i !== index),
                                    }
                                  : null
                              )
                            }
                            style={{ backgroundColor: "rgba(239,68,68,0.9)", color: "#fff", border: "none", borderRadius: "50%", width: "22px", height: "22px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}
                            title="Eliminar foto"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}

                    {(registroEditar.lista_fotos || []).length < 4 && (
                      <button
                        type="button"
                        disabled={subiendoFotoEdicion}
                        onClick={() => document.getElementById("fileInputEvidencias")?.click()}
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
                          cursor: subiendoFotoEdicion ? "wait" : "pointer",
                          fontSize: "12px",
                          fontWeight: "bold",
                          gap: "6px",
                        }}
                      >
                        <span style={{ fontSize: "16px" }}>+</span>
                        {subiendoFotoEdicion
                          ? "Subiendo foto(s)..."
                          : `Agregar Foto (${(registroEditar.lista_fotos || []).length}/4)`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* BOTONES */}
            <div style={{ padding: "16px 20px", display: "flex", gap: "10px", borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                disabled={guardandoEdicion}
                style={{ flex: 1, padding: "10px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "600", color: "#334155" }}
                onClick={() => setRegistroEditar(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={horasEdicionInvalidas || guardandoEdicion || subiendoFotoEdicion}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor:
                    horasEdicionInvalidas || subiendoFotoEdicion ? "#94a3b8" : MJM_BLUE,
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    horasEdicionInvalidas || subiendoFotoEdicion
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: "bold",
                }}
                onClick={() => setModalConfirmacionOpen(true)}
              >
                {guardandoEdicion ? "Guardando..." : "Actualizar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN */}
      {modalConfirmacionOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "16px", width: "380px", textAlign: "center", boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)" }}>
            <h3 style={{ color: MJM_BLUE, marginTop: 0, marginBottom: "12px", fontSize: "18px" }}>
              ¿Confirmar cambios?
            </h3>
            <p style={{ color: "#475569", fontSize: "13px", marginBottom: "20px", lineHeight: "1.4" }}>
              ¿Estás seguro de que deseas actualizar la información de este registro?
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                style={{ flex: 1, padding: "10px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#334155" }}
                onClick={() => setModalConfirmacionOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{ flex: 1, padding: "10px", backgroundColor: MJM_BLUE, color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
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

      {/* OVERLAY DE PROGRESO AL GUARDAR EDICIÓN */}
      {guardandoEdicion && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000 }}>
          <div style={{ backgroundColor: "#fff", padding: 24, borderRadius: 14, width: 300, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: "bold", color: MJM_BLUE, marginBottom: 12 }}>
              {isFinished ? "✓ " : ""}{uploadStatus}
            </div>
            <div style={styles.progressBarBackground}>
              <div style={{ ...styles.progressBarFill, width: `${uploadProgress}%` }} />
            </div>
            <div style={styles.progressPercentage}>{uploadProgress}%</div>
          </div>
        </div>
      )}

      {/* MODALES MONTADOS SOLO CUANDO SE ABREN (CERO PETICIONES EN SEGUNDO PLANO) */}
      {modalInsertOpen === "camara" && (
        <RegistroOcurrencia visible={true} onClose={handleCloseModalInsert} initialData={{ idTipo: "camara" }} />
      )}
      {modalInsertOpen === "telefono" && (
        <RegistroOcurrenciat visible={true} onClose={handleCloseModalInsert} initialData={{ idTipo: "telefono" }} />
      )}
      {modalInsertOpen === "boton" && (
        <RegistroBoton visible={true} onClose={handleCloseModalInsert} initialData={{ idTipo: "boton" }} />
      )}
      {modalInsertOpen === "redes" && (
        <RegistroRedes visible={true} onClose={handleCloseModalInsert} initialData={{ idTipo: "redes" }} />
      )}
      {modalInsertOpen === "operador" && (
        <RegistroOperador visible={true} onClose={handleCloseModalInsert} initialData={{ idTipo: "operador" }} />
      )}
      {modalInsertOpen === "servicioIn" && (
        <RegistroSerIn visible={true} onClose={handleCloseModalInsert} initialData={{ idTipo: "servicioIn" }} />
      )}
      {modalInsertOpen === "servicioFi" && (
        <RegistroSerFi visible={true} onClose={handleCloseModalInsert} initialData={{ idTipo: "servicioFi" }} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties | any> = {
  tableScrollContainer: {
    overflowX: "auto",
    overflowY: "auto",
    minHeight: "515px",
    maxHeight: "70vh",
  },
  progressBarBackground: {
    width: "100%",
    height: 10,
    backgroundColor: "#eee",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#024885" },
  progressPercentage: {
    marginTop: 10,
    fontSize: 12,
    color: "#666",
    fontWeight: "bold",
  },
  container: {
    padding: "24px",
    backgroundColor: "#f9fbfc",
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  grid: {
    display: "flex",
    flexDirection: "row",
    gap: "12px",
    marginBottom: "24px",
    flexShrink: 0,
    width: "100%",
    overflowX: "auto",
  },
  card: {
    flex: 1,
    minWidth: "140px",
    padding: "14px 10px",
    borderRadius: "12px",
    color: "white",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  },
  cardLab: {
    fontSize: "12px",
    fontWeight: "700",
    marginTop: "8px",
    letterSpacing: "0.5px",
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
    fontWeight: "normal",
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
    backgroundColor: "transparent",
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