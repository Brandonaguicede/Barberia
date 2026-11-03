import { type CSSProperties, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
type Kind = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  kind: Kind;
}
let entries: Toast[] = [], sequence = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const dismiss = (id: number) => {
  entries = entries.filter((t) => t.id !== id);
  emit();
};
function show(message: string, kind: Kind, options?: { duration?: number }) {
  const id = ++sequence;
  entries = [...entries.slice(-4), { id, message, kind }];
  emit();
  setTimeout(() => dismiss(id), options?.duration || 5000);
  return id;
}
const toast = Object.assign(
  (message: string, options?: { duration?: number }) =>
    show(message, "info", options),
  {
    success: (message: string, options?: { duration?: number }) =>
      show(message, "success", options),
    error: (message: string, options?: { duration?: number }) =>
      show(message, "error", options),
  },
);
export default toast;
export function Toaster(
  { toastOptions }: {
    position?: string;
    toastOptions?: {
      style?: CSSProperties;
      success?: unknown;
      error?: unknown;
    };
  },
) {
  const current = useSyncExternalStore((fn) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, () => entries);
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {current.map((t) => {
        const Icon = t.kind === "success"
          ? CheckCircle
          : t.kind === "error"
          ? AlertCircle
          : Info;
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="toast-message"
            data-kind={t.kind}
            style={toastOptions?.style}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
