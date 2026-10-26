import { appendReportMedia } from "./reportsApi";

/** Firestore's arrayUnion() rejects any object containing an `undefined`
 *  field value outright (throws, not just skips that field) — so strip
 *  them out before the entry ever reaches Firestore. */
function stripUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
}

export function createReportMediaEntry(report, url, extra = {}) {
  const timestamp = new Date().toISOString();
  return stripUndefined({
    url,
    capturedAt: timestamp,
    date: timestamp.slice(0, 10),
    time: timestamp.slice(11, 19),
    reportId: report?.id,
    reportName: report?.templateName ?? "",
    ...extra,
  });
}

export async function recordReportMedia(report, url, extra = {}) {
  if (!report?.id) {
    throw new Error("Report must be loaded before saving media.");
  }
  const mediaEntry = createReportMediaEntry(report, url, extra);
  await appendReportMedia(report.id, mediaEntry);
  return mediaEntry;
}
