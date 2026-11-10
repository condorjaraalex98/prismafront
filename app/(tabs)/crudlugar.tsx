import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as XLSX from "xlsx";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.17:3000";
const MJM_BLUE = "#024885";

const ThemedText = ({ style, children, ...props }: any) => (
  <Text style={style} {...props}>
    {children}
  </Text>
);

const INITIAL_LUGAR_STATE = {
  nombre_lugar: "",
  id_tipo_lugar: null,
  id_tipo_via: null,
  id_via: null,
  id_cuadra: null,
  latitud: -12.065247,
  longitud: -77.044894,
  estado: 1,
  unidad_encargada: "SERENAZGO",
};

export default function LugarScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  // Catálogos
  const [tiposLugar, setTiposLugar] = useState<any[]>([]);
  const [tiposVia, setTiposVia] = useState<any[]>([]);
  const [vias, setVias] = useState<any[]>([]);
  const [cuadras, setCuadras] = useState<any[]>([]);

  // Vías filtradas por Tipo de Vía
  const [viasFiltradasNuevo, setViasFiltradasNuevo] = useState<any[]>([]);
  const [viasFiltradasEdit, setViasFiltradasEdit] = useState<any[]>([]);

  // Datos principales y conteos
  const [lugares, setLugares] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({ total: 0, activos: 0, inactivos: 0 });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tipoSel, setTipoSel] = useState("TODOS");
  const [estadoSel, setEstadoSel] = useState("TODOS");

  // Paginación y Carga
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modales y Mapa
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success",
  });

  const [lugarEdit, setLugarEdit] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [nuevoLugar, setNuevoLugar] = useState<any>(INITIAL_LUGAR_STATE);

  // Estado para el Modal del Mapa (Leaflet Web / Info Móvil)
  const [modalMapaVisible, setModalMapaVisible] = useState(false);
  const [modoMapa, setModoMapa] = useState<"crear" | "editar">("crear");

  // 1. Cargar Catálogos
  useEffect(() => {
    fetch(`${API_URL}/lugar-catalogos`)
      .then((res) => res.json())
      .then((data) => {
        const tLugares = data.tiposLugar || [];
        const tVias = data.tiposVia || [];
        const listaVias = data.vias || [];
        const listaCuadras = data.cuadras || [];

        setTiposLugar(tLugares);
        setTiposVia(tVias);
        setVias(listaVias);
        setCuadras(listaCuadras);

        const defTipoLugar = tLugares[0]?.id_tipo || null;
        const defTipoVia = tVias[0]?.id_tipo_via || null;
        const viasDelTipo = listaVias.filter((v: any) => v.id_tipo_via === defTipoVia);
        const defVia = viasDelTipo[0]?.id_via || null;
        const defCuadra = listaCuadras[0]?.id_cuadra || null;

        setViasFiltradasNuevo(viasDelTipo);
        setNuevoLugar({
          ...INITIAL_LUGAR_STATE,
          id_tipo_lugar: defTipoLugar,
          id_tipo_via: defTipoVia,
          id_via: defVia,
          id_cuadra: defCuadra,
        });
      })
      .catch((e) => console.error("❌ Error cargando catálogos de lugares:", e));
  }, []);

  // Filtrar vías dinámicamente (NUEVO REGISTRO)
  const handleTipoViaChangeCrear = (idTipoVia: number) => {
    const filtradas = vias.filter((v) => v.id_tipo_via === idTipoVia);
    setViasFiltradasNuevo(filtradas);
    setNuevoLugar((prev: any) => ({
      ...prev,
      id_tipo_via: idTipoVia,
      id_via: filtradas.length > 0 ? filtradas[0].id_via : null,
    }));
  };

  // Filtrar vías dinámicamente (EDICIÓN)
  const handleTipoViaChangeEditar = (idTipoVia: number) => {
    const filtradas = vias.filter((v) => v.id_tipo_via === idTipoVia);
    setViasFiltradasEdit(filtradas);
    setLugarEdit((prev: any) => ({
      ...prev,
      id_tipo_via: idTipoVia,
      id_via: filtradas.length > 0 ? filtradas[0].id_via : null,
    }));
  };

  // Abrir Modal de Edición
  const abrirModalEditar = (item: any) => {
    const viaActual = vias.find((v) => v.id_via === item.id_via);
    const idTipoViaActual = item.id_tipo_via || viaActual?.id_tipo_via || tiposVia[0]?.id_tipo_via;
    const filtradas = vias.filter((v) => v.id_tipo_via === idTipoViaActual);

    setViasFiltradasEdit(filtradas);
    setLugarEdit({
      ...item,
      id_tipo_via: idTipoViaActual,
      id_tipo_lugar: item.id_tipo_lugar || item.id_tipo,
      nombre_lugar: item.nombre_lugar || "",
      unidad_encargada: item.unidad_encargada || "",
    });
    setModalVisible(true);
  };

  // Debounce para búsqueda
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchText), 350);
    return () => clearTimeout(handler);
  }, [searchText]);

  // Cargar lista con paginación
  const cargarDatos = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const nextPage = reset ? 1 : page;
        const query = new URLSearchParams({
          q: debouncedSearch,
          tipo: tipoSel,
          estado: estadoSel,
          page: nextPage.toString(),
        });

        const res = await fetch(`${API_URL}/lugarestotal?${query}`);
        const result = await res.json();

        setCounts({
          total: result.counts?.total || 0,
          activos: result.counts?.activos || 0,
          inactivos: result.counts?.inactivos || 0,
        });

        const newRecords = result.data || [];
        setLugares((prev) => (reset ? newRecords : [...prev, ...newRecords]));
        setHasMore(Boolean(result.pagination?.hasMore));
        setPage(nextPage + 1);
      } catch (e) {
        console.error("❌ Error al cargar /lugarestotal:", e);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, tipoSel, estadoSel, page, loading]
  );

  useEffect(() => {
    setHasMore(true);
    setPage(1);
    cargarDatos(true);
  }, [debouncedSearch, tipoSel, estadoSel]);

  const handleLoadMore = () => {
    if (!loading && hasMore) cargarDatos(false);
  };

  // Exportar Excel
  const exportarExcel = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        q: debouncedSearch,
        tipo: tipoSel,
        estado: estadoSel,
        export: "true",
      });

      const res = await fetch(`${API_URL}/lugarestotal?${query}`);
      const result = await res.json();
      const dataCompleta = result.data || [];

      if (dataCompleta.length === 0) {
        setCustomAlert({
          visible: true,
          title: "Sin datos",
          message: "No existen registros para exportar con los filtros seleccionados.",
          type: "error",
        });
        return;
      }

      const datosFormato = dataCompleta.map((l: any) => ({
        ID: l.id_lugar,
        "NOMBRE LUGAR": l.nombre_lugar || "",
        "TIPO LUGAR": l.tipo_descripcion || "",
        VÍA: l.nombre_via || "",
        CUADRA: l.numero_cuadra || "",
        "UNIDAD ENCARGADA": l.unidad_encargada || "",
        LATITUD: l.latitud,
        LONGITUD: l.longitud,
        ESTADO: l.estado === 1 ? "ACTIVO" : "INACTIVO",
      }));

      const worksheet = XLSX.utils.json_to_sheet(datosFormato);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Lugares");
      XLSX.writeFile(workbook, "Reporte_Lugares.xlsx");
    } catch (e) {
      console.error("Error exportando excel:", e);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar Lugar
  const handleGuardarCambios = async () => {
    if (!lugarEdit) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/updatelugar/${lugarEdit.id_lugar}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lugarEdit),
      });

      const data = await res.json();

      if (!res.ok) {
        setCustomAlert({
          visible: true,
          title: "Atención",
          message: data.message || "Ocurrió un error al actualizar.",
          type: "error",
        });
        return;
      }

      setModalVisible(false);
      setCustomAlert({
        visible: true,
        title: "¡Éxito!",
        message: "Lugar actualizado correctamente.",
        type: "success",
      });
      cargarDatos(true);
    } catch (e) {
      setCustomAlert({
        visible: true,
        title: "Error de Conexión",
        message: "No se pudo conectar con el servidor.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Crear Registro Nuevo
  const handleGuardarNuevo = async () => {
    if (!nuevoLugar.id_tipo_lugar || !nuevoLugar.id_via) {
      setCustomAlert({
        visible: true,
        title: "Campos Obligatorios",
        message: "Por favor seleccione Tipo de Lugar y Vía.",
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/insertlugar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoLugar),
      });

      const data = await res.json();

      if (!res.ok) {
        setCustomAlert({
          visible: true,
          title: "Atención",
          message: data.message || "No se pudo registrar el lugar.",
          type: "error",
        });
        return;
      }

      setModalCrearVisible(false);
      const defTipoVia = tiposVia[0]?.id_tipo_via || null;
      const defVias = vias.filter((v) => v.id_tipo_via === defTipoVia);
      setNuevoLugar({
        ...INITIAL_LUGAR_STATE,
        id_tipo_lugar: tiposLugar[0]?.id_tipo || null,
        id_tipo_via: defTipoVia,
        id_via: defVias[0]?.id_via || null,
        id_cuadra: cuadras[0]?.id_cuadra || null,
      });

      setCustomAlert({
        visible: true,
        title: "¡Éxito!",
        message: "Lugar registrado correctamente.",
        type: "success",
      });
      cargarDatos(true);
    } catch (e) {
      setCustomAlert({
        visible: true,
        title: "Error de Red",
        message: "No se pudo procesar la solicitud.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const BadgeEstado = ({ estado }: { estado: number }) => (
    <View style={[styles.badge, { backgroundColor: estado === 1 ? "#E8F5E9" : "#FFEBEE" }]}>
      <Text style={{ color: estado === 1 ? "#2E7D32" : "#C62828", fontSize: 10, fontWeight: "bold" }}>
        {estado === 1 ? "ACTIVO" : "INACTIVO"}
      </Text>
    </View>
  );

  // HTML estático de Leaflet para Web (OpenStreetMap)
  const getLeafletWebHtml = (lat: number, lng: number) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; font-family: sans-serif; }
        .info-box { position: absolute; top: 10px; right: 10px; z-index: 1000; background: white; padding: 8px 12px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 12px; font-weight: bold; color: #024885; }
      </style>
    </head>
    <body>
      <div class="info-box">📍 Haz clic en el mapa para fijar coordenadas</div>
      <div id="map"></div>
      <script>
        var lat = ${lat || -12.065247};
        var lng = ${lng || -77.044894};
        var map = L.map('map').setView([lat, lng], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        var marker = L.marker([lat, lng], {draggable: true}).addTo(map);

        function updateCoords(newLat, newLng) {
          marker.setLatLng([newLat, newLng]);
          if (window.parent) {
            window.parent.postMessage({ type: 'LEAFLET_COORD', lat: newLat, lng: newLng }, '*');
          }
        }

        map.on('click', function(e) {
          updateCoords(e.latlng.lat, e.latlng.lng);
        });

        marker.on('dragend', function(e) {
          var coord = marker.getLatLng();
          updateCoords(coord.lat, coord.lng);
        });
      </script>
    </body>
    </html>
  `;

  // Listener de eventos para Leaflet en Web
  useEffect(() => {
    if (Platform.OS === "web") {
      const handleMessage = (event: any) => {
        if (event.data && event.data.type === "LEAFLET_COORD") {
          const { lat, lng } = event.data;
          if (modoMapa === "editar") {
            setLugarEdit((prev: any) => (prev ? { ...prev, latitud: lat, longitud: lng } : prev));
          } else {
            setNuevoLugar((prev: any) => ({ ...prev, latitud: lat, longitud: lng }));
          }
        }
      };
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [modoMapa]);

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER - RESPONSIVO (Basado en el diseño probado en PNP) */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
            <ThemedText style={styles.headerTitle}>Cat. Lugares</ThemedText>
            {Platform.OS === "web" && (
              <TouchableOpacity
                onPress={exportarExcel}
                style={[styles.btnAdd, { backgroundColor: MJM_BLUE, width: 34, height: 34 }]}
              >
                <Ionicons name="document-text" size={16} color="white" />
              </TouchableOpacity>
            )}
            <View style={styles.estadoToggle}>
              {[
                { id: "TODOS", l: "TODOS", c: counts.total },
                { id: "1", l: "ACT.", c: counts.activos },
                { id: "0", l: "INAC.", c: counts.inactivos },
              ].map((e) => (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => setEstadoSel(e.id)}
                  style={[styles.btnEstado, estadoSel === e.id && styles.btnEstadoActive]}
                >
                  <Text style={[styles.btnText, estadoSel === e.id && { color: "white" }]}>
                    {e.l} {e.c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.btnAdd} onPress={() => setModalCrearVisible(true)}>
            <Ionicons name="add" size={22} color="white" />
          </TouchableOpacity>
        </View>

        {/* BÚSQUEDA */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            placeholder="Buscar por Nombre, Unidad, Vía o Cuadra..."
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== "" && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        {/* FILTROS POR TIPO DE LUGAR */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Tipo:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setTipoSel("TODOS")}
              style={[styles.btnChip, tipoSel === "TODOS" && styles.btnActive]}
            >
              <Text style={[styles.btnText, tipoSel === "TODOS" && { color: "#FFF" }]}>TODOS</Text>
            </TouchableOpacity>
            {tiposLugar.map((t) => (
              <TouchableOpacity
                key={t.id_tipo}
                onPress={() => setTipoSel(t.id_tipo.toString())}
                style={[styles.btnChip, tipoSel === t.id_tipo.toString() && styles.btnActive]}
              >
                <Text style={[styles.btnText, tipoSel === t.id_tipo.toString() && { color: "#FFF" }]}>
                  {t.nombre_tipo}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* ENCABEZADO ESCRITORIO CON VÍA Y CUADRA EN COLUMNAS SEPARADAS */}
      {isDesktop && (
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.5, textAlign: "center" }]}>
            ID
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1.3, textAlign: "center" }]}>
            NOMBRE LUGAR
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1.2, textAlign: "center" }]}>
            TIPO LUGAR
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1.5, textAlign: "center" }]}>
            VÍA
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.8, textAlign: "center" }]}>
            CUADRA
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1.2, textAlign: "center" }]}>
            UNIDAD ENCARGADA
          </Text>
          <Text style={[styles.cell, styles.headerText, { flex: 0.8, textAlign: "center" }]}>
            ESTADO
          </Text>
        </View>
      )}

      {/* LISTADO DE LUGARES */}
      <FlatList
        data={lugares}
        keyExtractor={(item, index) => `${item.id_lugar}-${index}`}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={isDesktop ? styles.tableRow : styles.mobileCard}
            onPress={() => abrirModalEditar(item)}
          >
            {isDesktop ? (
              <>
                <Text style={[styles.cell, styles.cellBorder, { flex: 0.5, fontWeight: "bold", textAlign: "center" }]}>
                  {item.id_lugar}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1.3, fontWeight: "600" }]} numberOfLines={1}>
                  {item.nombre_lugar || "-"}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1.2 }]} numberOfLines={1}>
                  {item.tipo_descripcion || `Tipo #${item.id_tipo_lugar}`}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1.5 }]} numberOfLines={1}>
                  {item.nombre_via || `Vía ${item.id_via}`}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 0.8, textAlign: "center" }]} numberOfLines={1}>
                  {item.numero_cuadra ? `Cdra. ${item.numero_cuadra}` : "-"}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1.2 }]} numberOfLines={1}>
                  {item.unidad_encargada || "-"}
                </Text>
                <View style={[styles.cell, { flex: 0.8, alignItems: "center" }]}>
                  <BadgeEstado estado={item.estado} />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 13, color: "#0F172A" }}>
                 {item.nombre_lugar || "Sin nombre"}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#0F172A", marginTop: 2 }}>
                    ({item.tipo_descripcion})
                  </Text>
                  <Text style={{ fontSize: 10, color: "#0F172A", marginTop: 1 }}>
                    Encargada: {item.unidad_encargada || "N/A"}
                  </Text>
                </View>
                <BadgeEstado estado={item.estado} />
              </View>
            )}
          </TouchableOpacity>
        )}
        ListFooterComponent={loading ? <ActivityIndicator size="small" color={MJM_BLUE} style={{ margin: 15 }} /> : undefined}
      />

      {/* MODAL EDITAR LUGAR */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>Editar - {lugarEdit?.nombre_lugar}</ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {lugarEdit && (
              <ScrollView showsVerticalScrollIndicator={false}>
               

                <ThemedText style={styles.label}>Tipo Lugar *</ThemedText>
              <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
  <Picker
    selectedValue={lugarEdit.id_tipo_lugar ? String(lugarEdit.id_tipo_lugar) : ""}
    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    dropdownIconColor="#000000"
    onValueChange={(val) => setLugarEdit({ ...lugarEdit, id_tipo_lugar: val ? Number(val) : null })}
  >
    <Picker.Item label="-- SELECCIONE --" value="" color="#888888" />
    {tiposLugar.map((t: any) => (
      <Picker.Item key={String(t.id_tipo)} label={t.nombre_tipo || ""} value={String(t.id_tipo)} color="#000000" />
    ))}
  </Picker>
</View>

                {/* TIPO DE VÍA */}
                <ThemedText style={styles.label}>Tipo de Vía *</ThemedText>
             <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
  <Picker
    selectedValue={lugarEdit.id_tipo_via ? String(lugarEdit.id_tipo_via) : ""}
    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    dropdownIconColor="#000000"
    onValueChange={(val) => handleTipoViaChangeEditar(val ? Number(val) : 0)}
  >
    <Picker.Item label="-- SELECCIONE --" value="" color="#888888" />
    {tiposVia.map((tv: any) => (
      <Picker.Item key={String(tv.id_tipo_via)} label={tv.abreviatura || ""} value={String(tv.id_tipo_via)} color="#000000" />
    ))}
  </Picker>
</View>

                <Text style={{ fontSize: 11, color: MJM_BLUE, fontWeight: "bold", marginTop: 4 }}>
                  🔍 Vías disponibles para este tipo: ({viasFiltradasEdit.length})
                </Text>

                {/* VÍA Y CUADRA EN 2 COLUMNAS */}
               <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
  <View style={{ flex: 1.2 }}>
    <ThemedText style={styles.label}>Vía *</ThemedText>
    <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
      <Picker
        selectedValue={lugarEdit.id_via ? String(lugarEdit.id_via) : ""}
        style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
        itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
        dropdownIconColor="#000000"
        onValueChange={(val) => setLugarEdit({ ...lugarEdit, id_via: val ? Number(val) : null })}
      >
        <Picker.Item label="-- SELECCIONE --" value="" color="#888888" />
        {viasFiltradasEdit.map((v: any) => (
          <Picker.Item key={String(v.id_via)} label={v.nombre_via || ""} value={String(v.id_via)} color="#000000" />
        ))}
      </Picker>
    </View>
  </View>

  <View style={{ flex: 0.8 }}>
    <ThemedText style={styles.label}>Cuadra</ThemedText>
    <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
      <Picker
        selectedValue={lugarEdit.id_cuadra !== null && lugarEdit.id_cuadra !== undefined ? String(lugarEdit.id_cuadra) : ""}
        style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
        itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
        dropdownIconColor="#000000"
        onValueChange={(val) => {
          const nuevoValor = val === "" || val === null || val === undefined ? null : Number(val);
          setLugarEdit({ ...lugarEdit, id_cuadra: nuevoValor });
        }}
      >
        <Picker.Item label="-- Opcional --" value="" color="#888888" />
        {cuadras.map((c: any) => (
          <Picker.Item key={String(c.id_cuadra)} label={`N° ${c.numero_cuadra}`} value={String(c.id_cuadra)} color="#000000" />
        ))}
      </Picker>
    </View>
  </View>
</View>

                <ThemedText style={styles.label}>Unidad Encargada</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ej: SERENAZGO / POLICÍA"
                  value={lugarEdit.unidad_encargada}
                  onChangeText={(t) => setLugarEdit({ ...lugarEdit, unidad_encargada: t })}
                />

                {/* BOTÓN MAPA Y COORDENADAS */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <ThemedText style={styles.label}>Coordenadas GPS</ThemedText>
                  <TouchableOpacity
                    onPress={() => {
                      setModoMapa("editar");
                      setModalMapaVisible(true);
                    }}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: MJM_BLUE, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                  >
                    <Ionicons name="map" size={14} color="white" style={{ marginRight: 4 }} />
                    <Text style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>Ver Mapa</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Latitud"
                      keyboardType="numeric"
                      value={lugarEdit.latitud !== null && lugarEdit.latitud !== undefined ? String(lugarEdit.latitud) : ""}
                      onChangeText={(t) => {
                        const nuevoValor = t.trim() === "" ? null : parseFloat(t);
                        setLugarEdit({ ...lugarEdit, latitud: isNaN(nuevoValor!) ? null : nuevoValor });
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Longitud"
                      keyboardType="numeric"
                      value={lugarEdit.longitud !== null && lugarEdit.longitud !== undefined ? String(lugarEdit.longitud) : ""}
                      onChangeText={(t) => {
                        const nuevoValor = t.trim() === "" ? null : parseFloat(t);
                        setLugarEdit({ ...lugarEdit, longitud: isNaN(nuevoValor!) ? null : nuevoValor });
                      }}
                    />
                  </View>
                </View>

                <ThemedText style={styles.label}>Estado</ThemedText>
                <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
  <Picker
    selectedValue={lugarEdit.estado !== null && lugarEdit.estado !== undefined ? String(lugarEdit.estado) : ""}
    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    dropdownIconColor="#000000"
    onValueChange={(val) => setLugarEdit({ ...lugarEdit, estado: val !== "" && val !== null ? Number(val) : 0 })}
  >
    <Picker.Item label="-- SELECCIONE --" value="" color="#888888" />
    <Picker.Item label="ACTIVO" value="1" color="#000000" />
    <Picker.Item label="INACTIVO" value="0" color="#000000" />
  </Picker>
</View>

                <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardarCambios} disabled={loading}>
                  {loading ? <ActivityIndicator color="white" /> : <ThemedText style={{ color: "white", fontWeight: "bold" }}>GUARDAR CAMBIOS</ThemedText>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL CREAR LUGAR */}
      <Modal visible={modalCrearVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>Nuevo Lugar</ThemedText>
              <TouchableOpacity onPress={() => setModalCrearVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
             
              <ThemedText style={styles.label}>Tipo Lugar *</ThemedText>
              <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
  <Picker
    selectedValue={nuevoLugar.id_tipo_lugar !== null && nuevoLugar.id_tipo_lugar !== undefined ? String(nuevoLugar.id_tipo_lugar) : ""}
    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    dropdownIconColor="#000000"
    onValueChange={(val) => setNuevoLugar({ ...nuevoLugar, id_tipo_lugar: val ? Number(val) : null })}
  >
    <Picker.Item label="-- SELECCIONE --" value="" color="#888888" />
    {tiposLugar.map((t: any) => (
      <Picker.Item key={String(t.id_tipo)} label={t.nombre_tipo || ""} value={String(t.id_tipo)} color="#000000" />
    ))}
  </Picker>
</View>

              {/* TIPO DE VÍA */}
              <ThemedText style={styles.label}>Tipo de Vía *</ThemedText>
            <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
  <Picker
    selectedValue={nuevoLugar.id_tipo_via !== null && nuevoLugar.id_tipo_via !== undefined ? String(nuevoLugar.id_tipo_via) : ""}
    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    dropdownIconColor="#000000"
    onValueChange={(val) => handleTipoViaChangeCrear(val ? Number(val) : 0)}
  >
    <Picker.Item label="-- SELECCIONE --" value="" color="#888888" />
    {tiposVia.map((tv: any) => (
      <Picker.Item key={String(tv.id_tipo_via)} label={tv.abreviatura || ""} value={String(tv.id_tipo_via)} color="#000000" />
    ))}
  </Picker>
</View>

              <Text style={{ fontSize: 11, color: MJM_BLUE, fontWeight: "bold", marginTop: 4 }}>
                🔍 Vías disponibles para este tipo: ({viasFiltradasNuevo.length})
              </Text>

              {/* VÍA Y CUADRA EN 2 COLUMNAS */}
           <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
  <View style={{ flex: 1.2 }}>
    <ThemedText style={styles.label}>Vía *</ThemedText>
    <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
      <Picker
        selectedValue={nuevoLugar.id_via !== null && nuevoLugar.id_via !== undefined ? String(nuevoLugar.id_via) : ""}
        style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
        itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
        dropdownIconColor="#000000"
        onValueChange={(val) => setNuevoLugar({ ...nuevoLugar, id_via: val ? Number(val) : null })}
      >
        <Picker.Item label="-- SELECCIONE --" value="" color="#888888" />
        {viasFiltradasNuevo.map((v: any) => (
          <Picker.Item key={String(v.id_via)} label={v.nombre_via || ""} value={String(v.id_via)} color="#000000" />
        ))}
      </Picker>
    </View>
  </View>

  <View style={{ flex: 0.8 }}>
    <ThemedText style={styles.label}>Cuadra</ThemedText>
    <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
      <Picker
        selectedValue={nuevoLugar.id_cuadra !== null && nuevoLugar.id_cuadra !== undefined ? String(nuevoLugar.id_cuadra) : ""}
        style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
        itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
        dropdownIconColor="#000000"
        onValueChange={(val) => {
          const nuevoValor = val === "" || val === null || val === undefined ? null : Number(val);
          setNuevoLugar({ ...nuevoLugar, id_cuadra: nuevoValor });
        }}
      >
        <Picker.Item label="-- Opcional --" value="" color="#888888" />
        {cuadras.map((c: any) => (
          <Picker.Item key={String(c.id_cuadra)} label={`N° ${c.numero_cuadra}`} value={String(c.id_cuadra)} color="#000000" />
        ))}
      </Picker>
    </View>
  </View>
</View>

              <ThemedText style={styles.label}>Unidad Encargada</ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: SERENAZGO / PATRULLAJE"
                value={nuevoLugar.unidad_encargada}
                onChangeText={(t) => setNuevoLugar({ ...nuevoLugar, unidad_encargada: t })}
              />

              {/* BOTÓN MAPA Y COORDENADAS */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <ThemedText style={styles.label}>Coordenadas GPS</ThemedText>
                <TouchableOpacity
                  onPress={() => {
                    setModoMapa("crear");
                    setModalMapaVisible(true);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", backgroundColor: MJM_BLUE, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                >
                  <Ionicons name="map" size={14} color="white" style={{ marginRight: 4 }} />
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>Ver Mapa</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Latitud"
                    keyboardType="numeric"
                    value={nuevoLugar.latitud !== null && nuevoLugar.latitud !== undefined ? String(nuevoLugar.latitud) : ""}
                    onChangeText={(t) => {
                      const nuevoValor = t.trim() === "" ? null : parseFloat(t);
                      setNuevoLugar({ ...nuevoLugar, latitud: isNaN(nuevoValor!) ? null : nuevoValor });
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Longitud"
                    keyboardType="numeric"
                    value={nuevoLugar.longitud !== null && nuevoLugar.longitud !== undefined ? String(nuevoLugar.longitud) : ""}
                    onChangeText={(t) => {
                      const nuevoValor = t.trim() === "" ? null : parseFloat(t);
                      setNuevoLugar({ ...nuevoLugar, longitud: isNaN(nuevoValor!) ? null : nuevoValor });
                    }}
                  />
                </View>
              </View>

              <ThemedText style={styles.label}>Estado</ThemedText>
         <View style={[styles.modalPickerContainer, { backgroundColor: "#FFFFFF" }]}>
  <Picker
    selectedValue={nuevoLugar.estado !== null && nuevoLugar.estado !== undefined ? String(nuevoLugar.estado) : ""}
    style={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    itemStyle={{ color: "#000000", backgroundColor: "#FFFFFF" }}
    dropdownIconColor="#000000"
    onValueChange={(val) => setNuevoLugar({ ...nuevoLugar, estado: val !== "" && val !== null ? Number(val) : 0 })}
  >
    <Picker.Item label="-- SELECCIONE --" value="" color="#888888" />
    <Picker.Item label="ACTIVO" value="1" color="#000000" />
    <Picker.Item label="INACTIVO" value="0" color="#000000" />
  </Picker>
</View>

              <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardarNuevo} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : <ThemedText style={{ color: "white", fontWeight: "bold" }}>REGISTRAR LUGAR</ThemedText>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL MAPA - DETECCIÓN MULTIPLATAFORMA (LEAFLET EN WEB / PANEL EN MÓVIL) */}
      <Modal visible={modalMapaVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 650, height: 500 }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.headerTitle}>Ubicación Geográfica</ThemedText>
              <TouchableOpacity onPress={() => setModalMapaVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {Platform.OS === "web" ? (
              <iframe
                title="Leaflet Map"
                style={{ width: "100%", height: 360, border: "none", borderRadius: 8 }}
                srcDoc={getLeafletWebHtml(
                  modoMapa === "editar" ? lugarEdit?.latitud : nuevoLugar?.latitud,
                  modoMapa === "editar" ? lugarEdit?.longitud : nuevoLugar?.longitud
                )}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
                <Ionicons name="location" size={48} color={MJM_BLUE} />
                <Text style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: "#334155" }}>
                  Coordenadas seleccionadas:
                </Text>
                <Text style={{ fontWeight: "bold", fontSize: 14, color: "#0F172A", marginTop: 4 }}>
                  Lat: {modoMapa === "editar" ? lugarEdit?.latitud || "-" : nuevoLugar?.latitud || "-"}
                </Text>
                <Text style={{ fontWeight: "bold", fontSize: 14, color: "#0F172A", marginTop: 2 }}>
                  Lng: {modoMapa === "editar" ? lugarEdit?.longitud || "-" : nuevoLugar?.longitud || "-"}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btnGuardar, { marginTop: 12 }]}
              onPress={() => setModalMapaVisible(false)}
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>CONFIRMAR UBICACIÓN</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ALERTA CUSTOM */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.alertContent}>
            <Ionicons
              name={customAlert.type === "success" ? "checkmark-circle" : "alert-circle"}
              size={55}
              color={customAlert.type === "success" ? "#2E7D32" : "#E53935"}
            />
            <ThemedText
              style={{
                fontSize: 16,
                fontWeight: "bold",
                marginTop: 10,
                color: customAlert.type === "error" ? "#E53935" : "#0F172A",
              }}
            >
              {customAlert.title}
            </ThemedText>
            <ThemedText style={{ textAlign: "center", color: "#64748B", marginTop: 8, fontSize: 13 }}>
              {customAlert.message}
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.btnGuardar,
                { width: "100%", marginTop: 18 },
                customAlert.type === "error" && { backgroundColor: "#E53935" },
              ]}
              onPress={() => setCustomAlert({ ...customAlert, visible: false })}
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>ENTENDIDO</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { padding: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: MJM_BLUE },
  btnAdd: { backgroundColor: MJM_BLUE, width: 38, height: 38, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  estadoToggle: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 8, padding: 2, gap: 2, flexShrink: 1 },
  btnEstado: { paddingHorizontal: 6, paddingVertical: 5, borderRadius: 6, alignItems: "center" },
  btnEstadoActive: { backgroundColor: MJM_BLUE },
  btnText: { fontSize: 10, fontWeight: "600", color: "#64748B" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 12, height: 40, marginBottom: 8 },
  input: { flex: 1, marginLeft: 8, color: "#0F172A", fontSize: 13 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: "bold", color: "#64748B" },
  btnChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F1F5F9" },
  btnActive: { backgroundColor: MJM_BLUE },
 tableHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#024885" },
  headerText: { fontWeight: "bold", fontSize: 11, color: "#FFFFFF" },
   tableRow: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderColor: "#F1F5F9", alignItems: "center" },
  mobileCard: { backgroundColor: "#FFFFFF", padding: 14, marginHorizontal: 16, marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  cell: { fontSize: 12, color: "#334155", paddingHorizontal: 4 },
  cellBorder: { borderRightWidth: 1, borderRightColor: "#E2E8F0" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 16 },
  modalContent: { backgroundColor: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 500, maxHeight: "90%" },
  alertContent: { backgroundColor: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360, alignItems: "center" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "bold", color: "#475569", marginTop: 8, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 10, fontSize: 13, color: "#0F172A" },
  modalPickerContainer: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    overflow: "hidden",
    height: 45,
  },
  btnGuardar: { backgroundColor: MJM_BLUE, padding: 12, borderRadius: 8, alignItems: "center", marginTop: 16 },
});