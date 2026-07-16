import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, MapPin, Eye } from "lucide-react";
import { getReport, updateReport } from "../lib/reportsApi";
import SignaturePad from "../components/SignaturePad";
import PDFPreviewModal from "../components/PDFPreviewModal";

function sectionSummary(section) {
  if (!section) return { checked: 0, remarks: 0 };
  const checked = section.items.length;
  const remarks = section.items.filter((i) => i.remark && i.remark.trim() !== "").length;
  return { checked, remarks };
}

export default function CustomerSign() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const canvasRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await getReport(id);
        if (!r) {
          setNotFound(true);
        } else {
          setReport(r);
        }
      } catch {
        setNotFound(true);
      }
    })();
  }, [id]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }

  async function submitSignature() {
    if (!customerName.trim()) {
      alert("Please enter your name before signing.");
      return;
    }
    const dataUrl = canvasRef.current?.toDataURL("image/png");
    setSubmitting(true);
    try {
      // Writes to the same fields the internal "Verified by Manager/Team" box
      // reads — in this business the customer IS the manager/team signer, so
      // there's no separate third signature, just this one filled in remotely.
      const payload = {
        reviewedBy: customerName,
        managerSignature: dataUrl,
        reviewDate: new Date().toISOString().slice(0, 10),
      };
      await updateReport(id, payload);
      setReport((prev) => ({ ...prev, ...payload }));
      setJustSigned(true);
    } catch (err) {
      console.error("Failed to submit customer signature:", err);
      alert(`Something went wrong: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <p className="text-center text-muted">This report link is invalid or no longer available.</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <p className="text-muted">Loading report…</p>
      </div>
    );
  }

  const alreadySigned = Boolean(report.managerSignature) && !justSigned;

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-white px-4 py-4">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {report.serviceProvider?.logo && (
            <img src={report.serviceProvider.logo} alt="" className="h-9 w-9 rounded object-contain" />
          )}
          <div>
            <p className="text-base font-bold text-navy-800">Service Report</p>
            <p className="text-xs text-muted">Customer Sign-off</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">Report ID</p>
          <div className="mb-3 rounded-md bg-surface px-3 py-2 text-sm font-semibold">{report.reportId}</div>
          <p className="text-xs font-semibold uppercase text-muted">Inspection Date</p>
          <p className="mb-3 font-bold">{report.dateOfService}</p>
          <p className="text-xs font-semibold uppercase text-muted">Location</p>
          <p className="mb-1 flex items-center gap-1 font-bold">
            <MapPin size={16} className="text-navy-700" /> {report.locationDoor}
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-bold uppercase text-navy-800">Checklist Summary</h3>
          </div>
          <div className="divide-y divide-border">
            {(report.sections ?? []).map((s, idx) => {
              const { checked, remarks } = sectionSummary(s);
              return (
                <div key={s.sectionName} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-xs text-muted">{String(idx + 1).padStart(2, "0")}</p>
                    <p className="font-bold text-ink">{s.sectionName}</p>
                    <p className="text-xs text-muted">{checked} Items Checked</p>
                  </div>
                  {remarks > 0 ? (
                    <span className="text-xs font-semibold text-danger-600">
                      ⓘ {remarks} Remark{remarks > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-teal-600">
                      <CheckCircle2 size={14} /> All Pass
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <button
          onClick={() => setShowPreview(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-navy-800 py-3 text-sm font-bold text-navy-800 hover:bg-navy-50"
        >
          <Eye size={16} /> Preview Full Report (PDF)
        </button>

        {alreadySigned || justSigned ? (
          <section className="rounded-xl border border-teal-100 bg-teal-50 p-5 text-center shadow-sm">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-teal-600" />
            <p className="font-bold text-teal-700">Thank you, this report has been signed.</p>
            <p className="mt-1 text-sm text-muted">
              Signed by {report.reviewedBy} on {report.reviewDate}
            </p>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold uppercase text-navy-800">Your Sign-off</h3>
            <p className="mb-3 text-sm text-muted">
              Please review the checklist above, then sign to confirm you accept this report.
            </p>
            <SignaturePad
              label="Customer Signature"
              name={customerName}
              onNameChange={setCustomerName}
              canvasRef={canvasRef}
              onClear={clearCanvas}
            />
            <button
              onClick={submitSignature}
              disabled={submitting}
              className="mt-4 w-full rounded-md bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit Signature"}
            </button>
          </section>
        )}
      </main>

      {showPreview && (
        <PDFPreviewModal report={report} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
