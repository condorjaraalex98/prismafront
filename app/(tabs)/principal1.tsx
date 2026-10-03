import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";

// --- CONFIGURACIÓN ---
const MJM_BLUE = "#024885";
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dplwunlzp/image/upload";
const UPLOAD_PRESET = "reportes_app";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
type FotoEstado = {
  uri: string;
  url_remota: string | null;
  uploading: boolean;
  base64?: string;
};

export default function PrincipalScreen() {
  const router = useRouter();
  const { idUsuario, nombreUsuario } = useLocalSearchParams();

  // Estados de Interfaz
  const [modalVisible, setModalVisible] = useState(false);
  const [modalExito, setModalExito] = useState(false);
  const [esModoRapido, setEsModoRapido] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Estados de Formulario
  const [areaSeleccionada, setAreaSeleccionada] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [ubicacion, setUbicacion] = useState<{
    lat: number;
    lng: number;
    direccion: string;
  } | null>(null);

  // Estados de Datos (Backend)
  const [listaCategorias, setListaCategorias] = useState<any[]>([]);
  const [genSel, setGenSel] = useState("");
  const [espSel, setEspSel] = useState("");
  const [modSel, setModSel] = useState("");

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    try {
      const res = await fetch(`${API_URL}/categorias-full`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setListaCategorias(data);
      }
    } catch (e) {
      console.error("Error cargando categorías:", e);
    }
  };

  const obtenerUbicacion = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const direccionRef = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      let calleStr = "Ubicación detectada";
      if (direccionRef.length > 0) {
        const item = direccionRef[0];
        calleStr = `${item.street || "Calle"} ${item.name || ""}, ${item.district || ""}`;
      }

      setUbicacion({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        direccion: calleStr,
      });
    } catch (e) {
      console.log("Error GPS", e);
    }
  };

  const abrirFormulario = (area: string, rapido = false) => {
    setAreaSeleccionada(area);
    setEsModoRapido(rapido);
    setGenSel("");
    setEspSel("");
    setModSel("");
    setFotos([]);
    setDescripcion("");
    setUbicacion(null);
    setModalVisible(true);
    obtenerUbicacion();
  };

  const seleccionarFotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.4,
    });
    if (!result.canceled) {
      const nuevas = result.assets.map((a) => a.uri);
      setFotos((prev) => [...prev, ...nuevas]);
    }
  };

  const enviarReporte = async () => {
    if (!modSel || !descripcion)
      return Alert.alert("Aviso", "Complete los campos obligatorios");
    if (fotos.length === 0)
      return Alert.alert("Aviso", "Suba al menos una foto de evidencia");

    setCargando(true);
    try {
      const urlsCloudinary = await Promise.all(
        fotos.map(async (fotoUri) => {
          const formData = new FormData();
          const fileName = fotoUri.split("/").pop() || `foto_${Date.now()}.jpg`;
          if (Platform.OS === "web") {
            const response = await fetch(fotoUri);
            const blob = await response.blob();
            formData.append("file", blob);
          } else {
            // @ts-ignore
            formData.append("file", {
              uri: fotoUri,
              type: "image/jpeg",
              name: fileName,
            });
          }
          formData.append("upload_preset", UPLOAD_PRESET);
          const r = await fetch(CLOUDINARY_URL, {
            method: "POST",
            body: formData,
          });
          const d = await r.json();
          return d.secure_url;
        }),
      );

      const res = await fetch(`${API_URL}/reportar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: Number(idUsuario) || 1,
          modalidad_id: modSel,
          descripcion: descripcion.trim(),
          fotos: urlsCloudinary,
          latitud: ubicacion?.lat || 0,
          longitud: ubicacion?.lng || 0,
          lugar: ubicacion?.direccion || "Jesús María",
          area: esModoRapido ? "Reporte Rápido" : areaSeleccionada,
        }),
      });

      if (res.ok) {
        setModalVisible(false);
        setModalExito(true);
        setTimeout(() => setModalExito(false), 2200);
      }
    } catch (e: any) {
      Alert.alert("Error", "No se pudo enviar el reporte.");
    } finally {
      setCargando(false);
    }
  };

  // --- LÓGICA DE FILTRADO ---
  const dataGen = [...new Set(listaCategorias.map((i) => i.gen_nombre))]
    .filter((n) => n)
    .map((n) => ({ label: n, value: n }));
  const dataEsp = listaCategorias
    .filter((i) => i.gen_nombre === genSel && i.esp_nombre)
    .reduce((acc: any[], curr) => {
      if (!acc.find((item) => item.value === curr.esp_nombre))
        acc.push({ label: curr.esp_nombre, value: curr.esp_nombre });
      return acc;
    }, []);
  const dataMod = listaCategorias
    .filter((i) => i.esp_nombre === espSel && i.mod_nombre)
    .map((i) => ({ label: i.mod_nombre, value: i.mod_id }));
  const dataBusquedaDirecta = listaCategorias
    .filter((i) => i.mod_nombre)
    .map((i) => ({ label: i.mod_nombre, value: i.mod_id }));

  return (
    <ThemedView style={styles.mainContainer}>
      {/* --- Cambios en el Header --- */}

      <ScrollView contentContainerStyle={styles.grid}>
        {["Serenazgo", "Limpieza", "Obras", "Tránsito"].map((area) => (
          <TouchableOpacity
            key={area}
            style={styles.card}
            onPress={() => abrirFormulario(area)}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="megaphone" size={30} color={MJM_BLUE} />
            </View>
            <ThemedText style={styles.cardText}>{area}</ThemedText>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.card, styles.cardFull]}
          onPress={() => abrirFormulario("Rápido", true)}
        >
          <View style={[styles.iconCircle, { backgroundColor: "#fff4e5" }]}>
            <Ionicons name="flash" size={30} color="#ff9800" />
          </View>
          <ThemedText style={styles.cardText}>REPORTE RÁPIDO</ThemedText>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              {esModoRapido ? "Reporte Rápido" : areaSeleccionada}
            </ThemedText>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* UBICACIÓN DETECTADA */}
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={14} color={MJM_BLUE} />
                <ThemedText style={styles.locationText} numberOfLines={1}>
                  {ubicacion?.direccion || "Detectando dirección..."}
                </ThemedText>
              </View>

              {esModoRapido ? (
                <Dropdown
                  style={styles.dropdown}
                  data={dataBusquedaDirecta}
                  search
                  labelField="label"
                  valueField="value"
                  placeholder="¿Qué problema reportas?"
                  value={modSel}
                  onChange={(i) => setModSel(i.value)}
                />
              ) : (
                <>
                  {/* AQUÍ SE MANTIENEN LOS PLACEHOLDERS ORIGINALES */}
                  <Dropdown
                    style={styles.dropdown}
                    data={dataGen}
                    labelField="label"
                    valueField="value"
                    placeholder="Categoría"
                    value={genSel}
                    onChange={(i) => {
                      setGenSel(i.value);
                      setEspSel("");
                      setModSel("");
                    }}
                  />
                  <Dropdown
                    style={[styles.dropdown, !genSel && { opacity: 0.4 }]}
                    data={dataEsp}
                    labelField="label"
                    valueField="value"
                    placeholder="Tipo"
                    value={espSel}
                    onChange={(i) => {
                      setEspSel(i.value);
                      setModSel("");
                    }}
                  />
                  <Dropdown
                    style={[styles.dropdown, !espSel && { opacity: 0.4 }]}
                    data={dataMod}
                    labelField="label"
                    valueField="value"
                    placeholder="Modalidad"
                    value={modSel}
                    onChange={(i) => setModSel(i.value)}
                  />
                </>
              )}

              <TextInput
                style={styles.input}
                placeholder="Describe lo ocurrido..."
                multiline
                value={descripcion}
                onChangeText={setDescripcion}
              />

              <View style={styles.fotoSection}>
                <TouchableOpacity
                  style={styles.btnCam}
                  onPress={seleccionarFotos}
                >
                  <Ionicons name="camera" size={28} color={MJM_BLUE} />
                  <ThemedText
                    style={{
                      fontSize: 10,
                      fontWeight: "bold",
                      color: MJM_BLUE,
                    }}
                  >
                    {fotos.length} Fotos
                  </ThemedText>
                </TouchableOpacity>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {fotos.map((f, i) => (
                    <Image key={i} source={{ uri: f }} style={styles.miniImg} />
                  ))}
                </ScrollView>
              </View>

              {cargando ? (
                <ActivityIndicator
                  size="large"
                  color={MJM_BLUE}
                  style={{ marginTop: 20 }}
                />
              ) : (
                <View style={styles.footerBtns}>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <ThemedText style={{ color: "#999" }}>Cerrar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnSend}
                    onPress={enviarReporte}
                  >
                    <ThemedText style={{ color: "#fff", fontWeight: "bold" }}>
                      ENVIAR
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modalExito} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={70} color="white" />
            </View>
            <ThemedText style={styles.successTitle}>¡Enviado!</ThemedText>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5", // Color gris claro de fondo para el contenido
    paddingHorizontal: 15, // Espacio a los lados de las tablas/cards
    paddingTop: 10, // Espacio extra respecto al borde superior
  },

  header: {
    backgroundColor: MJM_BLUE,
    padding: 30,
    paddingTop: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomRightRadius: 40,
  },
  welcomeText: { color: "white", fontSize: 22, fontWeight: "bold" },
  grid: {
    padding: 15,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "white",
    width: "47%",
    padding: 20,
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 15,
    elevation: 4,
  },
  cardFull: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
  },
  iconCircle: { backgroundColor: "#eef6ff", padding: 15, borderRadius: 20 },
  cardText: { fontWeight: "bold", color: "#333" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    width: "92%",
    maxHeight: "80%",
    borderRadius: 35,
    padding: 25,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: MJM_BLUE,
    textAlign: "center",
    marginBottom: 10,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f7ff",
    padding: 10,
    borderRadius: 15,
    marginBottom: 15,
  },
  locationText: {
    fontSize: 11,
    color: MJM_BLUE,
    marginLeft: 5,
    fontWeight: "600",
    flex: 1,
  },
  dropdown: {
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginBottom: 15,
  },
  input: {
    backgroundColor: "#f8f8f8",
    borderRadius: 20,
    padding: 15,
    height: 100,
    textAlignVertical: "top",
    marginTop: 10,
  },
  fotoSection: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  btnCam: {
    width: 70,
    height: 70,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: MJM_BLUE,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  miniImg: { width: 70, height: 70, borderRadius: 15, marginLeft: 10 },
  footerBtns: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
  },
  btnSend: {
    backgroundColor: MJM_BLUE,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 20,
  },
  successCard: {
    backgroundColor: "white",
    padding: 40,
    borderRadius: 40,
    alignItems: "center",
  },
  checkCircle: {
    backgroundColor: "#28a745",
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: { fontSize: 24, fontWeight: "bold" },
});
