"use client";

import { useEffect } from "react";

/** Android browsers can restore a tab before updating their CSS viewport units. */
export function MobileViewportController() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(max-width: 768px), (pointer: coarse) and (max-width: 1024px), (hover: none) and (max-width: 1024px)");
    const viewport = window.visualViewport;
    let frame = 0;
    let timers: number[] = [];

    const measure = () => {
      frame = 0;
      if (!media.matches && !root.classList.contains("is-mobile-device")) {
        root.style.removeProperty("--mobile-viewport-height");
        return;
      }
      // Pinch zoom must not resize the app; visualViewport also includes keyboard occlusion.
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      const height = Math.min(window.innerHeight, viewport?.height ?? window.innerHeight);
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

    recover();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", recover);
    window.addEventListener("pageshow", recover);
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    document.addEventListener("fullscreenchange", recover);
    viewport?.addEventListener("resize", scheduleMeasure);
    viewport?.addEventListener("scroll", scheduleMeasure);
    media.addEventListener("change", scheduleMeasure);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", recover);
      window.removeEventListener("pageshow", recover);
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      document.removeEventListener("fullscreenchange", recover);
      viewport?.removeEventListener("resize", scheduleMeasure);
      viewport?.removeEventListener("scroll", scheduleMeasure);
      media.removeEventListener("change", scheduleMeasure);
      root.style.removeProperty("--mobile-viewport-height");
    };
  }, []);
  return null;
}
