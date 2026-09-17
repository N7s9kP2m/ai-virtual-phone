"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { isPwaKeyboardField } from "@/lib/pwa-display-mode";

/** Android browsers can restore a tab before updating their CSS viewport units. */
export function MobileViewportController() {
  const availableFraction = useRef(0.6);
  const drag = useRef<{ pointerId: number; y: number; fraction: number } | null>(null);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("float-keyboard-available-fraction"));
      if (saved >= 0.3 && saved <= 0.8) availableFraction.current = saved;
    } catch { /* Storage may be disabled. */ }
    const root = document.documentElement;
    const media = window.matchMedia("(max-width: 768px), (pointer: coarse) and (max-width: 1024px), (hover: none) and (max-width: 1024px)");
    const viewport = window.visualViewport;
    let frame = 0;
    let timers: number[] = [];
    let focusTimer = 0;
    let focusedAt = 0;
    let baselineHeight = window.innerHeight;
    let sawKeyboard = false;
    const keyboard = (navigator as Navigator & { virtualKeyboard?: EventTarget & {
      boundingRect: DOMRectReadOnly; overlaysContent: boolean;
    } }).virtualKeyboard;
    const previousOverlay = keyboard?.overlaysContent;
    // Report keyboard geometry even when fullscreen leaves both viewports unchanged.
    if (keyboard) keyboard.overlaysContent = true;

    const measure = () => {
      frame = 0;
      if (!media.matches && !root.classList.contains("is-mobile-device")) {
        root.style.removeProperty("--mobile-viewport-height");
        return;
      }
      // Pinch zoom must not resize the app; visualViewport also includes keyboard occlusion.
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      let height = Math.min(window.innerHeight, viewport?.height ?? window.innerHeight);
      const active = document.activeElement;
      const composing = isPwaKeyboardField(active) && active?.closest(".chat-input-bar, .story-composer, .mix-game-inputbar");
      const keyboardRect = keyboard?.boundingRect;
      const actualKeyboard = Boolean(keyboardRect && keyboardRect.height > 0);
      if (actualKeyboard) height = Math.min(height, Math.max(1, keyboardRect!.top));
      const shrunk = baselineHeight - height > 80;
      if (composing && (actualKeyboard || shrunk)) sawKeyboard = true;
      // Some fullscreen browsers expose neither viewport resizing nor keyboard geometry.
      // Reserve space only for the three composers, after the keyboard animation settles.
      const fallback = composing && document.fullscreenElement && !keyboard && !shrunk &&
        !sawKeyboard && focusedAt > 0 && Date.now() - focusedAt >= 350;
      // Let users calibrate unreported keyboards instead of guessing their height.
      if (fallback) height = Math.round(baselineHeight * availableFraction.current);
      root.dataset.keyboardEstimated = fallback ? "true" : "false";
      if (height > 0) root.style.setProperty("--mobile-viewport-height", `${height}px`);
    };
    const scheduleMeasure = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const recover = () => {
      if (document.visibilityState === "hidden") return;
      timers.forEach(window.clearTimeout);
      // Reset only document scrolling; conversation and desktop scroll positions are preserved.
      if (media.matches || root.classList.contains("is-mobile-device")) {
        window.scrollTo(0, 0);
      }
      measure();
      // Firefox can restore browser chrome and its viewport several seconds after resuming.
      // Recheck even when it omits a resize event; don't reset scrolling during input/zoom.
      timers = [100, 300, 1000, 2000, 3000, 5000].map(delay => window.setTimeout(() => {
        if (document.visibilityState === "hidden") return;
        const active = document.activeElement;
        const editing = active instanceof HTMLElement &&
          (active.matches("input, textarea, select") || active.isContentEditable);
        if (!editing && (!viewport || Math.abs(viewport.scale - 1) <= 0.01) &&
          (media.matches || root.classList.contains("is-mobile-device"))) {
          window.scrollTo(0, 0);
        }
        scheduleMeasure();
      }, delay));
    };

    const prepareKeyboard = () => {
      baselineHeight = Math.max(window.innerHeight, viewport?.height ?? 0);
      focusedAt = Date.now();
      sawKeyboard = false;
      window.clearTimeout(focusTimer);
      scheduleMeasure();
      focusTimer = window.setTimeout(scheduleMeasure, 400);
    };
    const releaseKeyboard = () => {
      focusedAt = 0;
      sawKeyboard = false;
      window.clearTimeout(focusTimer);
      scheduleMeasure();
    };
    const dismissEstimatedKeyboard = (event: Event) => {
      if (root.dataset.keyboardEstimated !== "true") return;
      const target = event.target;
      if (target instanceof Element && !target.closest(".chat-input-bar, .story-composer, .mix-game-inputbar, .keyboard-position-handle")) {
        const active = document.activeElement;
        if (active instanceof HTMLElement && isPwaKeyboardField(active)) active.blur();
      }
    };

    recover();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("float-keyboard-position-change", scheduleMeasure);
    window.addEventListener("orientationchange", recover);
    window.addEventListener("pageshow", recover);
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    document.addEventListener("fullscreenchange", recover);
    document.addEventListener("pointerdown", dismissEstimatedKeyboard, true);
    document.addEventListener("focusin", prepareKeyboard, true);
    document.addEventListener("focusout", releaseKeyboard);
    keyboard?.addEventListener("geometrychange", scheduleMeasure);
    viewport?.addEventListener("resize", scheduleMeasure);
    viewport?.addEventListener("scroll", scheduleMeasure);
    media.addEventListener("change", scheduleMeasure);
    return () => {
      window.clearTimeout(focusTimer);
      delete root.dataset.keyboardEstimated;
      keyboard?.removeEventListener("geometrychange", scheduleMeasure);
      if (keyboard && previousOverlay !== undefined) keyboard.overlaysContent = previousOverlay;
      if (frame) window.cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("float-keyboard-position-change", scheduleMeasure);
      window.removeEventListener("orientationchange", recover);
      window.removeEventListener("pageshow", recover);
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      document.removeEventListener("fullscreenchange", recover);
      document.removeEventListener("pointerdown", dismissEstimatedKeyboard, true);
      document.removeEventListener("focusin", prepareKeyboard, true);
      document.removeEventListener("focusout", releaseKeyboard);
      viewport?.removeEventListener("resize", scheduleMeasure);
      viewport?.removeEventListener("scroll", scheduleMeasure);
      media.removeEventListener("change", scheduleMeasure);
      root.style.removeProperty("--mobile-viewport-height");
    };
  }, []);
  const moveHandle = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    availableFraction.current = Math.max(0.3, Math.min(0.8,
      start.fraction + (event.clientY - start.y) / window.innerHeight));
    window.dispatchEvent(new Event("float-keyboard-position-change"));
  };
  const savePosition = () => {
    if (!drag.current) return;
    drag.current = null;
    try { localStorage.setItem("float-keyboard-available-fraction", String(availableFraction.current)); } catch {}
  };
  return <>
    <style>{`
      .keyboard-position-handle { display: none; }
      html[data-keyboard-estimated="true"] .keyboard-position-handle { display: block; }
    `}</style>
    <button type="button" className="keyboard-position-handle" aria-label="上下拖动调整输入区位置"
      style={{ position: "fixed", top: "calc(var(--mobile-viewport-height) - 26px)", right: 8,
        zIndex: 2147483647, height: 24, padding: "2px 8px", borderRadius: 12,
        border: "1px solid #aaa6", background: "#f4f4f4", color: "#555", fontSize: 11,
        touchAction: "none", userSelect: "none" }}
      onPointerDown={event => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, y: event.clientY, fraction: availableFraction.current };
      }}
      onPointerMove={moveHandle} onPointerUp={savePosition}
      onPointerCancel={savePosition} onLostPointerCapture={savePosition}
    >↕ 调整位置</button>
  </>;
}
