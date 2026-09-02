import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  MapPin,
  Upload,
  X,
  Share2,
} from "lucide-react";
import {
  getReport,
  updateReport,
  getScheduleEntry,
  updateScheduleEntry,
  subscribeToReport,
  getEngineerSignatures,
  saveEngineerSignatures,
  getManagerSignatures,
  saveManagerSignatures,
  autoSaveManagerSignature,
  autoSaveEngineerSignature,
} from "../lib/reportsApi";
import { generateServiceReportPDF } from "../lib/generateReport";
import { compressImageToBlob } from "../lib/fileUtils";
import { uploadImageToCloudinary } from "../lib/cloudinaryUtils";
import SignaturePad from "../components/SignaturePad";
import PDFPreviewModal from "../components/PDFPreviewModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import ReportMediaViewer from "../components/ReportMediaViewer";

function sectionSummary(section) {
  if (!section) return { checked: 0, remarks: 0 };
  const checked = section.items.length;
  const remarks = section.items.filter(
    (i) => i.remark && i.remark.trim() !== "",
  ).length;
  return { checked, remarks };
}

export default function ReviewSignoff() {
  const { id } = useParams();
  const [report, setReport] = useState(null);

  const [engineerName, setEngineerName] = useState("");
  const engineerCanvasRef = useRef(null);
  const [engineerDate, setEngineerDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [companyStamp, setCompanyStamp] = useState(null);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savingEngineerDate, setSavingEngineerDate] = useState(false);
  const [engineerDateMessage, setEngineerDateMessage] = useState("");
  const [savingEngineerSign, setSavingEngineerSign] = useState(false);
  const [engineerSignMessage, setEngineerSignMessage] = useState("");
  const [savedEngineerSignatures, setSavedEngineerSignatures] = useState([]);
  const [activeSignatureId, setActiveSignatureId] = useState(null);
  const [selectedSignatureDataUrl, setSelectedSignatureDataUrl] =
    useState(null);
  const [editingSignatureId, setEditingSignatureId] = useState(null);
  const [editingSignatureName, setEditingSignatureName] = useState("");

  const [managerName, setManagerName] = useState("");
  const managerCanvasRef = useRef(null);
  const [managerDate, setManagerDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [managerSignatureUrl, setManagerSignatureUrl] = useState(null);
  const [savedManagerSignatures, setSavedManagerSignatures] = useState([]);
  const [activeManagerSigId, setActiveManagerSigId] = useState(null);
  const [savingManagerData, setSavingManagerData] = useState(false);
  const [managerDataMessage, setManagerDataMessage] = useState("");
  const [savingManagerSign, setSavingManagerSign] = useState(false);
  const [showManagerPad, setShowManagerPad] = useState(false);
  const [editingManagerSigId, setEditingManagerSigId] = useState(null);
  const [editingManagerSigName, setEditingManagerSigName] = useState("");

  const [previewReport, setPreviewReport] = useState(null);
  const [expandedSections, setExpandedSections] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  function toggleSection(idx) {
    setExpandedSections((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  }

  function openPreview() {
    let finalMgrSig = managerSignatureUrl;
    if (showManagerPad && managerCanvasRef.current) {
      const drawn = managerCanvasRef.current.toDataURL("image/png");
      if (drawn) finalMgrSig = drawn;
    }
    setPreviewReport({
      ...report,
      engineerName,
      engineerSignature:
        engineerCanvasRef.current?.toDataURL("image/png") ||
        report.engineerSignature,
      engineerDate,
      reviewedBy: managerName,
      managerSignature: finalMgrSig,
      reviewDate: managerDate,
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
    setUploadingStamp(true);
    try {
      const blob = await compressImageToBlob(file, 500, 0.85);
      const url = await uploadImageToCloudinary(
        `reports/${id}/stamp-${Date.now()}`,
        blob,
      );
      setCompanyStamp(url);
    } catch (err) {
      alert(`Gagal muat naik company stamp: ${err.message}`);
    } finally {
      setUploadingStamp(false);
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
    let initialized = false;
    const unsub = subscribeToReport(id, (r) => {
      setReport(r);
      if (r && !initialized) {
        setEngineerName(r.engineerName ?? r.leadTechnician ?? "");
        setEngineerDate(
          r.engineerDate ?? new Date().toISOString().slice(0, 10),
        );
        setManagerName(r.reviewedBy ?? "");
        setManagerDate(
          r.reviewDate ?? new Date().toISOString().slice(0, 10),
        );
        setManagerSignatureUrl(r.managerSignature ?? null);
        initialized = true;
      }
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    async function loadShared() {
      try {
        const [list, mList] = await Promise.all([
          getEngineerSignatures(),
          getManagerSignatures(),
        ]);
        setSavedEngineerSignatures(list || []);
        setSavedManagerSignatures(mList || []);
        if (list?.length > 0 && !report?.engineerSignature) {
          setActiveSignatureId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load shared signatures:", err);
      }
    }
    loadShared();
  }, [id]);

  function clearCanvas(ref) {
    const canvas = ref.current;
    if (canvas) {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function selectEngineerSignature(signature) {
    setEngineerName(signature.name);
    setEngineerDate(signature.date ?? engineerDate);
    setActiveSignatureId(signature.id);
    setSelectedSignatureDataUrl(signature.signature);
    setReport((prev) => ({
      ...prev,
      engineerName: signature.name,
      engineerSignature: signature.signature,
    }));
  }

  function selectManagerSignature(signature) {
    setManagerName(signature.name);
    setManagerDate(signature.date ?? managerDate);
    setActiveManagerSigId(signature.id);
    setManagerSignatureUrl(signature.signature);
    setShowManagerPad(false);
  }

  async function saveManagerData() {
    if (!id || !report) return;
    setSavingManagerData(true);
    setManagerDataMessage("");

    let finalSig = managerSignatureUrl;
    if (showManagerPad && managerCanvasRef.current) {
      const drawn = managerCanvasRef.current.toDataURL("image/png");
      if (drawn) finalSig = drawn;
    }

    try {
      const payload = {
        reviewedBy: managerName,
        managerSignature: finalSig,
        reviewDate: managerDate,
      };
      await updateReport(id, payload);
      setReport((prev) => ({ ...prev, ...payload }));
      setManagerSignatureUrl(finalSig);

      if (managerName?.trim() && finalSig) {
        const updatedList = await autoSaveManagerSignature(
          managerName,
          finalSig,
          managerDate,
        );
        if (updatedList) setSavedManagerSignatures(updatedList);
      }

      setManagerDataMessage(
        "Manager verification saved & signature stored for future reports!",
      );
      setTimeout(() => setManagerDataMessage(""), 4000);
    } catch (err) {
      alert(`Failed to save manager verification data: ${err.message}`);
    } finally {
      setSavingManagerData(false);
    }
  }

  async function saveNewManagerSignatureToSaved() {
    let sigData = managerSignatureUrl;
    if (showManagerPad && managerCanvasRef.current) {
      sigData = managerCanvasRef.current.toDataURL("image/png");
    }
    if (!managerName?.trim()) {
      alert("Please enter Manager/Team Name first.");
      return;
    }
    if (!sigData) {
      alert("Please draw or select a signature first.");
      return;
    }

    setSavingManagerSign(true);
    const newSig = {
      id: crypto?.randomUUID?.() ?? `m-sig-${Date.now()}`,
      name: managerName.trim(),
      signature: sigData,
      date: managerDate,
    };
    const nextList = [...savedManagerSignatures, newSig];
    try {
      await saveManagerSignatures(nextList);
      setSavedManagerSignatures(nextList);
      setActiveManagerSigId(newSig.id);
      setManagerSignatureUrl(sigData);
      alert(`Saved "${newSig.name}" to manager signatures.`);
    } catch (err) {
      alert(`Failed to save manager signature: ${err.message}`);
    } finally {
      setSavingManagerSign(false);
    }
  }

  async function saveEngineerSign() {
    if (!id || !report) return;
    setSavingEngineerSign(true);
    setEngineerSignMessage("");
    const engineerSignature = engineerCanvasRef.current?.toDataURL("image/png");
    if (!engineerName?.trim()) {
      alert("Please enter the engineer's name before saving the signature.");
      setSavingEngineerSign(false);
      return;
    }
    if (!engineerSignature) {
      alert("Please sign in the signature box before saving.");
      setSavingEngineerSign(false);
      return;
    }

    const newSignature = {
      id: crypto?.randomUUID?.() ?? `sig-${Date.now()}`,
      name: engineerName.trim(),
      signature: engineerSignature,
      date: engineerDate,
    };

    const nextShared = [...savedEngineerSignatures, newSignature];

    try {
      await Promise.all([
        updateReport(id, { engineerName, engineerSignature, engineerDate }),
        saveEngineerSignatures(nextShared),
      ]);
      setReport((prev) => ({
        ...prev,
        engineerName,
        engineerSignature,
        engineerDate,
      }));
      setSavedEngineerSignatures(nextShared);
      setActiveSignatureId(newSignature.id);
      setSelectedSignatureDataUrl(newSignature.signature);
      setEngineerSignMessage("Engineer sign saved successfully.");
    } catch (err) {
      alert(`Failed to save engineer signature: ${err.message}`);
    } finally {
      setSavingEngineerSign(false);
    }
  }

  async function approve() {
    if (!id || !report) return;
    const engineerSignature =
      engineerCanvasRef.current?.toDataURL("image/png") ||
      report.engineerSignature;
    let finalMgrSig = managerSignatureUrl;
    if (showManagerPad && managerCanvasRef.current) {
      const drawn = managerCanvasRef.current.toDataURL("image/png");
      if (drawn) finalMgrSig = drawn;
    }

    const payload = {
      status: "verified",
      engineerName,
      engineerSignature,
      engineerDate,
      reviewedBy: managerName,
      managerSignature: finalMgrSig,
      reviewDate: managerDate,
      companyStamp,
    };

    try {
      await updateReport(id, payload);
      if (managerName?.trim() && finalMgrSig) {
        const updatedMgrList = await autoSaveManagerSignature(
          managerName,
          finalMgrSig,
          managerDate,
        );
        if (updatedMgrList) setSavedManagerSignatures(updatedMgrList);
      }
      if (engineerName?.trim() && engineerSignature) {
        const updatedEngList = await autoSaveEngineerSignature(
          engineerName,
          engineerSignature,
          engineerDate,
        );
        if (updatedEngList) setSavedEngineerSignatures(updatedEngList);
      }
      if (report.scheduleId) {
        try {
          const entry = await getScheduleEntry(report.scheduleId);
          if (
            entry?.templateSelections &&
            Array.isArray(entry.templateSelections)
          ) {
            const updated = entry.templateSelections.map((s) =>
              s.reportId === report.reportId || s.reportId === report.id
                ? {
                    ...s,
                    status: "verified",
                    engineerSignature: engineerSignature || s.engineerSignature,
                    managerSignature: finalMgrSig || s.managerSignature,
                    engineerName: engineerName || s.engineerName,
                    reviewedBy: managerName || s.reviewedBy,
                  }
                : s,
            );
            const allVerified = updated.every((s) => s.status === "verified");
            await updateScheduleEntry(report.scheduleId, {
              templateSelections: updated,
              status: allVerified ? "verified" : "in_progress",
            });
          } else {
            await updateScheduleEntry(report.scheduleId, {
              status: "verified",
            });
          }
        } catch (err) {
          console.error("Failed to update schedule entry after verify:", err);
        }
      }
      setReport((prev) => ({ ...prev, ...payload }));
      setPreviewReport({ ...report, ...payload });
    } catch (err) {
      console.error("Failed to finalize report:", err);
      alert(`Gagal finalize laporan: ${err.message}`);
    }
  }

  if (!report) {
    return <p className="py-10 text-center text-muted">Loading report…</p>;
  }

  const sections = (report.sections ?? []).map((s) => ({
    label: s.sectionName,
    data: s,
  }));
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
              This report has already been signed off internally. It&apos;s now
              part of the history log.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">
            Report ID
          </p>
          <div className="mb-3 rounded-md bg-surface px-3 py-2 text-sm font-semibold">
            {report.reportId}
          </div>
          <p className="text-xs font-semibold uppercase text-muted">
            Inspection Date
          </p>
          <p className="mb-3 font-bold">{report.dateOfService}</p>
          <p className="text-xs font-semibold uppercase text-muted">Location</p>
          <p className="mb-3 flex items-center gap-1 font-bold">
            <MapPin size={16} className="text-navy-700" /> {report.locationDoor}
          </p>
          <p className="text-xs font-semibold uppercase text-muted">
            Checklist Used
          </p>
          <p className="font-bold">{report.templateName ?? "-"}</p>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-sm font-bold uppercase text-navy-800">
              Checklist Status Overview
            </h3>
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
                      <p className="text-xs text-muted">
                        {String(idx + 1).padStart(2, "0")}
                      </p>
                      <p className="font-bold text-ink">{s.label}</p>
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
                        <div
                          key={item.id ?? `item-${idx}-${itemIdx}`}
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
                          {(() => {
                            const p =
                              item.photos || (item.photo ? [item.photo] : []);
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

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase text-navy-800">
            Sign-off Record
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="mb-1 text-xs font-bold uppercase text-navy-800">
                Checked by Engineer
              </p>
              <p className="mb-2 text-sm font-semibold text-ink">
                {report.engineerName || "-"}
              </p>
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
                    disabled={
                      savingEngineerDate ||
                      engineerDate === (report.engineerDate || "")
                    }
                    className="rounded-md bg-navy-800 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingEngineerDate ? "Saving…" : "Save"}
                  </button>
                </div>
                {engineerDateMessage && (
                  <p className="mt-1 text-xs text-teal-600">
                    {engineerDateMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-navy-800">
                  Verified by Manager/Team
                </p>
                {savedManagerSignatures.length > 0 && (
                  <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-semibold text-navy-800">
                    {savedManagerSignatures.length} Saved
                  </span>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Manager / Team Name
                </label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="e.g. Muhammad Hilmie"
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-navy-700"
                />
              </div>

              {/* Saved Manager/Team Signatures List */}
              <div className="rounded-md border border-border bg-surface p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-navy-800">
                    Saved Manager/Team Signatures
                  </p>
                </div>

                {savedManagerSignatures.length === 0 ? (
                  <p className="text-xs text-muted italic">
                    No saved manager signatures yet. Draw a signature below and click &quot;+ Save to Manager Signatures&quot; to add one.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {savedManagerSignatures.map((s) => (
                      <div key={s.id} className="flex items-center gap-1">
                        {editingManagerSigId === s.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingManagerSigName}
                              onChange={(e) =>
                                setEditingManagerSigName(e.target.value)
                              }
                              className="rounded border border-border bg-white px-1.5 py-0.5 text-xs font-medium"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const next = savedManagerSignatures.map((sig) =>
                                  sig.id === s.id
                                    ? { ...sig, name: editingManagerSigName }
                                    : sig,
                                );
                                try {
                                  await saveManagerSignatures(next);
                                  setSavedManagerSignatures(next);
                                  setEditingManagerSigId(null);
                                  if (activeManagerSigId === s.id) {
                                    setManagerName(editingManagerSigName);
                                  }
                                } catch (err) {
                                  alert(`Failed to update signature name: ${err.message}`);
                                }
                              }}
                              className="rounded bg-teal-600 px-1.5 py-0.5 text-[11px] font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingManagerSigId(null)}
                              className="rounded border px-1.5 py-0.5 text-[11px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 rounded-md border border-border bg-white p-1 shadow-xs">
                            <button
                              type="button"
                              onClick={() => selectManagerSignature(s)}
                              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                activeManagerSigId === s.id || managerSignatureUrl === s.signature
                                  ? "bg-navy-800 text-white font-bold"
                                  : "text-ink hover:bg-navy-50"
                              }`}
                            >
                              {s.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingManagerSigId(s.id);
                                setEditingManagerSigName(s.name);
                              }}
                              className="rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-surface hover:text-ink"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm(`Remove saved signature for "${s.name}"?`))
                                  return;
                                const next = savedManagerSignatures.filter(
                                  (sig) => sig.id !== s.id,
                                );
                                try {
                                  await saveManagerSignatures(next);
                                  setSavedManagerSignatures(next);
                                  if (activeManagerSigId === s.id) {
                                    setActiveManagerSigId(null);
                                  }
                                } catch (err) {
                                  alert(`Failed to remove signature: ${err.message}`);
                                }
                              }}
                              className="rounded px-1.5 py-0.5 text-[10px] text-danger-600 hover:bg-danger-50"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">
                    Signature Preview / Draw
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManagerPad((prev) => !prev)}
                      className="text-xs font-semibold text-navy-700 hover:underline"
                    >
                      {showManagerPad ? "Hide Canvas" : "Draw Signature"}
                    </button>
                    {managerSignatureUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setManagerSignatureUrl(null);
                          setActiveManagerSigId(null);
                        }}
                        className="text-xs font-semibold text-danger-600 hover:underline"
                      >
                        Clear Sign
                      </button>
                    )}
                  </div>
                </div>

                {showManagerPad ? (
                  <div className="space-y-2">
                    <SignaturePad
                      label=""
                      name={managerName}
                      onNameChange={setManagerName}
                      canvasRef={managerCanvasRef}
                      onClear={() => clearCanvas(managerCanvasRef)}
                      signatureDataUrl={managerSignatureUrl}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={saveNewManagerSignatureToSaved}
                        disabled={savingManagerSign}
                        className="rounded-md border border-navy-800 px-2.5 py-1 text-[11px] font-semibold text-navy-800 hover:bg-navy-50 disabled:opacity-50"
                      >
                        {savingManagerSign ? "Saving..." : "+ Save to Manager Signatures"}
                      </button>
                    </div>
                  </div>
                ) : managerSignatureUrl ? (
                  <img
                    src={managerSignatureUrl}
                    alt="Manager signature"
                    className="h-20 w-full rounded-md border border-dashed border-border bg-surface object-contain p-1"
                  />
                ) : (
                  <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border bg-surface text-xs text-muted">
                    Not signed yet. Select a saved sign above or click &quot;Draw Signature&quot;.
                  </div>
                )}
              </div>

              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-muted">Date</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={managerDate}
                    onChange={(e) => setManagerDate(e.target.value)}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm font-medium text-ink"
                  />
                  <button
                    type="button"
                    onClick={saveManagerData}
                    disabled={savingManagerData}
                    className="rounded-md bg-navy-800 px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingManagerData ? "Saving…" : "Save"}
                  </button>
                </div>
                {managerDataMessage && (
                  <p className="mt-1 text-xs font-semibold text-teal-600">
                    {managerDataMessage}
                  </p>
                )}
              </div>

              <button
                onClick={handleCopySignLink}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border-2 border-navy-800 py-2 text-xs font-bold text-navy-800 hover:bg-navy-50"
              >
                <Share2 size={14} />{" "}
                {copied ? "Link Copied ✓" : "Copy Sign-off Link"}
              </button>
            </div>
          </div>

          {report.companyStamp && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border p-4">
              <img
                src={report.companyStamp}
                alt="Company stamp"
                className="h-16 w-16 rounded-md border border-border bg-white object-contain p-1"
              />
              <p className="text-xs font-semibold uppercase text-navy-800">
                Company Stamp on File
              </p>
            </div>
          )}

          <ReportMediaViewer media={report.media} onPreview={setPreviewImage} />

          {!report.managerSignature && (
            <p className="mt-3 text-center text-xs text-muted">
              Share the link above with the customer — they&apos;ll see only
              this report and their signature fills the &quot;Verified by
              Manager/Team&quot; box.
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
          <PDFPreviewModal
            report={previewReport}
            onClose={() => setPreviewReport(null)}
          />
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
        <div className="mb-3 rounded-md bg-surface px-3 py-2 text-sm font-semibold">
          {report.reportId}
        </div>

        <p className="text-xs font-semibold uppercase text-muted">
          Inspection Date
        </p>
        <p className="mb-3 font-bold">{report.dateOfService}</p>

        <p className="text-xs font-semibold uppercase text-muted">Location</p>
        <p className="mb-3 flex items-center gap-1 font-bold">
          <MapPin size={16} className="text-navy-700" /> {report.locationDoor}
        </p>

        <p className="text-xs font-semibold uppercase text-muted">
          Lead Technician
        </p>
        <p className="flex items-center gap-2 font-bold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-xs text-white">
            {(report.leadTechnician ?? "?").charAt(0)}
          </span>
          {report.leadTechnician}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-bold uppercase text-navy-800">
            Checklist Status Overview
          </h3>
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
                    <p className="text-xs text-muted">
                      {String(idx + 1).padStart(2, "0")}
                    </p>
                    <p className="font-bold text-ink">{s.label}</p>
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
                      <div
                        key={item.id ?? `item-${idx}-${itemIdx}`}
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
                        {(() => {
                          const p =
                            item.photos || (item.photo ? [item.photo] : []);
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

      <section className="rounded-xl border-l-4 border-navy-800 bg-navy-50 p-4 text-sm italic text-navy-800">
        {lastSectionWithRemark ? (
          <>“{lastSectionWithRemark.remark}”</>
        ) : (
          "No remarks recorded for this report."
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold uppercase text-navy-800">
          Engineer Sign-off
        </h3>
        <p className="mb-4 text-sm text-muted">
          Only the engineer signs here. The &quot;Verified by Manager/Team&quot;
          signature is collected later from the customer via a shareable link,
          after you finalize.
        </p>

        <div className="space-y-4">
          <SignaturePad
            label="Checked by Engineer"
            name={engineerName}
            onNameChange={setEngineerName}
            canvasRef={engineerCanvasRef}
            onClear={() => clearCanvas(engineerCanvasRef)}
            signatureDataUrl={
              selectedSignatureDataUrl ?? report.engineerSignature ?? null
            }
          />

          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold text-muted">
              Saved Signatures
            </p>
            <div className="flex flex-wrap gap-2">
              {savedEngineerSignatures.length === 0 ? (
                <div className="text-xs text-muted">
                  No saved signatures yet.
                </div>
              ) : (
                savedEngineerSignatures.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    {editingSignatureId === s.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editingSignatureName}
                          onChange={(e) =>
                            setEditingSignatureName(e.target.value)
                          }
                          className="rounded-md border border-border bg-white px-2 py-1 text-xs"
                        />
                        <button
                          onClick={async () => {
                            const next = savedEngineerSignatures.map((sig) =>
                              sig.id === s.id
                                ? { ...sig, name: editingSignatureName }
                                : sig,
                            );
                            try {
                              await saveEngineerSignatures(next);
                              setSavedEngineerSignatures(next);
                              setEditingSignatureId(null);
                            } catch (err) {
                              alert(
                                `Failed to update signature: ${err.message}`,
                              );
                            }
                          }}
                          className="rounded-md bg-teal-600 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSignatureId(null)}
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => selectEngineerSignature(s)}
                          className={`rounded-md border px-3 py-1 text-xs ${activeSignatureId === s.id ? "bg-navy-800 text-white" : "bg-surface text-ink"}`}
                        >
                          {s.name}
                        </button>
                        <button
                          onClick={() => {
                            setEditingSignatureId(s.id);
                            setEditingSignatureName(s.name);
                          }}
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove saved signature "${s.name}"?`))
                              return;
                            const next = savedEngineerSignatures.filter(
                              (sig) => sig.id !== s.id,
                            );
                            try {
                              await saveEngineerSignatures(next);
                              setSavedEngineerSignatures(next);
                              if (activeSignatureId === s.id) {
                                setActiveSignatureId(null);
                                setSelectedSignatureDataUrl(null);
                              }
                            } catch (err) {
                              alert(
                                `Failed to remove signature: ${err.message}`,
                              );
                            }
                          }}
                          className="rounded-md border px-2 py-1 text-xs text-danger-600"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={saveEngineerSign}
                disabled={savingEngineerSign}
                className="rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {savingEngineerSign ? "Saving…" : "Save Engineer Sign"}
              </button>
              {engineerSignMessage && (
                <p className="text-xs text-teal-600">{engineerSignMessage}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-ink">
              Digital COP (Company Stamp)
            </label>
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
                <p className="text-sm font-semibold text-navy-700">
                  {uploadingStamp ? "Uploading…" : "Attach Company Stamp"}
                </p>
                <p className="text-xs text-muted">
                  PNG or JPG with transparent background preferred
                </p>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleStampChange}
                  disabled={uploadingStamp}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <label className="mb-1 block text-sm font-semibold text-ink">
            Approval Date
          </label>
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
          After this, you can share a sign-off link with the customer so they
          can add their signature to the &quot;Verified by Manager/Team&quot;
          box.
        </p>
      </section>

      {previewReport && (
        <PDFPreviewModal
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
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
