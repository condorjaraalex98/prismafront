import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import WebView from 'react-native-webview';

const { width } = Dimensions.get('window');
const isDesktop = width > 768;
const MJM_BLUE = '#024885';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";

// Caché global en memoria del cliente (expira en 5 minutos)
let memoriaCacheDatos: { poligonos: any[]; puntos: any[]; timestamp: number } | null = null;
const CACHE_TTL_CLIENTE = 5 * 60 * 1000;

export default function MapaLugaresPnpScreen() {
    const [poligonos, setPoligonos] = useState<any[]>([]);
    const [puntos, setPuntos] = useState<any[]>([]);
    const [searchText, setSearchText] = useState('');
    const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('TODOS');
    const [cuadrantesSeleccionados, setCuadrantesSeleccionados] = useState<string[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    
    const webViewRef = useRef<any>(null);
    const iframeRef = useRef<any>(null);

    const cargarDatos = useCallback(async (forzarServidor = false) => {
        const ahora = Date.now();

        // Si tenemos caché válida y no se fuerza recarga, la usamos de inmediato
        if (!forzarServidor && memoriaCacheDatos && (ahora - memoriaCacheDatos.timestamp < CACHE_TTL_CLIENTE)) {
            setPoligonos(memoriaCacheDatos.poligonos);
            setPuntos(memoriaCacheDatos.puntos);
            return;
        }

        setRefreshing(true);
        try {
            const response = await fetch(`${API_BASE_URL}/mapa-completo`);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            const data = await response.json();
            
            const nuevosPoligonos = data.poligonos || [];
            const nuevosPuntos = data.puntos || [];

            // Guardar en caché local
            memoriaCacheDatos = {
                poligonos: nuevosPoligonos,
                puntos: nuevosPuntos,
                timestamp: ahora
            };

            setPoligonos(nuevosPoligonos);
            setPuntos(nuevosPuntos);
        } catch (error) { 
            console.error("Error cargando datos:", error);
        } finally { 
            setRefreshing(false); 
        }
    }, []);

    useEffect(() => { 
        cargarDatos(false); 
    }, [cargarDatos]);

    // Tipos de lugar disponibles
    const tiposDisponibles = useMemo(() => {
        const tipos = puntos.map(p => p.tipo_lugar).filter(Boolean);
        return ['TODOS', ...Array.from(new Set(tipos))];
    }, [puntos]);

    // Cuadrantes disponibles (Incluye 'TODOS' al inicio)
    const cuadrantesDisponibles = useMemo(() => {
        const cuads = poligonos.map(p => p.nombre).filter(Boolean);
        const unicos = Array.from(new Set(cuads)).sort((a, b) => String(a).localeCompare(String(b)));
        return ['TODOS', ...unicos];
    }, [poligonos]);

    const toggleCuadrante = (cuadrante: string) => {
        if (cuadrante === 'TODOS') {
            setCuadrantesSeleccionados([]);
            return;
        }

        setCuadrantesSeleccionados(prev => 
            prev.includes(cuadrante) 
                ? prev.filter(c => c !== cuadrante) 
                : [...prev, cuadrante]
        );
    };

    const limpiarFiltros = () => {
        setTipoSeleccionado('TODOS');
        setCuadrantesSeleccionados([]);
        setSearchText('');
    };

    // Filtrar polígonos seleccionados en el mapa
    const poligonosFiltrados = useMemo(() => {
        if (cuadrantesSeleccionados.length === 0) return poligonos;
        return poligonos.filter(p => cuadrantesSeleccionados.includes(String(p.nombre).trim()));
    }, [poligonos, cuadrantesSeleccionados]);

    // Filtrar puntos
    const puntosFiltrados = useMemo(() => {
        return puntos.filter(p => {
            const cumpleTexto = searchText === '' || (
                (p.nombre_lugar?.toLowerCase() || "").includes(searchText.toLowerCase()) || 
                (p.direccion?.toLowerCase() || "").includes(searchText.toLowerCase()) ||
                (p.tipo_lugar?.toLowerCase() || "").includes(searchText.toLowerCase())
            );

            const cumpleTipo = tipoSeleccionado === 'TODOS' || p.tipo_lugar === tipoSeleccionado;
            
            const cuadrantePunto = String(p.id_pnp_cuadrante || '').trim();
            const cumpleCuadrante = cuadrantesSeleccionados.length === 0 || 
                cuadrantesSeleccionados.some(c => String(c).trim() === cuadrantePunto);
            
            return cumpleTexto && cumpleTipo && cumpleCuadrante;
        });
    }, [searchText, tipoSeleccionado, cuadrantesSeleccionados, puntos]);

    // Centrar mapa y abrir popup del punto seleccionado
    const centrarEnPunto = (id: number, lat: number, lon: number) => {
        if (!lat || !lon) return;
        const script = `if(typeof focusAndOpenPopup === 'function') { focusAndOpenPopup(${id}, ${lat}, ${lon}); }`;
        
        if (Platform.OS === 'web') {
            if (iframeRef.current && iframeRef.current.contentWindow) {
                iframeRef.current.contentWindow.eval(script);
            }
        } else {
            if (webViewRef.current) {
                webViewRef.current.injectJavaScript(script);
            }
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity style={styles.card} onPress={() => centrarEnPunto(item.id, item.latitud, item.longitud)}>
            <View style={styles.cardBody}>
                <View style={styles.rowBetween}>
                    <ThemedText style={styles.idLabel}>Cuadrante: {item.id_pnp_cuadrante || 'N/A'}</ThemedText>
                    <ThemedText style={styles.badgeTipo}>{item.tipo_lugar || 'LUGAR'}</ThemedText>
                </View>
                <ThemedText style={styles.titleLabel} numberOfLines={1}>{item.nombre_lugar}</ThemedText>
                <View style={styles.locationFooter}>
                    <Ionicons name="location-sharp" size={10} color="#888" />
                    <ThemedText style={styles.lugarLabel} numberOfLines={1}>{item.direccion || 'Sin dirección'}</ThemedText>
                </View>
            </View>
        </TouchableOpacity>
    );

    const mapHTML = useMemo(() => {
        const poligonosJS = JSON.stringify(poligonosFiltrados);
        const puntosJS = JSON.stringify(puntosFiltrados.filter(p => p.latitud && p.longitud));

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                    var map = L.map('map', { zoomControl: false }).setView([-12.04, -77.03], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

                    var group = L.featureGroup();
                    var markersMap = {}; 

                    var listaPoligonos = JSON.parse('${poligonosJS.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}');
                    listaPoligonos.forEach(function(item) {
                        if(item.geometria) {
                            var poly = L.geoJSON(item.geometria, {
                                coordsToLatLng: function (coords) {
                                    return (coords[0] > coords[1]) ? L.latLng(coords[0], coords[1]) : L.latLng(coords[1], coords[0]);
                                },
                                style: { color: '#e74c3c', weight: 2, fillOpacity: 0.15 }
                            }).addTo(group);

                            if(item.nombre) {
                                poly.bindTooltip("" + item.nombre, { 
                                    permanent: true, direction: 'center', className: 'label-style' 
                                });
                            }
                        }
                    });

                    function getIconForType(tipo) {
                        let iconClass = 'fa-solid fa-location-dot';
                        let bgColor = '#024885';

                        if (tipo && tipo.includes('TÁCTICO')) {
                            iconClass = 'fa-solid fa-triangle-exclamation';
                            bgColor = '#e74c3c';
                        } else if (tipo && tipo.includes('CONTROL')) {
                            iconClass = 'fa-solid fa-book';
                            bgColor = '#27ae60';
                        } else if (tipo && tipo.includes('ESCUELA')) {
                            iconClass = 'fa-solid fa-school';
                            bgColor = '#2980b9';
                        } else if (tipo && tipo.includes('DIRECCIÓN')) {
                            iconClass = 'fa-solid fa-building';
                            bgColor = '#8e44ad';
                        }

                        return L.divIcon({
                            html: '<div class="custom-marker" style="background-color: ' + bgColor + '; width: 30px; height: 30px;"><i class="' + iconClass + '"></i></div>',
                            className: '',
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        });
                    }

                    var listaPuntos = JSON.parse('${puntosJS.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}');
                    listaPuntos.forEach(function(o) {
                        var marker = L.marker([o.latitud, o.longitud], { icon: getIconForType(o.tipo_lugar) }).addTo(map);
                        marker.bindPopup(
                            "<b>" + (o.nombre_lugar || 'Lugar') + "</b><br>" +
                            "Tipo: <b>" + (o.tipo_lugar || 'N/A') + "</b><br>" +
                            "Cuadrante PNP: <b>" + (o.id_pnp_cuadrante || 'N/A') + "</b><br>" +
                            "<i>" + (o.direccion || '') + "</i>"
                        );
                        group.addLayer(marker);
                        if(o.id) {
                            markersMap[o.id] = marker;
                        }
                    });

                    group.addTo(map);
                    if(listaPoligonos.length > 0 || listaPuntos.length > 0) {
                        setTimeout(function(){ 
                            map.fitBounds(group.getBounds(), { padding: [25, 25] }); 
                        }, 300);
                    }

                    window.focusAndOpenPopup = function(id, lat, lon) {
                        map.setView([lat, lon], 17);
                        if(markersMap[id]) {
                            markersMap[id].openPopup();
                        }
                    };
                </script>
            </body>
            </html>
        `;
    }, [poligonosFiltrados, puntosFiltrados]);

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.rowBetween}>
                    <ThemedText style={styles.title}>Cuadrantes PNP y Puntos</ThemedText>
                    {(tipoSeleccionado !== 'TODOS' || cuadrantesSeleccionados.length > 0 || searchText !== '') && (
                        <TouchableOpacity onPress={limpiarFiltros} style={styles.clearButton}>
                            <ThemedText style={styles.clearButtonText}>Limpiar ✕</ThemedText>
                        </TouchableOpacity>
                    )}
                </View>
                
                {/* Filtro Tipos */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {tiposDisponibles.map((tipo) => (
                        <TouchableOpacity 
                            key={tipo} 
                            onPress={() => setTipoSeleccionado(tipo)}
                            style={[styles.filterChip, tipoSeleccionado === tipo && styles.filterChipActive]}
                        >
                            <ThemedText style={[styles.filterText, tipoSeleccionado === tipo && styles.filterTextActive]}>
                                {tipo}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Filtro Cuadrantes con TODOS incluido */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {cuadrantesDisponibles.map((cuadrante) => {
                        const esTodos = cuadrante === 'TODOS';
                        const seleccionado = esTodos ? cuadrantesSeleccionados.length === 0 : cuadrantesSeleccionados.includes(String(cuadrante));
                        return (
                            <TouchableOpacity 
                                key={String(cuadrante)} 
                                onPress={() => toggleCuadrante(String(cuadrante))}
                                style={[styles.cuadranteChip, seleccionado && styles.cuadranteChipActive]}
                            >
                                <ThemedText style={[styles.filterText, seleccionado && styles.filterTextActive]}>
                                    {cuadrante}
                                </ThemedText>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <View style={styles.searchBox}>
                    <TextInput 
                        placeholder="Buscar lugar, dirección..." 
                        style={styles.input}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    <TouchableOpacity onPress={() => cargarDatos(true)}>
                        <Ionicons name="reload" size={16} color={MJM_BLUE} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={isDesktop ? styles.layoutDesktop : { flex: 1 }}>
                <View style={styles.listContainer}>
                    <FlatList
                        data={puntosFiltrados}
                        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={{ padding: 8 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => cargarDatos(true)} />}
                    />
                </View>

                {/* Mapa con marco y fondo azul institucional */}
                <View style={styles.mapSide}>
                    {Platform.OS === 'web' ? (
                        <iframe ref={iframeRef} srcDoc={mapHTML} style={{ width: '100%', height: '100%', border: 'none' }} />
                    ) : (
                        <WebView 
                            ref={webViewRef}
                            originWhitelist={['*']} 
                            source={{ html: mapHTML }} 
                            style={{ flex: 1 }} 
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                        />
                    )}
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { padding: 10, paddingTop: 38, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
    title: { fontSize: 15, fontWeight: 'bold', color: MJM_BLUE, marginBottom: 4 },
    clearButton: { backgroundColor: '#ffe3e3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    clearButtonText: { fontSize: 10, color: '#c92a2a', fontWeight: 'bold' },
    filterScroll: { flexDirection: 'row', marginBottom: 4 },
    filterChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#f0f0f0', marginRight: 5, height: 24 },
    filterChipActive: { backgroundColor: '#e74c3c' },
    cuadranteChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#e9ecef', marginRight: 5, height: 24, borderWidth: 1, borderColor: '#ced4da' },
    cuadranteChipActive: { backgroundColor: MJM_BLUE, borderColor: MJM_BLUE },
    filterText: { fontSize: 10, fontWeight: '600', color: '#555' },
    filterTextActive: { color: '#fff' },
    searchBox: { flexDirection: 'row', backgroundColor: '#f1f3f5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignItems: 'center', marginTop: 2 },
    input: { flex: 1, fontSize: 12, height: 26 },
    layoutDesktop: { flex: 1, flexDirection: 'row' },
    listContainer: { flex: 1, maxWidth: isDesktop ? '32%' : '100%' },
    card: { backgroundColor: 'white', padding: 8, borderRadius: 6, marginBottom: 6, elevation: 1, borderWidth: 1, borderColor: '#eee' },
    cardBody: { flex: 1 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 },
    idLabel: { fontSize: 10, color: '#e74c3c', fontWeight: 'bold' },
    badgeTipo: { backgroundColor: '#34495e', color: '#fff', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: 'hidden', fontSize: 8, fontWeight: 'bold' },
    titleLabel: { fontSize: 12, fontWeight: 'bold', color: '#333', marginTop: 1 },
    locationFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 2 },
    lugarLabel: { fontSize: 10, color: '#888' },
    mapSide: { flex: 2.5, backgroundColor: MJM_BLUE, borderLeftWidth: 2, borderLeftColor: MJM_BLUE, minHeight: 350 }
});