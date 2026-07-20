import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getScheduleEntry, listChecklistTemplates, updateScheduleEntry } from "../lib/reportsApi";
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
        if (e?.templateSelections?.some((sel) => !sel.id)) {
          const normalized = e.templateSelections.map((sel, idx) => ({
            id: sel.id ?? `${e.id}-${sel.templateId}-${idx}`,
            ...sel,
          }));
          await updateScheduleEntry(e.id, { templateSelections: normalized });
          setEntry({ ...e, templateSelections: normalized });
        } else {
          setEntry(e);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <p className="py-10 text-center text-muted">Loading…</p>;
  if (!entry) return <p className="py-10 text-center text-muted">Schedule not found.</p>;

  const rawSelections =
    entry.templateSelections ??
    (entry.templateIds
      ? entry.templateIds.map((tid, i) => ({ templateId: tid, location: entry.location, id: `${entry.id}-${i}` }))
      : entry.templateId
      ? [{ templateId: entry.templateId, location: entry.location, id: `${entry.id}-0` }]
      : []);

  const selections = rawSelections.map((s, i) => ({ id: s.id ?? `${entry.id}-${i}`, ...s }));

  // Group selections by templateId
  const grouped = selections.reduce((acc, sel) => {
    acc[sel.templateId] = acc[sel.templateId] || [];
    acc[sel.templateId].push(sel);
    return acc;
  }, {});

  async function openInstance(sel) {
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
                      <p className="text-xs text-muted">&nbsp;</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <StatusBadge status={sel.status ?? (sel.reportId ? "in_progress" : "upcoming")} />
                      <button
                        onClick={() => openInstance(sel)}
                        disabled={creatingId === sel.id}
                        className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {creatingId === sel.id ? "Opening…" : "Open form"}
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
