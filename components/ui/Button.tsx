"use client";

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

type Variant = "primary" | "secondary" | "pill" | "pill-active" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantInlineStyles: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "#FFFFFF",
    border: "1px solid var(--accent)",
  },
  secondary: {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  },
  pill: {
    background: "#FFFFFF",
    color: "var(--text-primary)",
    border: "1.5px solid var(--border-default)",
  },
  "pill-active": {
    background: "var(--accent)",
    color: "#FFFFFF",
    border: "1.5px solid var(--accent)",
  },
  ghost: {
    background: "transparent",
    border: "1px solid transparent",
    color: "var(--text-secondary)",
  },
  danger: {
    background: "transparent",
    border: "1px solid var(--danger)",
    color: "var(--danger)",
  },
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[12px] font-medium rounded-full",
  md: "px-5 py-2.5 text-[14px] font-medium rounded-full",
  lg: "px-6 py-3.5 text-[15px] font-semibold rounded-full",
  xl: "w-full px-6 py-4 text-[16px] font-semibold rounded-full text-left justify-between",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center transition-all cursor-pointer",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus:outline-none focus:ring-2 focus:ring-[#6C47FF]/30",
          sizeStyles[size],
          className,
        ].join(" ")}
        style={{
          ...variantInlineStyles[variant],
          ...style,
        }}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
