"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const resetBtn = document.getElementById("resetBtn");
const pauseBtn = document.getElementById("pauseBtn");
const learnBtn = document.getElementById("learnBtn");
const matchState = document.getElementById("matchState");
const modeSelect = document.getElementById("modeSelect");
const stageSelect = document.getElementById("stageSelect");
const difficultySelect = document.getElementById("difficultySelect");
const difficultyControl = document.getElementById("difficultyControl");
const practiceControl = document.getElementById("practiceControl");
const practiceSelect = document.getElementById("practiceSelect");
const matchStatus = document.getElementById("matchStatus");
const soundBtn = document.getElementById("soundBtn");
const soundStatus = document.getElementById("soundStatus");
const motionToggle = document.getElementById("motionToggle");
const touchControls = document.getElementById("touchControls");
const touchButtons = [...document.querySelectorAll("[data-action]")];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const keys = new Set();
const touchPointers = new Map();
const touchPulses = new Map();
const pendingPresses = [new Map(), new Map()];
const pendingDirections = [null, null];
const controlsByPlayer = [
  { left: ["KeyA"], right: ["KeyD"], up: ["KeyW"], down: ["KeyS"], jump: ["Space"], light: ["KeyF"], strong: ["KeyG"], special: ["KeyH"], dodge: ["KeyR"] },
  { left: ["ArrowLeft"], right: ["ArrowRight"], up: ["ArrowUp"], down: ["ArrowDown"], jump: ["Enter"], light: ["KeyJ", "Slash"], strong: ["KeyK", "Period"], special: ["KeyL", "Comma"], dodge: ["ShiftRight"] }
];
const actionNames = new Set(["jump", "light", "strong", "special", "dodge"]);
const W = canvas.width;
const H = canvas.height;
const STEP_MS = 1000 / 60;
let state = PlatformFighter.createGame({ mode: modeSelect.value, stage: stageSelect.value, practiceFocus: practiceSelect.value });
let paused = true;
let started = false;
let previousFrame = null;
let accumulatedTime = 0;
let reducedMotion = motionPreference.matches;
let motionOverridden = false;
let soundEnabled = false;
let audioContext = null;
let activeVoices = 0;
const oscillators = new Set();
motionToggle.checked = reducedMotion;

function announce(text) {
  if (matchStatus.textContent !== text) matchStatus.textContent = text;
}

function clearInput() {
  keys.clear(); touchPointers.clear(); touchPulses.clear();
  for (const pending of pendingPresses) pending.clear();
  pendingDirections.fill(null);
  for (const button of touchButtons) button.classList.remove("held");
  PlatformFighter.clearInputs(state);
  FighterCPU.reset?.(state);
}

function heldInputFor(index) {
  const touch = action => index === 0 && ([...touchPointers.values()].includes(action) || touchPulses.has(action));
  const held = action => controlsByPlayer[index][action].some(code => keys.has(code)) || touch(action);
  return { x: Number(held("right")) - Number(held("left")), y: Number(held("down")) - Number(held("up")), jump: held("jump"), light: held("light"), strong: held("strong"), special: held("special"), dodge: held("dodge") };
}

function latchPress(index, action, source) {
  const held = heldInputFor(index), intent = { x: held.x, y: held.y, source };
  if (actionNames.has(action)) pendingPresses[index].set(action, intent);
  else pendingDirections[index] = intent;
}

function inputFor(index) {
  const input = heldInputFor(index);
  // A press and release can both arrive between two 60 Hz steps. Sample it once,
  // including its original direction, then let the real release reach the engine.
  const pending = pendingPresses[index];
  // Attack/defense intent wins over an earlier jump when a whole chord arrives
  // between frames. These priorities match the engine's action selection.
  const intent = pending.get("dodge") || pending.get("special") || pending.get("strong") || pending.get("light") || pending.get("jump") || pendingDirections[index];
  if (intent) { input.x = intent.x; input.y = intent.y; }
  for (const action of pendingPresses[index].keys()) input[action] = true;
  return input;
}

