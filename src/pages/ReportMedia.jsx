import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getReport, subscribeToReport } from "../lib/reportsApi";
import ReportMediaViewer from "../components/ReportMediaViewer";
import ImagePreviewModal from "../components/ImagePreviewModal";

export default function ReportMedia() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeToReport(id, (r) => {
      setReport(r);
    });
    return () => unsub();
  }, [id]);

  if (!report) {
    return <p className="py-10 text-center text-muted">Loading media…</p>;
  }

  const itemPhotos = (report.sections ?? []).flatMap((section) =>
    (section.items ?? []).flatMap((item) => {
      const photos = item.photos || (item.photo ? [item.photo] : []);
      return photos.map((url) => ({
        url,
        reportId: report.id,
        reportName: report.templateName ?? "",
        sectionId: section.id,
        sectionName: section.sectionName,
        itemId: item.id,
        date: report.dateOfService,
        time: item.photoCapturedAt ? item.photoCapturedAt.slice(11, 19) : "",
      }));
    }),
  );

  const mediaItems = [
    ...(Array.isArray(report.media) ? report.media : []),
    ...itemPhotos,
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">Report Media</h2>
          <p className="text-sm text-muted">
            Photos captured for {report.templateName || "this report"} on {report.dateOfService}.
          </p>
        </div>
        <button
          onClick={() => navigate(`/review/${id}`)}
          className="rounded-md bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
        >
          Back to Report
        </button>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Report ID</p>
            <p className="font-bold text-ink">{report.reportId}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Inspection Date</p>
            <p className="font-bold text-ink">{report.dateOfService}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Location</p>
            <p className="font-bold text-ink">{report.locationDoor}</p>
          </div>
        </div>
      </section>

      <ReportMediaViewer media={mediaItems} onPreview={setPreviewImage} />

      {!mediaItems.length && (
        <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted">
          No media has been captured for this report yet.
        </div>
      )}

      {previewImage && (
        <ImagePreviewModal
          src={previewImage}
          alt="Report media preview"
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
