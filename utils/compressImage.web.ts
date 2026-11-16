export const comprimirImagen = async (
  input: File | Blob | string
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const esString = typeof input === "string";
    const objectUrl = esString ? input : URL.createObjectURL(input);

    const limpiar = () => {
      if (!esString) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onload = () => {
      try {
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
        if (!ctx) {
          limpiar();
          return reject(new Error("No se pudo obtener el contexto 2D de Canvas"));
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            limpiar();
            canvas.width = 0;
            canvas.height = 0;

            if (!blob) {
              return reject(new Error("Error al convertir a Blob"));
            }
            resolve(blob);
          },
          "image/jpeg",
          0.75
        );
      } catch (err) {
        limpiar();
        reject(err);
      }
    };

    image.onerror = (err) => {
      limpiar();
      reject(err);
    };

    image.src = objectUrl;
  });
};