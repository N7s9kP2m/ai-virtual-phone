import { getCharacterBinding, loadBindingConfig, loadWorldBooks, saveBindingConfig, saveWorldBooks, setCharacterBinding } from "./settings-storage";
import type { WorldBookConfig } from "./settings-types";

/** Mount imported lore only when its character has actually been saved. */
export function mountCharacterWorldBook(characterId: string, embedded?: WorldBookConfig, linkedName?: string): boolean {
  const books = loadWorldBooks();
  const book = embedded ?? books.find(b => b.name === linkedName);
  if (!book) return false;
  if (embedded && !books.some(b => b.id === embedded.id)) saveWorldBooks([...books, embedded]);
  const config = loadBindingConfig();
  const binding = getCharacterBinding(config, characterId);
  const inherited = binding.defaults.worldBookIds?.length ? binding.defaults.worldBookIds : config.globalDefaults.worldBookIds ?? [];
  const appOverrides = { ...binding.appOverrides };
  for (const app of new Set([...Object.keys(config.appDefaults ?? {}), ...Object.keys(appOverrides)])) {
    const slot = appOverrides[app];
    const ids = slot?.worldBookIds?.length ? slot.worldBookIds : config.appDefaults?.[app]?.worldBookIds;
    if (ids?.length) appOverrides[app] = { ...slot, worldBookIds: [...new Set([...ids, book.id])] };
  }
  saveBindingConfig(setCharacterBinding(config, {
    ...binding,
    defaults: { ...binding.defaults, worldBookIds: [...new Set([...inherited, book.id])] },
    appOverrides,
  }));
  return true;
}
