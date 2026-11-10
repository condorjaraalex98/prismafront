import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "expo-router";

// Hook de autenticación global
import { useAuth } from "../../context/userContext";

// Modales de inserción de registros
import RegistroBoton from "./modalboton";
import RegistroRedes from "./modalredes";
import RegistroOcurrenciat from "./modaltele";
import RegistroOcurrencia from "./modalvvcam";
import RegistroOperador from "./modaloper";
import RegistroSerIn from "./modaliniciocecom";
import RegistroSerFi from "./modalfincecom";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";
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
  unidad_encargada?: string;
  referencia?: string;
  persona_nombre_completo: string;
  persona_dni: string;
  vehiculos_json: string;
  numero_telefono: number;
  id_usuario: string;
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
  // Campos para edición de odómetro
  id_detalle?: number | string;
  odometro_inicial?: number | string;
  odometro_final?: number | string;
}

interface Lugar {
  id: number | string;
  nombre: string;
  [key: string]: any;
}

export default function ReportesWebScreen() {
  const router = useRouter();
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("Actualizando...");
  const [isFinished, setIsFinished] = useState(false);
  const [totalMisRegistros, setTotalMisRegistros] = useState(0);
  const [totalSinRestriccionBD, setTotalSinRestriccionBD] = useState(0);
  const [listaUbicaciones, setListaUbicaciones] = useState<any[]>([]);

  const obtenerUrlFoto = (foto: any) => {
    if (!foto) return "";
    let ruta = typeof foto === "string" ? foto : (foto?.url_imagen || foto?.url || foto?.path || "");
    if (!ruta) return "";

    ruta = String(ruta).replace(/[\[\]'"]+/g, "").trim();
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

    const API_URL_BASE = process.env.EXPO_PUBLIC_API_URL || "https://prismaocurrecias.onrender.com";
    return `${API_URL_BASE}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
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

  const [registroEditar, setRegistroEditar] = useState<Ocurrencia | null>(null);
  const [reportesCompletos, setReportesCompletos] = useState<Ocurrencia[]>([]);
  const [filtroPropietario, setFiltroPropietario] = useState<"TODOS" | "MIOS">("TODOS");
  const [reporteServicioActivo, setReporteServicioActivo] = useState(false);

  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);
  const [totalRegistrosBD, setTotalRegistrosBD] = useState(0);

  const [modalInsertOpen, setModalInsertOpen] = useState<string | null>(null);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<Ocurrencia | null>(null);
  const [modalConfirmacionOpen, setModalConfirmacionOpen] = useState(false);
  const [mostrarDesplegable, setMostrarDesplegable] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [fechasFiltro] = useState<{ inicio: string; fin: string } | null>(null);

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

  const fetchTotalSinRestriccion = useCallback(() => {
    fetch(`${API_URL}/ocurrencias/listar/tablasipcop-rango12h?limit=1`)
      .then((res) => res.json())
      .then((json) => {
        if (json && json.success) {
          setTotalSinRestriccionBD(json.total || 0);
        }
      })
      .catch((err) => console.error("Error al obtener total sin restricciones:", err));
  }, []);

  useEffect(() => {
    fetchTotalMisRegistros();
    fetchTotalSinRestriccion();
  }, [fetchTotalMisRegistros, fetchTotalSinRestriccion]);

  // FUNCIÓN DE GUARDADO PRINCIPAL (Actualiza ocurrencia y odómetro si aplica)
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
      // 1. Actualización general de la ocurrencia
      const response = await fetch(
        `${API_URL}/ocurrencias/editar/${registroEditar.id_ocurrencia}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registroEditar),
        },
      );

      const data = await response.json();

      // 2. Si el registro tiene id_detalle y modificaron el odómetro, llamamos al endpoint específico
      if (registroEditar.id_detalle) {
        if (registroEditar.odometro_inicial !== undefined && registroEditar.odometro_inicial !== null) {
          await fetch(`${API_URL}/api/vehiculo/actualizar-odometro`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id_detalle: registroEditar.id_detalle,
              nuevo_odometro: registroEditar.odometro_inicial,
              tipo_registro: 'INICIO'
            })
          });
        } else if (registroEditar.odometro_final !== undefined && registroEditar.odometro_final !== null) {
          await fetch(`${API_URL}/api/vehiculo/actualizar-odometro`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id_detalle: registroEditar.id_detalle,
              nuevo_odometro: registroEditar.odometro_final,
              tipo_registro: 'FIN'
            })
          });
        }
      }

      clearInterval(interval);

      if (data.success) {
        setUploadProgress(100);
        setUploadStatus("¡Correcto!");
        setIsFinished(true);

        setTimeout(() => {
          setLoading(false);
          setRegistroEditar(null);
          setFiltroPropietario("TODOS");
          setPaginaActual(1);
          fetchOcurrencias(1, registrosPorPagina);
          fetchTotalMisRegistros(); 
          fetchTotalSinRestriccion();
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
        let url = `${API_URL}/ocurrencias/listar/tablasipcop-rango12h?page=${page}&limit=${limit}`;

        if (filtroPropietario === "MIOS" && userData?.id) {
          url += `&id_usuario=${encodeURIComponent(userData.id)}`;
        } else {
          if (reporteServicioActivo) {
            url += `&filtro_modalidad=SOLO_139_140`;
          } else {
            url += `&filtro_modalidad=EXCLUIR_139_140`;
          }
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
    [paginaActual, registrosPorPagina, filtroPropietario, reporteServicioActivo, userData]
  );

  useEffect(() => {
    fetchOcurrencias(paginaActual, registrosPorPagina);
  }, [paginaActual, registrosPorPagina, filtroPropietario, reporteServicioActivo, fechasFiltro, fetchOcurrencias]);

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

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroPropietario, reporteServicioActivo]);

  const reportesFiltrados = useMemo(() => {
    return Array.isArray(reportesCompletos) ? reportesCompletos : [];
  }, [reportesCompletos]);

  const totalPaginas = useMemo(() => {
    const paginas = Math.ceil(totalRegistrosBD / registrosPorPagina);
    return paginas > 0 ? paginas : 1;
  }, [totalRegistrosBD, registrosPorPagina]);

  return (
    <div style={styles.container}>
      {/* Accesos Rápidos */}
      <div style={styles.grid}>
        <button onClick={() => setModalInsertOpen("camara")} style={{ ...styles.card, backgroundColor: MJM_BLUE }}>
          <Ionicons name="videocam" size={26} color="white" />
          <div style={styles.cardLab}>CÁMARA</div>
        </button>
        <button onClick={() => setModalInsertOpen("telefono")} style={{ ...styles.card, backgroundColor: MJM_BLUE }}>
          <Ionicons name="call" size={26} color="white" />
          <div style={styles.cardLab}>TELÉFONO</div>
        </button>
        <button onClick={() => setModalInsertOpen("boton")} style={{ ...styles.card, backgroundColor: MJM_BLUE }}>
          <Ionicons name="alert-circle" size={26} color="white" />
          <div style={styles.cardLab}>BOTÓN DE PÁNICO</div>
        </button>
        <button onClick={() => setModalInsertOpen("redes")} style={{ ...styles.card, backgroundColor: MJM_BLUE }}>
          <Ionicons name="share-social" size={26} color="white" />
          <div style={styles.cardLab}>REDES SOCIALES</div>
        </button>
        <button onClick={() => setModalInsertOpen("operador")} style={{ ...styles.card, backgroundColor: MJM_BLUE }}>
          <Ionicons name="megaphone" size={26} color="white" />
          <div style={styles.cardLab}>RADIOPERADOR</div>
        </button>

        <div style={{ ...styles.card, backgroundColor: MJM_BLUE, display: "flex", flexDirection: "row", padding: 0, overflow: "hidden" }}>
          <button
            onClick={() => setModalInsertOpen("servicioIn")}
            style={{ flex: 1, backgroundColor: "transparent", border: "none", color: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "15px 10px", cursor: "pointer", borderRight: "1px solid rgba(255, 255, 255, 0.2)" }}
          >
            <Ionicons name="play-circle" size={24} color="white" />
            <div style={{ ...styles.cardLab, marginTop: 5 }}>INICIO SERVICIO</div>
          </button>
          <button
            onClick={() => setModalInsertOpen("servicioFi")}
            style={{ flex: 1, backgroundColor: "transparent", border: "none", color: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "15px 10px", cursor: "pointer" }}
          >
            <div style={{ ...styles.cardLab, marginTop: 5 }}>FIN SERVICIO</div>
          </button>
        </div>
      </div>

      {/* Cabecera Principal */}
      <div style={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h2 style={{ color: MJM_BLUE, margin: 0, fontWeight: 700, fontSize: "22px" }}>
            {textoPeriodo}: {totalSinRestriccionBD} registro(s) en total
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
                  backgroundColor: reporteServicioActivo ? "#024885" : "#e2e8f0",
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

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={styles.tabs}>
            <button
              onClick={() => {
                fetchOcurrencias(paginaActual, registrosPorPagina);
                fetchTotalSinRestriccion();
              }}
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Actualizar tabla"
            >
              <Ionicons name="reload" size={17} color="#024885" />
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
                backgroundColor: filtroPropietario === "TODOS" ? MJM_BLUE : "#e2e8f0",
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
                backgroundColor: filtroPropietario === "MIOS" ? MJM_BLUE : "#e2e8f0",
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
          <table style={{ ...styles.table, tableLayout: "fixed", width: "100%", borderCollapse: "collapse" }}>
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
                <th style={{ ...styles.th, width: "3%", textAlign: "center", borderRight: filtroPropietario === "MIOS" ? "1px solid #cbd5e1" : "none" }}>FOTOS</th>
                {filtroPropietario === "MIOS" && (
                  <th style={{ ...styles.th, width: "5%", textAlign: "center" }}>EDITAR</th>
                )}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={filtroPropietario === "MIOS" ? 10 : 9} style={{ textAlign: "center", padding: "40px", color: "#024885", backgroundColor: "#f8fafc" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontWeight: "600", fontSize: "15px" }}>
                      <span>Cargando registros del periodo... Por favor espere.</span>
                    </div>
                  </td>
                </tr>
              ) : reportesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={filtroPropietario === "MIOS" ? 10 : 9} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
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

                    <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", textAlign: "center", backgroundColor: "#e8f5fd", borderLeft: "3px solid #024885" }}>
                      <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word", fontWeight: "bold" }}>
                        {formatearFechaConDia(item.fecha_evento)}
                      </div>
                    </td>

                    <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", textAlign: "center", backgroundColor: "#e8f5fd", borderLeft: "3px solid #024885" }}>
                      <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word", fontWeight: "bold" }}>
                        {item.hora_llegada ? String(item.hora_llegada).slice(0, 5) : "S/H"}
                      </div>
                    </td>

                    <td style={{ ...styles.td, borderRight: "1px solid #e2e8f0", backgroundColor: "#e8f5fd", borderLeft: "3px solid #024885" }}>
                      <div style={styles.celdaTruncadaContainer}>
                        <div style={{ ...styles.txtB, whiteSpace: "normal", wordBreak: "break-word" }} title={item.label || item.via_nombre || "---"}>
                          {item.nombre_lugar || "---"}
                        </div>
                        <div style={{ ...styles.txtS, whiteSpace: "normal", wordBreak: "break-word" }} title={item.referencia || "Sin referencia"}>
                          Ref: {item.referencia || "Sin referencia"}
                        </div>
                      </div>
                    </td>

                    <td style={{ ...styles.td, textAlign: "center", borderLeft: "3px solid #024885", verticalAlign: "top", borderRight: filtroPropietario === "MIOS" ? "1px solid #e2e8f0" : "none" }}>
                      {(() => {
                        let total = 0;
                        if (item.fotos_json) {
                          try {
                            const parsed = typeof item.fotos_json === "string" ? JSON.parse(item.fotos_json) : item.fotos_json;
                            if (Array.isArray(parsed)) {
                              total = parsed.filter((f) => f && f !== "null").length;
                            }
                          } catch (e) { total = 0; }
                        } else {
                          total = Number(item.total_fotos || 0);
                        }

                        return total > 0 ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#e0f2fe", color: "#0369a1", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>
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
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                          }}
                          title="Editar registro"
                        >
                          <Ionicons name="pencil" size={15} color="#024885" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CONTENEDOR DE PAGINACIÓN */}
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
                <div style={{ gridColumn: "span 2", padding: "12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <strong style={{ color: "#024885", fontSize: "13px", display: "block", marginBottom: "10px" }}>
                    <span style={{ fontWeight: "700", color: "#024885" }}>{detalleSeleccionado.modalidad_nombre || "---"}</span>
                  </strong>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Datos Personales:</span>
                    <span style={styles.infoValue}>{detalleSeleccionado.persona_nombre_completo || "---"}</span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Origen:</span>
                    <span style={styles.infoValue}>{detalleSeleccionado.origen_descripcion || "---"}</span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Unidad Vehicular:</span>
                    <span style={styles.infoValue}>{detalleSeleccionado.vehiculos_json || "---"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    {/* MODAL DE EDICIÓN CON CAMPOS DE ODÓMETRO */}
      {registroEditar && (
        <div style={styles.overlay} onClick={() => setRegistroEditar(null)}>
          <div
            style={{
              ...styles.modalDetail,
              maxWidth: "1300px",
              width: "95%",
              height: "70vh",
              display: "flex",
              flexDirection: "column",
              marginLeft: "300px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", gap: "15px", flex: 1, overflow: "hidden", padding: "20px" }}>
              <div style={{ flex: 1, minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "12px", color: "#024885", fontWeight: "700" }}>
                    {registroEditar.modalidad_nombre ?? ""}
                  </div>
                </div>

                {/* SI EL REGISTRO TIENE ODÓMETRO INICIAL, SE MUESTRA Y EDITA */}
                {registroEditar.odometro_inicial !== undefined && registroEditar.odometro_inicial !== null && (
                  <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "4px", backgroundColor: "#fff" }}>
                    <div style={{ fontSize: "12px", color: "#024885", marginBottom: "4px", fontWeight: "bold" }}>
                      MODIFICAR ODÓMETRO INICIAL
                    </div>
                    <input
                      type="number"
                      value={registroEditar.odometro_inicial ?? ""}
                      onChange={(e) => setRegistroEditar({ ...registroEditar, odometro_inicial: e.target.value })}
                      style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                    />
                  </div>
                )}

                {/* SI EL REGISTRO TIENE ODÓMETRO FINAL, SE MUESTRA Y EDITA */}
                {registroEditar.odometro_final !== undefined && registroEditar.odometro_final !== null && (
                  <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "4px", backgroundColor: "#fff" }}>
                    <div style={{ fontSize: "12px", color: "#024885", marginBottom: "4px", fontWeight: "bold" }}>
                      MODIFICAR ODÓMETRO FINAL
                    </div>
                    <input
                      type="number"
                      value={registroEditar.odometro_final ?? ""}
                      onChange={(e) => setRegistroEditar({ ...registroEditar, odometro_final: e.target.value })}
                      style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: "20px", display: "flex", gap: "10px", borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                style={{ flex: 1, padding: "10px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "600", color: "#334155" }}
                onClick={() => setRegistroEditar(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{ flex: 1, padding: "10px", backgroundColor: "#024885", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                onClick={() => setModalConfirmacionOpen(true)}
              >
                Actualizar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN */}
      {modalConfirmacionOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "16px", width: "380px", textAlign: "center", boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)" }}>
            <h3 style={{ color: "#024885", marginTop: 0, marginBottom: "12px", fontSize: "18px" }}>
              ¿Confirmar cambios?
            </h3>
            <p style={{ color: "#475569", fontSize: "13px", marginBottom: "20px", lineHeight: "1.4" }}>
              ¿Estás seguro de que deseas actualizar la información y recálculos de odómetro de este registro?
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
                style={{ flex: 1, padding: "10px", backgroundColor: "#024885", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
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

      {/* Modales de Inserción */}
      <RegistroOcurrencia visible={modalInsertOpen === "camara"} onClose={() => { setModalInsertOpen(null); fetchOcurrencias(1, registrosPorPagina); }} initialData={{ idTipo: "camara" }} />
      <RegistroOcurrenciat visible={modalInsertOpen === "telefono"} onClose={() => { setModalInsertOpen(null); fetchOcurrencias(1, registrosPorPagina); }} initialData={{ idTipo: "telefono" }} />
      <RegistroBoton visible={modalInsertOpen === "boton"} onClose={() => { setModalInsertOpen(null); fetchOcurrencias(1, registrosPorPagina); }} initialData={{ idTipo: "boton" }} />
      <RegistroRedes visible={modalInsertOpen === "redes"} onClose={() => { setModalInsertOpen(null); fetchOcurrencias(1, registrosPorPagina); }} initialData={{ idTipo: "redes" }} />
      <RegistroOperador visible={modalInsertOpen === "operador"} onClose={() => { setModalInsertOpen(null); fetchOcurrencias(1, registrosPorPagina); }} initialData={{ idTipo: "operador" }} />
      <RegistroSerIn visible={modalInsertOpen === "servicioIn"} onClose={() => { setModalInsertOpen(null); fetchOcurrencias(1, registrosPorPagina); }} initialData={{ idTipo: "servicioIn" }} />
      <RegistroSerFi visible={modalInsertOpen === "servicioFi"} onClose={() => { setModalInsertOpen(null); fetchOcurrencias(1, registrosPorPagina); }} initialData={{ idTipo: "servicioFi" }} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties | any> = {
  container: {
    padding: "24px",
    backgroundColor: "#f9fbfc",
    minHeight: "350vh",
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