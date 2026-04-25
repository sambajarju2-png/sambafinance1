export default function Loading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="skeleton h-7 w-36 rounded-input" />
      <div className="skeleton h-10 w-full rounded-input" />
      <div className="space-y-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skeleton h-[72px] rounded-card" />
        ))}
      </div>
    </div>
  );
}
