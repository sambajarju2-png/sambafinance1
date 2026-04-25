export default function Loading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="skeleton h-7 w-32 rounded-input" />
      <div className="skeleton h-[200px] rounded-card" />
      <div className="grid grid-cols-2 gap-2">
        <div className="skeleton h-[76px] rounded-card" />
        <div className="skeleton h-[76px] rounded-card" />
      </div>
      <div className="skeleton h-[160px] rounded-card" />
    </div>
  );
}
