import type { SortDir } from "../hooks/useSort";

interface SortableThProps {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}

// Table header cell that sorts its column when clicked (keyboard accessible).
function SortableTh({ label, active, dir, onClick }: SortableThProps) {
  return (
    <th aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={`sort-btn ${active ? "active" : ""}`} onClick={onClick}>
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default SortableTh;
