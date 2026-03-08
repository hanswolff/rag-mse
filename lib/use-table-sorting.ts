import { useCallback, useState } from "react";

export type TableSortDirection = "asc" | "desc";

export function useTableSorting<TField extends string>(
  initialField: TField,
  initialDirection: TableSortDirection,
  defaultDirections: Partial<Record<TField, TableSortDirection>> = {},
) {
  const [sortBy, setSortBy] = useState<TField>(initialField);
  const [sortDir, setSortDir] = useState<TableSortDirection>(initialDirection);

  const handleSortChange = useCallback((field: TField) => {
    if (sortBy === field) {
      setSortDir((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(field);
    setSortDir(defaultDirections[field] || "asc");
  }, [defaultDirections, sortBy]);

  return {
    sortBy,
    sortDir,
    handleSortChange,
  };
}
