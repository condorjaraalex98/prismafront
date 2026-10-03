import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dropdown } from "react-native-element-dropdown";
import * as XLSX from "xlsx";
// CONFIGURACIÓN DE TIPOS E IMPORTACIÓN PARA EXPORTAR PDF

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
// 1. Definimos la estructura de un agresor/víctima individual
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

// 2. Interfaz principal limpia y tipada correctamente
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
  // Campos sueltos antiguos (opcionales por retrocompatibilidad)
  nombre_agresor?: string;
  placa_agresor?: string;
  edad?: number | string;

  // Listas dinámicas tipadas correctamente (¡Solución al error de sintaxis!)
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
  const [cargandoExcel, setCargandoExcel] = useState(false);
  // 2. DECLARA LOS ESTADOS DE LAS 5 LISTAS (Faltaban en tu componente)
  const [listaMedios, setListaMedios] = useState<CatalogoItem[]>([]);
  const [listaUbisipcop, setListaUbisipcop] = useState<CatalogoItem[]>([]);
  const [listaConsecuencias, setListaConsecuencias] = useState<CatalogoItem[]>(
    [],
  );

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
  const listaPatrimonio = [
    { id: 1, nombre: "SI" },
    { id: 2, nombre: "NO" },
  ];
  const fetchLugares = async () => {
    try {
      const response = await fetch(
        "${API_URL}/catalogos/modalidad",
      );
      const data = await response.json();
      setListaUbicaciones(data);
    } catch (error) {
      console.error("Error al cargar modalidades:", error);
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
      console.error("Error al cargar los campos sIPCOP:", error);
    }
  };

  // ESTADOS PRINCIPALES
  const [reportesCompletos, setReportesCompletos] = useState<Ocurrencia[]>([]);
  const [filtro, setFiltro] = useState<"TODOS" | "MIOS">("TODOS");
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(25);
  const [detalleSeleccionado, setDetalleSeleccionado] =
    useState<Ocurrencia | null>(null);
  useEffect(() => {
    fetchLugares();
  }, []);
  // NUEVOS ESTADOS DE FILTRADO (FECHAS Y MODALIDA
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
        `${API_URL}/ocurrencias/editarseguro-sipcop/${registroEditar.id_ocurrencia}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // CAMPOS MAPEADOS CON LOS NOMBRES QUE ESPERA EL BACKEND (_real)
            id_modalidad: registroEditar.id_modalidad,
            id_resultado_real: registroEditar.id_resultado,
            id_consecuencia_real: registroEditar.id_consecuencia,
            id_lugar_real: registroEditar.id_lugarsip,
            id_medio_real: registroEditar.id_medio,

            // OTROS CAMPOS QUE PUEDAS NECESITAR ACTUALIZAR
            fecha_evento: registroEditar.fecha_evento,
            hora_alerta: registroEditar.hora_alerta,
            hora_llegada: registroEditar.hora_llegada,
            hora_repliegue: registroEditar.hora_repliegue,
            referencia: registroEditar.referencia,

            // 👇👇 TRES CAMPOS NUEVOS AGREGADOS AQUÍ 👇👇
            estado: registroEditar.estado,
            patrimonio_real: registroEditar.patrimonio_real,
            arresto_ciudadano: registroEditar.arresto_ciudadano,
            // 👆👆 --------------------------------- 👆👆

            // ARREGLOS DINÁMICOS PARA LAS TABLAS DE DETALLES
            victimas: registroEditar.victimas || [],
            agresores: registroEditar.agresores || [],
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
  const [fechaReporteInicio, setFechaReporteInicio] = useState(""); // Nuevo
  const [fechaReporteFin, setFechaReporteFin] = useState("");
  const [modalidadesSeleccionadas, setModalidadesSeleccionadas] = useState<
    string[]
  >([]);
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<string[]>(
    [],
  );
  const [dropdownModalidadesOpen, setDropdownModalidadesOpen] = useState(false);
  const [dropdownEstadosOpen, setDropdownEstadosOpen] = useState(false);

  // OBTENCIÓN DE DATOS DESDE LA API
  const fetchOcurrencias = useCallback(async () => {
    try {
      const response = await fetch(
        "${API_URL}/ocurrencias/listar/exportarango",
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
  const listaEstadosDisponibles = useMemo(() => {
    const estados = reportesCompletos
      .map((item) => item.estado)
      .filter(Boolean);
    return Array.from(new Set(estados)) as string[];
  }, [reportesCompletos]);
  const toggleModalidadFiltro = (mod: string) => {
    setModalidadesSeleccionadas((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
    setPaginaActual(1);
  };
  const toggleEstadoFiltro = (estado: string) => {
    setEstadosSeleccionados((prev) =>
      prev.includes(estado)
        ? prev.filter((e) => e !== estado)
        : [...prev, estado],
    );
    setDropdownEstadosOpen(false);
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

    // Filtro por Usuario
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

    // Rango fecha_evento (Comparación segura por fecha de calendario YYYYMMDD)
    if (fechaInicio) {
      const inicioFiltro = Number(fechaInicio.replace(/-/g, ""));
      lista = lista.filter((item) => {
        if (!item.fecha_evento) return false;
        const fechaItemStr = String(item.fecha_evento)
          .substring(0, 10)
          .replace(/-/g, "");
        return Number(fechaItemStr) >= inicioFiltro;
      });
    }
    if (fechaFin) {
      const finFiltro = Number(fechaFin.replace(/-/g, ""));
      lista = lista.filter((item) => {
        if (!item.fecha_evento) return false;
        const fechaItemStr = String(item.fecha_evento)
          .substring(0, 10)
          .replace(/-/g, "");
        return Number(fechaItemStr) <= finFiltro;
      });
    }

    // Rango fecha_reporte (Timestamp)
    if (fechaReporteInicio) {
      const inicioTs = new Date(fechaReporteInicio + "T00:00:00").getTime();
      lista = lista.filter((item) => {
        if (!item.fecha_reporte) return false;
        const valReporte =
          typeof item.fecha_reporte === "string"
            ? item.fecha_reporte.replace(" ", "T")
            : item.fecha_reporte;
        return new Date(valReporte).getTime() >= inicioTs;
      });
    }
    if (fechaReporteFin) {
      const finTs = new Date(fechaReporteFin + "T23:59:59").getTime();
      lista = lista.filter((item) => {
        if (!item.fecha_reporte) return false;
        const valReporte =
          typeof item.fecha_reporte === "string"
            ? item.fecha_reporte.replace(" ", "T")
            : item.fecha_reporte;
        return new Date(valReporte).getTime() <= finTs;
      });
    }

    // Modalidades
    if (modalidadesSeleccionadas.length > 0) {
      lista = lista.filter((item) =>
        modalidadesSeleccionadas.includes(item.modalidad_nombre),
      );
    }

    // Estados (Asegúrate de tener este bloque para que filtre la tabla)
    if (estadosSeleccionados.length > 0) {
      lista = lista.filter((item) =>
        estadosSeleccionados.includes(item.estado || ""),
      );
    }

    return lista;
  }, [
    reportesCompletos,
    filtro,
    userData,
    fechaInicio,
    fechaFin,
    fechaReporteInicio,
    fechaReporteFin,
    modalidadesSeleccionadas,
    estadosSeleccionados, // <-- Fundamental para que el useMemo detecte cambios en los estados
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
  // Calcula el conteo por estado de forma dinámica
  const conteoPorEstado = datosPaginados.reduce(
    (acc, item) => {
      const estado = String(item.estado || "SIN ESTADO").toUpperCase();
      acc[estado] = (acc[estado] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const exportarExcel = async () => {
    try {
      // 1. Activamos el modal de carga (Aquí SOLO se usa, ya NO se declara con const)
      setCargandoExcel(true);

      // Cedemos el control un instante al navegador para que dibuje el modal
      await new Promise((resolve) => setTimeout(resolve, 50));

      const limpiarTextoExcel = (texto: any) => {
        if (!texto) return "";
        const str = String(texto);
        return str.length > 32000 ? str.substring(0, 32000) + "..." : str;
      };

      const limpiarHora = (hora: any) => {
        if (!hora) return "";
        const str = String(hora);
        if (str.length >= 5) {
          return str.substring(0, 5);
        }
        return str;
      };

      const formatearFechaExcel = (fecha: any) => {
        if (!fecha) return "";
        const fechaStr = String(fecha).substring(0, 10);
        const [anio, mes, dia] = fechaStr.split("-");
        if (!anio || !mes || !dia) return String(fecha);
        return `${dia}/${mes}/${anio}`;
      };

      const formatearFechaReporteCompleta = (fechaReporte: any) => {
        if (!fechaReporte) return "S/F";
        try {
          const fechaObj = new Date(fechaReporte);
          if (isNaN(fechaObj.getTime())) return String(fechaReporte);

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
        } catch (e) {
          return String(fechaReporte);
        }
      };

      const formatearFotoExcel = (urlFoto: any) => {
        if (!urlFoto) return "";
        return String(urlFoto).trim();
      };

      const obtenerTimestampArchivo = () => {
        const ahora = new Date();
        const anio = ahora.getFullYear();
        const mes = String(ahora.getMonth() + 1).padStart(2, "0");
        const dia = String(ahora.getDate()).padStart(2, "0");
        const hora = String(ahora.getHours()).padStart(2, "0");
        const minuto = String(ahora.getMinutes()).padStart(2, "0");
        const segundo = String(ahora.getSeconds()).padStart(2, "0");
        return `${dia}-${mes}-${anio}_${hora}-${minuto}-${segundo}`;
      };

      // 2. Procesamos el mapeo de los datos
      const dataParaExcel = reportesFiltrados.map((item: any) => ({
        ID: item.id_ocurrencia,
        MARCA_TEMPORAL: formatearFechaReporteCompleta(item.fecha_reporte),
        DNI_SERENO: limpiarTextoExcel(item.persona_dni),
        APELLIDOS_NOMBRES: limpiarTextoExcel(item.persona_nombre_completo),
        ORIGEN: limpiarTextoExcel(item.origen_descripcion),
        TIPO_PATRULLAJE: limpiarTextoExcel(item.tipo_patrullaje_nombre),
        MODALIDAD_PATRULLAJE: limpiarTextoExcel(item.mod_patrullaje_nombre),
        TIPO_UNIDAD: limpiarTextoExcel(item.vehiculo_tipo),
        PLACA: limpiarTextoExcel(item.vehiculo_placa),
        TURNO: limpiarTextoExcel(item.turnr),
        HORA_ALERTA: limpiarHora(item.hora_alerta),
        HORA_LLEGADA: limpiarHora(item.hora_llegada),
        HORA_REPLIEGUE: limpiarHora(item.hora_repliegue),
        FECHA_OCURRENCIA: formatearFechaExcel(item.fecha_evento),
        REFERENCIA: limpiarTextoExcel(item.referencia),
        DIRECCIÓN_CONSOLIDADA: limpiarTextoExcel(item.nombre_lugar),
        COORDENADA: limpiarTextoExcel(item.coordenada),
        DATOS_IMPORTANTES: limpiarTextoExcel(item.ocurrencia_descripcion),
        ADJUNTO_1: formatearFotoExcel(item.foto_1),
        ADJUNTO_2: formatearFotoExcel(item.foto_2),
        ADJUNTO_3: formatearFotoExcel(item.foto_3),
        ADJUNTO_4: formatearFotoExcel(item.foto_4),
        GENERICO: limpiarTextoExcel(item.cat_generica_nombre),
        ESPECIFICO: limpiarTextoExcel(item.cat_especifica_nombre),
        MODALIDAD: limpiarTextoExcel(item.modalidad_nombre),
        DATOS_EFECTIVO: limpiarTextoExcel(item.pnp_datos),
        RESULTADO: limpiarTextoExcel(item.resultado_des),
        CONSECUENCIA: limpiarTextoExcel(item.consecuencia_des),
        LUGAR: limpiarTextoExcel(item.lugar_des),
        MEDIO: limpiarTextoExcel(item.medio_des),
        IDENTIDAD: limpiarTextoExcel(item.estado_involucrados),
        VICTIMA_NOMBRE: limpiarTextoExcel(item.victimas_nombres),
        VICTIMA_EDAD: limpiarTextoExcel(item.victimas_edades),
        VICTIMA_PLACA: limpiarTextoExcel(item.victimas_placas),
        RELACION_CON_AGRESOR: limpiarTextoExcel(item.victimas_relacion),
        AGRESOR_NOMBRE: limpiarTextoExcel(item.agresores_nombres),
        AGRESOR_EDAD: limpiarTextoExcel(item.agresores_edades),
        AGRESOR_PLACA: limpiarTextoExcel(item.agresores_placas),
        NUMERO_DOCUMENTO: item.codigo_seguimiento
          ? `${limpiarTextoExcel(item.codigo_seguimiento)}MDJM-GSC-SGS`
          : "",
        ESTADO: limpiarTextoExcel(item.estado),
      }));

      // Pausa corta para estabilidad visual del modal
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 3. Generación y descarga del Excel
      const ws = XLSX.utils.json_to_sheet(dataParaExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial_Operativo");

      XLSX.writeFile(wb, `Reporte_Integrado_${obtenerTimestampArchivo()}.xlsx`);
    } catch (error) {
      console.error("Error al exportar el Excel:", error);
    } finally {
      // 4. Ocultar el modal de carga de manera segura
      setCargandoExcel(false);
    }
  };

  const exportarSipcop = async () => {
    try {
      // 1. Activamos el modal de carga (Asegúrate de tener declarado const [cargandoExcel, setCargandoExcel] = useState(false) arriba en tu componente)
      setCargandoExcel(true);

      // Cedemos el control un instante al navegador para que dibuje el modal en pantalla
      await new Promise((resolve) => setTimeout(resolve, 50));

      const limpiarTextoExcel = (texto: any) => {
        if (!texto) return "";
        const str = String(texto);
        return str.length > 32000 ? str.substring(0, 32000) + "..." : str;
      };

      // Helper para limpiar las horas (ej: "23:23:00" -> "23:23")
      const limpiarHora = (hora: any) => {
        if (!hora) return "";
        const str = String(hora);
        if (str.length >= 5) {
          return str.substring(0, 5);
        }
        return str;
      };

      // Helper para formatear fechas tipo YYYY-MM-DD a DD/MM/YYYY
      const formatearFechaExcel = (fecha: any) => {
        if (!fecha) return "";
        const fechaStr = String(fecha).substring(0, 10);
        const [anio, mes, dia] = fechaStr.split("-");
        if (!anio || !mes || !dia) return String(fecha);
        return `${dia}/${mes}/${anio}`;
      };

      // Helper para formatear fecha_reporte idéntico a tu tabla web
      const formatearFechaReporteCompleta = (fechaReporte: any) => {
        if (!fechaReporte) return "S/F";
        try {
          const fechaObj = new Date(fechaReporte);
          if (isNaN(fechaObj.getTime())) return String(fechaReporte);

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
        } catch (e) {
          return String(fechaReporte);
        }
      };

      // Helper para el timestamp del archivo
      const obtenerTimestampArchivo = () => {
        const ahora = new Date();
        const anio = ahora.getFullYear();
        const mes = String(ahora.getMonth() + 1).padStart(2, "0");
        const dia = String(ahora.getDate()).padStart(2, "0");
        const hora = String(ahora.getHours()).padStart(2, "0");
        const minuto = String(ahora.getMinutes()).padStart(2, "0");
        const segundo = String(ahora.getSeconds()).padStart(2, "0");
        return `${dia}-${mes}-${anio}_${hora}-${minuto}-${segundo}`;
      };

      // 2. Procesamos el mapeo de los datos
      const dataParaExcel = reportesFiltrados.map((item: any) => {
        return {
          ID: item.id_ocurrencia,
          MARCA_TEMPORAL: formatearFechaReporteCompleta(item.fecha_reporte),
          DNI_SERENO: limpiarTextoExcel(item.persona_dni),
          APELLIDOS_NOMBRES: limpiarTextoExcel(item.persona_nombre_completo),
          ORIGEN: limpiarTextoExcel(item.origen_descripcion),
          TIPO_PATRULLAJE: limpiarTextoExcel(item.tipo_patrullaje_nombre),
          MODALIDAD_PATRULLAJE: limpiarTextoExcel(item.mod_patrullaje_nombre),
          TIPO_UNIDAD: limpiarTextoExcel(item.vehiculo_tipo),
          DATOS_EFECTIVO: limpiarTextoExcel(item.pnp_datos),
          PLACA: limpiarTextoExcel(item.vehiculo_placa),
          TURNO: limpiarTextoExcel(item.turnr),
          HORA_ALERTA: limpiarHora(item.hora_alerta),
          HORA_LLEGADA: limpiarHora(item.hora_llegada),
          HORA_REPLIEGUE: limpiarHora(item.hora_repliegue),
          FECHA_OCURRENCIA: formatearFechaExcel(item.fecha_evento),
          CODIGO: limpiarTextoExcel(item.codmod),
          MODALIDAD: limpiarTextoExcel(item.modalidad_nombre),
          RESULTADO: limpiarTextoExcel(item.resultado_des),
          CONSECUENCIA: limpiarTextoExcel(item.consecuencia_des),
          LUGAR: limpiarTextoExcel(item.lugar_des),
          MEDIO: limpiarTextoExcel(item.medio_des),
          DIRECCIÓN_CONSOLIDADA: limpiarTextoExcel(item.nombre_lugar),
          REFERENCIA: limpiarTextoExcel(item.referencia),
          DATOS_IMPORTANTES: limpiarTextoExcel(item.ocurrencia_descripcion),
          VICTIMA_NOMBRE: limpiarTextoExcel(item.victimas_nombres),
          VICTIMA_EDAD: limpiarTextoExcel(item.victimas_edades),
          VICTIMA_PLACA: limpiarTextoExcel(item.victimas_placas),
          RELACION_CON_AGRESOR: limpiarTextoExcel(item.victimas_relacion),
          AGRESOR_NOMBRE: limpiarTextoExcel(item.agresores_nombres),
          AGRESOR_EDAD: limpiarTextoExcel(item.agresores_edades),
          AGRESOR_PLACA: limpiarTextoExcel(item.agresores_placas),
          NUMERO_DOCUMENTO: item.codigo_seguimiento
            ? `${limpiarTextoExcel(item.codigo_seguimiento)}MDJM-GSC-SGS`
            : "",
          ESTADO: limpiarTextoExcel(item.estado),
        };
      });

      // Pausa corta para estabilidad visual del modal con grandes volúmenes
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 3. Generación y descarga del archivo Excel
      const ws = XLSX.utils.json_to_sheet(dataParaExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sipcop_Operativo");
      XLSX.writeFile(wb, `Reporte_Sipcop_${obtenerTimestampArchivo()}.xlsx`);
    } catch (error) {
      console.error("Error al exportar el reporte SIPCOP:", error);
    } finally {
      // 4. Ocultar el modal de carga de manera segura
      setCargandoExcel(false);
    }
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
              fontSize: "20px",
            }}
          >
            REPORTE FORMATO:
          </h2>
          <button
            onClick={exportarExcel}
            style={{ ...styles.btnExport, backgroundColor: MJM_BLUE }}
          >
            <Ionicons name="document-text" size={16} color="white" />
          </button>

          <h2
            style={{
              color: MJM_BLUE,
              margin: 0,
              fontWeight: 700,
              fontSize: "20px",
            }}
          >
            SIPCOP-M :
          </h2>

          <button
            onClick={exportarSipcop}
            style={{ ...styles.btnExport, backgroundColor: MJM_BLUE }}
          >
            <Ionicons name="document-text" size={16} color="white" />
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
          {/* CAJA 2: BLOQUE DE FECHAS DE REPORTE (Desde izq / Hasta der) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {" "}
            {/* gap aumentado de 6px a 8px */}
            <label
              style={{
                ...styles.filterLabel,
                fontSize: "13px",
                fontWeight: "bold",
              }}
            >
              FECHA DE REGISTRO:
            </label>{" "}
            {/* Fuente de etiqueta más grande */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: "12px" /* Separación entre inputs aumentada de 8px a 12px */,
                alignItems: "center",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <input
                  type="date"
                  value={fechaReporteInicio}
                  onChange={(e) => {
                    setFechaReporteInicio(e.target.value);
                    setPaginaActual(1);
                  }}
                  style={{
                    ...styles.inputDate,
                    width: "160px" /* Ancho aumentado de 135px a 160px */,
                    fontSize: "13px" /* Fuente de la fecha más grande */,
                    padding:
                      "6px 8px" /* Relleno interno para darle más volumen al input */,
                  }}
                />
              </div>
              <label
                style={{
                  ...styles.filterLabel,
                  fontSize: "16px",
                  fontWeight: "bold",
                  paddingBottom: "4px",
                }}
              >
                -
              </label>{" "}
              {/* Separador más grande */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <input
                  type="date"
                  value={fechaReporteFin}
                  onChange={(e) => {
                    setFechaReporteFin(e.target.value);
                    setPaginaActual(1);
                  }}
                  style={{
                    ...styles.inputDate,
                    width: "160px" /* Ancho aumentado de 135px a 160px */,
                    fontSize: "13px" /* Fuente de la fecha más grande */,
                    padding:
                      "6px 8px" /* Relleno interno para darle más volumen al input */,
                  }}
                />
              </div>
            </div>
          </div>

          {/* CAJA 1: BLOQUE DE FECHAS DE EVENTO (Desde izq / Hasta der) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {" "}
            {/* gap aumentado a 8px */}
            <label
              style={{
                ...styles.filterLabel,
                fontSize: "13px",
                fontWeight: "bold",
              }}
            >
              FECHA DE OCURRENCIA:
            </label>{" "}
            {/* Etiqueta más grande */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: "12px" /* Separación aumentada a 12px */,
                alignItems: "center",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => {
                    setFechaInicio(e.target.value);
                    setPaginaActual(1);
                  }}
                  style={{
                    ...styles.inputDate,
                    width: "160px" /* Ancho aumentado a 160px */,
                    fontSize: "13px" /* Letra de fecha más grande */,
                    padding: "6px 8px" /* Padding para dar volumen */,
                  }}
                />
              </div>
              <label
                style={{
                  ...styles.filterLabel,
                  fontSize: "16px",
                  fontWeight: "bold",
                  paddingBottom: "4px",
                }}
              >
                -
              </label>{" "}
              {/* Guion como separador más grande */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => {
                    setFechaFin(e.target.value);
                    setPaginaActual(1);
                  }}
                  style={{
                    ...styles.inputDate,
                    width: "160px" /* Ancho aumentado a 160px */,
                    fontSize: "13px" /* Letra de fecha más grande */,
                    padding: "6px 8px" /* Padding para dar volumen */,
                  }}
                />
              </div>
            </div>
          </div>

          {/* CONTENEDOR DERECHO (Modalidades + Estados + Limpiar Todo) */}
          <div style={{ ...styles.filterRightContainer, gap: "8px" }}>
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
                        color: "#024885",
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
                          <span style={{ fontSize: "10px", color: "#1e293b" }}>
                            {mod}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* DESPLEGABLE COMPACTO DE ESTADOS */}
            <div
              id="dropdown-estados-container"
              style={styles.dropdownContainer}
            >
              <button
                onClick={() => setDropdownEstadosOpen(!dropdownEstadosOpen)}
                style={styles.dropdownButton}
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

              {dropdownEstadosOpen && (
                <div style={styles.dropdownMenu}>
                  <div style={styles.dropdownHeaderMenu}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#024885",
                      }}
                    >
                      SELECCIONAR ESTADO
                    </span>
                    {estadosSeleccionados.length > 0 && (
                      <button
                        onClick={() => setEstadosSeleccionados([])}
                        style={styles.btnClearSelection}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div style={styles.dropdownListScroll}>
                    {listaEstadosDisponibles.map((st) => {
                      const seleccionado = estadosSeleccionados.includes(st);
                      return (
                        <label key={st} style={styles.dropdownCheckboxItem}>
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            onChange={() => toggleEstadoFiltro(st)}
                            style={{ cursor: "pointer" }}
                          />
                          <span style={{ fontSize: "10px", color: "#1e293b" }}>
                            {st}
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
              fechaReporteInicio ||
              fechaReporteFin ||
              modalidadesSeleccionadas.length > 0 ||
              estadosSeleccionados.length > 0) && (
              <button
                onClick={() => {
                  setFechaInicio("");
                  setFechaFin("");
                  setFechaReporteInicio("");
                  setFechaReporteFin("");
                  setModalidadesSeleccionadas([]);
                  setEstadosSeleccionados([]);
                  setPaginaActual(1);
                }}
                style={{
                  ...styles.btnClearFilters,
                  visibility:
                    fechaInicio ||
                    fechaFin ||
                    fechaReporteInicio ||
                    fechaReporteFin ||
                    modalidadesSeleccionadas.length > 0 ||
                    estadosSeleccionados.length > 0
                      ? "visible"
                      : "hidden",
                  opacity:
                    fechaInicio ||
                    fechaFin ||
                    fechaReporteInicio ||
                    fechaReporteFin ||
                    modalidadesSeleccionadas.length > 0 ||
                    estadosSeleccionados.length > 0
                      ? 1
                      : 0,
                  transition: "opacity 0.2s ease-in-out",
                  cursor: "pointer",
                }}
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
                    width: "4%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  N°
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "14%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  MARCA TEMPORAL
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "11.5%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  DATOS IMPORTANTES
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "14%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  MODALIDAD
                </th>

                <th
                  style={{
                    ...styles.th,
                    width: "7%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  FECHA
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
                    width: "5%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  LUGAR
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "5%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  MEDIO
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "7%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  RESULTADO
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "7%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  CONSECUENCIA
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
              {datosPaginados.map((item) => (
                <tr
                  key={item.id_ocurrencia}
                  className="fila-tabla-operativa"
                  style={styles.tr}
                  onClick={() => setDetalleSeleccionado(item)}
                >
                  {/* Celda N° */}
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

                  {/* Celda Fecha Registro */}
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
                              const hora = fechaObj.toLocaleTimeString(
                                "es-PE",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                },
                              );
                              return `${diaSemana} ${fechaNumerica} - ${hora}`;
                            })()
                          : item.fecha_evento || "S/F"}
                      </div>
                    </div>
                  </td>

                  {/* DI (Datos Importantes) */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          ...styles.txtB,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1,
                        }}
                        title={item.ocurrencia_descripcion || "---"}
                      >
                        {item.ocurrencia_descripcion || "---"}
                      </div>

                      {(() => {
                        let fotosArray: any[] = [];
                        try {
                          const itemData = item as any;
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
                          fotosArray = (item as any).foto_principal
                            ? [(item as any).foto_principal]
                            : [];
                        }

                        const totalFotos = Array.isArray(fotosArray)
                          ? fotosArray.length
                          : 0;
                        if (totalFotos === 0) return null;

                        return (
                          <span
                            style={{
                              color: "#024885",
                              fontWeight: "700",
                              fontSize: "12px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ({totalFotos}f)
                          </span>
                        );
                      })()}
                    </div>
                  </td>

                  {/* Celda Modalidad */}
                  {/* Celda Modalidad */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      maxWidth: "300px", // Aumentado para que los textos medianos entren bien
                    }}
                  >
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor: "#f1f5f9",
                        color: "#475569",
                        fontWeight: "700",
                        display: "-webkit-box",
                        WebkitLineClamp: "2", // Máximo 2 líneas por si hay textos largos
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        wordBreak: "break-word",
                      }}
                      title={item.modalidad_nombre}
                    >
                      {item.modalidad_nombre}
                    </span>
                  </td>
                  {/* FECHA EVENTO*/}
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
                      title={item.fecha_evento}
                    >
                      {item.fecha_evento
                        ? (() => {
                            // Extraemos directamente los primeros 10 caracteres (YYYY-MM-DD) sin problemas de zona horaria
                            const fechaStr = String(
                              item.fecha_evento,
                            ).substring(0, 10);
                            const [anio, mes, dia] = fechaStr.split("-");
                            if (!anio || !mes || !dia) return item.fecha_evento;
                            return `${dia}/${mes}/${anio}`;
                          })()
                        : "S/F"}
                    </div>
                  </td>
                  {/* CELDA: Víctima */}
                  {/* CELDA: Víctima */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      overflow: "hidden",
                      // --- ESTILOS CON EL COLOR #024885 ---
                      backgroundColor: "#e8f5fd", // Fondo azul pastel muy suave derivado de tu color
                      borderLeft: "3px solid #024885", // Línea lateral con tu color exacto
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
                        title={
                          item.edad_victima ? `Edad: ${item.edad_victima}` : ""
                        }
                      >
                        {item.edad_victima ? `Edad: ${item.edad_victima}` : ""}
                      </div>
                    </div>
                  </td>

                  {/* CELDA: Agresor */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      overflow: "hidden",
                      backgroundColor: "#e8f5fd", // Fondo azul pastel muy suave derivado de tu color
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
                        title={`${item.edad_agresor ? `Edad: ${item.edad_agresor}` : ""} ${item.placa_agresor ? `Placa: ${item.placa_agresor}` : ""}`}
                      >
                        {item.edad_agresor ? `Edad: ${item.edad_agresor}` : ""}{" "}
                        {item.placa_agresor
                          ? `Placa: ${item.placa_agresor}`
                          : ""}
                      </div>
                    </div>
                  </td>

                  {/* CELDA: Lugar Evento */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      backgroundColor: "#e8f5fd", // Fondo azul pastel muy suave derivado de tu color
                      borderLeft: "3px solid #024885", // Línea lateral con tu color exacto
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
                      title={item.lugar_des || "---"}
                    >
                      {item.lugar_des || "---"}
                    </div>
                  </td>

                  {/* CELDA: Medio */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      overflow: "hidden",
                      backgroundColor: "#e8f5fd", // Fondo azul pastel muy suave derivado de tu color
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
                      title={item.medio_des || "---"}
                    >
                      {item.medio_des || "---"}
                    </div>
                  </td>

                  {/* CELDA: Resultado */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      backgroundColor: "#e8f5fd", // Fondo azul pastel muy suave derivado de tu color
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
                      title={item.resultado_des || "---"}
                    >
                      {item.resultado_des || "---"}
                    </div>
                  </td>

                  {/* CELDA: Consecuencia */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      backgroundColor: "#e8f5fd", // Fondo azul pastel muy suave derivado de tu color
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
                      title={item.consecuencia_des || "---"}
                    >
                      {item.consecuencia_des || "---"}
                    </div>
                  </td>

                  {/* CELDA: Patrimonio */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      backgroundColor: "#e8f5fd", // Fondo azul pastel muy suave derivado de tu color
                      borderLeft: "3px solid #024885", // Línea lateral con tu color exacto
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

                  {/* CELDA: Arresto Ciudadano */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      backgroundColor: "#e8f5fd", // Fondo azul pastel muy suave derivado de tu color
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

                  {/* CELDA: Estado */}
                  <td
                    style={{
                      ...styles.td,
                      borderRight: "1px solid #e2e8f0",
                      borderLeft: "3px solid #024885", // Línea lateral con tu color exacto
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
                          const estado = String(
                            item.estado || "",
                          ).toUpperCase();
                          if (estado.includes("SIPCOP")) return "#024885";
                          if (estado.includes("VERIFICADO")) return "#16a34a";
                          if (estado.includes("ANULADO")) return "#dc2626";
                          return "#f1f5f9";
                        })(),
                        color: (() => {
                          const estado = String(
                            item.estado || "",
                          ).toUpperCase();
                          if (estado.includes("SIPCOP")) return "white";
                          if (estado.includes("VERIFICADO")) return "white";
                          if (estado.includes("ANULADO")) return "white";
                          return "#475569";
                        })(),
                        fontWeight: "700",
                      }}
                      title={item.estado || "---"}
                    >
                      {item.estado || "---"}
                    </span>
                  </td>

                  {/* Celda Editar */}
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
                        fetchLugares();
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
              ))}
              {datosPaginados.length === 0 && (
                <tr>
                  <td
                    colSpan={14}
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
          {/* Resumen por Estados */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginRight: "auto",
            }}
          >
            {/* Selector de registros por página */}
            <span
              style={{ fontSize: "10px", color: "#475569", fontWeight: "600" }}
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

            {/* Total encontrados */}
            <span
              style={{ fontSize: "12px", color: "#024885", marginLeft: "10px" }}
            >
              Total encontrados: <strong>{reportesFiltrados.length}</strong>
            </span>

            {/* Contadores con orden fijo y estilo diferenciado */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                flexWrap: "wrap",
                marginLeft: "8px",
              }}
            >
              {(() => {
                const conteos = reportesFiltrados.reduce(
                  (acc, item) => {
                    const estado = String(
                      item.estado || "SIN ESTADO",
                    ).toUpperCase();
                    acc[estado] = (acc[estado] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>,
                );

                const ordenEstados = [
                  "PENDIENTE",
                  "SIPCOP",
                  "VERIFICADO",
                  "ANULADO",
                ];

                return Object.keys(conteos)
                  .sort((a, b) => {
                    const indexA =
                      ordenEstados.indexOf(a) === -1
                        ? 99
                        : ordenEstados.indexOf(a);
                    const indexB =
                      ordenEstados.indexOf(b) === -1
                        ? 99
                        : ordenEstados.indexOf(b);
                    return indexA - indexB;
                  })
                  .map((estado) => {
                    const cantidad = conteos[estado];

                    // Estilo condicional: PENDIENTE resalta, los otros corporativos
                    const isPendiente = estado === "PENDIENTE";

                    return (
                      <span
                        key={estado}
                        style={{
                          fontSize: "12px",
                          // Naranja para pendiente, Azul corporativo para los demás
                          backgroundColor: isPendiente
                            ? "#46464688"
                            : "#024885",
                          color: "#ffffff",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontWeight: "600",
                          border: "1px solid rgba(0,0,0,0.1)",
                        }}
                      >
                        {estado}: <strong>{cantidad}</strong>
                      </span>
                    );
                  });
              })()}
            </div>
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
                N° de Ocurrencia:{" "}
                {detalleSeleccionado.codigo_seguimiento
                  ? `${detalleSeleccionado.codigo_seguimiento}-SGS-GSC`
                  : "---"}
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
              {/* CONTENEDOR GRID PRINCIPAL DE 2 COLUMNAS */}
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
                      {detalleSeleccionado.hora_alerta
                        ? String(detalleSeleccionado.hora_alerta).substring(
                            0,
                            5,
                          )
                        : "S/H"}{" "}
                      /{" "}
                      {detalleSeleccionado.hora_llegada
                        ? String(detalleSeleccionado.hora_llegada).substring(
                            0,
                            5,
                          )
                        : "S/H"}{" "}
                      /{" "}
                      {detalleSeleccionado.hora_repliegue
                        ? String(detalleSeleccionado.hora_repliegue).substring(
                            0,
                            5,
                          )
                        : "S/H"}
                    </span>
                  </div>

                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Ubicación / Lugar:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.nombre_lugar || "---"}
                      <span style={{ color: "#64748b", fontSize: "12px" }}>
                        {" "}
                        (Ref:{" "}
                        {detalleSeleccionado.referencia || "Sin referencia"})
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
                    <span style={styles.infoLabel}>Lugar (Des):</span>
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

                {/* 4. SIPCOP (Contacto y Derivación) */}
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
                        {detalleSeleccionado.unidad_encargada || "S/H"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. VÍCTIMA (Columna Izquierda dentro de Involucrados o bloque independiente a la izquierda) */}
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
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
                      letterSpacing: "0.5px",
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
                      <span
                        style={{
                          color: "#64748b",
                          fontWeight: "600",
                          display: "block",
                          marginBottom: "2px",
                        }}
                      >
                        Nombres:
                      </span>
                      <span
                        style={{
                          color: "#1e293b",
                          whiteSpace: "pre-line",
                          display: "block",
                          paddingLeft: "6px",
                          borderLeft: "2px solid #e2e8f0",
                        }}
                      >
                        {detalleSeleccionado.victimas_nombres || "---"}
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          color: "#64748b",
                          fontWeight: "600",
                          display: "block",
                          marginBottom: "2px",
                        }}
                      >
                        Edad(es):
                      </span>
                      <span
                        style={{
                          color: "#1e293b",
                          whiteSpace: "pre-line",
                          display: "block",
                          paddingLeft: "6px",
                          borderLeft: "2px solid #e2e8f0",
                        }}
                      >
                        {detalleSeleccionado.victimas_edades || "---"}
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          color: "#64748b",
                          fontWeight: "600",
                          display: "block",
                          marginBottom: "2px",
                        }}
                      >
                        Placa(s):
                      </span>
                      <span
                        style={{
                          color: "#1e293b",
                          whiteSpace: "pre-line",
                          display: "block",
                          paddingLeft: "6px",
                          borderLeft: "2px solid #e2e8f0",
                        }}
                      >
                        {detalleSeleccionado.victimas_placas || "---"}
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          color: "#64748b",
                          fontWeight: "600",
                          display: "block",
                          marginBottom: "2px",
                        }}
                      >
                        Relación c/ Agresor:
                      </span>
                      <span
                        style={{
                          color: "#1e293b",
                          whiteSpace: "pre-line",
                          display: "block",
                          paddingLeft: "6px",
                          borderLeft: "2px solid #e2e8f0",
                        }}
                      >
                        {detalleSeleccionado.victimas_relacion || "---"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6. AGRESOR (Columna Derecha directa a la par de Víctimas) */}
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
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
                      letterSpacing: "0.5px",
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
                      <span
                        style={{
                          color: "#64748b",
                          fontWeight: "600",
                          display: "block",
                          marginBottom: "2px",
                        }}
                      >
                        Nombres:
                      </span>
                      <span
                        style={{
                          color: "#1e293b",
                          whiteSpace: "pre-line",
                          display: "block",
                          paddingLeft: "6px",
                          borderLeft: "2px solid #e2e8f0",
                        }}
                      >
                        {detalleSeleccionado.agresores_nombres || "---"}
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          color: "#64748b",
                          fontWeight: "600",
                          display: "block",
                          marginBottom: "2px",
                        }}
                      >
                        Edad(es):
                      </span>
                      <span
                        style={{
                          color: "#1e293b",
                          whiteSpace: "pre-line",
                          display: "block",
                          paddingLeft: "6px",
                          borderLeft: "2px solid #e2e8f0",
                        }}
                      >
                        {detalleSeleccionado.agresores_edades || "---"}
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          color: "#64748b",
                          fontWeight: "600",
                          display: "block",
                          marginBottom: "2px",
                        }}
                      >
                        Placa(s):
                      </span>
                      <span
                        style={{
                          color: "#1e293b",
                          whiteSpace: "pre-line",
                          display: "block",
                          paddingLeft: "6px",
                          borderLeft: "2px solid #e2e8f0",
                        }}
                      >
                        {detalleSeleccionado.agresores_placas || "---"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DESCRIPCIÓN / SUCESO */}
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
                  {detalleSeleccionado.ocurrencia_descripcion ||
                    "Sin descripción detallada."}
                </div>
              </div>

              {/* EVIDENCIAS FOTOGRÁFICAS */}
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
                      [
                        itemData.foto_1,
                        itemData.foto_2,
                        itemData.foto_3,
                        itemData.foto_4,
                      ].filter(Boolean);
                } catch (e) {
                  fotosArray = [
                    detalleSeleccionado.foto_1,
                    detalleSeleccionado.foto_2,
                    detalleSeleccionado.foto_3,
                    detalleSeleccionado.foto_4,
                  ].filter(Boolean);
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
                              : foto?.url_imagen || foto?.url || "";

                          if (!urlFoto) return null;

                          return (
                            <div
                              key={idx}
                              style={{
                                position: "relative",
                                display: "inline-block",
                              }}
                            >
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
        <div
          style={{
            ...styles.overlay,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={() => setRegistroEditar(null)}
        >
          <div
            style={{
              ...styles.modalDetail,
              width: "calc(100vw - 265px)", // Ocupa el ancho restante exacto restando la barra lateral
              maxWidth: "1750px", // Evita que en pantallas gigantes se estire de más
              height: "92vh",
              marginLeft: "250px", // Respeta exactamente el ancho de tu sidebar
              marginRight: "1px",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
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

            {/* CONTENEDOR DE LAS 4 VENTANAS PRINCIPALES */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(300px, 1fr))",
                gap: "20px",
                flex: 1,
                minHeight: "80vh",
                overflowY: "auto",
                padding: "15px",
              }}
            >
              {/* =================================================== */}
              {/* VENTANA 1: DESCRIPCIÓN DE LA OCURRENCIA             */}
              {/* =================================================== */}
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
                {/* Descripción de la ocurrencia */}
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
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: "4px",
                    marginTop: "8px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "11px",
                      color: "#024885",
                      fontWeight: "bold",
                    }}
                  >
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
                      height: "360px",
                      minHeight: "360px",
                      backgroundColor: "#ffffff", // Mantiene el fondo blanco normal
                      color: "#334155", // Color de texto normal y legible
                      cursor: "text", // Cambia el cursor a modo selección de texto
                      outline: "none", // Evita bordes molestos al hacer clic
                    }}
                    value={registroEditar.ocurrencia_descripcion ?? ""}
                  />
                </div>

                {/* Referencia */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginTop: "8px",
                  }}
                >
                  {/* Dirección (nombre_lugar) - Bloqueado */}
                  <div>
                    <label
                      style={{
                        fontSize: "11px",
                        color: "#024885",
                        fontWeight: "bold",
                      }}
                    >
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
                      placeholder="DIRECCIÓN"
                      value={registroEditar?.nombre_lugar ?? ""}
                    />
                  </div>

                  {/* Referencia - Bloqueado */}
                  <div>
                    <label
                      style={{
                        fontSize: "11px",
                        color: "#024885",
                        fontWeight: "bold",
                      }}
                    >
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
                        height: "80px",
                        minHeight: "80px",
                        backgroundColor: "#f1f5f9",
                        color: "#64748b",
                        cursor: "not-allowed",
                      }}
                      placeholder="REFERENCIA"
                      value={registroEditar?.referencia ?? ""}
                    />
                  </div>
                </div>

                {/* Sección de Evidencias / Fotos */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                  }}
                >
                  {(() => {
                    const fotosArray =
                      (registroEditar as any).lista_fotos || [];

                    const eliminarFoto = (indexAEliminar: number) => {
                      const nuevasFotos = fotosArray.filter(
                        (_: any, i: number) => i !== indexAEliminar,
                      );
                      setRegistroEditar((prev: any) => ({
                        ...prev,
                        lista_fotos: nuevasFotos,
                      }));
                    };

                    const handleFileChange = (
                      e: React.ChangeEvent<HTMLInputElement>,
                    ) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;

                      const totalActual = fotosArray.length;
                      const espacioDisponible = 4 - totalActual;

                      if (espacioDisponible <= 0) {
                        alert("Ya has alcanzado el límite máximo de 4 fotos.");
                        return;
                      }

                      const archivosAProcesar = Array.from(files).slice(
                        0,
                        espacioDisponible,
                      );

                      archivosAProcesar.forEach((file) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          const nuevaFotoItem = {
                            url_imagen: base64String,
                            archivo_real: file,
                          };

                          setRegistroEditar((prev: any) => ({
                            ...prev,
                            lista_fotos: [
                              ...(prev.lista_fotos || []),
                              nuevaFotoItem,
                            ],
                          }));
                        };
                        reader.readAsDataURL(file);
                      });

                      if (files.length > espacioDisponible) {
                        alert(
                          `Solo se pudieron agregar ${espacioDisponible} foto(s) más para respetar el límite máximo de 4.`,
                        );
                      }

                      e.target.value = "";
                    };

                    return (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "4px",
                          }}
                        >
                          <label
                            style={{
                              fontSize: "10px",
                              color: "#024885",
                              fontWeight: "bold",
                            }}
                          >
                            EVIDENCIAS ({fotosArray.length} / 4)
                          </label>
                        </div>

                        <div
                          style={{
                            padding: "10px",
                            flex: 1,
                            overflowY: "auto",
                          }}
                        >
                          <input
                            type="file"
                            id="fileInputEvidencias"
                            style={{ display: "none" }}
                            accept="image/*"
                            multiple
                            onChange={handleFileChange}
                          />

                          {/* Contenedor en Cuadrícula 2x2 */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, 1fr)",
                              gap: "8px",
                            }}
                          >
                            {fotosArray.map((foto: any, index: number) => {
                              const urlFoto =
                                typeof foto === "string"
                                  ? foto
                                  : foto.url_imagen || foto.url;

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
                              );
                            })}
                          </div>

                          <style>{`
                          .link-evidencia-edicion:hover + .tooltip-miniatura-edicion,
                          .tooltip-miniatura-edicion:hover {
                            display: block !important;
                          }
                        `}</style>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* =================================================== */}
              {/* VENTANA 2: UBICACIÓN (DIRECCIÓN Y REFERENCIA)       */}
              {/* =================================================== */}
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "22px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  width: "100%",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    textAlign: "center", // <--- Añade esto para centrar el texto
                    color: "#024885",
                    fontWeight: "bold",
                    borderBottom: "2px solid #e2e8f0",
                    paddingBottom: "6px",
                  }}
                >
                  2. MODALIDAD
                </div>

                {/* MODALIDAD con margen inferior para evitar solapamiento del dropdown */}
                <div
                  style={{
                    width: "100%",
                    minWidth: 0,
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      zIndex: 99999,
                      overflow: "visible",
                      width: "100%",
                      maxWidth: 550,
                      minWidth: 0,
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Dropdown
                      containerStyle={{
                        ...styles.dropdownContainer,
                        maxHeight: 180,
                        width: 505,
                      }}
                      itemTextStyle={[
                        styles.itemText,
                        {
                          color: "#000",
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      ]}
                      itemContainerStyle={{
                        ...styles.itemContainer,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                      }}
                      selectedTextProps={{ numberOfLines: 1 }}
                      selectedTextStyle={{
                        color: "#000",
                        fontSize: 12,
                        flex: 1,
                        minWidth: 0,
                        marginRight: 15,
                        textTransform: "uppercase",
                        overflow: "hidden"
                      
                      }}
                      style={[
                        styles.dropdown,
                        {
                          borderColor: registroEditar?.id_modalidad
                            ? "#024885"
                            : "#cbd5e1",
                          borderWidth: registroEditar?.id_modalidad ? 1.5 : 1,
                          backgroundColor: "#fff",
                          borderRadius: 4,
                          paddingHorizontal: 8,
                          height: 45,
                          width: "100%",
                          overflow: "hidden",
                        },
                      ]}
                      data={listaUbicaciones || []}
                      value={registroEditar?.id_modalidad ?? ""}
                      labelField="label"
                      valueField="value"
                      placeholder="SELECCIONE UNA MODALIDAD..."
                      placeholderStyle={{ color: "#666", fontSize: 12 }}
                      search
                      searchPlaceholder="Buscar modalidad..."
                      maxHeight={160}
                      searchQuery={(keyword: string, label: string) => {
                        const normalize = (text: string): string =>
                          text
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "");

                        const cleanLabel = normalize(label);
                        const cleanKeyword = normalize(keyword);
                        const keywords = cleanKeyword
                          .split(" ")
                          .filter((word) => word.length > 0);

                        return keywords.every((word) =>
                          cleanLabel.includes(word),
                        );
                      }}
                      onChange={(item) => {
                        const selectedId = item.value ?? item.id;
                        const selectedLabel = String(
                          item.label ?? item.nombre ?? "",
                        ).toUpperCase();

                        setRegistroEditar(
                          registroEditar
                            ? {
                                ...registroEditar,
                                id_modalidad: selectedId,
                                modalidad_nombre: selectedLabel,
                              }
                            : null,
                        );
                      }}
                      activeColor="#E3F2FD"
                      flatListProps={{
                        nestedScrollEnabled: true,
                        keyboardShouldPersistTaps: "handled",
                        style: { maxHeight: 140 },
                      }}
                      inputSearchStyle={{
                        height: 40,
                        fontSize: 14,
                        borderRadius: 8,
                        color: "#000",
                        paddingHorizontal: 10,
                        backgroundColor: "#F9F9F9",
                      }}
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
                {/* RESULTADO (Letras más grandes) */}
                <div style={{ width: "100%", minWidth: 0 }}>
                  <label
                    style={{
                      fontSize: "10px",
                      color: "#024885",
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    RESULTADO:
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "4px",
                      border: "1px solid #e2e8f0",
                      padding: "4px",
                      borderRadius: "4px",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {(listaResultados ?? []).map((item: any) => {
                      const val = item.value ?? item.id ?? item;
                      const label = String(
                        item.label ?? item.nombre ?? item,
                      ).toUpperCase();

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
                            setRegistroEditar(
                              registroEditar
                                ? {
                                    ...registroEditar,
                                    id_resultado: val,
                                    resultado_des: label,
                                  }
                                : null,
                            )
                          }
                          style={{
                            padding: "8px 6px", // Aumentado para dar espacio a la letra más grande
                            fontSize: "10px", // Letra más grande (antes 10px)
                            fontWeight: "500",
                            backgroundColor: seleccionado
                              ? "#024885"
                              : "#f8fafc",
                            color: seleccionado ? "#fff" : "#1e293b",
                            border: "1px solid",
                            borderColor: seleccionado ? "#024885" : "#cbd5e1",
                            borderRadius: "4px",
                            cursor: "pointer",
                            textAlign: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                          }}
                          title={label}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CONSECUENCIA (Letras más grandes) */}
                <div style={{ width: "100%", minWidth: 0 }}>
                  <label
                    style={{
                      fontSize: "10px",
                      color: "#024885",
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    CONSECUENCIA:
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "4px",
                      border: "1px solid #e2e8f0",
                      padding: "4px",
                      borderRadius: "4px",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {(listaConsecuencias ?? []).map((item: any) => {
                      const val = item.value ?? item.id ?? item;
                      const label = String(
                        item.label ?? item.nombre ?? item,
                      ).toUpperCase();

                      const idActual = registroEditar?.id_consecuencia;
                      const descActual = String(
                        registroEditar?.consecuencia_des ?? "",
                      )
                        .trim()
                        .toUpperCase();

                      const seleccionado =
                        (idActual !== undefined &&
                          idActual !== null &&
                          (idActual === val ||
                            String(idActual).trim() === String(val).trim() ||
                            Number(idActual) === Number(val))) ||
                        (descActual !== "" && descActual === label);

                      return (
                        <div
                          key={val}
                          onClick={() =>
                            setRegistroEditar(
                              registroEditar
                                ? {
                                    ...registroEditar,
                                    id_consecuencia: val,
                                    consecuencia_des: label,
                                  }
                                : null,
                            )
                          }
                          style={{
                            padding: "8px 6px",
                            fontSize: "10px", // Letra más grande
                            fontWeight: "500",
                            backgroundColor: seleccionado
                              ? "#024885"
                              : "#f8fafc",
                            color: seleccionado ? "#fff" : "#1e293b",
                            border: "1px solid",
                            borderColor: seleccionado ? "#024885" : "#cbd5e1",
                            borderRadius: "4px",
                            cursor: "pointer",
                            textAlign: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                          }}
                          title={label}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* LUGAR / UBISIPCOP (Letras más grandes) */}
                <label
                  style={{
                    fontSize: "10px",
                    color: "#024885",
                    fontWeight: "bold",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  LUGAR:
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "4px",
                    border: "1px solid #e2e8f0",
                    padding: "4px",
                    borderRadius: "4px",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  {(listaUbisipcop ?? []).map((item: any) => {
                    const val = item.value ?? item.id ?? item;
                    const label = String(
                      item.label ?? item.nombre ?? item,
                    ).toUpperCase();

                    const idActual = registroEditar?.id_lugarsip;
                    const descActual = String(registroEditar?.lugar_des ?? "")
                      .trim()
                      .toUpperCase();

                    const seleccionado =
                      (idActual !== undefined &&
                        idActual !== null &&
                        (idActual === val ||
                          String(idActual).trim() === String(val).trim() ||
                          Number(idActual) === Number(val))) ||
                      (descActual !== "" && descActual === label);

                    return (
                      <div
                        key={val}
                        onClick={() =>
                          setRegistroEditar(
                            registroEditar
                              ? {
                                  ...registroEditar,
                                  id_lugarsip: val,
                                  lugar_des: label,
                                }
                              : null,
                          )
                        }
                        style={{
                          padding: "8px 6px",
                          fontSize: "10px", // Letra más grande
                          fontWeight: "500",
                          backgroundColor: seleccionado ? "#024885" : "#f8fafc",
                          color: seleccionado ? "#fff" : "#1e293b",
                          border: "1px solid",
                          borderColor: seleccionado ? "#024885" : "#cbd5e1",
                          borderRadius: "4px",
                          cursor: "pointer",
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        }}
                        title={label}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>

                {/* MEDIOS (Letras más grandes) */}
                <div style={{ width: "100%", minWidth: 0 }}>
                  <label
                    style={{
                      fontSize: "11px",
                      color: "#024885",
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    MEDIO:
                  </label>
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
                    {(listaMedios ?? []).map((item: any) => {
                      const val = item.value ?? item.id ?? item;
                      const label = String(
                        item.label ?? item.nombre ?? item,
                      ).toUpperCase();

                      const idActual = registroEditar?.id_medio;
                      const descActual = String(registroEditar?.medio_des ?? "")
                        .trim()
                        .toUpperCase();

                      const seleccionado =
                        (idActual !== undefined &&
                          idActual !== null &&
                          (idActual === val ||
                            String(idActual).trim() === String(val).trim() ||
                            Number(idActual) === Number(val))) ||
                        (descActual !== "" && descActual === label);

                      return (
                        <div
                          key={val}
                          onClick={() =>
                            setRegistroEditar(
                              registroEditar
                                ? {
                                    ...registroEditar,
                                    id_medio: val,
                                    medio_des: label,
                                  }
                                : null,
                            )
                          }
                          style={{
                            padding: "8px 6px",
                            fontSize: "10px", // Letra más grande
                            fontWeight: "500",
                            backgroundColor: seleccionado
                              ? "#024885"
                              : "#f8fafc",
                            color: seleccionado ? "#fff" : "#1e293b",
                            border: "1px solid",
                            borderColor: seleccionado ? "#024885" : "#cbd5e1",
                            borderRadius: "4px",
                            cursor: "pointer",
                            textAlign: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
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

              {/* =================================================== */}
              {/* VENTANA 3: MODALIDAD                                */}
              {/* =================================================== */}
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "32px",
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
                  3. RESULTADOS Y EVIDENCIAS
                </div>

                {/* MOSAICO: IDENTIFICADO / NO IDENTIFICADO */}
                <div>
                  <label
                    style={{
                      fontSize: "10px",
                      color: "#024885",
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    ¿IDENTIFICADO?
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "4px",
                      border: "1px solid #e2e8f0",
                      padding: "4px",
                      borderRadius: "4px",
                    }}
                  >
                    {[
                      { id: "IDENTIFICADO", label: "IDENTIFICADO" },
                      { id: "NO_IDENTIFICADO", label: "NO IDENTIFICADO" },
                    ].map((item, index) => {
                      const tieneRegistros =
                        (registroEditar?.victimas?.length || 0) > 0 ||
                        (registroEditar?.agresores?.length || 0) > 0;

                      const estadoBruto = String(
                        (registroEditar as any)?.identificado || "",
                      )
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
                          key={`identificado-${item.id}-${index}`}
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
                            padding: "5px",
                            fontSize: "10px",
                            backgroundColor: seleccionado
                              ? "#024885"
                              : "#f8fafc",
                            color: seleccionado ? "#fff" : "#1e293b",
                            border: "1px solid",
                            borderColor: seleccionado ? "#024885" : "#cbd5e1",
                            borderRadius: "4px",
                            cursor:
                              tieneRegistros && item.id === "NO_IDENTIFICADO"
                                ? "not-allowed"
                                : "pointer",
                            textAlign: "center",
                            fontWeight: seleccionado ? "bold" : "normal",
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

                {/* SECCIONES CONDICIONALES */}
                {(() => {
                  const tieneRegistros =
                    (registroEditar?.victimas?.length || 0) > 0 ||
                    (registroEditar?.agresores?.length || 0) > 0;
                  const estadoBruto = String(
                    (registroEditar as any)?.identificado || "",
                  )
                    .trim()
                    .toUpperCase();
                  const mostrarSeccion =
                    tieneRegistros ||
                    estadoBruto === "IDENTIFICADO" ||
                    estadoBruto === "1" ||
                    estadoBruto === "TRUE";

                  return mostrarSeccion ? (
                    <>
                      {/* SECCIÓN VÍCTIMAS / IMPLICADOS */}
                      <div
                        style={{
                          marginTop: "10px",
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
                            VÍCTIMA(S) (
                            {(registroEditar?.victimas || []).length}/5)
                          </label>
                          {(registroEditar?.victimas || []).length < 5 && (
                            <button
                              type="button"
                              onClick={() => {
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
                                }));
                              }}
                              style={{
                                backgroundColor: "#024885",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "10px",
                                fontWeight: "bold",
                                cursor: "pointer",
                              }}
                            >
                              ➕ Agregar Víctima
                            </button>
                          )}
                        </div>

                        {(registroEditar?.victimas || []).length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {(registroEditar?.victimas || []).map(
                              (victima: any, index: number) => {
                                const nombreVictimaVal =
                                  victima?.nombre_victima ??
                                  victima?.nombre ??
                                  victima?.nombres ??
                                  "";
                                const placaVictimaVal =
                                  victima?.placa_victima ??
                                  victima?.placa ??
                                  "";
                                const edadVal = victima?.edad ?? "";
                                const relacionVal =
                                  victima?.id_relacion_v ??
                                  victima?.relacion ??
                                  2;

                                return (
                                  <div
                                    key={`victima-${victima?.id ?? index}`}
                                    style={{
                                      backgroundColor: "#f8fafc",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "6px",
                                      padding: "8px",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "6px",
                                      boxSizing: "border-box", // Previene que el padding expanda el div
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "6px",
                                        alignItems: "center",
                                        width: "100%", // Asegura usar solo el ancho disponible
                                      }}
                                    >
                                      <input
                                        type="text"
                                        placeholder="NOMBRE VÍCTIMA O DNI"
                                        style={{
                                          flex: "2 1 0%", // Permite crecer y encoger proporcionalmente
                                          minWidth: 0, // CLAVE: evita que el input desborde el flex
                                          padding: "5px",
                                          fontSize: "10px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "4px",
                                          textTransform: "uppercase",
                                          boxSizing: "border-box",
                                        }}
                                        value={nombreVictimaVal}
                                        onChange={(e) => {
                                          const val =
                                            e.target.value.toUpperCase();
                                          setRegistroEditar((prev: any) => {
                                            const nuevas = [
                                              ...(prev.victimas || []),
                                            ];
                                            nuevas[index] = {
                                              ...nuevas[index],
                                              nombre_victima: val,
                                            };
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
                                        style={{
                                          flex: "1 1 0%",
                                          minWidth: 0, // CLAVE: evita desbordamiento
                                          padding: "5px",
                                          fontSize: "10px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "4px",
                                          textTransform: "uppercase",
                                          boxSizing: "border-box",
                                        }}
                                        value={placaVictimaVal}
                                        onChange={(e) => {
                                          const val =
                                            e.target.value.toUpperCase();
                                          setRegistroEditar((prev: any) => {
                                            const nuevas = [
                                              ...(prev.victimas || []),
                                            ];
                                            nuevas[index] = {
                                              ...nuevas[index],
                                              placa_victima: val,
                                            };
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
                                        style={{
                                          width: "45px",
                                          flexShrink: 0, // Evita que se encoja de más
                                          minWidth: 0,
                                          padding: "5px",
                                          fontSize: "10px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "4px",
                                          textAlign: "center",
                                          boxSizing: "border-box",
                                        }}
                                        value={edadVal}
                                        onChange={(e) => {
                                          const val = e.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 3);
                                          setRegistroEditar((prev: any) => {
                                            const nuevas = [
                                              ...(prev.victimas || []),
                                            ];
                                            nuevas[index] = {
                                              ...nuevas[index],
                                              edad: val,
                                            };
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
                                        onClick={() => {
                                          setRegistroEditar((prev: any) => {
                                            const nuevas = (
                                              prev.victimas || []
                                            ).filter(
                                              (_: any, i: number) =>
                                                i !== index,
                                            );
                                            return {
                                              ...prev,
                                              victimas: nuevas,
                                            };
                                          });
                                        }}
                                        style={{
                                          flexShrink: 0, // Mantiene su tamaño fijo
                                          width: "26px", // Botón cuadrado
                                          height: "26px", // Botón cuadrado
                                          backgroundColor: "#fee2e2",
                                          color: "#dc2626",
                                          border: "1px solid #fca5a5",
                                          borderRadius: "4px",
                                          padding: 0, // Sin padding para alinear perfectamente la X
                                          cursor: "pointer",
                                          fontSize: "14px", // Un poco más grande para mejor visibilidad
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          boxSizing: "border-box",
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>

                                    <div>
                                      <span
                                        style={{
                                          fontSize: "9px",
                                          color: "#64748b",
                                          fontWeight: "bold",
                                          display: "block",
                                          marginBottom: "2px",
                                        }}
                                      >
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
                                          boxSizing: "border-box", // Previene desbordes
                                        }}
                                        value={relacionVal}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setRegistroEditar((prev: any) => {
                                            const nuevas = [
                                              ...(prev.victimas || []),
                                            ];
                                            nuevas[index] = {
                                              ...nuevas[index],
                                              id_relacion_v: val,
                                            };
                                            return {
                                              ...prev,
                                              identificado: "IDENTIFICADO",
                                              victimas: nuevas,
                                            };
                                          });
                                        }}
                                      >
                                        {(listaRelaciones ?? []).map(
                                          (itemRel: any, idxRel: number) => {
                                            const valRel =
                                              itemRel.value ??
                                              itemRel.id ??
                                              itemRel;
                                            const labelRel = String(
                                              itemRel.label ??
                                                itemRel.nombre ??
                                                itemRel,
                                            ).toUpperCase();
                                            return (
                                              <option
                                                key={`rel-vic-${valRel}-${idxRel}`}
                                                value={valRel}
                                              >
                                                {labelRel}
                                              </option>
                                            );
                                          },
                                        )}
                                      </select>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}
                      </div>

                      {/* SECCIÓN AGRESOR / IMPLICADOS */}
                      <div
                        style={{
                          marginTop: "10px",
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
                            AGRESOR(ES) (
                            {(registroEditar?.agresores || []).length}/5)
                          </label>
                          {(registroEditar?.agresores || []).length < 5 && (
                            <button
                              type="button"
                              onClick={() => {
                                setRegistroEditar((prev: any) => ({
                                  ...prev,
                                  identificado: "IDENTIFICADO",
                                  agresores: [
                                    ...(prev?.agresores || []),
                                    {
                                      nombre_agresor: "",
                                      placa_agresor: "",
                                      edad: "",
                                    },
                                  ],
                                }));
                              }}
                              style={{
                                backgroundColor: "#024885",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "10px",
                                fontWeight: "bold",
                                cursor: "pointer",
                              }}
                            >
                              ➕ Agregar Agresor
                            </button>
                          )}
                        </div>

                        {(registroEditar?.agresores || []).length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {(registroEditar?.agresores || []).map(
                              (agresor: any, index: number) => {
                                const nombreAgresorVal =
                                  agresor?.nombre_agresor ??
                                  agresor?.nombre ??
                                  agresor?.nombres ??
                                  "";
                                const placaAgresorVal =
                                  agresor?.placa_agresor ??
                                  agresor?.placa ??
                                  "";
                                const edadAgresorVal = agresor?.edad ?? "";

                                return (
                                  <div
                                    key={`agresor-${agresor?.id ?? index}`}
                                    style={{
                                      backgroundColor: "#f8fafc",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "6px",
                                      padding: "8px",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "6px",
                                      boxSizing: "border-box", // Previene que el padding expanda el div
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "6px",
                                        alignItems: "center",
                                        width: "100%", // Asegura usar solo el ancho disponible
                                      }}
                                    >
                                      <input
                                        type="text"
                                        placeholder="NOMBRE AGRESOR O DNI"
                                        style={{
                                          flex: "2 1 0%", // Permite crecer y encoger proporcionalmente
                                          minWidth: 0, // CLAVE: evita desbordamiento
                                          padding: "5px",
                                          fontSize: "10px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "4px",
                                          textTransform: "uppercase",
                                          boxSizing: "border-box",
                                        }}
                                        value={nombreAgresorVal}
                                        onChange={(e) => {
                                          const val =
                                            e.target.value.toUpperCase();
                                          setRegistroEditar((prev: any) => {
                                            const nuevas = [
                                              ...(prev.agresores || []),
                                            ];
                                            nuevas[index] = {
                                              ...nuevas[index],
                                              nombre_agresor: val,
                                            };
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
                                        style={{
                                          flex: "1 1 0%", // Permite crecer y encoger proporcionalmente
                                          minWidth: 0, // CLAVE: evita desbordamiento
                                          padding: "5px",
                                          fontSize: "10px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "4px",
                                          textTransform: "uppercase",
                                          boxSizing: "border-box",
                                        }}
                                        value={placaAgresorVal}
                                        onChange={(e) => {
                                          const val =
                                            e.target.value.toUpperCase();
                                          setRegistroEditar((prev: any) => {
                                            const nuevas = [
                                              ...(prev.agresores || []),
                                            ];
                                            nuevas[index] = {
                                              ...nuevas[index],
                                              placa_agresor: val,
                                            };
                                            return {
                                              ...prev,
                                              identificado: "IDENTIFICADO",
                                              agresores: nuevas,
                                            };
                                          });
                                        }}
                                      />
                                      <input
                                        type="text" // Cambiado a text
                                        inputMode="numeric" // Activa el teclado numérico en móviles
                                        placeholder="EDAD"
                                        style={{
                                          width: "45px",
                                          flexShrink: 0, // Evita que se encoja de más
                                          minWidth: 0,
                                          padding: "5px",
                                          fontSize: "10px",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "4px",
                                          textAlign: "center",
                                          boxSizing: "border-box",
                                        }}
                                        value={edadAgresorVal}
                                        onChange={(e) => {
                                          // Limita a números y máximo 3 dígitos
                                          const val = e.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 3);
                                          setRegistroEditar((prev: any) => {
                                            const nuevas = [
                                              ...(prev.agresores || []),
                                            ];
                                            nuevas[index] = {
                                              ...nuevas[index],
                                              edad: val,
                                            };
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
                                        onClick={() => {
                                          setRegistroEditar((prev: any) => {
                                            const nuevas = (
                                              prev.agresores || []
                                            ).filter(
                                              (_: any, i: number) =>
                                                i !== index,
                                            );
                                            return {
                                              ...prev,
                                              agresores: nuevas,
                                            };
                                          });
                                        }}
                                        style={{
                                          flexShrink: 0, // Mantiene su tamaño fijo
                                          width: "26px", // Botón cuadrado
                                          height: "26px", // Botón cuadrado
                                          backgroundColor: "#fee2e2",
                                          color: "#dc2626",
                                          border: "1px solid #fca5a5",
                                          borderRadius: "4px",
                                          padding: 0, // Sin padding para alinear perfectamente la X
                                          cursor: "pointer",
                                          fontSize: "14px",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          boxSizing: "border-box",
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : null;
                })()}
              </div>

              {/* =================================================== */}
              {/* VENTANA 4: CAMPOS SIPCOP (RESULTADO)                */}
              {/* =================================================== */}
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "15px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "42px",
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
                  3. RESULTADOS Y EVIDENCIAS
                </div>
                {/* MOSAICO: CONTRA EL PATRIMONIO */}
                <div>
                  <label
                    style={{
                      fontSize: "10px",
                      color: "#024885",
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    CONTRA EL PATRIMONIO (VALOR ACTUAL:{" "}
                    {registroEditar?.patrimonio_real ?? "NINGUNO"})
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "4px",
                      border: "1px solid #e2e8f0",
                      padding: "4px",
                      borderRadius: "4px",
                    }}
                  >
                    {(listaPatrimonio ?? []).map((item: any, index: number) => {
                      const val = item.value ?? item.id ?? item;
                      const label = String(
                        item.label ?? item.nombre ?? item,
                      ).toUpperCase();

                      const valorActual = registroEditar?.patrimonio_real;
                      const seleccionado =
                        valorActual !== undefined &&
                        valorActual !== null &&
                        (String(valorActual).trim().toUpperCase() ===
                          label.trim() ||
                          String(valorActual).trim() === String(val).trim() ||
                          Number(valorActual) === Number(val));

                      return (
                        <div
                          key={`patrimonio-${val}-${index}`}
                          onClick={() =>
                            setRegistroEditar((prev: any) => ({
                              ...(prev || {}),
                              patrimonio_real: label, // <-- Cambiado de 'val' a 'label'
                            }))
                          }
                          style={{
                            padding: "5px",
                            fontSize: "10px",
                            backgroundColor: seleccionado
                              ? "#024885"
                              : "#f8fafc",
                            color: seleccionado ? "#fff" : "#1e293b",
                            border: "1px solid",
                            borderColor: seleccionado ? "#024885" : "#cbd5e1",
                            borderRadius: "4px",
                            cursor: "pointer",
                            textAlign: "center",
                            fontWeight: seleccionado ? "bold" : "normal",
                          }}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* MOSAICO: ARRESTO */}

                <div>
                  <label
                    style={{
                      fontSize: "10px",
                      color: "#024885",
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    ARRESTO
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "4px",
                      maxHeight: "90px",
                      overflowY: "auto",
                      border: "1px solid #e2e8f0",
                      padding: "4px",
                      borderRadius: "4px",
                    }}
                  >
                    {(listaArrestos ?? []).map((item: any, index: number) => {
                      const label = String(item.nombre ?? item).toUpperCase();
                      const valorActual = String(
                        registroEditar?.arresto_ciudadano ?? "",
                      ).toUpperCase();

                      // Comparamos texto con texto
                      const seleccionado = valorActual === label;

                      return (
                        <div
                          key={`arresto-${index}`}
                          onClick={() =>
                            setRegistroEditar((prev: any) => ({
                              ...(prev || {}),
                              arresto_ciudadano: label, // Guardamos el texto exacto que espera el VARCHAR
                            }))
                          }
                          style={{
                            padding: "5px",
                            fontSize: "10px",
                            backgroundColor: seleccionado
                              ? "#024885"
                              : "#f8fafc",
                            color: seleccionado ? "#fff" : "#1e293b",
                            border: "1px solid",
                            borderColor: seleccionado ? "#024885" : "#cbd5e1",
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
                {/* MOSAICO: ESTADO */}
                <div>
                  <label
                    style={{
                      fontSize: "10px",
                      color: "#024885",
                      fontWeight: "bold",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    ESTADO
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "4px",
                      maxHeight: "90px",
                      overflowY: "auto",
                      border: "1px solid #e2e8f0",
                      padding: "4px",
                      borderRadius: "4px",
                    }}
                  >
                    {(listaEstados ?? []).map((item: any, index: number) => {
                      const val = item.id; // 1, 2, 3, 4
                      const label = String(item.nombre).toUpperCase(); // "PENDIENTE", "VERIFICADO", etc.

                      const valorActual = String(
                        registroEditar?.estado ?? "",
                      ).toUpperCase();

                      // Comparamos tanto si el estado actual es el texto (label) o el ID numérico
                      const seleccionado =
                        valorActual === label || valorActual === String(val);

                      return (
                        <div
                          key={`estado-${val}-${index}`}
                          onClick={() =>
                            setRegistroEditar((prev: any) => ({
                              ...(prev || {}),
                              estado: label, // Guardamos el texto exacto (ej. "PENDIENTE") para la BD
                            }))
                          }
                          style={{
                            padding: "5px",
                            fontSize: "10px",
                            backgroundColor: seleccionado
                              ? "#024885"
                              : "#f8fafc",
                            color: seleccionado ? "#fff" : "#1e293b",
                            border: "1px solid",
                            borderColor: seleccionado ? "#024885" : "#cbd5e1",
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

                {/* BOTONES DE ACCIÓN */}
                <div
                  style={{
                    padding: "20px 0 0 0",
                    display: "flex",
                    gap: "10px",
                    borderTop: "1px solid #e2e8f0",
                    marginTop: "10px",
                  }}
                >
                  <button
                    type="button"
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
                    style={{
                      flex: 1,
                      padding: "10px",
                      backgroundColor: "#024885",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                    onClick={() => {
                      // --- FUNCIÓN DE VALIDACIÓN ANTES DE ENVIAR ---
                      if (!(registroEditar as any)?.identificado) {
                        alert(
                          "Por favor seleccione si está IDENTIFICADO o NO IDENTIFICADO.",
                        );
                        return;
                      }

                      if (!registroEditar?.patrimonio_real) {
                        alert(
                          "Por favor seleccione una opción de Contra el Patrimonio.",
                        );
                        return;
                      }

                      if (!registroEditar?.estado) {
                        alert("Por favor seleccione un Estado.");
                        return;
                      }

                      if (!registroEditar?.arresto_ciudadano) {
                        alert("Por favor seleccione una opción de Arresto.");
                        return;
                      }

                      // Si está identificado, validamos que los campos obligatorios de víctimas estén completos
                      if (
                        (registroEditar as any)?.identificado === "IDENTIFICADO"
                      ) {
                        const victimas =
                          (registroEditar as any)?.victimas || [];

                        for (let i = 0; i < victimas.length; i++) {
                          const v = victimas[i];

                          // Solo validamos que la fila no esté COMPLETAMENTE vacía.
                          // Si tiene al menos el nombre, O la edad, O la relación, pasará.
                          if (
                            !v.nombre_victima &&
                            !v.edad &&
                            !v.id_relacion_v
                          ) {
                            alert(
                              `Ingrese al menos un dato (Nombre, Edad o Relación) para la víctima #${i + 1}`,
                            );
                            return;
                          }
                        }
                      }
                      // ---------------------------------------------

                      setModalConfirmacionOpen(true);
                    }}
                  >
                    Actualizar cambios
                  </button>
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
    fontSize: "10px",
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
    color: "#024885",
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
    color: "#024885",
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
    fontSize: "10px",
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
    color: "#024885",
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
    fontSize: "10px",
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
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
    fontSize: "10px",
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
