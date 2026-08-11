import { useState } from "react";
import { BadgeProvider } from "./context/BadgeContext";
import { AppShell, type TabId } from "./components/AppShell";
import { FaceGallery } from "./components/FaceGallery";
import { BrightnessPanel } from "./components/BrightnessPanel";
import { AnimationEditor } from "./components/AnimationEditor";
import { HistoryPanel } from "./components/HistoryPanel";
import { DebugPanel } from "./components/DebugPanel";
import { Toasts } from "./components/Toasts";
import { ProgressModal } from "./components/ProgressModal";
import { ConnectionCard } from "./components/ConnectionCard";
import { InstallPrompt } from "./components/InstallPrompt";


function DashboardTab() {
  return (
    <div className="space-y-6">
      <ConnectionCard />
      <InstallPrompt />
    </div>
  );
}

function AppContent() {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <AppShell activeTab={tab} onTabChange={setTab}>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "faces" && <FaceGallery />}
      {tab === "brightness" && <BrightnessPanel />}
      {tab === "animation" && <AnimationEditor />}
      {tab === "history" && <HistoryPanel />}
      {tab === "debug" && <DebugPanel />}
      <Toasts />
      <ProgressModal />
    </AppShell>
  );
}

export default function App() {
  return (
    <BadgeProvider>
      <AppContent />
    </BadgeProvider>
  );
}