function readyMessage() {
  if (state.mode === "training") return `${state.practiceText} Start practice when ready.`;
  return state.mode === "versus" ? "Share a keyboard. P1: WASD + Space / F G H R. P2: arrows + Enter / J K L / right Shift." : "Build damage, then launch your rival offstage. First steps teaches the moves.";
}

function playHint() {
  const fighter = state.fighters[0], floor = state.platforms.find(platform => platform.solid);
  // Only offer a return route when the body has actually left the main stage.
  // The advice follows remaining resources; an exhausted recovery is not repeatable.
  if (!fighter.onGround && (fighter.x + fighter.w <= floor.x || fighter.x >= floor.x + floor.w)) {
    const direction = fighter.x < floor.x ? "right" : "left";
    if (fighter.hitstun > 0) return `Launched! Hold ${direction} to steer back as soon as you can move.`;
    if (fighter.recoveryUsed) return `Recovery used. Keep steering ${direction} to land and refill your moves.`;
    return `Offstage: steer ${direction}. ${fighter.jumps > 0 ? "Jump, then " : ""}Up + Special to rise.`;
  }
  if (state.mode === "training") return state.practiceText || "Practice freely. Stocks are unlimited.";
  return "Light connects. Hold a direction to change the move; charge Strong to finish.";
}

function syncMatchControls() {
  const finished = state.winner !== null;
  matchState.textContent = finished ? "Complete" : !started ? "Ready" : paused ? "Paused" : state.mode === "training" ? "Practice" : "Playing";
  pauseBtn.textContent = finished ? "Finished" : !started ? state.mode === "training" ? "Start practice" : state.mode === "cpu" ? "Play CPU" : "Play 2P" : paused ? "Resume" : "Pause";
  pauseBtn.disabled = finished;
  pauseBtn.setAttribute("aria-pressed", String(started && paused && !finished));
  resetBtn.textContent = finished ? "Rematch" : state.mode === "training" ? "Retry" : "Restart";
  resetBtn.hidden = !started;
  learnBtn.hidden = started || state.mode !== "cpu";
}

function setPaused(value) {
  if (state.winner !== null) return;
  paused = value; clearInput(); previousFrame = null; accumulatedTime = 0;
  syncMatchControls();
  if (started) {
    if (state.mode === "training") announce(`${paused ? "Paused. " : ""}${state.practiceText}`);
    else announce(paused ? "Paused. Resume keeps this round; Restart begins a new one." : playHint());
  }
}

function playPause() {
  if (state.winner !== null) return;
  started = true; setPaused(!paused);
  if (!paused) { canvas.focus({ preventScroll: true }); resumeAudio(); }
}

function resetMatch(play = false) {
  clearInput();
  state = PlatformFighter.createGame({ mode: modeSelect.value, stage: stageSelect.value, practiceFocus: practiceSelect.value });
  started = false;
  difficultyControl.hidden = state.mode !== "cpu"; touchControls.hidden = state.mode === "versus";
  practiceControl.hidden = state.mode !== "training";
  setPaused(true); announce(readyMessage());
  if (play) playPause();
}

function update() {
  if (paused || !started || state.winner !== null) return;
  const p2 = state.mode === "cpu" ? FighterCPU.input(state, 1, difficultySelect.value) : inputFor(1);
  PlatformFighter.step(state, [inputFor(0), p2]);
  for (const pending of pendingPresses) pending.clear();
  pendingDirections.fill(null);
  for (const [action, frames] of touchPulses) {
    if (frames <= 1) touchPulses.delete(action); else touchPulses.set(action, frames - 1);
  }
  syncTouchButtons(); playEvents(state.events || []);
  if (state.winner !== null) {
    clearInput(); paused = true; accumulatedTime = 0;
    syncMatchControls();
    announce(`${winnerText()}. Choose Rematch to play again.`); resetBtn.focus({ preventScroll: true });
  } else announce(playHint());
}

