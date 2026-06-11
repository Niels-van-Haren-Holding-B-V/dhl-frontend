export function DoorAnimation() {
  return (
    <div className="flex justify-center">
      <div className="border-dhl-yellow relative h-24 w-24 rounded-xl border-4">
        <div className="bg-dhl-yellow/60 absolute inset-y-0 left-0 w-1/2 origin-left animate-pulse rounded-l-lg" />
      </div>
    </div>
  );
}
