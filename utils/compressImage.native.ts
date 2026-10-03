// Compresión para entorno Móvil (Android/iOS) usando Manipulator
import * as ImageManipulator from "expo-image-manipulator";

export const comprimirImagen = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );

  return result.uri;
};