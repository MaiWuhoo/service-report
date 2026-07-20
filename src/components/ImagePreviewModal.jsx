export default function ImagePreviewModal({ src, alt, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative max-h-full w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full border border-border bg-white px-3 py-1 text-sm font-semibold text-ink shadow-sm hover:bg-surface"
        >
          Close
        </button>
        <div className="flex h-full items-center justify-center bg-black/90 p-4">
          <img
            src={src}
            alt={alt}
            className="max-h-[80vh] w-full max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
