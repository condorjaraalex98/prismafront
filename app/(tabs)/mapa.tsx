import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.19:3000";

export default function MapaCuadrantes() {
  const [datos, setDatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<"jv" | "pnp">("jv");

const webViewRef = useRef<any>(null);
const iframeRef = useRef<any>(null);
  const mapLoadedRef = useRef(false);
  const datosRef = useRef<any[]>([]);
  datosRef.current = datos;

  const cacheLocalRef = useRef<Partial<Record<"jv" | "pnp", any[]>>>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const enviarDatosAlMapa = useCallback((lista: any[]) => {
    if (!mapLoadedRef.current) return;

    if (Platform.OS === "web") {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "POLIGONOS", data: lista },
        "*"
      );
    } else if (webViewRef.current) {
      const jsonSeguro = JSON.stringify(lista)
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
      webViewRef.current.injectJavaScript(
        `if (window.renderPoligonos) { window.renderPoligonos(${jsonSeguro}); } true;`
      );
    }
  }, []);

  useEffect(() => {
    const cached = cacheLocalRef.current[tipo];
    if (cached) {
      setDatos(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setLoading(true);

    fetch(`${API_BASE_URL}/poligonos?tipo=${tipo}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!isMountedRef.current) return;
        const lista = Array.isArray(json) ? json : [];
        cacheLocalRef.current[tipo] = lista;
        setDatos(lista);
        setLoading(false);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        console.error("Error detallado en fetch:", e);
        if (isMountedRef.current) setLoading(false);
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tipo]);

  useEffect(() => {
    enviarDatosAlMapa(datos);
  }, [datos, enviarDatosAlMapa]);

  // HTML estático: Leaflet se carga UNA sola vez aunque cambies entre JV y PNP
  const mapHTML = useMemo(
    () => `
      <!DOCTYPE html>
      <html>
      <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
              body, html, #map { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
              .label-style { 
                  background: white; 
                  border: 1px solid #333; 
                  padding: 2px 5px; 
                  font-weight: bold; 
                  font-size: 10px;
                  border-radius: 3px;
              }
          </style>
      </head>
      <body>
          <div id="map"></div>
          <script>
              var map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([-12.04, -77.03], 13);
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  maxZoom: 19
              }).addTo(map);

              var group = L.featureGroup().addTo(map);

              window.renderPoligonos = function(lista) {
                  group.clearLayers();
                  if (!Array.isArray(lista) || lista.length === 0) return;

                  lista.forEach(function(item) {
                      if (item && item.geometria) {
                          var color = item.fuente === 'pnp' ? '#e74c3c' : '#024885';
                          var poly = L.geoJSON(item.geometria, {
                              coordsToLatLng: function (coords) {
                                  return (coords[0] > coords[1]) ? L.latLng(coords[0], coords[1]) : L.latLng(coords[1], coords[0]);
                              },
                              style: { color: color, weight: 2, fillOpacity: 0.3 }
                          }).addTo(group);

                          if (item.nombre) {
                              poly.bindTooltip(item.nombre, { 
                                  permanent: true, 
                                  direction: 'center', 
                                  className: 'label-style' 
                              });
                          }
                      }
                  });

                  var bounds = group.getBounds();
                  if (bounds.isValid()) {
                      setTimeout(function() { 
                          map.fitBounds(bounds, { padding: [20, 20] }); 
                      }, 150);
                  }
              };

              window.addEventListener('message', function(event) {
                  if (event && event.data && event.data.type === 'POLIGONOS') {
                      window.renderPoligonos(event.data.data);
                  }
              });
          </script>
      </body>
      </html>
    `,
    []
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={Platform.OS === "ios" ? ["top"] : []}
    >
      <View style={styles.container}>
        <View style={styles.selectorContainer}>
          <TouchableOpacity
            onPress={() => setTipo("jv")}
            style={[styles.btn, tipo === "jv" && styles.btnActive]}
          >
            <Text style={[styles.btnText, tipo === "jv" && styles.btnTextActive]}>
              JV
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTipo("pnp")}
            style={[styles.btn, tipo === "pnp" && styles.btnActive]}
          >
            <Text style={[styles.btnText, tipo === "pnp" && styles.btnTextActive]}>
              PNP
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          {Platform.OS === "web" ? (
            <iframe
              ref={iframeRef}
              srcDoc={mapHTML}
              onLoad={() => {
                mapLoadedRef.current = true;
                enviarDatosAlMapa(datosRef.current);
              }}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
            />
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: mapHTML }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onLoadEnd={() => {
                mapLoadedRef.current = true;
                enviarDatosAlMapa(datosRef.current);
              }}
            />
          )}

          {loading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#024885" />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  selectorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    zIndex: 10,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  btnActive: {
    backgroundColor: "#024885",
    borderColor: "#024885",
  },
  btnText: {
    fontWeight: "700",
    fontSize: 12,
    color: "#475569",
  },
  btnTextActive: {
    color: "#fff",
  },
  mapContainer: {
    flex: 1,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
loaderContainer: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(255, 255, 255, 0.85)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 20,
},
});