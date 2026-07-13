import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  speed?: "slow" | "normal" | "fast";
  direction?: "left" | "right";
  gap?: "small" | "medium" | "large";
}

export function Marquee({
  children,
  className,
  speed = "normal",
  direction = "left",
  gap = "medium",
}: MarqueeProps) {
  const speedStyle = {
    slow: { animationDuration: "100s" },
    normal: { animationDuration: "60s" },
    fast: { animationDuration: "30s" },
  }[speed];

  const directionClass =
    direction === "right" ? "animate-marquee-right" : "animate-marquee";

  const gapClass = {
    small: "gap-4",
    medium: "gap-8",
    large: "gap-16",
  }[gap];

  return (
    <div className={cn("overflow-hidden bg-muted/50 border-y flex", gapClass, className)}>
      <div
        className={cn("flex items-center shrink-0", gapClass, directionClass)}
        style={speedStyle}
      >
        {children}
      </div>
      <div
        className={cn("flex items-center shrink-0", gapClass, directionClass)}
        style={speedStyle}
        aria-hidden="true"
      >
        {children}
      </div>
    </div>
  );
}

export function MarqueeItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-shrink-0 whitespace-nowrap", className)}>
      {children}
    </div>
  );
}
