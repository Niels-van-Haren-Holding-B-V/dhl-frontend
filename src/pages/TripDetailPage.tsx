import { Link, useParams } from "react-router-dom";
import { CourierLayout } from "../components/CourierLayout";
import { QueryGate } from "../components/QueryGate";
import { useTrips } from "../queries/trips";
import { formatTripDate, locationTypeLabel } from "../labels";
import type { StopView } from "../api/types";

export function TripDetailPage() {
  const { tripId } = useParams();
  const { data: trips, isPending, error } = useTrips();
  const trip = trips?.find((t) => t.id === tripId);

  return (
    <CourierLayout title={trip?.name ?? "Rit"} backTo="/">
      <QueryGate isPending={isPending} error={error}>
        {!trip ? (
          <p className="py-12 text-center text-neutral-500">Rit niet gevonden</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-neutral-600">{formatTripDate(trip.tripDate)}</p>
            <ol className="flex flex-col gap-3">
              {[...trip.stops]
                .sort((a, b) => a.seq - b.seq)
                .map((stop) => (
                  <li key={stop.id}>
                    <StopCard tripId={trip.id} stop={stop} />
                  </li>
                ))}
            </ol>
          </>
        )}
      </QueryGate>
    </CourierLayout>
  );
}

function StopCard({ tripId, stop }: { tripId: string; stop: StopView }) {
  const isLocker = stop.deliveryLocationType === "LOCKER";

  return (
    <Link
      to={`/trips/${tripId}/stops/${stop.id}`}
      className="block rounded-2xl bg-white p-4 shadow active:bg-neutral-50"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dhl-yellow text-sm font-bold">
          {stop.seq}
        </span>
        <div className="min-w-0 grow">
          <p className="font-semibold">{stop.address}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-600">
            {isLocker && <LockerIcon />}
            {locationTypeLabel[stop.deliveryLocationType]} · {stop.parcels.length}{" "}
            {stop.parcels.length === 1 ? "pakket" : "pakketten"}
          </p>
        </div>
        <span className="text-2xl text-neutral-400">›</span>
      </div>
      {isLocker && (
        <div className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-dhl-red font-semibold text-white">
          Start lockersessie
        </div>
      )}
    </Link>
  );
}

function LockerIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="currentColor" aria-hidden>
      <path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z" opacity=".35" />
      <path d="M2 2h4v4H2V2zm8 0h4v4h-4V2zM2 10h4v4H2v-4zm8 0h4v4h-4v-4z" />
    </svg>
  );
}
