export function PrimaryButton({
  busy,
  disabled,
  onClick,
  children,
}: {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="bg-dhl-red min-h-12 w-full rounded-xl font-semibold text-white disabled:opacity-50"
      disabled={!!busy || !!disabled}
      onClick={onClick}
    >
      {busy ? "Bezig…" : children}
    </button>
  );
}

export function SecondaryButton({
  busy,
  onClick,
  children,
}: {
  busy?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white font-semibold disabled:opacity-50"
      disabled={busy}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
