import { useNavigate, useParams } from "react-router-dom";
import { CourierLayout } from "../components/CourierLayout";
import { QueryGate } from "../components/QueryGate";
import { StatusBadge } from "../components/StatusBadge";
import { useTrips } from "../queries/trips";
import { useCreateSession } from "../queries/lockerSession";
import { apiErrorMessage } from "../api/client";
import { directionLabel, locationTypeLabel } from "../labels";

export function StopPage() {
  const { tripId, stopId } = useParams();
  const navigate = useNavigate();
  const { data: trips, isPending, error } = useTrips();
  const createSession = useCreateSession();
  const trip = trips?.find((t) => t.id === tripId);
  const stop = trip?.stops.find((s) => s.id === stopId);

  return (
    <CourierLayout title="Stopoverzicht" backTo={`/trips/${tripId}`}>
      <QueryGate isPending={isPending} error={error}>
        {!stop ? (
          <p className="py-12 text-center text-neutral-500">Stop niet gevonden</p>
        ) : (
          <>
            <div className="rounded-2xl bg-white p-4 shadow">
              <p className="font-semibold">{stop.address}</p>
              <p className="mt-0.5 text-sm text-neutral-600">{locationTypeLabel[stop.deliveryLocationType]}</p>
            </div>

            <h2 className="mt-5 mb-2 px-1 text-sm font-bold tracking-wide text-neutral-500 uppercase">Pakketten</h2>
            <ul className="flex flex-col gap-3">
              {stop.parcels.map((parcel) => {
                // One-tap flow: at a LOCKER stop, tapping an open parcel starts
                // the session for exactly that parcel; after the machine scans
                // the QR the right door opens by itself.
                const tappable = stop.deliveryLocationType === "LOCKER" && parcel.status === "EXPECTED";
                const body = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono font-semibold">{parcel.barcode}</p>
                      <StatusBadge status={parcel.status} />
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">
                      {directionLabel[parcel.direction]}
                      {parcel.size && ` · maat ${parcel.size}`} · {parcel.dimensions.lengthCm}×
                      {parcel.dimensions.widthCm}×{parcel.dimensions.heightCm} cm ·{" "}
                      {(parcel.dimensions.weightG / 1000).toLocaleString("nl-NL")} kg
                    </p>
                    {tappable && (
                      <p className="mt-2 text-sm font-semibold text-dhl-red">
                        {parcel.direction === "HAND_IN" ? "Tik om in te leveren ›" : "Tik om op te halen ›"}
                      </p>
                    )}
                  </>
                );
                return (
                  <li key={parcel.id}>
                    {tappable ? (
                      <button
                        className="w-full rounded-2xl bg-white p-4 text-left shadow active:bg-neutral-50 disabled:opacity-50"
                        disabled={createSession.isPending}
                        onClick={() =>
                          createSession.mutate(stop.id, {
                            onSuccess: ({ sessionId, qrPayload }) =>
                              navigate(`/trips/${tripId}/stops/${stopId}/session/${sessionId}`, {
                                state: { qrPayload, barcode: parcel.barcode },
                              }),
                          })
                        }
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="rounded-2xl bg-white p-4 shadow">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>

            {createSession.error != null && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-dhl-red">
                {apiErrorMessage(createSession.error)}
              </p>
            )}
          </>
        )}
      </QueryGate>
    </CourierLayout>
  );
}
