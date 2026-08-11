import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { cn } from "../utils/cn";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function Toasts() {
  const { toasts, dismissToast } = useBadge();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2",
              toast.kind === "success" && "border-emerald-500/30 bg-emerald-950/90 text-emerald-100",
              toast.kind === "error" && "border-red-500/30 bg-red-950/90 text-red-100",
              toast.kind === "info" && "border-sky-500/30 bg-sky-950/90 text-sky-100",
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm leading-snug">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="rounded-md p-0.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
