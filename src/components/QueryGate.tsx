import type { ReactNode } from "react";

/** Uniform loading/error rendering around a TanStack Query result. */
export function QueryGate({
  isPending,
  error,
  children,
}: {
  isPending: boolean;
  error: Error | null;
  children: ReactNode;
}) {
  if (isPending) {
    return <p className="py-12 text-center text-neutral-500">Laden…</p>;
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow">
        <p className="text-dhl-red font-semibold">Er ging iets mis</p>
        <p className="mt-1 text-sm text-neutral-600">{error.message}</p>
      </div>
    );
  }
  return children;
}
