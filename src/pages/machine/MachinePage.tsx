import { useSimState } from "../../queries/simState";
import { apiErrorMessage } from "../../api/client";
import { MachineFront } from "./MachineFront";
import { ConsolePane } from "./ConsolePane";

export function MachinePage() {
  const { data, isPending, error } = useSimState();

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-4 bg-neutral-100 p-4 text-neutral-900 lg:h-dvh lg:grid-cols-[3fr_2fr] lg:overflow-hidden">
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
