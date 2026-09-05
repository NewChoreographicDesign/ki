// Shown instantly by Next.js while a route segment's Server Component data
// is still loading — every page here fetches from the database directly
// (force-dynamic, session-dependent), so without this the screen would just
// sit frozen on the previous page after a nav click, which reads as the app
// hanging rather than working. The sidebar/nav stay mounted (this only
// replaces the <main> content, per the (app) layout), so navigation still
// feels immediate even while this skeleton is up.
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface2 ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-4 w-72" />
      </div>
      <SkeletonBlock className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <SkeletonBlock className="h-20 w-full rounded-2xl" />
        <SkeletonBlock className="h-20 w-full rounded-2xl" />
        <SkeletonBlock className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  );
}
