const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const resetBtn = document.getElementById("resetBtn");

const W = canvas.width;
const H = canvas.height;

const keys = new Set();

const config = {
  gravity: 0.75,
  friction: 0.82,
  groundFriction: 0.72,
  airControl: 0.65,
  maxFallSpeed: 15,
  blastZone: 180
};

const stage = {
  platforms: [
    { x: 180, y: 430, w: 600, h: 32 },
    { x: 290, y: 330, w: 160, h: 20 },
    { x: 510, y: 330, w: 160, h: 20 },
    { x: 405, y: 245, w: 150, h: 18 }
  ]
};

const fighters = [
  {
    name: "Blue",
    color: "#5aa7ff",
    x: 320,
    y: 360,
    vx: 0,
    vy: 0,
    w: 42,
    h: 56,
    facing: 1,
    jumps: 2,
    damage: 0,
    stocks: 3,
    attackCooldown: 0,
    hitstun: 0,
    controls: {
      left: "a",
      right: "d",
      jump: "w",
      attack: "f"
    }
  },
  {
    name: "Red",
    color: "#ff6b6b",
    x: 600,
    y: 360,
    vx: 0,
    vy: 0,
    w: 42,
    h: 56,
    facing: -1,
    jumps: 2,
    damage: 0,
    stocks: 3,
    attackCooldown: 0,
    hitstun: 0,
    controls: {
      left: "arrowleft",
      right: "arrowright",
      jump: "arrowup",
      attack: "/"
    }
  }
];

function resetMatch() {
  fighters[0].x = 320;
  fighters[0].y = 360;
  fighters[0].damage = 0;
  fighters[0].stocks = 3;

  fighters[1].x = 600;
  fighters[1].y = 360;
  fighters[1].damage = 0;
  fighters[1].stocks = 3;

  for (const f of fighters) {
    f.vx = 0;
    f.vy = 0;
    f.jumps = 2;
    f.hitstun = 0;
    f.attackCooldown = 0;
  }
}

function respawn(fighter, index) {
  fighter.x = index === 0 ? 320 : 600;
  fighter.y = 180;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.damage = 0;
  fighter.jumps = 2;
  fighter.hitstun = 45;
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function applyInput(f) {
  if (f.hitstun > 0) return;

  const accel = f.onGround ? 1.15 : 1.15 * config.airControl;

  if (keys.has(f.controls.left)) {
    f.vx -= accel;
    f.facing = -1;
  }

  if (keys.has(f.controls.right)) {
    f.vx += accel;
    f.facing = 1;
  }

  if (keys.has(f.controls.attack) && f.attackCooldown <= 0) {
    attack(f);
  }
}

function jump(f) {
  if (f.jumps <= 0) return;

  f.vy = -14.5;
  f.jumps--;
  f.onGround = false;
}

function attack(attacker) {
  attacker.attackCooldown = 28;

  const hitbox = {
    x: attacker.facing === 1 ? attacker.x + attacker.w : attacker.x - 46,
    y: attacker.y + 12,
    w: 46,
    h: 32
  };

  for (const victim of fighters) {
    if (victim === attacker) continue;

    if (rectsOverlap(hitbox, victim)) {
      const knockback = 8 + victim.damage * 0.12;
      victim.vx = attacker.facing * knockback;
      victim.vy = -7 - victim.damage * 0.04;
      victim.damage += 11;
      victim.hitstun = 16;
    }
  }
}

function physics(f) {
  f.onGround = false;

  f.vy += config.gravity;
  f.vy = Math.min(f.vy, config.maxFallSpeed);

  f.x += f.vx;
  f.y += f.vy;

  for (const p of stage.platforms) {
    const falling = f.vy >= 0;
    const wasAbove = f.y + f.h - f.vy <= p.y;

    if (
      falling &&
      wasAbove &&
      f.x + f.w > p.x &&
      f.x < p.x + p.w &&
      f.y + f.h >= p.y &&
      f.y + f.h <= p.y + p.h + 18
    ) {
      f.y = p.y - f.h;
      f.vy = 0;
      f.onGround = true;
      f.jumps = 2;
    }
  }

  f.vx *= f.onGround ? config.groundFriction : config.friction;

  if (Math.abs(f.vx) < 0.05) f.vx = 0;

  if (
    f.x < -config.blastZone ||
    f.x > W + config.blastZone ||
    f.y > H + config.blastZone
  ) {
    const index = fighters.indexOf(f);
    f.stocks--;
    if (f.stocks > 0) respawn(f, index);
  }

  if (f.attackCooldown > 0) f.attackCooldown--;
  if (f.hitstun > 0) f.hitstun--;
}

function update() {
  for (const f of fighters) {
    if (f.stocks <= 0) continue;
    applyInput(f);
    physics(f);
  }
}

function drawStage() {
  ctx.fillStyle = "#27304a";
  for (const p of stage.platforms) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#39466c";
    ctx.fillRect(p.x, p.y, p.w, 5);
    ctx.fillStyle = "#27304a";
  }
}

function drawFighter(f) {
  if (f.stocks <= 0) return;

  ctx.fillStyle = f.color;
  ctx.fillRect(f.x, f.y, f.w, f.h);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(f.x + (f.facing === 1 ? 27 : 8), f.y + 14, 8, 8);

  if (f.attackCooldown > 16) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    const ax = f.facing === 1 ? f.x + f.w + 8 : f.x - 8;
    ctx.beginPath();
    ctx.arc(ax, f.y + 28, 20, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHud() {
  ctx.font = "22px system-ui";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`P1 ${fighters[0].damage}% · Stocks: ${fighters[0].stocks}`, 28, 38);
  ctx.fillText(`P2 ${fighters[1].damage}% · Stocks: ${fighters[1].stocks}`, W - 300, 38);

  const winner =
    fighters[0].stocks <= 0 ? "Player 2 wins" :
    fighters[1].stocks <= 0 ? "Player 1 wins" :
    null;

  if (winner) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#ffffff";
    ctx.font = "48px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(winner, W / 2, H / 2);
    ctx.font = "22px system-ui";
    ctx.fillText("Press Reset", W / 2, H / 2 + 44);
    ctx.textAlign = "left";
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawStage();

  for (const f of fighters) {
    drawFighter(f);
  }

  drawHud();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  keys.add(key);

  for (const f of fighters) {
    if (key === f.controls.jump) {
      jump(f);
    }
  }

  if (
    ["arrowleft", "arrowright", "arrowup", " "].includes(key)
  ) {
    e.preventDefault();
  }
});

window.addEventListener("keyup", e => {
  keys.delete(e.key.toLowerCase());
});

resetBtn.addEventListener("click", resetMatch);

loop();
