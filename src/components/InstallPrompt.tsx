import { useCallback, useEffect, useState } from "react";
import { Download, MonitorSmartphone, Share2, Smartphone, X } from "lucide-react";
import { cn } from "../utils/cn";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ masquerades as a Mac.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallPrompt({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  // No PWA install over plain HTTP (e.g. when the badge serves the app over WiFi).
  if (typeof window !== "undefined" && window.isSecureContext === false) return null;

  const ios = isIOS();
  const standalone = isStandalone();

  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setDeferred(null);
      }
    } finally {
      setInstalling(false);
    }
  }, [deferred]);

  if (dismissed || standalone) return null;

  return (
    <div className={cn("card-track p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-m-blue-500 to-m-blue-700 text-white shadow-lg shadow-m-blue-900/40">
            <MonitorSmartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white">Install Faces</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {ios
                ? "Works offline, full screen, like a native app."
                : "Run it offline, full screen, like a native app."}
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {deferred ? (
        <button onClick={handleInstall} disabled={installing} className="btn-primary mt-4 w-full">
          <Download className="h-4 w-4" />
          {installing ? "Installing…" : "Add to Home Screen"}
        </button>
      ) : ios ? (
        <div className="mt-4 space-y-2 text-xs text-zinc-400">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            iOS install steps
          </p>
          <ol className="space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="chip border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">1</span>
              Tap the <Share2 className="mx-0.5 inline h-3.5 w-3.5 text-m-blue-400" /> Share button in Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="chip border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">2</span>
              Tap <span className="font-semibold text-zinc-200">Add to Home Screen</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="chip border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">3</span>
              Tap <span className="font-semibold text-zinc-200">Add</span> — done, it's on your home screen
            </li>
          </ol>
          <p className="pt-1 text-[11px] text-zinc-600">
            Keep this tab open until it says "Added". iOS installs instantly — no internet needed afterwards.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-800 bg-black/30 px-4 py-3 text-xs text-zinc-400">
          <Smartphone className="h-4 w-4 shrink-0 text-m-blue-400" />
          <p>
            In Chrome/Edge, tap the <span className="font-semibold text-zinc-200">⋮ menu → Add to Home Screen</span> or{" "}
            <span className="font-semibold text-zinc-200">Install App</span>. You'll get a one-tap install button here
            when it's available.
          </p>
        </div>
      )}
    </div>
  );
}
