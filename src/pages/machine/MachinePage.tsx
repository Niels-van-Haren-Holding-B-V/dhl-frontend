import { useSimState } from "../../queries/simState";
import { apiErrorMessage } from "../../api/client";
import { MachineFront } from "./MachineFront";
import { ConsolePane } from "./ConsolePane";

/**
 * Parcel machine page: schematic front view of the locker (yellow band,
 * light grey doors, console column in the middle) + operator console. The
 * page authenticates with the courier user and talks only to the backend
 * passthroughs at /api/sim/**; a real machine would have its own identity
 * in the locker realm.
 */
export function MachinePage() {
  const { data, isPending, error } = useSimState();

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-4 bg-neutral-100 p-4 text-neutral-900 lg:grid-cols-[3fr_2fr]">
      {isPending ? (
        <p className="col-span-full self-center text-center text-xl text-neutral-500">
          Verbinden met automaat…
        </p>
      ) : error ? (
        <p className="text-dhl-red col-span-full self-center text-center text-xl">{apiErrorMessage(error)}</p>
      ) : (
        <>
          <MachineFront state={data} />
          <ConsolePane state={data} />
        </>
      )}
    </div>
  );
}
