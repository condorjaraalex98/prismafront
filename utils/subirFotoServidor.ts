import { Platform } from "react-native";
import { File } from "expo-file-system";
export const subirFotoAlServidor = async (
  fotoProcesada: Blob | string,
  apiUrl: string,
  idModalidad?: string | number,
  fechaEvento?: string
): Promise<string> => {
  const uploadUrl = `${apiUrl}/ocurrencias/subir-foto-adjunta`;
  const formData = new FormData();

  if (Platform.OS === "web") {
    formData.append("foto", fotoProcesada as Blob, "foto.jpg");
  } else {
    const uriLocal = fotoProcesada as string;
    const cleanUri = Platform.OS === "android" ? uriLocal : uriLocal.replace("file://", "");
    formData.append("foto", new File(cleanUri) as any);
  }

  // Agregamos la modalidad y la fecha del evento
  if (idModalidad) {
    formData.append("id_modalidad", String(idModalidad));
  }
  if (fechaEvento) {
    formData.append("fecha_evento", String(fechaEvento));
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || data.error || "Error al subir la imagen al servidor");
  }

  return data.url_imagen;
};