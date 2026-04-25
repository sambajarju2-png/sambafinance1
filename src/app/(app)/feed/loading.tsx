export default function Loading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="skeleton h-7 w-36 rounded-input" />
      <div className="skeleton h-[80px] rounded-card" />
      {[1,2,3].map(i => (
        <div key={i} className="skeleton h-[120px] rounded-card" />
      ))}
    </div>
  );
}
