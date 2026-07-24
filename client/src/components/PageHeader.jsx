/**
 * Consistent page header used across all admin pages.
 * @param {{ title: string; subtitle?: string; children?: React.ReactNode }} props
 */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
