import { appendReportMedia } from "./reportsApi";

export function createReportMediaEntry(report, url, extra = {}) {
  const timestamp = new Date().toISOString();
  return {
    url,
    capturedAt: timestamp,
    date: timestamp.slice(0, 10),
    time: timestamp.slice(11, 19),
    reportId: report?.id,
    reportName: report?.templateName ?? "",
    ...extra,
  };
}

export async function recordReportMedia(report, url, extra = {}) {
  if (!report?.id) {
    throw new Error("Report must be loaded before saving media.");
  }
  const mediaEntry = createReportMediaEntry(report, url, extra);
  await appendReportMedia(report.id, mediaEntry);
  return mediaEntry;
}
