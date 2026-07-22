import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, ChevronRight, ChevronDown, MapPin, Upload, X, Share2 } from "lucide-react";
import { getReport, updateReport, getScheduleEntry, updateScheduleEntry } from "../lib/reportsApi";
import { generateServiceReportPDF } from "../lib/generateReport";
import { readFileAsDataURL } from "../lib/fileUtils";
import SignaturePad from "../components/SignaturePad";
import PDFPreviewModal from "../components/PDFPreviewModal";
import ImagePreviewModal from "../components/ImagePreviewModal";

function sectionSummary(section) {
  if (!section) return { checked: 0, remarks: 0 };
  const checked = section.items.length;
  const remarks = section.items.filter((i) => i.remark && i.remark.trim() !== "").length;
  return { checked, remarks };
}

export default function ReviewSignoff() {
  const { id } = useParams();
  const [report, setReport] = useState(null);

  const [engineerName, setEngineerName] = useState("");
  const engineerCanvasRef = useRef(null);
  const [engineerDate, setEngineerDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyStamp, setCompanyStamp] = useState(null);
  const [copied, setCopied] = useState(false);
  const [savingEngineerDate, setSavingEngineerDate] = useState(false);
  const [engineerDateMessage, setEngineerDateMessage] = useState("");
  const [previewReport, setPreviewReport] = useState(null);
  const [expandedSections, setExpandedSections] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  function toggleSection(idx) {
    setExpandedSections((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }

  function openPreview() {
    setPreviewReport({
      ...report,
      engineerName,
      engineerSignature: engineerCanvasRef.current?.toDataURL("image/png"),
      engineerDate,
      companyStamp,
    });
  }

  async function handleCopySignLink() {
    const url = `${window.location.origin}/sign/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function handleStampChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setCompanyStamp(await readFileAsDataURL(file));
    } catch (err) {
      alert(`Gagal muat naik company stamp: ${err.message}`);
    }
  }

  async function saveEngineerDate() {
    if (!id || !report) return;
    setSavingEngineerDate(true);
    setEngineerDateMessage("");
    try {
      await updateReport(id, { engineerDate });
      setReport((prev) => ({ ...prev, engineerDate }));
      setEngineerDateMessage("Date saved successfully.");
    } catch (err) {
      alert(`Gagal simpan tarikh jurutera: ${err.message}`);
    } finally {
      setSavingEngineerDate(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    (async () => {
      const r = await getReport(id);
      setReport(r);
      setEngineerName(r?.leadTechnician ?? "");
      setEngineerDate(r?.engineerDate ?? new Date().toISOString().slice(0, 10));
    })();
  }, [id]);

  function clearCanvas(ref) {
    const canvas = ref.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }

  async function approve() {
    if (!id || !report) return;
    const engineerSignature = engineerCanvasRef.current?.toDataURL("image/png");

    // Only the engineer signs internally. "Verified by Manager/Team" is the
    // same person as the customer in this business, so that box is left
    // blank here and gets filled in later when the customer signs via the
    // shareable /sign/:id link (see CustomerSign.jsx).
    const payload = {
      status: "verified",
      engineerName,
      engineerSignature,
      engineerDate,
      companyStamp,
    };

    try {
      await updateReport(id, payload);
      if (report.scheduleId) {
        try {
          const entry = await getScheduleEntry(report.scheduleId);
          if (entry?.templateSelections && Array.isArray(entry.templateSelections)) {
            const updated = entry.templateSelections.map((s) =>
              s.reportId === report.reportId || s.reportId === report.id
                ? { ...s, status: "verified" }
                : s,
            );
            const allVerified = updated.every((s) => s.status === "verified");
            await updateScheduleEntry(report.scheduleId, {
              templateSelections: updated,
              status: allVerified ? "verified" : "in_progress",
            });
          } else {
            // legacy single-report schedule
            await updateScheduleEntry(report.scheduleId, { status: "verified" });
          }
        } catch (err) {
          console.error("Failed to update schedule entry after verify:", err);
        }
      }
      setReport((prev) => ({ ...prev, ...payload }));
      generateServiceReportPDF({ ...report, ...payload });
    } catch (err) {
      console.error("Failed to finalize report:", err);
      alert(`Gagal finalize laporan: ${err.message}`);
    }
  }

  if (!report) {
    return <p className="py-10 text-center text-muted">Loading report…</p>;
  }

  const sections = (report.sections ?? []).map((s) => ({ label: s.sectionName, data: s }));
  const lastSectionWithRemark = [...(report.sections ?? [])]
    .reverse()
    .flatMap((s) => s.items)
    .find((i) => i.remark);

  if (report.status === "verified") {
    return (
      <div className="space-y-4">
        <section className="flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50 p-5 shadow-sm">
          <CheckCircle2 size={22} className="shrink-0 text-teal-600" />
          <div>
            <p className="font-bold text-teal-600">Verified &amp; Finalized</p>
            <p className="text-sm text-muted">
              This report has already been signed off internally. It&apos;s now part of the
              history log.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">Report ID</p>
          <div className="mb-3 rounded-md bg-surface px-3 py-2 text-sm font-semibold">{report.reportId}</div>
          <p className="text-xs font-semibold uppercase text-muted">Inspection Date</p>
          <p className="mb-3 font-bold">{report.dateOfService}</p>
          <p className="text-xs font-semibold uppercase text-muted">Location</p>
          <p className="mb-3 flex items-center gap-1 font-bold">
            <MapPin size={16} className="text-navy-700" /> {report.locationDoor}
          </p>
          <p className="text-xs font-semibold uppercase text-muted">Checklist Used</p>
          <p className="font-bold">{report.templateName ?? "-"}</p>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-bold uppercase text-navy-800">Checklist Status Overview</h3>
          </div>
          <div className="divide-y divide-border">
            {sections.map((s, idx) => {
              const { checked, remarks } = sectionSummary(s.data);
              const isOpen = expandedSections.includes(idx);
              return (
                <div key={s.label} className="divide-y divide-border">
                  <button
                    type="button"
                    onClick={() => toggleSection(idx)}
                    aria-expanded={isOpen}
                    className="relative z-10 group flex w-full items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-navy-50"
                  >
                    <div>
                      <p className="text-xs text-muted">{String(idx + 1).padStart(2, "0")}</p>
                      <p className="font-bold text-ink">{s.label}</p>
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
                      {s.data.items?.map((item, itemIdx) => (
                        <div key={item.id ?? `item-${idx}-${itemIdx}`} className="mb-2 rounded-md border border-border bg-white p-3 shadow-sm last:mb-0">
                          <p className="font-semibold text-ink">{itemIdx + 1}. {item.question}</p>
                          <p className="text-xs text-muted">Answer: {item.answer ?? "N/A"}</p>
                          {item.remark ? <p className="mt-1 text-xs text-danger-600">Remark: {item.remark}</p> : null}
                          {item.photo ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(item.photo)}
                              className="mt-2 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-navy-800 hover:bg-navy-50"
                            >
                              Preview Photo
                            </button>
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

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase text-navy-800">Sign-off Record</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="mb-1 text-xs font-bold uppercase text-navy-800">Checked by Engineer</p>
              <p className="mb-2 text-sm font-semibold text-ink">{report.engineerName || "-"}</p>
              {report.engineerSignature ? (
                <img
                  src={report.engineerSignature}
                  alt="Engineer signature"
                  className="h-20 w-full rounded-md border border-dashed border-border bg-surface object-contain"
                />
              ) : (
                <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border bg-surface text-xs text-muted">
                  No signature captured
                </div>
              )}
              <div className="mt-2">
                <label className="block text-xs text-muted">Date</label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={engineerDate}
                    onChange={(e) => setEngineerDate(e.target.value)}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={saveEngineerDate}
                    disabled={savingEngineerDate || engineerDate === (report.engineerDate || "")}
                    className="rounded-md bg-navy-800 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingEngineerDate ? "Saving…" : "Save"}
                  </button>
                </div>
                {engineerDateMessage && (
                  <p className="mt-1 text-xs text-teal-600">{engineerDateMessage}</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="mb-1 text-xs font-bold uppercase text-navy-800">Verified by Manager/Team</p>
              <p className="mb-2 text-sm font-semibold text-ink">{report.reviewedBy || "-"}</p>
              {report.managerSignature ? (
                <img
                  src={report.managerSignature}
                  alt="Manager signature"
                  className="h-20 w-full rounded-md border border-dashed border-border bg-surface object-contain"
                />
              ) : (
                <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border bg-surface text-xs text-muted">
                  Not signed yet
                </div>
              )}
              <div className="mt-2">
                <label className="block text-xs text-muted">Date</label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={engineerDate}
                    onChange={(e) => setEngineerDate(e.target.value)}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={saveEngineerDate}
                    disabled={savingEngineerDate || engineerDate === (report.engineerDate || "")}
                    className="rounded-md bg-navy-800 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingEngineerDate ? "Saving…" : "Save"}
                  </button>
                </div>
                {engineerDateMessage && (
                  <p className="mt-1 text-xs text-teal-600">{engineerDateMessage}</p>
                )}
              </div>

              {!report.managerSignature && (
                <button
                  onClick={handleCopySignLink}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border-2 border-navy-800 py-2 text-xs font-bold text-navy-800 hover:bg-navy-50"
                >
                  <Share2 size={14} /> {copied ? "Link Copied ✓" : "Copy Sign-off Link"}
                </button>
              )}
            </div>
          </div>

          {report.companyStamp && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border p-4">
              <img
                src={report.companyStamp}
                alt="Company stamp"
                className="h-16 w-16 rounded-md border border-border bg-white object-contain p-1"
              />
              <p className="text-xs font-semibold uppercase text-navy-800">Company Stamp on File</p>
            </div>
          )}

          {!report.managerSignature && (
            <p className="mt-3 text-center text-xs text-muted">
              Share the link above with the customer — they&apos;ll see only this report and
              their signature fills the &quot;Verified by Manager/Team&quot; box.
            </p>
          )}

          <button
            onClick={() => setPreviewReport(report)}
            className="mt-5 w-full rounded-md bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700"
          >
            Preview &amp; Download PDF
          </button>
        </section>

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

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <span className="mb-3 inline-block rounded-full bg-navy-50 px-3 py-1 text-xs font-bold text-navy-700">
          Internal Verification
        </span>
        <p className="text-xs font-semibold uppercase text-muted">Report ID</p>
        <div className="mb-3 rounded-md bg-surface px-3 py-2 text-sm font-semibold">{report.reportId}</div>

        <p className="text-xs font-semibold uppercase text-muted">Inspection Date</p>
        <p className="mb-3 font-bold">{report.dateOfService}</p>

        <p className="text-xs font-semibold uppercase text-muted">Location</p>
        <p className="mb-3 flex items-center gap-1 font-bold">
          <MapPin size={16} className="text-navy-700" /> {report.locationDoor}
        </p>

        <p className="text-xs font-semibold uppercase text-muted">Lead Technician</p>
        <p className="flex items-center gap-2 font-bold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-xs text-white">
            {(report.leadTechnician ?? "?").charAt(0)}
          </span>
          {report.leadTechnician}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold uppercase text-navy-800">Checklist Status Overview</h3>
        </div>
        <div className="divide-y divide-border">
          {sections.map((s, idx) => {
            const { checked, remarks } = sectionSummary(s.data);
            const isOpen = expandedSections.includes(idx);
            return (
              <div key={s.label} className="divide-y divide-border">
                <button
                  type="button"
                  onClick={() => toggleSection(idx)}
                  aria-expanded={isOpen}
                  className="relative z-10 group flex w-full items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-navy-50"
                >
                  <div>
                    <p className="text-xs text-muted">{String(idx + 1).padStart(2, "0")}</p>
                    <p className="font-bold text-ink">{s.label}</p>
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
                    {s.data.items?.map((item, itemIdx) => (
                      <div key={item.id ?? `item-${idx}-${itemIdx}`} className="mb-2 rounded-md border border-border bg-white p-3 shadow-sm last:mb-0">
                        <p className="font-semibold text-ink">{itemIdx + 1}. {item.question}</p>
                        <p className="text-xs text-muted">Answer: {item.answer ?? "N/A"}</p>
                        {item.remark ? <p className="mt-1 text-xs text-danger-600">Remark: {item.remark}</p> : null}
                        {item.photo ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item.photo)}
                            className="mt-2 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-navy-800 hover:bg-navy-50"
                          >
                            Preview Photo
                          </button>
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

      <section className="rounded-xl border-l-4 border-navy-800 bg-navy-50 p-4 text-sm italic text-navy-800">
        {lastSectionWithRemark ? <>“{lastSectionWithRemark.remark}”</> : "No remarks recorded for this report."}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold uppercase text-navy-800">Engineer Sign-off</h3>
        <p className="mb-4 text-sm text-muted">
          Only the engineer signs here. The &quot;Verified by Manager/Team&quot; signature is
          collected later from the customer via a shareable link, after you finalize.
        </p>

        <div className="space-y-4">
          <SignaturePad
            label="Checked by Engineer"
            name={engineerName}
            onNameChange={setEngineerName}
            canvasRef={engineerCanvasRef}
            onClear={() => clearCanvas(engineerCanvasRef)}
          />

          <div>
            <label className="mb-1 block text-sm font-semibold text-ink">Digital COP (Company Stamp)</label>
            {companyStamp ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
                <img
                  src={companyStamp}
                  alt="Company stamp preview"
                  className="h-16 w-16 rounded-md border border-border bg-white object-contain p-1"
                />
                <button
                  onClick={() => setCompanyStamp(null)}
                  className="flex items-center gap-1 rounded-md border border-danger-600 px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-100"
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
                  onChange={handleStampChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <label className="mb-1 block text-sm font-semibold text-ink">Approval Date</label>
          <input
            type="date"
            value={engineerDate}
            onChange={(e) => setEngineerDate(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={openPreview}
          className="mt-5 w-full rounded-md border-2 border-navy-800 py-3 text-sm font-bold text-navy-800 hover:bg-navy-50"
        >
          Preview Report (PDF)
        </button>
        <button
          onClick={approve}
          className="mt-3 w-full rounded-md bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700"
        >
          ✓ Approve &amp; Finalize Report
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          After this, you can share a sign-off link with the customer so they can add their
          signature to the &quot;Verified by Manager/Team&quot; box.
        </p>
      </section>

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
