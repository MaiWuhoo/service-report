import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getShareLink } from "../lib/reportsApi";
import CustomerSignBatch from "./CustomerSignBatch";
import CustomerSign from "./CustomerSign";

export default function ShareLinkRedirect() {
  const { token } = useParams();
  const [link, setLink] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getShareLink(token);
        if (!data) {
          setNotFound(true);
        } else {
          setLink(data);
        }
      } catch (err) {
        console.error("Error loading share link:", err);
        setNotFound(true);
      }
    })();
  }, [token]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <p className="text-center text-muted">
          This link is invalid or has expired.
        </p>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (link.mode === "single" && link.reportIds?.length === 1) {
    return <CustomerSign idProp={link.reportIds[0]} />;
  }

  return <CustomerSignBatch idsProp={link.reportIds ?? []} />;
}
