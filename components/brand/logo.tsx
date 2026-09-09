import { cn } from "@/lib/utils";

const MARK_SIZES = {
  sm: "h-9 w-9 rounded-lg",
  md: "h-14 w-14 rounded-2xl",
  lg: "h-20 w-20 rounded-[1.75rem]",
} as const;

/**
 * The app's mark: two interlocking rings, standing in for "110G" as a shape
 * rather than spelling it out — text-in-a-box reads as a placeholder at a
 * glance, an abstract mark reads as a brand, and it stays legible at every
 * size from a 36px nav icon to the home-screen icon. The interlock also
 * isn't arbitrary: this is a care-home app built around people working
 * together around a resident, so a connection motif fits better than a
 * monogram would.
 *
 * A soft blurred halo behind it breathes slowly (animate-pulse-glow) so the
 * mark reads as alive rather than a static image — subtle and slow enough
 * to sit in the sidebar all shift without becoming a distraction.
 */
export function LogoMark({
  size = "md",
  className,
}: {
  size?: keyof typeof MARK_SIZES;
  className?: string;
}) {
  return (
    <div className={cn("relative inline-flex shrink-0", MARK_SIZES[size])}>
      <div
        aria-hidden="true"
        className={cn("absolute inset-0 -z-10 animate-pulse-glow bg-brand-gradient blur-md", MARK_SIZES[size])}
      />
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-brand-gradient-sheen",
          "shadow-glow-sky ring-1 ring-inset ring-white/25",
          MARK_SIZES[size],
          className
        )}
      >
        <svg viewBox="0 0 100 100" className="h-[62%] w-[62%]" fill="none" aria-hidden="true">
          <circle cx="37" cy="50" r="23" stroke="white" strokeWidth="9" />
          <circle cx="63" cy="50" r="23" stroke="white" strokeOpacity="0.75" strokeWidth="9" />
        </svg>
      </div>
    </div>
  );
}
