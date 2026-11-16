import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";

const MJM_BLUE = "#024885";
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";

let memoriaCacheDatos: {
  poligonos: any[];
  puntos: any[];
  timestamp: number;
} | null = null;
const CACHE_TTL_CLIENTE = 5 * 60 * 1000;

const normalizeText = (text: string): string =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getPointKey = (p: any, fallbackIdx?: number): string => {
  const prefix = p?.tipo_lugar === "CÁMARA DE VIDEO" ? "cam" : "lug";
  return `${prefix}_${p?.id ?? fallbackIdx ?? "na"}`;
};

const mostrarAlerta = (titulo: string, mensaje: string) => {
  if (Platform.OS === "web") {
    window.alert(`${titulo}\n\n${mensaje}`);
  } else {
    Alert.alert(titulo, mensaje);
  }
};

export default function MapaLugaresPnpScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width > 768;

  const [poligonos, setPoligonos] = useState<any[]>([]);
  const [puntos, setPuntos] = useState<any[]>([]);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>("TODOS");
  const [cuadrantesSeleccionados, setCuadrantesSeleccionados] = useState<
    string[]
  >([]);
  const [refreshing, setRefreshing] = useState(false);

  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const isMountedRef = useRef(true);
  const loadingRef = useRef(false);
  const activeFetchControllerRef = useRef<AbortController | null>(null);
  const mapLoadedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeFetchControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchText]);

  const cargarDatos = useCallback(async (forzarServidor = false) => {
    const ahora = Date.now();

    if (
      !forzarServidor &&
      memoriaCacheDatos &&
      ahora - memoriaCacheDatos.timestamp < CACHE_TTL_CLIENTE
    ) {
      setPoligonos(memoriaCacheDatos.poligonos);
      setPuntos(memoriaCacheDatos.puntos);
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;
    setRefreshing(true);

    activeFetchControllerRef.current?.abort();
    const controller = new AbortController();
    activeFetchControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${API_BASE_URL}/mapa-completo`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();

      const nuevosPoligonos = Array.isArray(data?.poligonos)
        ? data.poligonos
        : [];
      const nuevosPuntos = Array.isArray(data?.puntos) ? data.puntos : [];

      memoriaCacheDatos = {
        poligonos: nuevosPoligonos,
        puntos: nuevosPuntos,
        timestamp: Date.now(),
      };

      if (!isMountedRef.current) return;
      setPoligonos(nuevosPoligonos);
      setPuntos(nuevosPuntos);
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      console.error("Error cargando datos del mapa:", error);
      if (isMountedRef.current) {
        mostrarAlerta(
          "Error",
          "No se pudieron cargar los cuadrantes y puntos del mapa."
        );
      }
    } finally {
      clearTimeout(timeoutId);
      loadingRef.current = false;
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    cargarDatos(false);
  }, [cargarDatos]);

  const tiposDisponibles = useMemo(() => {
    const tipos = puntos.map((p) => p.tipo_lugar).filter(Boolean);
    return ["TODOS", ...Array.from(new Set(tipos))];
  }, [puntos]);

  const cuadrantesDisponibles = useMemo(() => {
    const cuads = poligonos
      .map((p) => (p?.nombre ? String(p.nombre).trim() : ""))
      .filter(Boolean);
    const unicos = Array.from(new Set(cuads)).sort((a, b) =>
      a.localeCompare(b)
    );
    return ["TODOS", ...unicos];
  }, [poligonos]);

  const toggleCuadrante = useCallback((cuadrante: string) => {
    if (cuadrante === "TODOS") {
      setCuadrantesSeleccionados([]);
      return;
    }
    setCuadrantesSeleccionados((prev) =>
      prev.includes(cuadrante)
        ? prev.filter((c) => c !== cuadrante)
        : [...prev, cuadrante]
    );
  }, []);

  const limpiarFiltros = useCallback(() => {
    setTipoSeleccionado("TODOS");
    setCuadrantesSeleccionados([]);
    setSearchText("");
    setDebouncedSearch("");
  }, []);

  const poligonosFiltrados = useMemo(() => {
    if (cuadrantesSeleccionados.length === 0) return poligonos;
    return poligonos.filter((p) =>
      cuadrantesSeleccionados.includes(String(p.nombre || "").trim())
    );
  }, [poligonos, cuadrantesSeleccionados]);

  const puntosFiltrados = useMemo(() => {
    const searchTerms = normalizeText(debouncedSearch)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return puntos.filter((p) => {
      if (searchTerms.length > 0) {
        const textoCombinado = normalizeText(
          `${p.nombre_lugar || ""} ${p.direccion || ""} ${
            p.tipo_lugar || ""
          } ${p.id_pnp_cuadrante || ""}`
        );
        if (!searchTerms.every((term) => textoCombinado.includes(term))) {
          return false;
        }
      }

      const cumpleTipo =
        tipoSeleccionado === "TODOS" || p.tipo_lugar === tipoSeleccionado;

      const cuadrantePunto = String(p.id_pnp_cuadrante || "").trim();
      const cumpleCuadrante =
        cuadrantesSeleccionados.length === 0 ||
        cuadrantesSeleccionados.some(
          (c) => String(c).trim() === cuadrantePunto
        );

      return cumpleTipo && cumpleCuadrante;
    });
  }, [debouncedSearch, tipoSeleccionado, cuadrantesSeleccionados, puntos]);

  const puntosParaMapa = useMemo(() => {
    return puntosFiltrados
      .map((p, idx) => ({
        ...p,
        latNum: Number(p.latitud),
        lonNum: Number(p.longitud),
        pointKey: getPointKey(p, idx),
      }))
      .filter(
        (p) =>
          Number.isFinite(p.latNum) &&
          Number.isFinite(p.lonNum) &&
          !(p.latNum === 0 && p.lonNum === 0)
      );
  }, [puntosFiltrados]);

  const enviarMensajeAlMapa = useCallback((payload: Record<string, any>) => {
    if (Platform.OS === "web") {
      iframeRef.current?.contentWindow?.postMessage(payload, "*");
    } else if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(payload));
    }
  }, []);

  const syncMapData = useCallback(() => {
    if (!mapLoadedRef.current) return;
    enviarMensajeAlMapa({
      type: "UPDATE_DATA",
      poligonos: poligonosFiltrados,
      puntos: puntosParaMapa,
    });
  }, [enviarMensajeAlMapa, poligonosFiltrados, puntosParaMapa]);

  useEffect(() => {
    syncMapData();
  }, [syncMapData]);

  const centrarEnPunto = useCallback(
    (item: any) => {
      const lat = Number(item.latitud);
      const lon = Number(item.longitud);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        (lat === 0 && lon === 0)
      ) {
        return;
      }
      enviarMensajeAlMapa({
        type: "FOCUS_POINT",
        pointKey: getPointKey(item),
        lat,
        lon,
      });
    },
    [enviarMensajeAlMapa]
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <TouchableOpacity
        style={styles.card}
        onPress={() => centrarEnPunto(item)}
      >
        <View style={styles.cardBody}>
          <View style={styles.rowBetween}>
            <ThemedText style={styles.idLabel}>
              Cuadrante: {item.id_pnp_cuadrante || "N/A"}
            </ThemedText>
            <ThemedText style={styles.badgeTipo}>
              {item.tipo_lugar || "LUGAR"}
            </ThemedText>
          </View>
          <ThemedText style={styles.titleLabel} numberOfLines={1}>
            {item.nombre_lugar}
          </ThemedText>
          <View style={styles.locationFooter}>
            <Ionicons name="location-sharp" size={10} color="#888" />
            <ThemedText style={styles.lugarLabel} numberOfLines={1}>
              {item.direccion || "Sin dirección"}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [centrarEnPunto]
  );

  const mapHTML = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { height: 100vh; width: 100vw; margin: 0; padding: 0; background-color: #024885; }
          .label-style {
            background: white; border: 1px solid #333; padding: 1px 3px;
            font-weight: bold; font-size: 9px; border-radius: 3px;
          }
          .custom-marker {
            display: flex;
            align-items: center;
            justify-content: center;
            background: #024885;
            color: white;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
          }

          var map = L.map('map', { zoomControl: false }).setView([-12.04, -77.03], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

          var masterGroup = L.featureGroup().addTo(map);
          var poligonosLayer = L.featureGroup().addTo(masterGroup);
          var puntosLayer = L.featureGroup().addTo(masterGroup);
          var markersMap = {};

          function getIconForType(tipo) {
            var t = String(tipo || '').toUpperCase();
            var iconClass = 'fa-solid fa-location-dot';
            var bgColor = '#024885';

            if (t.indexOf('CÁMARA') !== -1 || t.indexOf('CAMARA') !== -1) {
              iconClass = 'fa-solid fa-video';
              bgColor = '#0f766e';
            } else if (t.indexOf('TÁCTICO') !== -1 || t.indexOf('TACTICO') !== -1) {
              iconClass = 'fa-solid fa-triangle-exclamation';
              bgColor = '#e74c3c';
            } else if (t.indexOf('CONTROL') !== -1) {
              iconClass = 'fa-solid fa-book';
              bgColor = '#27ae60';
            } else if (t.indexOf('ESCUELA') !== -1) {
              iconClass = 'fa-solid fa-school';
              bgColor = '#2980b9';
            } else if (t.indexOf('DIRECCIÓN') !== -1 || t.indexOf('DIRECCION') !== -1) {
              iconClass = 'fa-solid fa-building';
              bgColor = '#8e44ad';
            }

            return L.divIcon({
              html: '<div class="custom-marker" style="background-color:' + bgColor + '; width:30px; height:30px;"><i class="' + iconClass + '"></i></div>',
              className: '',
              iconSize: [30, 30],
              iconAnchor: [15, 15]
            });
          }

          function updateMapData(listaPoligonos, listaPuntos) {
            poligonosLayer.clearLayers();
            puntosLayer.clearLayers();
            markersMap = {};

            (listaPoligonos || []).forEach(function(item) {
              if (!item || !item.geometria) return;
              try {
                var poly = L.geoJSON(item.geometria, {
                  coordsToLatLng: function(coords) {
                    return (coords[0] > coords[1])
                      ? L.latLng(coords[0], coords[1])
                      : L.latLng(coords[1], coords[0]);
                  },
                  style: { color: '#e74c3c', weight: 2, fillOpacity: 0.15 }
                });

                if (item.nombre) {
                  poly.bindTooltip(escapeHtml(item.nombre), {
                    permanent: true,
                    direction: 'center',
                    className: 'label-style'
                  });
                }
                poligonosLayer.addLayer(poly);
              } catch (e) {}
            });

            (listaPuntos || []).forEach(function(o) {
              if (!o || typeof o.latNum !== 'number' || typeof o.lonNum !== 'number') return;
              var marker = L.marker([o.latNum, o.lonNum], { icon: getIconForType(o.tipo_lugar) });
              marker.bindPopup(
                '<b>' + escapeHtml(o.nombre_lugar || 'Lugar') + '</b><br>' +
                'Tipo: <b>' + escapeHtml(o.tipo_lugar || 'N/A') + '</b><br>' +
                'Cuadrante PNP: <b>' + escapeHtml(o.id_pnp_cuadrante || 'N/A') + '</b><br>' +
                '<i>' + escapeHtml(o.direccion || '') + '</i>'
              );
              puntosLayer.addLayer(marker);
              if (o.pointKey) {
                markersMap[o.pointKey] = marker;
              }
            });

            try {
              var bounds = masterGroup.getBounds();
              if (bounds && bounds.isValid()) {
                map.fitBounds(bounds, { padding: [25, 25] });
              }
            } catch (e) {}
          }

          function focusAndOpenPopup(pointKey, lat, lon) {
            if (typeof lat === 'number' && typeof lon === 'number') {
              map.setView([lat, lon], 17);
            }
            if (pointKey && markersMap[pointKey]) {
              markersMap[pointKey].openPopup();
            }
          }

          function handleIncomingMessage(event) {
            var msg = event && event.data;
            if (typeof msg === 'string') {
              try { msg = JSON.parse(msg); } catch (e) { return; }
            }
            if (!msg || typeof msg !== 'object') return;

            if (msg.type === 'UPDATE_DATA') {
              updateMapData(msg.poligonos, msg.puntos);
            } else if (msg.type === 'FOCUS_POINT') {
              focusAndOpenPopup(msg.pointKey, msg.lat, msg.lon);
            }
          }

          window.addEventListener('message', handleIncomingMessage);
          document.addEventListener('message', handleIncomingMessage);
        </script>
      </body>
      </html>
    `;
  }, []);

  const hayFiltrosActivos =
    tipoSeleccionado !== "TODOS" ||
    cuadrantesSeleccionados.length > 0 ||
    searchText !== "";

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 12 : Math.max(insets.top, 12) },
        ]}
      >
        <View style={styles.rowBetween}>
          <ThemedText style={styles.title}>
            Cuadrantes PNP y Puntos ({puntosFiltrados.length})
          </ThemedText>
          {hayFiltrosActivos && (
            <TouchableOpacity
              onPress={limpiarFiltros}
              style={styles.clearButton}
            >
              <ThemedText style={styles.clearButtonText}>Limpiar ✕</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Filtro Tipos */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {tiposDisponibles.map((tipo) => (
            <TouchableOpacity
              key={tipo}
              onPress={() => setTipoSeleccionado(tipo)}
              style={[
                styles.filterChip,
                tipoSeleccionado === tipo && styles.filterChipActive,
              ]}
            >
              <ThemedText
                style={[
                  styles.filterText,
                  tipoSeleccionado === tipo && styles.filterTextActive,
                ]}
              >
                {tipo}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filtro Cuadrantes con TODOS incluido */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {cuadrantesDisponibles.map((cuadrante) => {
            const esTodos = cuadrante === "TODOS";
            const seleccionado = esTodos
              ? cuadrantesSeleccionados.length === 0
              : cuadrantesSeleccionados.includes(String(cuadrante));
            return (
              <TouchableOpacity
                key={String(cuadrante)}
                onPress={() => toggleCuadrante(String(cuadrante))}
                style={[
                  styles.cuadranteChip,
                  seleccionado && styles.cuadranteChipActive,
                ]}
              >
                <ThemedText
                  style={[
                    styles.filterText,
                    seleccionado && styles.filterTextActive,
                  ]}
                >
                  {cuadrante}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchBox}>
          <TextInput
            placeholder="Buscar lugar, dirección..."
            placeholderTextColor="#888"
            style={styles.input}
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity
            disabled={refreshing}
            onPress={() => cargarDatos(true)}
          >
            <Ionicons
              name="reload"
              size={16}
              color={refreshing ? "#999" : MJM_BLUE}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={isDesktop ? styles.layoutDesktop : { flex: 1 }}>
        <View
          style={[
            styles.listContainer,
            isDesktop && styles.listContainerDesktop,
          ]}
        >
          <FlatList
            data={puntosFiltrados}
            keyExtractor={(item, index) =>
              `${getPointKey(item, index)}_${index}`
            }
            renderItem={renderItem}
            contentContainerStyle={{ padding: 8 }}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={7}
            removeClippedSubviews={Platform.OS !== "web"}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <ThemedText style={styles.emptyText}>
                  {refreshing
                    ? "Cargando puntos..."
                    : "No hay puntos para los filtros seleccionados."}
                </ThemedText>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => cargarDatos(true)}
              />
            }
          />
        </View>

        {/* Mapa con marco y fondo azul institucional */}
        <View style={styles.mapSide}>
          {Platform.OS === "web" ? (
            <iframe
              ref={iframeRef}
              srcDoc={mapHTML}
              title="Mapa Cuadrantes PNP"
              onLoad={() => {
                mapLoadedRef.current = true;
                syncMapData();
              }}
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: mapHTML }}
              style={{ flex: 1 }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onLoadEnd={() => {
                mapLoadedRef.current = true;
                syncMapData();
              }}
            />
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    padding: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 15, fontWeight: "bold", color: MJM_BLUE, marginBottom: 4 },
  clearButton: {
    backgroundColor: "#ffe3e3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  clearButtonText: { fontSize: 10, color: "#c92a2a", fontWeight: "bold" },
  filterScroll: { flexDirection: "row", marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    marginRight: 5,
    height: 24,
  },
  filterChipActive: { backgroundColor: "#e74c3c" },
  cuadranteChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#e9ecef",
    marginRight: 5,
    height: 24,
    borderWidth: 1,
    borderColor: "#ced4da",
  },
  cuadranteChipActive: { backgroundColor: MJM_BLUE, borderColor: MJM_BLUE },
  filterText: { fontSize: 10, fontWeight: "600", color: "#555" },
  filterTextActive: { color: "#fff" },
  searchBox: {
    flexDirection: "row",
    backgroundColor: "#f1f3f5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 2,
  },
  input: { flex: 1, fontSize: 12, height: 26, color: "#000" },
  layoutDesktop: { flex: 1, flexDirection: "row" },
  listContainer: { flex: 1, maxWidth: "100%" },
  listContainerDesktop: { maxWidth: "32%" },
  card: {
    backgroundColor: "white",
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardBody: { flex: 1 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 1,
  },
  idLabel: { fontSize: 10, color: "#e74c3c", fontWeight: "bold" },
  badgeTipo: {
    backgroundColor: "#34495e",
    color: "#fff",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: "hidden",
    fontSize: 8,
    fontWeight: "bold",
  },
  titleLabel: { fontSize: 12, fontWeight: "bold", color: "#333", marginTop: 1 },
  locationFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 2,
  },
  lugarLabel: { fontSize: 10, color: "#888" },
  emptyBox: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 12, color: "#666", textAlign: "center" },
  mapSide: {
    flex: 2.5,
    backgroundColor: MJM_BLUE,
    borderLeftWidth: 2,
    borderLeftColor: MJM_BLUE,
    minHeight: 350,
  },
});