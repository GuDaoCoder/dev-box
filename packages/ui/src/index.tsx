import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren, ReactNode } from "react";

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: ReactNode;
}

export function Button({
  children,
  className,
  icon,
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames("ui-button", `ui-button--${variant}`, className)}
      type={type}
      {...props}
    >
      {icon ? <span className="ui-button__icon">{icon}</span> : null}
      {children}
    </button>
  );
}

export function Kbd({ children }: PropsWithChildren) {
  return <kbd className="ui-kbd">{children}</kbd>;
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={classNames("ui-badge", `ui-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

export function StatusDot({ tone = "success" }: Pick<BadgeProps, "tone">) {
  return <span aria-hidden="true" className={`ui-status-dot ui-status-dot--${tone}`} />;
}
