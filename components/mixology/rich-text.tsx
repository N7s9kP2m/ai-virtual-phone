"use client";

// 独家特调 · 富文本渲染：作者的话 / 开场白——写了 HTML 标签就进沙盒 iframe
//（透明底，浮在封面蒙版上，版面完全交给作者），纯文本按原样展示。
// 高度自适应桥与小票画布同款；allow-scripts 无 same-origin，碰不到宿主页面与数据。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildMixFrameBridge } from "@/lib/mixology/frame-bridge";
import { createMixFrameHeightTracker, nextMixFrameHeight } from "@/lib/mixology/frame-height";
import { buildMixRichDialogueBridge } from "@/lib/mixology/rich-dialogue";
import type { MixProseDialogue } from "./prose-view";

/** 是否含 HTML 标签：含则按作者排版渲染，纯文本走默认样式 */
export function mixTextHasHtml(text: string): boolean {
    return /<\/?[a-z][^>]*>/i.test(text);
}

const FRAME_MIN_HEIGHT = 24;
/**
 * 高度上限。iframe 是 scrolling="no"，高度必须等于内容高度，超出的部分会被直接切掉，
 * 所以这个数就是「开场画布最多能有多高」。原来给 2400（约两屏半），复杂的画布——
 * 多章节、满幅大图、人物关系列表——很容易超过，底下那截在 App 里根本看不到。
 * 放宽到 12000（约十三屏）。仍然留一个上限：万一画布报了个荒谬的数（脚本写错、
 * 死循环撑高），别让宿主去布局一个几十万像素高的元素。
 */
const FRAME_MAX_HEIGHT = 12000;

function RichFrame({ html, inert, dialogue }: { html: string; inert?: boolean; dialogue?: MixProseDialogue }) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [frameId] = useState(() => `mrf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const [height, setHeight] = useState(FRAME_MIN_HEIGHT);
    const trackerRef = useRef(createMixFrameHeightTracker(FRAME_MIN_HEIGHT));
    const heightRef = useRef(FRAME_MIN_HEIGHT);
    const dialogueRef = useRef(dialogue);
    dialogueRef.current = dialogue;
    const entriesRef = useRef(new Map<string, string>());
    // States and callback changes must not reload the iframe and restart the author's scripts.
    const actionConfig = JSON.stringify(dialogue?.actions ?? []);
    const dialoguePrefix = dialogue?.idPrefix ?? "";
    const syncStates = useCallback(() => {
        const frame = iframeRef.current;
        if (!frame) return;
        frame.contentWindow?.postMessage({ source: "mix-rich-host", id: frameId, type: "dialogue-states", states: dialogueRef.current?.states ?? {} }, "*");
        frame.contentWindow?.postMessage({ source: "mix-rich-host", id: frameId, type: "rich-theme", color: getComputedStyle(frame).color }, "*");
    }, [frameId]);
    useEffect(() => { syncStates(); }, [dialogue?.states, syncStates]);
    useEffect(() => {
        const game = iframeRef.current?.closest(".mix-game");
        if (!game) return;
        const observer = new MutationObserver(syncStates);
        observer.observe(game, { attributes: true, attributeFilter: ["data-theme", "style"] });
        return () => observer.disconnect();
    }, [syncStates]);

    const srcDoc = useMemo(() => {
        // 默认字色跟随宿主的阅读外观；作者显式指定的颜色仍优先。
        const base = /<html[\s>]/i.test(html)
            ? html
            : `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{margin:0;color:var(--mix-rich-text,#f2f0f7);font:14px/1.8 system-ui,-apple-system,sans-serif;background:transparent;word-break:break-word}</style></head><body>${html}</body></html>`;
        const actions = JSON.parse(actionConfig) as MixProseDialogue["actions"];
        const themeBridge = `<script>window.addEventListener('message',function(e){var d=e.data;if(e.source===parent&&d&&d.source==='mix-rich-host'&&d.id===${JSON.stringify(frameId)}&&d.type==='rich-theme'&&typeof d.color==='string')document.documentElement.style.setProperty('--mix-rich-text',d.color);});</script>`;
        const bridge = themeBridge + buildMixFrameBridge("mix-rich-frame", frameId, FRAME_MIN_HEIGHT)
            + (actions.length ? buildMixRichDialogueBridge(frameId, dialoguePrefix, actions) : "");
        return /<\/body>/i.test(base) ? base.replace(/<\/body>/i, `${bridge}</body>`) : base + bridge;
    }, [html, frameId, actionConfig, dialoguePrefix]);

    useEffect(() => {
        entriesRef.current.clear();
        const handleMessage = (event: MessageEvent) => {
            if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
            const data = event.data as Record<string, unknown> | null;
            if (!data || data.source !== "mix-rich-frame" || data.id !== frameId) return;
            if (data.type === "dialogues" && Array.isArray(data.entries)) {
                entriesRef.current.clear();
                for (const entry of data.entries.slice(0, 2000)) {
                    if (entry && typeof entry.segmentId === "string" && entry.segmentId.startsWith(dialoguePrefix)
                        && typeof entry.text === "string" && entry.text.length <= 2000) entriesRef.current.set(entry.segmentId, entry.text);
                }
                syncStates();
                return;
            }
            if (data.type === "dialogue") {
                const current = dialogueRef.current;
                const text = typeof data.segmentId === "string" ? entriesRef.current.get(data.segmentId) : undefined;
                if (text && current?.actions.some((action) => action.key === data.actionKey)) {
                    current.onTap(data.actionKey as string, data.segmentId as string, text);
                }
                return;
            }
            if (data.type !== "resize") return;
            const applied = nextMixFrameHeight(trackerRef.current, Number(data.height), {
                min: FRAME_MIN_HEIGHT,
                max: FRAME_MAX_HEIGHT,
            });
            // 高度没变就别重渲染：画布里的动效会让 MutationObserver 一直重报
            if (applied === null || applied === heightRef.current) return;
            heightRef.current = applied;
            setHeight(applied);
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [frameId, html, actionConfig, dialoguePrefix, syncStates]);

    return (
        <iframe
            ref={iframeRef}
            title="富文本"
            sandbox="allow-scripts"
            scrolling="no"
            srcDoc={srcDoc}
            onLoad={syncStates}
            style={{
                width: "100%",
                height,
                border: 0,
                display: "block",
                background: "transparent",
                pointerEvents: inert ? "none" : "auto",
            }}
        />
    );
}

/**
 * inert：放在按钮里当预览用（开场白选择），让点击穿给外层。
 * 画布是异步撑高的：高度量好后由 iframe 里的桥 postMessage 上来，需要维持滚动落点的
 * 宿主（对局界面）直接监听那条消息，见 components/mixology/mixology-game.tsx。
 */
export function MixRichText({ text, inert, dialogue }: { text: string; inert?: boolean; dialogue?: MixProseDialogue }) {
    if (mixTextHasHtml(text)) return <RichFrame html={text} inert={inert} dialogue={dialogue} />;
    return <div className="mix-detail-value">{text}</div>;
}
