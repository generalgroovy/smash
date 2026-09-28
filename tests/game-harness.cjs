const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(options = {}) {
  const events = {}, documentEvents = {}, elements = new Map(), drawings = [];
  const context2D = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
    return (...args) => { if (key === 'fillText') drawings.push(args[0]); };
  }, set(target, key, value) { target[key] = value; return true; } });
  const document = {
    hidden: false, activeElement: null,
    addEventListener(name, callback) { documentEvents[name] = callback; },
    getElementById(id) {
      if (!elements.has(id)) {
        const handlers = {}, classes = new Set();
        elements.set(id, {
          id, width: 960, height: 540, value: '', textContent: '', hidden: false, disabled: false, dataset: {}, attributes: {}, handlers,
          focus() { document.activeElement = this; }, getContext() { return context2D; },
          addEventListener(name, callback) { handlers[name] = callback; }, setAttribute(name, value) { this.attributes[name] = value; },
          setPointerCapture() {},
          classList: { remove(name) { classes.delete(name); }, toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains(name) { return classes.has(name); } }
        });
      }
      return elements.get(id);
    },
    querySelectorAll() { return touchButtons; }
  };
  const touchButtons = ['left', 'right', 'up', 'down', 'jump', 'light', 'strong', 'special', 'dodge'].map(action => {
    const button = document.getElementById(`touch-${action}`); button.dataset.action = action; return button;
  });
  document.getElementById('modeSelect').value = options.mode || 'versus';
  document.getElementById('stageSelect').value = 'triad';
  document.getElementById('difficultySelect').value = 'normal';
  const preference = { matches: !!options.reducedMotion, addEventListener(name, callback) { this[name] = callback; } };
  const window = { matchMedia() { return preference; }, addEventListener(name, callback) { events[name] = callback; }, ...options.window };
  const sandbox = vm.createContext({ document, window, PlatformFighter: require('../combat.js'), FighterCPU: require('../cpu.js'), requestAnimationFrame() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8'), sandbox);
  const run = code => vm.runInContext(code, sandbox);
  const key = (type, code, additions = {}) => events[type]({ code, repeat: false, preventDefault() {}, target: null, ...additions });
  const click = id => elements.get(id).handlers.click({ detail: 1 });
  const touch = (action, type, id = 1) => elements.get(`touch-${action}`).handlers[type]({ pointerId: id, button: 0, preventDefault() {} });
  return { elements, document, events, documentEvents, drawings, preference, run, key, click, touch,
    step(count = 1) { for (let i = 0; i < count; i++) run('update()'); },
    start() { click('pauseBtn'); },
    change(id, value) { const element = elements.get(id); element.value = value; element.handlers.change(); }
  };
}
module.exports = { setup };
