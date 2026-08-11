// E36 Badge BLE protocol constants.
// These are custom 128-bit UUIDs used by the (hypothetical) E36 badge firmware.

export const E36_SERVICE_UUID = "4e360001-b5a3-f393-e0a9-e50e24dcca9e";

export const E36_CHARACTERISTICS = {
  DEVICE_INFO: "4e360002-b5a3-f393-e0a9-e50e24dcca9e",
  BRIGHTNESS: "4e360003-b5a3-f393-e0a9-e50e24dcca9e",
  FACE_TRANSFER: "4e360004-b5a3-f393-e0a9-e50e24dcca9e",
  ANIMATION_TRANSFER: "4e360005-b5a3-f393-e0a9-e50e24dcca9e",
  BATTERY_STATUS: "4e360006-b5a3-f393-e0a9-e50e24dcca9e",
} as const;

export const CHARACTERISTIC_LABELS: Record<string, string> = {
  [E36_CHARACTERISTICS.DEVICE_INFO]: "Device Info",
  [E36_CHARACTERISTICS.BRIGHTNESS]: "Brightness",
  [E36_CHARACTERISTICS.FACE_TRANSFER]: "Face Transfer",
  [E36_CHARACTERISTICS.ANIMATION_TRANSFER]: "Animation Transfer",
  [E36_CHARACTERISTICS.BATTERY_STATUS]: "Battery Status",
};

// Typical BLE 4.2/5.0 ATT_MTU payload after header overhead.
export const BLE_CHUNK_SIZE = 180;

export const DISPLAY_WIDTH = 480;
export const DISPLAY_HEIGHT = 480;
export const MAX_ANIMATION_FRAMES = 20;

export const DEVICE_NAME_PREFIX = "E36";
