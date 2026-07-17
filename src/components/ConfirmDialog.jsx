import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              danger ? "bg-danger-100 text-danger-600" : "bg-navy-50 text-navy-700"
            }`}
          >
            <AlertTriangle size={20} />
          </span>
          <div>
            <p className="font-bold text-ink">{title}</p>
            {message && <p className="mt-1 text-sm text-muted">{message}</p>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-border py-2.5 text-sm font-bold text-ink hover:bg-surface"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md py-2.5 text-sm font-bold text-white ${
              danger ? "bg-danger-600 hover:bg-danger-700" : "bg-navy-800 hover:bg-navy-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
