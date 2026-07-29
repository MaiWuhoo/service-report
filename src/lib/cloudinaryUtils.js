const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/** Uploads a Blob to Cloudinary (unsigned upload) and returns its public
 *  HTTPS URL. Used instead of Firebase Storage — Cloudinary's free tier
 *  doesn't require a billing/Blaze plan upgrade. `publicId` can include
 *  slashes to organize into folders, e.g. "reports/abc123/item1-169..." */
export async function uploadImageToCloudinary(publicId, blob) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary belum disetup — isi VITE_CLOUDINARY_CLOUD_NAME dan VITE_CLOUDINARY_UPLOAD_PRESET dalam .env.local",
    );
  }

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", UPLOAD_PRESET);
  if (publicId) formData.append("public_id", publicId);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Upload ke Cloudinary gagal");
  }

  const data = await res.json();
  return data.secure_url;
}
