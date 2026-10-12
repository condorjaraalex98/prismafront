import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "expo-router"; // <-- Importado para redireccionar

// Hook de autenticación global
import { useAuth } from "../../context/userContext";

// Modales de inserción de registros
import RegistroBoton from "./modalboton";
import RegistroRedes from "./modalredes";
import RegistroOcurrenciat from "./modaltele";
import RegistroOcurrencia from "./modalvvcam";
import RegistroOperador from "./modaloper";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
const MJM_BLUE = "#024885";

interface Ocurrencia {
  id_ocurrencia: number | string;
  fecha_reporte: string;
  distancia_metros?: number;
  placa_con_tipo?: string;
  tipo_asignacion?: string;
  camaras_json?: string;
  codigo_seguimiento?: string;
  origen_descripcion?: string;
  fecha_evento: string;
  hora_alerta?: string;
  hora_llegada?: string;
  hora_repliegue?: string;
  ocurrencia_descripcion?: string;
  nombre_lugar?: string;
  turno?: string;
    turnr: String;
   turnrm: String;
  unidad_encargada?: string;
  referencia?: string;
  persona_nombre_completo: string;
  persona_dni: string;
   vehiculos_json :string;
  numero_telefono: number;
  id_usuario: string;
   turno_coincide: string;
  nombre_informante: string;
  modalidad_nombre: string;
  via_nombre?: string;
  camaras: string;
  fotos_json?: string;
  lista_fotos?: string[];
  fotos?: string[];
  cuadra?: string | number;
  tipo_patrullaje_nombre?: string;
  mod_patrullaje_nombre?: string;
  value?: number;
  foto_1: String;
  foto_2: String;
 
  foto_3: String;
  foto_4: String;
  label?: string;
  total_fotos?: number;
  foto_principal?: string;
  pnp_nombre_completo?: string;
  descripcion?: string;
}

interface Lugar {
  id: number | string;
  nombre: string;
  [key: string]: any;
}

