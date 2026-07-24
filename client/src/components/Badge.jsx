import clsx from "clsx";

const VARIANT_CLS = {
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  danger:
    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  info:
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  neutral:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

/**
 * Status badge pill.
 * @param {{ variant?: keyof VARIANT_CLS; children: React.ReactNode; className?: string }} props
 */
export function Badge({ variant = "neutral", children, className }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        VARIANT_CLS[variant] || VARIANT_CLS.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}
