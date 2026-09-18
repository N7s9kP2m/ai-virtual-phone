import type { PresetConfig, Prompt } from "./settings-types";

type JsonRecord = Record<string, unknown>;
export function asImportRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

const MARKERS: Record<string, string> = {
  personaDescription: "◇ 用户人设", charDescription: "◇ 角色描述", charPersonality: "◇ 角色性格",
  worldInfoBefore: "◇ 世界书（角色前）", worldInfoAfter: "◇ 世界书（角色后）",
  scenario: "◇ 情境", dialogueExamples: "◇ 对话示例", chatHistory: "◇ 历史消息",
};

export function isSillyTavernPreset(value: unknown): boolean {
  const data = asImportRecord(value);
  return Array.isArray(data.prompt_order) && data.prompt_order.some(item => Array.isArray(asImportRecord(item).order))
    || ["chat_completion_source", "openai_model", "claude_model", "preset_settings_type"].some(key => key in data);
}

/** Port the converter's scope/base adaptation, while retaining unused entries as disabled. */
export function adaptPresetForPhone(data: JsonRecord, builtin: PresetConfig) {
  if (!isSillyTavernPreset(data)) return { data, adapted: false, notes: [] as string[], customCount: 0, builtinCount: 0 };
  const notes: string[] = [];
  const source = Array.isArray(data.prompts) ? data.prompts.map(asImportRecord) : [];
  const promptMap = new Map(source.filter(p => typeof p.identifier === "string").map(p => [String(p.identifier), p]));
  const orders = Array.isArray(data.prompt_order) ? data.prompt_order.map(asImportRecord) : [];
  const nested = orders.filter(item => Array.isArray(item.order));
  const selected = nested.find(item => Number(item.character_id) === 100001) ?? nested[0];
  const rawOrder = selected ? (selected.order as unknown[]).map(asImportRecord)
    : orders.length ? orders : source.map(p => ({ identifier: p.identifier, enabled: p.enabled }));
  const prompts: JsonRecord[] = [];
  const seen = new Set<string>();
  let customCount = 0;
  let builtinCount = 0;
  function append(identifier: string, original: JsonRecord, enabled: boolean) {
    if (seen.has(identifier)) return;
    seen.add(identifier);
    const marker = identifier in MARKERS || original.marker === true;
    if (!marker) customCount++;
    prompts.push({ ...original, identifier, name: original.name ?? MARKERS[identifier] ?? identifier,
      role: original.role ?? "system", content: typeof original.content === "string" ? original.content : "",
      enabled, marker, featureTag: undefined, followUpOnly: undefined,
      ...(marker ? { tags: undefined } : { tags: ["story"] }),
    });
  }
  for (const item of rawOrder) {
    if (typeof item.identifier !== "string" || !item.identifier) continue;
    const original = promptMap.get(item.identifier);
    if (!original && !(item.identifier in MARKERS)) {
      notes.push(`顺序表中的「${item.identifier}」没有对应内容，已跳过。`);
      continue;
    }
    append(item.identifier, original ?? {}, item.enabled !== false);
  }
  const unused = source.filter(p => typeof p.identifier === "string" && !seen.has(p.identifier));
  for (const p of unused) append(String(p.identifier), p, false);
  if (unused.length) notes.push(`${unused.length} 个未列入当前顺序表的条目已保留为关闭状态。`);
  const baseMap = new Map(builtin.prompts.map(p => [p.identifier, p]));
  const base: Prompt[] = (builtin.prompt_order ?? []).map(item => baseMap.get(item.identifier)).filter((p): p is Prompt => !!p);
  for (const p of builtin.prompts) if (!base.some(item => item.identifier === p.identifier)) base.push(p);
  for (const p of base) {
    if (seen.has(p.identifier) || p.identifier === "story_output_format" || p.identifier === "shortTermMemory" && seen.has("chatHistory")) continue;
    prompts.push({ ...p });
    seen.add(p.identifier);
    builtinCount++;
  }
  return { adapted: true, notes, customCount, builtinCount, data: {
    ...data, story_summary_tag: data.story_summary_tag ?? "summary",
    description: typeof data.description === "string" ? data.description : "已适配小手机：酒馆条目用于剧情，保留顺序与开关，补齐内置功能。",
    prompts, prompt_order: prompts.map(p => ({ identifier: p.identifier, enabled: p.enabled !== false })),
  } };
}

/** Match the converter's CSS cleanup without altering ordinary replacement text. */
export function cleanRegexStyleCss(text: string): string {
  return text.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_match, open: string, css: string, close: string) =>
    `${open}\n${css.split(/\r?\n/).filter(line => line.trim()).join("\n")}\n${close}`);
}
