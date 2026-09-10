import { useEffect, useState } from "react";
import { X, Download, FileText } from "lucide-react";
import {
  getSummaryPDFBlobUrl,
  generateSummaryPDF,
  getSummaryPDFFilename,
} from "../lib/generateSummaryPDF";

export default function SummaryPreviewModal({
  reports,
  onClose,
  initialOrientation = "landscape",
}) {
  const [orientation, setOrientation] = useState(initialOrientation);
  const [blobUrl, setBlobUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      const url = getSummaryPDFBlobUrl(reports, { orientation });
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      console.error("Failed to generate summary PDF preview:", err);
    }

    return () => {
      cancelled = true;
    };
  }, [reports, orientation]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  function handleDownload() {
    setDownloading(true);
    try {
      const filename = getSummaryPDFFilename(reports, { orientation });
      generateSummaryPDF(reports, filename, { orientation });
    } catch (err) {
      alert(`Gagal memuat turun Summary PDF: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 bg-navy-900 text-white">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-bold text-base flex items-center gap-2">
              <FileText size={18} /> Summary Preview ({reports.length} report{reports.length > 1 ? "s" : ""})
            </h3>

            {/* Orientation Switcher */}
            <div className="flex items-center rounded-lg bg-navy-800 p-0.5 text-xs font-semibold border border-white/15 shadow-inner">
              <button
                type="button"
                onClick={() => setOrientation("landscape")}
                className={`px-3 py-1 rounded-md transition ${
                  orientation === "landscape"
                    ? "bg-teal-600 text-white font-bold shadow-xs"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Landscape
              </button>
              <button
                type="button"
                onClick={() => setOrientation("portrait")}
                className={`px-3 py-1 rounded-md transition ${
                  orientation === "portrait"
                    ? "bg-teal-600 text-white font-bold shadow-xs"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Portrait
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-500 shadow-sm disabled:opacity-50"
            >
              <Download size={14} />{" "}
              {downloading
                ? "Downloading…"
                : `Download (${orientation === "landscape" ? "Landscape" : "Portrait"})`}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 hover:bg-navy-800 text-white"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-surface p-2">
          {blobUrl ? (
            <iframe
              src={blobUrl}
              title="Summary PDF Preview"
              className="h-full w-full rounded-md border border-border"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">
              Loading summary preview…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
