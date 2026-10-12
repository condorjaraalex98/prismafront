import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/userContext";
import { Dropdown } from "react-native-element-dropdown";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
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

  // Fecha de hoy local para bloquear la selección de fechas futuras
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  const fechaHoy = `${anio}-${mes}-${dia}`;

  // Modales
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<any | null>(null);
  const [registroEditar, setRegistroEditar] = useState<any | null>(null);
const [listaUbicaciones, setListaUbicaciones] = useState<any[]>([]);
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
    const [listaConsecuencias, setListaConsecuencias] = useState<CatalogoItem[]>(
      [],
    );
    const [listaResultados, setListaResultados] = useState<CatalogoItem[]>([]);
      const [listaRelaciones, setListaRelaciones] = useState<CatalogoItem[]>([]);
    
  const [modalidadesSeleccionadas, setModalidadesSeleccionadas] = useState<string[]>([]);
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<string[]>([]);
  const [dropdownModalidadesOpen, setDropdownModalidadesOpen] = useState(false);
  const [dropdownEstadosOpen, setDropdownEstadosOpen] = useState(false);
   const listaPatrimonio = [
    { id: 1, nombre: "SI" },
    { id: 2, nombre: "NO" },
  ];
  const fetchLugares = async () => {
      try {
        const response = await fetch(
          `${API_URL}/catalogos/modalidad`, // 👈 Cambiado a backticks (``)
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
  setRegistroEditar((prev: any) => {
    const registroFusionado = { ...(prev || {}), ...data.registro };
    const tieneInv = (registroFusionado.victimas?.length || 0) > 0 || (registroFusionado.agresores?.length || 0) > 0;
    
    return {
      ...registroFusionado,
      identificado: registroFusionado.identificado || (tieneInv ? "IDENTIFICADO" : "NO_IDENTIFICADO")
    };
  });
}
    } catch (error) {
      console.error("Error al cargar los campos sIPCOP:", error);
    }
  };
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
  // Filtros aplicados efectivamente
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    fechaReporteInicio: "",
    fechaReporteFin: "",
    fechaEventoInicio: "",
    fechaEventoFin: "",
    patrimonio: "",
    arresto: "",
    roboHurto: false,
    modalidades: [] as string[],
    estados: [] as string[]
  });

  const [listaModalidadesDisponibles, setListaModalidadesDisponibles] = useState<string[]>([]);
  const listaEstadosDisponibles = ["PENDIENTE", "VERIFICADO", "SIPCOP", "ANULADO"];

  // Validadores clave para habilitar/deshabilitar controles
  const tieneFechasSeleccionadas = useMemo(() => {
    const hayFechasReporte = Boolean(fechaReporteInicio && fechaReporteFin);
    const hayFechasEvento = Boolean(fechaEventoInicio && fechaEventoFin);
    return hayFechasReporte || hayFechasEvento;
  }, [fechaReporteInicio, fechaReporteFin, fechaEventoInicio, fechaEventoFin]);

  // Formateador visual a DD/MM/YYYY
  const formatearFechaDDMMYYYY = (fechaStr: string) => {
    if (!fechaStr) return "";
    const parteFecha = String(fechaStr).split(" ")[0].split("T")[0];
    const partes = parteFecha.split("-");
    if (partes.length === 3) {
      const [anio, mes, dia] = partes;
      return `${dia}/${mes}/${anio}`;
    }
    return fechaStr;
  };

  useEffect(() => {
    fetch(`${API_URL}/catalogos/modalidad`)
      .then((res) => res.json())
      .then((data) => {
        const lista = Array.isArray(data) ? data : data.data || [];
        setListaModalidadesDisponibles(lista.map((m: any) => m.nombre || m.label).filter(Boolean));
      })
      .catch((err) => console.error("Error al cargar modalidades:", err));
  }, []);




  
  const fetchOcurrencias = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/ocurrencias/listar/tablasipcop-avanzado?page=${paginaActual}&limit=${registrosPorPagina}`;

      if (filtrosAplicados.fechaReporteInicio) url += `&fecha_reporte_inicio=${encodeURIComponent(filtrosAplicados.fechaReporteInicio)}`;
      if (filtrosAplicados.fechaReporteFin) url += `&fecha_reporte_fin=${encodeURIComponent(filtrosAplicados.fechaReporteFin)}`;
      if (filtrosAplicados.fechaEventoInicio) url += `&fecha_evento_inicio=${encodeURIComponent(filtrosAplicados.fechaEventoInicio)}`;
      if (filtrosAplicados.fechaEventoFin) url += `&fecha_evento_fin=${encodeURIComponent(filtrosAplicados.fechaEventoFin)}`;
      if (filtrosAplicados.patrimonio) url += `&patrimonio=${encodeURIComponent(filtrosAplicados.patrimonio)}`;
      if (filtrosAplicados.arresto) url += `&arresto=${encodeURIComponent(filtrosAplicados.arresto)}`;
      if (filtrosAplicados.roboHurto) url += `&delito=robo_hurto`;
      
      if (filtrosAplicados.modalidades.length > 0) {
        url += `&modalidades=${encodeURIComponent(filtrosAplicados.modalidades.join(","))}`;
      }
      if (filtrosAplicados.estados.length > 0) {
        url += `&estados=${encodeURIComponent(filtrosAplicados.estados.join(","))}`;
      }

      const response = await fetch(url);
      const json = await response.json();

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
    } catch (error) {
      console.error("Error al obtener registros:", error);
      setReportesCompletos([]);
      setTotalRegistrosBD(0);
    } finally {
      setLoading(false);
    }
  }, [paginaActual, registrosPorPagina, filtrosAplicados]);

  useEffect(() => {
    fetchOcurrencias();
  }, [fetchOcurrencias]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("#dropdown-modalidades-container")) setDropdownModalidadesOpen(false);
      if (!target.closest("#dropdown-estados-container")) setDropdownEstadosOpen(false);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

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
      estados: [...estadosSeleccionados]
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
      estados: []
    });
  };

  const cantidadFiltrosActivos = useMemo(() => {
    let count = 0;
    if (fechaReporteInicio || fechaReporteFin) count++;
    if (fechaEventoInicio || fechaEventoFin) count++;
    if (patrimonioFiltro) count++;
    if (arrestoFiltro) count++;
    if (soloRoboHurto) count++;
    if (modalidadesSeleccionadas.length > 0) count += modalidadesSeleccionadas.length;
    if (estadosSeleccionados.length > 0) count += estadosSeleccionados.length;
    return count;
  }, [fechaReporteInicio, fechaReporteFin, fechaEventoInicio, fechaEventoFin, patrimonioFiltro, arrestoFiltro, soloRoboHurto, modalidadesSeleccionadas, estadosSeleccionados]);

  return (
    <div style={styles.container}>
      {/* CABECERA DINÁMICA */}
      <div style={styles.header}>
        <h2 style={{ color: MJM_BLUE, margin: 0, fontWeight: 700, fontSize: "20px" }}>
          {esBusqueda12Horas
            ? `Total Registros (Últimas 12 horas): ${totalRegistrosBD} registros`
            : `Total Registros: ${totalRegistrosBD} registros`}
        </h2>
      </div>

      {/* PANEL DE FILTROS */}
      <div style={styles.filterCard}>
        <div style={styles.filterRow}>
          {/* FECHA REGISTRO (SIEMPRE ACTIVA) */}
          <div>
            <label style={styles.filterLabel}>FECHA REGISTRO:</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input type="date" max={fechaHoy} value={fechaReporteInicio} onChange={(e) => setFechaReporteInicio(e.target.value)} style={styles.inputDate} />
              <span>-</span>
              <input type="date" max={fechaHoy} value={fechaReporteFin} onChange={(e) => setFechaReporteFin(e.target.value)} style={styles.inputDate} />
            </div>
          </div>

          {/* FECHA OCURRENCIA (SIEMPRE ACTIVA) */}
          <div>
            <label style={styles.filterLabel}>FECHA OCURRENCIA:</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input type="date" max={fechaHoy} value={fechaEventoInicio} onChange={(e) => setFechaEventoInicio(e.target.value)} style={styles.inputDate} />
              <span>-</span>
              <input type="date" max={fechaHoy} value={fechaEventoFin} onChange={(e) => setFechaEventoFin(e.target.value)} style={styles.inputDate} />
            </div>
          </div>

          {/* PATRIMONIO (BLOQUEADO HASTA ELEGIR FECHAS) */}
          <div>
            <label style={styles.filterLabel}>PATRIMONIO:</label>
            <select 
              value={patrimonioFiltro} 
              onChange={(e) => setPatrimonioFiltro(e.target.value)} 
              disabled={!tieneFechasSeleccionadas}
              style={{ ...styles.selectRows, opacity: tieneFechasSeleccionadas ? 1 : 0.5, cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed" }}
            >
              <option value="">TODOS</option>
              <option value="SI">SI</option>
              <option value="NO">NO</option>
            </select>
          </div>

          {/* ARRESTO (BLOQUEADO HASTA ELEGIR FECHAS) */}
          <div>
            <label style={styles.filterLabel}>ARRESTO:</label>
            <select 
              value={arrestoFiltro} 
              onChange={(e) => setArrestoFiltro(e.target.value)} 
              disabled={!tieneFechasSeleccionadas}
              style={{ ...styles.selectRows, opacity: tieneFechasSeleccionadas ? 1 : 0.5, cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed" }}
            >
              <option value="">TODOS</option>
              <option value="SI">SI</option>
              <option value="NO">NO</option>
            </select>
          </div>

          {/* DELITO DESCRIPCIÓN (BLOQUEADO HASTA ELEGIR FECHAS) */}
          <div>
            <label style={styles.filterLabel}>DELITO DESCRIPCIÓN:</label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "600", cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed", marginTop: "6px", opacity: tieneFechasSeleccionadas ? 1 : 0.5 }}>
              <input 
                type="checkbox" 
                checked={soloRoboHurto} 
                disabled={!tieneFechasSeleccionadas}
                onChange={(e) => setSoloRoboHurto(e.target.checked)} 
              />
              Robo / Hurto
            </label>
          </div>

          {/* DESPLEGABLE MODALIDADES (BLOQUEADO HASTA ELEGIR FECHAS) */}
          <div id="dropdown-modalidades-container" style={{ ...styles.dropdownContainer, opacity: tieneFechasSeleccionadas ? 1 : 0.5 }}>
            <button 
              onClick={() => tieneFechasSeleccionadas && setDropdownModalidadesOpen(!dropdownModalidadesOpen)} 
              disabled={!tieneFechasSeleccionadas}
              style={{ ...styles.dropdownButton, cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed" }}
            >
              <span>{modalidadesSeleccionadas.length === 0 ? "Filtrar Modalidades" : `Modalidades (${modalidadesSeleccionadas.length})`}</span>
              <Ionicons name={dropdownModalidadesOpen ? "chevron-up" : "chevron-down"} size={14} color="#334155" />
            </button>
            {dropdownModalidadesOpen && tieneFechasSeleccionadas && (
              <div style={styles.dropdownMenu}>
                <div style={styles.dropdownHeaderMenu}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#024885" }}>MODALIDADES</span>
                  {modalidadesSeleccionadas.length > 0 && (
                    <button onClick={() => setModalidadesSeleccionadas([])} style={styles.btnClearSelection}>Limpiar</button>
                  )}
                </div>
                <div style={styles.dropdownListScroll}>
                  {listaModalidadesDisponibles.map((mod) => (
                    <label key={mod} style={styles.dropdownCheckboxItem}>
                      <input type="checkbox" checked={modalidadesSeleccionadas.includes(mod)} onChange={() => toggleModalidadFiltro(mod)} />
                      <span style={{ fontSize: "10px" }}>{mod}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* DESPLEGABLE ESTADOS (BLOQUEADO HASTA ELEGIR FECHAS) */}
          <div id="dropdown-estados-container" style={{ ...styles.dropdownContainer, opacity: tieneFechasSeleccionadas ? 1 : 0.5 }}>
            <button 
              onClick={() => tieneFechasSeleccionadas && setDropdownEstadosOpen(!dropdownEstadosOpen)} 
              disabled={!tieneFechasSeleccionadas}
              style={{ ...styles.dropdownButton, cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed" }}
            >
              <span>{estadosSeleccionados.length === 0 ? "Filtrar Estados" : `Estados (${estadosSeleccionados.length})`}</span>
              <Ionicons name={dropdownEstadosOpen ? "chevron-up" : "chevron-down"} size={14} color="#334155" />
            </button>
            {dropdownEstadosOpen && tieneFechasSeleccionadas && (
              <div style={styles.dropdownMenu}>
                <div style={styles.dropdownHeaderMenu}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#024885" }}>ESTADOS</span>
                  {estadosSeleccionados.length > 0 && (
                    <button onClick={() => setEstadosSeleccionados([])} style={styles.btnClearSelection}>Limpiar</button>
                  )}
                </div>
                <div style={styles.dropdownListScroll}>
                  {listaEstadosDisponibles.map((est) => (
                    <label key={est} style={styles.dropdownCheckboxItem}>
                      <input type="checkbox" checked={estadosSeleccionados.includes(est)} onChange={() => toggleEstadoFiltro(est)} />
                      <span style={{ fontSize: "10px" }}>{est}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BOTONES BUSCAR Y LIMPIAR */}
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", marginTop: "auto" }}>
            <button 
              onClick={handleEjecutarBusqueda} 
              disabled={!tieneFechasSeleccionadas}
              style={{ 
                ...styles.btnSearch, 
                backgroundColor: tieneFechasSeleccionadas ? MJM_BLUE : "#94a3b8",
                cursor: tieneFechasSeleccionadas ? "pointer" : "not-allowed" 
              }}
            >
              <Ionicons name="search" size={14} color="white" /> Buscar
            </button>
            {cantidadFiltrosActivos > 0 && (
              <button onClick={handleLimpiarFiltros} style={styles.btnClearFilters}>
                <Ionicons name="reload" size={14} color="white" /> Limpiar ({cantidadFiltrosActivos})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div style={styles.tableCard}>
        <div style={styles.tableScrollContainer}>
          <table style={{ ...styles.table, tableLayout: "fixed", width: "100%", borderCollapse: "collapse" }}>
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
                    width: "10%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  FECHA REGISTRO
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "10%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  DATOS IMPORTANTES
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "10%",
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
                    width: "9%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  RESULTADO
                </th>

                <th
                  style={{
                    ...styles.th,
                    width: "9%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  CONSECUENCIA
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
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "30px" }}>Cargando registros...</td></tr>
              ) : reportesCompletos.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "30px" }}>No se encontraron registros.</td></tr>
              ) : (
                reportesCompletos.map((item) => (
                  <tr key={item.id_ocurrencia} style={styles.tr} onClick={() => setDetalleSeleccionado(item)}>
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
                  {/* CELDA: Resultado */}
                                  <td
                                    style={{
                                      ...styles.td,
                                      borderRight: "1px solid #e2e8f0",
                                       borderLeft: "3px solid #024885", 
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
                                  {/* CELDA: Lugar Evento */}
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

  // Determinamos si ya tiene víctimas o agresores registrados
  const tieneVictimasAgresores = (item.victimas?.length || 0) > 0 || (item.agresores?.length || 0) > 0;

  // Inicializamos el registro asegurando que 'identificado' tenga un valor por defecto real
  const registroConIdentificado = {
    ...item,
    identificado: item.identificado || (tieneVictimasAgresores ? "IDENTIFICADO" : "NO_IDENTIFICADO")
  };

  setRegistroEditar(registroConIdentificado);

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
                ))
              )}
            </tbody>

            
          </table>
        </div>

        {/* FOOTER Y CONTADORES */}
        <div style={styles.tableFooterPagination}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", marginRight: "auto" }}>
            <span style={{ fontSize: "11px", color: "#475569", fontWeight: "600" }}>Mostrar:</span>
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
              {filtrosAplicados.fechaReporteInicio && filtrosAplicados.fechaReporteFin && (
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "normal", marginLeft: "6px" }}>
                  (Reg: {formatearFechaDDMMYYYY(filtrosAplicados.fechaReporteInicio)} al {formatearFechaDDMMYYYY(filtrosAplicados.fechaReporteFin)})
                </span>
              )}
              {filtrosAplicados.fechaEventoInicio && filtrosAplicados.fechaEventoFin && (
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "normal", marginLeft: "6px" }}>
                  (Ocurrencia: {formatearFechaDDMMYYYY(filtrosAplicados.fechaEventoInicio)} al {formatearFechaDDMMYYYY(filtrosAplicados.fechaEventoFin)})
                </span>
              )}
            </span>

            {/* CONTADORES DE ESTADO */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginLeft: "8px" }}>
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
            <button disabled={paginaActual === 1} onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))} style={styles.btnPageNew}>
              <Ionicons name="chevron-back" size={15} color={paginaActual === 1 ? "#cbd5e1" : "#334155"} />
            </button>
            <span style={styles.pageInfoWrapper}>Página {paginaActual} de {totalPaginas}</span>
            <button disabled={paginaActual >= totalPaginas} onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))} style={styles.btnPageNew}>
              <Ionicons name="chevron-forward" size={15} color={paginaActual >= totalPaginas ? "#cbd5e1" : "#334155"} />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DETALLE */}
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

                {/* 5. SECCIÓN ORDENADA DE VÍCTIMAS Y AGRESORES (Ya estaba en 2 columnas) */}
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
                    {/* Bloque Víctima */}
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
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

                    {/* Bloque Agresor */}
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
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
                </div>

 {/* datos im */}
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

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                   
                    <div style={styles.infoRowGrid}>
               
                      <span style={styles.infoValue}>
                       {detalleSeleccionado.ocurrencia_descripcion ||
                    "Sin descripción detallada."}
                      </span>
                    </div>
                  </div>
                </div>
 {/*fotos */}
              <div
  style={{
    gridColumn: "span 2",
    padding: "16px",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)",
  }}
>
  

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
        <div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
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
                  {/* BOTÓN / TARJETA DE EVIDENCIA */}
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
                      transition: "all 0.2s ease",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                    }}
                    className="link-evidencia-foto"
                  >
                    <Ionicons name="camera-outline" size={14} color="#024885" />
                    <span>Ver Foto {idx + 1}</span>
                    <Ionicons name="open-outline" size={12} color="#64748b"  />
                  </a>

                  {/* TOOLTIP CON MINIATURA DE LA FOTO */}
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
              );
            })}
          </div>

          <style>{`
            .link-evidencia-foto:hover {
              background-color: #f1f5f9 !important;
              border-color: #024885 !important;
              color: #024885 !important;
            }
            .link-evidencia-foto:hover + .tooltip-miniatura,
            .tooltip-miniatura:hover {
              display: block !important;
            }
          `}</style>
        </div>
      );
    }

    return (
      <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
        No hay archivos adjuntos registrados para esta ocurrencia.
      </span>
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
                    CONTRA EL PATRIMONIO 
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

const styles: Record<string, React.CSSProperties | any> = {
  container: { padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" },
  
  filterCard: { backgroundColor: "white", padding: "16px", borderRadius: "12px", marginBottom: "16px", border: "1px solid #e2e8f0" },
  filterRow: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" },
  filterLabel: { fontSize: "10px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" },
  inputDate: { padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "11px" },
  
  btnSearch: { padding: "7px 14px", backgroundColor: MJM_BLUE, color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "5px" },
  btnClearFilters: { padding: "7px 14px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "5px" },

  dropdownContainer: { position: "relative", display: "inline-block" },
  dropdownButton: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "7px 12px", backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", color: "#334155" },
  dropdownMenu: { position: "absolute", top: "calc(100% + 4px)", left: 0, backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", zIndex: 100, width: "220px", padding: "8px" },
  dropdownHeaderMenu: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "6px", borderBottom: "1px solid #f1f5f9", marginBottom: "6px" },
  btnClearSelection: { background: "none", border: "none", color: "#ef4444", fontSize: "10px", fontWeight: "bold", cursor: "pointer" },
  dropdownListScroll: { maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" },
  dropdownCheckboxItem: { display: "flex", alignItems: "center", gap: "8px", padding: "4px", borderRadius: "4px", cursor: "pointer" },

  tableCard: { backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" },
  tableScrollContainer: { overflowX: "auto", maxHeight: "65vh" },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { backgroundColor: "#024885", color: "white", position: "sticky", top: 0, zIndex: 10 },
  th: { padding: "12px 14px", fontSize: "10px", textAlign: "left", fontWeight: "700", textTransform: "uppercase" },
  td: { padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontSize: "12px", color: "#1e293b" },
  tr: { cursor: "pointer", transition: "background-color 0.15s" },
  btnAction: { background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", padding: "5px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center" },

  tableFooterPagination: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #e2e8f0", backgroundColor: "#fff", flexWrap: "wrap", gap: "10px" },
  selectRows: { padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#fff", fontSize: "11px", fontWeight: "600" },
  paginationFlex: { display: "flex", alignItems: "center", gap: "6px" },
  btnPageNew: { width: "32px", height: "32px", borderRadius: "6px", border: "none", backgroundColor: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  pageInfoWrapper: { fontSize: "12px", fontWeight: "700", color: "#475569" },

  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalDetail: { backgroundColor: "white", padding: "24px", borderRadius: "16px", width: "650px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)", overflow: "hidden" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" },
  modalBodyScrollable: { flex: 1, overflowY: "auto", marginTop: "14px" },
  btnClose: { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#94a3b8" },
  infoRowGrid: { display: "flex", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: "13px" },
  infoLabel: { width: "130px", fontWeight: "700", color: "#475569" },
  infoValue: { color: "#1e293b", flex: 1 },
};