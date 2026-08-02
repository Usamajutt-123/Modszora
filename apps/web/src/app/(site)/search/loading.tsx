export default function SearchLoading() {
  return (
    <div className="container py-6">
      <div className="skeleton h-9 w-56 rounded-xl" />
      <div className="skeleton mt-4 h-11 w-full max-w-2xl rounded-xl" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
