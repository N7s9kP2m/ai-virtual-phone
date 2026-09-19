// lib/mixology/card-freeform.ts
// 角色卡的两种资料编辑模式之间的换算。
//
// 分框表单：九个字段各占一框，装配时每框一个 ## 小节（标题就是框的标签）。
// 一框式：角色资料 / 世界与剧情各一个大框，作者直接写 ## 小节，正文原样进提示词。
// 两边换算的口径与装配器一字不差：表单 → 一框式无损；一框式 → 表单按已知标题认领，
// 认不出的小节降级成 ### 并进兜底框（角色资料 → 背景，世界与剧情 → 附加设定），
// 不认标题的散文也进兜底框——不丢内容，只是位置变了。
// 角色名不参与换算：它由卡的 charName 提供，装配时自动补 ## 角色名。

import type { MixCharacterCard, MixPromptEntry } from "./types";
import { createMixId } from "./types";

export type MixCardProfileKey = "baseInfo" | "personality" | "appearance" | "background";
export type MixCardWorldKey = "worldview" | "cognition" | "relations" | "plot" | "extra";
export type MixCardFieldKey = MixCardProfileKey | MixCardWorldKey;

export type MixCardFieldSpec<K extends MixCardFieldKey> = {
    key: K;
    /** 框的标签 = 提示词里的 ## 标题 */
    label: string;
    /** 一框式切回表单时也认的别名（老文案/口语写法） */
    aliases?: string[];
};

/** 「角色资料」段的框，按装配顺序 */
export const MIX_CARD_PROFILE_FIELDS: MixCardFieldSpec<MixCardProfileKey>[] = [
    { key: "baseInfo", label: "基础信息" },
    { key: "personality", label: "性格" },
    { key: "appearance", label: "外貌" },
    { key: "background", label: "背景" },
];

/** 「世界与剧情」段的框，按装配顺序 */
export const MIX_CARD_WORLD_FIELDS: MixCardFieldSpec<MixCardWorldKey>[] = [
    { key: "worldview", label: "世界观" },
    { key: "cognition", label: "对{{user}}的初始认知", aliases: ["初始认知", "对user的初始认知"] },
    { key: "relations", label: "关系与身份" },
    { key: "plot", label: "当前剧情" },
    { key: "extra", label: "附加设定" },
];

export const MIX_CARD_FIELD_KEYS: MixCardFieldKey[] = [
    ...MIX_CARD_PROFILE_FIELDS.map((f) => f.key),
    ...MIX_CARD_WORLD_FIELDS.map((f) => f.key),
];

/** 一框式下认不出的内容落到哪个框 */
export const MIX_CARD_PROFILE_FALLBACK: MixCardProfileKey = "background";
export const MIX_CARD_WORLD_FALLBACK: MixCardWorldKey = "extra";

/** 角色名的 ## 标题：一框式正文里若写了这一节，装配时不重复补 */
export const MIX_CARD_NAME_LABEL = "角色名";

export function isMixCardFreeform(card: Pick<MixCharacterCard, "profileMode">): boolean {
    return card.profileMode === "freeform";
}

type FieldValues = Partial<Record<MixCardFieldKey, string | undefined>>;

/** 表单 → 一框式：非空的框各成一个 ## 小节，顺序与装配一致 */
export function buildMixCardFreeformText<K extends MixCardFieldKey>(
    fields: MixCardFieldSpec<K>[],
    values: FieldValues,
): string {
    return fields
        .map((f) => {
            const value = values[f.key]?.trim();
            return value ? `## ${f.label}\n${value}` : "";
        })
        .filter(Boolean)
        .join("\n\n");
}

export type MixCardParsedFreeform<K extends MixCardFieldKey> = {
    values: Partial<Record<K, string>>;
    /** 认不出标题的小节数（含没有标题的散文段），用来在切换前提示作者 */
    unmatched: number;
};

function normalizeHeading(text: string): string {
    return text.replace(/\s+/g, "").replace(/[{}]/g, "").toLowerCase();
}

/**
 * 一框式 → 表单。逐行扫 `## 标题`，按标签（含别名）认领到对应框；
 * 同一个标题写了两次就按顺序拼接。认不出的小节降为 ### 后连同无标题散文一起
 * 并进兜底框末尾。`## 角色名` 一节直接丢弃（角色名由卡名提供）。
 */
