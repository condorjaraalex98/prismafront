
import { Platform } from "react-native";
import { File } from "expo-file-system";

export const subirFotoAlServidor = async (
  fotoProcesada: Blob | string,
  apiUrl: string,
  idModalidad?: string | number,
  fechaEvento?: string,
  signal?: AbortSignal
): Promise<string> => {
  const uploadUrl =
    `${apiUrl.replace(/\/+$/, "")}/ocurrencias/subir-foto-adjunta`;

  const formData = new FormData();

  if (Platform.OS === "web") {
    let blob: Blob;

    if (fotoProcesada instanceof Blob) {
      blob = fotoProcesada;
    } else {
      const respuestaArchivo = await fetch(fotoProcesada, { signal });

      if (!respuestaArchivo.ok) {
        throw new Error(
          `No se pudo leer la imagen local (${respuestaArchivo.status}).`
        );
      }

      blob = await respuestaArchivo.blob();
    }

    if (!blob.size) {
      throw new Error("La imagen está vacía.");
    }

    if (!blob.type.startsWith("image/")) {
      throw new Error("El archivo seleccionado no es una imagen válida.");
    }

    formData.append("foto", blob, "foto.jpg");
  } else {
    if (typeof fotoProcesada !== "string" || !fotoProcesada) {
      throw new Error("No se recibió la ruta local de la imagen.");
    }

    const uriFinal =
      fotoProcesada.startsWith("file://") ||
      fotoProcesada.startsWith("content://")
        ? fotoProcesada
        : `file://${fotoProcesada}`;

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
    // El servidor pudo devolver HTML o texto en un error 413, 502 o 504.
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Error HTTP ${response.status} al subir la imagen.`
    );
  }

  if (!data?.success || !data?.url_imagen) {
    throw new Error(
      data?.message || "El servidor no devolvió la URL de la imagen."
    );
  }

  return data.url_imagen;
};
