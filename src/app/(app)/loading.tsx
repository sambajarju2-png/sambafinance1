export default function Loading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Title skeleton */}
      <div className="skeleton h-7 w-32 rounded-input" />

      {/* Cards skeleton */}
      <div className="grid grid-cols-2 gap-2">
        <div className="skeleton h-[76px] rounded-card" />
        <div className="skeleton h-[76px] rounded-card" />
      </div>

      {/* Content skeleton */}
      <div className="skeleton h-[120px] rounded-card" />
      <div className="skeleton h-[60px] rounded-card" />
      <div className="skeleton h-[60px] rounded-card" />
    </div>
  );
}
