import clsx from "clsx";

const VARIANT_CLS = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
  ghost:
    "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  "ghost-danger":
    "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30",
  "ghost-brand":
    "text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/30",
};

const SIZE_CLS = {
  xs: "rounded-lg px-2 py-1 text-xs font-medium",
  sm: "rounded-xl px-3 py-1.5 text-sm font-medium",
  md: "rounded-xl px-4 py-2.5 text-sm font-semibold",
  lg: "rounded-2xl px-5 py-3 text-sm font-semibold",
  icon: "rounded-lg p-2",
};

/**
 * Consistent button across the whole app.
 * @param {{ variant?: string; size?: string; className?: string; children: React.ReactNode; [key: string]: any }} props
 */
export function ActionButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLS[variant] || VARIANT_CLS.primary,
        SIZE_CLS[size] || SIZE_CLS.md,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
