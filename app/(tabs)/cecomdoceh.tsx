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
  unidad_encargada?: string;
  referencia?: string;
  persona_nombre_completo: string;
  persona_dni: string;
   vehiculos_json :string;
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

  // 🔥 ESTA LÍNEA ES LA QUE BORRA LOS CORCHETES Y COMILLAS:
  ruta = String(ruta).replace(/[\[\]'"]+/g, "").trim();

  if (ruta.startsWith("http://") || ruta.startsWith("https://") || ruta.startsWith("data:image")) {
    return ruta;
  }

  const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://prismaocurrecias.onrender.com";
  return `${API_URL}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
};
  // Función de redirección de ejemplo (puedes llamarla desde cualquier botón o evento)
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

  // Función reutilizable para actualizar el total de mis registros
  const fetchTotalMisRegistros = useCallback(() => {
    if (userData?.id) {
      fetch(`${API_URL}/ocurrencias/listar/tablasipcop-rango12h?limit=1&id_usuario=${userData.id}`)
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
          
          // CAMBIO CLAVE: Redirigir a "TODOS" y volver a la página 1 para ver el resultado reflejado al instante
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
        let url = `${API_URL}/ocurrencias/listar/tablasipcop-rango12h?page=${page}&limit=${limit}`;

        if (filtro === "MIOS" && userData?.id) {
          url += `&id_usuario=${encodeURIComponent(userData.id)}`;
        }

        const response = await fetch(url);
        const json = await response.json();
console.log("Datos que llegan del backend:", json.data[0]); // <--- AÑADE ESTO
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
    [paginaActual, registrosPorPagina, filtro, userData]
  );

  useEffect(() => {
    fetchOcurrencias(paginaActual, registrosPorPagina);
  }, [paginaActual, registrosPorPagina, filtro, fechasFiltro, fetchOcurrencias]);

  const handleBuscarPorFechas = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const hoyFecha = new Date().toISOString().split("T")[0];

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

  const handleCambioFiltro = (nuevoFiltro: "TODOS" | "MIOS") => {
    setFiltro(nuevoFiltro);
    setPaginaActual(1);
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

  const totalMios = useMemo(() => {
    if (!reportesCompletos || !userData?.nombres) return 0;
    const miNombreLower = String(userData.nombres).toLowerCase().trim();
    return reportesCompletos.filter((item) => {
      const nombreCompletoReporte = String(
        item.persona_nombre_completo || "",
      ).toLowerCase();
      return nombreCompletoReporte.includes(miNombreLower);
    }).length;
  }, [reportesCompletos, userData]);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtro]);

  const reportesFiltrados = useMemo(() => {
    return Array.isArray(reportesCompletos) ? reportesCompletos : [];
  }, [reportesCompletos]);

  const totalPaginas = useMemo(() => {
    const paginas = Math.ceil(totalRegistrosBD / registrosPorPagina);
    return paginas > 0 ? paginas : 1;
  }, [totalRegistrosBD, registrosPorPagina]);

  const exportarExcel = async () => {
    if (!fechasFiltro?.inicio || !fechasFiltro?.fin) {
      alert("Por favor, selecciona un rango de fechas antes de exportar.");
      return;
    }

    try {
      setLoading(true);
      setUploadProgress(0);
      setUploadStatus("Iniciando descarga de registros...");
      setIsFinished(false);
      
      await new Promise((resolve) => setTimeout(resolve, 50)); 
      
      let todosLosDatos: Ocurrencia[] = [];
      let pagina = 1;
      const limitePorLote = 50; 
      let totalEsperado = totalRegistrosBD || 1;

      do {
        let url = `${API_URL}/ocurrencias/listar/tablasipcop-rango?page=${pagina}&limit=${limitePorLote}`;
        url += `&fecha_inicio=${encodeURIComponent(fechasFiltro.inicio)}&fecha_fin=${encodeURIComponent(fechasFiltro.fin)}`;

        const response = await fetch(url);
        const json = await response.json();

        if (!json || !json.success || !Array.isArray(json.data) || json.data.length === 0) {
          break;
        }

        todosLosDatos = [...todosLosDatos, ...json.data];
        totalEsperado = json.total || totalRegistrosBD;

        const porcentaje = Math.min(Math.round((todosLosDatos.length / totalEsperado) * 100), 99);
        setUploadProgress(porcentaje);
        setUploadStatus(`Descargando: ${todosLosDatos.length} de ${totalEsperado} registros...`);

        await new Promise((resolve) => setTimeout(resolve, 20));

        if (todosLosDatos.length >= totalEsperado || json.data.length < limitePorLote) {
          break;
        }

        pagina++;
      } while (true);

      if (todosLosDatos.length === 0) {
        alert("No hay registros en este rango para exportar.");
        setLoading(false);
        return;
      }

      setUploadStatus("Generando archivo Excel...");
      setUploadProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const dataParaExcel = todosLosDatos.map((item) => {
        const registro = extraerFechaYHoraLimpia(item.fecha_reporte);
        const sucesoReal = extraerFechaYHoraLimpia(item.fecha_evento);
        return {
          "ID REPORTE": item.id_ocurrencia,
          "REGISTRO DIA": registro.dia,
          "REGISTRO FECHA": registro.fecha,
          "REGISTRO HORA": registro.hora,
          "OPERADOR NOMBRE": item.persona_nombre_completo,
          "OPERADOR DNI": item.persona_dni,
          "NUMERO TEL": item.numero_telefono,
          "NOMBRE INFORMATE": item.nombre_informante,
          "ORIGEN ALERTA": item.origen_descripcion || "---",
          "TIPO PATRULLAGE": item.tipo_patrullaje_nombre || "---",
          "ASIGNACION PLACA": item.placa_con_tipo || "---",
          MODALIDAD: item.modalidad_nombre,
          "DISTANCIA METROS": item.distancia_metros || 0,
          "SUCESO DIA": sucesoReal.dia,
          "SUCESO FECHA": sucesoReal.fecha,
          "SUCESO HORA": item.hora_llegada || registro.hora,
          "UBICACIÓN PRINCIPAL": item.label || item.via_nombre || "---",
          REFERENCIA: item.referencia || "Sin referencia",
          "COD SEGUIMIENTO": item.codigo_seguimiento || "---",
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataParaExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial_Operativo");
      XLSX.writeFile(wb, `Reporte_Central_${Date.now()}.xlsx`);

      setIsFinished(true);
      setUploadStatus("¡Exportación completada!");
      
      setTimeout(() => {
        setLoading(false);
      }, 800);

    } catch (error) {
      console.error("Error al exportar el Excel completo:", error);
      alert("Ocurrió un error al generar el archivo Excel.");
      setLoading(false);
    }
  };

  const exportarPDF = async () => {
    // @ts-ignore
    const { jsPDF } = await import("jspdf/dist/jspdf.es.min.js");
    // @ts-ignore
    const autoTableModule = await import("jspdf-autotable/dist/jspdf.plugin.autotable.js");
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(14);
    doc.setTextColor(2, 72, 133);
    doc.text("HISTORIAL OPERATIVO DE SEGURIDAD CIUDADANA", 14, 14);

    const tablaData = reportesFiltrados.map((item) => {
      const reg = extraerFechaYHoraLimpia(item.fecha_reporte);
      const suc = extraerFechaYHoraLimpia(item.fecha_evento);
      return [
        item.id_ocurrencia,
        `${reg.dia} ${reg.fecha} ${reg.hora}`,
        item.persona_nombre_completo,
        `${item.tipo_patrullaje_nombre || "---"} | ${item.origen_descripcion || "---"}`,
        item.modalidad_nombre,
        `${suc.dia} ${suc.fecha} - ${item.hora_llegada || "S/H"}`,
        item.label || item.via_nombre || "---",
      ];
    });

    autoTable(doc, {
      head: [
        [
          "ID",
          "FECHA REGISTRO",
          "PERSONAL OPERADOR",
          "ORIGEN / ASIGNACIÓN",
          "MODALIDAD",
          "FECHA OCURRENCIA",
          "DIRECCIÓN UBICACIÓN",
        ],
      ],
      body: tablaData,
      startY: 22,
      headStyles: { fillColor: [2, 72, 133], fontSize: 8, fontStyle: "bold" },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
    });

    doc.save(`Reporte_Operativo_${Date.now()}.pdf`);
  };

  const comprimirImagenBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          const dataUrlComprimida = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrlComprimida);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSeleccionarFotosEdicion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const fotosComprimidas: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const base64Optimizado = await comprimirImagenBase64(files[i]);
        fotosComprimidas.push(base64Optimizado);
      }

      setRegistroEditar((prev: any) => ({
        ...prev,
        lista_fotos: [...(prev?.lista_fotos || []), ...fotosComprimidas],
      }));

      e.target.value = "";
    } catch (error) {
      console.error("Error al procesar y comprimir la foto:", error);
    }
  };

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = `
      @keyframes modalFadeIn {
        from { opacity: 0; transform: scale(0.96) translateY(10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
    `;
    document.head.appendChild(styleSheet);

    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
      if (document.head.contains(styleSheet)) document.head.removeChild(styleSheet);
    };
  }, []);
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
          <Ionicons name="share-social" size={26} color="white" />
          <div style={styles.cardLab}>RADIOPERADOR</div>
        </button>
      </div>

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
          {/* Pestañas de filtro (Al hacer clic, cambian el filtro Y actualizan los datos) */}
        <div style={styles.tabs}>
  <button
    onClick={() => fetchOcurrencias(paginaActual, registrosPorPagina)}
    style={{ /* estilos */ }}
    title="Actualizar tabla"
  >
    <Ionicons name="reload" size={17} color="#024885" />
  </button>
{/* Botón TODOS */}
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

{/* Botón MIS REGISTROS */}
<button
  onClick={() => {
    setFiltro("MIOS");
    setPaginaActual(1);
  }}
  style={{
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: filtro === "MIOS" ? MJM_BLUE : "#e2e8f0",
    color: filtro === "MIOS" ? "#ffffff" : "#475569",
  }}
>
  MIS REGISTROS ({totalMisRegistros})
</button>
</div>

          {/* Botón de Actualizar manual (Solo el icono al costado) */}
        </div>
      </div>

      {/* Caja de Datos y Estructura Automatizada de la Tabla */}
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
                    width: "12%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  FECHA REGISTRO
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "15%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  PERSONAL
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "10%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  ORIGEN
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "18%",
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
                  HORA
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "19%",
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  UBICACIÓN
                </th>
                <th
                  style={{
                    ...styles.th,
                    width: "3%",
                    textAlign: "center",
                    borderRight:
                      filtro === "MIOS" ? "1px solid #cbd5e1" : "none",
                  }}
                >
                  FOTOS
                </th>
                {filtro === "MIOS" && (
                  <th
                    style={{ ...styles.th, width: "5%", textAlign: "center" }}
                  >
                    EDITAR
                  </th>
                )}
              </tr>
            </thead>

       <tbody>
  {/* 1. ESTADO DE CARGA (Para consultas largas sin congelar la UI) */}
  {loading ? (
    <tr>
      <td
        colSpan={filtro === "MIOS" ? 10 : 9}
        style={{
          textAlign: "center",
          padding: "40px",
          color: "#024885",
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
  ) : reportesFiltrados.length === 0 ? (
    /* 2. ESTADO VACÍO */
    <tr>
      <td
        colSpan={filtro === "MIOS" ? 10 : 9}
        style={{
          textAlign: "center",
          padding: "30px",
          color: "#64748b",
        }}
      >
        No se encontraron registros.
      </td>
    </tr>
  ) : (
    /* 3. LISTADO DE REGISTROS */
    reportesFiltrados.map((item, index) => (
      <tr
        key={item.id_ocurrencia}
        className="fila-tabla-operativa"
        style={styles.tr}
        onClick={() => setDetalleSeleccionado(item)}
      >
        {/* Celda 0: Numeración */}
        <td
          style={{
            ...styles.td,
            textAlign: "center",
            verticalAlign: "top",
            borderRight: "1px solid #e2e8f0",
          }}
        >
          <div style={{ ...styles.txtB }} title={String(item.id_ocurrencia)}>
            #{item.id_ocurrencia}
          </div>
        </td>

        {/* Celda 1: Fecha Registro */}
        <td
          style={{
            ...styles.td,
            verticalAlign: "top",
            borderRight: "1px solid #e2e8f0",
          }}
        >
          <div style={styles.celdaTruncadaContainer}>
            <div
              style={{
                ...styles.txtB,
                whiteSpace: "normal",
                wordBreak: "break-word",
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
                    const hora = fechaObj.toLocaleTimeString("es-PE", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    });
                    return `${diaSemana} ${fechaNumerica} - ${hora}`;
                  })()
                : item.fecha_evento || "S/F"}
            </div>
          </div>
        </td>

        {/* Celda 2: Personal */}
        <td
          style={{
            ...styles.td,
            verticalAlign: "top",
            borderRight: "1px solid #e2e8f0",
          }}
        >
          <div style={styles.celdaTruncadaContainer}>
            <div
              style={{
                ...styles.txtB,
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
              title={item.persona_nombre_completo}
            >
              {item.persona_nombre_completo}
            </div>
           
          </div>
        </td>

        {/* Celda 3: Origen */}
        {/* Celda 3: Origen */}
        <td
          style={{
            ...styles.td,
            verticalAlign: "top",
            borderRight: "1px solid #e2e8f0",
          }}
        >
          <div style={styles.celdaTruncadaContainer}>
            {/* Primer elemento: más pequeño */}
            <div
              style={{
                ...styles.txtB,
                whiteSpace: "normal",
                wordBreak: "break-word",
                fontSize: "11px", // <-- Reducido aquí
              }}
              title={item.tipo_patrullaje_nombre || "---"}
            >
              {item.tipo_patrullaje_nombre || "---"}
            </div>

            {/* Segundo elemento: más grandecito */}
            <div
              style={{
                ...styles.txtS,
                color: "#024885",
                fontWeight: "600", // Le subí un poco el peso para que resalte más al ser más grande
                whiteSpace: "normal",
                wordBreak: "break-word",
                fontSize: "13px", // <-- Aumentado aquí
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
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
              title={item.placa_con_tipo}
            >
              {item.vehiculos_json}
            </div>
          </div>
        </td>

        {/* Celda 4: Modalidad */}
        <td
          style={{
            ...styles.td,
            verticalAlign: "top",
            borderRight: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              whiteSpace: "normal",
              wordBreak: "break-word",
            }}
          >
            <span
              style={{
                ...styles.badge,
                display: "inline-block",
                maxWidth: "100%",
                whiteSpace: "normal",
                wordBreak: "break-word",
                backgroundColor: (() => {
                  const mod = String(
                    item.modalidad_nombre || "",
                  ).toUpperCase();
                  if (mod.includes("CUADERNO")) return "#dc2626";
                  if (mod.includes("TÁCTICO")) return "#024885";
                  if (mod.includes("PROTECCIÓN ESCOLAR")) return "#eab308";
                  return "#f1f5f9";
                })(),
                color: (() => {
                  const mod = String(
                    item.modalidad_nombre || "",
                  ).toUpperCase();
                  if (mod.includes("PROTECCIÓN ESCOLAR")) return "#1e293b";
                  if (
                    !mod.includes("CUADERNO") &&
                    !mod.includes("TÁCTICO")
                  )
                    return "#37393b";
                  return "white";
                })(),
                fontWeight: "700",
              }}
            >
              {item.modalidad_nombre}
            </span>
          </div>
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
                marginTop: "2px",
                fontWeight: "700",
                color: "#024885",
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
              {`(${item.distancia_metros}m)`}
            </div>
          ) : null}
        </td>

        {/* Celda 5: Fecha Evento */}
    {/* Celda 5: Fecha Evento */}
        <td
          style={{
            ...styles.td,
            borderRight: "1px solid #e2e8f0",
            overflow: "hidden",
            textAlign: "center",
            backgroundColor: "#e8f5fd",
            borderLeft: "3px solid #024885",
          }}
        >
          <div
            style={{
              ...styles.txtB,
              whiteSpace: "normal",
              wordBreak: "break-word",
              fontWeight: "bold", // <-- Negrita agregada aquí
            }}
          >
            {formatearFechaConDia(item.fecha_evento)}
          </div>
        </td>

        {/* Celda 5.2: Hora */}
        <td
          style={{
            ...styles.td,
            borderRight: "1px solid #e2e8f0",
            overflow: "hidden",
            textAlign: "center",
            backgroundColor: "#e8f5fd",
            borderLeft: "3px solid #024885",
          }}
        >
          <div
            style={{
              ...styles.txtB,
              whiteSpace: "normal",
              wordBreak: "break-word",
              fontWeight: "bold", // <-- Negrita agregada aquí
            }}
          >
            {item.hora_llegada
              ? String(item.hora_llegada).slice(0, 5)
              : "S/H"}
          </div>
        </td>

        {/* Celda 6: Ubicación */}
        <td
          style={{
            ...styles.td,
            borderRight: "1px solid #e2e8f0",
            overflow: "hidden",
            backgroundColor: "#e8f5fd",
            borderLeft: "3px solid #024885",
          }}
        >
          <div style={styles.celdaTruncadaContainer}>
            <div
              style={{
                ...styles.txtB,
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
              title={item.label || item.via_nombre || "---"}
            >
              {item.nombre_lugar || "---"}
            </div>
            <div
              style={{
                ...styles.txtS,
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
              title={item.referencia || "Sin referencia"}
            >
              Ref: {item.referencia || "Sin referencia"}
            </div>
          </div>
        </td>

        {/* Celda 7: Cantidad de Fotos */}
       {/* Celda 7: Cantidad de Fotos */}
        <td
          style={{
            ...styles.td,
            textAlign: "center",
            borderLeft: "3px solid #024885",
            verticalAlign: "top",
            borderRight:
              filtro === "MIOS" ? "1px solid #e2e8f0" : "none",
          }}
        >
          {(() => {
            // Validar si fotos_json viene como string o array y filtrar nulos
            let total = 0;
            if (item.fotos_json) {
              try {
                const parsed = typeof item.fotos_json === "string" 
                  ? JSON.parse(item.fotos_json) 
                  : item.fotos_json;
                if (Array.isArray(parsed)) {
                  total = parsed.filter((f) => f && f !== "null").length;
                }
              } catch (e) {
                total = 0;
              }
            } else {
              total = Number(item.total_fotos || 0);
            }

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

        {/* Celda 8: Editar (Condicional) */}
        {filtro === "MIOS" && (
          <td
            style={{
              ...styles.td,
              textAlign: "center",
              verticalAlign: "top",
            }}
          >
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
                transition: "all 0.2s ease",
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

        {/* CONTENEDOR DE PAGINACIÓN COMPLETO CON SELECTOR DE FILAS */}
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
    const val = Number(e.target.value);
    // Seguridad extra: si excede 50, forzar 50
    setRegistrosPorPagina(val > 50 ? 50 : val);
    setPaginaActual(1); // Reiniciar a la página 1 al cambiar el límite
  }}
  style={{ padding: 6, borderRadius: 6, backgroundColor: '#fff' }}
>
  <option value={10}>10 </option>
  <option value={25}>25 </option>
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

      {/* MODAL DETALLE DE REGISTRO ACTIVO */}
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
                      {detalleSeleccionado.vehiculos_json ||
                        "---"}
                    </span>
                  </div>
                  <div style={styles.infoRowGrid}>
                    <span style={styles.infoLabel}>Personal PNP:</span>
                    <span style={styles.infoValue}>
                      {detalleSeleccionado.pnp_nombre_completo ||
                    
                        "---"}
                    </span>
                  </div>
<div style={styles.infoRowGrid}>
  <span style={styles.infoLabel}>Cámara(s):</span>
  <span style={styles.infoValue}>
    {Array.isArray(detalleSeleccionado.camaras_json) && detalleSeleccionado.camaras_json.length > 0 ? (
      <ol style={{ margin: 0, paddingLeft: '20px' }}>
        {detalleSeleccionado.camaras_json.map((camara, index) => (
          <li key={index}>{camara}</li>
        ))}
      </ol>
    ) : (
      <span>---</span>
    )}
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

                  <div style={{ ...styles.infoRowGrid, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
  <div style={{ textAlign: 'center', flex: 1 }}>
        <span style={styles.infoLabel}>Hora Alerta:</span>
    <div style={styles.infoValue}>
      {detalleSeleccionado.hora_alerta
        ? String(detalleSeleccionado.hora_alerta).substring(0, 5)
        : "S/H"}
    </div>
  </div>

  <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid #eee', borderRight: '1px solid #eee' }}>
         <span style={styles.infoLabel}>Hora Llegada:</span>
    <div style={styles.infoValue}>
      {detalleSeleccionado.hora_llegada
        ? String(detalleSeleccionado.hora_llegada).substring(0, 5)
        : "S/H"}
    </div>
  </div>

  <div style={{ textAlign: 'center', flex: 1 }}>
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
 {/* EVIDENCIAS FOTOGRÁFICAS */}
     {(() => {
  let fotosArray: any[] = [];
  try {
    const itemData = detalleSeleccionado as any;
    const fotosVal = itemData.fotos_json || itemData.lista_fotos || itemData.fotos;
    
    if (fotosVal) {
      // Si viene como string, lo parseamos; si ya es array, lo usamos
      const parsed = typeof fotosVal === "string" ? JSON.parse(fotosVal) : fotosVal;
      
      if (Array.isArray(parsed)) {
        // Aplanamos por si viene un array dentro de otro array y limpiamos cada ruta
        fotosArray = parsed.flat(Infinity)
                          .map(f => typeof f === "string" ? f.replace(/[\[\]'"]+/g, "").trim() : f)
                          .filter((f) => f && f !== "null" && f !== "");
      }
    } 
    
    if (fotosArray.length === 0 && itemData.foto_principal) {
      fotosArray = [String(itemData.foto_principal).replace(/[\[\]'"]+/g, "").trim()];
    }
  } catch (e) {
    fotosArray = [];
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
            const urlFotoFinal = obtenerUrlFoto(foto);

            return (
              <div
                key={idx}
                style={{
                  position: "relative",
                  display: "inline-block",
                }}
              >
                {/* Enlace que al hacer clic abre la foto original completa en Cloudflare R2 */}
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

                {/* Miniatura flotante al pasar el mouse */}
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

        {/* Estilo para activar el hover de la miniatura */}
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
  maxWidth: "1300px",
  width: "95%",
  height: "70vh",
  display: "flex",
  flexDirection: "column",
  marginLeft: "300px", // Mueve el modal 50px a la derecha
}}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Contenedor Principal de las Columnas */}
            <div
              style={{
                display: "flex",
                gap: "15px",
                flex: 1,
                overflow: "hidden",
                padding: "20px",
              }}
            >
              {/* COLUMNA 1: Campos Bloqueados y Modalidad */}
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
                      wordBreak: "break-word",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
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
                  {
                    label: "Origen:",
                    value: `${registroEditar.origen_descripcion ?? ""}`,
                  },
                  {
                    label: "Tipo Patrullaje:",
                    value: `${registroEditar.tipo_patrullaje_nombre ?? ""}`,
                  },
                  {
                    label: "Unidad:",
                    value: `${registroEditar.vehiculos_json ?? ""}`,
                  },
                  {
                    label: "Efectivo PNP:",
                    value: `${registroEditar.pnp_nombre_completo ?? ""}`,
                  },
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
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* COLUMNA 2: Edición de Fechas, Horas y Dirección */}
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
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    backgroundColor: "#fff",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#024885",
                      marginBottom: "4px",
                      fontWeight: "bold",
                    }}
                  >
                    FECHA DEL EVENTO
                  </div>
    <input 
  type="date"
  // Establece el límite máximo como el día de hoy (YYYY-MM-DD)
  max={new Date().toISOString().split("T")[0]}
  value={registroEditar?.fecha_evento ? registroEditar.fecha_evento.split("T")[0] : ""} 
  onChange={(e) => {
    const fechaSeleccionada = e.target.value;
    const hoy = new Date().toISOString().split("T")[0];

    // Validacion adicional por si el usuario ingresa la fecha manualmente
    if (fechaSeleccionada > hoy) {
      alert("No puedes seleccionar una fecha posterior al día de hoy.");
      return;
    }

    setRegistroEditar((prev: any) => ({
      ...prev,
      fecha_evento: fechaSeleccionada,
    }));
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

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {["hora_alerta", "hora_llegada", "hora_repliegue"].map(
                    (campo) => (
                      <div
                        key={campo}
                        style={{
                          padding: "10px",
                          border: "1px solid #e2e8f0",
                          borderRadius: "4px",
                          backgroundColor: "#fff",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#024885",
                            marginBottom: "4px",
                            fontWeight: "bold",
                          }}
                        >
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
                          defaultValue={
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

                {registroEditar.hora_alerta &&
                  registroEditar.hora_llegada &&
                  registroEditar.hora_repliegue &&
                  (() => {
                    const aMinutos = (horaStr: string) => {
                      const [h, m] = horaStr.split(":").map(Number);
                      return h * 60 + m;
                    };

                    const alerta = aMinutos(registroEditar.hora_alerta);
                    let llegada = aMinutos(registroEditar.hora_llegada);
                    let repliegue = aMinutos(registroEditar.hora_repliegue);

                    if (llegada < alerta) llegada += 1440;
                    if (repliegue < alerta) repliegue += 1440;
                    if (repliegue < llegada) repliegue += 1440;

                    const secuenciaCorrecta =
                      alerta <= llegada && llegada <= repliegue;
                    const dentroDe12Horas = repliegue - alerta <= 12 * 60;
                    const esInvalido = !secuenciaCorrecta || !dentroDe12Horas;

                    return (
                      esInvalido && (
                        <div
                          style={{
                            backgroundColor: "#FFF5F5",
                            borderLeftWidth: "4px",
                            borderLeftStyle: "solid",
                            borderLeftColor: "#D32F2F",
                            padding: "12px",
                            borderRadius: "4px",
                            display: "flex",
                            flexDirection: "column",
                            border: "1px solid #f5c6cb",
                          }}
                        >
                          <div
                            style={{
                              color: "#D32F2F",
                              fontSize: "12px",
                              fontWeight: "bold",
                            }}
                          >
                            Error en secuencia o rango de tiempo
                          </div>
                          <div
                            style={{
                              color: "#555",
                              fontSize: "11px",
                              marginTop: "2px",
                            }}
                          >
                            Secuencia: Alerta ➔ Llegada ➔ Repliegue (máximo 12
                            horas en total, permitiendo cruzar medianoche).
                          </div>
                        </div>
                      )
                    );
                  })()}

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
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#024885",
                      marginBottom: "4px",
                      fontWeight: "bold",
                    }}
                  >
                    DIRECCIÓN
                  </div>
         <div style={{ position: "relative", width: "100%", marginBottom: "8px" }}>
  {/* Campo de Entrada (Input) donde el usuario escribe directamente */}
  <input
    type="text"
    placeholder="Haga clic para seleccionar o escribir..."
    value={mostrarDesplegable ? filtroTexto : (registroEditar?.nombre_lugar ?? "")}
    onFocus={() => {
      setFiltroTexto(""); // Limpia el filtro al enfocar para mostrar todas las opciones
      setMostrarDesplegable(true);
    }}
    onChange={(e) => {
      setFiltroTexto(e.target.value);
      if (!mostrarDesplegable) setMostrarDesplegable(true);
    }}
    onBlur={() => {
      // Retraso breve para permitir que el clic en una opción se ejecute antes de cerrar
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
      cursor: "pointer",
    }}
  />

  {/* Flecha indicadora de desplegable */}
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

  {/* Lista Desplegable Flotante */}
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
      {Array.isArray(listaUbicaciones) &&
        listaUbicaciones
          .filter((lugar: any) =>
            (lugar.label || "").toLowerCase().includes(filtroTexto.toLowerCase())
          )
          .map((lugar: any, index: number) => (
            <div
              key={lugar.value || index}
              onMouseDown={() => {
                // Selecciona la opción y actualiza el estado
                setRegistroEditar((prev: any) => ({
                  ...prev,
                  nombre_lugar: lugar.label,
                  lugar_id: lugar.value,
                }));
                setMostrarDesplegable(false);
              }}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #f1f5f9",
                fontSize: "13px",
                color: "#334155",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
            >
              {lugar.label}
            </div>
          ))}

      {/* Mensaje cuando no encuentra coincidencias */}
      {Array.isArray(listaUbicaciones) &&
        listaUbicaciones.filter((lugar: any) =>
          (lugar.label || "").toLowerCase().includes(filtroTexto.toLowerCase())
        ).length === 0 && (
          <div style={{ padding: "10px", color: "#94a3b8", fontSize: "13px", textAlign: "center" }}>
            No se encontraron ubicaciones
          </div>
        )}
    </div>
  )}
</div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#024885",
                      marginBottom: "4px",
                      fontWeight: "bold",
                    }}
                  >
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
                    defaultValue={registroEditar.referencia ?? ""}
                    onChange={(e) =>
                      setRegistroEditar({
                        ...registroEditar,
                        referencia: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* COLUMNA 3: Datos Importantes (Descripción) */}
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
                  }}
                  defaultValue={registroEditar.ocurrencia_descripcion ?? ""}
                  onChange={(e) =>
                    setRegistroEditar({
                      ...registroEditar,
                      ocurrencia_descripcion: e.target.value,
                    })
                  }
                />
              </div>

              {/* COLUMNA 4: Evidencias Fotográficas (Grilla 2x2 optimizada) */}
              {/* COLUMNA 4: Evidencias Fotográficas (Versión optimizada con enlaces y hover para ahorrar RAM) */}
             {/* COLUMNA 4: Evidencias Fotográficas */}
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
    EVIDENCIAS ({(registroEditar?.lista_fotos || []).length} / 4)
  </div>

  <div style={{ padding: "10px", flex: 1, overflowY: "auto" }}>
    {(() => {
      const fotosArray = registroEditar?.lista_fotos || [];

      // Función para eliminar foto por índice
      const eliminarFoto = (indexAEliminar: number) => {
        const nuevasFotos = fotosArray.filter(
          (_: any, i: number) => i !== indexAEliminar
        );
        setRegistroEditar((prev: any) => ({
          ...prev,
          lista_fotos: nuevasFotos,
        }));
      };

      // Función auxiliar para comprimir imagen con Canvas antes de guardar en Base64
      const comprimirImagen = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const MAX_WIDTH = 1000;
              const MAX_HEIGHT = 1000;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;

              const ctx = canvas.getContext("2d");
              ctx?.drawImage(img, 0, 0, width, height);

              // Comprime a JPEG con 70% de calidad (reduce archivos de 5MB a ~120KB)
              const dataUrlComprimida = canvas.toDataURL("image/jpeg", 0.7);
              resolve(dataUrlComprimida);
            };
            img.onerror = (err) => reject(err);
          };
          reader.onerror = (err) => reject(err);
        });
      };

      // Manejo estandarizado y optimizado al seleccionar fotos locales
     const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const totalActual = fotosArray.length;
  const espacioDisponible = 4 - totalActual;

  if (espacioDisponible <= 0) {
    alert("Ya has alcanzado el límite máximo de 4 fotos.");
    return;
  }

  const archivosAProcesar = Array.from(files).slice(0, espacioDisponible);

  // LOG DE PRUEBA: Tamaño del primer archivo seleccionado
  const pesoOriginalMB = (archivosAProcesar[0].size / (1024 * 1024)).toFixed(2);
  console.log(`📸 Archivo original [1]: ${pesoOriginalMB} MB`);

  try {
    // 1. Procesamos y comprimimos cada foto antes de actualizar el estado
    const nuevasFotosComprimidas = await Promise.all(
      archivosAProcesar.map((file) => comprimirImagen(file))
    );

    // LOG DE PRUEBA: Tamaño del Base64 resultante tras la compresión
    const pesoBase64MB = (
      (nuevasFotosComprimidas[0].length * (3 / 4)) /
      (1024 * 1024)
    ).toFixed(2);
    console.log(`⚡ Base64 comprimido en Frontend [1]: ${pesoBase64MB} MB`);

    // 2. Guardamos la lista actualizada
    setRegistroEditar((prev: any) => ({
      ...prev,
      lista_fotos: [...(prev?.lista_fotos || []), ...nuevasFotosComprimidas],
    }));
  } catch (error) {
    console.error("Error comprimiendo las fotos en el cliente:", error);
  }

  // Notificar si se seleccionaron más fotos de las permitidas
  if (files.length > espacioDisponible) {
    alert(
      `Solo se pudieron agregar ${espacioDisponible} foto(s) más para respetar el límite máximo de 4.`
    );
  }

  // Limpiar el valor del input file para permitir seleccionar el mismo archivo si es necesario
  e.target.value = "";
};
      return (
        <div>
          <input
            type="file"
            id="fileInputEvidencias"
            style={{ display: "none" }}
            accept="image/*"
            multiple
            onChange={handleFileChange}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {/* Mapeo de URLs / Base64 */}
         
              {/* Mapeo de URLs / Base64 en Edición */}
{Array.isArray(fotosArray) &&
  fotosArray.map((foto: any, index: number) => {
    // CAMBIO CLAVE: Usamos la función robusta para limpiar y validar la URL de R2 o local
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
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "#024885",
            textDecoration: "none",
            cursor: "pointer",
          }}
          className="link-evidencia-edicion"
        >
          Ver Foto N° {index + 1}
        </a>

        {/* Preview Flotante */}
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

        {/* Botón eliminar */}
        <button
          type="button"
          onClick={() => eliminarFoto(index)}
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
    );
  })}
            {/* Botón agregar foto */}
            {fotosArray.length < 4 && (
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
                Agregar Foto ({fotosArray.length}/4)
              </button>
            )}
          </div>

          <style>{`
            .link-evidencia-edicion:hover + .tooltip-miniatura-edicion,
            .tooltip-miniatura-edicion:hover {
              display: block !important;
            }
          `}</style>
        </div>
      );
    })()}
  </div>
</div>
            </div>

            {/* BOTONES */}
            {/* BOTONES */}
            <div
              style={{
                padding: "20px",
                display: "flex",
                gap: "10px",
                borderTop: "1px solid #e2e8f0",
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
                  // Abre el modal de confirmación en lugar de guardar directamente
                  setModalConfirmacionOpen(true);
                }}
              >
                Actualizar cambios
              </button>
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

      <RegistroOcurrencia
        visible={modalInsertOpen === "camara"}
       onClose={() => {
          setModalInsertOpen(null);
          setFiltro("TODOS");       // <-- Redirige a TODOS
          setPaginaActual(1);
          fetchOcurrencias(1, registrosPorPagina);
          fetchTotalMisRegistros();
        }}
        initialData={{ idTipo: "camara" }}
      />
      <RegistroOcurrenciat
        visible={modalInsertOpen === "telefono"}
       onClose={() => {
          setModalInsertOpen(null);
          setFiltro("TODOS");       // <-- Redirige a TODOS
          setPaginaActual(1);
          fetchOcurrencias(1, registrosPorPagina);
          fetchTotalMisRegistros();
        }}
        initialData={{ idTipo: "telefono" }}
      />
      <RegistroBoton
        visible={modalInsertOpen === "boton"}
       onClose={() => {
          setModalInsertOpen(null);
          setFiltro("TODOS");       // <-- Redirige a TODOS
          setPaginaActual(1);
          fetchOcurrencias(1, registrosPorPagina);
          fetchTotalMisRegistros();
        }}
        initialData={{ idTipo: "boton" }}
      />

      <RegistroRedes
        visible={modalInsertOpen === "redes"}
       onClose={() => {
          setModalInsertOpen(null);
          setFiltro("TODOS");       // <-- Redirige a TODOS
          setPaginaActual(1);
          fetchOcurrencias(1, registrosPorPagina);
          fetchTotalMisRegistros();
        }}
        initialData={{ idTipo: "redes" }}
      />

       <RegistroOperador
        visible={modalInsertOpen === "operador"}
       onClose={() => {
          setModalInsertOpen(null);
          setFiltro("TODOS");       // <-- Redirige a TODOS
          setPaginaActual(1);
          fetchOcurrencias(1, registrosPorPagina);
          fetchTotalMisRegistros();
        }}
        initialData={{ idTipo: "operador" }}
      />
    </div>
  );
}

// ESTILOS CONSOLIDADOS Y OPTIMIZADOS
const styles: Record<string, React.CSSProperties | any> = {
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  tableScrollContainer: {
    overflowX: "auto",
    overflowY: "auto",
    minHeight: "515px",
    maxHeight: "70vh", // Esto limita la altura máxima de la tabla y activa el scroll vertical interno SOLO cuando superes esa altura (ideal si pones 25 o 50 filas)
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
    backgroundColor: "#f9fbfc",
    minHeight: "350vh",     // Permite que la página crezca de manera natural si hay más contenido
    width: "100%",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
    flexShrink: 0,
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
    flexShrink: 0,
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
    // ELIMINA O COMENTA: flex: 1 y minHeight: 0 para que la tarjeta no intente estirarse a la fuerza ocupando toda la pantalla vacía.
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
    fontSize: "12px",
    fontWeight: "600",
    outline: "none",
    cursor: "pointer",
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
};