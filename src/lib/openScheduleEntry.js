import { getReport, updateScheduleEntry } from "./reportsApi";
import { createReportFromTemplate } from "./createReportFromTemplate";
import { reportResumeUrl } from "./reportResumeUrl";
import { DEFAULT_TEMPLATE } from "./defaultTemplates";

/**
 * Given a maintenance schedule entry, returns the URL the app should
 * navigate to: resumes the linked report if one already exists, otherwise
 * creates a fresh report from the entry's template and links it back.
 */
export async function resolveScheduleEntryUrl(entry, templates = [DEFAULT_TEMPLATE]) {
  if (entry.reportId) {
    const existing = await getReport(entry.reportId);
    if (existing) return reportResumeUrl(existing);
  }

  // If the schedule entry defines multiple template selections, return
  // the route that shows the list so the user can pick the desired form.
  if (entry.templateSelections && entry.templateSelections.length > 0) {
    return `/schedule/${entry.id}/open`;
  }

  const templateId = entry.templateIds?.[0] ?? entry.templateId;
  const template = templates.find((t) => t.id === templateId) ?? DEFAULT_TEMPLATE;
  const newId = await createReportFromTemplate(template, {
    locationDoor: entry.location,
    leadTechnician: entry.assignedTechnician,
    customerId: entry.customerId || undefined,
    dateOfService: entry.startDate,
    scheduleId: entry.id,
  });
  await updateScheduleEntry(entry.id, { reportId: newId, status: "in_progress" });
  return `/checklist/${newId}/0`;
}
