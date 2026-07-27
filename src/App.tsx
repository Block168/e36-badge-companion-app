import { useState } from "react";
import { BluetoothConnected, Radio, Sun, Wand2, Image as ImageIcon, Moon, Clock } from "lucide-react";
import { PhoneFrame } from "./components/PhoneFrame";
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
  { id: "faces", label: "Faces", icon: ImageIcon },
  { id: "brightness", label: "Brightness", icon: Sun },
  { id: "boot", label: "Boot", icon: Wand2 },
  { id: "history", label: "History", icon: Clock },
];

export default function App() {
  const ble = useBLEManager();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("connect");
  const [uploaderOpen, setUploaderOpen] = useState(false);

  return (
    <div className={cn("min-h-screen text-white transition-colors duration-300", theme === "dark" ? "bg-[radial-gradient(ellipse_at_top,_#1e293b_0%,_#020617_60%)]" : "bg-[radial-gradient(ellipse_at_top,_#f1f5f9_0%,_#ffffff_60%)] text-slate-900")}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition-colors", theme === "dark" ? "bg-zinc-800/50 hover:bg-zinc-700/50" : "bg-slate-200/50 hover:bg-slate-300/50")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 font-bold">
            F
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Faces</p>
            <p className={cn("text-[11px] leading-tight", theme === "dark" ? "text-zinc-500" : "text-slate-500")}>BMW Badge Display Companion</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 pb-20 lg:grid-cols-[1fr_430px]">
        <section className="order-2 lg:order-1">
          <div className={cn("relative overflow-hidden rounded-3xl border", theme === "dark" ? "border-zinc-800" : "border-slate-200")}>
            <img src="/images/hero-badge.jpg" alt="E36 trunk badge display" className="h-64 w-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5">
              <h1 className="text-2xl font-bold tracking-tight">Your badge, your style.</h1>
              <p className={cn("mt-1 max-w-lg text-sm", theme === "dark" ? "text-zinc-300" : "text-slate-600")}>
                Customize the display on your BMW trunk badge — choose a preset, upload your own design, or create a boot animation.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FeatureCard
              title="Instant face swap"
              body="Pick from preset designs or upload any image. Your badge updates wirelessly in seconds."
              theme={theme}
            />
            <FeatureCard
              title="Custom designs"
              body="Upload your own photo, crop it to fit the round display, adjust brightness and contrast, then send it over."
              theme={theme}
            />
            <FeatureCard
              title="Brightness control"
              body="Dial in the perfect brightness for day or night driving — changes apply instantly."
              theme={theme}
            />
            <FeatureCard
              title="Boot animations"
              body="Set a custom startup animation that plays every time your badge powers on. Import photos or GIFs, up to 20 frames."
              theme={theme}
            />
          </div>
        </section>

        <section className="order-1 flex flex-col items-center lg:order-2">
          <PhoneFrame theme={theme}>
            <div className="flex h-full flex-col">
              <div className={cn("flex items-center justify-center border-b px-4 pb-3 pt-9", theme === "dark" ? "border-zinc-900" : "border-slate-200")}>
                <StatusPill state={ble.connectionState} rssi={ble.rssi} name={ble.device?.name} />
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
            </div>
          </PhoneFrame>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({ title, body, theme }: { title: string; body: string; theme: "dark" | "light" }) {
  return (
    <div className={cn("rounded-2xl border p-4", theme === "dark" ? "border-zinc-800 bg-zinc-900/50" : "border-slate-200 bg-white/50")}>
      <p className={cn("text-sm font-semibold", theme === "dark" ? "text-white" : "text-slate-900")}>{title}</p>
      <p className={cn("mt-1.5 text-xs leading-relaxed", theme === "dark" ? "text-zinc-400" : "text-slate-600")}>{body}</p>
    </div>
  );
}
