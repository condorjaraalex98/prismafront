import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";
const MJM_BLUE = "#024885";
const ROJO_ALERTA = "#dc2626";
const VERDE_USO = "#15803d";

type TurnoCodigo = "M" | "T" | "N";
type FiltroTurno = "TODOS" | TurnoCodigo;

interface RegistroModalidad139Row {
  id_ocurrencia?: number;
  fecha_registro?: string;
  turno: TurnoCodigo;
  sector_asignado?: string | null;
  id_origen: number;
  origen_descripcion: string;
  id_tipo_vehiculo: number;
  tipo_vehiculo: string;
  id_tipop?: number;
  tipo_patrullaje: string;
  persona_registro: string | null;
  direccion?: string | null;
  numero_unidad?: string | number | null;
  placa?: string | null;
}

interface FlotaTipoRow {
  id_tipo_vehiculo: number;
  tipo_vehiculo: string;
  total_flota: number;
  unidades_flota?: string | null;
}

interface RegistroImpreso {
  uid: string;
  persona: string;
  extraCompleto: string;
  textoCompleto: string;
  placa: string | null;
  sector: string;
  esPrimeraDePlacaRepetida: boolean;
}

interface UnidadEnUsoDetalle {
  uid: string;
  unidadClave: string;
  persona: string;
  placa: string | null;
  esPrimeraDePlacaRepetida: boolean;
}

interface MosaicoTipoItem {
  key: string;
  tipo_vehiculo: string;
  disp: number;
  uso: number;
  total: number;
  unidadesEnUso: string[];
  detalleEnUso: UnidadEnUsoDetalle[];
  disponiblesLista: string[];
}

interface FilaMatrizFinal {
  key: string;
  baseLabel: string;
  etiquetaIzquierda: string;
  esSubUnidadMotorizado: boolean;
  esCabeceraMotorizado: boolean;
  porTurno: Record<TurnoCodigo, RegistroImpreso[]>;
  porSector: Record<string, RegistroImpreso[]>;
  totalRegistros: number;
}

const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const CABECERA_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

const normalizeSearch = (text: string): string =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function etiquetaTurno(turno: TurnoCodigo): string {
  if (turno === "M") return "MAÑANA";
  if (turno === "T") return "TARDE";
  return "NOCHE";
}

function normalizarSector(raw?: string | null): string {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return "SIN SECTOR";
  if (/^\d+$/.test(s)) {
    return `SECTOR ${parseInt(s, 10)}`;
  }
  return s;
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateYYYYMMDD(dateStr: string): Date {
  const parts = String(dateStr || "").split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return new Date();
  }
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(dt.getTime()) ? new Date() : dt;
}

