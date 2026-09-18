// Real conversion/parsing/resolution code; only browser persistence is replaced.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
let presets = [], regexes = [];
const values = new Map();
const modules = new Map();
const enabled = new Set(['preset-import', 'preset-adaptation', 'settings-storage', 'settings-types', 'builtin-preset', 'content-tag-utils', 'checkphone-config', 'generation-parameters', 'llm-prompt-assembler']);
const stubs = {
  './kv-db': { registerKvMigration() {}, kvGet: key => values.get(key), kvSet: (key, value) => values.set(key, value) },
  './settings-db': {
    readPresetsCache: () => presets, writePresetsCache: value => { presets = value; },
    readRegexesCache: () => regexes, writeRegexesCache: value => { regexes = value; }, readWorldBooksCache: () => [],
  },
};
function load(name) {
  if (stubs[name]) return stubs[name];
  if (name === 'jszip') return require('jszip');
  if (!enabled.has(name.replace(/^\.\//, ''))) return {};
  if (modules.has(name)) return modules.get(name);
  const filename = path.join(__dirname, '..', 'lib', name.slice(2) + '.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  modules.set(name, module.exports);
  vm.runInNewContext(code, { module, exports: module.exports, require: load, window: { dispatchEvent() {} }, CustomEvent: class {}, console, setTimeout }, { filename });
  return module.exports;
}
const settings = load('./settings-storage');
const imports = load('./preset-import');
const engine = load('./llm-prompt-assembler');
const rule = { scriptName: '正文渲染', findRegex: '/(hello)/g', replaceString: '<style class="test">\n.a { color: red; }\n\n.b { color: blue; }\n</style>$1', placement: [2], markdownOnly: true, promptOnly: false, minDepth: 0, maxDepth: -1 };
const raw = {
  name: '酒馆预设', chat_completion_source: 'openai', openai_model: 'test-model', proxy_password: 'do-not-import',
  temperature: '0.75', max_tokens: '4096',
  prompts: [{ identifier: 'first', name: '首条', content: 'first', enabled: true }, { identifier: 'second', name: '次条', content: 'second' }, { identifier: 'unused', name: '未选中', content: 'unused' }],
  prompt_order: [{ character_id: 100000, order: [{ identifier: 'unused', enabled: true }] }, { character_id: 100001, order: [{ identifier: 'second', enabled: false }, { identifier: 'charDescription', enabled: true }, { identifier: 'first', enabled: true }, { identifier: 'chatHistory', enabled: true }] }],
  extensions: { regex_scripts: [rule] },
};
async function main() {
  const bundle = imports.parsePresetImportBundle(JSON.stringify(raw), 'fallback');
  assert.ok(bundle.adapted);
  assert.ok(bundle.builtinCount > 0);
  assert.equal(bundle.preset.temperature, 0.75);
  assert.equal(bundle.preset.openai_max_tokens, 4096);
  assert.equal(bundle.preset.proxy_password, undefined);
  assert.equal(bundle.preset.prompts.slice(0, 4).map(p => p.identifier).join(','), 'second,charDescription,first,chatHistory');
  assert.equal(bundle.preset.prompts.find(p => p.identifier === 'second').enabled, false);
  assert.equal(bundle.preset.prompts.find(p => p.identifier === 'unused').enabled, false);
  assert.equal(bundle.preset.prompts.find(p => p.identifier === 'first').tags.join(','), 'story');
  assert.equal(bundle.preset.prompts.filter(p => p.identifier === 'charDescription').length, 1);
  assert.ok(!bundle.preset.prompts.some(p => p.identifier === 'shortTermMemory' || p.identifier === 'story_output_format'));
  assert.ok(bundle.preset.prompts.some(p => p.identifier === 'chat_output_format'));
  assert.equal(bundle.regexGroups.length, 1);
  assert.equal(bundle.regexGroups[0].rules[0].tags.join(','), 'story');
  assert.ok(!bundle.regexGroups[0].rules[0].replaceString.includes('\n\n'));
  assert.ok(bundle.regexGroups[0].rules[0].replaceString.startsWith('<style class="test">'));
  assert.equal(presets.length, 0, 'Preview must not write presets');
  assert.equal(regexes.length, 0, 'Preview must not write regex groups');
  const installed = imports.installPresetImport(bundle);
  assert.equal(regexes.length, 1);
  const config = { globalDefaults: { presetId: installed.id, regexIds: ['manual'] }, characterBindings: [{ characterId: 'role', defaults: {}, appOverrides: { story: { regexIds: ['app'] } } }], appDefaults: { story: { presetId: installed.id } } };
  assert.equal(settings.resolveBinding(config, 'role').regexIds.join(','), `manual,${regexes[0].id}`);
  assert.equal(settings.resolveBinding(config, 'role', 'story').regexIds.join(','), `app,${regexes[0].id}`);
  assert.equal(settings.resolveBinding(config, undefined, 'story').regexIds.join(','), `manual,${regexes[0].id}`);
  const builtin = presets.find(p => p.builtIn);
  config.globalDefaults.presetId = builtin.id;
  assert.equal(settings.resolveBinding(config, 'role').regexIds.join(','), 'manual', 'Switching presets must stop using the old preset regexes');
  assert.equal(settings.resolveBinding(config, 'role', 'story').regexIds.join(','), `app,${regexes[0].id}`, 'App preset overrides must carry the corresponding regexes');
  const exported = imports.exportPresetWithRegexes(installed);
  assert.equal(exported.regex_groups.length, 1);
  assert.equal(exported.linkedRegexIds, undefined);
  const reimported = imports.parsePresetImportBundle(JSON.stringify(exported), 'roundtrip');
  assert.equal(reimported.adapted, false);
  assert.equal(reimported.preset.prompts.length, installed.prompts.length, 'Native roundtrip must not add another base');
  assert.equal(reimported.regexGroups[0].rules[0].replaceString, regexes[0].rules[0].replaceString);
  assert.notEqual(reimported.regexGroups[0].id, regexes[0].id);
  const external = settings.parseRegexFromJson(JSON.stringify([{ findRegex: 'hello', replaceString: 'world', promptOnly: true, placement: [1, 2, 5, 6], minDepth: 0, maxDepth: 0, substituteRegex: 2, historyOnly: true }]));
  assert.equal(external.rules[0].placement.join(','), '1,2,5,6');
  assert.equal(external.rules[0].markdownOnly, undefined);
  assert.equal(external.rules[0].historyOnly, true);
  assert.equal(external.rules[0].maxDepth, 0);
  const basic = settings.parseRegexFromJson(JSON.stringify({ findRegex: 'hello', replaceString: 'world' }));
  assert.equal(basic.rules[0].placement.join(','), '2');
  assert.equal(basic.rules[0].markdownOnly, true);
  const display = engine.applyDisplayRegex('hello', [basic], 2, { activeTags: ['story'] });
  assert.equal(display, 'world', 'Converted rules must run through the actual regex engine');
  assert.equal(engine.applyOutputRegex('hello', [basic], { isPrompt: true, activeTags: ['story'] }), 'hello');
  assert.equal(engine.applyDisplayRegex('hello', [basic], 2, { activeTags: ['chat', 'text'] }), 'hello');
  assert.equal(settings.parseRegexFromJson(JSON.stringify({ name: 'not a rule', rules: [{ scriptName: 'missing pattern' }] })), null);
  assert.equal(settings.parsePresetFromJson(JSON.stringify({ name: 'world', entries: {} })), null);
  const before = `${presets.length}:${regexes.length}`;
  assert.throws(() => imports.parsePresetImportBundle(JSON.stringify({ ...raw, extensions: { regex_scripts: [{ scriptName: 'bad' }] } }), 'invalid'));
  assert.equal(`${presets.length}:${regexes.length}`, before);
  const file = (name, data) => ({ name, text: async () => JSON.stringify(data) });
  const sidecar = await imports.readPresetImportFiles([file('preset.json', raw), file('regex.json', { ...rule, scriptName: '附加规则', findRegex: '/extra/g' })]);
  assert.equal(sidecar.regexGroups.length, 2);
  const JSZip = require('jszip');
  const zip = new JSZip(); zip.file('preset.json', JSON.stringify(raw)); zip.file('regex/extra.json', JSON.stringify({ ...rule, findRegex: '/extra/g' }));
  const zipped = await imports.readPresetImportFiles([{ name: 'bundle.zip', arrayBuffer: async () => await zip.generateAsync({ type: 'nodebuffer' }) }]);
  assert.equal(zipped.regexGroups.length, 2);
  await assert.rejects(imports.readPresetImportFiles([file('a.json', raw), file('b.json', raw)]), /多个预设/);
  for (const filename of process.argv.slice(2)) {
    const native = JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
    const parsed = imports.parsePresetImportBundle(JSON.stringify(native), path.basename(filename));
    assert.ok(parsed, filename);
    if (!parsed.adapted) assert.equal(parsed.preset.prompts.length, native.prompts.length, 'Existing converted presets must retain all entries');
    console.log(`Verified ${path.basename(filename)}: ${parsed.preset.prompts.length} prompts, ${parsed.regexGroups.length} embedded regex groups.`);
  }
  console.log('Preset checks passed: Tavern order/scope/base adaptation, bundled regexes, live binding selection, engine behavior, native roundtrip, JSON companions and ZIP.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
