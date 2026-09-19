// lib/image-prompt-translator.ts
// 生图提示词智能转译与角色形象特征提炼
// 借鉴 Yuzuki 小手机与二次元 SD/Danbooru 生态最佳实践，将叙事性中文解构成标准生图 Tag

import { simpleLLMCall } from "./api-helpers";
import { loadApiConfigs, loadBindingConfig, resolveBinding } from "./settings-storage";
import type { Character } from "./character-types";
import type { ApiConfig } from "./settings-types";

function hasCjkText(text: string): boolean {
  return /[\u4e00-\u9fa5\u3040-\u30ff]/.test(text);
}

function resolveTextApiConfig(characterId?: string): ApiConfig | null {
  const allConfigs = loadApiConfigs();
  if (allConfigs.length === 0) return null;

  if (characterId) {
    const bindings = loadBindingConfig();
    const slot = resolveBinding(bindings, characterId, "chat");
    if (slot.apiConfigId) {
      const found = allConfigs.find(c => c.id === slot.apiConfigId);
      if (found) return found;
    }
  }

  return allConfigs[0] || null;
}

export function cleanTagText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[a-z]*|```/gi, "")
    .replace(/^\s*(?:prompt|positive prompt|tags?|english tags?|提示词|正面提示词)\s*[:：]/i, "")
    .replace(/[\r\n;；]+/g, ", ")
    .replace(/[，、]/g, ", ")
    .replace(/[。！？!]/g, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/^["'“”‘’\s,]+|["'“”‘’\s,]+$/g, "")
    .trim();
}

/**
 * 将中文/自然语言生图描述转换为逗号分隔的标准英文 Tag。
 * 若无 CJK 字符则直接清洗返回；若转译失败或超时则安全回退。
 */
export async function translatePromptToTags(
  rawPrompt: string,
  characterId?: string,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<string> {
  const source = String(rawPrompt || "").trim();
  if (!source) return "";
  if (!hasCjkText(source)) return cleanTagText(source);

  const apiConfig = resolveTextApiConfig(characterId);
  if (!apiConfig) return source;

  const systemPrompt = [
    "You convert Chinese image descriptions into English image-generation prompt tags.",
    "Output only concise English comma-separated tags.",
    "Do not output explanations, Markdown, Chinese, labels, or complete sentences.",
    "Preserve subject, gender, count, appearance, pose, expression, clothing, setting, camera distance, angle, lighting, atmosphere, and illustration style.",
    "If people or humanoids are present, always include clear tags such as 1girl, 1boy, 2girls, etc.",
    "Do not add unrelated quality tags.",
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 12_000);
    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const result = await simpleLLMCall(
      apiConfig,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Chinese image description:\n${source}\n\nEnglish comma-separated tags only:` },
      ],
      { temperature: 0.3, max_tokens: 512 }
    );

    clearTimeout(timeout);

    if (result.content) {
      const cleaned = cleanTagText(result.content);
      if (cleaned && !hasCjkText(cleaned)) {
        return cleaned;
      }
    }
  } catch (err) {
    console.warn("[ImagePromptTranslator] 转译英文 Tag 失败，回退原描述:", err);
  }

  return source;
}

/**
 * 从角色设定（persona）中智能提炼外观特征英文 Tag。
 * 用于角色档案中的“从人设提炼”功能。
 */
export async function extractCharacterAppearanceTags(character: Character): Promise<string> {
  const personaText = [
    character.persona?.trim(),
    character.personality?.trim() ? `性格：${character.personality.trim()}` : "",
  ].filter(Boolean).join("\n\n");

  if (!personaText) {
    throw new Error("角色人设为空，无法提炼形象特征。");
  }

  const apiConfig = resolveTextApiConfig(character.id);
  if (!apiConfig) {
    throw new Error("尚未配置对话 API，无法提炼形象特征。");
  }

  const name = character.name?.trim() || "该角色";
  const systemPrompt = [
    `You analyze a character's persona and extract their core visual appearance tags for Danbooru/Stable Diffusion image generation.`,
    "Output only concise English comma-separated tags.",
    "Focus strictly on: gender count (e.g. 1girl or 1boy), hair color and hair style, eye color, body type, iconic clothing/costume, signature accessories, and distinctive physical marks (scars, tattoos, glasses, horns, ears).",
    "Do not output character's personality, backstory, actions, camera angles, or generic quality tags.",
    "Do not output explanations, prefixes, or Markdown code blocks.",
    "Example output: 1girl, solo, silver hair, long hair, red eyes, twin tails, serafuku, white ribbon",
  ].join("\n");

  const result = await simpleLLMCall(
    apiConfig,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Character name: ${name}\nPersona:\n${personaText}\n\nEnglish appearance tags only:` },
    ],
    { temperature: 0.2, max_tokens: 512 }
  );

  if (result.error || !result.content) {
    throw new Error(result.error || "提炼形象失败，模型未返回内容。");
  }

  const cleaned = cleanTagText(result.content);
  if (!cleaned) {
    throw new Error("未能从角色人设中提取到有效形象特征。");
  }

  return cleaned;
}
