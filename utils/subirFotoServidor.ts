import { Platform } from "react-native";
import { File } from "expo-file-system";

export const subirFotoAlServidor = async (
  fotoProcesada: Blob | string,
  apiUrl: string,
  idModalidad?: string | number,
  fechaEvento?: string,
  signal?: AbortSignal
): Promise<string> => {
  const uploadUrl = `${apiUrl.replace(/\/+$/, "")}/ocurrencias/subir-foto-adjunta`;
  const formData = new FormData();

  if (Platform.OS === "web") {
    let blob: Blob;
    if (fotoProcesada instanceof Blob) {
      blob = fotoProcesada;
    } else {
      const resBlob = await fetch(fotoProcesada, { signal });
      blob = await resBlob.blob();
    }
    const ext = blob.type?.split("/")[1] || "jpg";
    formData.append("foto", blob, `foto.${ext}`);
  } else {
    const uriLocal = fotoProcesada as string;
    const uriFinal =
      uriLocal.startsWith("file://") || uriLocal.startsWith("content://")
        ? uriLocal
        : `file://${uriLocal}`;
    formData.append("foto", new File(uriFinal) as any);
  }

  if (idModalidad !== undefined && idModalidad !== "") {
    formData.append("id_modalidad", String(idModalidad));
  }
  if (fechaEvento) {
    formData.append("fecha_evento", String(fechaEvento));
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
    signal,
  });

  const rawText = await response.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    // Respuesta HTML/texto (413, 502, 504)
  }

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Error HTTP ${response.status} al subir la imagen al servidor`
    );
  }

  if (!data.url_imagen) {
    throw new Error("El servidor no devolvió url_imagen");
  }

  return data.url_imagen;
};