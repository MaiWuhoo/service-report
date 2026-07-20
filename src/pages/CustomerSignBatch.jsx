import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { getReport, updateReport } from "../lib/reportsApi";
import SignaturePad from "../components/SignaturePad";

function sectionSummary(section) {
  if (!section) return { checked: 0, remarks: 0 };
  const checked = section.items.length;
  const remarks = section.items.filter(
    (i) => i.remark && i.remark.trim() !== "",
  ).length;
  return { checked, remarks };
}

export default function CustomerSignBatch() {
  const { ids } = useParams();
  const reportIds = (ids ?? "").split(",").filter(Boolean);

  const [reports, setReports] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [expandedSections, setExpandedSections] = useState([]);
  const canvasRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fetched = await Promise.all(reportIds.map((id) => getReport(id)));
        const valid = fetched.filter(Boolean);
        if (valid.length === 0) {
          setNotFound(true);
        } else {
          setReports(valid);
        }
      } catch {
        setNotFound(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

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
      const payload = {
        reviewedBy: customerName,
        managerSignature: dataUrl,
        reviewDate: new Date().toISOString().slice(0, 10),
      };
      await Promise.all(reports.map((r) => updateReport(r.id, payload)));
      setReports((prev) => prev.map((r) => ({ ...r, ...payload })));
      setJustSigned(true);
    } catch (err) {
      console.error("Failed to submit batch signature:", err);
      alert(`Something went wrong: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSection(reportId, idx) {
    const sectionKey = `${reportId}-${idx}`;
    setExpandedSections((prev) =>
      prev.includes(sectionKey)
        ? prev.filter((key) => key !== sectionKey)
        : [...prev, sectionKey],
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <p className="text-center text-muted">
          This link is invalid or no longer available.
        </p>
      </div>
    );
  }

  if (!reports) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <p className="text-muted">Loading reports…</p>
      </div>
    );
  }

  const alreadySigned = reports.every((r) => r.managerSignature) && !justSigned;
  const provider = reports[0]?.serviceProvider;

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-white px-4 py-4">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {provider?.logo && (
            <img
              src={provider.logo}
              alt=""
              className="h-9 w-9 rounded object-contain"
            />
          )}
          <div>
            <p className="text-base font-bold text-navy-800">Service Report</p>
            <p className="text-xs text-muted">
              Customer Sign-off · {reports.length} report
              {reports.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        {reports.map((report) => (
          <section
            key={report.id}
            className="rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="border-b border-border px-5 py-3">
              <p className="text-xs font-semibold uppercase text-muted">
                {report.reportId}
              </p>
              <p className="flex items-center gap-1 font-bold text-ink">
                <MapPin size={14} className="text-navy-700" />{" "}
                {report.locationDoor}
                <span className="ml-auto text-xs font-normal text-muted">
                  {report.dateOfService}
                </span>
              </p>
            </div>
            <div className="divide-y divide-border">
              {(report.sections ?? []).map((s, idx) => {
                const { checked, remarks } = sectionSummary(s);
                const sectionKey = `${report.id}-${idx}`;
                const isOpen = expandedSections.includes(sectionKey);
                return (
                  <div key={sectionKey} className="divide-y divide-border">
                    <button
                      type="button"
                      onClick={() => toggleSection(report.id, idx)}
                      aria-expanded={isOpen}
                      className="group flex w-full items-center justify-between px-5 py-3 text-left cursor-pointer hover:bg-navy-50"
                    >
                      <div>
                        <p className="text-xs text-muted">
                          {String(idx + 1).padStart(2, "0")}
                        </p>
                        <p className="text-sm font-semibold text-ink">
                          {s.sectionName}
                        </p>
                        <p className="text-xs text-muted">
                          {checked} Items Checked
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {remarks > 0 ? (
                          <span className="text-xs font-semibold text-danger-600">
                            ⓘ {remarks} Remark{remarks > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-teal-600">
                            <CheckCircle2 size={13} /> All Pass
                          </span>
                        )}
                        {isOpen ? (
                          <ChevronDown size={16} className="text-navy-700" />
                        ) : (
                          <ChevronRight size={16} className="text-navy-700" />
                        )}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="bg-surface px-5 py-3 text-sm text-muted">
                        {s.items?.map((item, itemIdx) => (
                          <div
                            key={item.id ?? `item-${sectionKey}-${itemIdx}`}
                            className="mb-2 rounded-md border border-border bg-white p-3 shadow-sm last:mb-0"
                          >
                            <p className="font-semibold text-ink">
                              {itemIdx + 1}. {item.question}
                            </p>
                            <p className="text-xs text-muted">
                              Answer: {item.answer ?? "N/A"}
                            </p>
                            {item.remark ? (
                              <p className="mt-1 text-xs text-danger-600">
                                Remark: {item.remark}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {alreadySigned || justSigned ? (
          <section className="rounded-xl border border-teal-100 bg-teal-50 p-5 text-center shadow-sm">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-teal-600" />
            <p className="font-bold text-teal-700">
              Thank you, all {reports.length} report
              {reports.length > 1 ? "s have" : " has"} been signed.
            </p>
            <p className="mt-1 text-sm text-muted">
              Signed by {reports[0]?.reviewedBy} on {reports[0]?.reviewDate}
            </p>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold uppercase text-navy-800">
              Your Sign-off
            </h3>
            <p className="mb-3 text-sm text-muted">
              This single signature will be applied to all {reports.length}{" "}
              report
              {reports.length > 1 ? "s" : ""} listed above.
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
              {submitting
                ? "Submitting…"
                : `Sign ${reports.length} Report${reports.length > 1 ? "s" : ""}`}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
