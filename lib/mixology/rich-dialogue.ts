type FrameAction = { key: string; icon: string; title?: string };

/** Runs inside the sandbox. Insert buttons at quote boundaries without rewriting the author's HTML. */
function installRichDialogue(frameId: string, prefix: string, actions: FrameAction[]) {
    const send = (type: string, payload: object) => parent.postMessage(Object.assign({ source: "mix-rich-frame", id: frameId, type }, payload), "*");
    const ignored = "script,style,pre,code,svg,math,button,a,textarea,select,[contenteditable],[data-mix-dialogue-ignore]";
    const blocks = "p,div,li,td,th,blockquote,h1,h2,h3,h4,h5,h6,section,article";
    const buttons: { button: HTMLButtonElement; stateKey: string }[] = [];
    function install() {
        if (!document.body) return;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const groups: { owner: Element; nodes: Text[]; text: string }[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
            const el = node.parentElement;
            if (!el || el.closest(ignored) || el.closest("[hidden]")) continue;
            let hidden = false;
            for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
                const style = getComputedStyle(ancestor);
                if (style.display === "none" || style.visibility === "hidden") { hidden = true; break; }
            }
            if (hidden) continue;
            const owner = el.closest(blocks) || document.body;
            let group = groups[groups.length - 1];
            if (!group || group.owner !== owner) {
                group = { owner, nodes: [], text: "" };
                groups.push(group);
            }
            group.nodes.push(node as Text);
            group.text += node.textContent || "";
        }
        const entries: { segmentId: string; text: string }[] = [];
        const inserts: { node: Text; offset: number; segmentId: string; text: string }[] = [];
        for (const group of groups) {
            const re = /「([^」\n]{1,2000})」|“([^”\n]{1,200})”|"([^"\n]{1,200})"/g;
            for (let match = re.exec(group.text); match; match = re.exec(group.text)) {
                const text = (match[1] ?? match[2] ?? match[3]).replace(/[~～]/g, "").trim();
                if (!text) continue;
                const segmentId = `${prefix}${entries.length}`;
                let end = match.index + match[0].length;
                for (const n of group.nodes) {
                    if (end <= n.length) {
                        inserts.push({ node: n, offset: end, segmentId, text });
                        entries.push({ segmentId, text });
                        break;
                    }
                    end -= n.length;
                }
            }
        }
        // Reverse order keeps the original text offsets valid, including multiple quotes in one node.
        for (const item of inserts.reverse()) {
            const range = document.createRange();
            range.setStart(item.node, item.offset);
            range.collapse(true);
            const span = document.createElement("span");
            span.className = "mix-rich-dialogue-actions";
            for (const action of actions) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "mix-say-btn";
                button.title = action.title || "对白按钮";
                button.setAttribute("aria-label", button.title);
                if (action.icon === "speaker") {
                    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
                } else {
                    const icons: Record<string, string> = { play: "▶", translate: "译", note: "✎", bookmark: "⚑", star: "☆", heart: "♡", quote: "❞", spark: "✧" };
                    button.textContent = icons[action.icon.trim().toLowerCase()] || action.icon;
                }
                button.addEventListener("click", () => send("dialogue", { actionKey: action.key, segmentId: item.segmentId }));
                buttons.push({ button, stateKey: `${action.key}|${item.segmentId}` });
                span.appendChild(button);
            }
            range.insertNode(span);
        }
        send("dialogues", { entries });
    }
    window.addEventListener("message", (event) => {
        if (event.source !== parent) return;
        const data = event.data;
        if (data?.source !== "mix-rich-host" || data.id !== frameId || data.type !== "dialogue-states") return;
        for (const item of buttons) {
            const state = data.states?.[item.stateKey];
            if (state === "busy" || state === "playing") item.button.dataset.state = state;
            else delete item.button.dataset.state;
        }
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(install), { once: true });
    else requestAnimationFrame(install);
}

export function buildMixRichDialogueBridge(frameId: string, prefix: string, actions: FrameAction[]): string {
    const config = [frameId, prefix, actions].map((value) => JSON.stringify(value).replace(/</g, "\\u003c")).join(",");
    return `<style>.mix-rich-dialogue-actions{white-space:nowrap}.mix-say-btn{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:28px;height:28px;margin:0 2px;padding:0;border:1px solid currentColor;border-radius:50%;background:transparent;color:inherit;cursor:pointer;opacity:.72}.mix-say-btn:hover,.mix-say-btn:focus-visible{opacity:1;outline:2px solid currentColor;outline-offset:2px}.mix-say-btn[data-state=busy]{opacity:.4;animation:mix-rich-pulse 1s infinite}.mix-say-btn[data-state=playing]{opacity:1;background:rgba(100,160,100,.16)}@keyframes mix-rich-pulse{50%{opacity:.85}}</style><script>(${installRichDialogue.toString()})(${config});</script>`;
}