function winnerText() {
  if (state.winner === "draw") return "Double knockout";
  return state.winner === 0 ? "Player 1 wins" : state.mode === "cpu" ? "CPU wins" : "Player 2 wins";
}

function roundedBox(x, y, width, height, radius = 8) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
}

function polygon(points) {
  ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
}

function drawBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#111a30"); gradient.addColorStop(0.6, "#18364a"); gradient.addColorStop(1, "#0d1a2d");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
  const haze = ctx.createRadialGradient(W / 2, 245, 0, W / 2, 245, 380);
  haze.addColorStop(0, "#72cfbe22"); haze.addColorStop(1, "#72cfbe00"); ctx.fillStyle = haze; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#94d6d911"; ctx.lineWidth = 1;
  for (let radius = 130; radius <= 330; radius += 70) { ctx.beginPath(); ctx.arc(480, 253, radius, Math.PI, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 36; i++) {
    const x = (i * 137 + 41) % W, y = 100 + (i * 71) % 270;
    ctx.fillStyle = i % 4 ? "#c1dbf344" : "#93ffe477"; ctx.fillRect(x, y, i % 4 ? 1.5 : 2.5, i % 4 ? 1.5 : 2.5);
  }
  for (let i = 0; i < 8; i++) {
    const x = i * 150 - 70, y = 345 + (i * 37) % 120;
    ctx.fillStyle = i % 2 ? "#14293c" : "#132639";
    polygon([[x, H], [x + 15, y + 60], [x + 45, y], [x + 96, y + 10], [x + 140, H]]); ctx.fill();
    ctx.strokeStyle = "#39617b33"; ctx.beginPath(); ctx.moveTo(x + 45, y); ctx.lineTo(x + 62, H); ctx.stroke();
  }
  ctx.fillStyle = "#08142477"; ctx.fillRect(0, H - 25, W, 25);
}

function drawStage() {
  for (const [index, platform] of state.platforms.entries()) {
    const { x, y, w, h } = platform;
    if (index === 0) {
      const stone = ctx.createLinearGradient(0, y, 0, y + 98);
      stone.addColorStop(0, "#283f52"); stone.addColorStop(1, "#102135"); ctx.fillStyle = stone;
      polygon([[x + 12, y + h], [x + w - 12, y + h], [x + w - 58, y + 66], [x + w * .68, y + 85], [x + w / 2, y + 107], [x + w * .23, y + 77], [x + 46, y + 61]]); ctx.fill();
      ctx.strokeStyle = "#638a9633"; ctx.lineWidth = 2;
      for (let j = 1; j < 6; j++) { ctx.beginPath(); ctx.moveTo(x + w * j / 6, y + h); ctx.lineTo(x + w * j / 6 + (j % 2 ? 25 : -20), y + 65); ctx.stroke(); }
    }
    ctx.fillStyle = index === 0 ? "#314c5e" : "#263e54"; roundedBox(x, y, w, h, 4); ctx.fill();
    ctx.fillStyle = "#b1f5e5"; ctx.fillRect(x + 4, y, w - 8, 3);
    ctx.fillStyle = "#5c988d"; ctx.fillRect(x + 7, y + 4, w - 14, 3);
    ctx.fillStyle = "#07142288"; ctx.fillRect(x + 8, y + h - 5, w - 16, 3);
    ctx.fillStyle = "#a9e6dc66";
    for (let j = 20; j < w - 12; j += 34) ctx.fillRect(x + j, y + h - 9, 9, 2);
    if (index > 0) { ctx.fillStyle = "#7ae4cf66"; polygon([[x + w / 2 - 9, y + h + 3], [x + w / 2 + 9, y + h + 3], [x + w / 2, y + h + 12]]); ctx.fill(); }
  }
}

