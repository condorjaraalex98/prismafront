import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";

const { width } = Dimensions.get("window");
const MJM_BLUE = "#024885";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
type FotoEstado = {
  uri: string;
  url_remota: string | null;
  uploading: boolean;
  base64?: string;
}; // VERIFICA TU IP

export default function OcurrenciasScreen() {
  const [reportes, setReportes] = useState([]);
  const [modalidades, setModalidades] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // FORMULARIO CON CAMPOS OBLIGATORIOS (SEGÚN TU SQL)
  const [form, setForm] = useState({
    id_usuario: 1, // Usuario logueado
    id_modalidad: null as any,
    descripcion: "",
    direccion: "",
    latitud: 0,
    longitud: 0,
    foto: null as any,
  });

  const cargarDatos = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/ocurrencias`);
      const data = await res.json();
      setReportes(data);

      const resMod = await fetch(`${API_URL}/categorias-full`);
      const dataMod = await resMod.json();
      setModalidades(
        dataMod.map((m: any) => ({ label: m.mod_nombre, value: m.mod_id })),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, []);

  // CAPTURA DE IMAGEN (CÁMARA O GALERÍA)
  const capturarImagen = async (modo: "camara" | "galeria") => {
    const result =
      modo === "camara"
        ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });

    if (!result.canceled) {
      setForm({ ...form, foto: result.assets[0].uri });
    }
  };

  // VALIDACIÓN ESTRICTA Y ENVÍO
  const handleGuardar = async () => {
    // Validar que nada esté vacío
    if (!form.id_modalidad)
      return Alert.alert(
        "Falta Modalidad",
        "Selecciona el tipo de ocurrencia.",
      );
    if (!form.direccion || form.direccion.length < 5)
      return Alert.alert("Falta Lugar", "Ingresa la dirección del evento.");
    if (form.descripcion.length < 10)
      return Alert.alert(
        "Falta Descripción",
        "Describe el hecho (min. 10 letras).",
      );
    if (!form.foto)
      return Alert.alert(
        "Falta Foto",
        "La evidencia fotográfica es obligatoria.",
      );

    try {
      const response = await fetch(`${API_URL}/reportar-nuevo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert("Éxito", "Reporte registrado correctamente.");
        setModalVisible(false);
        setForm({
          ...form,
          id_modalidad: null,
          descripcion: "",
          foto: null,
          direccion: "",
        });
        cargarDatos();
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo conectar al servidor.");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Ocurrencias</ThemedText>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={45} color={MJM_BLUE} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={reportes}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={cargarDatos} />
        }
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image
              source={
                item.url_foto
                  ? { uri: item.url_foto }
                  : require("@/assets/images/roles/default.png")
              }
              style={styles.cardImg}
            />
            <View style={styles.cardBody}>
              <ThemedText style={styles.cardTitle}>{item.modalidad}</ThemedText>
              <ThemedText numberOfLines={1} style={styles.cardSub}>
                {item.descripcion}
              </ThemedText>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <ThemedText style={styles.modalHeader}>NUEVO REPORTE</ThemedText>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.label}>TIPO / MODALIDAD *</ThemedText>
              <Dropdown
                style={styles.dropdown}
                data={modalidades}
                labelField="label"
                valueField="value"
                placeholder="Seleccione..."
                value={form.id_modalidad}
                onChange={(item) =>
                  setForm({ ...form, id_modalidad: item.value })
                }
              />

              <ThemedText style={styles.label}>LUGAR DEL HECHO *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Dirección exacta"
                value={form.direccion}
                onChangeText={(t) => setForm({ ...form, direccion: t })}
              />

              <ThemedText style={styles.label}>DESCRIPCIÓN *</ThemedText>
              <TextInput
                style={[styles.input, { height: 80 }]}
                multiline
                placeholder="¿Qué ocurrió?"
                value={form.descripcion}
                onChangeText={(t) => setForm({ ...form, descripcion: t })}
              />

              <ThemedText style={styles.label}>FOTO EVIDENCIA *</ThemedText>
              <View style={styles.fotoRow}>
                <TouchableOpacity
                  style={styles.fotoBtn}
                  onPress={() => capturarImagen("camara")}
                >
                  <Ionicons name="camera" size={30} color={MJM_BLUE} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.fotoBtn}
                  onPress={() => capturarImagen("galeria")}
                >
                  <Ionicons name="images" size={30} color={MJM_BLUE} />
                </TouchableOpacity>
              </View>

              {form.foto && (
                <Image source={{ uri: form.foto }} style={styles.preview} />
              )}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: MJM_BLUE }]}
                onPress={handleGuardar}
              >
                <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                  REGISTRAR
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#EEE" }]}
                onPress={() => setModalVisible(false)}
              >
                <ThemedText>CANCELAR</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  title: { fontSize: 24, fontWeight: "bold", color: MJM_BLUE },
  card: {
    backgroundColor: "white",
    margin: 10,
    padding: 12,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  cardImg: { width: 50, height: 50, borderRadius: 10 },
  cardBody: { flex: 1, marginLeft: 15 },
  cardTitle: { fontWeight: "bold", color: "#333" },
  cardSub: { fontSize: 12, color: "#888" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  modalBox: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 25,
    padding: 25,
    maxHeight: "85%",
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: MJM_BLUE,
  },
  label: { fontSize: 11, fontWeight: "bold", color: "#AAA", marginTop: 15 },
  dropdown: { borderBottomWidth: 1, borderBottomColor: "#DDD", height: 40 },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#DDD",
    paddingVertical: 5,
    fontSize: 14,
  },
  fotoRow: { flexDirection: "row", gap: 15, marginTop: 10 },
  fotoBtn: { padding: 10, backgroundColor: "#F0F4F8", borderRadius: 10 },
  preview: { width: "100%", height: 150, borderRadius: 10, marginTop: 10 },
  footer: { marginTop: 20, gap: 10 },
  btn: { padding: 15, borderRadius: 15, alignItems: "center" },
});
