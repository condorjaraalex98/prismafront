import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";



// Hook de autenticación global
import { useAuth } from "../../context/userContext";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "${API_URL}";
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
interface Ocurrencia {
  id_ocurrencia: number | string;
  fecha_reporte: string;
  id_modalidad?: number | string; // <-- Agrega esta línea
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
  cuadra?: string | number;
  tipo_patrullaje_nombre?: string;
  mod_patrullaje_nombre?: string;
  value?: number;
  label?: string;
  total_fotos?: number;
  foto_principal?: string;
  pnp_nombre_completo?: string;
  descripcion?: string;
  id_medio?: number | string; // <-- Agrega esto
  id_lugar?: number | string; // <-- Agrega esto
  id_consecuencia?: number | string; // <-- Agrega esto
  id_resultado?: number | string; // <-- Agrega esto
  id_relacion_v?: number | string; // <-- Agrega esto

  medios?: any; // <-- Agrega esto

  consecuencia_nombre?: string; // <-- Agrega esto
  resultado_nombre?: string; // <-- Agrega esto
  relacion_nombre?: string;
}

export default function ReportesWebScreen() {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("Actualizando...");
  const [isFinished, setIsFinished] = useState(false);
  const [registroEditar, setRegistroEditar] = useState<Ocurrencia | null>(null);
  const [modalInsertOpen, setModalInsertOpen] = useState<string | null>(null);
  const [detallesSeleccionado, setDetallesSeleccionado] =
    useState<Ocurrencia | null>(null);
  const [modalConfirmacionOpen, setModalConfirmacionOpen] = useState(false);
  const [listaUbicaciones, setListaUbicaciones] = useState<any[]>([]);
  // 2. DECLARA LOS ESTADOS DE LAS 5 LISTAS (Faltaban en tu componente)
  const [listaMedios, setListaMedios] = useState<CatalogoItem[]>([]);
  const [listaUbisipcop, setListaUbisipcop] = useState<CatalogoItem[]>([]);
  const [listaConsecuencias, setListaConsecuencias] = useState<CatalogoItem[]>(
    [],
  );

  const [pestanaActiva, setPestanaActiva] = React.useState<
    "tiempos" | "sipcop" | "evidencias"
  >("tiempos");
  // Función para abrir el modal de edición y cargar los catálogos del registro
  const abrirModalEditar = (registro: Ocurrencia) => {
    setRegistroEditar(registro);
    // Convierte el ID a string para que coincida con el tipo que espera la función
    fetchCamposIpcop(String(registro.id_ocurrencia));
  };
  const [listaResultados, setListaResultados] = useState<CatalogoItem[]>([]);
  const [listaRelaciones, setListaRelaciones] = useState<CatalogoItem[]>([]);

  // 3. DECLARA LOS ESTADOS DE LOS VALORES SELECCIONADOS (Para cuando edites)
  const [medioSeleccionado, setMedioSeleccionado] = useState<any>(null);
  const [lugarSeleccionado, setLugarSeleccionado] = useState<any>(null);
  const [consecuenciaSeleccionada, setConecuenciaSeleccionada] =
    useState<any>(null);
  const [resultadoSeleccionado, setResultadoSeleccionado] = useState<any>(null);
  const [relacionSeleccionada, setRelacionSeleccionada] = useState<any>(null);

  const fetchLugares = async (id: string) => {
    try {
      const response = await fetch(
        `${API_URL}/catalogos/modalidad`,
      );
      const data = await response.json();
      setListaUbisipcop(data);
    } catch (error) {
      console.error("Error al cargar lugares:", error);
    }
  };
  const fetchCamposIpcop = async (idOcurrencia?: string) => {
    try {
      const url = idOcurrencia
        ? `${API_URL}/catalogos/camposipcop?id=${idOcurrencia}`
        : `${API_URL}/catalogos/camposipcop`;

      const response = await fetch(url);
      const data: CamposIpcopResponse = await response.json();

      // 1. Llenas las 5 listas desplegables
      setListaMedios(data.medios || []);
      setListaUbisipcop(data.lugares || []);
      setListaConsecuencias(data.consecuencias || []);
      setListaResultados(data.resultados || []);
      setListaRelaciones(data.relaciones || []);

      // 2. Si estás editando y el backend te devuelve el registro actual,
      // fusionarlo con 'registroEditar' para que los selects reconozcan el valor seleccionado
      if (idOcurrencia && data.registro) {
        setRegistroEditar((prev) => ({
          ...(prev || {}),
          ...data.registro,
        }));
      }
    } catch (error) {
      console.error("Error al cargar los campos IPCOP:", error);
    }
  };
  // ESTADOS PRINCIPALES
  const [reportesCompletos, setReportesCompletos] = useState<Ocurrencia[]>([]);
  const [filtro, setFiltro] = useState<"TODOS" | "MIOS">("TODOS");
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);
  const [detalleSeleccionado, setDetalleSeleccionado] =
    useState<Ocurrencia | null>(null);
  useEffect(() => {
    fetchLugares("4"); // Pasa el valor inicial que necesites
  }, []);
  // NUEVOS ESTADOS DE FILTRADO (FECHAS Y MODALIDADES)
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
        `${API_URL}/ocurrencias/editar-sipcop/${registroEditar.id_ocurrencia}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // ENVIAMOS TODOS LOS CAMPOS QUE SE EDITAN EN EL MODAL
            id_modalidad: registroEditar.id_modalidad,
            id_medio: registroEditar.id_medio,
            id_lugar: registroEditar.id_lugar,
            id_consecuencia: registroEditar.id_consecuencia,
            id_resultado: registroEditar.id_resultado,
            id_relacion_v: registroEditar.id_relacion_v,
            fecha_evento: registroEditar.fecha_evento,
            hora_alerta: registroEditar.hora_alerta,
            hora_llegada: registroEditar.hora_llegada,
            hora_repliegue: registroEditar.hora_repliegue,
            referencia: registroEditar.referencia,
          }),
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
          fetchOcurrencias();
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
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [modalidadesSeleccionadas, setModalidadesSeleccionadas] = useState<
    string[]
  >([]);
  const [dropdownModalidadesOpen, setDropdownModalidadesOpen] = useState(false);

  // OBTENCIÓN DE DATOS DESDE LA API
  const fetchOcurrencias = useCallback(async () => {
    try {
      const response = await fetch(
        "${API_URL}/ocurrencias/listar/tablasipcop",
      );
      const data = await response.json();
      setReportesCompletos(data || []);
    } catch (error) {
      console.error("Error al obtener datos operativos:", error);
    }
  }, []);

  useEffect(() => {
    fetchOcurrencias();
  }, [fetchOcurrencias]);

  // INYECTAR HOVER Y CERRAR DROPDOWN AL HACER CLIC FUERA
  useEffect(() => {
    const estiloHover = document.createElement("style");
    estiloHover.innerText = `
      .fila-tabla-operativa:hover {
        background-color: #f1f5f9 !important;
        transition: background-color 0.15s ease-in-out;
      }
    `;
    document.head.appendChild(estiloHover);

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("#dropdown-modalidades-container")) {
        setDropdownModalidadesOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetalleSeleccionado(null);
        setDropdownModalidadesOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.head.removeChild(estiloHover);
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleCambioFiltro = (nuevoFiltro: "TODOS" | "MIOS") => {
    setFiltro(nuevoFiltro);
    setPaginaActual(1);
  };

  // OBTENER LISTA ÚNICA DE MODALIDADES
  const listaModalidadesDisponibles = useMemo(() => {
    const mods = reportesCompletos
      .map((item) => item.modalidad_nombre)
      .filter(Boolean);
    return Array.from(new Set(mods)) as string[];
  }, [reportesCompletos]);

  const toggleModalidadFiltro = (mod: string) => {
    setModalidadesSeleccionadas((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
    setPaginaActual(1);
  };

  // FORMATEADORES DE FECHAS
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

  // LÓGICA DE FILTRADO (ESTRICTAMENTE USANDO fecha_evento)
  const reportesFiltrados = useMemo(() => {
    let lista = reportesCompletos || [];

    if (filtro === "MIOS") {
      const miNombreLower = String(userData?.nombres || "")
        .toLowerCase()
        .trim();
      lista = lista.filter((item) => {
        const nombreCompletoReporte = String(
          item.persona_nombre_completo || "",
        ).toLowerCase();
        return (
          nombreCompletoReporte.includes(miNombreLower) && miNombreLower !== ""
        );
      });
    }

    if (fechaInicio) {
      const inicioTimestamp = new Date(fechaInicio).getTime();
      lista = lista.filter((item) => {
        if (!item.fecha_evento) return false;
        const fechaItem = new Date(item.fecha_evento).getTime();
        return fechaItem >= inicioTimestamp;
      });
    }
    if (fechaFin) {
      const finTimestamp = new Date(fechaFin + "T23:59:59").getTime();
      lista = lista.filter((item) => {
        if (!item.fecha_evento) return false;
        const fechaItem = new Date(item.fecha_evento).getTime();
        return fechaItem <= finTimestamp;
      });
    }

    if (modalidadesSeleccionadas.length > 0) {
      lista = lista.filter((item) =>
        modalidadesSeleccionadas.includes(item.modalidad_nombre),
      );
    }

    return lista;
  }, [
    reportesCompletos,
    filtro,
    userData,
    fechaInicio,
    fechaFin,
    modalidadesSeleccionadas,
  ]);

  const totalTodos = reportesCompletos.length;
  // LÓGICA funcional

  const totalMios = useMemo(() => {
    const miNombreLower = String(userData?.nombres || "")
      .toLowerCase()
      .trim();
    if (!miNombreLower) return 0;
    return (reportesCompletos || []).filter((item) =>
      String(item.persona_nombre_completo || "")
        .toLowerCase()
        .includes(miNombreLower),
    ).length;
  }, [reportesCompletos, userData]);

  const totalPaginas = useMemo(() => {
    const paginas = Math.ceil(reportesFiltrados.length / registrosPorPagina);
    return paginas > 0 ? paginas : 1;
  }, [reportesFiltrados, registrosPorPagina]);

  const datosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    return reportesFiltrados.slice(inicio, fin);
  }, [reportesFiltrados, paginaActual, registrosPorPagina]);

  const exportarExcel = () => {
    const dataParaExcel = reportesFiltrados.map((item) => {
      const registro = extraerFechaYHoraLimpia(item.fecha_reporte);
      return {
        "ID REPORTE": item.id_ocurrencia,
        "REGISTRO FECHA": registro.fecha,
        "OPERADOR NOMBRE": item.persona_nombre_completo,
        MODALIDAD: item.modalidad_nombre,
        "FECHA EVENTO": item.fecha_evento || "---",
        UBICACIÓN: item.label || item.via_nombre || "---",
      };
    });
    const ws = XLSX.utils.json_to_sheet(dataParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial_Operativo");
    XLSX.writeFile(wb, `Reporte_Central_${Date.now()}.xlsx`);
  };

 

  return (
    <div style={styles.container}>
      {/* Cabecera Principal */}
      <div style={styles.header}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              color: MJM_BLUE,
              margin: 0,
              fontWeight: 700,
              fontSize: "22px",
            }}
          >
            Historial Operativo
          </h2>
          <button
            onClick={exportarExcel}
            style={{ ...styles.btnExport, backgroundColor: MJM_BLUE }}
          >
            <Ionicons name="document-text" size={16} color="white" /> Excel
          </button>
         
        </div>

        <div style={styles.tabs}>
          <button
            onClick={() => handleCambioFiltro("TODOS")}
            style={filtro === "TODOS" ? styles.tabActive : styles.tab}
          >
            TODO ({totalTodos})
          </button>
          <button
            onClick={() => handleCambioFiltro("MIOS")}
            style={filtro === "MIOS" ? styles.tabActive : styles.tab}
          >
            MIS REGISTROS ({totalMios})
          </button>
        </div>
      </div>

      {/* PANEL DE FILTROS: FECHAS Y DESPLEGABLE DE MODALIDADES A LA DERECHA */}
      <div style={styles.filterCard}>
        <div style={styles.filterRow}>
          <div style={styles.dateGroup}>
            <label style={styles.filterLabel}>Desde (Evento):</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value);
                setPaginaActual(1);
              }}
              style={styles.inputDate}
            />
          </div>

          <div style={styles.dateGroup}>
            <label style={styles.filterLabel}>Hasta (Evento):</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => {
                setFechaFin(e.target.value);
                setPaginaActual(1);
              }}
              style={styles.inputDate}
            />
          </div>

          {/* CONTENEDOR FLEX PARA EMPUJAR EL DESPLEGABLE Y BOTÓN A LA DERECHA */}
          <div style={styles.filterRightContainer}>
            {/* DESPLEGABLE COMPACTO DE MODALIDADES */}
            <div
              id="dropdown-modalidades-container"
              style={styles.dropdownContainer}
            >
              <button
                onClick={() =>
                  setDropdownModalidadesOpen(!dropdownModalidadesOpen)
                }
                style={styles.dropdownButton}
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

              {dropdownModalidadesOpen && (
                <div style={styles.dropdownMenu}>
                  <div style={styles.dropdownHeaderMenu}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#64748b",
                      }}
                    >
                      SELECCIONAR MODALIDAD
                    </span>
                    {modalidadesSeleccionadas.length > 0 && (
                      <button
                        onClick={() => setModalidadesSeleccionadas([])}
                        style={styles.btnClearSelection}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div style={styles.dropdownListScroll}>
                    {listaModalidadesDisponibles.map((mod) => {
                      const seleccionado =
                        modalidadesSeleccionadas.includes(mod);
                      return (
                        <label key={mod} style={styles.dropdownCheckboxItem}>
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            onChange={() => toggleModalidadFiltro(mod)}
                            style={{ cursor: "pointer" }}
                          />
                          <span style={{ fontSize: "12px", color: "#1e293b" }}>
                            {mod}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* BOTÓN LIMPIAR TODO */}
            {(fechaInicio ||
              fechaFin ||
              modalidadesSeleccionadas.length > 0) && (
              <button
                onClick={() => {
                  setFechaInicio("");
                  setFechaFin("");
                  setModalidadesSeleccionadas([]);
                  setPaginaActual(1);
                }}
                style={styles.btnClearFilters}
              >
                Limpiar Todo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de Datos Acondicionada */}
      <div style={styles.tableCard}>
        <div style={styles.tableScrollContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={{ ...styles.th, width: "4%", textAlign: "center" }}>
                  N°
                </th>
                <th style={{ ...styles.th, width: "11%", textAlign: "center" }}>
                  FECHA REGISTRO
                </th>
                <th style={{ ...styles.th, width: "17%", textAlign: "center" }}>
                  PERSONAL
                </th>
                <th style={{ ...styles.th, width: "15%", textAlign: "center" }}>
                  ORIGEN
                </th>
                <th style={{ ...styles.th, width: "23%", textAlign: "center" }}>
                  MODALIDAD
                </th>
                <th style={{ ...styles.th, width: "10%", textAlign: "center" }}>
                  FECHA EVENTO
                </th>
                <th style={{ ...styles.th, width: "15%", textAlign: "center" }}>
                  UBICACIÓN
                </th>
                <th style={{ ...styles.th, width: "5%", textAlign: "center" }}>
                  FOTO
                </th>
                <th style={{ ...styles.th, width: "5%", textAlign: "center" }}>
                  editar
                </th>
              </tr>
            </thead>
            <tbody>
              {datosPaginados.map((item) => (
                <tr
                  key={item.id_ocurrencia}
                  className="fila-tabla-operativa"
                  style={styles.tr}
                  onClick={() => setDetalleSeleccionado(item)}
                >
                  {/* Celda N° */}
                  <td style={styles.td}>
                    <div
                      style={{ ...styles.txtB, textAlign: "center" }}
                      title={String(item.id_ocurrencia)}
                    >
                      #{item.id_ocurrencia}
                    </div>
                  </td>

                  {/* Celda Fecha Registro */}
                  <td style={styles.td}>
                    <div style={styles.celdaTruncadaContainer}>
                      <div style={styles.txtB}>
                        {item.fecha_reporte
                          ? (() => {
                              const fechaObj = new Date(item.fecha_reporte);
                              const diaSemana = fechaObj
                                .toLocaleDateString("es-PE", {
                                  weekday: "short",
                                })
                                .replace(".", "")
                                .toLowerCase();
                              const fechaNumerica =
                                fechaObj.toLocaleDateString("es-PE");
                              return `${diaSemana} ${fechaNumerica}`;
                            })()
                          : item.fecha_evento || "S/F"}
                      </div>
                      <div style={styles.txtS}>
                        {item.fecha_reporte
                          ? new Date(item.fecha_reporte).toLocaleTimeString(
                              "es-PE",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              },
                            )
                          : "S/H"}
                      </div>
                    </div>
                  </td>

                  {/* Celda Personal */}
                  <td style={styles.td}>
                    <div style={styles.celdaTruncadaContainer}>
                      <div
                        style={styles.txtB}
                        title={item.persona_nombre_completo}
                      >
                        {item.persona_nombre_completo}
                      </div>
                      <div style={styles.txtS}>DNI: {item.persona_dni}</div>
                    </div>
                  </td>

                  {/* Celda Origen */}
                  <td style={styles.td}>
                    <div style={styles.celdaTruncadaContainer}>
                      <div
                        style={styles.txtB}
                        title={item.tipo_patrullaje_nombre || "---"}
                      >
                        {item.tipo_patrullaje_nombre || "---"}
                      </div>
                      <div
                        style={{
                          ...styles.txtS,
                          color: "#024885",
                          fontWeight: "500",
                        }}
                        title={item.origen_descripcion}
                      >
                        {item.origen_descripcion}
                      </div>
                      <div
                        style={{
                          ...styles.txtS,
                          color: "#024885",
                          fontWeight: "500",
                        }}
                        title={item.placa_con_tipo}
                      >
                        {item.placa_con_tipo}
                      </div>
                    </div>
                  </td>

                  {/* Celda Modalidad */}
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor: (() => {
                          const mod = String(
                            item.modalidad_nombre || "",
                          ).toUpperCase();
                          if (mod.includes("CUADERNO")) return "#dc2626";
                          if (mod.includes("TACTICO")) return "#024885";
                          if (mod.includes("PROTECCIÓN ESCOLAR"))
                            return "#eab308";
                          return "#f1f5f9";
                        })(),
                        color: (() => {
                          const mod = String(
                            item.modalidad_nombre || "",
                          ).toUpperCase();
                          if (mod.includes("PROTECCIÓN ESCOLAR"))
                            return "#1e293b";
                          if (
                            !mod.includes("CUADERNO") &&
                            !mod.includes("TACTICO")
                          )
                            return "#475569";
                          return "white";
                        })(),
                        fontWeight: "700",
                      }}
                    >
                      {item.modalidad_nombre}
                    </span>

                    {(String(item.modalidad_nombre || "")
                      .toUpperCase()
                      .includes("PROTECCIÓN") ||
                      String(item.modalidad_nombre || "")
                        .toUpperCase()
                        .includes("TÁCTICO") ||
                      String(item.modalidad_nombre || "")
                        .toUpperCase()
                        .includes("CUADERNO")) &&
                    item.distancia_metros ? (
                      <div
                        style={{
                          ...styles.txtS,
                          color: (() => {
                            const mod = String(
                              item.modalidad_nombre || "",
                            ).toUpperCase();
                            const distancia = Number(
                              item.distancia_metros || 0,
                            );
                            if (mod.includes("PROTECCIÓN ESCOLAR"))
                              return "#1e293b";
                            if (distancia > 50) return "#024885";
                            return "#94a3b8";
                          })(),
                          fontWeight: (() => {
                            const mod = String(
                              item.modalidad_nombre || "",
                            ).toUpperCase();
                            const distancia = Number(
                              item.distancia_metros || 0,
                            );
                            if (
                              mod.includes("PROTECCIÓN ESCOLAR") ||
                              distancia > 50
                            )
                              return "700";
                            return "normal";
                          })(),
                          marginTop: "2px",
                        }}
                      >
                        {`(${item.distancia_metros}m)`}
                      </div>
                    ) : null}
                  </td>

                  {/* Celda Fecha Evento */}
                  <td style={styles.td}>
                    <div style={styles.celdaTruncadaContainer}>
                      <div style={styles.txtB}>
                        {formatearFechaConDia(item.fecha_evento)}
                      </div>
                      <div style={styles.txtS}>
                        {item.hora_llegada || "S/H"}
                      </div>
                    </div>
                  </td>

                  {/* Celda Ubicación */}
                  <td style={styles.td}>
                    <div style={styles.celdaTruncadaContainer}>
                      <div
                        style={styles.txtB}
                        title={item.label || item.via_nombre || "---"}
                      >
                        {item.label || item.via_nombre || "---"}
                      </div>
                      <div
                        style={styles.txtS}
                        title={item.referencia || "Sin referencia"}
                      >
                        Ref: {item.referencia || "Sin referencia"}
                      </div>
                    </div>
                  </td>

                  {/* Celda Foto */}
                  <td style={styles.td}>
                    {item.foto_principal ? (
                      <div
                        style={{
                          position: "relative",
                          width: "42px",
                          height: "42px",
                        }}
                      >
                        <img
                          src={item.foto_principal}
                          style={styles.img}
                          alt="img"
                        />
                        {Number(item.total_fotos) > 1 && (
                          <span style={styles.photoCountBadge}>
                            +{Number(item.total_fotos) - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      "---"
                    )}
                  </td>

                  <td
                    style={{
                      ...styles.td,
                      textAlign: "center",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRegistroEditar(item);

                        // Pásale el ID real del registro en lugar de "default"
                        fetchLugares(String(item.id_ocurrencia));
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
                        transition: "all 0.2s ease",
                      }}
                      title="Editar registro"
                    >
                      <Ionicons name="pencil" size={15} color="#024885" />
                    </button>
                  </td>
                </tr>
              ))}
              {datosPaginados.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      ...styles.td,
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: "40px",
                    }}
                  >
                    No se encontraron registros operativos guardados bajo este
                    filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CONTENEDOR DE PAGINACIÓN */}
        <div style={styles.tableFooterPagination}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginRight: "auto",
            }}
          >
            <span
              style={{ fontSize: "12px", color: "#475569", fontWeight: "600" }}
            >
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
            <span
              style={{ fontSize: "12px", color: "#64748b", marginLeft: "10px" }}
            >
              Total encontrados: <strong>{reportesFiltrados.length}</strong>
            </span>
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
              onClick={() =>
                setPaginaActual((p) => Math.min(p + 1, totalPaginas))
              }
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

      {detalleSeleccionado && (
        <div
          style={styles.overlay}
          onClick={() => setDetalleSeleccionado(null)}
        >
          <div style={styles.modalDetail} onClick={(e) => e.stopPropagation()}>
            {/* HEADER */}
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, color: "#024885", fontWeight: 700 }}>
                N° de Ocurrencia: {detalleSeleccionado.codigo_seguimiento ?? ""}
                -SGS-GSC
              </h3>
              <button
                onClick={() => setDetalleSeleccionado(null)}
                style={styles.btnClose}
              >
                ✕
              </button>
            </div>

            {/* BODY CON SCROLL */}
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
                      whiteSpace: "nowrap", // Evita que el texto baje de línea
                      overflow: "hidden", // Oculta lo que sobresalga
                      textOverflow: "ellipsis", // Añade los puntos suspensivos (...)
                      maxWidth: "250px", // Ajusta este límite según el ancho de tu columna
                      display: "inline-block",
                      verticalAlign: "bottom",
                    }}
                    title={detalleSeleccionado.modalidad_nombre || "---"} // Muestra el texto completo al pasar el cursor
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
                    {detalleSeleccionado.origen_descripcion || "---"}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Tipo de patrullaje:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.tipo_patrullaje_nombre || "---"}
                  </span>
                </div>

                {/* FECHA Y HORAS */}
                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Fecha:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.fecha_evento
                      ? new Date(
                          detalleSeleccionado.fecha_evento,
                        ).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "S/F"}
                  </span>
                </div>

                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>
                    Horas (Alert / Lleg / Repl):
                  </span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.hora_alerta || "S/H"} /{" "}
                    {detalleSeleccionado.hora_llegada || "S/H"} /{" "}
                    {detalleSeleccionado.hora_repliegue || "S/H"}
                  </span>
                </div>
                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Contribuyente:</span>
                  <span style={styles.infoValue}>
                    <div>
                      {detalleSeleccionado.nombre_informante || "---"} -{" "}
                      {detalleSeleccionado.numero_telefono || "---"}
                    </div>
                  </span>
                </div>
                <div style={styles.infoRowGrid}>
                  <span style={styles.infoLabel}>Encargado:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.unidad_encargada || "S/H"}
                  </span>
                </div>
                <div style={{ ...styles.infoRowGrid, gridColumn: "span 2" }}>
                  <span style={styles.infoLabel}>Ubicación:</span>
                  <span style={styles.infoValue}>
                    {detalleSeleccionado.nombre_lugar}

                    <span style={{ color: "#64748b", fontSize: "12px" }}>
                      {" "}
                      (Ref: {detalleSeleccionado.referencia || "Sin referencia"}
                      )
                    </span>
                  </span>
                </div>
              </div>

              {/* DESCRIPCIÓN */}
              <div style={{ marginTop: "16px" }}>
                <strong style={styles.sectionTitle}>
                  Descripción / Suceso:
                </strong>

                <div
                  style={{
                    ...styles.descBox,
                    width: "100%",
                    flex: 1,
                    padding: "12px",
                    fontSize: "13px",
                    color: "#1e293b",
                    overflowY: "auto",
                    boxSizing: "border-box",
                    whiteSpace: "pre-line",
                  }}
                >
                  {(detalleSeleccionado as any).ocurrencia_descripcion ||
                    "Sin descripción detallada."}
                </div>
              </div>

              {/* EVIDENCIAS FOTOGRÁFICAS */}
              {/* EVIDENCIAS FOTOGRÁFICAS */}
              {/* EVIDENCIAS FOTOGRÁFICAS (Versión simple con tu backend actual) */}
              {(() => {
                let fotosArray: any[] = [];
                try {
                  const itemData = detalleSeleccionado as any;
                  const fotosVal = itemData.fotos_json;
                  fotosArray = fotosVal
                    ? typeof fotosVal === "string"
                      ? JSON.parse(fotosVal)
                      : fotosVal
                    : itemData.lista_fotos ||
                      itemData.fotos ||
                      (itemData.foto_principal
                        ? [itemData.foto_principal]
                        : []);
                } catch (e) {
                  fotosArray = (detalleSeleccionado as any).foto_principal
                    ? [(detalleSeleccionado as any).foto_principal]
                    : [];
                }

                if (Array.isArray(fotosArray) && fotosArray.length > 0) {
                  return (
                    <div style={{ marginTop: "16px" }}>
                      <strong style={styles.sectionTitle}>
                        Evidencias Adjuntas ({fotosArray.length}):
                      </strong>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          marginTop: "8px",
                        }}
                      >
                        {fotosArray.map((foto: any, idx: number) => {
                          const urlFoto =
                            typeof foto === "string"
                              ? foto
                              : foto.url_imagen || foto.url;

                          return (
                            <div
                              key={idx}
                              style={{
                                position: "relative",
                                display: "inline-block",
                              }}
                            >
                              {/* Enlace que al hacer clic abre la foto original completa */}
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
                                  cursor: "pointer",
                                }}
                                className="link-evidencia-foto"
                              >
                                <span>📷 Ver Foto {idx + 1}</span>
                              </a>

                              {/* Miniatura flotante usando la misma URL pero reducida por CSS */}
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
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    borderRadius: "4px",
                                  }}
                                  alt={`Preview ${idx + 1}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Estilo rápido para activar el hover */}
                      <style>{`
                .link-evidencia-foto:hover {
                  background-color: #e2e8f0 !important;
                }
                .link-evidencia-foto:hover + .tooltip-miniatura,
                .tooltip-miniatura:hover {
                  display: block !important;
                }
              `}</style>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Debajo de donde cierras el modal de detalle, añade esto */}
      {registroEditar && (
        <div style={styles.overlay} onClick={() => setRegistroEditar(null)}>
          <div
            style={{
              ...styles.modalDetail,
              maxWidth: "1100px", // Ampliado un poco para acomodar las dos columnas
              width: "95%",
              height: "80vh",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera Principal */}
            <div
              style={{
                backgroundColor: "#024885",
                color: "#fff",
                padding: "12px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: "bold", fontSize: "14px" }}>
                EDITAR REGISTRO DE OCURRENCIA
              </span>
              <button
                onClick={() => setRegistroEditar(null)}
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

            {/* CONTENIDO PRINCIPAL EN DOS SECCIONES (FIJA + PESTAÑAS) */}
            <div
              style={{
                display: "flex",
                flex: 1,
                overflow: "hidden",
              }}
            >
              {/* COLUMNA IZQUIERDA: PERENNE (Tiempos y Descripción) */}
              <div
                style={{
                  width: "45%",
                  borderRight: "1px solid #e2e8f0",
                  padding: "20px",
                  backgroundColor: "#fff",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    color: "#024885",
                    borderBottom: "2px solid #024885",
                    paddingBottom: "5px",
                  }}
                >
                  1. Tiempos y Descripción (Panel Fijo)
                </div>

                <div>
                  <label
                    style={{
                      fontSize: "12px",
                      color: "#024885",
                      fontWeight: "bold",
                    }}
                  >
                    FECHA DEL EVENTO
                  </label>
                  <input
                    type="date"
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      padding: "8px",
                      width: "100%",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                    value={registroEditar.fecha_evento ?? ""}
                    onChange={(e) =>
                      setRegistroEditar({
                        ...registroEditar,
                        fecha_evento: e.target.value,
                      })
                    }
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                  }}
                >
                  {["hora_alerta", "hora_llegada", "hora_repliegue"].map(
                    (campo) => (
                      <div key={campo}>
                        <label
                          style={{
                            fontSize: "11px",
                            color: "#024885",
                            fontWeight: "bold",
                          }}
                        >
                          {campo.replace("hora_", "").toUpperCase()}
                        </label>
                        <input
                          type="time"
                          style={{
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            padding: "6px",
                            width: "100%",
                            boxSizing: "border-box",
                            marginTop: "4px",
                          }}
                          value={
                            (registroEditar[
                              campo as keyof Ocurrencia
                            ] as string) ?? ""
                          }
                          onChange={(e) =>
                            setRegistroEditar({
                              ...registroEditar,
                              [campo]: e.target.value,
                            })
                          }
                        />
                      </div>
                    ),
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: "6px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "12px",
                      color: "#024885",
                      fontWeight: "bold",
                    }}
                  >
                    DESCRIPCIÓN DE LA OCURRENCIA
                  </label>
                  <textarea
                    style={{
                      width: "100%",
                      flex: 1,
                      padding: "10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      resize: "none",
                      boxSizing: "border-box",
                      minHeight: "120px",
                    }}
                    value={registroEditar.ocurrencia_descripcion ?? ""}
                    onChange={(e) =>
                      setRegistroEditar({
                        ...registroEditar,
                        ocurrencia_descripcion: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* COLUMNA DERECHA: CON PESTAÑAS (2 y 3) */}
              <div
                style={{
                  width: "55%",
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "#fff",
                }}
              >
                {/* Barra de Pestañas para la sección derecha */}
                <div
                  style={{
                    display: "flex",
                    backgroundColor: "#013360",
                    padding: "10px 15px 0 15px",
                    gap: "5px",
                  }}
                >
                  {[
                    { id: "sipcop", label: "2. Clasificación y Mosaicos" },
                    {
                      id: "evidencias",
                      label: `3. Evidencias (${((registroEditar as any).lista_fotos || []).length})`,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPestanaActiva(tab.id as any)}
                      style={{
                        padding: "8px 16px",
                        backgroundColor:
                          pestanaActiva === tab.id ? "#fff" : "transparent",
                        color: pestanaActiva === tab.id ? "#024885" : "#cbd5e1",
                        border: "none",
                        borderTopLeftRadius: "6px",
                        borderTopRightRadius: "6px",
                        fontWeight: "bold",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Contenido Dinámico de las Pestañas Derechas */}
                <div
                  style={{
                    flex: 1,
                    padding: "20px",
                    overflowY: "auto",
                    backgroundColor: "#fff",
                  }}
                >
                  {/* PESTAÑA 2: MOSAICOS SIPCOP */}
                  {pestanaActiva === "sipcop" && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px",
                      }}
                    >
                      {/* Mosaico Modalidad */}
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#024885",
                            fontWeight: "bold",
                            display: "block",
                            marginBottom: "6px",
                          }}
                        >
                          MODALIDAD
                        </label>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "8px",
                            maxHeight: "110px",
                            overflowY: "auto",
                            border: "1px solid #e2e8f0",
                            padding: "8px",
                            borderRadius: "4px",
                          }}
                        >
                          {Array.isArray(listaUbicaciones) &&
                            listaUbicaciones.map((mod: any) => {
                              const nombre = String(
                                mod.label ?? mod.nombre ?? "",
                              ).toUpperCase();
                              const idMod = mod.value ?? mod.id;
                              const seleccionado =
                                registroEditar?.modalidad_nombre === nombre;
                              return (
                                <div
                                  key={idMod}
                                  onClick={() =>
                                    setRegistroEditar({
                                      ...registroEditar,
                                      modalidad_nombre: nombre,
                                      id_modalidad: idMod,
                                    })
                                  }
                                  style={{
                                    padding: "6px",
                                    fontSize: "11px",
                                    fontWeight: seleccionado
                                      ? "bold"
                                      : "normal",
                                    backgroundColor: seleccionado
                                      ? "#024885"
                                      : "#f8fafc",
                                    color: seleccionado ? "#fff" : "#1e293b",
                                    border: "1px solid",
                                    borderColor: seleccionado
                                      ? "#024885"
                                      : "#cbd5e1",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    textAlign: "center",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={nombre}
                                >
                                  {nombre}
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      {/* Mosaico Medio */}
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#024885",
                            fontWeight: "bold",
                            display: "block",
                            marginBottom: "6px",
                          }}
                        >
                          MEDIO
                        </label>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "8px",
                            maxHeight: "90px",
                            overflowY: "auto",
                            border: "1px solid #e2e8f0",
                            padding: "8px",
                            borderRadius: "4px",
                          }}
                        >
                          {(listaMedios ?? []).map((item: any) => {
                            const val = item.value ?? item.id ?? item;
                            const label = String(
                              item.label ?? item.nombre ?? item,
                            ).toUpperCase();
                            const seleccionado =
                              registroEditar?.id_medio === val;
                            return (
                              <div
                                key={val}
                                onClick={() =>
                                  setRegistroEditar({
                                    ...registroEditar,
                                    id_medio: val,
                                  })
                                }
                                style={{
                                  padding: "6px",
                                  fontSize: "11px",
                                  backgroundColor: seleccionado
                                    ? "#024885"
                                    : "#f8fafc",
                                  color: seleccionado ? "#fff" : "#1e293b",
                                  border: "1px solid",
                                  borderColor: seleccionado
                                    ? "#024885"
                                    : "#cbd5e1",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  textAlign: "center",
                                }}
                              >
                                {label}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mosaico Lugar */}
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#024885",
                            fontWeight: "bold",
                            display: "block",
                            marginBottom: "6px",
                          }}
                        >
                          LUGAR / UBISIPCOP
                        </label>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "8px",
                            maxHeight: "100px",
                            overflowY: "auto",
                            border: "1px solid #e2e8f0",
                            padding: "8px",
                            borderRadius: "4px",
                          }}
                        >
                          {(listaUbisipcop ?? []).map((item: any) => {
                            const val = item.value ?? item.id ?? item;
                            const label = String(
                              item.label ?? item.nombre ?? item,
                            ).toUpperCase();
                            const seleccionado =
                              registroEditar?.id_lugar === val;
                            return (
                              <div
                                key={val}
                                onClick={() =>
                                  setRegistroEditar({
                                    ...registroEditar,
                                    id_lugar: val,
                                  })
                                }
                                style={{
                                  padding: "6px",
                                  fontSize: "11px",
                                  backgroundColor: seleccionado
                                    ? "#024885"
                                    : "#f8fafc",
                                  color: seleccionado ? "#fff" : "#1e293b",
                                  border: "1px solid",
                                  borderColor: seleccionado
                                    ? "#024885"
                                    : "#cbd5e1",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  textAlign: "center",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={label}
                              >
                                {label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 3: EVIDENCIAS Y REFERENCIA */}
                  {pestanaActiva === "evidencias" && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#024885",
                            fontWeight: "bold",
                          }}
                        >
                          REFERENCIA
                        </label>
                        <input
                          style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid #cbd5e1",
                            borderRadius: "4px",
                            boxSizing: "border-box",
                            marginTop: "4px",
                            textTransform: "uppercase",
                          }}
                          placeholder="INGRESE REFERENCIA"
                          value={registroEditar?.referencia ?? ""}
                          onChange={(e) =>
                            setRegistroEditar({
                              ...registroEditar,
                              referencia: e.target.value.toUpperCase(),
                            })
                          }
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <label
                            style={{
                              fontSize: "12px",
                              color: "#024885",
                              fontWeight: "bold",
                            }}
                          >
                            EVIDENCIAS FOTOGRÁFICAS (
                            {((registroEditar as any).lista_fotos || []).length}{" "}
                            / 4)
                          </label>
                          <label
                            htmlFor="fileInputTabs"
                            style={{
                              backgroundColor: "#024885",
                              color: "#fff",
                              padding: "6px 12px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              cursor: "pointer",
                              fontWeight: "bold",
                            }}
                          >
                            + Adjuntar Foto
                          </label>
                        </div>

                        <input
                          type="file"
                          id="fileInputTabs"
                          style={{ display: "none" }}
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) return;
                            const fotosArray =
                              (registroEditar as any).lista_fotos || [];
                            const espacioDisponible = 4 - fotosArray.length;
                            if (espacioDisponible <= 0) {
                              alert("Límite máximo de 4 fotos alcanzado.");
                              return;
                            }
                            Array.from(files)
                              .slice(0, espacioDisponible)
                              .forEach((file) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setRegistroEditar((prev: any) => ({
                                    ...prev,
                                    lista_fotos: [
                                      ...(prev.lista_fotos || []),
                                      {
                                        url_imagen: reader.result as string,
                                        archivo_real: file,
                                      },
                                    ],
                                  }));
                                };
                                reader.readAsDataURL(file);
                              });
                            e.target.value = "";
                          }}
                        />

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            maxHeight: "150px",
                            overflowY: "auto",
                            border: "1px solid #e2e8f0",
                            padding: "8px",
                            borderRadius: "4px",
                          }}
                        >
                          {((registroEditar as any).lista_fotos || [])
                            .length === 0 ? (
                            <span
                              style={{
                                fontSize: "12px",
                                color: "#94a3b8",
                                textAlign: "center",
                                padding: "20px",
                              }}
                            >
                              No hay fotos adjuntas en este registro
                            </span>
                          ) : (
                            ((registroEditar as any).lista_fotos || []).map(
                              (foto: any, index: number) => (
                                <div
                                  key={index}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "6px 8px",
                                    backgroundColor: "#f8fafc",
                                    borderRadius: "4px",
                                    border: "1px solid #e2e8f0",
                                  }}
                                >
                                  <a
                                    href={
                                      typeof foto === "string"
                                        ? foto
                                        : foto?.url_imagen
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      fontSize: "12px",
                                      color: "#024885",
                                      textDecoration: "underline",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    Evidencia {index + 1}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nuevasFotos = (
                                        (registroEditar as any).lista_fotos ||
                                        []
                                      ).filter(
                                        (_: any, i: number) => i !== index,
                                      );
                                      setRegistroEditar({
                                        ...registroEditar,
                                        lista_fotos: nuevasFotos,
                                      });
                                    }}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "#D32F2F",
                                      cursor: "pointer",
                                      fontSize: "12px",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              ),
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE CONFIRMACIÓN */}
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
            <h3
              style={{
                color: "#024885",
                marginTop: 0,
                marginBottom: "12px",
                fontSize: "18px",
              }}
            >
              ¿Confirmar cambios?
            </h3>
            <p
              style={{
                color: "#475569",
                fontSize: "13px",
                marginBottom: "20px",
                lineHeight: "1.4",
              }}
            >
              ¿Estás seguro de que deseas actualizar la información de este
              registro?
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
    </div>
  );
}

