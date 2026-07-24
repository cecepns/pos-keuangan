import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

export function ConfirmDialog({ open, title, message, confirmText = "Ya", cancelText = "Batal", danger, onConfirm, onClose }) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="flex items-start gap-3">
        {danger && (
          <div className="shrink-0 rounded-xl bg-red-50 p-2.5 dark:bg-red-950/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
        )}
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
