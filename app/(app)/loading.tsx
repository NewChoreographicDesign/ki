// Shown instantly by Next.js while a route segment's Server Component data is
// still loading — every page here fetches from the database directly
// (force-dynamic, session-dependent), so without this the screen would just
// sit frozen on the previous page after a nav click. The sidebar/nav stay
// mounted (this only replaces the <main> content, per the (app) layout).
//
// This used to be a full skeleton shaped like the dashboard, which looked
// broken on every other page (a 5-card grid flashing before a form, say).
// A single indeterminate progress bar reads as "loading" everywhere without
// pretending to preview content it can't know the shape of.
export default function AppLoading() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] overflow-hidden rounded-full bg-surface2"
    >
      <div className="h-full w-0 animate-loading-bar rounded-full bg-brand-gradient" />
    </div>
  );
}
