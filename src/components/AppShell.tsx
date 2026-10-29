import type { ReactNode } from "react";
import { CarFront, LayoutGrid, ListVideo, Settings, Zap } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { cn } from "../utils/cn";
import type { TabId } from "../types";

export type { TabId };

const NAV_ITEMS: { id: TabId; label: string; icon: typeof CarFront }[] = [
  { id: "garage", label: "Garage", icon: CarFront },
  { id: "library", label: "Library", icon: LayoutGrid },
  { id: "playlists", label: "Playlists", icon: ListVideo },
  { id: "triggers", label: "Triggers", icon: Zap },
  { id: "settings", label: "Settings", icon: Settings },
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
  const { activeTransfer } = useBadge();

  const selectTab = (tab: TabId) => {
    if (tab !== activeTab) window.scrollTo({ top: 0 });
    onTabChange(tab);
  };

  return (
    <div className="min-h-dvh">
      {/* Status-bar scrim so content never collides with the notch. */}
      <div className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-black/80 backdrop-blur-xl" />

      <main className="mx-auto max-w-2xl overflow-x-clip px-4 pt-[calc(var(--safe-top)+16px)] pb-[calc(var(--tabbar-h)+var(--safe-bottom)+32px)]">
        {children}
      </main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-sep/60 bg-[rgba(18,18,20,0.82)] pb-[var(--safe-bottom)] backdrop-blur-xl backdrop-saturate-150"
      >
        {activeTransfer?.background && (
          <div className="absolute inset-x-0 -top-px h-0.5 overflow-hidden">
            <div className="h-full bg-go transition-[width] duration-200" style={{ width: `${activeTransfer.percent}%` }} />
          </div>
        )}
        <div className="mx-auto grid h-[var(--tabbar-h)] max-w-2xl grid-cols-5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => selectTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 pt-1 transition-colors duration-150 active:opacity-60",
                  active ? "text-label" : "text-[#8e8e93]",
                )}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
