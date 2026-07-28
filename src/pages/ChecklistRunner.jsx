import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Camera, X, Upload } from "lucide-react";
import YesNoToggle from "../components/YesNoToggle";
import CameraCapture from "../components/CameraCapture";
import ImagePreviewModal from "../components/ImagePreviewModal";
import { getReport, updateReport, getScheduleEntry, updateScheduleEntry, subscribeToReport, updateReportSection } from "../lib/reportsApi";
import { readImageFileCompressed } from "../lib/fileUtils";

export default function ChecklistRunner() {
  const { id, step } = useParams();
  const navigate = useNavigate();
  const stepIndex = Number(step) || 0;

  const [report, setReport] = useState(null);
  const [items, setItems] = useState([]);
  const [remark, setRemark] = useState("");
  const [dateOfService, setDateOfService] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeCameraItemId, setActiveCameraItemId] = useState(null);
  const [currentLoadedStep, setCurrentLoadedStep] = useState(-1);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToReport(id, (r) => {
      setReport(r);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!report) return;
    if (currentLoadedStep !== stepIndex) {
      setItems(report.sections?.[stepIndex]?.items ?? []);
      setRemark(report.additionalRemark ?? "");
      setDateOfService(report.dateOfService ?? "");
      setCurrentLoadedStep(stepIndex);
    }
  }, [report, stepIndex, currentLoadedStep]);

  function updateItem(itemId, patch) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
  }

  async function handleFile(itemId, file) {
    if (!file) return;
    try {
      const compressed = await readImageFileCompressed(file);
      setItems((prev) => prev.map((it) => {
        if (it.id === itemId) {
          const currentPhotos = it.photos || (it.photo ? [it.photo] : []);
          if (currentPhotos.length >= 3) {
            alert("Maximum 3 photos allowed.");
            return it;
          }
          const nextPhotos = [...currentPhotos, compressed];
          return { ...it, photos: nextPhotos, photo: nextPhotos[0] || null };
        }
        return it;
      }));
    } catch (err) {
      alert(`Gagal muat naik gambar: ${err.message}`);
    }
  }

  function removePhoto(itemId, index) {
    setItems((prev) => prev.map((it) => {
      if (it.id === itemId) {
        const currentPhotos = it.photos || (it.photo ? [it.photo] : []);
        const nextPhotos = currentPhotos.filter((_, i) => i !== index);
        return { ...it, photos: nextPhotos, photo: nextPhotos[0] || null };
      }
      return it;
    }));
  }

  function handlePhotoChange(itemId, e) {
    const file = e.target.files?.[0];
    if (file) handleFile(itemId, file);
    if (e.target) e.target.value = "";
  }

  const totalSteps = report?.sections?.length ?? 0;
  const isLastStep = stepIndex === totalSteps - 1;
  const currentSection = report?.sections?.[stepIndex];

  const hasUnsavedChanges = useMemo(() => {
    if (!report) return false;
    const dbItems = report.sections?.[stepIndex]?.items ?? [];
    if (JSON.stringify(items) !== JSON.stringify(dbItems)) return true;
    if (isLastStep && remark !== (report.additionalRemark ?? "")) return true;
    if (dateOfService !== (report.dateOfService ?? "")) return true;
    return false;
  }, [report, items, remark, dateOfService, stepIndex, isLastStep]);

  async function persist(nextStatus) {
    if (!id || !report) return null;
    setSaving(true);
    try {
      const payload = {
        status: nextStatus ?? report.status ?? "draft",
        dateOfService: dateOfService || report.dateOfService,
      };
      if (isLastStep) payload.additionalRemark = remark;
      
      const nextData = await updateReportSection(id, stepIndex, items, payload);

      // Propagate status into schedule entry templateSelections so UI shows instance status.
      try {
        const scheduleId = report?.scheduleId;
        if (scheduleId) {
          const entry = await getScheduleEntry(scheduleId);
          if (entry && Array.isArray(entry.templateSelections)) {
            const updated = entry.templateSelections.map((s) =>
              s.reportId === id || s.reportId === report.reportId ? { ...s, status: payload.status } : s,
            );
            const allVerified = updated.every((s) => s.status === "verified");
            await updateScheduleEntry(scheduleId, {
              templateSelections: updated,
              status: allVerified ? "verified" : updated.some((s) => s.status) ? "in_progress" : entry.status,
            });
          }
        }
      } catch (err) {
        console.error("Failed to propagate report status to schedule:", err);
      }
      return nextData.sections;
    } catch (err) {
      console.error("Failed to save checklist:", err);
      alert(`Gagal simpan checklist: ${err.message}`);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    if (hasUnsavedChanges) {
      const saved = await persist("in_review");
      if (!saved) return;
    }
    if (isLastStep) {
      navigate(`/review/${id}`);
    } else {
      navigate(`/checklist/${id}/${stepIndex + 1}`);
    }
  }

  async function handleBack() {
    if (hasUnsavedChanges) {
      const saved = await persist("in_progress");
      if (!saved) return;
    }
    if (stepIndex > 0) {
      navigate(`/checklist/${id}/${stepIndex - 1}`);
    }
  }

  if (!report || !currentSection) {
    return <p className="py-10 text-center text-muted">Loading checklist…</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          {report.serviceProvider?.logo && (
            <img
              src={report.serviceProvider.logo}
              alt="Service provider logo"
              className="h-10 w-10 shrink-0 rounded object-contain"
            />
          )}
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Service Provider</p>
            <p className="font-bold text-ink">{report.serviceProvider?.name ?? "-"}</p>
            <p className="text-sm text-muted">{report.serviceProvider?.address ?? ""}</p>
          </div>
        </div>

        <div className="my-3 border-t border-border" />

        <div className="flex items-start gap-3">
          {report.customer?.logo && (
            <img
              src={report.customer.logo}
              alt="Customer logo"
              className="h-10 w-10 shrink-0 rounded object-contain"
            />
          )}
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Customer</p>
            <p className="font-bold text-ink">{report.customer?.name ?? "-"}</p>
            <p className="text-sm text-muted">{report.customer?.address ?? ""}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-surface p-3 text-sm">
          <div>
            <label className="text-xs text-muted" htmlFor="date-of-service">
              Date of Service
            </label>
            <input
              id="date-of-service"
              type="date"
              value={dateOfService}
              onChange={(e) => setDateOfService(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <p className="text-xs text-muted">Location Door</p>
            <p className="font-semibold">{report.locationDoor ?? "-"}</p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-lg bg-navy-800 px-4 py-3 text-white">
        <span className="text-sm font-extrabold uppercase tracking-wide">{currentSection.sectionName}</span>
        <span className="text-xs font-semibold opacity-80">
          Step {stepIndex + 1} of {totalSteps}
        </span>
      </div>

      {items.map((item, idx) => (
        <section key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-navy-800">
              {idx + 1}
            </span>
            <p className="font-semibold text-ink">{item.question}</p>
          </div>
          <YesNoToggle value={item.answer} onChange={(v) => updateItem(item.id, { answer: v })} />
          <input
            value={item.remark}
            onChange={(e) => updateItem(item.id, { remark: e.target.value })}
            placeholder="Add remark..."
            className="mt-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />

          {(() => {
            const currentPhotos = item.photos || (item.photo ? [item.photo] : []);
            return (
              <>
                {currentPhotos.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {currentPhotos.map((p, pIdx) => (
                      <div key={pIdx} className="flex flex-col items-center gap-1">
                        <img
                          src={p}
                          alt={`Attached evidence ${pIdx + 1}`}
                          onClick={() => setPreviewImage(p)}
                          className="h-20 w-20 rounded-md border border-border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        />
                        <button
                          onClick={() => removePhoto(item.id, pIdx)}
                          className="flex items-center gap-1 rounded-md border border-danger-600 px-2 py-1 text-[10px] font-semibold text-danger-600 hover:bg-danger-100"
                        >
                          <X size={12} /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {currentPhotos.length < 3 && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setActiveCameraItemId(item.id)}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-2.5 text-sm font-semibold text-navy-700 hover:bg-surface"
                    >
                      <Camera size={16} /> Camera
                    </button>
                    <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-2.5 text-sm font-semibold text-navy-700 hover:bg-surface">
                      <Upload size={16} /> Gallery
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoChange(item.id, e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      ))}

      {isLastStep && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-2 font-semibold text-ink">Additional Remark:</p>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Enter any general observations..."
            rows={3}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </section>
      )}

      <button
        onClick={() => persist(report.status)}
        disabled={saving || !hasUnsavedChanges}
        className="w-full rounded-md bg-navy-800 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : (hasUnsavedChanges ? "Save Progress" : "No Changes to Save")}
      </button>
      <div className="flex gap-3">
        {stepIndex > 0 && (
          <button
            onClick={handleBack}
            disabled={saving}
            className="flex-1 rounded-md border-2 border-border py-3 text-sm font-bold uppercase tracking-wide text-navy-800 hover:bg-surface disabled:opacity-60"
          >
            Previous: {report.sections[stepIndex - 1]?.sectionName}
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex-1 rounded-md border-2 border-navy-800 py-3 text-sm font-bold uppercase tracking-wide text-navy-800 hover:bg-navy-50 disabled:opacity-60"
        >
          {isLastStep ? "Next: Review & Sign-off" : `Next: ${report.sections[stepIndex + 1]?.sectionName}`}
        </button>
      </div>

      <div className="fixed bottom-20 right-4 rounded-full bg-danger-600 p-3 text-white shadow-lg md:bottom-6">
        <AlertTriangle size={20} />
      </div>

      {activeCameraItemId && (
        <CameraCapture
          onCapture={(file) => {
            handleFile(activeCameraItemId, file);
            setActiveCameraItemId(null);
          }}
          onCancel={() => setActiveCameraItemId(null)}
        />
      )}

      {previewImage && (
        <ImagePreviewModal
          src={previewImage}
          alt="Preview"
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