// ESTILOS CON EL NUEVO DISEÑO RESPONSIVO Y DESPLEGABLE HACIA LA DERECHA
const styles: Record<string, React.CSSProperties | any> = {
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
  progressTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 15 },
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
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  card: {
    padding: "18px",
    borderRadius: "12px",
    color: "white",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
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
  },
  tabs: {
    display: "flex",
    gap: "4px",
    backgroundColor: "#e2e8f0",
    padding: "4px",
    borderRadius: "8px",
  },
  tab: {
    border: "none",
    padding: "8px 16px",
    cursor: "pointer",
    borderRadius: "6px",
    backgroundColor: "transparent",
    color: "#64748b",
    fontWeight: "600",
    fontSize: "13px",
    transition: "all 0.2s",
  },
  tabActive: {
    border: "none",
    padding: "8px 16px",
    cursor: "pointer",
    borderRadius: "6px",
    backgroundColor: MJM_BLUE,
    color: "white",
    fontWeight: "600",
    fontSize: "13px",
    transition: "all 0.2s",
  },
  btnExport: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "6px",
    border: "none",
    color: "white",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
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
    // SOLUCIÓN: Fijamos la altura de la tarjeta para controlar el espacio de la pantalla
    height: "800px",
  },
  tableScrollContainer: {
    overflowX: "auto",
    overflowY: "auto",
    // Ocupa todo el espacio disponible entre la cabecera y el paginador
    flex: 1,
  },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  thead: {
    backgroundColor: "#024885", // <-- Cambiado a tu azul MJM_BLUE
    borderBottom: "2px solid #013663",
    textAlign: "left",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  th: {
    padding: "14px 16px",
    fontSize: "10px", // Enfoque profesional ligeramente más grande
    fontWeight: "700",
    color: "#ffffff", // <-- Texto blanco para que contraste con el fondo azul
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
    color: "#64748b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
    width: "100%",
  },

  img: {
    width: "42px",
    height: "42px",
    borderRadius: "8px",
    objectFit: "cover",
    border: "1px solid #cbd5e1",
  },
  photoCountBadge: {
    position: "absolute",
    bottom: "-2px",
    right: "-2px",
    backgroundColor: "#1e293b",
    color: "white",
    fontSize: "9px",
    fontWeight: "bold",
    padding: "1px 4px",
    borderRadius: "6px",
    border: "1px solid white",
  },

  tableFooterPagination: {
    display: "flex",
    justifyContent: "space-between", // <-- Cambiado de flex-end a space-between para separar los extremos
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
    fontSize: "12px",
    fontWeight: "600",
    outline: "none",
    cursor: "pointer",
  },
  paginationFlex: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "transparent", // <-- Quitamos el fondo agregado para que respire con el footer blanco
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
  galleryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "10px",
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

  imgGalleryItem: {
    width: "100%",
    height: "95px",
    borderRadius: "8px",
    objectFit: "cover",
    border: "1px solid #cbd5e1",
    backgroundColor: "#f8fafc",
  },

  // Panel de Filtros Actualizado
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
  dateGroup: { display: "flex", alignItems: "center", gap: "8px" },
  filterRightContainer: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginLeft: "auto",
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
  },
  inputDate: {
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    color: "#1e293b",
    outline: "none",
  },
  btnClearFilters: {
    padding: "6px 12px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },

  // Estilos del Desplegable (Dropdown) personalizado colocado a la derecha
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
    fontSize: "12px",
    fontWeight: "600",
    color: "#334155",
    minWidth: "180px",
  },
  dropdownMenu: {
    position: "absolute",
    top: "calc(100% + 4px)",
    right: 0, // Despliega ordenadamente alineado a la derecha
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
    transition: "background 0.2s",
  },
};
