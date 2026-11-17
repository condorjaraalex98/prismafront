
export const comprimirImagen = async (
  input: File | Blob | string
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const esString = typeof input === "string";
    const objectUrl = esString
      ? input
      : URL.createObjectURL(input);

    let terminado = false;

    const limpiar = () => {
      if (terminado) return;
      terminado = true;

      if (!esString) {
        URL.revokeObjectURL(objectUrl);
      }

      image.onload = null;
      image.onerror = null;
    };

    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) {
          throw new Error("La imagen no tiene dimensiones válidas.");
        }

        const maxWidth = 1200;
        const escala = Math.min(1, maxWidth / image.naturalWidth);

        const width = Math.max(
          1,
          Math.round(image.naturalWidth * escala)
        );

        const height = Math.max(
          1,
          Math.round(image.naturalHeight * escala)
        );

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("No se pudo crear el contexto Canvas.");
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            limpiar();
            canvas.width = 0;
            canvas.height = 0;

            if (!blob || blob.size === 0) {
              reject(new Error("No se pudo comprimir la imagen."));
              return;
            }

            resolve(blob);
          },
          "image/jpeg",
          0.75
        );
      } catch (error) {
        limpiar();
        reject(error);
      }
    };

    image.onerror = () => {
      limpiar();
      reject(new Error("No se pudo abrir la imagen seleccionada."));
    };

    image.src = objectUrl;
  });
};
