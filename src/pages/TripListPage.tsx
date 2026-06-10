import { Link } from "react-router-dom";
import { CourierLayout } from "../components/CourierLayout";
import { QueryGate } from "../components/QueryGate";
import { useTrips } from "../queries/trips";
import { formatTripDate } from "../labels";

export function TripListPage() {
  const { data: trips, isPending, error } = useTrips();

  return (
    <CourierLayout title="Ritoverzicht">
      <QueryGate isPending={isPending} error={error}>
        <ul className="flex flex-col gap-3">
          {trips?.map((trip) => {
            const parcelCount = trip.stops.reduce((n, stop) => n + stop.parcels.length, 0);
            return (
              <li key={trip.id}>
                <Link
                  to={`/trips/${trip.id}`}
                  className="block rounded-2xl bg-white p-4 shadow active:bg-neutral-50"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold">{trip.name}</h2>
                    <span className="text-2xl text-neutral-400">›</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{formatTripDate(trip.tripDate)}</p>
                  <p className="mt-2 text-sm text-neutral-600">
                    {trip.stops.length} stops · {parcelCount} pakketten
                  </p>
                </Link>
              </li>
            );
          })}
          {trips?.length === 0 && (
            <p className="py-12 text-center text-neutral-500">Geen ritten voor vandaag</p>
          )}
        </ul>
      </QueryGate>
    </CourierLayout>
  );
}
