import { TableSortDirection } from "@/lib/use-table-sorting";

function getIndicator(isActive: boolean, sortDir: TableSortDirection): string {
  if (!isActive) {
    return "↕";
  }
  return sortDir === "asc" ? "↑" : "↓";
}

type SortableTableHeaderProps<TField extends string> = {
  label: string;
  field: TField;
  activeField: TField;
  sortDir: TableSortDirection;
  onSortChange: (field: TField) => void;
  className?: string;
};

export function SortableTableHeader<TField extends string>({
  label,
  field,
  activeField,
  sortDir,
  onSortChange,
  className,
}: SortableTableHeaderProps<TField>) {
  const isActive = activeField === field;
  const ariaSort = isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th scope="col" className={className} aria-sort={ariaSort}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-gray-900"
        onClick={() => onSortChange(field)}
      >
        {label}
        <span className="text-xs text-gray-500" aria-hidden="true">{getIndicator(isActive, sortDir)}</span>
      </button>
    </th>
  );
}
