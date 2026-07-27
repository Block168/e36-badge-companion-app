import { Bluetooth, BluetoothOff, RadioTower, Signal } from "lucide-react";
import type { BLEManagerApi } from "../hooks/useBLEManager";

export function ConnectScreen({ ble }: { ble: BLEManagerApi }) {
  const { connectionState, bluetoothPowered, toggleBluetoothPower, discovered, startScan, connect, device, rssi, disconnect } = ble;

  if (!bluetoothPowered) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <BluetoothOff className="h-12 w-12 text-zinc-500" />
        <h2 className="text-lg font-semibold text-white">Bluetooth is Off</h2>
        <p className="text-sm text-zinc-400">
          Turn on Bluetooth to scan for your badge. In the real app this state comes from
          <code className="mx-1 rounded bg-zinc-800 px-1.5 py-0.5 text-xs">CBManagerState.poweredOff</code>
          via <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">centralManagerDidUpdateState</code>.
        </p>
        <button
          onClick={toggleBluetoothPower}
          className="mt-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Turn Bluetooth On
        </button>
      </div>
    );
  }

  if (connectionState === "ready" && device) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500/10 ring-4 ring-emerald-500/20">
          <RadioTower className="h-12 w-12 text-emerald-400" />
          <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 ring-4 ring-zinc-950" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{device.name}</h2>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-zinc-400">
            <Signal className="h-3.5 w-3.5" /> {rssi} dBm · GATT ready
          </p>
        </div>
        <p className="max-w-xs text-xs text-zinc-500">
          Peripheral UUID cached locally for auto-reconnect via
          <code className="mx-1 rounded bg-zinc-800 px-1.5 py-0.5">retrievePeripherals(withIdentifiers:)</code>
          on next launch.
        </p>
        <button
          onClick={disconnect}
          className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (connectionState === "connecting" || connectionState === "discoveringServices") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <h2 className="text-lg font-semibold text-white">
          {connectionState === "connecting" ? "Connecting…" : "Discovering services…"}
        </h2>
        <p className="text-sm text-zinc-400">{device?.name ?? "E36-Badge"}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-6 py-8">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 ring-4 ring-blue-500/20">
          <Bluetooth className="h-7 w-7 text-blue-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">Find Your Badge</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Scans for peripherals advertising the badge's custom service UUID.
        </p>
      </div>

      <div className="mt-6 flex-1 space-y-2 overflow-y-auto">
        {connectionState === "scanning" && discovered.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <span className="text-sm text-zinc-400">Scanning nearby peripherals…</span>
          </div>
        )}
        {discovered.map((d) => (
          <button
            key={d.id}
            onClick={() => connect(d)}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 text-left transition hover:border-blue-500/50 hover:bg-zinc-900"
          >
            <div>
              <p className="text-sm font-medium text-white">{d.name}</p>
              <p className="text-xs text-zinc-500">{d.id.slice(0, 8)}…</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <Signal className="h-3.5 w-3.5" /> {d.rssi} dBm
            </span>
          </button>
        ))}
        {connectionState === "idle" && discovered.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
            Tap scan to search for a nearby badge over BLE.
          </div>
        )}
      </div>

      <button
        onClick={startScan}
        disabled={connectionState === "scanning"}
        className="mt-4 w-full rounded-full bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
      >
        {connectionState === "scanning" ? "Scanning…" : "Scan for Badge"}
      </button>
    </div>
  );
}