function formatDateReadable(dateStr: string): string {
  const dt = parseDateYYYYMMDD(dateStr);
  return dt.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shiftDateString(dateStr: string, deltaDays: number): string {
  const dt = parseDateYYYYMMDD(dateStr);
  dt.setDate(dt.getDate() + deltaDays);
  return formatDateYYYYMMDD(dt);
}

function extraerNumeroUnidad(raw?: string | number | null): string {
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (!str) return "";
  const match = str.match(/\d+/);
  return match ? String(parseInt(match[0], 10)) : str;
}

function formatearUnidadOperativa(
  tipoVehiculoRaw: string | null | undefined,
  numeroUnidadRaw: string | number | null | undefined
): string | null {
  const nro = extraerNumeroUnidad(numeroUnidadRaw);
  if (!nro) return null;

  const tipoUpper = String(tipoVehiculoRaw || "").toUpperCase();

  if (tipoUpper.includes("AMBUL")) {
    return `ALFA ${nro}`;
  }
  if (tipoUpper.includes("CAMION")) {
    return `COBRA #${nro}`;
  }
  if (tipoUpper.includes("MOTO")) {
    return `LINCE #${nro}`;
  }
  return `#${nro}`;
}

function emptyPorTurno(): Record<TurnoCodigo, RegistroImpreso[]> {
  return { M: [], T: [], N: [] };
}

export default function MatrizModalidad139Screen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(() =>
    formatDateYYYYMMDD(new Date())
  );
  const [filtroTurno, setFiltroTurno] = useState<FiltroTurno>("TODOS");
  const [busquedaNombre, setBusquedaNombre] = useState<string>("");

  const [rawRows, setRawRows] = useState<RegistroModalidad139Row[]>([]);
  const [flotaPorTipo, setFlotaPorTipo] = useState<FlotaTipoRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [modalUsoKey, setModalUsoKey] = useState<string | null>(null);

  const [calendarioVisible, setCalendarioVisible] = useState<boolean>(false);
  const fechaInicialCal = parseDateYYYYMMDD(fechaSeleccionada);
  const [calAnio, setCalAnio] = useState<number>(fechaInicialCal.getFullYear());
  const [calMes, setCalMes] = useState<number>(fechaInicialCal.getMonth());

  const isMountedRef = useRef(true);
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      fetchAbortRef.current?.abort();
    };
  }, []);

  const fetchDatosDia = useCallback(
    async (esRefresh = false) => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      const timer = setTimeout(() => controller.abort(), 15000);

      try {
        if (!esRefresh) setLoading(true);
        setErrorMsg(null);

        const url = `${API_URL}/ocurrencias/matriz-unidades-dia?fecha=${encodeURIComponent(
          fechaSeleccionada
        )}`;

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!isMountedRef.current || fetchAbortRef.current !== controller) return;

        setRawRows(
          Array.isArray(data?.matriz_unidades) ? data.matriz_unidades : []
        );
        setFlotaPorTipo(
          Array.isArray(data?.flota_por_tipo) ? data.flota_por_tipo : []
        );
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        console.error("Error al cargar datos modalidad 139:", error);
        if (isMountedRef.current) {
          setErrorMsg("No se pudo cargar la información del día.");
          setRawRows([]);
        }
      } finally {
        clearTimeout(timer);
        if (isMountedRef.current && fetchAbortRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fechaSeleccionada]
  );

  useEffect(() => {
    fetchDatosDia(false);
  }, [fetchDatosDia]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDatosDia(true);
  };

  const abrirCalendario = () => {
    const dt = parseDateYYYYMMDD(fechaSeleccionada);
    setCalAnio(dt.getFullYear());
    setCalMes(dt.getMonth());
    setCalendarioVisible(true);
  };

  const placasRepetidasSet = useMemo(() => {
    const conteoPlaca = new Map<string, number>();
    rawRows.forEach((r) => {
      const pl = String(r?.placa || "").trim().toUpperCase();
      if (!pl) return;
      conteoPlaca.set(pl, (conteoPlaca.get(pl) || 0) + 1);
    });

    const repetidas = new Set<string>();
    conteoPlaca.forEach((cant, pl) => {
      if (cant >= 2) repetidas.add(pl);
    });
    return repetidas;
  }, [rawRows]);

  const filasFiltradasPorNombre = useMemo(() => {
    const terms = normalizeSearch(busquedaNombre)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) return rawRows;

    return rawRows.filter((r) => {
      const unid =
        formatearUnidadOperativa(r?.tipo_vehiculo, r?.numero_unidad) || "";
      const combinado = normalizeSearch(
        `${r?.persona_registro || ""} ${r?.direccion || ""} ${
          r?.placa || ""
        } ${normalizarSector(r?.sector_asignado)} ${unid}`
      );
      return terms.every((t) => combinado.includes(t));
    });
  }, [rawRows, busquedaNombre]);

  const mosaicoTiposVehiculo = useMemo<MosaicoTipoItem[]>(() => {
    const primeraAparicionPlacaModal = new Set<string>();

    return flotaPorTipo.map((ft, idx) => {
      const unidadesEnUso = new Set<string>();
      const detalleLista: UnidadEnUsoDetalle[] = [];

      filasFiltradasPorNombre.forEach((r, rIdx) => {
        if (Number(r?.id_tipo_vehiculo) !== Number(ft?.id_tipo_vehiculo))
          return;
        if (filtroTurno !== "TODOS" && r?.turno !== filtroTurno) return;

        const clave = formatearUnidadOperativa(
          ft?.tipo_vehiculo,
          r?.numero_unidad
        );
        if (!clave) return;

        unidadesEnUso.add(clave);

        const persona =
          String(r?.persona_registro || "SIN NOMBRE").trim() || "SIN NOMBRE";
        const placaUpper = String(r?.placa || "").trim().toUpperCase() || null;

        let esPrimeraDePlacaRepetida = false;
        if (placaUpper && placasRepetidasSet.has(placaUpper)) {
          const scopeKey = `modal_uso__${placaUpper}`;
          if (!primeraAparicionPlacaModal.has(scopeKey)) {
            primeraAparicionPlacaModal.add(scopeKey);
            esPrimeraDePlacaRepetida = true;
          }
        }

        detalleLista.push({
          uid: `${r?.id_ocurrencia ?? rIdx}_${clave}_${persona}_${rIdx}`,
          unidadClave: clave,
          persona,
          placa: placaUpper,
          esPrimeraDePlacaRepetida,
        });
      });

      const uso = unidadesEnUso.size;
      const total = Number(ft?.total_flota || 0);
      const disp = Math.max(total - uso, 0);

      const todasFormateadas = String(ft?.unidades_flota || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => formatearUnidadOperativa(ft?.tipo_vehiculo, x) || x);

      const disponiblesLista = todasFormateadas.filter(
        (u) => !unidadesEnUso.has(u)
      );

      return {
        key: `${ft?.id_tipo_vehiculo ?? idx}_${ft?.tipo_vehiculo ?? idx}`,
        tipo_vehiculo: String(ft?.tipo_vehiculo || "UNIDAD").toUpperCase(),
        disp,
        uso,
        total,
        unidadesEnUso: Array.from(unidadesEnUso),
        detalleEnUso: detalleLista,
        disponiblesLista,
      };
    });
  }, [flotaPorTipo, filasFiltradasPorNombre, filtroTurno, placasRepetidasSet]);

  const modalUsoTipo = useMemo(
    () => mosaicoTiposVehiculo.find((m) => m.key === modalUsoKey) || null,
    [mosaicoTiposVehiculo, modalUsoKey]
  );

  const totalesTurno = useMemo(() => {
    const counts: Record<TurnoCodigo, number> = { M: 0, T: 0, N: 0 };
    filasFiltradasPorNombre.forEach((r) => {
      const t = r?.turno;
      if (t === "M" || t === "T" || t === "N") {
        counts[t] += 1;
      }
    });
    const totalActivo =
      filtroTurno === "TODOS"
        ? counts.M + counts.T + counts.N
        : counts[filtroTurno];

    return { ...counts, totalActivo };
  }, [filasFiltradasPorNombre, filtroTurno]);

  const sectoresDelTurno = useMemo<string[]>(() => {
    if (filtroTurno === "TODOS") return [];
    const setSectores = new Set<string>();
    filasFiltradasPorNombre.forEach((r) => {
      if (r?.turno === filtroTurno) {
        setSectores.add(normalizarSector(r?.sector_asignado));
      }
    });
    const lista = Array.from(setSectores);
    return lista.length > 0
      ? lista.sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
        )
      : ["SIN SECTOR"];
  }, [filasFiltradasPorNombre, filtroTurno]);

  const totalesPorSector = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (filtroTurno === "TODOS") return map;

    filasFiltradasPorNombre.forEach((r) => {
      if (r?.turno !== filtroTurno) return;
      const sec = normalizarSector(r?.sector_asignado);
      map[sec] = (map[sec] || 0) + 1;
    });
    return map;
  }, [filasFiltradasPorNombre, filtroTurno]);

  const filasMatriz = useMemo<FilaMatrizFinal[]>(() => {
    const primeraAparicionMarcada = new Set<string>();

    const construirItem = (
      row: RegistroModalidad139Row,
      contextoScope: string,
      idx: number
    ): RegistroImpreso => {
      const persona =
        String(row?.persona_registro || "SIN NOMBRE").trim() || "SIN NOMBRE";

      const dirTrim = String(row?.direccion || "").trim();
      const direccionValida =
        dirTrim.length > 0 && !dirTrim.toUpperCase().startsWith("OTROS")
          ? dirTrim
          : null;

      const unidadClave = formatearUnidadOperativa(
        row?.tipo_vehiculo,
        row?.numero_unidad
      );

      const placaUpper = String(row?.placa || "").trim().toUpperCase() || null;
      const sector = normalizarSector(row?.sector_asignado);

      let esPrimeraDePlacaRepetida = false;
      if (placaUpper && placasRepetidasSet.has(placaUpper)) {
        const keyMarcado = `${contextoScope}__${placaUpper}`;
        if (!primeraAparicionMarcada.has(keyMarcado)) {
          primeraAparicionMarcada.add(keyMarcado);
          esPrimeraDePlacaRepetida = true;
        }
      }

      const partesExtra: string[] = [];
      if (direccionValida) partesExtra.push(`(${direccionValida})`);
      if (unidadClave) partesExtra.push(`[${unidadClave}]`);

      const extraCompleto = partesExtra.join(" ");
      const textoCompleto = extraCompleto
        ? `${persona} ${extraCompleto}`
        : persona;

      return {
        uid: `${row?.id_ocurrencia ?? idx}_${contextoScope}_${idx}`,
        persona,
        extraCompleto,
        textoCompleto,
        placa: placaUpper,
        sector,
        esPrimeraDePlacaRepetida,
      };
    };

    interface AcumuladorFila {
      porTurno: Record<TurnoCodigo, RegistroImpreso[]>;
      porSector: Record<string, RegistroImpreso[]>;
    }

    const crearAcumulador = (): AcumuladorFila => ({
      porTurno: emptyPorTurno(),
      porSector: {},
    });

    const agregarAFila = (
      acc: AcumuladorFila,
      turno: TurnoCodigo,
      item: RegistroImpreso
    ) => {
      acc.porTurno[turno].push(item);
      if (!acc.porSector[item.sector]) {
        acc.porSector[item.sector] = [];
      }
      acc.porSector[item.sector].push(item);
    };

    const finalizarFila = (
      key: string,
      baseLabel: string,
      acc: AcumuladorFila,
      esSubUnidadMotorizado = false,
      esCabeceraMotorizado = false
    ): FilaMatrizFinal => {
      const totalRegistros =
        filtroTurno === "TODOS"
          ? acc.porTurno.M.length + acc.porTurno.T.length + acc.porTurno.N.length
          : acc.porTurno[filtroTurno].length;

      const etiquetaIzquierda = esSubUnidadMotorizado
        ? `↳ ${baseLabel} (${totalRegistros})`
        : `${baseLabel} (${totalRegistros})`;

      return {
        key,
        baseLabel,
        etiquetaIzquierda,
        esSubUnidadMotorizado,
        esCabeceraMotorizado,
        porTurno: acc.porTurno,
        porSector: acc.porSector,
        totalRegistros,
      };
    };

    const patrullajesNormalesMap = new Map<string, AcumuladorFila>();
    const motorizadoTotal = crearAcumulador();
    const motorizadoUnidadesMap = new Map<string, AcumuladorFila>();

    filasFiltradasPorNombre.forEach((row, idx) => {
      const t = row?.turno;
      if (t !== "M" && t !== "T" && t !== "N") return;
      if (filtroTurno !== "TODOS" && t !== filtroTurno) return;

      const patrullaje =
        String(row?.tipo_patrullaje || "SIN ")
          .trim()
          .toUpperCase() || "SIN ";
      const tipoVehiculo =
        String(row?.tipo_vehiculo || "SIN TIPO VEHÍCULO")
          .trim()
          .toUpperCase() || "SIN TIPO VEHÍCULO";
      const esMotorizado = patrullaje.includes("MOTORIZADO");

      if (esMotorizado) {
        agregarAFila(
          motorizadoTotal,
          t,
          construirItem(row, "moto_header", idx)
        );

        if (!motorizadoUnidadesMap.has(tipoVehiculo)) {
          motorizadoUnidadesMap.set(tipoVehiculo, crearAcumulador());
        }
        agregarAFila(
          motorizadoUnidadesMap.get(tipoVehiculo)!,
          t,
          construirItem(row, `moto_u_${tipoVehiculo}`, idx)
        );
      } else {
        if (!patrullajesNormalesMap.has(patrullaje)) {
          patrullajesNormalesMap.set(patrullaje, crearAcumulador());
        }
        agregarAFila(
          patrullajesNormalesMap.get(patrullaje)!,
          t,
          construirItem(row, `pat_${patrullaje}`, idx)
        );
      }
    });

    const salida: FilaMatrizFinal[] = [];

    Array.from(patrullajesNormalesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([patrullaje, acc]) => {
        salida.push(
          finalizarFila(`pat_${patrullaje}`, patrullaje, acc, false, false)
        );
      });

    const tieneMotorizado =
      motorizadoTotal.porTurno.M.length +
        motorizadoTotal.porTurno.T.length +
        motorizadoTotal.porTurno.N.length >
      0;

    if (tieneMotorizado) {
      salida.push(
        finalizarFila("moto_header", "MOTORIZADO", motorizadoTotal, false, true)
      );

      Array.from(motorizadoUnidadesMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([unidadName, acc]) => {
          salida.push(
            finalizarFila(`moto_u_${unidadName}`, unidadName, acc, true, false)
          );
        });
    }

    return salida;
  }, [filasFiltradasPorNombre, filtroTurno, placasRepetidasSet]);

  const diasCalendario = useMemo(() => {
    const primerDia = new Date(calAnio, calMes, 1);
    const totalDias = new Date(calAnio, calMes + 1, 0).getDate();
    const offsetInicio = (primerDia.getDay() + 6) % 7;

    const celdas: (number | null)[] = [];
    for (let i = 0; i < offsetInicio; i++) celdas.push(null);
    for (let d = 1; d <= totalDias; d++) celdas.push(d);
    return celdas;
  }, [calAnio, calMes]);

  const esVistaPorSector = filtroTurno !== "TODOS";
  const colIzquierdaAncho = isDesktop ? 150 : 108;

  const renderRegistroUnAncho = (it: RegistroImpreso, esGrande = false) => {
    const colorTexto = it.esPrimeraDePlacaRepetida
      ? ROJO_ALERTA
      : esGrande
      ? MJM_BLUE
      : "#0f172a";

    return (
      <View key={it.uid} style={styles.registroLineaUnica}>
        <ThemedText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[
            esGrande ? styles.printedGrandeText : styles.printedTurnoText,
            { color: colorTexto },
            it.esPrimeraDePlacaRepetida && styles.textoPlacaRepetidaRojo,
          ]}
        >
          • {it.persona}
          {it.extraCompleto ? (
            <ThemedText
              numberOfLines={1}
              style={[
                esGrande ? styles.extraGrandeText : styles.extraTurnoText,
                it.esPrimeraDePlacaRepetida && styles.textoPlacaRepetidaRojo,
              ]}
            >
              {" "}
              {it.extraCompleto}
            </ThemedText>
          ) : null}
        </ThemedText>
      </View>
    );
  };

  const renderListaCelda = (items: RegistroImpreso[], esGrande = false) => {
    if (!items || items.length === 0) {
      return <ThemedText style={styles.dash}>-</ThemedText>;
    }
    return (
      <View style={{ width: "100%", gap: 3 }}>
        {items.map((it) => renderRegistroUnAncho(it, esGrande))}
      </View>
    );
  };

  return (
    <ThemedView style={styles.main}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={MJM_BLUE}
          />
        }
      >
        {/* ENCABEZADO */}
        <View style={styles.headerContainer}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.mainTitle}>
              REPORTE DE SERVICIO DIARIO • TOTAL: {totalesTurno.totalActivo}
            </ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              FECHA: {fechaSeleccionada} • TURNO:{" "}
              {filtroTurno === "TODOS" ? "TODOS" : etiquetaTurno(filtroTurno)}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="white" />
            <ThemedText style={styles.refreshButtonText}>Actualizar</ThemedText>
          </TouchableOpacity>
        </View>

        {/* FECHA ÚNICA + TURNO + BUSCADOR */}
        <View style={styles.card}>
          <View style={styles.dayNavigator}>
            <TouchableOpacity
              style={styles.dayStepBtn}
              onPress={() =>
                setFechaSeleccionada((prev) => shiftDateString(prev, -1))
              }
            >
              <Ionicons name="chevron-back" size={18} color={MJM_BLUE} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dayCenterBtn}
              onPress={abrirCalendario}
            >
              <Ionicons name="calendar-outline" size={16} color="#0369a1" />
              <ThemedText style={styles.dayCenterText}>
                {fechaSeleccionada}
              </ThemedText>
              <ThemedText style={styles.daySubText}>
                ({formatDateReadable(fechaSeleccionada)})
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dayStepBtn}
              onPress={() =>
                setFechaSeleccionada((prev) => shiftDateString(prev, 1))
              }
            >
              <Ionicons name="chevron-forward" size={18} color={MJM_BLUE} />
            </TouchableOpacity>
          </View>

          <View style={styles.turnoRow}>
            {(
              [
                {
                  key: "TODOS",
                  label: `TODOS (${
                    totalesTurno.M + totalesTurno.T + totalesTurno.N
                  })`,
                },
                { key: "M", label: `MAÑANA (${totalesTurno.M})` },
                { key: "T", label: `TARDE (${totalesTurno.T})` },
                { key: "N", label: `NOCHE (${totalesTurno.N})` },
              ] as const
            ).map((t) => {
              const active = filtroTurno === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.turnoChip, active && styles.turnoChipActive]}
                  onPress={() => setFiltroTurno(t.key)}
                >
                  <ThemedText
                    style={[
                      styles.turnoChipText,
                      active && styles.turnoChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {t.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre, sector, unidad o placa..."
              placeholderTextColor="#94a3b8"
              maxLength={80}
              value={busquedaNombre ?? ""}
              onChangeText={setBusquedaNombre}
            />
            {busquedaNombre.length > 0 && (
              <TouchableOpacity onPress={() => setBusquedaNombre("")}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* DISPONIBILIDAD POR TIPO DE VEHÍCULO */}
        <View style={styles.card}>
          <ThemedText style={styles.blockTitle}>
            Disponibilidad por Tipo de Vehículo
          </ThemedText>

          {mosaicoTiposVehiculo.length === 0 ? (
            <ThemedText style={styles.emptySmall}>
              Sin datos de flota para este día.
            </ThemedText>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mosaicoRow}
            >
              {mosaicoTiposVehiculo.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.mosaicoTile}
                  onPress={() => setModalUsoKey(item.key)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.mosaicoTitle} numberOfLines={1}>
                    {item.tipo_vehiculo}
                  </ThemedText>
                  <ThemedText style={styles.mosaicoStats} numberOfLines={1}>
                   {item.uso} en servicio
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* MATRIZ */}
        <View style={styles.sectionCard}>
          <ThemedText style={styles.blockTitle}>
            {esVistaPorSector
              ? `Turno ${etiquetaTurno(
                  filtroTurno as TurnoCodigo
                )} por Sector Asignado (Modalidad 139)`
              : "REPORTE DE SERVICIO"}
          </ThemedText>
          <View style={styles.divider} />

          {errorMsg ? (
            <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
          ) : loading ? (
            <ActivityIndicator
              size="large"
              color={MJM_BLUE}
              style={{ marginVertical: 30 }}
            />
          ) : filasMatriz.length === 0 ? (
            <ThemedText style={styles.emptySmall}>
              No hay registros para la fecha y turno seleccionados.
            </ThemedText>
          ) : esVistaPorSector ? (
            <ScrollView
              horizontal={!isDesktop && sectoresDelTurno.length > 2}
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={{
                minWidth: "100%",
                flexGrow: 1,
              }}
            >
              <View
                style={{
                  width: "100%",
                  minWidth:
                    !isDesktop && sectoresDelTurno.length > 2
                      ? colIzquierdaAncho + sectoresDelTurno.length * 115
                      : undefined,
                }}
              >
                <View style={styles.matrixRow}>
                  <View
                    style={[styles.headerCell, { width: colIzquierdaAncho, alignItems: "flex-start" }]}
                  >
                    <ThemedText style={styles.headerText} numberOfLines={1}>
                      
                    </ThemedText>
                  </View>

                  {sectoresDelTurno.map((sec) => (
                    <View
                      key={sec}
                      style={[styles.headerCell, styles.colFullFlex]}
                    >
                      <ThemedText style={styles.headerText} numberOfLines={1}>
                        {sec} ({totalesPorSector[sec] || 0})
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {filasMatriz.map((fila) => (
                  <View key={fila.key} style={styles.matrixRow}>
                    <View
                      style={[
                        styles.bodyCell,
                        { width: colIzquierdaAncho, alignItems: "flex-start" },
                        fila.esCabeceraMotorizado && styles.cellMotoHeader,
                        fila.esSubUnidadMotorizado && styles.cellMotoSubUnidad,
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.labelIzquierda,
                          fila.esCabeceraMotorizado && styles.labelMotoHeader,
                          fila.esSubUnidadMotorizado &&
                            styles.labelMotoSubUnidad,
                        ]}
                        numberOfLines={2}
                      >
                        {fila.etiquetaIzquierda}
                      </ThemedText>
                    </View>

                    {sectoresDelTurno.map((sec) => {
                      const items = fila.porSector[sec] || [];
                      return (
                        <View
                          key={`${fila.key}_${sec}`}
                          style={[
                            styles.bodyCell,
                            styles.colFullFlex,
                            !fila.esCabeceraMotorizado && styles.celdaGrande,
                            fila.esCabeceraMotorizado && styles.cellMotoHeader,
                            fila.esSubUnidadMotorizado &&
                              styles.cellMotoSubUnidad,
                            !fila.esCabeceraMotorizado &&
                              items.length > 0 &&
                              styles.celdaConDato,
                          ]}
                        >
                          {fila.esCabeceraMotorizado
                            ? null
                            : renderListaCelda(items, true)}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={{ width: "100%" }}>
              <View style={styles.matrixRow}>
                <View
                  style={[
                    styles.headerCell,
                    { width: colIzquierdaAncho, alignItems: "flex-start" },
                  ]}
                >
                  <ThemedText style={styles.headerText} numberOfLines={1}>
                 
                  </ThemedText>
                </View>

                {(["M", "T", "N"] as TurnoCodigo[]).map((t) => (
                  <View key={t} style={[styles.headerCell, styles.colFullFlex]}>
                    <ThemedText style={styles.headerText} numberOfLines={1}>
                      {etiquetaTurno(t)} ({totalesTurno[t]})
                    </ThemedText>
                  </View>
                ))}
              </View>

              {filasMatriz.map((fila) => (
                <View key={fila.key} style={styles.matrixRow}>
                  <View
                    style={[
                      styles.bodyCell,
                      { width: colIzquierdaAncho, alignItems: "flex-start" },
                      fila.esCabeceraMotorizado && styles.cellMotoHeader,
                      fila.esSubUnidadMotorizado && styles.cellMotoSubUnidad,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.labelIzquierda,
                        fila.esCabeceraMotorizado && styles.labelMotoHeader,
                        fila.esSubUnidadMotorizado && styles.labelMotoSubUnidad,
                      ]}
                      numberOfLines={2}
                    >
                      {fila.etiquetaIzquierda}
                    </ThemedText>
                  </View>

                  {(["M", "T", "N"] as TurnoCodigo[]).map((t) => {
                    const items = fila.porTurno[t] || [];
                    return (
                      <View
                        key={t}
                        style={[
                          styles.bodyCell,
                          styles.colFullFlex,
                          fila.esCabeceraMotorizado && styles.cellMotoHeader,
                          fila.esSubUnidadMotorizado && styles.cellMotoSubUnidad,
                          !fila.esCabeceraMotorizado &&
                            items.length > 0 &&
                            styles.celdaConDato,
                        ]}
                      >
                        {fila.esCabeceraMotorizado
                          ? null
                          : renderListaCelda(items, false)}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL UNIDADES EN USO */}
      <Modal
        visible={modalUsoTipo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalUsoKey(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalUsoKey(null)}
          />
          <View style={styles.modalContentVerde}>
            {modalUsoTipo && (
              <>
                <ThemedText style={styles.modalTitleVerde}>
                  {modalUsoTipo.tipo_vehiculo} • EN SERVICIO ({modalUsoTipo.uso})
                </ThemedText>
                <ThemedText style={styles.modalSub}>
                  Fecha: {fechaSeleccionada}
                </ThemedText>

                <ScrollView
                  style={styles.disponiblesModalScroll}
                  contentContainerStyle={styles.enUsoModalBoxVerde}
                  showsVerticalScrollIndicator={true}
                >
                  {modalUsoTipo.detalleEnUso.length > 0 ? (
                    modalUsoTipo.detalleEnUso.map((u) => (
                      <View key={u.uid} style={styles.filaPersonaUso}>
                        <ThemedText
                          numberOfLines={1}
                          style={[
                            styles.enUsoModalItemVerde,
                            u.esPrimeraDePlacaRepetida &&
                              styles.textoPlacaRepetidaRojo,
                          ]}
                        >
                          • {u.unidadClave} — {u.persona}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText style={styles.emptySmall}>
                      No hay unidades en uso para mostrar.
                    </ThemedText>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCloseButtonVerde}
                  onPress={() => setModalUsoKey(null)}
                >
                  <ThemedText style={styles.modalCloseText}>Cerrar</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL CALENDARIO */}
      <Modal
        visible={calendarioVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarioVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCalendarioVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.calHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (calMes === 0) {
                    setCalMes(11);
                    setCalAnio((y) => y - 1);
                  } else {
                    setCalMes((m) => m - 1);
                  }
                }}
                style={styles.calNavBtn}
              >
                <Ionicons name="chevron-back" size={18} color={MJM_BLUE} />
              </TouchableOpacity>

              <ThemedText style={styles.calTitle}>
                {MESES_ES[calMes]} {calAnio}
              </ThemedText>

              <TouchableOpacity
                onPress={() => {
                  if (calMes === 11) {
                    setCalMes(0);
                    setCalAnio((y) => y + 1);
                  } else {
                    setCalMes((m) => m + 1);
                  }
                }}
                style={styles.calNavBtn}
              >
                <Ionicons name="chevron-forward" size={18} color={MJM_BLUE} />
              </TouchableOpacity>
            </View>

            <View style={styles.calWeekRow}>
              {CABECERA_SEMANA.map((d, i) => (
                <ThemedText key={i} style={styles.calWeekDay}>
                  {d}
                </ThemedText>
              ))}
            </View>

            <View style={styles.calGrid}>
              {diasCalendario.map((diaNum, idx) => {
                if (!diaNum) {
                  return <View key={`empty_${idx}`} style={styles.calDayCell} />;
                }
                const iso = `${calAnio}-${String(calMes + 1).padStart(
                  2,
                  "0"
                )}-${String(diaNum).padStart(2, "0")}`;
                const seleccionado = iso === fechaSeleccionada;

                return (
                  <TouchableOpacity
                    key={iso}
                    style={[
                      styles.calDayCell,
                      seleccionado && styles.calDaySelected,
                    ]}
                    onPress={() => {
                      setFechaSeleccionada(iso);
                      setCalendarioVisible(false);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.calDayText,
                        seleccionado && { color: "white", fontWeight: "900" },
                      ]}
                    >
                      {diaNum}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setCalendarioVisible(false)}
            >
              <ThemedText style={styles.modalCloseTextDark}>Cerrar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { paddingHorizontal: 10, paddingVertical: 14, paddingBottom: 32 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  mainTitle: {
    fontSize: 14.5,
    fontWeight: "900",
    color: MJM_BLUE,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748b",
    marginTop: 2,
  },
  refreshButton: {
    backgroundColor: MJM_BLUE,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  refreshButtonText: { color: "white", fontSize: 11.5, fontWeight: "bold" },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 11,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dayNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 8,
  },
  dayStepBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dayCenterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#e0f2fe",
    borderColor: "#bae6fd",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  dayCenterText: { fontSize: 12, fontWeight: "900", color: "#0369a1" },
  daySubText: { fontSize: 10.5, fontWeight: "600", color: "#0284c7" },
  turnoRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 9,
    padding: 3,
    gap: 4,
  },
  turnoChip: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 7,
    alignItems: "center",
  },
  turnoChipActive: { backgroundColor: MJM_BLUE },
  turnoChipText: { fontSize: 10.5, fontWeight: "800", color: "#334155" },
  turnoChipTextActive: { color: "white" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    height: 38,
    marginTop: 8,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: "#0f172a",
  },
  blockTitle: {
    fontSize: 11.5,
    fontWeight: "900",
    color: MJM_BLUE,
    textTransform: "uppercase",
  },
  emptySmall: {
    fontSize: 11.5,
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: ROJO_ALERTA,
    textAlign: "center",
    paddingVertical: 12,
  },
  mosaicoRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    paddingRight: 4,
  },
  mosaicoTile: {
    minWidth: 132,
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mosaicoTitle: {
    fontSize: 11.5,
    fontWeight: "900",
    color: "#0f172a",
  },
  mosaicoStats: {
    fontSize: 10.5,
    fontWeight: "800",
     color: MJM_BLUE,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 8,
    borderLeftWidth: 4,
    borderLeftColor: MJM_BLUE,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    width: "100%",
  },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 8 },
  matrixRow: { flexDirection: "row", width: "100%" },
  headerCell: {
    backgroundColor: "#f1f5f9",
    borderWidth: 0.5,
    borderColor: "#cbd5e1",
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    fontSize: 9.5,
    fontWeight: "900",
    color: MJM_BLUE,
    textAlign: "center",
  },
  colFullFlex: {
    flex: 1,
    minWidth: 0,
  },
  bodyCell: {
    borderWidth: 0.5,
    borderColor: "#e2e8f0",
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: "center",
    backgroundColor: "white",
  },
  cellMotoHeader: { backgroundColor: "#e0f2fe" },
  cellMotoSubUnidad: { backgroundColor: "#f8fafc" },
  labelIzquierda: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 12.5,
  },
  labelMotoHeader: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0369a1",
  },
  labelMotoSubUnidad: {
    fontSize: 9,
    fontWeight: "700",
    color: "#334155",
    paddingLeft: 2,
  },
  celdaConDato: { backgroundColor: "#eff6ff" },
  registroLineaUnica: {
    width: "100%",
    overflow: "hidden",
  },
  printedTurnoText: {
    fontSize: 10.5,
    fontWeight: "800",
    lineHeight: 14,
  },
  extraTurnoText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 14,
  },

  celdaGrande: { minHeight: 58 },
  printedGrandeText: {
    fontSize: 11.5,
    fontWeight: "800",
    lineHeight: 15.5,
  },
  extraGrandeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1e3a8a",
    lineHeight: 15.5,
  },
  textoPlacaRepetidaRojo: {
    color: ROJO_ALERTA,
    fontWeight: "900",
  },
  dash: { fontSize: 11, color: "#cbd5e1", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    width: "100%",
    maxWidth: 350,
    maxHeight: "82%",
  },
  modalContentVerde: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    borderWidth: 2,
    borderColor: "#86efac",
  },
  modalTitleVerde: {
    fontSize: 15,
    fontWeight: "900",
    color: VERDE_USO,
    textAlign: "center",
  },
  modalSub: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    marginTop: 3,
    marginBottom: 12,
  },
  disponiblesModalScroll: {
    maxHeight: 330,
  },
  enUsoModalBoxVerde: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  filaPersonaUso: {
    width: "100%",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dcfce7",
  },
enUsoModalItemVerde: {
    fontSize: 9,
    fontWeight: "800",
    color: VERDE_USO,
    lineHeight: 17,
  },
  modalCloseButtonVerde: {
    marginTop: 14,
    backgroundColor: VERDE_USO,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
  },
  calHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  calNavBtn: { padding: 6, backgroundColor: "#f1f5f9", borderRadius: 8 },
  calTitle: { fontSize: 13.5, fontWeight: "900", color: MJM_BLUE },
  calWeekRow: { flexDirection: "row", marginBottom: 4 },
  calWeekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
  },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calDayCell: {
    width: "14.28%",
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  calDaySelected: { backgroundColor: MJM_BLUE },
  calDayText: { fontSize: 11.5, fontWeight: "700", color: "#0f172a" },
  modalCloseButton: {
    marginTop: 14,
    backgroundColor: "#e2e8f0",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseText: { fontSize: 11.5, fontWeight: "bold", color: "white" },
  modalCloseTextDark: { fontSize: 11.5, fontWeight: "bold", color: "#334155" },
});