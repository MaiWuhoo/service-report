import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getScheduleEntry, listChecklistTemplates, getChecklistTemplate, updateScheduleEntry, getReport, listRecentReports, syncReportsFromSchedule } from "../lib/reportsApi";
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
      let allTemplates = [DEFAULT_TEMPLATE];
      try {
        const custom = await listChecklistTemplates();
        allTemplates = [DEFAULT_TEMPLATE, ...(custom || [])];
        setTemplates(allTemplates);
      } catch (err) {
        console.error("Error loading templates:", err);
      }

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

        let allRecentReports = [];
        try {
          allRecentReports = await listRecentReports(200);
        } catch {}

        const claimedReportIds = new Set();
        const enhanced = [];

        for (const sel of normalized) {
          const s = { ...sel };
          let report = null;
          const template = allTemplates.find((t) => t.id === s.templateId);

          // 1. Check existing s.reportId if not already claimed by another selection
          if (s.reportId && !claimedReportIds.has(s.reportId)) {
            try {
              const r = await getReport(s.reportId);
              if (r) {
                // Verify the report actually matches this template
                const templateMatches =
                  (!r.templateId && !s.templateId) ||
                  (r.templateId && s.templateId && r.templateId === s.templateId) ||
                  (r.templateName && template?.name && r.templateName.toLowerCase() === template.name.toLowerCase());

                if (templateMatches) {
                  report = r;
                  claimedReportIds.add(report.id);
                }
              }
            } catch (err) {
              console.error("Error fetching report", err);
            }
          }

          // 2. If no valid report linked yet, search for an UNCLAIMED report in allRecentReports
          if (!report) {
            const selLoc = (s.location ?? "").trim().toLowerCase();
            report = allRecentReports.find((r) => {
              if (claimedReportIds.has(r.id)) return false;

              const matchesSchedule = r.scheduleId === e.id || r.scheduleId === id;
              if (!matchesSchedule) return false;

              // CRITICAL: Must match this template
              const templateMatches =
                (r.templateId && s.templateId && r.templateId === s.templateId) ||
                (r.templateName && template?.name && r.templateName.toLowerCase() === template.name.toLowerCase());
              if (!templateMatches) return false;

              const rLoc = (r.locationDoor ?? "").trim().toLowerCase();
              if (selLoc && rLoc) {
                return rLoc === selLoc;
              }
              return true;
            });

            if (report) {
              claimedReportIds.add(report.id);
            }
          }

          if (report) {
            s.reportId = report.id;
            s.reportExists = true;
            s.status = report.status === "draft" ? "in_progress" : report.status;
            s.engineerSignature = report.engineerSignature ?? null;
            s.managerSignature = report.managerSignature ?? null;
            s.engineerName = report.engineerName ?? null;
            s.reviewedBy = report.reviewedBy ?? null;
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
            s.engineerSignature = null;
            s.managerSignature = null;
            s.engineerName = null;
            s.reviewedBy = null;
            s.timestamp = null;
          }

          enhanced.push(s);
        }

        const allVerified = enhanced.length > 0 && enhanced.every((s) => s.status === "verified");
        const anyInProgress = enhanced.some((s) => s.status === "verified" || s.status === "in_progress");
        const computedScheduleStatus = allVerified ? "verified" : anyInProgress ? "in_progress" : "upcoming";

        const needsUpdate =
          e.status !== computedScheduleStatus ||
          JSON.stringify(e.templateSelections) !==
            JSON.stringify(enhanced.map(({ timestamp, reportExists, ...rest }) => rest));
        
        if (needsUpdate) {
          const toSave = enhanced.map(({ timestamp, reportExists, ...rest }) => rest);
          await updateScheduleEntry(e.id, {
            templateSelections: toSave,
            status: computedScheduleStatus,
          });
        }

        // Keep reports synchronized with the schedule's technician and location
        await syncReportsFromSchedule({ ...e, templateSelections: enhanced });

        setEntry({ ...e, status: computedScheduleStatus, templateSelections: enhanced });
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
      let template = templates.find((t) => t.id === sel.templateId);
      if (!template && sel.templateId && sel.templateId !== DEFAULT_TEMPLATE.id) {
        try {
          template = await getChecklistTemplate(sel.templateId);
        } catch {}
      }
      if (!template) {
        template = DEFAULT_TEMPLATE;
      }
      const newId = await createReportFromTemplate(template, {
        locationDoor: sel.location?.trim() || entry.location?.trim() || "-",
        leadTechnician: entry.assignedTechnician?.trim() || "Unassigned",
        customerId: entry.customerId || undefined,
        dateOfService: entry.startDate,
        scheduleId: entry.id,
      });
      if (entry.templateSelections && entry.templateSelections.length > 0) {
        const updated = entry.templateSelections.map((s) => {
          if (s.id && s.id === sel.id) {
            return { ...s, reportId: newId, status: "in_progress", reportExists: true };
          }
          if (!s.id && s.templateId === sel.templateId && s.location === sel.location) {
            return { ...s, reportId: newId, status: "in_progress", reportExists: true };
          }
          return s;
        });
        const toSave = updated.map(({ timestamp, reportExists, ...rest }) => rest);
        await updateScheduleEntry(entry.id, { templateSelections: toSave, status: "in_progress" });
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
                      <p className="font-bold text-sm">
                        {sel.location?.trim() || entry.location?.trim() || (items.length > 1 ? `Form #${idx + 1}` : "Standard Form")}
                      </p>
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
