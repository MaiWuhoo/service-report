import { useEffect, useState } from "react";
import { authReady } from "../lib/firebase";

export default function AuthGate({ children }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);

  useEffect(() => {
    authReady
      .then(() => setStatus("ready"))
      .catch((err) => {
        console.error("Firebase auth failed:", err);
        setError(err);
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-sm text-muted">Connecting…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="max-w-md rounded-xl border border-danger-100 bg-white p-6 text-center shadow-sm">
          <p className="mb-2 font-bold text-danger-600">Could not connect to Firebase</p>
          <p className="mb-3 text-sm text-muted">{error?.message ?? "Unknown error"}</p>
          <p className="text-xs text-muted">
            Common causes: (1) <code>.env.local</code> values are wrong or missing, (2)
            Firestore Database hasn't been created yet in Firebase Console, or (3)
            &quot;Anonymous&quot; sign-in isn't enabled under Authentication → Sign-in
            method.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
