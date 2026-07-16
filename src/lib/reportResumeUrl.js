/**
 * Given a report, decides where clicking it should go:
 * - verified  -> read-only Review & Sign-off (history view)
 * - otherwise -> resume the checklist at the first section that still has
 *                unanswered items (or the last section if everything is filled)
 */
export function reportResumeUrl(report) {
  if (!report) return "/";
  if (report.status === "verified") return `/review/${report.id}`;

  const resumeStep = report.sections?.findIndex((s) => s.items?.some((it) => !it.answer));
  const lastIndex = (report.sections?.length ?? 1) - 1;
  const step = resumeStep >= 0 ? resumeStep : lastIndex;
  return `/checklist/${report.id}/${step}`;
}
