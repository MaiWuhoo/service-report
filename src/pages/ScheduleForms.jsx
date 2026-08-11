import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getScheduleEntry, listChecklistTemplates, updateScheduleEntry, getReport } from "../lib/reportsApi";
import StatusBadge from "../components/StatusBadge";
import { createReportFromTemplate } from "../lib/createReportFromTemplate";
import { DEFAULT_TEMPLATE } from "../lib/defaultTemplates";

export default function ScheduleForms() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [templates, setTemplates] = useState([DEFAULT_TEMPLATE]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setTemplates([DEFAULT_TEMPLATE, ...(await listChecklistTemplates())]);
      } catch {}
      try {
        const e = await getScheduleEntry(id);
        if (!e) {
          setEntry(null);
          setLoading(false);
          return;
        }

        const rawSelections = e.templateSelections ?? (e.templateIds
          ? e.templateIds.map((tid, i) => ({ templateId: tid, location: e.location, id: `${e.id}-${i}` }))
          : e.templateId
          ? [{ templateId: e.templateId, location: e.location, id: `${e.id}-0` }]
          : []);

        const normalized = rawSelections.map((sel, idx) => ({
          id: sel.id ?? `${e.id}-${sel.templateId}-${idx}`,
          ...sel,
        }));

        const enhanced = await Promise.all(
          normalized.map(async (sel) => {
            const s = { ...sel };
            if (s.reportId) {
              try {
                const report = await getReport(s.reportId);
                if (report) {
                  s.reportExists = true;
                  s.status = report.status === "draft" ? "in_progress" : report.status;
                  const ts = report.updatedAt || report.createdAt;
                  if (ts && ts.toDate) {
                    s.timestamp = ts.toDate().toLocaleString("en-GB", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                    });
                  } else if (ts) {
                    s.timestamp = new Date(ts).toLocaleString("en-GB", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                    });
                  }
                } else {
                  s.reportExists = false;
                  s.reportId = null;
                  s.status = "upcoming";
                }
              } catch (err) {
                console.error("Error fetching report", err);
              }
            } else {
              s.status = "upcoming";
            }
            return s;
          })
        );

        const needsUpdate = JSON.stringify(e.templateSelections) !== JSON.stringify(enhanced.map(({ timestamp, reportExists, ...rest }) => rest));
        
        if (needsUpdate) {
          const toSave = enhanced.map(({ timestamp, reportExists, ...rest }) => rest);
          await updateScheduleEntry(e.id, { templateSelections: toSave });
        }

        setEntry({ ...e, templateSelections: enhanced });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <p className="py-10 text-center text-muted">Loading…</p>;
  if (!entry) return <p className="py-10 text-center text-muted">Schedule not found.</p>;

  const selections = entry.templateSelections || [];

  // Group selections by templateId
  const grouped = selections.reduce((acc, sel) => {
    acc[sel.templateId] = acc[sel.templateId] || [];
    acc[sel.templateId].push(sel);
    return acc;
  }, {});

  async function openInstance(sel) {
    if (sel.reportId && sel.reportExists !== false) {
      navigate(`/checklist/${sel.reportId}/0`);
      return;
    }
    
    setCreatingId(sel.id);
    try {
      const template = templates.find((t) => t.id === sel.templateId) ?? DEFAULT_TEMPLATE;
      const newId = await createReportFromTemplate(template, {
        locationDoor: sel.location ?? entry.location,
        leadTechnician: entry.assignedTechnician,
        customerId: entry.customerId || undefined,
        dateOfService: entry.startDate,
        scheduleId: entry.id,
      });
      if (entry.templateSelections && entry.templateSelections.length > 0) {
        const updated = entry.templateSelections.map((s) => {
          if (s.id && s.id === sel.id) {
            return { ...s, reportId: newId, status: "in_progress" };
          }
          if (!s.id && s.templateId === sel.templateId && s.location === sel.location) {
            return { ...s, reportId: newId, status: "in_progress" };
          }
          return s;
        });
        await updateScheduleEntry(entry.id, { templateSelections: updated, status: "in_progress" });
        setEntry((prev) => ({ ...prev, templateSelections: updated, reportId: prev?.reportId }));
      } else {
        // legacy single-report schedule
        await updateScheduleEntry(entry.id, { reportId: newId, status: "in_progress" });
        setEntry((prev) => ({ ...prev, reportId: newId }));
      }
      navigate(`/checklist/${newId}/0`);
    } catch (err) {
      console.error(err);
      alert(`Gagal buka form: ${err.message}`);
    } finally {
      setCreatingId(null);
    }
  }

  if (selections.length === 0) {
    // fallback: no selections — go back
    navigate(`/`);
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold">Select Form</h2>
      <p className="text-sm text-muted">Choose which checklist/form to open for this schedule.</p>
      <div className="space-y-3">
        {Object.entries(grouped).map(([templateId, items]) => {
          const template = templates.find((t) => t.id === templateId) ?? { id: templateId, name: templateId };
          return (
            <div key={templateId} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-bold">{template.name}</p>
                  <p className="text-xs text-muted">Checklist: {template.name}</p>
                </div>
              </div>

              <div className="space-y-2">
                {items.map((sel, idx) => (
                  <div key={sel.id} className="rounded-md bg-white p-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{sel.location ?? entry.location ?? "-"}</p>
                      {sel.timestamp && ["in_progress", "verified", "in_review"].includes(sel.status) ? (
                        <p className="text-xs text-muted">{sel.timestamp}</p>
                      ) : (
                        <p className="text-xs text-muted">&nbsp;</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <div className="flex flex-col gap-2 sm:gap-3">
                        <StatusBadge status={sel.status ?? "upcoming"} />
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${sel.engineerSignature ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                            Tech: {sel.engineerSignature ? "Signed ✓" : "Pending"}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${sel.managerSignature ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                            Customer: {sel.managerSignature ? "Signed ✓" : "Pending"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => openInstance(sel)}
                        disabled={creatingId === sel.id}
                        className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {creatingId === sel.id ? "Opening…" : (sel.reportId && sel.reportExists !== false ? "Continue" : "Open form")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
