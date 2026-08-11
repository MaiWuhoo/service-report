import { useEffect, useState } from "react";
import { X, Download, ExternalLink } from "lucide-react";
import {
  getReportPDFBlobUrl,
  generateServiceReportPDF,
} from "../lib/generateReport";

const SPACING_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "wide", label: "Wide" },
];

export default function PDFPreviewModal({
  report,
  onClose,
  onConfirm,
  confirmLabel,
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [spacing, setSpacing] = useState("normal");
  const [rendering, setRendering] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRendering(true);

    (async () => {
      try {
        const url = await getReportPDFBlobUrl(report, { spacing });
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (err) {
        console.error("Failed to generate preview:", err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, spacing]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 md:p-6">
      <div className="flex h-full max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-navy-800">Report Preview</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs uppercase text-muted">
              Spacing
              <select
                value={spacing}
                onChange={(e) => setSpacing(e.target.value)}
                className="rounded-md border border-border bg-white px-2 py-1 text-sm"
              >
                {SPACING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={onClose}
              aria-label="Close preview"
              className="text-muted hover:text-ink"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-auto bg-surface touch-pan-y">
          {rendering && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/80">
              <p className="text-sm font-semibold text-muted">
                Generating preview…
              </p>
            </div>
          )}
          {blobUrl && (
            <iframe
              src={blobUrl}
              title="Report PDF preview"
              className="w-full"
              style={{ minHeight: "60vh", height: "100%", border: 0 }}
            />
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold text-ink hover:bg-surface"
          >
            Close
          </button>
          <button
            onClick={() => window.open(blobUrl, "_blank")}
            disabled={!blobUrl}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold text-ink hover:bg-surface disabled:opacity-50"
          >
            <ExternalLink size={16} /> Open Fullscreen
          </button>
          <button
            onClick={async () => {
              setDownloading(true);
              try {
                await generateServiceReportPDF(report, { spacing });
              } catch (err) {
                alert(`Gagal generate PDF: ${err.message}`);
              } finally {
                setDownloading(false);
              }
            }}
            disabled={downloading}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border-2 border-navy-800 py-2.5 text-sm font-bold text-navy-800 hover:bg-navy-50 disabled:opacity-60"
          >
            <Download size={16} /> {downloading ? "Preparing…" : "Download PDF"}
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="flex-1 rounded-md bg-navy-800 py-2.5 text-sm font-bold text-white hover:bg-navy-700"
            >
              {confirmLabel ?? "Confirm"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
