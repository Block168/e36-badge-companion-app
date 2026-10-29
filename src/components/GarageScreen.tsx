import { useEffect, useState } from "react";
import {
  BatteryMedium,
  Cpu,
  Gauge,
  HardDrive,
  ListVideo,
  Moon,
  Sparkles,
  Square,
  Zap,
} from "lucide-react";
import { useBadge } from "../context/BadgeContext";
import { useAutomation, type LibraryItem } from "../context/AutomationContext";
import { BadgePreview } from "./BadgePreview";
import { BrightnessControl } from "./BrightnessControl";
import { InstallPrompt } from "./InstallPrompt";
import { Row, RowIcon, ScreenHeader, Section } from "./ui";
import { speedGaugeDataUrl } from "./LiveGauge";

/** Plays a saved animation's frames on the preview so "Now Playing" moves like the badge does. */
function useItemPreview(item: LibraryItem | undefined, kmh: number): string | null {
  const { loadFrames } = useAutomation();
  const [frames, setFrames] = useState<{ dataUrl: string; durationMs: number }[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setFrames([]);
    setIndex(0);
    if (item?.kind !== "animation") return;
    let cancelled = false;
    void loadFrames(item.meta.id).then((f) => !cancelled && setFrames(f));
    return () => {
      cancelled = true;
    };
  }, [item, loadFrames]);

  useEffect(() => {
    if (frames.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % frames.length), Math.max(50, frames[index].durationMs));
    return () => clearTimeout(t);
  }, [frames, index]);

  if (!item) return null;
  if (item.kind === "live") return speedGaugeDataUrl(kmh, false);
  if (item.kind === "animation") return frames[index]?.dataUrl ?? item.thumb;
  return item.dataUrl;
}

export function GarageScreen() {
  const { connectionState, isSimulated, badgeInfo, brightness, connect, connectDemo, disconnect } = useBadge();
  const { nowPlaying, itemById, playlistRun, playlists, stopPlaylist, activeTriggerId, triggers, nightActive, speed } = useAutomation();
  const connected = connectionState === "connected";
  const connecting = connectionState === "connecting";

  const playingItem = nowPlaying ? itemById(nowPlaying.itemId) : undefined;
  const preview = useItemPreview(playingItem, speed.kmh);
  const runningPlaylist = playlistRun ? playlists.find((p) => p.id === playlistRun.playlistId) : undefined;
  const activeTrigger = activeTriggerId ? triggers.find((t) => t.id === activeTriggerId) : undefined;
  const usedPct = badgeInfo ? Math.round((badgeInfo.usedStorageKb / badgeInfo.totalStorageKb) * 100) : 0;

  if (!connected) {
    return (
      <div>
        <ScreenHeader title="Garage" subtitle={connecting ? "Looking for your badge…" : "No badge linked"} />
        <div className="mb-8 flex justify-center">
          <BadgePreview faceUrl={null} brightness={0} scanning size={240} className="w-full max-w-[240px]" />
        </div>

        <div className="mb-8 flex flex-col items-center gap-2">
          <button onClick={connect} disabled={connecting} className="btn-primary w-full">
            {connecting ? "Connecting…" : "Connect"}
          </button>
          <button onClick={connectDemo} disabled={connecting} className="link-btn text-label-2">
            <Sparkles className="h-4 w-4" />
            Try Demo Mode
          </button>
        </div>

        <Section title="How to connect">
          {[
            "Turn on your badge.",
            <>
              In your phone's settings, join <span className="whitespace-nowrap">E36-Badge</span>.
            </>,
            "Come back here and tap Connect.",
          ].map((step, i) => (
            <Row
              key={i}
              icon={
                <RowIcon>
                  <span className="text-[13px] font-semibold tabular-nums">{i + 1}</span>
                </RowIcon>
              }
              title={<span className="whitespace-normal">{step}</span>}
            />
          ))}
        </Section>

        <InstallPrompt />
      </div>
    );
  }

  const sourceLabel = runningPlaylist
    ? `Playlist · ${runningPlaylist.name}`
    : activeTrigger
      ? `Trigger · ${activeTrigger.name}`
      : nowPlaying?.source === "boot"
        ? "Boot display"
        : nowPlaying
          ? "Played from Library"
          : "Pick something in Library";

  return (
    <div>
      <ScreenHeader
        title="Garage"
        subtitle={badgeInfo?.name}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-label-2">
            <span className="h-2 w-2 rounded-full bg-go" />
            {isSimulated ? "Demo" : "Connected"}
          </span>
        }
      />

      <div className="mb-6 flex justify-center">
        <BadgePreview faceUrl={preview} brightness={brightness} connected size={260} className="w-full max-w-[260px]" />
      </div>

      <div className="mb-8 text-center">
        <p className="text-[13px] text-label-2 uppercase">Now Playing</p>
        <p className="mt-1 truncate text-[22px] leading-tight font-bold">{playingItem?.name ?? "Nothing yet"}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-[15px] text-label-2">
          {runningPlaylist && <ListVideo className="h-4 w-4" />}
          {activeTrigger && <Zap className="h-4 w-4 text-warn" />}
          {sourceLabel}
        </p>
        {runningPlaylist && (
          <div className="mt-4">
            <button onClick={stopPlaylist} className="btn-secondary">
              <Square className="h-4 w-4" />
              Stop Playlist
            </button>
          </div>
        )}
      </div>

      <Section title="Display" footer={nightActive ? "Night Mode is dimming the badge right now." : undefined}>
        <BrightnessControl />
        {nightActive && (
          <Row
            icon={
              <RowIcon color="bg-night">
                <Moon className="h-4 w-4" />
              </RowIcon>
            }
            title="Night Mode"
            detail="On"
          />
        )}
      </Section>

      <Section title="Badge" footer={isSimulated ? "Demo Mode simulates a badge so you can explore every feature." : undefined}>
        <Row
          icon={
            <RowIcon color="bg-go">
              <BatteryMedium className="h-4 w-4" />
            </RowIcon>
          }
          title="Battery"
          detail={`${badgeInfo?.batteryPercent ?? 0}%`}
        />
        <Row
          icon={
            <RowIcon color="bg-link">
              <HardDrive className="h-4 w-4" />
            </RowIcon>
          }
          title="Storage"
          detail={`${usedPct}% used`}
        />
        <Row
          icon={
            <RowIcon>
              <Cpu className="h-4 w-4" />
            </RowIcon>
          }
          title="Firmware"
          detail={`v${badgeInfo?.firmwareVersion ?? "—"} · ${badgeInfo?.hardwareRevision ?? ""}`}
        />
        <Row
          icon={
            <RowIcon color="bg-warn">
              <Gauge className="h-4 w-4" />
            </RowIcon>
          }
          title="Ground speed"
          detail={speed.live ? `${Math.round(speed.kmh)} km/h` : "GPS unavailable"}
        />
      </Section>

      <Section>
        <Row title="Disconnect" destructive onClick={disconnect} />
      </Section>
    </div>
  );
}
