import { X } from "lucide-react";

export function Modal({ open, title, children, onClose, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 !mt-0 animate-fade-in">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Tutup"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl animate-slide-up dark:bg-slate-900 sm:rounded-2xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
