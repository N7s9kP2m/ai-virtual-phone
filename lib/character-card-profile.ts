import type { WorldBookConfig } from "./settings-types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstText(...values: unknown[]): string {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

/** Some cards keep their actual character profile in lore rather than description. */
export function readCharacterCardProfile(card: unknown, mountedBooks: WorldBookConfig[] = []) {
  const root = record(card);
  const data = record(root.data);
  const source = Object.keys(data).length ? data : root;
  const preserved = record(source.importedCard);
  const original = Object.keys(record(preserved.data)).length ? record(preserved.data) : preserved;
  const name = firstText(source.name, root.name, original.name);
  const metadata = record(root._meta ?? preserved._meta);
  const character = Array.isArray(metadata.characters)
    ? metadata.characters.map(record).find(c => firstText(c.name) === name) : undefined;
  const description = firstText(source.description, source.persona, root.description, root.persona, original.description, original.persona, character?.description, character?.persona);
  const personality = firstText(source.personality, root.personality, original.personality, character?.personality);
  const book = record(source.character_book ?? root.character_book ?? original.character_book);
  const entries: unknown[] = Array.isArray(book.entries) ? [...book.entries] : Object.values(record(book.entries));
  entries.push(...mountedBooks.flatMap(b => b.entries));
  const profileEntries = entries.map(record).filter(entry => {
    if (!name || entry.enabled === false || entry.disable || entry.disabled) return false;
    const keywords = entry.keys ?? entry.key;
    const keys = Array.isArray(keywords) ? keywords : typeof keywords === "string" ? keywords.split(",") : [];
    const title = firstText(entry.name, entry.comment);
    return keys.some(key => typeof key === "string" && key.trim() === name)
      || title === name || title.includes(name) && /人设|角色|人物|档案|设定|性格|外貌|背景|关系/.test(title);
  }).map(entry => firstText(entry.content)).filter(Boolean);
  // Keep real descriptions intact; lore remains mounted separately in that case.
  return { name, persona: description || [...new Set(profileEntries)].join("\n\n"), personality,
    profileFromWorldBook: !description && profileEntries.length > 0 };
}
