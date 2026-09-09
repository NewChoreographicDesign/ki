import { cn } from "@/lib/utils";

const MARK_SIZES = {
  sm: "h-9 w-9 rounded-lg text-[0.6rem] tracking-tighter",
  md: "h-14 w-14 rounded-2xl text-base tracking-tighter",
  lg: "h-20 w-20 rounded-[1.75rem] text-2xl tracking-tighter",
} as const;

/** The "110G" badge mark — the one recurring app logo, used at whatever size the context needs. */
export function LogoMark({
  size = "md",
  className,
}: {
  size?: keyof typeof MARK_SIZES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-brand-gradient-sheen font-extrabold text-white",
        "shadow-glow-sky ring-1 ring-inset ring-white/25",
        MARK_SIZES[size],
        className
      )}
    >
      110G
    </div>
  );
}
