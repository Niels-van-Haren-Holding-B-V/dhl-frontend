import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function CourierLayout({ title, backTo, children }: { title: string; backTo?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-100">
      <header className="sticky top-0 z-10 bg-dhl-yellow shadow">
        <div className="mx-auto flex min-h-14 max-w-md items-center gap-2 px-4">
          {backTo && (
            <Link to={backTo} aria-label="Terug" className="-ml-2 flex size-12 items-center justify-center text-2xl">
              ‹
            </Link>
          )}
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}
