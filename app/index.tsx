import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ImageBackground,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../context/userContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MJM_BLUE = "#024885";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
const BACKGROUND_IMAGE =
  "https://www.munijesusmaria.gob.pe/wp-content/uploads/2025/01/WhatsApp-Image-2025-01-20-at-10.19.12-AM.jpeg";

export default function HomeScreen() {
  const router = useRouter();
  const { login } = useAuth();
const [showSupport, setShowSupport] = useState(false);   // Estado para mostrar/ocultar soporte
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [passActual, setPassActual] = useState("");
  const [nuevaPass, setNuevaPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [loadingPass, setLoadingPass] = useState(false);

  const handleLogin = async () => {
    if (!usuario || !contrasena)
      return Alert.alert("Aviso", "Ingresa tus credenciales");
    try {
      const response = await fetch(`${API_URL}/login`, {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, contrasena }),
      });
      const data = await response.json();
      if (response.ok) {
        login(data);
        router.replace({
          pathname: "/(tabs)/principal",
          params: { idUsuario: data.id },
        });
      } else {
        Alert.alert("Error", data.message);
      }
    } catch (e) {
      Alert.alert("Error", "Servidor no disponible");
    }
  };

  const handleUpdatePassword = async () => {
    if (!usuario || !passActual || !nuevaPass)
      return Alert.alert("Aviso", "Completa los campos");
    if (nuevaPass !== confirmarPass)
      return Alert.alert("Error", "Las claves no coinciden");

    setLoadingPass(true);
    try {
      const response = await fetch(
        `${API_URL}/api/usuarios/cambiar-password `,
           
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuario,
            pass_actual: passActual,
            nueva_pass: nuevaPass,
          }),
        },
      );
      if (response.ok) {
        Alert.alert("Éxito", "Contraseña actualizada.");
        setModalVisible(false);
        setPassActual("");
        setNuevaPass("");
        setConfirmarPass("");
      } else {
        const d = await response.json();
        Alert.alert("Error", d.message);
      }
    } catch (e) {
      Alert.alert("Error", "Error de red");
    } finally {
      setLoadingPass(false);
    }
  };

  return (
    <ThemedView style={styles.mainContainer}>
      {/* FONDO DE PANTALLA */}
      <ImageBackground
        source={{ uri: BACKGROUND_IMAGE }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.darkOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* TARJETA DE LOGIN */}
              <View style={styles.loginCard}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('../assets/images/logo.png')}
                    style={styles.logo}
                    contentFit="contain"
                  />
                </View>

                <ThemedText style={styles.welcomeText}>
                  Sistema Gestión de Ocurrencias
                </ThemedText>
                <ThemedText style={styles.subWelcomeText}>
                 PRISMA OPS
                </ThemedText>

               <View style={styles.form}>
      <ThemedText style={styles.label}>USUARIO</ThemedText>
      <TextInput
        style={styles.input}
        value={usuario}
        onChangeText={(t) => setUsuario(t.toUpperCase())}
        autoCapitalize="characters"
        placeholder="Ingrese su Usuario"
        placeholderTextColor="#94A3B8"
      />

      <ThemedText style={styles.label}>CONTRASEÑA</ThemedText>
      <TextInput
        style={styles.input}
        value={contrasena}
        onChangeText={setContrasena}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor="#94A3B8"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        activeOpacity={0.8}
      >
        <ThemedText style={styles.buttonText}>
          INGRESAR AL SISTEMA
        </ThemedText>
      </TouchableOpacity>

      {/* Botón para cambiar contraseña */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={styles.forgotPassword}
      >
        <ThemedText style={styles.forgotText}>
          ¿Desea cambiar su contraseña?
        </ThemedText>
      </TouchableOpacity>
       
      {/* Botón de Soporte Técnico (Alterna la visibilidad abajo) */}
      <TouchableOpacity
        onPress={() => setShowSupport(!showSupport)}
        style={styles.forgotPassword}
      >
        <ThemedText style={styles.supportName}>Soporte técnico</ThemedText>
      </TouchableOpacity>

      {/* Datos de soporte que aparecen/desaparecen abajo al presionar */}
      {showSupport && (
        <View style={styles.supportContainer}>
          <ThemedText style={styles.supportName}>Roberto Alexander Cóndor Jara</ThemedText>
          <ThemedText style={styles.supportEmail}>condorjaraa@gmail.com - 997356558</ThemedText>
        </View>
      )}
    </View>
                
              </View>
              
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>

      {/* MODAL DE CAMBIO DE CONTRASEÑA */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <ThemedText style={styles.modalTitle}>Seguridad</ThemedText>

              <View style={styles.modalFieldGroup}>
                <ThemedText style={styles.modalFieldLabel}>
                  DNI de Usuario
                </ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="DNI"
                  value={usuario}
                  onChangeText={(t) => setUsuario(t.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <ThemedText style={styles.modalFieldLabel}>
                  Contraseña Actual
                </ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Clave actual"
                  secureTextEntry
                  value={passActual}
                  onChangeText={setPassActual}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <ThemedText style={styles.modalFieldLabel}>
                  Nueva Contraseña
                </ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                  value={nuevaPass}
                  onChangeText={setNuevaPass}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <ThemedText style={styles.modalFieldLabel}>
                  Confirmar Nueva Contraseña
                </ThemedText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Repita la clave"
                  secureTextEntry
                  value={confirmarPass}
                  onChangeText={setConfirmarPass}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: "#EDF2F7" }]}
                  onPress={() => setModalVisible(false)}
                >
                  <ThemedText style={{ color: "#4A5568", fontWeight: "bold" }}>
                    CANCELAR
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: MJM_BLUE }]}
                  onPress={handleUpdatePassword}
                >
                  {loadingPass ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={{ color: "#fff", fontWeight: "bold" }}>
                      GUARDAR
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  backgroundImage: { flex: 1, width: "100%", height: "100%" },
  darkOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 25 },
  loginCard: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 30,
    paddingVertical: 30,
    paddingHorizontal: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 12,
  },
  // Contenedor adaptado a la proporción horizontal de la nueva imagen
  logoContainer: {
    width: '100%',
    maxWidth: 280, // Ancho controlado para que no ocupe toda la tarjeta
    height: 110,    // Altura fija proporcional al ancho de esta nueva imagen
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { 
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  welcomeText: {
    fontSize: 14,
    letterSpacing: 1.5,
    color: "#64748B",
    fontWeight: "800",
    marginBottom: 2,
    textAlign: "center",
  },
  subWelcomeText: {
    fontSize: 24,
    fontWeight: "900",
    color: MJM_BLUE,
    marginBottom: 25,
    textAlign: "center",
  },
  form: { width: "100%" },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: MJM_BLUE,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    height: 50,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 16,
    color: "#1E293B",
    fontWeight: "600",
  },
  button: {
    backgroundColor: MJM_BLUE,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  forgotPassword: { marginTop: 15, alignItems: "center" },
  forgotText: {
    color: "#475569",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  supportName: {
    fontSize: 11,
    fontWeight: "700",
    color: MJM_BLUE,
    marginTop: 10,
  },
  supportEmail: {
    fontSize: 11,
    color: MJM_BLUE,
    fontWeight: "600",
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 72, 133, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 350,
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    padding: 22,
    elevation: 25,
  },
  supportContainer: {
  marginTop: 8,
  padding: 12,
  backgroundColor: '#F8FAFC', // Un fondo sutil (gris muy claro / azulado)
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  alignItems: 'center',        // Centra el texto (o cámbialo a 'flex-start' si prefieres a la izquierda)
},
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: MJM_BLUE,
    marginBottom: 20,
    textAlign: "center",
  },
  modalFieldGroup: { marginBottom: 15 },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 5,
    marginLeft: 2,
  },
  modalInput: {
    height: 45,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1E293B",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 15 },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});