import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const MJM_BLUE = "#024885";
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
type FotoEstado = {
  uri: string;
  url_remota: string | null;
  uploading: boolean;
  base64?: string;
};

export default function ProvinciaScreen() {
  const [provincias, setProvincias] = useState<any[]>([]);
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalBorrarVisible, setModalBorrarVisible] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [idParaAccion, setIdParaAccion] = useState<number | null>(null);
  const [form, setForm] = useState({
    nombre_provincia: "",
    id_departamento: "",
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [resProv, resDep] = await Promise.all([
        fetch(`${API_URL}/provincias`),
        fetch(`${API_URL}/departamentos`),
      ]);
      setProvincias(await resProv.json());
      setDepartamentos(await resDep.json());
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const guardar = async () => {
    if (!form.nombre_provincia || !form.id_departamento)
      return Alert.alert("Error", "Completa los campos");
    try {
      const resp = await fetch(`${API_URL}/provincias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id_provincia: editandoId }),
      });
      if (resp.ok) {
        setModalVisible(false);
        cargarDatos();
        Alert.alert("Éxito", "Operación realizada");
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar");
    }
  };

  const eliminar = async () => {
    await fetch(`${API_URL}/provincias/${idParaAccion}/desactivar`, {
      method: "PATCH",
    });
    setModalBorrarVisible(false);
    cargarDatos();
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Provincias</ThemedText>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setEditandoId(null);
            setForm({ nombre_provincia: "", id_departamento: "" });
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={26} color="white" />
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color={MJM_BLUE} />
      ) : (
        <FlatList
          data={provincias}
          keyExtractor={(item) => item.id_provincia.toString()}
          contentContainerStyle={{ padding: 15 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.cardTitle}>
                  {item.nombre_provincia}
                </ThemedText>
                <ThemedText style={styles.cardSub}>
                  {item.nombre_departamento}
                </ThemedText>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditandoId(item.id_provincia);
                    setForm({
                      nombre_provincia: item.nombre_provincia,
                      id_departamento: item.id_departamento.toString(),
                    });
                    setModalVisible(true);
                  }}
                >
                  <Ionicons name="pencil" size={20} color={MJM_BLUE} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ marginLeft: 15 }}
                  onPress={() => {
                    setIdParaAccion(item.id_provincia);
                    setModalBorrarVisible(true);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#f87171" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* MODAL FORMULARIO */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>
              {editandoId ? "Editar" : "Nueva"} Provincia
            </ThemedText>
            <ThemedText style={styles.label}>Departamento:</ThemedText>
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={form.id_departamento}
                onValueChange={(v) => setForm({ ...form, id_departamento: v })}
              >
                <Picker.Item label="Seleccione..." value="" />
                {departamentos.map((d) => (
                  <Picker.Item
                    key={d.id_departamento}
                    label={d.nombre_departamento}
                    value={d.id_departamento.toString()}
                  />
                ))}
              </Picker>
            </View>
            <ThemedText style={styles.label}>Nombre Provincia:</ThemedText>
            <TextInput
              style={styles.input}
              value={form.nombre_provincia}
              onChangeText={(t) => setForm({ ...form, nombre_provincia: t })}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.btnSave} onPress={guardar}>
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                GUARDAR
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 15 }}
              onPress={() => setModalVisible(false)}
            >
              <ThemedText style={{ textAlign: "center", color: "#64748b" }}>
                CANCELAR
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL ELIMINAR */}
      <Modal visible={modalBorrarVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { alignItems: "center" }]}>
            <Ionicons name="alert-circle" size={50} color="#f87171" />
            <ThemedText style={styles.modalTitle}>
              ¿Eliminar Provincia?
            </ThemedText>
            <TouchableOpacity
              style={[styles.btnSave, { backgroundColor: "#f87171" }]}
              onPress={eliminar}
            >
              <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                SÍ, ELIMINAR
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 15 }}
              onPress={() => setModalBorrarVisible(false)}
            >
              <ThemedText style={{ color: "#64748b" }}>VOLVER</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    padding: 50,
    paddingBottom: 20,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "bold", color: MJM_BLUE },
  addBtn: { backgroundColor: MJM_BLUE, padding: 10, borderRadius: 12 },
  card: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  cardTitle: { fontWeight: "bold", fontSize: 16 },
  cardSub: { fontSize: 12, color: "#64748b" },
  actions: { flexDirection: "row" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: "white",
    width: "85%",
    borderRadius: 20,
    padding: 25,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    color: MJM_BLUE,
  },
  label: { fontSize: 11, fontWeight: "bold", color: MJM_BLUE, marginBottom: 5 },
  pickerBox: { backgroundColor: "#f1f5f9", borderRadius: 10, marginBottom: 15 },
  input: {
    backgroundColor: "#f1f5f9",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  btnSave: {
    backgroundColor: MJM_BLUE,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },
});
