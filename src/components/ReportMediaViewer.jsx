import ImagePreviewModal from "./ImagePreviewModal";

export default function ReportMediaViewer({ media = [], onPreview }) {
  if (!Array.isArray(media) || media.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-bold uppercase text-navy-800">Captured Media</h3>
        <p className="text-xs text-muted">Photos saved with this report, including capture date and report context.</p>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {media.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-border bg-surface p-3 shadow-sm">
            <button
              type="button"
              onClick={() => onPreview(item.url)}
              className="group block w-full overflow-hidden rounded-lg border border-border bg-white shadow-sm transition hover:border-navy-700"
            >
              <img
                src={item.url}
                alt={`Captured media ${idx + 1}`}
                className="h-40 w-full object-cover"
              />
            </button>
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-semibold text-navy-800">{item.sectionName || `Item ${item.itemId || idx + 1}`}</p>
              {item.reportName && (
                <p className="text-xs text-muted">Report: {item.reportName}</p>
              )}
              <p className="text-xs text-muted">
                {item.date} {item.time}
              </p>
              {item.itemId && (
                <p className="text-xs text-muted">Item ID: {item.itemId}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
