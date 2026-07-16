import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { getReportPDFBlobUrl, generateServiceReportPDF } from "../lib/generateReport";

export default function PDFPreviewModal({ report, onClose, onConfirm, confirmLabel }) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    const url = getReportPDFBlobUrl(report);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 md:p-6">
      <div className="flex h-full max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-bold text-navy-800">Report Preview</p>
          <button onClick={onClose} aria-label="Close preview" className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-surface">
          {blobUrl ? (
            <iframe src={blobUrl} title="Report PDF preview" className="h-full w-full" />
          ) : (
            <p className="p-8 text-center text-muted">Generating preview…</p>
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
            onClick={() => generateServiceReportPDF(report)}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border-2 border-navy-800 py-2.5 text-sm font-bold text-navy-800 hover:bg-navy-50"
          >
            <Download size={16} /> Download PDF
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
