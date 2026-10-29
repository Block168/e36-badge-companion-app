import { useState } from "react";
import { Check, History, Moon, Power } from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { useAutomation } from "../context/AutomationContext";
import { BrightnessControl } from "./BrightnessControl";
import { HistoryPanel } from "./HistoryPanel";
import { InstallPrompt } from "./InstallPrompt";
import { Row, RowIcon, ScreenHeader, Section, Sheet, Thumb, Toggle } from "./ui";

type View = "root" | "history";

function BootSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { connectionState } = useBadge();
  const { items, bootItemId, setBootItem } = useAutomation();
  const connected = connectionState === "connected";
  return (
    <Sheet open={open} onClose={onClose} title="Boot Display">
      <Section
        footer={
          connected
            ? "Choosing an item sends it to the badge and saves it as what shows on power-up."
            : "Connect a badge in Garage to change the boot display."
        }
      >
        {items.map((item) => (
          <Row
            key={item.id}
            icon={<Thumb src={item.thumb} size={36} />}
            title={item.name}
            accessory={bootItemId === item.id ? <Check className="h-5 w-5 text-go" strokeWidth={2.6} /> : undefined}
            disabled={!connected}
            onClick={async () => {
              if (await setBootItem(item.id)) onClose();
            }}
          />
        ))}
      </Section>
    </Sheet>
  );
}

export function SettingsScreen() {
  const { history } = useBadge();
  const { nightMode, setNightMode, nightActive, bootItemId, itemById } = useAutomation();
  const [view, setView] = useState<View>("root");
  const [bootOpen, setBootOpen] = useState(false);
  const bootItem = bootItemId ? itemById(bootItemId) : undefined;

  const go = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  if (view === "history") return <HistoryPanel onBack={() => go("root")} />;

  return (
    <div>
      <ScreenHeader title="Settings" />

      <Section title="Display" footer="Changes are written to the badge when you let go of the slider.">
        <BrightnessControl presets />
      </Section>

      <Section
        title="Night Mode"
        footer={
          nightMode.enabled
            ? nightActive
              ? `Active now — the badge is dimmed to ${nightMode.level}%.`
              : `Dims the badge to ${nightMode.level}% from ${nightMode.start} to ${nightMode.end}, then restores your brightness.`
            : "Automatically dim the badge after dark."
        }
      >
        <Row
          icon={
            <RowIcon color="bg-night">
              <Moon className="h-4 w-4" />
            </RowIcon>
          }
          title="Night Mode"
          accessory={<Toggle checked={nightMode.enabled} onChange={(enabled) => setNightMode({ ...nightMode, enabled })} label="Night Mode" />}
        />
        {nightMode.enabled && (
          <>
            <div className="list-row">
              <div className="list-row-body flex-col items-stretch gap-1">
                <span className="flex justify-between text-[16px] sm:text-[15px]">
                  Night brightness <span className="text-label-2 tabular-nums">{nightMode.level}%</span>
                </span>
                <input
                  type="range"
                  min={5}
                  max={60}
                  value={nightMode.level}
                  onChange={(e) => setNightMode({ ...nightMode, level: Number(e.target.value) })}
                  aria-label="Night brightness"
                  className="slider-track"
                  style={{ ["--fill" as string]: `${((nightMode.level - 5) / 55) * 100}%` }}
                />
              </div>
            </div>
            <Row
              title="From"
              accessory={
                <input
                  type="time"
                  value={nightMode.start}
                  onChange={(e) => setNightMode({ ...nightMode, start: e.target.value })}
                  aria-label="Night Mode start"
                  className="field min-h-9 w-auto"
                />
              }
            />
            <Row
              title="Until"
              accessory={
                <input
                  type="time"
                  value={nightMode.end}
                  onChange={(e) => setNightMode({ ...nightMode, end: e.target.value })}
                  aria-label="Night Mode end"
                  className="field min-h-9 w-auto"
                />
              }
            />
          </>
        )}
      </Section>

      <Section title="Startup" footer="Over WiFi the badge shows this when it powers on. Anything you play by hand from Library becomes the new boot display.">
        <Row
          icon={
            <RowIcon color="bg-go">
              <Power className="h-4 w-4" />
            </RowIcon>
          }
          title="Boot Display"
          detail={bootItem?.name ?? "Not set"}
          chevron
          onClick={() => setBootOpen(true)}
        />
      </Section>

      <Section title="Activity">
        <Row
          icon={
            <RowIcon color="bg-link">
              <History className="h-4 w-4" />
            </RowIcon>
          }
          title="Transfer History"
          detail={history.length}
          chevron
          onClick={() => go("history")}
        />
      </Section>

      <InstallPrompt />

      <p className="pb-4 text-center text-[13px] text-label-3">Faces · Made for the E36 badge</p>

      <BootSheet open={bootOpen} onClose={() => setBootOpen(false)} />
    </div>
  );
}
