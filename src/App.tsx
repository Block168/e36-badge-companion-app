import { useEffect, useState } from "react";
import { BadgeProvider } from "./context/BadgeContext";
import { AutomationProvider } from "./context/AutomationContext";
import { AppShell } from "./components/AppShell";
import { GarageScreen } from "./components/GarageScreen";
import { LibraryScreen } from "./components/LibraryScreen";
import { PlaylistsScreen } from "./components/PlaylistsScreen";
import { TriggersScreen } from "./components/TriggersScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { Toasts } from "./components/Toasts";
import { ProgressModal } from "./components/ProgressModal";
import { loadActiveTab, saveActiveTab } from "./lib/storage";
import type { TabId } from "./types";

const SCREENS: Record<TabId, () => React.JSX.Element> = {
  garage: GarageScreen,
  library: LibraryScreen,
  playlists: PlaylistsScreen,
  triggers: TriggersScreen,
  settings: SettingsScreen,
};

function AppContent() {
  const [tab, setTab] = useState<TabId>(() => loadActiveTab());

  useEffect(() => {
    saveActiveTab(tab);
  }, [tab]);

  // Every screen stays mounted so in-progress work (Studio frames, open sheets) survives tab switches.
  return (
    <AppShell activeTab={tab} onTabChange={setTab}>
      {(Object.keys(SCREENS) as TabId[]).map((id) => {
        const Screen = SCREENS[id];
        return (
          <div key={id} className={tab === id ? undefined : "hidden"} inert={tab !== id}>
            <Screen />
          </div>
        );
      })}
      <Toasts />
      <ProgressModal />
    </AppShell>
  );
}

export default function App() {
  return (
    <BadgeProvider>
      <AutomationProvider>
        <AppContent />
      </AutomationProvider>
    </BadgeProvider>
  );
}
