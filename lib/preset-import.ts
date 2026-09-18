import { createBuiltinPreset } from "./builtin-preset";
import { adaptPresetForPhone, asImportRecord } from "./preset-adaptation";
import { loadPresets, loadRegexes, parsePresetFromJson, parseRegexFromJson, savePresets, saveRegexes } from "./settings-storage";
import type { PresetConfig, RegexConfig } from "./settings-types";

export type PresetImportBundle = {
  preset: PresetConfig;
  regexGroups: RegexConfig[];
  adapted: boolean;
  customCount: number;
  builtinCount: number;
  notes: string[];
};

function regexSignature(group: RegexConfig): string {
  return JSON.stringify(group.rules.map(({ id: _id, ...rule }) => rule));
}

function extractRegexGroups(raw: unknown, name: string, external: boolean): RegexConfig[] {
  const root = asImportRecord(raw);
  const extensions = asImportRecord(root.extensions);
  const sources: unknown[] = [];
  const rawSources = new Set<unknown>();
  if (Array.isArray(root.regex_groups)) sources.push(...root.regex_groups);
  if (Array.isArray(root.regexGroups)) sources.push(...root.regexGroups);
  for (const source of [root.regex_scripts, extensions.regex_scripts]) {
    if (Array.isArray(source) && source.length) {
      const group = { name: `${name} · 附带正则`, rules: source };
      sources.push(group);
      rawSources.add(group);
    }
  }
  return sources.map((source, index) => {
    const group = parseRegexFromJson(JSON.stringify(source), `${name} · 正则 ${index + 1}`, external || rawSources.has(source) ? { external: true, defaultTags: ["story"] } : {});
    if (!group) throw new Error(`无法解析「${name}」附带的第 ${index + 1} 个正则组，请检查规则内容。`);
    return group;
  });
}

/** No persistence until the user reviews and accepts the import. */
export function parsePresetImportBundle(text: string, fallbackName: string): PresetImportBundle | null {
  const raw: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
  const root = asImportRecord(raw);
  const source = Object.keys(asImportRecord(root.preset)).length ? asImportRecord(root.preset) : root;
  const preset = parsePresetFromJson(JSON.stringify(source), fallbackName);
  if (!preset) return null;
  const adaptation = adaptPresetForPhone(source, createBuiltinPreset());
  const groups = extractRegexGroups(source, preset.name, adaptation.adapted);
  if (source !== root) groups.push(...extractRegexGroups(root, preset.name, adaptation.adapted));
  const seen = new Set<string>();
  const regexGroups = groups.filter(group => {
    const signature = regexSignature(group);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
  const notes = [...adaptation.notes];
  if (adaptation.adapted) {
    notes.push("酒馆自定义条目与附带正则用于「剧情·通用」，已补齐小手机内置功能。", "为避免格式指令冲突，未追加内置剧情输出格式。");
  }
  if (regexGroups.some(group => group.rules.some(rule => /<script\b|<iframe\b|on(?:click|load|error)\s*=/i.test(rule.replaceString)))) {
    notes.push("附带正则含交互 HTML／脚本，规则会保留；依赖酒馆接口的交互需要在小手机中另行适配。");
  }
  return { preset, regexGroups, adapted: adaptation.adapted, customCount: adaptation.customCount,
    builtinCount: adaptation.builtinCount, notes };
}

/** Accept one preset with its embedded or accompanying regex JSON files/ZIP. */
export async function readPresetImportFiles(files: File[]): Promise<PresetImportBundle> {
  const documents: { name: string; text: string }[] = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter(entry => !entry.dir && /\.json$/i.test(entry.name) && !entry.name.startsWith("__MACOSX/"));
      documents.push(...await Promise.all(entries.map(async entry => ({ name: entry.name, text: await entry.async("string") }))));
    } else documents.push({ name: file.name, text: await file.text() });
  }
  let bundle: PresetImportBundle | null = null;
  const companions: RegexConfig[] = [];
  const unrecognized: string[] = [];
  for (const doc of documents) {
    const fallback = doc.name.split(/[\\/]/).pop()?.replace(/\.json$/i, "") ?? doc.name;
    let raw: unknown;
    try { raw = JSON.parse(doc.text.replace(/^\uFEFF/, "")); }
    catch { throw new Error(`「${doc.name}」不是有效的 JSON，未导入任何内容。`); }
    const record = asImportRecord(raw);
    const source = Object.keys(asImportRecord(record.preset)).length ? record.preset : raw;
    if (Array.isArray(asImportRecord(source).prompts)) {
      const parsed = parsePresetImportBundle(doc.text, fallback);
      if (!parsed) throw new Error(`「${doc.name}」没有有效的预设条目。`);
      if (bundle) throw new Error("一次请选择一个预设及其对应正则，压缩包中发现了多个预设。");
      bundle = parsed;
    } else {
      const group = parseRegexFromJson(doc.text, fallback);
      if (group) companions.push(group);
      else unrecognized.push(doc.name);
    }
  }
  if (!bundle) throw new Error("没有识别到预设，请选择预设 JSON，可同时选择对应的正则 JSON 或 ZIP 包。");
  const seen = new Set(bundle.regexGroups.map(regexSignature));
  for (const group of companions) {
    const signature = regexSignature(group);
    if (!seen.has(signature)) { bundle.regexGroups.push(group); seen.add(signature); }
  }
  if (unrecognized.length) bundle.notes.push(`未识别为预设或正则的文件已跳过：${unrecognized.join("、")}`);
  return bundle;
}

export function installPresetImport(bundle: PresetImportBundle): PresetConfig {
  const preset = { ...bundle.preset, linkedRegexIds: bundle.regexGroups.map(group => group.id) };
  if (bundle.regexGroups.length) saveRegexes([...loadRegexes(), ...bundle.regexGroups]);
  savePresets([preset, ...loadPresets()]);
  return preset;
}

export function exportPresetWithRegexes(preset: PresetConfig) {
  const { linkedRegexIds, ...data } = preset;
  const groups = loadRegexes().filter(group => linkedRegexIds?.includes(group.id));
  return { ...data, ...(groups.length ? { regex_groups: groups } : {}) };
}
