import { Platform } from "react-native";
import { File } from "expo-file-system";

export const subirFotoAlServidor = async (
  fotoProcesada: Blob | string,
  apiUrl: string
): Promise<string> => {
  const uploadUrl = `${apiUrl}/ocurrencias/subir-foto-adjunta`;
  const formData = new FormData();

  if (Platform.OS === "web") {
    // En Web la imagen procesada es un Blob[cite: 4]
    formData.append("foto", fotoProcesada as Blob, "foto.jpg");
  } else {
    // En Móvil usamos la clase File nativa para streaming directo sin duplicar RAM
    const uriLocal = fotoProcesada as string;
    const cleanUri = Platform.OS === "android" ? uriLocal : uriLocal.replace("file://", "");
    
    formData.append("foto", new File(cleanUri) as any);
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || data.error || "Error al subir la imagen al servidor");
  }

  return data.url_imagen; // Retorna la URL generada en R2[cite: 4]
};