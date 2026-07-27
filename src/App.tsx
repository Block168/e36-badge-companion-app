import { useState } from "react";
import { BluetoothConnected, Radio, Sun, Wand2, Image as ImageIcon, Play, Smile, Heart } from "lucide-react";
import { StatusPill } from "./components/StatusBar";
import { ConnectScreen } from "./components/ConnectScreen";
import { FaceGallery } from "./components/FaceGallery";
import { CustomFaceUploader } from "./components/CustomFaceUploader";
import { BrightnessControl } from "./components/BrightnessControl";
import { BootAnimationEditor } from "./components/BootAnimationEditor";
import { TransferHistory } from "./components/TransferHistory";
import { useBLEManager } from "./hooks/useBLEManager";
import { useTheme } from "./hooks/useTheme";
import { cn } from "./utils/cn";

type Tab = "connect" | "faces" | "brightness" | "boot" | "history";

const TABS: { id: Tab; label: string; icon: typeof Radio }[] = [
  { id: "connect", label: "Connect", icon: BluetoothConnected },
  { id: "faces", label: "Gallery", icon: ImageIcon },
  { id: "brightness", label: "Lighting", icon: Smile },
  { id: "boot", label: "Startup", icon: Heart },
  { id: "history", label: "Activity", icon: Play },
];

export default function App() {
  const ble = useBLEManager();
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>("connect");
  const [uploaderOpen, setUploaderOpen] = useState(false);

  return (
    <div className={cn("min-h-screen text-white transition-colors duration-300", theme === "dark" ? "bg-[radial-gradient(ellipse_at_top,_#1e293b_0%,_#020617_60%)]" : "bg-[radial-gradient(ellipse_at_top,_#f1f5f9_0%,_#ffffff_60%)] text-slate-900")}>
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6">
        <section className={cn("relative flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[2rem] border", theme === "dark" ? "border-zinc-900 bg-zinc-950/70" : "border-slate-200 bg-white/80")}>
          <div className={cn("flex items-center justify-center border-b px-4 py-3", theme === "dark" ? "border-zinc-900" : "border-slate-200")}>
            <StatusPill state={ble.connectionState} name={ble.device?.name} />
          </div>

          <div className="relative flex-1 overflow-hidden">
            {tab === "connect" && <ConnectScreen ble={ble} />}
            {tab === "faces" && <FaceGallery ble={ble} onOpenUploader={() => setUploaderOpen(true)} />}
            {tab === "brightness" && <BrightnessControl ble={ble} />}
            {tab === "boot" && <BootAnimationEditor ble={ble} />}
            {tab === "history" && <TransferHistory theme={theme} />}
            {uploaderOpen && <CustomFaceUploader ble={ble} onClose={() => setUploaderOpen(false)} />}
          </div>

          <nav className={cn("flex items-center justify-around border-t px-1 py-2.5", theme === "dark" ? "border-zinc-900 bg-zinc-950/80" : "border-slate-200 bg-slate-50/80")}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1 text-[10px] font-medium",
                  tab === t.id ? "text-blue-400" : (theme === "dark" ? "text-zinc-500" : "text-slate-500")
                )}
              >
                <t.icon className="h-4.5 w-4.5" />
                {t.label}
              </button>
            ))}
          </nav>
        </section>
      </main>
    </div>
  );
}
