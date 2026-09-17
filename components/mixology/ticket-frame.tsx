"use client";

// 独家特调 · 小票渲染画布：小票材料的 renderHtml 在沙盒 iframe 里执行，
// AI 的 [状态栏] 壳内原文通过 window.TICKET_RAW（JS 取用）与 {{RAW}}（模板直插，已转义）注入。
// 高度自适应桥与自定义状态栏同款；allow-scripts 无 same-origin，碰不到宿主页面与数据。

import { useEffect, useMemo, useRef, useState } from "react";
import type { MixState } from "@/lib/mixology/types";
import { buildMixFrameBridge } from "@/lib/mixology/frame-bridge";
import { createMixFrameHeightTracker, nextMixFrameHeight } from "@/lib/mixology/frame-height";
import { buildMixTicketDoc } from "@/lib/mixology/ticket-doc";

const FRAME_MIN_HEIGHT = 36;
/**
 * 小票与尾调也是 scrolling="no"，超出即截断。它们每轮插在对话流里，
 * 不该像开场画布那样动辄十几屏，所以余量给得小一档：原来 2000（约两屏），
 * 一个稍微复杂的小剧场就顶到头，放宽到 5000（约五屏半）。
 */
const FRAME_MAX_HEIGHT = 5000;

export function MixTicketFrame({ html, raw, state }: { html: string; raw: string; state?: MixState }) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [frameId] = useState(() => `mtf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const [height, setHeight] = useState(FRAME_MIN_HEIGHT);
    const trackerRef = useRef(createMixFrameHeightTracker(FRAME_MIN_HEIGHT));

    const srcDoc = useMemo(() => {
        const doc = buildMixTicketDoc(html, raw, state);
        const bridge = buildMixFrameBridge("mix-ticket-frame", frameId, FRAME_MIN_HEIGHT);
        return /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${bridge}</body>`) : doc + bridge;
    }, [html, raw, state, frameId]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
            const data = event.data as Record<string, unknown> | null;
            if (!data || data.source !== "mix-ticket-frame" || data.type !== "resize" || data.id !== frameId) return;
            const applied = nextMixFrameHeight(trackerRef.current, Number(data.height), {
                min: FRAME_MIN_HEIGHT,
                max: FRAME_MAX_HEIGHT,
            });
            if (applied !== null) setHeight(applied);
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [frameId]);

    return (
        <iframe
            ref={iframeRef}
            title="小票"
            sandbox="allow-scripts"
            scrolling="no"
            srcDoc={srcDoc}
            style={{ width: "100%", height, border: 0, display: "block", background: "transparent" }}
        />
    );
}
