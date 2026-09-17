// Run: node scripts/check-mixology-entries.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const cache = new Map();
const cabinet = new Map();
const recipes = new Map();
const storage = {
    getMixMaterial: id => cabinet.get(id),
    saveMixMaterial: material => cabinet.set(material.id, material),
    loadMixRecipes: () => [...recipes.values()],
    saveMixRecipe: recipe => recipes.set(recipe.id, recipe),
};

// Exercise production modules without browser-only storage/download dependencies.
function load(name) {
    if (cache.has(name)) return cache.get(name);
    const exports = {};
    cache.set(name, exports);
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/mixology', `${name}.ts`), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    new Function('require', 'exports', code)(dependency => {
        if (dependency.startsWith('./') && dependency !== './storage') return load(dependency.slice(2));
        if (dependency === './storage') return storage;
        if (dependency === '@/lib/download-utils') return {};
        throw new Error(`Unexpected dependency: ${dependency}`);
    }, exports);
    return exports;
}

const { assembleMixPrompt } = load('assembler');
const { applyMixFilterRules } = load('prose');
const { parseMixMaterialsFromJson, importMixRecipePack } = load('transfer');
const material = {
    id: 'preset', kind: 'base', name: 'Preset', content: 'STALE_SNAPSHOT',
    entries: [
        { id: 'a', name: 'A', content: 'FIRST_ENTRY', enabled: true },
        { id: 'b', name: 'B', content: 'DISABLED_ENTRY', enabled: false },
        { id: 'c', name: 'C', content: 'LAST_ENTRY', enabled: true },
    ],
};
const character = { id: 'char', kind: 'character', name: 'Character', charName: 'Character', openings: ['Hello'] };
const prompt = () => assembleMixPrompt({ character, materials: { base: [material] }, userName: 'Player' }).system;
let text = prompt();
assert(text.includes('FIRST_ENTRY') && !text.includes('DISABLED_ENTRY') && !text.includes('STALE_SNAPSHOT'));
assert(text.indexOf('FIRST_ENTRY') < text.indexOf('LAST_ENTRY'));
material.entries.reverse();
assert(prompt().indexOf('LAST_ENTRY') < prompt().indexOf('FIRST_ENTRY'));
material.entries[1].enabled = true;
assert(prompt().includes('DISABLED_ENTRY'));
material.entries.forEach(entry => { entry.enabled = false; });
assert(!prompt().includes('FIRST_ENTRY') && !prompt().includes('STALE_SNAPSHOT'));
const imported = parseMixMaterialsFromJson(JSON.stringify({ mark: 'float-mixology-material', version: 1, material }));
assert.deepEqual(imported[0].entries, material.entries);
const pack = { recipe: { id: 'recipe', name: 'Recipe', slots: {}, createdAt: 1 }, materials: [material] };
importMixRecipePack(pack);
assert.equal(cabinet.get(material.id).imported, true);
assert.equal(recipes.get('recipe').imported, true);
// Reimporting the same local package also repairs the previous read-only import.
importMixRecipePack(pack, undefined, { localFile: true });
assert.equal(cabinet.get(material.id).imported, undefined);
assert.equal(recipes.get('recipe').imported, undefined);
assert.deepEqual(cabinet.get(material.id).entries, material.entries);
delete material.entries;
material.content = 'LEGACY_CONTENT';
assert(prompt().includes('LEGACY_CONTENT'));
assert.equal(applyMixFilterRules('abc', [{ find: 'a', replace: 'X', mode: 'display', enabled: false }], 'display'), 'abc');
assert.equal(applyMixFilterRules('abc', [{ find: 'a', replace: 'X', mode: 'display' }], 'display'), 'Xbc');
console.log('PASS: entries import, enable/disable, order, legacy text and filter compatibility');
