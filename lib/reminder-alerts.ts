"use client";

/**
 * Shared between every in-app reminder watcher (medicatie, agenda,
 * weekplanning): a short alert sound and best-effort OS notification
 * permission, factored out once these existed in more than one watcher.
 */

/** Three ascending beeps via the Web Audio API — no audio asset to bundle/host. */
export function playAlertSound() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    [660, 880, 1046.5].forEach((freq, i) => {
      const start = now + i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // Audio can fail for all sorts of environment reasons (autoplay policy,
    // no audio hardware, ...) — the visible in-app banner is the reliable
    // fallback, so a sound failure here is never worth surfacing as an error.
  }
}

/** No-op if permission was already decided (granted/denied) or already asked. */
export function requestNotificationPermissionOnce() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
