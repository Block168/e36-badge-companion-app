import { useEffect, useState, type ReactNode } from "react";
import { Bluetooth, BluetoothConnected, Bug, History, Image as ImageIcon, PlugZap, SunMedium, Film, Wifi, WifiOff } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { cn } from "../utils/cn";

export type TabId = "dashboard" | "faces" | "brightness" | "animation" | "history" | "debug";

interface NavItem {
  id: TabId;
  label: string;
  /** Fits under an icon in the phone tab bar. */
  short: string;
  icon: typeof PlugZap | typeof ImageIcon | typeof SunMedium | typeof Film | typeof History | typeof Bug;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Garage", short: "Garage", icon: PlugZap },
  { id: "faces", label: "Faces", short: "Faces", icon: ImageIcon },
  { id: "brightness", label: "Brightness", short: "Glow", icon: SunMedium },
  { id: "animation", label: "Animations", short: "Anim", icon: Film },
  { id: "history", label: "History", short: "History", icon: History },
  { id: "debug", label: "Debug", short: "Debug", icon: Bug },
];

export function AppShell({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: ReactNode;
}) {
  const { connectionState, badgeInfo } = useBadge();
  const connected = connectionState === "connected";
  const connecting = connectionState === "connecting";
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const selectTab = (tab: TabId) => {
    if (tab !== activeTab) window.scrollTo({ top: 0 });
    onTabChange(tab);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 carbon border-b border-zinc-800/80 pt-[var(--safe-top)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <img
                src="./icons/icon-512.png"
                alt="Faces logo"
                className="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10 ring-2 ring-m-blue-500/60 shadow-[0_0_18px_rgba(47,111,214,0.4)]"
              />
              <span className="absolute -bottom-0.5 right-0 h-2 w-2 rounded-full bg-m-red-500" />
            </div>
            <div>
              <p className="font-display text-sm font-extrabold uppercase leading-tight tracking-widest text-white">
                Faces
              </p>
              <p className="hidden text-[11px] font-medium leading-tight tracking-wide text-zinc-500 min-[400px]:block">
                Motorsport LED customization
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-widest sm:inline-flex",
                online
                  ? "border-zinc-700/60 bg-zinc-900/60 text-zinc-500"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300",
              )}
              title={online ? "Online" : "Offline — running from cached copy"}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Online" : "Offline"}
            </span>
            <div
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest",
                connected
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : connecting
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-zinc-700/60 bg-zinc-900/60 text-zinc-500",
              )}
            >
              {connected ? (
                <BluetoothConnected className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Bluetooth className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">
                {connected ? (badgeInfo?.name ?? "Connected") : connecting ? "Scanning…" : "No Badge"}
              </span>
            </div>
          </div>
        </div>

        <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-6 pb-2 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 font-display text-[13px] font-bold uppercase tracking-wider transition",
                  active
                    ? "bg-gradient-to-b from-m-blue-500 to-m-blue-700 text-white shadow-lg shadow-m-blue-900/40"
                    : "text-zinc-500 hover:bg-zinc-900/70 hover:text-zinc-200",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-m-blue-300 via-m-red-500 to-m-blue-300 opacity-80" />
                )}
              </button>
            );
          })}
        </nav>
        <div className="m-stripe h-[3px] w-full opacity-80" />
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-[calc(var(--tabbar-h)+var(--safe-bottom)+24px)] pt-4 sm:px-6 sm:pt-8 md:pb-8">
        {children}
      </main>

      <footer className="hidden border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-600 md:block">
        Faces · Forged in the garage — works best in Chrome, Edge, or Opera with Web Bluetooth enabled.
      </footer>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/80 bg-carbon-950/95 pb-[var(--safe-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="m-stripe h-[2px] w-full opacity-70" />
        <div className="grid h-[var(--tabbar-h)] grid-cols-6">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 transition active:scale-95",
                  active ? "text-white" : "text-zinc-500 active:text-zinc-300",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition",
                    active && "bg-gradient-to-b from-m-blue-500 to-m-blue-700 shadow-lg shadow-m-blue-900/50",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="font-display text-[9px] font-bold uppercase tracking-wider">{item.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