export function parseMixCardFreeformText<K extends MixCardFieldKey>(
    text: string,
    fields: MixCardFieldSpec<K>[],
    fallback: K,
): MixCardParsedFreeform<K> {
    const lookup = new Map<string, K>();
    for (const f of fields) {
        lookup.set(normalizeHeading(f.label), f.key);
        for (const alias of f.aliases ?? []) lookup.set(normalizeHeading(alias), f.key);
    }
    const nameHeading = normalizeHeading(MIX_CARD_NAME_LABEL);

    const values: Partial<Record<K, string>> = {};
    const rest: string[] = [];
    let unmatched = 0;
    const push = (key: K, body: string) => {
        const trimmed = body.trim();
        if (!trimmed) return;
        values[key] = values[key] ? `${values[key]}\n\n${trimmed}` : trimmed;
    };

    // 拆成 [标题, 正文] 小节；第一节标题可能为空（散文开头）
    const sections: { heading: string | null; lines: string[] }[] = [{ heading: null, lines: [] }];
    for (const line of text.split(/\r?\n/)) {
        const m = /^##\s+(.+?)\s*$/.exec(line);
        if (m && !/^#/.test(m[1])) {
            sections.push({ heading: m[1], lines: [] });
        } else {
            sections[sections.length - 1].lines.push(line);
        }
    }

    for (const section of sections) {
        const body = section.lines.join("\n").trim();
        if (section.heading === null) {
            if (!body) continue;
            unmatched += 1;
            rest.push(body);
            continue;
        }
        const normalized = normalizeHeading(section.heading);
        if (normalized === nameHeading) continue;
        const key = lookup.get(normalized);
        if (key) {
            push(key, body);
        } else {
            unmatched += 1;
            rest.push(body ? `### ${section.heading}\n${body}` : `### ${section.heading}`);
        }
    }
    if (rest.length) push(fallback, rest.join("\n\n"));
    return { values, unmatched };
}

/**
 * 将整段 Markdown 格式的世界设定文本智能拆解为独立的条目。
 * 兼容常见标题格式：### 标题、## 标题、# 标题、【标题】、■ 标题、[标题] 等。
 */
export function splitMarkdownToPromptEntries(text: string, defaultTitle: string = "世界设定"): MixPromptEntry[] {
    const raw = (text || "").trim();
    if (!raw) return [];

    const lines = raw.split(/\r?\n/);
    const sections: { title: string; contentLines: string[] }[] = [];
    let currentTitle: string | null = null;
    let currentLines: string[] = [];

    const matchHeading = (line: string): string | null => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // 1. Markdown 标题：### 标题 / ## 标题 / # 标题
        const m1 = /^#{1,6}\s+(.+)$/.exec(trimmed);
        if (m1) return m1[1].trim();

        // 2. 中文书名号/方头括号：【标题】
        const m2 = /^【(.+?)】\s*$/.exec(trimmed);
        if (m2) return m2[1].trim();

        // 3. 特殊符号标记：■ 标题 / ◆ 标题 / ★ 标题 / ● 标题
        const m3 = /^[■◆★▲●]\s*(.+)$/.exec(trimmed);
        if (m3) return m3[1].trim();

        // 4. 短方括号：[标题]
        const m4 = /^\[(.+?)\]\s*$/.exec(trimmed);
        if (m4 && m4[1].length <= 50 && !m4[1].includes("http")) {
            return m4[1].trim();
        }

        return null;
    };

    for (const line of lines) {
        const heading = matchHeading(line);
        if (heading !== null) {
            if (currentTitle !== null || currentLines.some((l) => l.trim())) {
                sections.push({
                    title: currentTitle || defaultTitle,
                    contentLines: currentLines,
                });
            }
            currentTitle = heading;
            currentLines = [];
        } else {
            currentLines.push(line);
        }
    }

    if (currentTitle !== null || currentLines.some((l) => l.trim())) {
        sections.push({
            title: currentTitle || defaultTitle,
            contentLines: currentLines,
        });
    }

    // 如果只有一个 section 且没有匹配到标题，但内部有明显的 --- 分割线
    if (sections.length <= 1 && sections[0]) {
        const fullContent = sections[0].contentLines.join("\n").trim();
        if (fullContent.includes("\n---")) {
            const parts = fullContent.split(/\n\s*---\s*(?:\n|$)/).map((p) => p.trim()).filter(Boolean);
            if (parts.length > 1) {
                return parts.map((part, idx) => {
                    const firstLineMatch = matchHeading(part.split(/\r?\n/)[0] || "");
                    let name = `${defaultTitle} ${idx + 1}`;
                    let partContent = part;
                    if (firstLineMatch) {
                        name = firstLineMatch;
                        partContent = part.replace(/^[^\n]*\n?/, "").trim();
                    }
                    return {
                        id: createMixId("world"),
                        name,
                        content: partContent,
                        enabled: true,
                    };
                });
            }
        }
    }

    return sections.map((sec, idx) => ({
        id: createMixId("world"),
        name: sec.title.trim() || `${defaultTitle} ${idx + 1}`,
        content: sec.contentLines.join("\n").trim(),
        enabled: true,
    }));
}

