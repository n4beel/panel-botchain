import { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "elevated" | "questionnaire" | "results";
  compact?: boolean;
}

export default function Panel({
  variant = "surface",
  compact = false,
  children,
  className = "",
  style,
  ...props
}: PanelProps) {
  const variantStyles = {
    surface: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
    },
    elevated: {
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-default)",
    },
    questionnaire: {
      background: "#FFFFFF",
      border: "1px solid var(--border-default)",
      boxShadow: "0 10px 30px -10px rgba(108, 71, 255, 0.08)",
    },
    results: {
      background: "var(--bg-surface)",
      border: "1.5px solid var(--border-default)",
    },
  };

  return (
    <div
      className={[
        "rounded-[16px] transition-all",
        compact ? "p-4 md:p-5" : "p-6 md:p-8",
        className,
      ].join(" ")}
      style={{
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
