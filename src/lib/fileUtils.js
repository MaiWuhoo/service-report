export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Reads an image file, downscales it, and returns a compressed JPEG data
 *  URL — full camera photos are several MB, which is both slow to store in
 *  Firestore and unnecessary for a checklist thumbnail/report photo. */
export function readImageFileCompressed(
  file,
  maxDimension = 1000,
  quality = 0.72,
) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Same idea as readImageFileCompressed, but resolves a compressed Blob
 *  instead of a data URL — used when uploading to Cloudinary instead of
 *  embedding the image directly in a Firestore document. */
export function compressImageToBlob(file, maxDimension = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("Failed to compress image")),
          "image/jpeg",
          quality,
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** jsPDF's addImage needs the format ("PNG"/"JPEG") — infer it from the data URL. */
export function imageFormatFromDataUrl(dataUrl) {
  if (!dataUrl) return "PNG";
  const match = /^data:image\/(png|jpeg|jpg);/i.exec(dataUrl);
  if (!match) return "PNG";
  return match[1].toUpperCase() === "JPG" ? "JPEG" : match[1].toUpperCase();
}
