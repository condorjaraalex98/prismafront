import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

const MAX_WIDTH = 1200;

const obtenerAncho = (uri: string): Promise<number | null> =>
  new Promise((resolve) => {
    Image.getSize(
      uri,
      (width) => resolve(width),
      () => resolve(null)
    );
  });

export const comprimirImagen = async (uri: string): Promise<string> => {
  const width = await obtenerAncho(uri);
  const actions: ImageManipulator.Action[] =
    width === null || width > MAX_WIDTH
      ? [{ resize: { width: MAX_WIDTH } }]
      : [];

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.75,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return result.uri;
};