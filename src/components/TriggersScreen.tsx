import { useState } from "react";
import { Check, Clock, Gauge, Zap } from "lucide-react";
import { useAutomation } from "../context/AutomationContext";
import { EmptyState, Row, RowIcon, ScreenHeader, Section, Segmented, Sheet, Thumb, Toggle } from "./ui";
import { describeCondition, type Trigger, type TriggerCondition } from "../lib/library";

function newTrigger(kind: TriggerCondition["kind"], itemId: string): Trigger {
  return {
    id: crypto.randomUUID(),
    name: kind === "speed" ? "Fast" : "Evening",
    enabled: true,
    condition: kind === "speed" ? { kind: "speed", aboveKmh: 80 } : { kind: "time", start: "18:00", end: "22:00" },
    itemId,
  };
}

function TriggerSheet({ draft, isNew, onClose }: { draft: Trigger | null; isNew: boolean; onClose: () => void }) {
  const { items, upsertTrigger, deleteTrigger } = useAutomation();
  const [t, setT] = useState<Trigger | null>(draft);
  // Re-seed when a different trigger is opened.
  const [seed, setSeed] = useState(draft?.id);
  if (draft?.id !== seed) {
    setSeed(draft?.id);
    setT(draft);
  }
  if (!t) return null;

  const c = t.condition;
  const save = () => {
    upsertTrigger({ ...t, name: t.name.trim() || "Trigger" });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "New Trigger" : "Edit Trigger"}
      trailing={
        <button onClick={save} className="link-btn font-semibold">
          {isNew ? "Add" : "Done"}
        </button>
      }
    >
      <Section>
        <div className="px-4 py-2">
          <input
            value={t.name}
            onChange={(e) => setT({ ...t, name: e.target.value })}
            placeholder="Name"
            aria-label="Trigger name"
            enterKeyHint="done"
            className="min-h-10 w-full bg-transparent text-[16px] outline-none placeholder:text-label-3"
          />
        </div>
      </Section>

      {isNew && (
        <Segmented
          className="mb-8"
          value={c.kind}
          onChange={(kind) => setT({ ...t, condition: newTrigger(kind, t.itemId).condition, name: newTrigger(kind, t.itemId).name })}
          options={[
            { id: "speed", label: "Speed" },
            { id: "time", label: "Time" },
          ]}
        />
      )}

      {c.kind === "speed" ? (
        <Section title="When" footer="Speed has to stay above the line for 3 seconds, so a quick blip won't switch the badge.">
          <div className="px-4 pt-3 pb-4">
            <p className="text-[15px]">
              Above <span className="font-semibold tabular-nums">{c.aboveKmh} km/h</span>
            </p>
            <input
              type="range"
              min={10}
              max={250}
              step={5}
              value={c.aboveKmh}
              onChange={(e) => setT({ ...t, condition: { kind: "speed", aboveKmh: Number(e.target.value) } })}
              aria-label="Speed threshold"
              className="slider-track mt-2"
              style={{ ["--fill" as string]: `${((c.aboveKmh - 10) / 240) * 100}%` }}
            />
          </div>
        </Section>
      ) : (
        <Section title="When">
          <Row
            title="From"
            accessory={
              <input
                type="time"
                value={c.start}
                onChange={(e) => setT({ ...t, condition: { ...c, start: e.target.value } })}
                aria-label="Start time"
                className="field min-h-9 w-auto"
              />
            }
          />
          <Row
            title="Until"
            accessory={
              <input
                type="time"
                value={c.end}
                onChange={(e) => setT({ ...t, condition: { ...c, end: e.target.value } })}
                aria-label="End time"
                className="field min-h-9 w-auto"
              />
            }
          />
        </Section>
      )}

      <Section title="Play">
        {items.map((item) => (
          <Row
            key={item.id}
            icon={<Thumb src={item.thumb} size={36} />}
            title={item.name}
            accessory={t.itemId === item.id ? <Check className="h-5 w-5 text-go" strokeWidth={2.6} /> : undefined}
            onClick={() => setT({ ...t, itemId: item.id })}
          />
        ))}
      </Section>

      {!isNew && (
        <Section>
          <Row
            title="Delete Trigger"
            destructive
            onClick={() => {
              deleteTrigger(t.id);
              onClose();
            }}
          />
        </Section>
      )}
    </Sheet>
  );
}