export default function ReportesWebScreen() {
  const router = useRouter(); // <-- Instancia del router para redireccionar
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("Actualizando...");
  const [isFinished, setIsFinished] = useState(false);
  const [totalMisRegistros, setTotalMisRegistros] = useState(0);
  const [listaUbicaciones, setListaUbicaciones] = useState<any[]>([]);
const obtenerUrlFoto = (foto: any) => {
  if (!foto) return "";

  let ruta = typeof foto === "string" ? foto : (foto?.url_imagen || foto?.url || foto?.path || "");
  if (!ruta) return "";

  // 1. Limpiamos corchetes, comillas y espacios
  ruta = String(ruta).replace(/[\[\]'"]+/g, "").trim();

  // 2. CORRECCIÓN DE DUPLICACIÓN: Si la URL de R2 aparece repetida en el mismo string, nos quedamos solo con la primera ocurrencia
  const r2Domain = "pub-bce5ad6110584baca6912e8944cd2051.r2.dev";
  const firstIndex = ruta.indexOf(r2Domain);
  if (firstIndex !== -1) {
    const protocolIndex = ruta.lastIndexOf("http", firstIndex);
    const startIndex = protocolIndex !== -1 ? protocolIndex : firstIndex;
    
    const cleanSub = ruta.slice(startIndex);
    const matchExt = cleanSub.match(/^(https?:\/\/[^\s\)]+?\.(jpg|jpeg|png|webp|gif))/i);
    if (matchExt && matchExt[1]) {
      ruta = matchExt[1];
    } else {
      const secondIndex = cleanSub.indexOf(r2Domain, r2Domain.length);
      ruta = secondIndex !== -1 ? cleanSub.slice(0, secondIndex) : cleanSub;
    }
  }

  if (ruta.startsWith("http://") || ruta.startsWith("https://") || ruta.startsWith("data:image")) {
    return ruta;
  }

  const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://prismaocurrecias.onrender.com";
  return `${API_URL}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
};

  const cambiarDePagina = (rutaDestino: string) => {
       router.replace("/cecomdoceh");
  };

  const formatearFechaConDia = (fechaStr: string) => {
    if (!fechaStr) return "S/F";
    const fechaLimpia = String(fechaStr).includes("-")
      ? String(fechaStr).replace(/-/g, "/")
      : fechaStr;
    const fechaObjReal = new Date(fechaLimpia);
    if (isNaN(fechaObjReal.getTime())) return fechaStr;

    const diaSemana = fechaObjReal
      .toLocaleDateString("es-PE", { weekday: "short" })
      .replace(".", "")
      .toLowerCase();
    const fechaNumerica = fechaObjReal.toLocaleDateString("es-PE");
    return `${diaSemana} ${fechaNumerica}`;
  };

  // ESTADOS PRINCIPALES
  const [registroEditar, setRegistroEditar] = useState<Ocurrencia | null>(null);
  const [reportesCompletos, setReportesCompletos] = useState<Ocurrencia[]>([]);
  const [filtro, setFiltro] = useState<"TODOS" | "MIOS">("TODOS");
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);
  const [totalRegistrosBD, setTotalRegistrosBD] = useState(0);
  
  const totalTodos = totalRegistrosBD;

  const [modalInsertOpen, setModalInsertOpen] = useState<string | null>(null);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<Ocurrencia | null>(null);
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [modalConfirmacionOpen, setModalConfirmacionOpen] = useState(false);
  const [mostrarDesplegable, setMostrarDesplegable] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");

  // ESTADOS PARA EL FILTRO POR RANGO DE FECHAS
  const [fechaInicioInput, setFechaInicioInput] = useState("");
  const [fechaFinInput, setFechaFinInput] = useState("");
  const [fechasFiltro, setFechasFiltro] = useState<{ inicio: string; fin: string } | null>(null);

  const fetchLugares = async (tipoLugarId: string) => {
    try {
      const queryTipo = tipoLugarId && tipoLugarId !== "default" ? tipoLugarId : "4";
      const response = await fetch(`${API_URL}/catalogos/lugares?tipo=${queryTipo}`);
      
      if (!response.ok) throw new Error("Error al obtener lugares");
      
      const data = await response.json();
      const lista = Array.isArray(data) ? data : data.data || [];

      const opcionesUbicaciones = lista.map((item: any) => ({
        value: item.id || item.id_lugar || item.value,
        label: item.nombre || item.descripcion || item.direccion || item.label || `Lugar #${item.id}`,
      }));

      setListaUbicaciones(opcionesUbicaciones);
    } catch (error) {
      console.error("Error al cargar lugares:", error);
    }
  };

  useEffect(() => {
    fetchLugares("4");
  }, []);

  const fetchTotalMisRegistros = useCallback(() => {
    if (userData?.id) {
      fetch(`${API_URL}/ocurrencias/listar/tablasipcop-rango12hrol?limit=1&id_usuario=${userData.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json && json.success) {
            setTotalMisRegistros(json.total || 0);
          }
        })
        .catch((err) => console.error("Error al obtener total personal:", err));
    }
  }, [userData]);

  useEffect(() => {
    fetchTotalMisRegistros();
  }, [fetchTotalMisRegistros]);

  const handleGuardarCambios = async () => {
    if (!registroEditar) return;

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus("Actualizando...");
    setIsFinished(false);

    const interval = setInterval(
      () => setUploadProgress((p) => (p < 90 ? p + 10 : p)),
      100,
    );

    try {
      const response = await fetch(
        `${API_URL}/ocurrencias/editar/${registroEditar.id_ocurrencia}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registroEditar),
        },
      );

      const data = await response.json();
      clearInterval(interval);

      if (data.success) {
        setUploadProgress(100);
        setUploadStatus("¡Correcto!");
        setIsFinished(true);

        setTimeout(() => {
          setLoading(false);
          setRegistroEditar(null);
          setFiltro("TODOS");
          setPaginaActual(1);
          fetchOcurrencias(1, registrosPorPagina);
          fetchTotalMisRegistros(); 
        }, 600);
      } else {
        clearInterval(interval);
        setLoading(false);
        alert("Error del servidor: " + (data.error || "No se pudo actualizar"));
      }
    } catch (error) {
      clearInterval(interval);
      setLoading(false);
      console.error("Error de conexión:", error);
      alert("No se pudo conectar con el servidor. Verifica la IP.");
    }
  };

  const hoyStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const textoPeriodo = useMemo(() => {
    if (!fechasFiltro?.inicio || !fechasFiltro?.fin) {
      return "Últimas 12 horas";
    }
    
    const fechaInicioLimpia = fechasFiltro.inicio.split(" ")[0];
    const fechaFinLimpia = fechasFiltro.fin.split(" ")[0];

    if (fechaInicioLimpia === fechaFinLimpia) {
      return `Fecha: ${fechaInicioLimpia}`;
    }

    return `Periodo seleccionado`;
  }, [fechasFiltro]);

  const fetchOcurrencias = useCallback(
    async (page: number = paginaActual, limit: number = registrosPorPagina) => {
      setLoading(true);

      try {
        let url = `${API_URL}/ocurrencias/listar/tablasipcop-rango12hrol?page=${page}&limit=${limit}`;

        if (filtro === "MIOS" && userData?.id) {
          url += `&id_usuario=${encodeURIComponent(userData.id)}`;
        }

        // Añadimos las fechas si el filtro por rango está activo
        if (fechasFiltro?.inicio && fechasFiltro?.fin) {
          url += `&fecha_inicio=${encodeURIComponent(fechasFiltro.inicio)}&fecha_fin=${encodeURIComponent(fechasFiltro.fin)}`;
        }

        const response = await fetch(url);
        const json = await response.json();

        if (json && json.success && Array.isArray(json.data)) {
          setReportesCompletos(json.data);
          setTotalRegistrosBD(json.total || 0);
        } else {
          setReportesCompletos([]);
          setTotalRegistrosBD(0);
        }
      } catch (error) {
        console.error("Error al obtener datos operativos:", error);
        setReportesCompletos([]);
        setTotalRegistrosBD(0);
      } finally {
        setLoading(false);
      }
    },
    [paginaActual, registrosPorPagina, filtro, userData, fechasFiltro]
  );

  useEffect(() => {
    fetchOcurrencias(paginaActual, registrosPorPagina);
  }, [paginaActual, registrosPorPagina, filtro, fechasFiltro, fetchOcurrencias]);

  const handleBuscarPorFechas = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const hoyFecha = new Date().toISOString().split("T")[0];

    if (!fechaInicioInput || !fechaFinInput) {
      alert("Por favor selecciona ambas fechas.");
      return;
    }

    if (fechaInicioInput > hoyFecha || fechaFinInput > hoyFecha) {
      alert("No puedes seleccionar fechas futuras.");
      return;
    }

    if (fechaInicioInput > fechaFinInput) {
      alert("La fecha inicial no puede ser mayor que la fecha final.");
      return;
    }

    setFechasFiltro({
      inicio: `${fechaInicioInput} 00:00:00`,
      fin: `${fechaFinInput} 23:59:59`,
    });

    setPaginaActual(1);
    fetchOcurrencias(1, registrosPorPagina);
  };

  useEffect(() => {
    const estiloHover = document.createElement("style");
    estiloHover.innerText = `
      .fila-tabla-operativa:hover {
        background-color: #f1f5f9 !important;
        transition: background-color 0.15s ease-in-out;
      }
    `;
    document.head.appendChild(estiloHover);
    return () => {
      document.head.removeChild(estiloHover);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetalleSeleccionado(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const extraerFechaYHoraLimpia = (fechaIsoStr: string) => {
    if (!fechaIsoStr) return { dia: "S/D", fecha: "S/F", hora: "S/H" };
    const formateada = new Date(fechaIsoStr);
    if (isNaN(formateada.getTime()))
      return { dia: "S/D", fecha: fechaIsoStr, hora: "S/H" };

    const dia = formateada
      .toLocaleDateString("es-PE", { weekday: "short" })
      .replace(".", "")
      .toLowerCase();
    const fecha = formateada.toLocaleDateString("es-PE");
    const hora = formateada.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return { dia, fecha, hora };
  };

  const reportesFiltrados = useMemo(() => {
    return Array.isArray(reportesCompletos) ? reportesCompletos : [];
  }, [reportesCompletos]);

  const totalPaginas = useMemo(() => {
    const paginas = Math.ceil(totalRegistrosBD / registrosPorPagina);
    return paginas > 0 ? paginas : 1;
  }, [totalRegistrosBD, registrosPorPagina]);

  return (
    <div style={styles.container}>
      {/* Cabecera Principal */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <h2
            style={{
              color: MJM_BLUE,
              margin: 0,
              fontWeight: 700,
              fontSize: "22px",
            }}
          >
            {textoPeriodo}: {totalRegistrosBD} registro(s) en total
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={styles.tabs}>
            <button
              onClick={() => fetchOcurrencias(paginaActual, registrosPorPagina)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
              title="Actualizar tabla"
            >
              <Ionicons name="reload" size={17} color="#024885" />
            </button>
            <button
              onClick={() => {
                setFiltro("TODOS");
                setPaginaActual(1);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: filtro === "TODOS" ? MJM_BLUE : "#e2e8f0",
                color: filtro === "TODOS" ? "#ffffff" : "#475569",
              }}
            >
              TODOS
            </button>
          </div>
        </div>
      </div>

      {/* SELECTOR DE FECHAS */}
      <form
        onSubmit={handleBuscarPorFechas}
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "16px",
          backgroundColor: "#ffffff",
          padding: "14px",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>DESDE:</label>
          <input
            type="date"
            max={hoyStr}
            value={fechaInicioInput}
            onChange={(e) => setFechaInicioInput(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>HASTA:</label>
          <input
            type="date"
            max={hoyStr}
            value={fechaFinInput}
            onChange={(e) => setFechaFinInput(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: "7px 16px",
            backgroundColor: MJM_BLUE,
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Filtrar Periodo
        </button>

        {fechasFiltro && (
          <button
            type="button"
            onClick={() => {
              setFechaInicioInput("");
              setFechaFinInput("");
              setFechasFiltro(null);
              setPaginaActual(1);
            }}
            style={{
              padding: "7px 14px",
              backgroundColor: "#e2e8f0",
              color: "#334155",
              border: "none",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
        (Dejar en últimas 12h)
          </button>
        )}
      </form>

      {/* Caja de Datos y Estructura Automatizada de la Tabla */}
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
                <th style={{ ...styles.th, width: "5%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TURNO</th>
                <th style={{ ...styles.th, width: "5%", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>T.A. GENERAL</th>
                <th style={{ ...styles.th, width: "5%", textAlign: "center", borderRight: "none" }}>VALIDACIÓN</th>
                <th style={{ ...styles.th, width: "5%", textAlign: "center" }}>EDITAR</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: "40px", color: "#024885", backgroundColor: "#f8fafc" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontWeight: "600", fontSize: "15px" }}>
                      <span>Cargando registros del periodo... Por favor espere.</span>
                    </div>
                  </td>
                </tr>
              ) : reportesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    No se encontraron registros.
                  </td>
                </tr>
              ) : (
                reportesFiltrados.map((item) => (
                  <tr
                    key={item.id_ocurrencia}
                    className="fila-tabla-operativa"
                    style={styles.tr}
                    onClick={() => setDetalleSeleccionado(item)}
                  >
                    <td style={{ ...styles.td, textAlign: "center", verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                      <div style={{ ...styles.txtB }} title={String(item.id_ocurrencia)}>
                        #{item.id_ocurrencia}
                      </div>
                    </td>

                    <td style={{ ...styles.td, verticalAlign: "top", borderRight: "1px solid #e2e8f0" }}>
                      <div style={styles.celdaTruncadaContainer}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {item.fecha_reporte
                            ? (() => {
                                const fechaObj = new Date(item.fecha_reporte);
                                const diaSemana = fechaObj.toLocaleDateString("es-PE", { weekday: "short" }).replace(".", "").toLowerCase();
                                const fechaNumerica = fechaObj.toLocaleDateString("es-PE");
                                const hora = fechaObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
                                return `${diaSemana} ${fechaNumerica} - ${hora}`;
                              })()
                            : item.fecha_evento || "S/F"}
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
                        <div style={{ ...styles.txtS, color: "#024885", fontWeight: "600", whiteSpace: "normal", wordBreak: "break-word", fontSize: "13px" }} title={item.origen_descripcion}>
                          {item.origen_descripcion}
                        </div>
                        <div style={{ ...styles.txtS, color: "#024885", fontWeight: "500", whiteSpace: "normal", wordBreak: "break-word" }} title={item.placa_con_tipo}>
                          {item.vehiculos_json}
                        </div>
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
                              if (mod.includes("TÁCTICO")) return "#024885";
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

                    <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", overflow: "hidden", textAlign: "center", backgroundColor: "#e8f5fd", borderLeft: "3px solid #024885" }}>
                      <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word", fontWeight: "bold" }}>
                        {formatearFechaConDia(item.fecha_evento)}
                      </div>
                    </td>

                    <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", overflow: "hidden", textAlign: "center", backgroundColor: "#e8f5fd", borderLeft: "3px solid #024885" }}>
                      <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word", fontWeight: "bold" }}>
                        {item.hora_llegada ? String(item.hora_llegada).slice(0, 5) : "S/H"}
                      </div>
                    </td>

                    <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", overflow: "hidden", backgroundColor: "#e8f5fd", borderLeft: "3px solid #024885" }}>
                      <div style={styles.celdaTruncadaContainer}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {item.turno || "---"}
                        </div>
                      </div>
                    </td>

                    <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", overflow: "hidden", backgroundColor: "#e8f5fd", borderLeft: "3px solid #024885" }}>
                      <div style={styles.celdaTruncadaContainer}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {item.turnr || item.turnrm || "---"}
                        </div>
                      </div>
                    </td>

                    <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", overflow: "hidden", backgroundColor: item.turno_coincide === "Sí" ? "#e6f4ea" : "#fce8e6", borderLeft: "3px solid #024885" }}>
                      <div style={styles.celdaTruncadaContainer}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word", fontWeight: "bold" }}>
                          {item.turno_coincide}
                        </div>
                      </div>
                    </td>

                    <td style={{ ...styles.td, textAlign: "center", verticalAlign: "top" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRegistroEditar(item);
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
                        }}
                        title="Editar registro"
                      >
                        <Ionicons name="pencil" size={15} color="#024885" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CONTENEDOR DE PAGINACIÓN */}
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
              style={{ padding: 6, borderRadius: 6, backgroundColor: '#fff' }}
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
              <Ionicons name="chevron-back" size={15} color={paginaActual === 1 ? "#cbd5e1" : "#334155"} />
            </button>

            <div style={styles.pageInfoWrapper}>
              Página {paginaActual} de {totalPaginas}
            </div>

            <button
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
              style={styles.btnPageNew}
            >
              <Ionicons name="chevron-forward" size={15} color={paginaActual >= totalPaginas ? "#cbd5e1" : "#334155"} />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DETALLE DE REGISTRO ACTIVO */}
      {detalleSeleccionado && (
        <div style={styles.overlay} onClick={() => setDetalleSeleccionado(null)}>
          <div style={styles.modalDetail} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, color: "#024885", fontWeight: 700 }}>
                N° de Ocurrencia: {detalleSeleccionado.codigo_seguimiento ? `${detalleSeleccionado.codigo_seguimiento}-SGS-GSC` : "---"}
              </h3>
              <button onClick={() => setDetalleSeleccionado(null)} style={styles.btnClose}>✕</button>
            </div>

            <div style={styles.modalBodyScrollable}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ gridColumn: "span 2", marginTop: "4px", padding: "12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <strong style={{ color: "#024885", fontSize: "13px", display: "block", marginBottom: "10px" }}>
                    <span style={{ ...styles.infoValue, fontWeight: "700", color: "#024885", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", display: "inline-block", verticalAlign: "bottom" }} title={detalleSeleccionado.modalidad_nombre || "---"}>
                      {detalleSeleccionado.modalidad_nombre || "---"}
                    </span>
                  </strong>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Datos Personales:</span>
                    <span style={styles.infoValue}>{detalleSeleccionado.persona_nombre_completo || "---"}</span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Origen:</span>
                    <span style={styles.infoValue}>{detalleSeleccionado.origen_descripcion || "---"} ({detalleSeleccionado.tipo_patrullaje_nombre || "---"})</span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Unidad Vehicular:</span>
                    <span style={styles.infoValue}>{detalleSeleccionado.vehiculos_json || "---"}</span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Personal PNP:</span>
                    <span style={styles.infoValue}>{detalleSeleccionado.pnp_nombre_completo || "---"}</span>
                  </div>
                </div>
              </div>
            </div>
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
    marginBottom: "15px",
    flexWrap: "wrap",
    gap: "15px",
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
  tableScrollContainer: {
    overflowX: "auto",
    overflowY: "auto",
    minHeight: "515px",
    maxHeight: "70vh",
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
  badge: {
    padding: "3px 8px",
    borderRadius: "12px",
    color: "white",
    fontSize: "10px",
    fontWeight: "700",
    display: "inline-block",
    marginTop: "4px",
  },
  tableFooterPagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    borderTop: "1px solid #e2e8f0",
    backgroundColor: "#ffffff",
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
  },
  modalBodyScrollable: {
    flex: 1,
    overflowY: "auto",
    marginTop: "14px",
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
  },
};