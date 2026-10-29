import { DISPLAY_HEIGHT, DISPLAY_WIDTH, MAX_ANIMATION_FRAMES } from "./protocol";
import type { BadgeInfo } from "../types";

/** One 480×480 RGB565 frame. */
export const FACE_BYTES = DISPLAY_WIDTH * DISPLAY_HEIGHT * 2;
/** u16 frame count + u32 frame size, ahead of the raw frames. */
export const ANIM_HEADER_BYTES = 6;
/** Largest upload the firmware accepts (a full 20-frame animation). */
export const MAX_UPLOAD_BYTES = ANIM_HEADER_BYTES + MAX_ANIMATION_FRAMES * FACE_BYTES;

export type StorageSlot = "face" | "animation";

/** A transfer the badge can't take; `message` is safe to show to the user. */
export class BadgeStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadgeStorageError";
  }
}

export const animationBytes = (frames: number) => ANIM_HEADER_BYTES + frames * FACE_BYTES;

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

/**
 * Bytes available for an upload into `slot`. The slot's current file is
 * replaced, so it counts as free. Null when the badge doesn't report its
 * per-slot usage (older firmware) and only the format limits can be checked.
 */
export function slotCapacityBytes(info: BadgeInfo | null, slot: StorageSlot): number | null {
  if (!info || info.faceFileBytes === undefined || info.animFileBytes === undefined) return null;
  const free = Math.max(0, (info.totalStorageKb - info.usedStorageKb) * 1024);
  // Mirror the firmware's 16 KB headroom for filesystem metadata.
  return Math.max(0, free + (slot === "face" ? info.faceFileBytes : info.animFileBytes) - 16384);
}

/** How many animation frames fit on the badge right now. */
export function maxFramesThatFit(info: BadgeInfo | null): number {
  const cap = slotCapacityBytes(info, "animation");
  if (cap === null) return MAX_ANIMATION_FRAMES;
  return Math.max(0, Math.min(MAX_ANIMATION_FRAMES, Math.floor((cap - ANIM_HEADER_BYTES) / FACE_BYTES)));
}

/** Throws a BadgeStorageError when `bytes` can't be stored in `slot`. */
export function assertFits(info: BadgeInfo | null, slot: StorageSlot, bytes: number): void {
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new BadgeStorageError(`Animations can have at most ${MAX_ANIMATION_FRAMES} frames`);
  }
  const cap = slotCapacityBytes(info, slot);
  if (cap !== null && bytes > cap) {
    if (slot === "animation") {
      const fit = maxFramesThatFit(info);
      throw new BadgeStorageError(
        fit > 0
          ? `Not enough space on the badge — ${fit} frame${fit === 1 ? "" : "s"} fit, this has ${Math.round((bytes - ANIM_HEADER_BYTES) / FACE_BYTES)}`
          : `Badge storage is full (${mb(cap)} free) — no room for an animation`,
      );
    }
    throw new BadgeStorageError(`Badge storage is full — needs ${mb(bytes)}, ${mb(cap)} free`);
  }
}

/** Turns a firmware error reason into a message for the user. */
export function describeUploadError(status: number, reason: string | undefined): string | null {
  if (reason === "not enough storage" || status === 507) return "Not enough space on the badge for this";
  if (reason === "too large" || status === 413) return "That's too big for the badge to accept";
  if (reason === "invalid size") return "The badge rejected the file as the wrong size";
  return null;
}
