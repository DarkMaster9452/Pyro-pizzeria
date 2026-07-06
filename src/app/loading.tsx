export default function Loading() {
  return (
    <div className="section py-10">
      <div className="skeleton mb-4 h-10 w-48 rounded-xl" />
      <div className="skeleton mb-8 h-4 w-72 rounded" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl">
            <div className="skeleton aspect-[4/3] w-full" />
            <div className="space-y-2 p-4">
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-8 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
