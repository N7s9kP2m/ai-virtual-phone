// Exercise the real parsers and binding resolver with in-memory browser storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const values = new Map();
let books = [];
const modules = new Map();
const stubs = {
  './kv-db': { registerKvMigration() {}, kvGet: key => values.get(key), kvSet: (key, value) => values.set(key, value) },
  './settings-db': { readWorldBooksCache: () => books, writeWorldBooksCache: value => { books = value; }, readPresetsCache: () => [] },
  './character-time': { normalizeTimeZone: value => typeof value === 'string' ? value : undefined },
};
function load(name) {
  if (stubs[name]) return stubs[name];
  if (!['./character-storage', './settings-storage', './character-card-mount', './character-card-profile'].includes(name)) return {};
  if (modules.has(name)) return modules.get(name);
  const filename = path.join(__dirname, '..', 'lib', name.slice(2) + '.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  modules.set(name, module.exports);
  vm.runInNewContext(code, { module, exports: module.exports, require: load, window: { dispatchEvent() {} }, CustomEvent: class {}, TextDecoder, Uint8Array, DataView, atob, console, setTimeout }, { filename });
  return module.exports;
}
const chars = load('./character-storage');
const settings = load('./settings-storage');
const { mountCharacterWorldBook } = load('./character-card-mount');
const card = { spec: 'chara_card_v2', data: { name: '测试角色', description: '中文人设', personality: '温柔', first_mes: '你好', scenario: '雨天', mes_example: '对话', character_book: { name: '城市', entries: [{ id: 0, keys: ['车站'], content: '末班车', enabled: false, insertion_order: 0, extensions: { position: 4, depth: 3, probability: 0, useProbability: true } }] } } };
const parsed = chars.parseCharacterFromJson(JSON.stringify(card));
assert.equal(parsed.name, '测试角色');
assert.equal(parsed.persona, '中文人设');
assert.equal(parsed.importedCard.data.first_mes, '你好');
const loreOnly = { spec: 'chara_card_v2', data: { name: '测试角色', description: '', personality: '', character_book: { entries: [
  { keys: ['测试角色'], name: '测试角色 · 人物档案', content: '实际人设', enabled: true },
  { keys: ['其他角色'], name: '其他角色', content: '其他人物', enabled: true },
  { keys: ['测试角色'], content: '已禁用的旧设定', enabled: false },
  { keys: ['城市'], content: '城市世界观', enabled: true },
] } } };
const loreProfile = chars.parseCharacterFromJson(JSON.stringify(loreOnly));
assert.equal(loreProfile.persona, '实际人设', 'Lore-only cards must import their character profile, not an empty shell');
assert.equal(loreProfile.embeddedWorldBook.entries.length, 4, 'Extracting a profile must retain the whole world book');
const dictionaryLore = structuredClone(loreOnly);
dictionaryLore.data.character_book.entries = { 0: { key: ['测试角色'], comment: '人物档案', content: '字典格式人设' } };
assert.equal(chars.parseCharacterFromJson(JSON.stringify(dictionaryLore)).persona, '字典格式人设');
assert.equal(chars.parseCharacterFromJson(JSON.stringify({ name: '有兼容字段', description: '', persona: '兼容人设' })).persona, '兼容人设');
assert.equal(chars.parseCharacterFromJson(JSON.stringify({ spec: 'chara_card_v2', description: '顶层人设', data: { name: '嵌套角色', description: '' } })).persona, '顶层人设');
assert.equal(chars.parseCharacterFromJson(JSON.stringify(card.data)).name, '测试角色');
const roundTrip = chars.parseCharacterFromJson(JSON.stringify({ schema: 'ai_phone_character', name: parsed.name, description: parsed.persona, importedCard: parsed.importedCard }));
assert.equal(roundTrip.embeddedWorldBook.entries.length, 1, 'Native export must retain embedded lore');
const entry = parsed.embeddedWorldBook.entries[0];
assert.equal(entry.uid, '0');
assert.equal(entry.key, '车站');
assert.equal(entry.disable, true);
assert.equal(entry.position, 4);
assert.equal(entry.depth, 3);
assert.equal(entry.probability, 0);
assert.equal(entry.insertion_order, 0);
const world = settings.parseWorldBookFromJson(JSON.stringify({ entries: { 0: { uid: 0, key: ['星空'], content: '群星', constant: true } } }));
assert.equal(world.entries[0].key, '星空');
for (const value of [null, [], {}, { name: '世界', entries: {} }, { foo: 'bar' }]) assert.equal(chars.parseCharacterFromJson(JSON.stringify(value)), null);
for (const value of [null, [], {}, card, { entries: [null] }]) assert.equal(settings.parseWorldBookFromJson(JSON.stringify(value)), null);
assert.equal(books.length, 0, 'Parsing must not persist books');
settings.saveBindingConfig({ globalDefaults: { worldBookIds: ['global'] }, appDefaults: { chat: { worldBookIds: ['chat'] } }, characterBindings: [] });
assert.equal(mountCharacterWorldBook('role', parsed.embeddedWorldBook), true);
assert.equal(books.length, 1);
let binding = settings.loadBindingConfig();
assert.ok(settings.resolveBinding(binding, 'role').worldBookIds.includes(parsed.embeddedWorldBook.id));
assert.ok(settings.resolveBinding(binding, 'role', 'chat').worldBookIds.includes(parsed.embeddedWorldBook.id));
assert.ok(settings.resolveBinding(binding, 'role', 'chat').worldBookIds.includes('chat'));
mountCharacterWorldBook('role', parsed.embeddedWorldBook);
assert.equal(books.length, 1, 'Mounting must not duplicate books');
assert.equal(mountCharacterWorldBook('other', undefined, '城市'), true);
assert.equal(mountCharacterWorldBook('missing', undefined, '不存在'), false);
function png(keyword, payload) {
  const data = Buffer.from(keyword + '\0' + Buffer.from(JSON.stringify(payload)).toString('base64'));
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length); chunk.write('tEXt', 4); data.copy(chunk, 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk]);
}
for (const keyword of ['chara', 'ccv3', 'ai_phone_character']) {
  const bytes = png(keyword, keyword === 'ai_phone_character' ? { name: '旧角色', persona: '设定' } : { ...card, spec: keyword === 'ccv3' ? 'chara_card_v3' : card.spec });
  assert.ok(chars.parseCharacterFromPng(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
}
const v2 = png('chara', card);
const v3 = png('ccv3', { ...card, spec: 'chara_card_v3', data: { ...card.data, name: 'V3' } });
const combined = Buffer.concat([v2, v3.subarray(8)]);
assert.equal(chars.parseCharacterFromPng(combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength)).name, 'V3');
const malformed = png('chara', card); malformed.writeUInt32BE(0xffffffff, 8);
assert.equal(chars.parseCharacterFromPng(malformed.buffer.slice(malformed.byteOffset, malformed.byteOffset + malformed.byteLength)), null);
const originalEntryCount = loreOnly.data.character_book.entries.length;
load('./character-card-profile').readCharacterCardProfile(loreOnly, [world]);
assert.equal(loreOnly.data.character_book.entries.length, originalEntryCount, 'Reading a profile must not mutate imported source');
values.set('ai_phone_characters_v1', JSON.stringify([{ id: 'existing', name: '测试角色', persona: '', avatar: null, importedCard: loreOnly, tags: ['旧标签'] }]));
const repaired = chars.loadCharacters()[0];
assert.equal(repaired.id, 'existing', 'Repair must preserve character identity and chat references');
assert.equal(repaired.persona, '实际人设');
assert.equal(repaired.tags[0], '旧标签');
assert.equal(repaired.importProfileVersion, 1);
chars.saveCharacters([{ ...repaired, persona: '' }]);
assert.equal(chars.loadCharacters()[0].persona, '', 'One-time repair must not undo a later manual edit');
console.log('Character card import checks passed: JSON V1/V2/V3, PNG metadata, world books, invalid files and effective bindings.');
