import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

// Click-to-sort for tables. `getValue` maps a row + column key to a sortable value.
// Clicking the active column flips direction; a new column starts descending for numbers
// (biggest first is what you usually want on a monitoring table) and ascending for text.
export function useSort<T, K extends string>(
  rows: T[] | null,
  getValue: (row: T, key: K) => string | number,
  initial: { key: NoInfer<K>; dir: SortDir }, // NoInfer: K comes from getValue's key type
) {
  const [sort, setSort] = useState(initial);

  const sorted = useMemo(() => {
    if (!rows) return null;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = getValue(a, sort.key);
      const vb = getValue(b, sort.key);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return cmp * factor;
    });
  }, [rows, sort, getValue]);

  const toggle = (key: K, sample?: string | number) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: typeof sample === "number" ? "desc" : "asc" },
    );
  };

  return { sorted, sort, toggle };
}
