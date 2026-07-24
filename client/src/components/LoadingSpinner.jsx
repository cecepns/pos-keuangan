import clsx from "clsx";

/**
 * Bouncing dots loader — replaces skeleton.
 * @param {{ size?: "sm" | "md" | "lg"; className?: string; label?: string }} props
 */
export function LoadingSpinner({ size = "md", className, label }) {
  const dotSize = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-3 w-3",
  }[size];

  return (
    <div className={clsx("flex flex-col items-center justify-center gap-3 py-12", className)}>
      <div className="loader-dots">
        <span className={dotSize} />
        <span className={dotSize} />
        <span className={dotSize} />
      </div>
      {label && <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>}
    </div>
  );
}

/**
 * Inline loader for smaller areas (inside cards, selects etc.)
 */
export function InlineSpinner({ className }) {
  return (
    <div className={clsx("flex items-center justify-center py-4", className)}>
      <div className="loader-dots">
        <span className="h-1.5 w-1.5" />
        <span className="h-1.5 w-1.5" />
        <span className="h-1.5 w-1.5" />
      </div>
    </div>
  );
}
