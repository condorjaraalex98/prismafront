import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";

export default function MapaCuadrantes() {
    const [datos, setDatos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tipo, setTipo] = useState('jv'); // Solo 'jv' o 'pnp'

    useEffect(() => {
        setLoading(true);
        fetch(`${API_BASE_URL}/poligonos?tipo=${tipo}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(json => { 
                setDatos(json); 
                setLoading(false); 
            })
            .catch(e => {
                console.error("Error detallado en fetch:", e);
                setLoading(false);
            });
    }, [tipo]);

    const mapHTML = useMemo(() => {
        const jsonString = JSON.stringify(datos);

        return `
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
                    var map = L.map('map', { zoomControl: false }).setView([-12.04, -77.03], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19
                    }).addTo(map);

                    var lista = JSON.parse('${jsonString.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}');
                    var group = L.featureGroup();

                    lista.forEach(function(item) {
                        if(item.geometria) {
                            var color = item.fuente === 'pnp' ? '#e74c3c' : '#024885';
                            var poly = L.geoJSON(item.geometria, {
                                coordsToLatLng: function (coords) {
                                    return (coords[0] > coords[1]) ? L.latLng(coords[0], coords[1]) : L.latLng(coords[1], coords[0]);
                                },
                                style: { color: color, weight: 2, fillOpacity: 0.3 }
                            }).addTo(group);

                            if(item.nombre) {
                                poly.bindTooltip(item.nombre, { 
                                    permanent: true, 
                                    direction: 'center', 
                                    className: 'label-style' 
                                });
                            }
                        }
                    });

                    group.addTo(map);
                    if(lista.length > 0) {
                        setTimeout(function(){ 
                            map.fitBounds(group.getBounds(), { padding: [20, 20] }); 
                        }, 300);
                    }
                </script>
            </body>
            </html>
        `;
    }, [datos]);

    return (
        <SafeAreaView style={styles.safeArea} edges={Platform.OS === 'ios' ? ['top'] : []}>
            <View style={styles.container}>
                {/* Selector de Capas */}
                <View style={styles.selectorContainer}>
                    <TouchableOpacity onPress={() => setTipo('jv')} style={[styles.btn, tipo === 'jv' && styles.btnActive]}>
                        <Text style={[styles.btnText, tipo === 'jv' && styles.btnTextActive]}>JV</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTipo('pnp')} style={[styles.btn, tipo === 'pnp' && styles.btnActive]}>
                        <Text style={[styles.btnText, tipo === 'pnp' && styles.btnTextActive]}>PNP</Text>
                    </TouchableOpacity>
                </View>

                {/* Contenedor del Mapa */}
                <View style={styles.mapContainer}>
                    {Platform.OS === 'web' ? (
                        <iframe srcDoc={mapHTML} style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} />
                    ) : (
                        <WebView 
                            originWhitelist={['*']} 
                            source={{ html: mapHTML }} 
                            style={styles.webview}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
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
        backgroundColor: '#fff' 
    },
    container: { 
        flex: 1, 
        backgroundColor: '#f8fafc' 
    },
    selectorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        zIndex: 10,
    },
    btn: { 
        paddingVertical: 8, 
        paddingHorizontal: 32, 
        borderRadius: 8, 
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    btnActive: { 
        backgroundColor: '#024885',
        borderColor: '#024885'
    },
    btnText: { 
        fontWeight: '700', 
        fontSize: 12,
        color: '#475569' 
    },
    btnTextActive: { 
        color: '#fff' 
    },
    mapContainer: {
        flex: 1,
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
    },
    webview: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    loaderContainer: {

        backgroundColor: '#FFFFFF', // Blanco sólido limpio sin rastros de color rojo
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    }
});