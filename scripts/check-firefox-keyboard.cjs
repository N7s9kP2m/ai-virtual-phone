const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, context) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  vm.runInNewContext(code, { exports, ...context });
  return exports;
}
for (const api of [false, true]) {
  let now = 1000, cleanup;
  const events = {}, frames = [], timers = [];
  const props = {};
  const root = { dataset: {}, classList: { contains: () => true }, style: {
    setProperty: (k, v) => props[k] = v, removeProperty: k => delete props[k]
  } };
  const field = { matches: () => true, closest: () => ({}) };
  const doc = { documentElement: root, visibilityState: 'visible', activeElement: null,
    fullscreenElement: {}, cookie: 'pwa_display_mode=fullscreen',
    addEventListener: (k, f) => events[k] = f, removeEventListener: () => {} };
  const viewport = { height: 800, scale: 1, addEventListener: () => {}, removeEventListener: () => {} };
  const keyboard = { boundingRect: { height: 0, top: 0 }, overlaysContent: false,
    addEventListener: (k, f) => events[k] = f, removeEventListener: () => {} };
  const nav = { userAgent: 'Android Firefox/145.0', ...(api ? { virtualKeyboard: keyboard } : {}) };
  const win = { innerHeight: 800, visualViewport: viewport,
    matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    requestAnimationFrame: f => (frames.push(f), frames.length), cancelAnimationFrame: () => {},
    setTimeout: (f, delay) => (timers.push({f, delay}), timers.length), clearTimeout: () => {},
    scrollTo: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
  const display = load('lib/pwa-display-mode.ts', { document: doc, navigator: nav });
  const controller = load('components/mobile-viewport-controller.tsx', {
    document: doc, navigator: nav, window: win, Date: {now: () => now},
    require: id => id === 'react' ? { useEffect: f => cleanup = f() } : display
  });
  const flush = () => { while (frames.length) frames.shift()(); };
  controller.MobileViewportController();
  assert.equal(props['--mobile-viewport-height'], '800px');
  doc.activeElement = field;
  events.focusin(); now += 400;
  timers.filter(t => t.delay === 400).forEach(t => t.f()); flush();
  assert.equal(display.shouldRequestPwaFullscreen(), false);
  if (api) {
    keyboard.boundingRect = { height: 350, top: 450 };
    events.geometrychange(); flush();
    assert.equal(props['--mobile-viewport-height'], '450px');
    keyboard.boundingRect = { height: 0, top: 0 };
    events.geometrychange(); flush();
    assert.equal(props['--mobile-viewport-height'], '800px');
  } else {
    assert.equal(props['--mobile-viewport-height'], '480px', 'Stale fullscreen metrics reserve 40% for the keyboard');
    viewport.height = 460; events.focusout(); doc.activeElement = null; flush();
    assert.equal(props['--mobile-viewport-height'], '460px', 'Actual viewport height takes priority');
    viewport.height = 800;
  }
  doc.activeElement = null; events.focusout(); flush();
  assert.equal(props['--mobile-viewport-height'], '800px');
  assert.equal(display.shouldRequestPwaFullscreen(), true);
  assert.ok(doc.fullscreenElement, 'Typing never exits fullscreen');
  cleanup();
  if (api) assert.equal(keyboard.overlaysContent, false);
}
console.log('PASS fullscreen retained, keyboard geometry, estimated fallback and restoration');
