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
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "${API_URL}";
const ThemedText = ({ style, children, ...props }: any) => (
  <Text style={style} {...props}>
    {children}
  </Text>
);

const MJM_BLUE = "#024885";

const INITIAL_FLOTA_STATE = {
  placa: "",
  id_tipo_vehiculo: "",
  numero_unidad: "",
  tipo_servicio: "MUNICIPAL",
  marca: "",
  modelo: "",
  año: new Date().getFullYear().toString(),
  estado: 1,
};

export default function FlotaScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  const [flota, setFlota] = useState<any[]>([]);
  const [tiposVehiculo, setTiposVehiculo] = useState<any[]>([]);
  const [counts, setCounts] = useState({ total: 0, activos: 0, inactivos: 0 });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [estadoSel, setEstadoSel] = useState("TODOS");
  const [tipoVehiculoSel, setTipoVehiculoSel] = useState("TODOS"); // 👈 NUEVO: Filtro Tipo Vehículo

  // Paginación y Carga
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modales y Estados
  const [errors, setErrors] = useState<any>({});
  const [placaDuplicadaMsg, setPlacaDuplicadaMsg] = useState("");
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success",
  });

  const [unidadEdit, setUnidadEdit] = useState<any>(null);
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [modalCrearVisible, setModalCrearVisible] = useState(false);
  const [nuevaUnidad, setNuevaUnidad] = useState(INITIAL_FLOTA_STATE);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchText), 350);
    return () => clearTimeout(handler);
  }, [searchText]);

  // Cargar Tipos de Vehículo
  useEffect(() => {
    const cargarTipos = async () => {
      try {
        const res = await fetch("${API_URL}/tiposvehiculo");
        const data = await res.json();
        setTiposVehiculo(data.data || data || []);
      } catch (e) {
        console.error("Error al cargar tipos de vehículo:", e);
      }
    };
    cargarTipos();
  }, []);

  const cargarDatos = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const nextPage = reset ? 1 : page;
        const query = new URLSearchParams({
          q: debouncedSearch,
          estado: estadoSel,
          id_tipo_vehiculo: tipoVehiculoSel, // 👈 NUEVO: Enviamos el tipo seleccionado
          page: nextPage.toString(),
        });

        const res = await fetch(`${API_URL}/flotatotal?${query}`);
        const result = await res.json();

        setCounts({
          total: result.pagination?.totalRecords || result.counts?.total || 0,
          activos: result.counts?.activos || 0,
          inactivos: result.counts?.inactivos || 0,
        });

        const newRecords = result.data || [];
        setFlota((prev) => (reset ? newRecords : [...prev, ...newRecords]));
        setHasMore(Boolean(result.pagination?.hasMore ?? result.hasMore));
        setPage(nextPage + 1);
      } catch (e) {
        console.error("Error al cargar flota:", e);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, estadoSel, tipoVehiculoSel, page, loading]
  );

  useEffect(() => {
    setHasMore(true);
    setPage(1);
    cargarDatos(true);
  }, [debouncedSearch, estadoSel, tipoVehiculoSel]); // 👈 Dispara la carga cuando cambia el Badge

  const handleLoadMore = () => {
    if (!loading && hasMore) cargarDatos(false);
  };

  const exportarExcel = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        q: debouncedSearch,
        estado: estadoSel,
        id_tipo_vehiculo: tipoVehiculoSel,
        export: "true",
      });

      const res = await fetch(`${API_URL}/flotatotal?${query}`);
      const result = await res.json();
      const dataCompleta = result.data || [];

      if (dataCompleta.length === 0) {
        setCustomAlert({
          visible: true,
          title: "Sin datos",
          message: "No hay datos filtrados para exportar.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      setTimeout(() => {
        const datosFormato = dataCompleta.map((f: any) => ({
          ID: f.id_unidad,
          PLACA: f.placa || "",
          TIPO_VEHICULO: f.tipo_vehiculo_nombre || "",
          NUMERO_UNIDAD: f.numero_unidad || "",
          TIPO_SERVICIO: f.tipo_servicio || "",
          MARCA: f.marca || "",
          MODELO: f.modelo || "",
          AÑO: f.año || "",
          ESTADO: f.estado === 1 ? "ACTIVO" : "INACTIVO",
        }));

        const worksheet = XLSX.utils.json_to_sheet(datosFormato);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Flota Municipal");

        XLSX.writeFile(workbook, "Reporte_Flota_Municipal.xlsx");
        setLoading(false);
      }, 50);
    } catch (e) {
      console.error("Error al exportar:", e);
      setLoading(false);
    }
  };

  const handlePlacaChange = async (text: string) => {
    const cleanPlaca = text.toUpperCase().trim();
    setNuevaUnidad({ ...nuevaUnidad, placa: cleanPlaca });

    if (errors.placa) setErrors({ ...errors, placa: false });
    setPlacaDuplicadaMsg("");

    if (cleanPlaca.length >= 6) {
      try {
        const res = await fetch(`${API_URL}/checkplacacop/${cleanPlaca}`);
        const data = await res.json();
        if (data.existe) {
          setErrors((prev: any) => ({ ...prev, placa: true }));
          setPlacaDuplicadaMsg("⚠️ LA PLACA INGRESADA YA SE ENCUENTRA REGISTRADA");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleGuardarNuevo = async () => {
    let newErrors: any = {};
    const { placa, id_tipo_vehiculo, numero_unidad } = nuevaUnidad;

    if (!placa.trim()) newErrors.placa = true;
    if (!id_tipo_vehiculo) newErrors.id_tipo_vehiculo = true;
    if (!numero_unidad.trim()) newErrors.numero_unidad = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setCustomAlert({
        visible: true,
        title: "Campos Faltantes",
        message: "Por favor ingrese la Placa, Tipo de Unidad y Número de Unidad.",
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("${API_URL}/insertflota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaUnidad),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 || data.code === "PLACA_DUPLICADA") {
          setErrors({ placa: true });
          setPlacaDuplicadaMsg("⚠️ LA PLACA INGRESADA YA SE ENCUENTRA REGISTRADA");
          setCustomAlert({
            visible: true,
            title: "Registro Duplicado",
            message: data.message || "La placa ingresada ya existe.",
            type: "error",
          });
          return;
        }
      }

      setModalCrearVisible(false);
      setNuevaUnidad(INITIAL_FLOTA_STATE);
      setPlacaDuplicadaMsg("");
      setCustomAlert({
        visible: true,
        title: "¡Éxito!",
        message: "Unidad registrada correctamente.",
        type: "success",
      });
      cargarDatos(true);
    } catch (e) {
      setCustomAlert({
        visible: true,
        title: "Error de Red",
        message: "No se pudo conectar con el servidor.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarCambios = async () => {
    if (!unidadEdit) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/updateflota/${unidadEdit.id_unidad}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unidadEdit),
      });

      if (res.ok) {
        setModalEditarVisible(false);
        setCustomAlert({
          visible: true,
          title: "¡Éxito!",
          message: "Unidad actualizada correctamente.",
          type: "success",
        });
        cargarDatos(true);
      }
    } catch (e) {
      console.error(e);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ThemedText style={styles.headerTitle}>Flota M.</ThemedText>
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
    { id: "1", l: "ACTIVOS", c: counts.activos },
    { id: "0", l: "INACTIVOS", c: counts.inactivos },
  ].map((e) => (
    <TouchableOpacity
      key={e.id}
      onPress={() => setEstadoSel(e.id)}
      style={[styles.btnEstado, estadoSel === e.id && styles.btnEstadoActive]}
    >
      <Text style={[styles.btnText, estadoSel === e.id && { color: "white" }]}>
        {e.l}
      </Text>
      <Text style={[styles.btnText, estadoSel === e.id && { color: "white" }]}>
        {e.c}
      </Text>
    </TouchableOpacity>
  ))}
</View>


          </View>

          <TouchableOpacity
            style={styles.btnAdd}
            onPress={() => {
              setErrors({});
              setPlacaDuplicadaMsg("");
              setModalCrearVisible(true);
            }}
          >
            <Ionicons name="car-sport" size={18} color="white" />
          </TouchableOpacity>
        </View>

        {/* 👈 AGREGADO: BADGES PARA FILTRAR TIPO DE VEHÍCULO */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              onPress={() => setTipoVehiculoSel("TODOS")}
              style={[styles.badgeTipo, tipoVehiculoSel === "TODOS" && styles.badgeTipoActive]}
            >
              <Text style={[styles.badgeTipoText, tipoVehiculoSel === "TODOS" && { color: "white" }]}>
                TODOS LOS TIPOS
              </Text>
            </TouchableOpacity>

            {tiposVehiculo.map((tv: any) => (
              <TouchableOpacity
                key={tv.id_tipo_vehiculo}
                onPress={() => setTipoVehiculoSel(tv.id_tipo_vehiculo.toString())}
                style={[
                  styles.badgeTipo,
                  tipoVehiculoSel === tv.id_tipo_vehiculo.toString() && styles.badgeTipoActive,
                ]}
              >
                <Text
                  style={[
                    styles.badgeTipoText,
                    tipoVehiculoSel === tv.id_tipo_vehiculo.toString() && { color: "white" },
                  ]}
                >
                  {tv.descripcion?.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* BUSCADOR CON BOTÓN "X" */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#64748B" />
          <TextInput
            placeholder="Buscar por Placa, N° Unidad, Marca o Modelo"
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
      </View>

      {/* CABECERA DESKTOP */}
      {isDesktop && (
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 0.5, textAlign: "center" }]}>
            ID
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1, textAlign: "center" }]}>
            PLACA
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1.5, textAlign: "center" }]}>
            TIPO UNIDAD
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1, textAlign: "center" }]}>
            N° UNIDAD
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1.2, textAlign: "center" }]}>
            MARCA / MODELO
          </Text>
          <Text style={[styles.cell, styles.cellBorder, styles.headerText, { flex: 1, textAlign: "center" }]}>
            SERVICIO
          </Text>
          <Text style={[styles.cell, styles.headerText, { flex: 0.8, textAlign: "center" }]}>
            ESTADO
          </Text>
        </View>
      )}

      {/* LISTA DE REGISTROS */}
      <FlatList
        data={flota}
        keyExtractor={(item, index) => `${item.id_unidad}-${index}`}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={isDesktop ? styles.tableRow : styles.mobileCard}
            onPress={() => {
              setUnidadEdit({
                id_unidad: item.id_unidad,
                placa: item.placa || "",
                id_tipo_vehiculo: item.id_tipo_vehiculo || "",
                numero_unidad: item.numero_unidad || "",
                tipo_servicio: item.tipo_servicio || "MUNICIPAL",
                marca: item.marca || "",
                modelo: item.modelo || "",
                año: item.año ? String(item.año) : "",
                estado: item.estado ?? 1,
              });
              setModalEditarVisible(true);
            }}
          >
            {isDesktop ? (
              <>
                <Text style={[styles.cell, styles.cellBorder, { flex: 0.5, textAlign: "center", color: "#64748B" }]}>
                  {item.id_unidad}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1, fontWeight: "bold", textAlign: "center" }]}>
                  {item.placa}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1.5, textAlign: "center" }]}>
                  {item.tipo_vehiculo_nombre || "-"}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1, textAlign: "center" }]}>
                  {item.numero_unidad || "-"}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1.2, textAlign: "center" }]}>
                  {`${item.marca || ""} ${item.modelo || ""}`.trim() || "-"}
                </Text>
                <Text style={[styles.cell, styles.cellBorder, { flex: 1, textAlign: "center" }]}>
                  {item.tipo_servicio}
                </Text>
                <View style={[styles.cell, { flex: 0.8, alignItems: "center" }]}>
                  <BadgeEstado estado={item.estado} />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 13 }}>
                    {item.placa} ({item.numero_unidad || "S/N"})
                  </Text>
                  <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                    {item.tipo_vehiculo_nombre || "S/T"} 
                  </Text>
                </View>
                <BadgeEstado estado={item.estado} />
              </View>
            )}
          </TouchableOpacity>
        )}
        ListFooterComponent={loading ? <ActivityIndicator size="small" color={MJM_BLUE} style={{ margin: 15 }} /> : null}
      />

      {/* MODAL CREAR (INSERCIÓN) */}
      <Modal visible={modalCrearVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Nueva Unidad Flota</ThemedText>
              <TouchableOpacity onPress={() => setModalCrearVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <ThemedText style={styles.label}>Placa *</ThemedText>
              <TextInput
                style={[styles.modalInput, errors.placa && styles.inputError]}
                value={nuevaUnidad.placa}
                autoCapitalize="characters"
                maxLength={15}
                onChangeText={handlePlacaChange}
              />
              {placaDuplicadaMsg !== "" && <Text style={styles.errorTextRed}>{placaDuplicadaMsg}</Text>}

              <ThemedText style={styles.label}>Tipo de Unidad *</ThemedText>
              <View style={[styles.modalPickerContainer, errors.id_tipo_vehiculo && styles.inputError]}>
                <Picker
                  selectedValue={nuevaUnidad.id_tipo_vehiculo}
                  onValueChange={(val) => {
                    setNuevaUnidad({ ...nuevaUnidad, id_tipo_vehiculo: val });
                    if (errors.id_tipo_vehiculo) setErrors({ ...errors, id_tipo_vehiculo: false });
                  }}
                >
                  <Picker.Item label="-- SELECCIONE --" value="" />
                  {tiposVehiculo.map((tv: any) => (
                    <Picker.Item key={tv.id_tipo_vehiculo} label={tv.descripcion} value={tv.id_tipo_vehiculo} />
                  ))}
                </Picker>
              </View>

              <ThemedText style={styles.label}>Número de Unidad *</ThemedText>
              <TextInput
                style={[styles.modalInput, errors.numero_unidad && styles.inputError]}
                value={nuevaUnidad.numero_unidad}
                maxLength={20}
                onChangeText={(t) => {
                  setNuevaUnidad({ ...nuevaUnidad, numero_unidad: t });
                  if (errors.numero_unidad) setErrors({ ...errors, numero_unidad: false });
                }}
              />

              <TouchableOpacity
                style={[styles.btnGuardar, errors.placa && { backgroundColor: "#E53935" }]}
                onPress={handleGuardarNuevo}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                    {errors.placa ? "PLACA YA REGISTRADA" : "REGISTRAR UNIDAD"}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR (TODOS LOS CAMPOS) */}
      <Modal visible={modalEditarVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Editar Unidad #{unidadEdit?.id_unidad}</ThemedText>
              <TouchableOpacity onPress={() => setModalEditarVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {unidadEdit && (
              <ScrollView>
                <ThemedText style={styles.label}>ID Unidad</ThemedText>
                <TextInput style={[styles.modalInput, { backgroundColor: "#E2E8F0" }]} value={String(unidadEdit.id_unidad)} editable={false} />

                <ThemedText style={styles.label}>Placa</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={unidadEdit.placa}
                  autoCapitalize="characters"
                  onChangeText={(t) => setUnidadEdit({ ...unidadEdit, placa: t.toUpperCase() })}
                />

                <ThemedText style={styles.label}>Tipo de Unidad</ThemedText>
                <View style={styles.modalPickerContainer}>
                  <Picker
                    selectedValue={unidadEdit.id_tipo_vehiculo}
                    onValueChange={(val) => setUnidadEdit({ ...unidadEdit, id_tipo_vehiculo: val })}
                  >
                    <Picker.Item label="-- SELECCIONE --" value="" />
                    {tiposVehiculo.map((tv: any) => (
                      <Picker.Item key={tv.id_tipo_vehiculo} label={tv.descripcion} value={tv.id_tipo_vehiculo} />
                    ))}
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Número de Unidad</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={unidadEdit.numero_unidad}
                  onChangeText={(t) => setUnidadEdit({ ...unidadEdit, numero_unidad: t })}
                />

                <ThemedText style={styles.label}>Tipo Servicio</ThemedText>
                <View style={styles.modalPickerContainer}>
                  <Picker
                    selectedValue={unidadEdit.tipo_servicio}
                    onValueChange={(val) => setUnidadEdit({ ...unidadEdit, tipo_servicio: val })}
                  >
                    <Picker.Item label="MUNICIPAL" value="MUNICIPAL" />
                    <Picker.Item label="INTEGRADO" value="INTEGRADO" />
                  </Picker>
                </View>

                <ThemedText style={styles.label}>Marca</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={unidadEdit.marca}
                  onChangeText={(t) => setUnidadEdit({ ...unidadEdit, marca: t })}
                />

                <ThemedText style={styles.label}>Modelo</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={unidadEdit.modelo}
                  onChangeText={(t) => setUnidadEdit({ ...unidadEdit, modelo: t })}
                />

                <ThemedText style={styles.label}>Año</ThemedText>
                <TextInput
                  style={styles.modalInput}
                  value={unidadEdit.año}
                  keyboardType="numeric"
                  maxLength={4}
                  onChangeText={(t) => setUnidadEdit({ ...unidadEdit, año: t.replace(/[^0-9]/g, "") })}
                />

                <ThemedText style={styles.label}>Estado</ThemedText>
                <View style={styles.modalPickerContainer}>
                  <Picker
                    selectedValue={unidadEdit.estado}
                    onValueChange={(val) => setUnidadEdit({ ...unidadEdit, estado: Number(val) })}
                  >
                    <Picker.Item label="ACTIVO" value={1} />
                    <Picker.Item label="INACTIVO" value={0} />
                  </Picker>
                </View>

                <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardarCambios} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <ThemedText style={{ color: "white", fontWeight: "bold" }}>GUARDAR CAMBIOS</ThemedText>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
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
            <ThemedText style={{ fontSize: 16, fontWeight: "bold", marginTop: 10, color: customAlert.type === "error" ? "#E53935" : "#0F172A" }}>
              {customAlert.title}
            </ThemedText>
            <ThemedText style={{ textAlign: "center", color: "#64748B", marginTop: 8, fontSize: 13 }}>
              {customAlert.message}
            </ThemedText>
            <TouchableOpacity
              style={[styles.btnGuardar, { width: "100%", marginTop: 18 }, customAlert.type === "error" && { backgroundColor: "#E53935" }]}
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
  header: { padding: 16, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: MJM_BLUE },
  btnAdd: { backgroundColor: MJM_BLUE, width: 38, height: 38, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  estadoToggle: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 8, padding: 3, gap: 4 },
  btnEstado: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnEstadoActive: { backgroundColor: MJM_BLUE },
  btnText: { fontSize: 12, fontWeight: "600", color: "#64748B" },

  // 👈 AGREGADOS: Estilos de los Badges para los Tipos de Vehículo
  badgeTipo: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  badgeTipoActive: {
    backgroundColor: MJM_BLUE,
    borderColor: MJM_BLUE,
  },
  badgeTipoText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#475569",
  },

  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 10, height: 40 },
  input: { flex: 1, marginLeft: 8, fontSize: 13, color: "#0F172A" },
  tableHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#024885" },
  headerText: { fontWeight: "bold", fontSize: 11, color: "#FFFFFF" },
  tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  cell: { flex: 1, padding: 8, justifyContent: "center" },
  cellBorder: { borderRightWidth: 1, borderRightColor: "rgba(203, 213, 225, 0.4)" },
  mobileCard: { backgroundColor: "#FFFFFF", padding: 12, marginHorizontal: 12, marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 15 },
  modalContent: { backgroundColor: "white", borderRadius: 16, padding: 18, width: "100%", maxWidth: 480, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#EEE" },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#0F172A" },
  modalPickerContainer: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, backgroundColor: "#F8FAFC", height: 45, justifyContent: "center" },
  modalInput: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  inputError: { borderColor: "#E53935", borderWidth: 1.5, backgroundColor: "#FFEBEE" },
  errorTextRed: { color: "#E53935", fontSize: 11, fontWeight: "bold", marginTop: 4 },
  label: { fontSize: 11, fontWeight: "bold", color: "#475569", marginTop: 8, marginBottom: 4 },
  btnGuardar: { backgroundColor: MJM_BLUE, paddingVertical: 11, borderRadius: 8, alignItems: "center", marginTop: 20 },
  alertContent: { backgroundColor: "white", borderRadius: 16, padding: 20, width: "100%", maxWidth: 320, alignItems: "center" },
});