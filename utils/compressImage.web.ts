// Compresión para entorno Web usando Canvas (HTML5)
export const comprimirImagen = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(file);

    image.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = image;
      const maxWidth = 1200;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No se pudo obtener el contexto 2D de Canvas"));

      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Error al convertir a Blob"));
          resolve(blob);
        },
        "image/jpeg",
        0.75
      );
    };

    image.onerror = (err) => reject(err);
  });
};