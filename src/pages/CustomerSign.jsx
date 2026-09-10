import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, MapPin, Eye, ChevronDown, ChevronRight, Upload, X, Download } from "lucide-react";
import { getReport, updateReport, getScheduleEntry, updateScheduleEntry, autoSaveManagerSignature, createShareLink } from "../lib/reportsApi";
import { readFileAsDataURL } from "../lib/fileUtils";
import SignaturePad from "../components/SignaturePad";
import PDFPreviewModal from "../components/PDFPreviewModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import { generateServiceReportPDF } from "../lib/generateReport";

function sectionSummary(section) {
  if (!section) return { checked: 0, remarks: 0 };
  const checked = section.items.length;
  const remarks = section.items.filter((i) => i.remark && i.remark.trim() !== "").length;
  return { checked, remarks };
}

export default function CustomerSign({ idProp }) {
  const { id: paramId } = useParams();
  const id = idProp || paramId;
  const [report, setReport] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [companyStamp, setCompanyStamp] = useState(null);
  const canvasRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);
  const [expandedSections, setExpandedSections] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (paramId && !idProp && id) {
      createShareLink([id], "single")
        .then((token) => {
          window.history.replaceState(null, "", `/s/${token}`);
        })
        .catch(() => {});
    }
  }, [paramId, idProp, id]);

  useEffect(() => {
    (async () => {
      try {
        const r = await getReport(id);
        if (!r) {
          setNotFound(true);
        } else {
          setReport(r);
          setCustomerName(r.reviewedBy ?? "");
          setCompanyStamp(r.companyStamp ?? null);
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
        companyStamp,
        status: "verified",
      };
      await updateReport(id, payload);
      await autoSaveManagerSignature(customerName, dataUrl, payload.reviewDate);
      if (report?.scheduleId) {
        try {
          const entry = await getScheduleEntry(report.scheduleId);
          if (entry) {
            if (entry.templateSelections && Array.isArray(entry.templateSelections)) {
              const updated = entry.templateSelections.map((s) =>
                s.reportId === report.reportId || s.reportId === report.id
                  ? {
                      ...s,
                      status: "verified",
                      managerSignature: dataUrl,
                      reviewedBy: customerName,
                      engineerSignature: s.engineerSignature || report.engineerSignature,
                    }
                  : s,
              );
              const allVerified = updated.every((s) => s.status === "verified");
              await updateScheduleEntry(report.scheduleId, {
                templateSelections: updated,
                status: allVerified ? "verified" : updated.some((s) => s.status) ? "in_progress" : entry.status,
              });
            } else {
              await updateScheduleEntry(report.scheduleId, { status: "verified" });
            }
          }
        } catch (err) {
          console.error("Failed to update schedule entry after customer sign:", err);
        }
      }
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

  function toggleSection(idx) {
    setExpandedSections((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  }

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
          {report.templateName && (
            <>
              <p className="text-xs font-semibold uppercase text-muted">Project Name</p>
              <div className="mb-3 font-bold text-navy-800 text-lg">{report.templateName}</div>
            </>
          )}
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
              const isOpen = expandedSections.includes(idx);
              return (
                <div key={`section-${idx}`} className="divide-y divide-border">
                  <button
                    type="button"
                    onClick={() => toggleSection(idx)}
                    aria-expanded={isOpen}
                    className="relative z-10 group flex w-full items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-navy-50"
                  >
                    <div>
                      <p className="text-xs text-muted">{String(idx + 1).padStart(2, "0")}</p>
                      <p className="font-bold text-ink">{s.sectionName}</p>
                      <p className="text-xs text-muted">{checked} Items Checked</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {remarks > 0 ? (
                        <span className="text-xs font-semibold text-danger-600">
                          ⓘ {remarks} Remark{remarks > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-teal-600">
                          <CheckCircle2 size={14} /> All Pass
                        </span>
                      )}
                      {isOpen ? (
                        <ChevronDown size={18} className="text-navy-700" />
                      ) : (
                        <ChevronRight size={18} className="text-navy-700" />
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="bg-surface px-5 py-3 text-sm text-muted">
                      {s.items?.map((item, itemIdx) => (
                        <div key={item.id ?? `item-${idx}-${itemIdx}`} className="mb-2 rounded-md border border-border bg-white p-3 shadow-sm last:mb-0">
                          <p className="font-semibold text-ink">{itemIdx + 1}. {item.question}</p>
                          <p className="text-xs text-muted">Answer: {item.answer ?? "N/A"}</p>
                          {item.remark ? <p className="mt-1 text-xs text-danger-600">Remark: {item.remark}</p> : null}
                          {(() => {
                            const p = item.photos || (item.photo ? [item.photo] : []);
                            if (p.length === 0) return null;
                            return (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {p.map((img, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => setPreviewImage(img)}
                                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-navy-800 hover:bg-navy-50"
                                  >
                                    Preview Photo {p.length > 1 ? i + 1 : ""}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <button
          onClick={() => setPreviewReport(report)}
          className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-navy-800 py-3 text-sm font-bold text-navy-800 hover:bg-navy-50"
        >
          <Eye size={16} /> Preview & Download PDF
        </button>

        {alreadySigned || justSigned ? (
          <section className="rounded-xl border border-teal-100 bg-teal-50 p-5 text-center shadow-sm">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-teal-600" />
            <p className="font-bold text-teal-700">Thank you, this report has been signed.</p>
            <p className="mt-1 text-sm text-muted">
              Signed by {report.reviewedBy} on {report.reviewDate}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPreviewReport(report)}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
              >
                <Eye size={16} /> Preview & Download PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setJustSigned(false);
                  setReport(prev => ({ ...prev, managerSignature: null }));
                }}
                className="flex-1 rounded-md border border-teal-600 py-2.5 text-sm font-bold text-teal-700 hover:bg-teal-100/50"
              >
                Correct Signature
              </button>
            </div>
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
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-ink">Digital COP (Company Stamp)</label>
              {companyStamp ? (
                <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
                  <img
                    src={companyStamp}
                    alt="Company stamp preview"
                    className="h-16 w-16 rounded-md border border-border bg-white object-contain p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setCompanyStamp(null)}
                    className="rounded-md border border-danger-600 px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-100"
                  >
                    <X size={13} /> Remove
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border py-6 text-center hover:bg-surface">
                  <Upload size={20} className="mb-2 text-navy-700" />
                  <p className="text-sm font-semibold text-navy-700">Attach Company Stamp</p>
                  <p className="text-xs text-muted">PNG or JPG with transparent background preferred</p>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setCompanyStamp(await readFileAsDataURL(file));
                      } catch (err) {
                        alert(`Gagal muat naik company stamp: ${err.message}`);
                      } finally {
                        e.target.value = "";
                      }
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>
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

      {previewReport && (
        <PDFPreviewModal report={previewReport} onClose={() => setPreviewReport(null)} />
      )}

      {previewImage && (
        <ImagePreviewModal
          src={previewImage}
          alt="Attached remark photo"
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
