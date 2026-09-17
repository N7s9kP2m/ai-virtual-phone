"use client";

import { useEffect, useLayoutEffect, type RefObject } from "react";

export function resizeComposerTextarea(element: HTMLTextAreaElement, limit = 160) {
    element.style.height = "auto";
    const style = getComputedStyle(element);
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const border = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    const contentHeight = element.scrollHeight + (style.boxSizing === "border-box" ? border : -padding);
    const maximum = Math.min(limit, parseFloat(style.maxHeight) || limit);
    element.style.height = `${Math.min(contentHeight, maximum)}px`;
    element.style.overflowY = contentHeight > maximum ? "auto" : "hidden";
}

/** Resize after React commits pasted/inserted text, and when the available width changes. */
export function useComposerAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
    useLayoutEffect(() => {
        if (ref.current) resizeComposerTextarea(ref.current);
    }, [ref, value]);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        let frame = 0;
        let width = -1;
        const resize = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => resizeComposerTextarea(element));
        };
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
            const nextWidth = element.getBoundingClientRect().width;
            if (Math.abs(nextWidth - width) < 0.5) return;
            width = nextWidth;
            resize();
        });
        observer?.observe(element);
        window.addEventListener("resize", resize);
        document.fonts?.addEventListener("loadingdone", resize);
        resize();
        return () => {
            observer?.disconnect();
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", resize);
            document.fonts?.removeEventListener("loadingdone", resize);
        };
    }, [ref]);
}
