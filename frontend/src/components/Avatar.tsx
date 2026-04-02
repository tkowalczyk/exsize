interface AvatarProps {
  icon?: string | null;
  background?: string | null;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { container: "h-8 w-8", icon: "text-sm" },
  md: { container: "h-10 w-10", icon: "text-lg" },
  lg: { container: "h-20 w-20", icon: "text-4xl" },
};

export default function Avatar({ icon, background, size = "md" }: AvatarProps) {
  const s = SIZES[size];
  const bgValue = background ?? "#F48FB1";
  const isGradient = bgValue.includes("gradient");

  return (
    <div
      className={`${s.container} flex shrink-0 items-center justify-center rounded-full`}
      style={{
        background: isGradient ? bgValue : undefined,
        backgroundColor: isGradient ? undefined : bgValue,
      }}
    >
      <span className={s.icon}>{icon ?? "👤"}</span>
    </div>
  );
}
