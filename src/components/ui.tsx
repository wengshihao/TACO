import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" className="mark-bg" />
      <path d="M5 15.5h22a11 11 0 0 1-22 0Z" className="mark-shell" />
      <path
        d="M5.5 15.2c1.6-2.6 3.4-2.6 5 0s3.4 2.6 5 0 3.4-2.6 5 0 3.4 2.6 5 0"
        className="mark-fill"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CopyButton({ text, label }: { text: string | (() => string); label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className="ghost-btn"
      aria-label={label ?? "Copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
          setCopied(true);
        } catch {
          // Clipboard can be unavailable on insecure origins; nothing useful to do.
        }
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={option.value === value ? "on" : ""}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const storage = {
  get(key: string, area: "local" | "session" = "local"): string | null {
    try {
      return (area === "local" ? localStorage : sessionStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null, area: "local" | "session" = "local") {
    try {
      const store = area === "local" ? localStorage : sessionStorage;
      if (value === null) store.removeItem(key);
      else store.setItem(key, value);
    } catch {
      // Storage may be blocked (private mode); settings then last for this page view only.
    }
  },
};

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const explicit = document.documentElement.dataset.theme;
    if (explicit === "light" || explicit === "dark") return explicit;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    storage.set("taco:theme", next);
    setTheme(next);
  };
  return { theme, toggle };
}

export function formatMs(ms: number) {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function formatTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
