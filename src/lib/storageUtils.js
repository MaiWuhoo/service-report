import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/** Uploads a Blob to Firebase Storage and returns its public download URL.
 *  Used for anything too big to embed directly in a Firestore document
 *  (1 MiB hard limit per document) — checklist photos, logos, stamps. */
export async function uploadImageToStorage(path, blob) {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || "image/jpeg" });
  return getDownloadURL(storageRef);
}
