(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FighterCPU = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Difficulty changes reactions and judgement, never damage, speed or resources.
  const DIFFICULTIES = Object.freeze({
    easy: Object.freeze({ reaction: 18, mistake: 0.27, defend: 0.24, charge: 12 }),
    normal: Object.freeze({ reaction: 10, mistake: 0.12, defend: 0.52, charge: 21 }),
    hard: Object.freeze({ reaction: 6, mistake: 0.04, defend: 0.72, charge: 28 })
  });
  const controllers = new WeakMap();
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const sign = n => n < 0 ? -1 : n > 0 ? 1 : 0;
  const neutral = () => ({ x: 0, y: 0, jump: false, light: false,
    strong: false, special: false, dodge: false });

  function controller(state, index, level) {
    let all = controllers.get(state);
    if (!all) { all = new Map(); controllers.set(state, all); }
    let c = all.get(index);
    if (!c || state.frame < c.frame || c.level !== level) {
      c = { level, frame: -1, rng: (0x21f0aaad ^ (index + 1) * 2654435761) >>> 0,
        history: [], nextThink: state.frame + DIFFICULTIES[level].reaction,
        plan: neutral(), pulse: null, chargeUntil: -1, jumpUntil: -1,
        nextAction: -1, nextJump: -1, nextDodge: -1, nextSpecial: -1,
        output: neutral(), chargeDirection: { x: 0, y: 0 } };
      all.set(index, c);
    }
    return c;
  }

  function random(c) {
    // Per-match PRNG: identical observed histories produce identical decisions.
    c.rng = (Math.imul(c.rng, 1664525) + 1013904223) >>> 0;
    return c.rng / 4294967296;
  }

  function observe(state, opponent) {
    return { frame: state.frame, target: {
      x: opponent.x, y: opponent.y, w: opponent.w, h: opponent.h,
      vx: opponent.vx, vy: opponent.vy, damage: opponent.damage,
      onGround: opponent.onGround, hitstun: opponent.hitstun,
      landingLag: opponent.landingLag,
      move: opponent.move ? { id: opponent.move.id, frame: opponent.move.frame } : null
    }, projectiles: (state.projectiles || []).filter(p => p.owner === opponent.id)
      .slice(0, 32).map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy })) };
  }

  function press(c, frame, key, x, y, hold = 1) {
    c.plan.x = x;
    c.plan.y = y;
    c.pulse = { key, frame };
    c.nextAction = frame + 9;
    if (key === 'strong') {
      c.chargeUntil = frame + hold;
      c.chargeDirection = { x, y };
      c.nextAction = c.chargeUntil + 9;
    }
    if (key === 'jump') {
      c.jumpUntil = frame + hold;
      c.nextJump = frame + 18;
    }
    if (key === 'special') c.nextSpecial = frame + 65;
    if (key === 'dodge') c.nextDodge = frame + 58;
  }

  function floorOf(state) {
    return (state.platforms || []).find(p => p.solid) ||
      { x: 170, y: 435, w: 620, h: 28, solid: true };
  }

  function ready(fighter, c, frame) {
    return !fighter.move && !fighter.defense && !(fighter.hitstun > 0) &&
      !(fighter.landingLag > 0) && frame >= c.nextAction;
  }

  function recover(state, me, c, floor) {
    const frame = state.frame;
    const center = me.x + me.w / 2;
    const outside = center < floor.x + 13 || center > floor.x + floor.w - 13;
    const below = me.y + me.h > floor.y + 12;
    if (me.onGround || (!outside && !below)) return false;

    const target = clamp(center, floor.x + 80, floor.x + floor.w - 80);
    c.plan.x = sign(target - center);
    c.plan.y = 0;
    if (!ready(me, c, frame)) return true;
    if (me.jumps > 0 && frame >= c.nextJump && (me.vy > -2 || below)) {
      press(c, frame, 'jump', c.plan.x, 0, 12);
    } else if (!me.recoveryUsed && !(me.specialCooldown > 0) &&
      frame >= c.nextSpecial && (me.jumps === 0 || below) && me.vy > -3) {
      press(c, frame, 'special', c.plan.x, -1);
    }
    return true;
  }

  function decide(state, me, seen, c, profile, floor) {
    const frame = state.frame;
    const target = seen.target;
    const dx = target.x + target.w / 2 - me.x - me.w / 2;
    const dy = target.y + target.h / 2 - me.y - me.h / 2;
    const distance = Math.abs(dx);
    const toward = sign(dx);
    c.plan = neutral();
    c.plan.x = distance > 61 ? toward : 0;

    // Stay on stage when an opponent baits a chase beyond the ledge.
    const targetOffstage = target.x + target.w < floor.x ||
      target.x > floor.x + floor.w;
    if (targetOffstage && me.onGround && me.platform === 0 && distance < 160) {
      c.plan.x = 0;
    }
    if (me.hitstun > 0) {
      c.plan.x = sign(floor.x + floor.w / 2 - me.x - me.w / 2);
      return;
    }
    if (!ready(me, c, frame)) return;

    const threat = distance < 105 && Math.abs(dy) < 78 && target.move;
    const projectileThreat = seen.projectiles.some(p => Math.abs(p.y - me.y - me.h / 2) < 42 &&
      Math.abs(p.x - me.x - me.w / 2) < 155 && sign(p.vx) === sign(me.x - p.x));
    if ((threat || projectileThreat) && frame >= c.nextDodge && random(c) < profile.defend &&
      (me.onGround || !me.airDodgeUsed)) {
      // A readable mix of stationary parries and rolls; recovery remains punishable.
      press(c, frame, 'dodge', random(c) < 0.6 ? 0 : -toward, 0);
      return;
    }

    // An imperfect read occasionally produces a hesitation or a whiff.
    if (random(c) < profile.mistake) {
      if (distance < 130 && Math.abs(dy) < 90) press(c, frame, 'light', toward, 0);
      else c.plan.x = 0;
      return;
    }

    if (me.onGround && me.platform > 0 && dy > 65 && distance < 135 && frame >= c.nextJump) {
      press(c, frame, 'jump', toward, 1, 1);
      return;
    }
    if (me.onGround && dy < -75 && distance < 170 && frame >= c.nextJump) {
      press(c, frame, 'jump', toward, 0, 12);
      return;
    }

    if (!me.onGround) {
      if (distance < 81 && Math.abs(dy) < 105) {
        const y = dy < -35 ? -1 : dy > 35 ? 1 : 0;
        press(c, frame, 'light', y || random(c) < 0.28 ? 0 : toward, y);
      } else if (dy < -105 && distance < 100 && me.jumps > 0 && frame >= c.nextJump) {
        press(c, frame, 'jump', toward, 0, 10);
      } else if (me.vy > 1 && me.y + me.h < floor.y - 70 && dy > 45) {
        c.plan.y = 1;
      }
      return;
    }

    if (distance < 87 && Math.abs(dy) < 85) {
      const choice = random(c);
      if (dy < -30) press(c, frame, 'light', 0, -1);
      else if ((target.damage >= 65 || target.hitstun > 5 || target.landingLag > 8) && choice < 0.45) {
        press(c, frame, 'strong', toward, choice < 0.14 ? -1 : distance < 48 && choice > 0.3 ? 1 : 0,
          Math.round(profile.charge * (0.5 + random(c) * 0.5)));
      } else if (distance < 60 && choice > 0.86 && !(me.specialCooldown > 0) && frame >= c.nextSpecial) {
        press(c, frame, 'special', 0, 1);
      } else if (choice < 0.3) press(c, frame, 'light', 0, -1);
      else if (choice < 0.55) press(c, frame, 'light', 0, 1);
      else if (distance < 47 && choice < 0.8) press(c, frame, 'light', 0, 0);
      else press(c, frame, 'light', toward, 0);
      return;
    }

    if (Math.abs(dy) < 75 && !(me.specialCooldown > 0) && frame >= c.nextSpecial) {
      const safeBurst = me.x > floor.x + 95 && me.x + me.w < floor.x + floor.w - 95;
      if (distance > 145 && distance < 360 && random(c) < 0.5) {
        // Neutral special keeps the last facing; turn before firing when necessary.
        if (me.facing === toward) press(c, frame, 'special', 0, 0);
        else c.plan.x = toward;
        return;
      }
      if (distance >= 87 && distance < 145 && safeBurst && random(c) < 0.35) {
        press(c, frame, 'special', toward, 0);
        return;
      }
    }
    if (distance > 85 && distance < 185 && Math.abs(dy) < 65 &&
      frame >= c.nextJump && random(c) < 0.19) {
      press(c, frame, 'jump', toward, 0, random(c) < 0.5 ? 3 : 10);
    }
  }

  function input(state, index, difficulty = 'normal') {
    if (!state || !Array.isArray(state.fighters) || state.winner != null || state.mode === 'training') return neutral();
    const me = state.fighters[index];
    const opponent = state.fighters.find((f, i) => i !== index && f.stocks > 0);
    if (!me || me.stocks <= 0 || !opponent) return neutral();
    const level = Object.hasOwn(DIFFICULTIES, difficulty) ? difficulty : 'normal';
    const profile = DIFFICULTIES[level];
    const c = controller(state, index, level);
    if (c.frame === state.frame) return { ...c.output };
    const frame = state.frame;
    c.frame = frame;
    c.history.push(observe(state, opponent));
    while (c.history.length > 1 && c.history[1].frame <= frame - profile.reaction) c.history.shift();
    const floor = floorOf(state);
    const recovering = recover(state, me, c, floor);
    if (!recovering && frame >= c.nextThink) {
      decide(state, me, c.history[0], c, profile, floor);
      c.nextThink = frame + profile.reaction + Math.floor(random(c) * 4);
    }

    const result = neutral();
    result.x = c.plan.x;
    result.y = c.plan.y;
    if (c.pulse && c.pulse.frame === frame) result[c.pulse.key] = true;
    if (frame < c.jumpUntil) result.jump = true;
    if (frame < c.chargeUntil && !(me.hitstun > 0)) {
      result.strong = true;
      result.x = c.chargeDirection.x;
      result.y = c.chargeDirection.y;
    }
    if (me.hitstun > 0) {
      result.jump = result.light = result.strong = result.special = result.dodge = false;
      c.chargeUntil = c.jumpUntil = -1;
    }

    // This self-preservation guard uses only the CPU's position, not hidden input.
    if (me.onGround && me.platform === 0) {
      const margin = 27 + Math.max(0, Math.abs(me.vx || 0) * 3);
      if ((result.x < 0 && me.x < floor.x + margin) ||
        (result.x > 0 && me.x + me.w > floor.x + floor.w - margin)) result.x = 0;
    }
    result.x = clamp(result.x || 0, -1, 1);
    result.y = clamp(result.y || 0, -1, 1);
    c.output = result;
    return { ...result };
  }

  function reset(state, index) {
    if (index === undefined) controllers.delete(state);
    else controllers.get(state)?.delete(index);
  }

  return { input, reset, DIFFICULTIES };
});
