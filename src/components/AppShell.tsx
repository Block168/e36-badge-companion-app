import { useEffect, useState, type ReactNode } from "react";
import { Bluetooth, BluetoothConnected, Bug, History, Image as ImageIcon, PlugZap, SunMedium, Film, Wifi, WifiOff } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { cn } from "../utils/cn";

export type TabId = "dashboard" | "faces" | "brightness" | "animation" | "history" | "debug";

interface NavItem {
  id: TabId;
  label: string;
  icon: typeof PlugZap | typeof ImageIcon | typeof SunMedium | typeof Film | typeof History | typeof Bug;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Garage", icon: PlugZap },
  { id: "faces", label: "Faces", icon: ImageIcon },
  { id: "brightness", label: "Brightness", icon: SunMedium },
  { id: "animation", label: "Animations", icon: Film },
  { id: "history", label: "History", icon: History },
  { id: "debug", label: "Debug", icon: Bug },
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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 carbon border-b border-zinc-800/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="./icons/icon-512.png"
                alt="Faces logo"
                className="h-10 w-10 rounded-full object-cover ring-2 ring-m-blue-500/60 shadow-[0_0_18px_rgba(47,111,214,0.4)]"
              />
              <span className="absolute -bottom-0.5 right-0 h-2 w-2 rounded-full bg-m-red-500" />
            </div>
            <div>
              <p className="font-display text-sm font-extrabold uppercase leading-tight tracking-widest text-white">
                Faces
              </p>
              <p className="text-[11px] font-medium leading-tight tracking-wide text-zinc-500">
                Motorsport LED customization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest",
                connected
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : connecting
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-zinc-700/60 bg-zinc-900/60 text-zinc-500",
              )}
            >
              {connected ? <BluetoothConnected className="h-3.5 w-3.5" /> : <Bluetooth className="h-3.5 w-3.5" />}
              {connected ? (badgeInfo?.name ?? "Connected") : connecting ? "Scanning…" : "No Badge"}
            </div>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2 sm:px-6">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 font-display text-[12px] font-bold uppercase tracking-wider transition sm:text-[13px]",
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-600">
        Faces · Forged in the garage — works best in Chrome, Edge, or Opera with Web Bluetooth enabled.
      </footer>
    </div>
  );
}
