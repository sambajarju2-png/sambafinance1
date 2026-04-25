export default function Loading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="skeleton h-7 w-32 rounded-input" />
      <div className="space-y-2">
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} className="skeleton h-[56px] rounded-card" />
        ))}
      </div>
    </div>
  );
}
