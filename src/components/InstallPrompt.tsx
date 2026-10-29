import { useCallback, useEffect, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";
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

  // No PWA install over plain HTTP (e.g. when the badge serves the app itself).
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
    <section className={cn("mb-8", className)}>
      <div className="section-header">
        <span>Install</span>
        <button onClick={() => setDismissed(true)} className="link-btn min-h-0 text-[15px] normal-case" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="list-group">
        <div className="flex items-center gap-3 px-4 py-3">
          <img src="./icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-[12px]" />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">Add Faces to your Home Screen</p>
            <p className="text-[13px] text-label-2">Opens full screen and works offline, like a native app.</p>
          </div>
        </div>
        {deferred ? (
          <div className="px-4 pb-4">
            <button onClick={handleInstall} disabled={installing} className="btn-primary w-full">
              <Download className="h-5 w-5" />
              {installing ? "Installing…" : "Install App"}
            </button>
          </div>
        ) : ios ? (
          <ol className="border-t border-sep/60 px-4 py-3 text-[15px] text-label-2">
            <li className="flex min-h-10 items-center gap-3">
              <span className="w-4 text-label-3 tabular-nums">1</span>
              Tap <Share2 className="h-4 w-4 text-link" /> Share in Safari
            </li>
            <li className="flex min-h-10 items-center gap-3">
              <span className="w-4 text-label-3 tabular-nums">2</span>
              Choose <span className="text-label">Add to Home Screen</span>
            </li>
            <li className="flex min-h-10 items-center gap-3">
              <span className="w-4 text-label-3 tabular-nums">3</span>
              Tap <span className="text-label">Add</span>
            </li>
          </ol>
        ) : (
          <p className="flex items-start gap-3 border-t border-sep/60 px-4 py-3 text-[13px] text-label-2">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
            In Chrome or Edge, open the ⋮ menu and choose Add to Home Screen or Install App.
          </p>
        )}
      </div>
    </section>
  );
}
