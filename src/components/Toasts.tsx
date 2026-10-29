import { CircleCheck, CircleX, Info } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { cn } from "../utils/cn";

const ICONS = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
};

const ICON_COLOR = {
  success: "text-go",
  error: "text-danger",
  info: "text-link",
};

/** Dynamic-island style capsules at the top of the screen. Tap to dismiss. */
export function Toasts() {
  const { toasts, dismissToast } = useBadge();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+8px)] z-[100] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <button
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            className="anim-toast pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full border border-white/10 bg-surface-2/90 py-2.5 pr-5 pl-3 text-left shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <Icon className={cn("h-5 w-5 shrink-0", ICON_COLOR[toast.kind])} />
            <span className="text-[14px] leading-snug font-medium">{toast.message}</span>
          </button>
        );
      })}
    </div>
  );
}
