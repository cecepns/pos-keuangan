import { Inbox } from "lucide-react";

/**
 * Empty state for tables / lists.
 * @param {{ icon?: any; title?: string; message?: string; children?: React.ReactNode }} props
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = "Tidak ada data",
  message,
  children,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
        <Icon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
        {message && (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{message}</p>
        )}
      </div>
      {children}
    </div>
  );
}
