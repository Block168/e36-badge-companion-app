import { useEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../utils/cn";

/** Tab-level header: large title on the left, actions on the right. */
export function ScreenHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-3 pt-2">
      <div className="min-w-0">
        <h1 className="large-title truncate">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-label-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>}
    </header>
  );
}

/** Pushed-screen bar: back button, centered title, optional trailing action. */
export function NavBar({ back, onBack, title, trailing }: { back: string; onBack: () => void; title: string; trailing?: ReactNode }) {
  return (
    <div className="sticky top-[var(--safe-top)] z-20 -mx-4 mb-4 grid grid-cols-[1fr_auto_1fr] items-center bg-black/80 px-2 py-1 backdrop-blur-xl backdrop-saturate-150">
      <button onClick={onBack} className="link-btn justify-self-start pr-2">
        <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
        <span className="max-w-[30vw] truncate">{back}</span>
      </button>
      <h2 className="max-w-[44vw] truncate text-[17px] font-semibold">{title}</h2>
      <div className="justify-self-end pr-2">{trailing}</div>
    </div>
  );
}

export function Section({
  title,
  action,
  footer,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      {(title || action) && (
        <div className="section-header">
          <span>{title}</span>
          {action && <span className="normal-case">{action}</span>}
        </div>
      )}
      <div className="list-group">{children}</div>
      {footer && <p className="section-footer">{footer}</p>}
    </section>
  );
}

/** Rounded-square icon tile used at the start of list rows. */
export function RowIcon({ children, color = "bg-surface-3" }: { children: ReactNode; color?: string }) {
  return (
    <span className={cn("flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-white", color)}>
      {children}
    </span>
  );
}

interface RowProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  accessory?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

export function Row({ icon, title, subtitle, detail, accessory, chevron, onClick, destructive, disabled, className, testId }: RowProps) {
  const body = (
    <>
      {icon}
      <span className="list-row-body">
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[16px] sm:text-[15px]", destructive ? "text-danger" : "text-label")}>{title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-[13px] text-label-2">{subtitle}</span>}
        </span>
        {detail !== undefined && <span className="shrink-0 truncate text-[15px] text-label-2">{detail}</span>}
        {accessory}
        {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-label-3" strokeWidth={2.6} />}
      </span>
    </>
  );
  if (onClick && accessory) {
    // Accessories can be buttons/switches, which can't nest inside a <button>.
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        data-testid={testId}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn("list-row cursor-pointer active:bg-surface-2 aria-disabled:opacity-40", className)}
      >
        {body}
      </div>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} disabled={disabled} data-testid={testId} className={cn("list-row disabled:opacity-40", className)}>
        {body}
      </button>
    );
  }
  return <div className={cn("list-row", className)}>{body}</div>;
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40",
        checked ? "bg-go" : "bg-fill-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-out",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("grid auto-cols-fr grid-flow-col rounded-[9px] bg-fill p-[2px]", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-8 rounded-[7px] px-2 text-[13px] font-semibold whitespace-nowrap transition duration-150",
            value === o.id ? "bg-surface-3 text-label shadow-[0_3px_8px_rgba(0,0,0,0.12)]" : "text-label-2 active:text-label",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centered card on wider screens. */
export function Sheet({ open, onClose, title, children, trailing }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; trailing?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[16px] bg-surface shadow-[0_-20px_60px_rgba(0,0,0,0.6)] sm:rounded-[16px]">
        <div className="mx-auto mt-2 h-[5px] w-9 shrink-0 rounded-full bg-surface-3 sm:hidden" />
        {(title || trailing) && (
          <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4 pt-2 pb-2">
            <button onClick={onClose} className="link-btn justify-self-start font-normal text-label-2">
              Cancel
            </button>
            <h2 className="truncate text-[17px] font-semibold">{title}</h2>
            <div className="justify-self-end">{trailing}</div>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain px-4 pt-2 pb-[calc(var(--safe-bottom)+24px)]">{children}</div>
      </div>
    </div>
  );
}

/** Circular thumbnail matching the badge's round display. */
export function Thumb({ src, size = 40, className, ring }: { src: string; size?: number; className?: string; ring?: boolean }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      className={cn("shrink-0 rounded-full bg-black object-cover", ring && "ring-2 ring-go ring-offset-2 ring-offset-black", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface text-label-2">{icon}</div>
      <p className="text-[17px] font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-[15px] text-label-2">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
