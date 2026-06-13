export function Step({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "success" | "error";
  children: React.ReactNode;
}) {
  const color = tone === "success" ? "text-green-700" : tone === "error" ? "text-dhl-red" : "";
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow">
      <h2 className={`text-lg font-bold ${color}`}>{title}</h2>
      {children}
    </div>
  );
}
