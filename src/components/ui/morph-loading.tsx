import { cn } from "@/lib/utils";

interface UniqueLoadingProps {
  variant?: "morph";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const containerSizes = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
} as const;

const scaleBySize = {
  sm: "scale-75",
  md: "scale-100",
  lg: "scale-125",
} as const;

/** Sky, field, primary, and deep blue from the Birpe palette. */
const cubes = ["#3d9ff6", "#2e8df4", "#276cf5", "#1239c8"] as const;

export default function UniqueLoading({
  variant = "morph",
  size = "md",
  className,
}: UniqueLoadingProps) {
  if (variant !== "morph") return null;

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("relative", containerSizes[size], className)}
    >
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center origin-center",
          scaleBySize[size],
        )}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="morph-loader__cube absolute w-4 h-4"
            style={{
              backgroundColor: cubes[i],
              animation: `morph-${i} 2s infinite ease-in-out`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