function movePhase(fighter) {
  if (!fighter.move) return null;
  const data = PlatformFighter.MOVES[fighter.move.id];
  if (!data) return null;
  const frame = fighter.move.frame || 0;
  return { data, windup: fighter.move.charging || frame < data.startup, active: !fighter.move.charging && frame >= data.startup && frame < data.startup + data.active };
}

function drawAttack(fighter, phase) {
  if (!phase) return;
  const centerX = fighter.x + fighter.w / 2, centerY = fighter.y + fighter.h / 2;
  const color = phase.data.color || fighter.color;
  ctx.save();
  if (fighter.move.charging) {
    const amount = Math.min(1, (fighter.move.charge || 0) / 60);
    ctx.strokeStyle = "#ffda8d"; ctx.lineWidth = 3 + amount * 3;
    ctx.beginPath(); ctx.arc(centerX, centerY, 37 + amount * 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.08, amount)); ctx.stroke();
    ctx.font = "bold 17px system-ui"; ctx.fillStyle = "#ffe3a8"; ctx.textAlign = "center";
    ctx.fillText(`${Math.round(amount * 100)}%`, centerX, fighter.y - 25);
  }
  if (phase.windup) {
    ctx.globalAlpha = .5; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    ctx.arc(centerX + fighter.facing * 14, centerY, 30, fighter.facing > 0 ? -.9 : Math.PI - .9, fighter.facing > 0 ? .9 : Math.PI + .9); ctx.stroke();
  }
  if (phase.active) {
    for (const box of PlatformFighter.attackBoxes(fighter)) {
      ctx.save(); ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
      ctx.fillStyle = color; ctx.strokeStyle = "#f1fff8"; ctx.lineWidth = 2; ctx.globalAlpha = .7;
      const width = box.w / 2, height = box.h / 2, shape = phase.data.shape;
      if (shape === "ring" || shape === "wave") {
        ctx.beginPath(); ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = .18; ctx.fill();
      } else if (shape === "spike" || shape === "rise") {
        const direction = shape === "spike" ? 1 : -1;
        polygon([[-width, -height * direction], [width, -height * direction], [0, height * direction]]); ctx.fill(); ctx.stroke();
      } else {
        ctx.scale(fighter.facing, 1); ctx.beginPath(); ctx.moveTo(-width, -height);
        ctx.quadraticCurveTo(width * 1.4, -height * .5, width, height); ctx.quadraticCurveTo(width * .15, height * .3, -width, -height); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawFighter(fighter) {
  if (fighter.stocks <= 0 && state.mode !== "training") return;
  const phase = movePhase(fighter), centerX = fighter.x + fighter.w / 2, bottomY = fighter.y + fighter.h;
  if (centerX < 15 || centerX > W - 15 || bottomY < 100 || fighter.y > H - 10) {
    const x = Math.max(22, Math.min(W - 22, centerX)), y = Math.max(116, Math.min(H - 24, bottomY - 25));
    ctx.strokeStyle = fighter.color; ctx.lineWidth = 2; ctx.fillStyle = "#102036ee";
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const angle = Math.atan2(bottomY - 25 - y, centerX - x);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = fighter.color;
    polygon([[24, 0], [18, -5], [18, 5]]); ctx.fill(); ctx.restore();
    ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText(`P${fighter.id + 1}`, x, y + 5);
  }
  ctx.save();
  if (fighter.invuln > 0) ctx.globalAlpha = reducedMotion ? .65 : state.frame % 8 < 4 ? .55 : .85;
  // Every pose follows engine state; drawing never changes collision or velocity.
  ctx.translate(centerX, bottomY);
  const lean = fighter.hitstun > 0 ? Math.max(-.45, Math.min(.45, fighter.vx * .035)) : Math.max(-.18, Math.min(.18, fighter.vx * .025));
  if (!reducedMotion) ctx.rotate(lean);
  ctx.scale(fighter.facing, 1);
  const stride = fighter.onGround && Math.abs(fighter.vx) > .7 && !reducedMotion ? Math.sin(state.frame * .38) * 7 : 0;
  const crouch = phase?.windup && !fighter.move.charging ? 4 : 0, reach = phase?.active ? 22 : phase?.windup ? -6 : 5;
  ctx.fillStyle = "#080f22";
  roundedBox(-15 - stride * .5, -17 + crouch, 12, 18 - crouch, 3); ctx.fill(); roundedBox(3 + stride * .5, -17 + crouch, 12, 18 - crouch, 3); ctx.fill();
  ctx.fillStyle = fighter.color;
  roundedBox(-18 - stride * .5, -7, 15, 7, 2); ctx.fill(); roundedBox(3 + stride * .5, -7, 18, 7, 2); ctx.fill();
  ctx.globalAlpha *= .85;
  polygon([[-12, -39 + crouch], [-36 - Math.abs(fighter.vx) * 1.2, -30 + crouch], [-23, -25 + crouch], [-8, -31 + crouch]]); ctx.fill();
  ctx.globalAlpha = fighter.invuln > 0 ? .7 : 1;
  ctx.fillStyle = fighter.hitFlash > 0 ? "#efffff" : fighter.color;
  polygon([[-14, -39 + crouch], [12, -39 + crouch], [18, -19 + crouch], [9, -12 + crouch], [-11, -14 + crouch], [-18, -29 + crouch]]); ctx.fill();
  ctx.fillStyle = "#172840"; polygon([[-8, -36 + crouch], [8, -36 + crouch], [10, -21 + crouch], [-6, -20 + crouch]]); ctx.fill();
  ctx.fillStyle = "#eaffff"; polygon([[0, -33 + crouch], [5, -28 + crouch], [0, -23 + crouch], [-5, -28 + crouch]]); ctx.fill();
  ctx.fillStyle = fighter.hitFlash > 0 ? "#fff" : fighter.color; roundedBox(-12, -54 + crouch, 26, 20, 7); ctx.fill();
  ctx.fillStyle = "#0d2034"; roundedBox(-4, -49 + crouch, 22, 8, 3); ctx.fill();
  ctx.fillStyle = "#edfff8"; ctx.fillRect(4, -47 + crouch, 11, 3);
  ctx.strokeStyle = "#183449"; ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(12, -32 + crouch); ctx.lineTo(19 + reach, -24 + crouch); ctx.stroke();
  ctx.fillStyle = fighter.hitFlash > 0 ? "#fff" : fighter.color; roundedBox(14 + reach, -30 + crouch, 14, 13, 4); ctx.fill(); ctx.restore();
  if (fighter.defense) {
    ctx.save(); ctx.strokeStyle = fighter.defense.type === "parry" ? "#fff2a6" : "#b9e5ff"; ctx.lineWidth = fighter.defense.type === "parry" ? 4 : 2;
    ctx.globalAlpha = .65; ctx.beginPath(); ctx.ellipse(centerX, fighter.y + 28, 31, 38, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.textAlign = "center"; ctx.font = "bold 15px system-ui"; ctx.fillStyle = fighter.color;
  ctx.fillText(fighter.id === 0 ? "P1" : state.mode === "cpu" ? "CPU" : state.mode === "training" ? "DUMMY" : "P2", centerX, fighter.y - 10);
  drawAttack(fighter, phase);
}

function drawProjectiles() {
  for (const projectile of state.projectiles || []) {
    ctx.save(); ctx.translate(projectile.x + projectile.w / 2, projectile.y + projectile.h / 2); ctx.scale(projectile.vx < 0 ? -1 : 1, 1);
    ctx.fillStyle = projectile.color || "#bbadff"; ctx.globalAlpha = .3;
    polygon([[-30, -6], [10, -8], [16, 0], [10, 8], [-30, 6], [-16, 0]]); ctx.fill();
    ctx.globalAlpha = 1; polygon([[-10, 0], [0, -7], [13, 0], [0, 7]]); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(-1, -2, 7, 4); ctx.restore();
  }
}

function drawEffects() {
  for (const effect of state.effects || []) {
    const progress = 1 - effect.life / (effect.maxLife || 1);
    ctx.save(); ctx.translate(effect.x, effect.y); ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.strokeStyle = effect.color || "#e1fff4"; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = effect.type === "ko" ? 4 : 2;
    if (effect.type === "hit" || effect.type === "parry") {
      const radius = reducedMotion ? 23 : 14 + progress * 40;
      for (let i = 0; i < 7; i++) {
        const angle = i * Math.PI * 2 / 7; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * .45, Math.sin(angle) * radius * .45); ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.stroke();
      }
    } else {
      const radius = effect.type === "ko" ? 30 + progress * 100 : 8 + progress * 25;
      ctx.beginPath(); ctx.ellipse(0, 0, radius, effect.type === "land" ? radius * .2 : radius, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (effect.text) { ctx.font = "bold 19px system-ui"; ctx.textAlign = "center"; ctx.fillText(effect.text, 0, -24 - (reducedMotion ? 0 : progress * 18)); }
    ctx.restore();
  }
}

function drawHud() {
  for (const fighter of state.fighters) {
    const x = fighter.id === 0 ? 24 : W - 258;
    ctx.fillStyle = "#0b1728dd"; roundedBox(x, 18, 234, 81, 9); ctx.fill();
    ctx.fillStyle = fighter.color; roundedBox(x, 18, 4, 81, 2); ctx.fill();
    ctx.font = "bold 14px system-ui"; ctx.textAlign = "left"; ctx.fillStyle = "#d1dfed";
    ctx.fillText(fighter.id === 0 ? "PLAYER 1" : state.mode === "cpu" ? `CPU · ${difficultySelect.value.toUpperCase()}` : state.mode === "training" ? "PRACTICE DUMMY" : "PLAYER 2", x + 17, 41);
    ctx.font = "800 39px system-ui"; ctx.fillStyle = fighter.damage >= 100 ? "#ff8e83" : fighter.damage >= 60 ? "#ffd488" : "#f0f7ff";
    ctx.fillText(`${Math.round(fighter.damage)}%`, x + 15, 83); ctx.fillStyle = fighter.color;
    if (state.mode === "training") { ctx.font = "bold 29px system-ui"; ctx.fillText("∞", x + 185, 80); }
    else for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < fighter.stocks ? 1 : .16;
      polygon([[x + 173 + i * 19, 67], [x + 180 + i * 19, 75], [x + 173 + i * 19, 83], [x + 166 + i * 19, 75]]); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (fighter.combo >= 2 && fighter.comboTimer > 0) { ctx.font = "bold 24px system-ui"; ctx.fillStyle = "#fff0b2"; ctx.fillText(`${fighter.combo} HIT`, x + 12, 127); }
    if (fighter.labelTimer > 0 && fighter.lastMove) {
      const definition = PlatformFighter.MOVES[fighter.lastMove];
      ctx.font = "bold 15px system-ui"; ctx.fillStyle = "#b9d7e6"; ctx.textAlign = fighter.id === 0 ? "left" : "right";
      ctx.fillText(definition?.name || fighter.lastMove, fighter.id === 0 ? x + 12 : x + 220, fighter.combo >= 2 && fighter.comboTimer > 0 ? 148 : 124);
    }
  }
  ctx.textAlign = "center"; ctx.fillStyle = "#7799ad"; ctx.font = "bold 12px system-ui";
  ctx.fillText((PlatformFighter.STAGES[state.stageId]?.name || state.stageId || "ARENA").toUpperCase(), W / 2, 40);
  ctx.fillStyle = "#acd1d6"; ctx.font = "bold 18px system-ui"; ctx.fillText(state.mode === "training" ? "PRACTICE" : "3 STOCK", W / 2, 66);
}

function drawOverlay() {
  if (!paused && state.winner === null) return;
  ctx.fillStyle = "#061120a8"; ctx.fillRect(0, 108, W, H - 108); ctx.textAlign = "center";
  ctx.fillStyle = "#91f0d9"; ctx.font = "bold 13px system-ui";
  ctx.fillText(state.winner !== null ? "MATCH COMPLETE" : !started ? "READY WHEN YOU ARE" : "TAKE A BREATHER", W / 2, 225);
  ctx.fillStyle = "#f0f8ff"; ctx.font = "800 49px system-ui";
  ctx.fillText(state.winner !== null ? winnerText() : !started ? state.mode === "training" ? "Find your flow." : "Make your move." : "Paused", W / 2, 284);
  ctx.fillStyle = "#b1c8db"; ctx.font = "19px system-ui";
  ctx.fillText(state.winner !== null ? "Rematch below" : !started ? state.mode === "training" ? "Start practice below · No stocks to lose" : state.mode === "versus" ? "Share a keyboard · Play 2P below" : "Play CPU or learn with First steps below" : "Resume below or press P", W / 2, 324);
}

function draw() {
  ctx.clearRect(0, 0, W, H); drawBackdrop(); ctx.save();
  if (!reducedMotion && !paused && state.shake > 0) {
    const shake = Math.min(7, state.shake); ctx.translate(Math.sin(state.frame * 2.4) * shake, Math.cos(state.frame * 1.8) * shake * .6);
  }
  drawStage(); for (const fighter of state.fighters) drawFighter(fighter);
  drawProjectiles(); drawEffects(); ctx.restore(); drawHud(); drawOverlay();
}

function loop(now) {
  if (!paused && previousFrame !== null) accumulatedTime += Math.min(100, Math.max(0, now - previousFrame));
  previousFrame = now;
  while (!paused && accumulatedTime + .0001 >= STEP_MS) { accumulatedTime -= STEP_MS; update(); }
  draw(); requestAnimationFrame(loop);
}

const controlledCodes = new Set(controlsByPlayer.flatMap(player => Object.values(player).flat()));
const keyFallback = { a: "KeyA", d: "KeyD", w: "KeyW", s: "KeyS", " ": "Space", f: "KeyF", g: "KeyG", h: "KeyH", r: "KeyR", p: "KeyP", j: "KeyJ", k: "KeyK", l: "KeyL", arrowleft: "ArrowLeft", arrowright: "ArrowRight", arrowup: "ArrowUp", arrowdown: "ArrowDown", enter: "Enter", "/": "Slash", ".": "Period", ",": "Comma", escape: "Escape" };
function eventCode(event) { return event.code || keyFallback[String(event.key).toLowerCase()] || ""; }
function isFormTarget(target) { return target?.isContentEditable || target?.closest?.("button,a[href],summary,input,textarea,select"); }

window.addEventListener("keydown", event => {
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || isFormTarget(event.target)) return;
  const code = eventCode(event);
  if (code === "KeyP" || code === "Escape") {
    if (!event.repeat) { if (code === "Escape") setPaused(true); else playPause(); } event.preventDefault(); return;
  }
  if (!controlledCodes.has(code)) return;
  event.preventDefault();
  if (event.repeat || paused || !started || state.winner !== null) return;
  const alreadyHeld = keys.has(code);
  keys.add(code);
  if (!alreadyHeld) for (let index = 0; index < 2; index++) {
    const action = Object.keys(controlsByPlayer[index]).find(action => controlsByPlayer[index][action].includes(code));
    if (action) latchPress(index, action, "keyboard");
  }
});
window.addEventListener("keyup", event => { keys.delete(eventCode(event)); });
window.addEventListener("blur", () => setPaused(true));
document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });

function syncTouchButtons() {
  for (const button of touchButtons) button.classList.toggle("held", [...touchPointers.values()].includes(button.dataset.action) || touchPulses.has(button.dataset.action));
}
for (const button of touchButtons) {
  button.addEventListener("pointerdown", event => {
    if (event.button !== 0 || paused || !started || state.winner !== null) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); touchPointers.set(event.pointerId, button.dataset.action);
    latchPress(0, button.dataset.action, event.pointerId); syncTouchButtons();
  });
  const release = (event, cancelled = false) => {
    const action = touchPointers.get(event.pointerId);
    touchPointers.delete(event.pointerId);
    if (cancelled && action) {
      if (pendingPresses[0].get(action)?.source === event.pointerId) pendingPresses[0].delete(action);
      if (pendingDirections[0]?.source === event.pointerId) pendingDirections[0] = null;
    }
    syncTouchButtons();
  };
  button.addEventListener("pointerup", event => release(event));
  button.addEventListener("pointercancel", event => release(event, true));
  button.addEventListener("lostpointercapture", event => release(event, true));
  button.addEventListener("click", event => {
    // Keyboard / assistive activation is a short held input; pointer holds use capture.
    if (event.detail === 0 && !paused && started && state.winner === null) {
      touchPulses.set(button.dataset.action, 1); latchPress(0, button.dataset.action, "activation"); syncTouchButtons();
    }
  });
}

function resumeAudio() {
  if (!soundEnabled || !audioContext) return;
  const result = audioContext.resume(); if (result?.catch) result.catch(reportSoundFailure);
}
function reportSoundFailure() {
  soundEnabled = false;
  soundStatus.textContent = "Audio unavailable. Try enabling sound again.";
  soundStatus.hidden = false;
  updateSoundLabel();
}
function updateSoundLabel() {
  soundBtn.textContent = soundEnabled ? "Sound on" : "Sound off"; soundBtn.setAttribute("aria-pressed", String(soundEnabled));
  soundBtn.setAttribute("aria-label", soundEnabled ? "Mute synthesized game sound" : "Enable synthesized game sound");
}
function playEvents(events) {
  if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
  const notes = { hit: [210, 60, .1, "triangle"], parry: [780, 1450, .13, "sine"], ko: [240, 42, .3, "sawtooth"], jump: [210, 470, .07, "sine"], attack: [170, 90, .045, "triangle"], win: [400, 800, .35, "sine"], tech: [560, 920, .09, "sine"] };
  for (const event of events) {
    if (!notes[event.type] || activeVoices >= 10) continue;
    const [from, to, duration, type] = notes[event.type], oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
    oscillator.type = type; oscillator.frequency.setValueAtTime(from, now); oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(event.type === "ko" ? .055 : .035, now + .005); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination); activeVoices++; oscillators.add(oscillator);
    oscillator.onended = () => { activeVoices--; oscillators.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(); oscillator.stop(now + duration + .02);
  }
}
soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundStatus.textContent = "";
  soundStatus.hidden = true;
  if (soundEnabled) {
    const AudioAPI = window.AudioContext || window.webkitAudioContext;
    if (!AudioAPI) reportSoundFailure();
    else {
      try { audioContext ||= new AudioAPI(); resumeAudio(); }
      catch { reportSoundFailure(); }
    }
  } else {
    // Stop current notes rather than freezing them for playback on the next unmute.
    for (const oscillator of oscillators) oscillator.stop();
  }
  updateSoundLabel();
});
motionToggle.addEventListener("change", () => { motionOverridden = true; reducedMotion = motionToggle.checked; });
motionPreference.addEventListener?.("change", event => { if (!motionOverridden) { reducedMotion = event.matches; motionToggle.checked = reducedMotion; } });
resetBtn.addEventListener("click", () => resetMatch(true));
learnBtn.addEventListener("click", () => {
  modeSelect.value = "training";
  practiceSelect.value = "basics";
  resetMatch(true);
});
pauseBtn.addEventListener("click", playPause);
modeSelect.addEventListener("change", () => resetMatch());
stageSelect.addEventListener("change", () => resetMatch());
difficultySelect.addEventListener("change", () => resetMatch());
practiceSelect.addEventListener("change", () => resetMatch());
resetMatch(); requestAnimationFrame(loop);
