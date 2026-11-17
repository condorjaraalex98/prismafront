
import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

const MAX_WIDTH = 1200;

const obtenerDimensiones = (
  uri: string
): Promise<{ width: number; height: number } | null> =>
  new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    );
  });

export const comprimirImagen = async (
  uri: string
): Promise<string> => {
  if (!uri) {
    throw new Error("No se recibió la ruta de la imagen.");
  }

  const dimensiones = await obtenerDimensiones(uri);

  const actions: ImageManipulator.Action[] =
    dimensiones && dimensiones.width > MAX_WIDTH
      ? [{ resize: { width: MAX_WIDTH } }]
      : [];

  const resultado = await ImageManipulator.manipulateAsync(
    uri,
    actions,
    {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  if (!resultado?.uri) {
    throw new Error("No se pudo generar la imagen comprimida.");
  }

  return resultado.uri;
};
