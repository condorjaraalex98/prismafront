import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
  import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { comprimirImagen } from "@/utils/compressImage";
import { subirFotoAlServidor } from "@/utils/subirFotoServidor";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/userContext";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.100.13:3000";
type FotoEstado = {
  uri: string;
  url_remota: string | null;
  uploading: boolean;
  base64?: string;
};
const MJM_BLUE = "#024885";

export default function RegistroOcurrencia() {
  const insets = useSafeAreaInsets();
  const { userData } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
 

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState(new Date());

  const [tiposVia, setTiposVia] = useState([]);
  const [vias, setVias] = useState([]);
  const [cuadras, setCuadras] = useState([]);
  const [selTipoVia, setSelTipoVia] = useState<any>(null);
  const [selVia, setSelVia] = useState<any>(null);

  const [catalogos, setCatalogos] = useState({
    usuarios: [],
    modalidades: [],
    origenes: [],
    camaras: [],
    tipos_patrullaje: [],
    modalidades_patrullaje: [],
    tipos_vehiculo: [],
    unidades: [],
    pnps: [],
  });

  // Checklist de control obligatorio
  const [checklistForm, setChecklistForm] = useState([
    {
      id_item: 1,
      label: "Sistema de Luces (Altas/Bajas/Direccionales)",
      esta_conforme: 1,
      observacion: "",
    },
    {
      id_item: 2,
      label: "Estado de Neumáticos y Presión",
      esta_conforme: 1,
      observacion: "",
    },
    {
      id_item: 3,
      label: "Nivel de Combustible y Fluidos",
      esta_conforme: 1,
      observacion: "",
    },
    {
      id_item: 4,
      label: "Sistema de Frenos y Amortiguación",
      esta_conforme: 1,
      observacion: "",
    },
    {
      id_item: 5,
      label: "Carrocería, Espejos y Limpieza General",
      esta_conforme: 1,
      observacion: "",
    },
  ]);

  const [form, setForm] = useState({
    id_usuario: null,
    id_lugar: null,
    id_modalidad: 126,
    id_origen: 3,
    id_tipo_patrullaje: 1,
    id_modalidad_patrullaje: 1,

    id_tipo_vehiculo: null as number | null,
    id_unidad: null as number | null,
    placa: "",
    odometro_inicial: "",
    tipo_asignacion: "MUNICIPAL" as "MUNICIPAL" | "INTEGRADO",
    id_pnp: null as number | null,

    id_camara: [] as any[],
    descripcion: "",
    hora_alerta: "",
    hora_llegada: "",
    hora_repliegue: "",
    latitud_gps: "0",
    longitud_gps: "0",
 turno: null,
    nombre_punto_gps: "",
     estadoOcurrencia: "PENDIENTE",referencia: "",
    unidad_encargada: "SERENAZGO",
    fecha_evento: new Date().toISOString().split("T")[0],
    grupo: "1",
  });

  useEffect(() => {
    if (userData) {
      setForm((prev) => ({
        ...prev,
        id_usuario: userData.id || (userData as any).id_usuario,
      }));
    }
    cargarCatalogosCamna();
    obtenerGpsAutomatico();
  }, [userData]);

  const cargarCatalogosCamna = async () => {
    try {
      setLoading(true);
      const [resGral, resTiposV, resPnps] = await Promise.all([
        fetch(`${API_URL}/catalogos/completo/camna?tipoLugar=5`),
        fetch(`${API_URL}/catalogos/tipos-vehiculo`),
        fetch(`${API_URL}/catalogos/pnp-activos`),
      ]);

      const data = await resGral.json();
      const dataTiposV = await resTiposV.json();
      const dataPnps = await resPnps.json();

      setCatalogos({
        usuarios: data.usuarios || [],
        modalidades: data.modalidades || [],
        origenes: data.origenes || [],
        camaras: data.camara || [],
        tipos_patrullaje: data.tipos_patrullaje || [],
        modalidades_patrullaje: data.modalidades_patrullaje || [],
        tipos_vehiculo: dataTiposV || [],
        unidades: [],
        pnps: dataPnps || [],
      });
      setTiposVia(data.tipos_via || []);
    } catch (err) {
      console.error("Error catálogos:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnidades = async (idTipo: any) => {
    try {
      const res = await fetch(
        `${API_URL}/catalogos/vehiculos-por-tipo/${idTipo}`,
      );
      const data = await res.json();
      setCatalogos((prev) => ({ ...prev, unidades: data }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleTipoViaChange = async (idTipo: any) => {
    setSelTipoVia(idTipo);
    setSelVia(null);
    setCuadras([]);
    setForm((f) => ({ ...f, id_lugar: null }));
    try {
      const res = await fetch(`${API_URL}/catalogos/vias/${idTipo}`);
      const data = await res.json();
      setVias(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleViaChange = async (idVia: any) => {
    setSelVia(idVia);
    setForm((f) => ({ ...f, id_lugar: null }));
    try {
      const res = await fetch(`${API_URL}/catalogos/cuadras/${idVia}`);
      const data = await res.json();
      setCuadras(data);
    } catch (err) {
      console.error(err);
    }
  };

  const obtenerGpsAutomatico = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setForm((prev) => ({
        ...prev,
        latitud_gps: loc.coords.latitude.toString(),
        longitud_gps: loc.coords.longitude.toString(),
      }));
    } catch (e) {
      console.log(e);
    }
  };

  const capturarHoraActual = (campo: string) => {
    const ahora = new Date().toLocaleTimeString("en-GB", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    setForm((f) => ({ ...f, [campo]: ahora }));
  };

  const toggleChecklistItem = (id: number) => {
    setChecklistForm((prev) =>
      prev.map((item) =>
        item.id_item === id
          ? {
              ...item,
              esta_conforme: item.esta_conforme === 1 ? 0 : 1,
              observacion: item.esta_conforme === 1 ? item.observacion : "",
            }
          : item,
      ),
    );
  };

  const handleChecklistObservacion = (id: number, text: string) => {
    setChecklistForm((prev) =>
      prev.map((item) =>
        item.id_item === id ? { ...item, observacion: text } : item,
      ),
    );
  };

  const enviarRegistro = async () => {
    if (!form.id_lugar || !form.id_modalidad || !form.id_origen) {
      return Alert.alert(
        "Atención",
        "Debe completar la Ubicación Exacta, Origen y Modalidad en los pasos previos.",
      );
    }

    if (form.id_tipo_patrullaje === 3) {
      if (!form.id_unidad) {
        return Alert.alert(
          "Atención",
          "Debe seleccionar un vehículo/placa asignado.",
        );
      }
      if (!form.odometro_inicial.trim()) {
        return Alert.alert(
          "Atención",
          "El odómetro inicial es requerido para iniciar la guardia en la unidad.",
        );
      }
    }

    setLoading(true);

    const payload = {
      id_usuario: form.id_usuario,
      id_lugar: form.id_lugar,
      id_modalidad: form.id_modalidad,
      id_origen: form.id_origen,
      id_tipo_vehiculo: form.id_tipo_vehiculo,
      id_unidad: form.id_unidad,
      odometro_inicial:
        form.id_tipo_patrullaje === 3
          ? parseFloat(form.odometro_inicial)
          : null,

      checklist:
        form.id_tipo_patrullaje === 3
          ? checklistForm.map((item) => ({
              id_item: item.id_item,
              esta_conforme: item.esta_conforme,
              observacion: item.observacion,
            }))
          : [],

      descripcion: form.descripcion || "Sin descripción",
      hora_alerta: form.hora_alerta || null,
      hora_llegada: form.hora_llegada || null,
      hora_repliegue: form.hora_repliegue || null,
      latitud_gps: form.latitud_gps,
      longitud_gps: form.longitud_gps,
      referencia: form.referencia || "",
      unidad_encargada: form.unidad_encargada,
      fecha_evento: form.fecha_evento,
      grupo:
        form.grupo === "1"
          ? "GRUPO 1"
          : form.grupo === "2"
            ? "GRUPO 2"
            : "GRUPO 3",

      id_tipop: form.id_tipo_patrullaje,
      id_modalidadp: form.id_modalidad_patrullaje,
      id_camara: form.id_camara.map((c) => c.value).join(","),
      fotos: fotos.map((f) => ({ base64_data: f.base64 })),
    };

    try {
      const res = await fetch(
        `${API_URL}/api/vehiculo/iniciar-servicio-checklist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();

      if (res.ok && data.success) {
        setShowSuccessModal(true);
      } else {
        Alert.alert("Error", data.error || "No se pudo guardar el servicio.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Error de comunicación con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const renderMosaicos = (
    data: any[],
    currentId: any,
    field: string,
    iconDefault: string,
  ) => (
    <View style={styles.mosaicoGrid}>
      {data.map((item: any) => (
        <Pressable
          key={item.value}
          onPress={() => {
            // Al cambiar el tipo de patrullaje, si no es 3, limpiamos los datos del carro asignado
            setForm((f) => ({
              ...f,
              [field]: item.value,
              ...(item.value !== 3 && {
                id_unidad: null,
                placa: "",
                odometro_inicial: "",
              }),
            }));
          }}
          style={[
            styles.mosaicoItem,
            currentId === item.value && styles.mosaicoSelected,
          ]}
        >
          <Ionicons
            name={iconDefault as any}
            size={20}
            color={currentId === item.value ? "white" : MJM_BLUE}
          />
          <ThemedText
            style={[
              styles.mosaicoText,
              currentId === item.value && { color: "white" },
            ]}
          >
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ThemedView style={[styles.main, { paddingTop: insets.top }]}>
      <View style={styles.stepperContainer}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[styles.circle, step >= i && { backgroundColor: MJM_BLUE }]}
          >
            <ThemedText style={{ color: "white", fontWeight: "bold" }}>
              {i}
            </ThemedText>
          </View>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>
              PASO 1: DATOS GENERALES
            </ThemedText>
            <ThemedText style={styles.label}>OPERADOR</ThemedText>
            <TextInput
              style={styles.disabledInput}
              value={userData?.nombres || ""}
              editable={false}
            />

            <ThemedText style={styles.label}>GRUPO</ThemedText>            <ThemedText style={styles.label}>GRUPO</ThemedText> 
<ScrollView

showsHorizontalScrollIndicator={false}

contentContainerStyle={styles.label}

>

{renderMosaicos(

[

{ label: "GRUPO 1", value: "1" },

{ label: "GRUPO 2", value: "2" },

{ label: "GRUPO 3", value: "3" },

{ label: "GRUPO 4", value: "4" },

],

form.grupo,

"grupo",

"people-outline",

)}

</ScrollView>
        
    <ThemedText style={styles.label}>¿A QUÉ TURNO PERTENECE ESTE REPORTE?</ThemedText>
  <ScrollView
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.label}
    >
      {renderMosaicos(
        [
          { label: "MAÑANA", value: "M" },
          { label: "TARDE", value: "T" },
          { label: "NOCHE", value: "N" },
        ],
        form.turno, // Asegúrate de usar la propiedad correcta del estado, por ejemplo form.turno
        "turno",    // El nombre del campo que actualizará en tu formulario
        "time-outline", // Cambié el ícono opcionalmente a uno de reloj/tiempo
      )}
    </ScrollView>
            <Dropdown
              style={styles.dropdown}
              data={[
                { label: "GRUPO 1", value: "1" },
                { label: "GRUPO 2", value: "2" },
                { label: "GRUPO 3", value: "3" },
              ]}
              labelField="label"
              valueField="value"
              value={form.grupo}
              onChange={(i) => setForm({ ...form, grupo: i.value })}
            />

            <ThemedText style={[styles.label, { marginTop: 25 }]}>
              TIPO DE PATRULLAJE
            </ThemedText>
            {renderMosaicos(
              catalogos.tipos_patrullaje,
              form.id_tipo_patrullaje,
              "id_tipo_patrullaje",
              "shield-checkmark-outline",
            )}

            <ThemedText style={[styles.label, { marginTop: 15 }]}>
              MODALIDAD DE PATRULLAJE
            </ThemedText>
            {renderMosaicos(
              catalogos.modalidades_patrullaje,
              form.id_modalidad_patrullaje,
              "id_modalidad_patrullaje",
              "layers-outline",
            )}

            <ThemedText style={styles.label}>ORIGEN</ThemedText>
            <Dropdown
              style={styles.dropdown}
              data={catalogos.origenes}
              labelField="label"
              valueField="value"
              placeholder="Origen"
              value={form.id_origen}
              onChange={(i) => setForm({ ...form, id_origen: i.value })}
            />

            {/* --- CONDICIONAL TIPO DE PATRULLAJE MOTORIZADO (ID: 3) --- */}
            {form.id_tipo_patrullaje === 3 && (
              <View style={[styles.cascadaContainer, { marginTop: 20 }]}>
                <View style={styles.cascadaHeader}>
                  <Ionicons name="car" size={18} color={MJM_BLUE} />
                  <ThemedText style={styles.cascadaTitle}>
                    CONFIGURAR UNIDAD ASIGNADA
                  </ThemedText>
                </View>

                <ThemedText style={styles.labelSmall}>TIPO VEHÍCULO</ThemedText>
                <Dropdown
                  style={styles.dropdown}
                  data={catalogos.tipos_vehiculo}
                  labelField="label"
                  valueField="value"
                  value={form.id_tipo_vehiculo}
                  placeholder="Seleccione..."
                  onChange={(v) => {
                    setForm({
                      ...form,
                      id_tipo_vehiculo: v.value,
                      id_unidad: null,
                      placa: "",
                    });
                    fetchUnidades(v.value);
                  }}
                />

                <View style={styles.tabContainer}>
                  <Pressable
                    style={[
                      styles.tab,
                      form.tipo_asignacion === "MUNICIPAL" && styles.tabActive,
                    ]}
                    onPress={() =>
                      setForm({
                        ...form,
                        tipo_asignacion: "MUNICIPAL",
                        id_pnp: null,
                      })
                    }
                  >
                    <ThemedText
                      style={[
                        styles.tabTxt,
                        form.tipo_asignacion === "MUNICIPAL" && {
                          color: "white",
                        },
                      ]}
                    >
                      MUNICIPAL
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.tab,
                      form.tipo_asignacion === "INTEGRADO" && styles.tabActive,
                    ]}
                    onPress={() =>
                      setForm({ ...form, tipo_asignacion: "INTEGRADO" })
                    }
                  >
                    <ThemedText
                      style={[
                        styles.tabTxt,
                        form.tipo_asignacion === "INTEGRADO" && {
                          color: "white",
                        },
                      ]}
                    >
                      INTEGRADO
                    </ThemedText>
                  </Pressable>
                </View>

                {form.tipo_asignacion === "INTEGRADO" && (
                  <Dropdown
                    style={styles.dropdown}
                    data={catalogos.pnps}
                    search
                    labelField="label"
                    valueField="value"
                    value={form.id_pnp}
                    placeholder="Efectivo PNP"
                    onChange={(v) => setForm({ ...form, id_pnp: v.value })}
                  />
                )}

                <ThemedText style={styles.labelSmall}>
                  SELECCIONAR VEHÍCULO / PLACA *
                </ThemedText>
                <Dropdown
                  style={styles.dropdown}
                  data={catalogos.unidades}
                  labelField="label"
                  valueField="value"
                  value={form.id_unidad}
                  placeholder="Buscar placa..."
                  onChange={(v) =>
                    setForm({ ...form, id_unidad: v.value, placa: v.label })
                  }
                />

                {/* --- CONDICIONAL DE PLACA SELECCIONADA --- */}
                {/* Solo si form.id_unidad ya tiene un valor, se muestra el odómetro y el checklist */}
                {form.id_unidad && (
                  <View style={{ marginTop: 15 }}>
                    <ThemedText style={styles.labelSmall}>
                      ODÓMETRO INICIAL (KM) *
                    </ThemedText>
                    <TextInput
                      style={styles.textInputFisico}
                      keyboardType="numeric"
                      placeholder="Ej. 45200"
                      value={form.odometro_inicial}
                      onChangeText={(t) =>
                        setForm({ ...form, odometro_inicial: t })
                      }
                    />

                    {/* SECCIÓN CHECKLIST COMPLETO */}
                    <View style={styles.checklistSeccionContainer}>
                      <ThemedText style={styles.checklistSeccionTitle}>
                        CHECKLIST DE CONFORMIDAD ({form.placa || "UNIDAD"})
                      </ThemedText>

                      {checklistForm.map((item) => (
                        <View key={item.id_item} style={styles.checkItemBloque}>
                          <View style={styles.checkItemFilaPrincipal}>
                            <Pressable
                              style={styles.checkFilaInteractiva}
                              onPress={() => toggleChecklistItem(item.id_item)}
                            >
                              <Ionicons
                                name={
                                  item.esta_conforme === 1
                                    ? "checkbox"
                                    : "close-circle"
                                }
                                size={22}
                                color={
                                  item.esta_conforme === 1
                                    ? "#28a745"
                                    : "#dc3545"
                                }
                              />
                              <ThemedText style={styles.checkItemTexto}>
                                {item.label}
                              </ThemedText>
                            </Pressable>

                            <ThemedText
                              style={[
                                styles.badgeEstado,
                                {
                                  backgroundColor:
                                    item.esta_conforme === 1
                                      ? "#e8f5e9"
                                      : "#ffebee",
                                  color:
                                    item.esta_conforme === 1
                                      ? "#2e7d32"
                                      : "#c62828",
                                },
                              ]}
                            >
                              {item.esta_conforme === 1 ? "OK" : "FALLA"}
                            </ThemedText>
                          </View>

                          {/* Mostrar input de descripción SOLAMENTE si esta_conforme === 0 (FALLA) */}
                          {item.esta_conforme === 0 && (
                            <TextInput
                              style={styles.inputObservacionCheck}
                              placeholder="Escriba aquí el motivo o descripción de la falla..."
                              value={item.observacion}
                              onChangeText={(t) =>
                                handleChecklistObservacion(item.id_item, t)
                              }
                            />
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>
              PASO 2: TIEMPOS DE RESPUESTA
            </ThemedText>
            {["hora_alerta", "hora_llegada", "hora_repliegue"].map((k) => (
              <View key={k} style={styles.timeRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>
                    {k.toUpperCase().replace("_", " ")}
                  </ThemedText>
                  {Platform.OS === "web" ? (
                    <input
                      type="time"
                      value={(form as any)[k]}
                      onChange={(e) =>
                        setForm({ ...form, [k]: e.target.value })
                      }
                    />
                  ) : (
                    <Pressable
                      style={styles.inputSimpleContainer}
                      onPress={() => {
                        setActiveTimeField(k);
                        setShowTimePicker(true);
                      }}
                    >
                      <ThemedText style={styles.timeText}>
                        {(form as any)[k] || "00:00"}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
                <Pressable
                  style={styles.btnTime}
                  onPress={() => capturarHoraActual(k)}
                >
                  <Ionicons name="time" size={24} color="white" />
                </Pressable>
              </View>
            ))}
            <ThemedText style={styles.label}>FECHA DEL EVENTO</ThemedText>
            <Pressable
              style={styles.inputContainer}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={MJM_BLUE} />
              <ThemedText style={styles.inputText}>
                {form.fecha_evento}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {step === 3 && (
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>
              PASO 3: UBICACIÓN Y DETALLES
            </ThemedText>
            <View style={styles.cascadaContainer}>
              <View style={styles.cascadaHeader}>
                <Ionicons name="location" size={18} color={MJM_BLUE} />
                <ThemedText style={styles.cascadaTitle}>
                  UBICACIÓN EXACTA
                </ThemedText>
              </View>
              <ThemedText style={styles.labelSmall}>TIPO DE VÍA</ThemedText>
              <Dropdown
                style={styles.dropdown}
                data={tiposVia}
                labelField="label"
                valueField="value"
                placeholder="Seleccione..."
                value={selTipoVia}
                onChange={(item) => handleTipoViaChange(item.value)}
              />
              <ThemedText style={styles.labelSmall}>NOMBRE DE VÍA</ThemedText>
              <Dropdown
                style={[styles.dropdown, !selTipoVia && styles.disabledInput]}
                disable={!selTipoVia}
                data={vias}
                search
                labelField="label"
                valueField="value"
                placeholder="Busque vía..."
                value={selVia}
                onChange={(item) => handleViaChange(item.value)}
              />
              <ThemedText style={styles.labelSmall}>CUADRA</ThemedText>
              <Dropdown
                style={[styles.dropdown, !selVia && styles.disabledInput]}
                disable={!selVia}
                data={cuadras}
                labelField="label"
                valueField="value"
                placeholder="Seleccione..."
                value={form.id_lugar}
                onChange={(item) => setForm({ ...form, id_lugar: item.value })}
              />
            </View>
            <ThemedText style={styles.label}>REFERENCIA</ThemedText>
            <TextInput
              style={styles.textAreaSmall}
              value={form.referencia}
              onChangeText={(t) => setForm({ ...form, referencia: t })}
              multiline
              placeholder="Referencia del lugar..."
            />
          </View>
        )}

        {step === 4 && (
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>
              PASO 4: DATOS IMPORTANTES Y FOTOS
            </ThemedText>

            <ThemedText style={styles.label}>
              DATOS OCURRENCIA / DETALLES
            </ThemedText>
            <TextInput
              style={styles.textArea}
              multiline
              value={form.descripcion}
              onChangeText={(t) => setForm({ ...form, descripcion: t })}
              placeholder="Detalle lo sucedido minuciosamente..."
            />

            <ThemedText style={styles.label}>MODALIDAD OCURRENCIA</ThemedText>
            <Dropdown
              style={styles.dropdown}
              data={catalogos.modalidades}
              labelField="label"
              valueField="value"
              value={form.id_modalidad}
              onChange={(i) => setForm({ ...form, id_modalidad: i.value })}
            />

            {/* CARRUSEL DE FOTOS */}
            {fotos.length > 0 && (
              <View style={styles.carouselContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselScroll}
                >
                  {fotos.map((foto, index) => (
                    <View key={index} style={styles.photoWrapper}>
                      <Image
                        source={{ uri: foto.uri }}
                        style={styles.photoThumb}
                      />
                      <Pressable
                        style={styles.btnRemovePhoto}
                        onPress={() =>
                          setFotos((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#ff4d4d"
                        />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <Pressable
              style={styles.btnCam}
              onPress={async () => {
                let res = await ImagePicker.launchImageLibraryAsync({
                  base64: true,
                  allowsMultipleSelection: true,
                  quality: 0.3,
                });
                if (!res.canceled) {
                  setFotos((p) => [
                    ...p,
                    ...res.assets.map((a) => ({
                      uri: a.uri,
                      base64: `data:image/jpeg;base64,${a.base64}`,
                    })),
                  ]);
                }
              }}
            >
              <Ionicons name="camera" size={22} color="white" />
              <ThemedText
                style={{ color: "white", marginLeft: 10, fontWeight: "bold" }}
              >
                AÑADIR FOTOS ({fotos.length})
              </ThemedText>
            </Pressable>

            <Pressable
              style={styles.btnSave}
              onPress={enviarRegistro}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                  GUARDAR SERVICIO & CHECKLIST
                </ThemedText>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={styles.navContainer}>
        <Pressable
          style={[styles.navBtn, step === 1 && { opacity: 0 }]}
          onPress={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ThemedText style={{ color: MJM_BLUE, fontWeight: "bold" }}>
            ANTERIOR
          </ThemedText>
        </Pressable>
        {step < 4 && (
          <Pressable
            style={[styles.navBtn, { backgroundColor: MJM_BLUE }]}
            onPress={() => setStep(step + 1)}
          >
            <ThemedText style={{ color: "white", fontWeight: "bold" }}>
              SIGUIENTE
            </ThemedText>
          </Pressable>
        )}
      </View>

      {Platform.OS !== "web" && showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={(e, d) => {
            setShowDatePicker(false);
            if (d)
              setForm((f) => ({
                ...f,
                fecha_evento: d.toISOString().split("T")[0],
              }));
          }}
        />
      )}
      {Platform.OS !== "web" && showTimePicker && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={(e, d) => {
            setShowTimePicker(false);
            if (d && activeTimeField)
              setForm((f) => ({
                ...f,
                [activeTimeField]: d.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }));
          }}
        />
      )}

      <Modal visible={showSuccessModal} transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-done-circle" size={70} color="#28a745" />
            <ThemedText style={{ fontWeight: "bold", marginTop: 15 }}>
              ¡REGISTRO EXITOSO!
            </ThemedText>
            <Pressable
              style={styles.btnSave}
              onPress={() => router.replace("/(tabs)" as any)}
            >
              <ThemedText style={{ color: "white" }}>CERRAR</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#f0f2f5" },
  carouselContainer: { marginTop: 15, height: 110 },
  carouselScroll: { gap: 10, paddingHorizontal: 5 },
  photoWrapper: { position: "relative", width: 100, height: 100 },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#eee",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  btnRemovePhoto: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "white",
    borderRadius: 10,
  },
  stepperContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 15,
    gap: 20,
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#cbd5e0",
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },
  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: MJM_BLUE,
    marginBottom: 15,
    textAlign: "center",
  },
  label: { fontSize: 11, fontWeight: "bold", marginTop: 12, color: "#444" },
  labelSmall: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 12,
    color: "#666",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#eee",
    paddingVertical: 8,
  },
  inputText: { marginLeft: 10, fontSize: 16 },
  disabledInput: {
    backgroundColor: "#f8f9fa",
    color: "#aaa",
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },
  textInputFisico: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#000",
  },
  textAreaSmall: {
    borderWidth: 1,
    borderColor: "#eee",
    height: 50,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginTop: 5,
  },
  btnTime: {
    backgroundColor: MJM_BLUE,
    padding: 10,
    borderRadius: 10,
    marginTop: 15,
  },
  timeText: { fontSize: 18 },
  inputSimpleContainer: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#eee",
    paddingVertical: 8,
  },
  dropdown: { height: 40, borderBottomWidth: 1, borderBottomColor: "#eee" },
  textArea: {
    borderWidth: 1,
    borderColor: "#eee",
    height: 80,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
  },
  btnCam: {
    backgroundColor: "#343a40",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
  },
  btnSave: {
    backgroundColor: "#28a745",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
    width: "100%",
  },
  navContainer: {
    flexDirection: "row",
    padding: 15,
    gap: 10,
    backgroundColor: "white",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  navBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    width: "80%",
  },
  cascadaContainer: {
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#d0e3ff",
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  cascadaHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    gap: 8,
  },
  cascadaTitle: { fontSize: 12, fontWeight: "900", color: MJM_BLUE },
  mosaicoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  mosaicoItem: {
    width: "48%",
    backgroundColor: "#f1f4f8",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    minHeight: 65,
    justifyContent: "center",
  },
  mosaicoSelected: {
    backgroundColor: MJM_BLUE,
    borderColor: MJM_BLUE,
    elevation: 3,
  },
  mosaicoText: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 5,
    textAlign: "center",
    color: MJM_BLUE,
    textTransform: "uppercase",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#eee",
    borderRadius: 8,
    padding: 3,
    marginTop: 10,
  },
  tab: { flex: 1, padding: 8, alignItems: "center", borderRadius: 6 },
  tabActive: { backgroundColor: MJM_BLUE },
  tabTxt: { fontSize: 10, fontWeight: "bold", color: MJM_BLUE },

  // Checklist Estilos fijos
  checklistSeccionContainer: {
    marginTop: 25,
    borderTopWidth: 1.5,
    borderTopColor: "#f0f0f0",
    paddingTop: 15,
  },
  checklistSeccionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  checkItemBloque: {
    backgroundColor: "#fdfdfd",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#eaeaea",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  checkItemFilaPrincipal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkFilaInteractiva: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  checkItemTexto: { fontSize: 12, fontWeight: "500", color: "#444", flex: 1 },
  badgeEstado: {
    fontSize: 9,
    fontWeight: "bold",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: "hidden",
  },
  inputObservacionCheck: {
    borderWidth: 1,
    borderColor: "#dc3545",
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 11,
    marginTop: 8,
    color: "#333",
  },
});
