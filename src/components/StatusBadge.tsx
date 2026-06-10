import type { ParcelStatus } from "../api/types";
import { statusBadgeClass, statusLabel } from "../labels";

export function StatusBadge({ status }: { status: ParcelStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass[status]}`}>
      {statusLabel[status]}
    </span>
  );
}
