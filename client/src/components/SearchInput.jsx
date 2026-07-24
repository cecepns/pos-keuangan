import { Search } from "lucide-react";
import clsx from "clsx";

/**
 * Consistent search input with icon.
 * @param {{ value: string; onChange: (v: string) => void; placeholder?: string; className?: string; onClear?: () => void }} props
 */
export function SearchInput({ value, onChange, placeholder = "Cari...", className }) {
  return (
    <div className={clsx("relative w-full max-w-sm", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <input
        type="text"
        className="input-base w-full pl-10"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
