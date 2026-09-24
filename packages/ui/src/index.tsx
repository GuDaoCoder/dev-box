import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Calculator,
  Clipboard,
  Clock3,
  Eraser,
  Hash,
  Minimize2,
  Play,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { shortcutLabelForPlatform } from "./shortcuts";

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

export type StandardAction =
  | "format"
  | "compact"
  | "clear"
  | "copy"
  | "run"
  | "extract"
  | "convert"
  | "now"
  | "swap"
  | "generate"
  | "calculate";

const actionIcons = {
  format: WandSparkles,
  compact: Minimize2,
  clear: Eraser,
  copy: Clipboard,
  run: Play,
  extract: Sparkles,
  convert: ArrowRight,
  now: Clock3,
  swap: ArrowLeftRight,
  generate: Hash,
  calculate: Calculator,
} as const;

export function ActionButton({
  action,
  children,
  variant,
  ...props
}: Omit<ButtonProps, "icon"> & { action: StandardAction }) {
  const Icon = actionIcons[action];
  return (
    <Button
      icon={<Icon aria-hidden="true" size={14} />}
      variant={variant ?? (action === "clear" || action === "copy" ? "ghost" : "secondary")}
      {...props}
    >
      {children}
    </Button>
  );
}

export function IconButton({
  "aria-label": label,
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      aria-label={label}
      className={classNames("ui-icon-button", className)}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export function CopyButton({
  value,
  label,
  copiedLabel,
  onCopy,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  onCopy?: (value: string) => Promise<void>;
}) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const copied = Boolean(value) && copiedValue === value;
  useEffect(() => {
    if (!copiedValue) return;
    const timer = window.setTimeout(() => setCopiedValue(null), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedValue]);
  return (
    <ActionButton
      action="copy"
      disabled={!value}
      onClick={() => {
        void (async () => {
          try {
            await (onCopy ? onCopy(value) : navigator.clipboard.writeText(value));
            setCopiedValue(value);
          } catch {
            setCopiedValue(null);
          }
        })();
      }}
    >
      {copied ? copiedLabel : label}
    </ActionButton>
  );
}

export function ShortcutKbd({ keyName }: { keyName: string }) {
  return <Kbd>{shortcutLabelForPlatform(navigator.userAgent, keyName)}</Kbd>;
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