function TriggerRows({ list, activeId }: { list: Trigger[]; activeId: string | null }) {
  const { itemById, upsertTrigger } = useAutomation();
  const [editing, setEditing] = useState<Trigger | null>(null);
  return (
    <>
      {list.map((t) => (
        <Row
          key={t.id}
          title={
            <span className="inline-flex items-center gap-2">
              {t.name}
              {t.id === activeId && <span className="h-2 w-2 rounded-full bg-go" aria-label="Active" />}
            </span>
          }
          subtitle={`${describeCondition(t.condition)} → Play ${itemById(t.itemId)?.name ?? "missing item"}`}
          accessory={<Toggle checked={t.enabled} onChange={(enabled) => upsertTrigger({ ...t, enabled })} label={`${t.name} enabled`} />}
          onClick={() => setEditing(t)}
        />
      ))}
      <TriggerSheet draft={editing} isNew={false} onClose={() => setEditing(null)} />
    </>
  );
}

export function TriggersScreen() {
  const { triggers, items, activeTriggerId, speed } = useAutomation();
  const [creating, setCreating] = useState<Trigger | null>(null);
  const speedTriggers = triggers.filter((t) => t.condition.kind === "speed");
  const timeTriggers = triggers.filter((t) => t.condition.kind === "time");
  const fallbackItem = items.find((i) => i.kind !== "live")?.id ?? items[0]?.id ?? "";

  const add = (kind: TriggerCondition["kind"]) => setCreating(newTrigger(kind, fallbackItem));
  const addLink = (kind: TriggerCondition["kind"]) => (
    <button onClick={() => add(kind)} className="link-btn min-h-0 text-[15px]">
      Add Trigger
    </button>
  );

  return (
    <div>
      <ScreenHeader
        title="Triggers"
        subtitle="Let the badge react to your drive."
        actions={
          <button onClick={() => add("speed")} className="btn-icon" aria-label="Add trigger">
            <Zap className="h-5 w-5" />
          </button>
        }
      />

      {triggers.length === 0 ? (
        <>
          <div className="list-group mb-8">
            <EmptyState
              icon={<Zap className="h-6 w-6" />}
              title="No triggers yet"
              body="Switch to a different face when you pass a speed, or at a time of day."
            />
          </div>
          <Section>
            <Row
              icon={
                <RowIcon color="bg-warn">
                  <Gauge className="h-4 w-4" />
                </RowIcon>
              }
              title="Speed Trigger"
              subtitle="Play something above a speed"
              chevron
              onClick={() => add("speed")}
            />
            <Row
              icon={
                <RowIcon color="bg-link">
                  <Clock className="h-4 w-4" />
                </RowIcon>
              }
              title="Time Trigger"
              subtitle="Play something during set hours"
              chevron
              onClick={() => add("time")}
            />
          </Section>
        </>
      ) : (
        <>
          <Section
            title="Speed Triggers"
            action={addLink("speed")}
            footer={
              speedTriggers.length > 0 && !speed.live ? (
                <span className="text-warn">Waiting for GPS — speed triggers stay off until your phone reports a real speed.</span>
              ) : undefined
            }
          >
            {speedTriggers.length === 0 ? <Row title={<span className="text-label-2">No speed triggers</span>} /> : <TriggerRows list={speedTriggers} activeId={activeTriggerId} />}
          </Section>

          <Section title="Time Triggers" action={addLink("time")}>
            {timeTriggers.length === 0 ? <Row title={<span className="text-label-2">No time triggers</span>} /> : <TriggerRows list={timeTriggers} activeId={activeTriggerId} />}
          </Section>

          <p className="section-footer -mt-4">
            Triggers run from your phone while the app is open. Speed triggers are checked first and the first match wins. When none
            match, a running playlist picks up again.
          </p>
        </>
      )}

      <TriggerSheet draft={creating} isNew onClose={() => setCreating(null)} />
    </div>
  );
}