/**
 * 将条目数组拼装回 Markdown 文本。
 * 供装配器或存储同步 worldText 保持旧接口完全兼容。
 */
export function joinPromptEntriesToMarkdown(entries?: MixPromptEntry[], onlyEnabled = true): string {
    if (!entries || !entries.length) return "";
    return entries
        .filter((e) => !onlyEnabled || e.enabled !== false)
        .map((e) => {
            const title = (e.name || "").trim();
            const content = (e.content || "").trim();
            if (!title && !content) return "";
            if (!title) return content;
            if (!content) return `### ${title}`;
            const firstLine = content.split(/\r?\n/)[0]?.trim() || "";
            if (/^#{1,6}\s+/.test(firstLine) || /^【.+?】/.test(firstLine)) {
                return content;
            }
            return `### ${title}\n${content}`;
        })
        .filter(Boolean)
        .join("\n\n");
}

/** 装配/展示口径：不管哪种模式，取「角色资料」段的正文（不含角色名） */
export function mixCardProfileText(card: MixCharacterCard): string {
    if (card.profileEntries && card.profileEntries.length > 0) {
        const joined = joinPromptEntriesToMarkdown(card.profileEntries, true);
        if (joined) return joined;
    }
    return isMixCardFreeform(card) ? (card.profileText ?? "").trim() : buildMixCardFreeformText(MIX_CARD_PROFILE_FIELDS, card);
}

/** 装配/展示口径：不管哪种模式，取「世界与剧情」段的正文（优先读取分条目） */
export function mixCardWorldText(card: MixCharacterCard): string {
    if (card.worldEntries && card.worldEntries.length > 0) {
        const joined = joinPromptEntriesToMarkdown(card.worldEntries, true);
        if (joined) return joined;
    }
    return isMixCardFreeform(card) ? (card.worldText ?? "").trim() : buildMixCardFreeformText(MIX_CARD_WORLD_FIELDS, card);
}

/** 一框式正文里作者自己写了 ## 角色名 时，装配不再重复补 */
export function mixCardTextHasNameHeading(text: string): boolean {
    return text.split(/\r?\n/).some((line) => {
        const m = /^##\s+(.+?)\s*$/.exec(line);
        return Boolean(m) && normalizeHeading(m![1]) === normalizeHeading(MIX_CARD_NAME_LABEL);
    });
}

/**
 * 把卡归一到它声明的模式：一框式清空九个字段（正文只认 profileText/worldText），
 * 表单式清掉两段正文。给存储/导入/工具写入统一用，避免两套数据并存后各读各的。
 * 切模式时若目标侧是空的，先从另一侧换算过来，不丢内容。
 */
export function normalizeMixCardProfile<T extends MixCharacterCard>(card: T): T {
    const next: MixCharacterCard = { ...card };
    if (isMixCardFreeform(card)) {
        if (!next.profileText?.trim()) {
            if (next.profileEntries?.length) {
                next.profileText = joinPromptEntriesToMarkdown(next.profileEntries, true) || undefined;
            } else {
                next.profileText = buildMixCardFreeformText(MIX_CARD_PROFILE_FIELDS, card) || undefined;
            }
        }
        if (!next.worldText?.trim()) {
            if (next.worldEntries?.length) {
                next.worldText = joinPromptEntriesToMarkdown(next.worldEntries, true) || undefined;
            } else {
                next.worldText = buildMixCardFreeformText(MIX_CARD_WORLD_FIELDS, card) || undefined;
            }
        }
        for (const key of MIX_CARD_FIELD_KEYS) delete next[key];
        next.profileMode = "freeform";
        if (!next.profileText) delete next.profileText;
        if (!next.worldText) delete next.worldText;
    } else {
        const hasFields = MIX_CARD_FIELD_KEYS.some((key) => card[key]?.trim());
        if (!hasFields) {
            const pText = card.profileText ?? (card.profileEntries?.length ? joinPromptEntriesToMarkdown(card.profileEntries, true) : "");
            const wText = card.worldText ?? (card.worldEntries?.length ? joinPromptEntriesToMarkdown(card.worldEntries, true) : "");
            const profile = parseMixCardFreeformText(pText, MIX_CARD_PROFILE_FIELDS, MIX_CARD_PROFILE_FALLBACK).values;
            const world = parseMixCardFreeformText(wText, MIX_CARD_WORLD_FIELDS, MIX_CARD_WORLD_FALLBACK).values;
            Object.assign(next, profile, world);
        }
        delete next.profileMode;
        delete next.profileText;
        delete next.worldText;
    }
    return next as T;
}
