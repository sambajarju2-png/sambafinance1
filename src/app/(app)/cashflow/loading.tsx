export default function Loading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="skeleton h-7 w-28 rounded-input" />
      <div className="skeleton h-[240px] rounded-card" />
      <div className="space-y-2">
        {[1,2,3].map(i => (
          <div key={i} className="skeleton h-[60px] rounded-card" />
        ))}
      </div>
    </div>
  );
}
