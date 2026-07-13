(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startOverlay = document.getElementById('startOverlay');
  const resultOverlay = document.getElementById('resultOverlay');
  const resultText = document.getElementById('resultText');
  const pauseBtn = document.getElementById('pauseBtn');

  const W = canvas.width, H = canvas.height;
  const LANES = 5;
  const FIELD_TOP = 132;
  const FIELD_BOTTOM = 650;
  const LANE_H = (FIELD_BOTTOM - FIELD_TOP) / LANES;
  const CRYSTAL_HP = 20;
  const MAX_BULLETS = 3;
  const CHARGE_MS = 700;
  const STUN_MS = 450;
  const WALL_X = [260, W - 260];
  const PLAYER_X = [205, W - 205];
  const CRYSTAL_X = [78, W - 78];

  const attackData = {
    a: { speed: 330, label: 'A' },
    b: { speed: 510, label: 'B' },
    c: { speed: 720, label: 'C' }
  };

  const images = {};
  ['idle', 'guard', 'attack_a', 'attack_b', 'attack_c', 'hit'].forEach(name => {
    const img = new Image();
    img.src = `assets/${name}.png`;
    images[name] = img;
  });

  const state = {
    running: false,
    paused: false,
    last: performance.now(),
    time: 0,
    players: [],
    bullets: [],
    particles: [],
    shake: 0,
    winner: null
  };

  function makePlayer(side) {
    return {
      side,
      lane: side === 0 ? 2 : 2,
      hp: CRYSTAL_HP,
      guarding: false,
      guardTap: -9999,
      wall: null,
      stunUntil: 0,
      charge: null,
      pose: 'idle',
      poseUntil: 0,
      moveLockUntil: 0
    };
  }

  function resetGame(autoStart = false) {
    state.players = [makePlayer(0), makePlayer(1)];
    state.bullets = [];
    state.particles = [];
    state.shake = 0;
    state.winner = null;
    state.paused = false;
    pauseBtn.textContent = '一時停止';
    resultOverlay.classList.remove('show');
    state.running = autoStart;
    if (!autoStart) startOverlay.classList.add('show');
  }

  const laneY = lane => FIELD_TOP + LANE_H * (lane + .5);

  function activeBulletCount(side) {
    return state.bullets.filter(b => b.side === side && !b.dead).length;
  }

  function move(side, delta) {
    if (!state.running || state.paused) return;
    const p = state.players[side];
    const now = performance.now();
    if (now < p.stunUntil || now < p.moveLockUntil) return;
    p.lane = Math.max(0, Math.min(LANES - 1, p.lane + delta));
    p.moveLockUntil = now + 95;
  }

  function beginAttack(side, type) {
    if (!state.running || state.paused) return;
    const p = state.players[side];
    const now = performance.now();
    if (p.charge || now < p.stunUntil || activeBulletCount(side) >= MAX_BULLETS) return;
    p.charge = { type, started: now };
  }

  function releaseAttack(side, type) {
    const p = state.players[side];
    if (!p.charge || p.charge.type !== type) return;
    const now = performance.now();
    if (!state.running || state.paused || now < p.stunUntil || activeBulletCount(side) >= MAX_BULLETS) {
      p.charge = null;
      return;
    }
    const held = now - p.charge.started;
    const charged = held >= CHARGE_MS;
    const damage = charged ? 5 : 3;
    const direction = side === 0 ? 1 : -1;
    state.bullets.push({
      side, lane: p.lane, x: PLAYER_X[side] + direction * 58, y: laneY(p.lane),
      vx: attackData[type].speed * direction, damage, maxDamage: damage,
      radius: charged ? 24 : 13, type, dead: false, trail: 0,
      outerLane: p.lane === 0 || p.lane === 4, homing: false
    });
    p.pose = `attack_${type}`;
    p.poseUntil = now + 180;
    p.charge = null;
    burst(PLAYER_X[side] + direction * 36, laneY(p.lane), side === 0 ? '#79ecff' : '#ff91df', 8, direction);
  }

  function guardDown(side) {
    if (!state.running || state.paused) return;
    const p = state.players[side];
    const now = performance.now();
    if (now < p.stunUntil) return;
    if (now - p.guardTap < 310) {
      p.wall = { lane: p.lane, alive: true, born: now };
      p.guardTap = -9999;
      burst(WALL_X[side], laneY(p.lane), '#b8f6ff', 16, side === 0 ? 1 : -1);
    } else {
      p.guardTap = now;
    }
    p.guarding = true;
  }

  function guardUp(side) {
    state.players[side].guarding = false;
  }

  const keyMap = {
    KeyW: [0, 'up'], KeyS: [0, 'down'], KeyA: [0, 'a'], KeyD: [0, 'b'], KeyF: [0, 'c'], KeyG: [0, 'guard'],
    ArrowUp: [1, 'up'], ArrowDown: [1, 'down'], KeyJ: [1, 'a'], KeyK: [1, 'b'], KeyL: [1, 'c'], KeyI: [1, 'guard']
  };
  const heldKeys = new Set();

  window.addEventListener('keydown', e => {
    const map = keyMap[e.code];
    if (!map) return;
    e.preventDefault();
    if (heldKeys.has(e.code)) return;
    heldKeys.add(e.code);
    const [side, action] = map;
    if (action === 'up') move(side, -1);
    else if (action === 'down') move(side, 1);
    else if (action === 'guard') guardDown(side);
    else beginAttack(side, action);
  });
  window.addEventListener('keyup', e => {
    const map = keyMap[e.code];
    if (!map) return;
    heldKeys.delete(e.code);
    const [side, action] = map;
    if (action === 'guard') guardUp(side);
    else if (attackData[action]) releaseAttack(side, action);
  });
  window.addEventListener('blur', () => {
    heldKeys.clear();
    state.players.forEach(p => { p.guarding = false; if (p.charge) p.charge = null; });
  });

  document.querySelectorAll('.touch-controls button').forEach(btn => {
    const side = Number(btn.dataset.p), action = btn.dataset.action;
    const down = e => {
      e.preventDefault();
      if (action === 'up') move(side, -1);
      else if (action === 'down') move(side, 1);
      else if (action === 'guard') guardDown(side);
      else beginAttack(side, action);
    };
    const up = e => {
      e.preventDefault();
      if (action === 'guard') guardUp(side);
      else if (attackData[action]) releaseAttack(side, action);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', e => { if (e.buttons) up(e); });
  });

  function burst(x, y, color, count = 10, dir = 0) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 170;
      state.particles.push({ x, y, vx: Math.cos(a) * speed + dir * 55, vy: Math.sin(a) * speed, life: .3 + Math.random() * .45, max: .75, color, size: 2 + Math.random() * 5 });
    }
  }

  function hitPlayer(p, b, now) {
    if (p.guarding) {
      burst(PLAYER_X[p.side], laneY(p.lane), '#c9fbff', 15, -Math.sign(b.vx));
      b.dead = true;
      return;
    }
    p.stunUntil = now + STUN_MS;
    p.pose = 'hit';
    p.poseUntil = now + STUN_MS;
    p.charge = null;
    b.dead = true;
    state.shake = 7;
    burst(PLAYER_X[p.side], laneY(p.lane), '#ffffff', 18, -Math.sign(b.vx));
  }

  function damageCrystal(defender, b) {
    defender.hp = Math.max(0, defender.hp - b.damage);
    b.dead = true;
    state.shake = 12;
    burst(CRYSTAL_X[defender.side], b.y, defender.side === 0 ? '#6feaff' : '#ff7fd9', 26, -Math.sign(b.vx));
    if (defender.hp <= 0 && state.winner === null) finish(1 - defender.side);
  }

  function finish(winner) {
    state.winner = winner;
    state.running = false;
    resultText.textContent = `PLAYER ${winner + 1} WIN`;
    setTimeout(() => resultOverlay.classList.add('show'), 450);
  }

  function update(dt, now) {
    if (!state.running || state.paused) return;
    state.time += dt;
    state.shake *= Math.pow(.001, dt);

    for (const p of state.players) {
      if (now > p.poseUntil) p.pose = p.guarding ? 'guard' : 'idle';
      if (p.guarding && now >= p.stunUntil) p.pose = 'guard';
    }

    for (const b of state.bullets) {
      if (b.dead) continue;
      b.x += b.vx * dt;
      b.trail += dt;

      // 1・5レーンの弾は敵陣の終盤で中央レーンへ収束する。
      if (b.outerLane) {
        const triggerX = b.side === 0 ? W * 0.68 : W * 0.32;
        if ((b.side === 0 && b.x >= triggerX) || (b.side === 1 && b.x <= triggerX)) b.homing = true;
        if (b.homing) {
          const targetY = laneY(2);
          const dy = targetY - b.y;
          const maxStep = 360 * dt;
          b.y += Math.sign(dy) * Math.min(Math.abs(dy), maxStep);
          if (Math.abs(dy) < 3) { b.y = targetY; b.lane = 2; b.outerLane = false; }
        } else {
          b.y = laneY(b.lane);
        }
      } else {
        b.y = laneY(b.lane);
      }

      const defender = state.players[1 - b.side];
      const wall = defender.wall;
      if (wall && wall.alive && Math.abs(b.y - laneY(wall.lane)) < LANE_H * .38 && Math.abs(b.x - WALL_X[defender.side]) < Math.abs(b.vx * dt) + 18) {
        wall.alive = false;
        b.dead = true;
        burst(WALL_X[defender.side], b.y, '#b9f8ff', 24, -Math.sign(b.vx));
        continue;
      }

      if (Math.abs(b.y - laneY(defender.lane)) < 38 && Math.abs(b.x - PLAYER_X[defender.side]) < 46) {
        hitPlayer(defender, b, now);
        continue;
      }

      const crystalLane = Math.abs(b.y - laneY(2)) <= LANE_H * 1.48;
      if (crystalLane && Math.abs(b.x - CRYSTAL_X[defender.side]) < 38) {
        damageCrystal(defender, b);
        continue;
      }
      if (b.x < -80 || b.x > W + 80) b.dead = true;
    }

    for (let i = 0; i < state.bullets.length; i++) {
      const a = state.bullets[i];
      if (a.dead) continue;
      for (let j = i + 1; j < state.bullets.length; j++) {
        const b = state.bullets[j];
        if (b.dead || a.side === b.side) continue;
        if (Math.abs(a.y - b.y) <= a.radius + b.radius && Math.abs(a.x - b.x) <= a.radius + b.radius) {
          if (a.damage === b.damage) {
            a.dead = b.dead = true;
            burst((a.x + b.x) / 2, a.y, '#dffcff', 20);
          } else {
            const strong = a.damage > b.damage ? a : b;
            const weak = strong === a ? b : a;
            weak.dead = true;
            strong.damage = Math.max(2, strong.damage - weak.damage);
            strong.radius = 10;
            burst((a.x + b.x) / 2, a.y, '#bff7ff', 14, Math.sign(strong.vx));
          }
        }
      }
    }
    state.bullets = state.bullets.filter(b => !b.dead);

    for (const p of state.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.07, dt); p.vy *= Math.pow(.07, dt); p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);
  }

  function roundedRect(x, y, w, h, r) {
    // Safari 14など、CanvasRenderingContext2D.roundRect未対応環境向けのフォールバック
    const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#071a35'); grad.addColorStop(.45, '#071124'); grad.addColorStop(1, '#020711');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = .18;
    for (let i = 0; i < 45; i++) {
      const x = (i * 191 + state.time * 8) % W;
      const y = 50 + ((i * 83) % 580);
      ctx.fillStyle = i % 3 ? '#8deeff' : '#ff95de';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();

    for (let lane = 0; lane < LANES; lane++) {
      const y = FIELD_TOP + lane * LANE_H;
      ctx.fillStyle = lane % 2 ? 'rgba(35,104,158,.055)' : 'rgba(120,225,255,.025)';
      ctx.fillRect(0, y, W, LANE_H);
      ctx.strokeStyle = 'rgba(125,207,255,.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, FIELD_BOTTOM); ctx.lineTo(W, FIELD_BOTTOM); ctx.stroke();
    ctx.strokeStyle = 'rgba(180,238,255,.12)';
    ctx.setLineDash([7, 11]);
    ctx.beginPath(); ctx.moveTo(W / 2, FIELD_TOP); ctx.lineTo(W / 2, FIELD_BOTTOM); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHUD() {
    const p1 = state.players[0], p2 = state.players[1];
    ctx.font = '800 22px system-ui';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eaffff';
    ctx.fillText('PLAYER 1', 32, 38);
    ctx.textAlign = 'right'; ctx.fillText('PLAYER 2', W - 32, 38); ctx.textAlign = 'left';

    const barW = 430, barH = 22, y = 66;
    drawHpBar(32, y, barW, barH, p1.hp / CRYSTAL_HP, 0);
    drawHpBar(W - 32 - barW, y, barW, barH, p2.hp / CRYSTAL_HP, 1);
    ctx.font = '900 17px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(`HP ${p1.hp} / 20`, 44, y + barH / 2);
    ctx.textAlign = 'right'; ctx.fillText(`HP ${p2.hp} / 20`, W - 44, y + barH / 2); ctx.textAlign = 'left';

    ctx.font = '700 13px system-ui';
    ctx.fillStyle = '#8fb5c8';
    ctx.fillText(`BULLETS ${activeBulletCount(0)} / 3`, 34, 107);
    ctx.textAlign = 'right'; ctx.fillText(`BULLETS ${activeBulletCount(1)} / 3`, W - 34, 107); ctx.textAlign = 'left';
  }

  function drawHpBar(x, y, w, h, ratio, side) {
    roundedRect(x, y, w, h, 11); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
    const inner = Math.max(0, (w - 4) * ratio);
    const ix = side === 0 ? x + 2 : x + w - 2 - inner;
    const g = ctx.createLinearGradient(x, y, x + w, y);
    if (side === 0) { g.addColorStop(0, '#2879ff'); g.addColorStop(1, '#66ecff'); }
    else { g.addColorStop(0, '#ff6fd0'); g.addColorStop(1, '#8f64ff'); }
    roundedRect(ix, y + 2, inner, h - 4, 9); ctx.fillStyle = g; ctx.fill();
  }

  function drawCrystal(side, hp) {
    const x = CRYSTAL_X[side], y = (laneY(1) + laneY(3)) / 2;
    const pulse = 1 + Math.sin(state.time * 3 + side) * .025;
    ctx.save(); ctx.translate(x, y); ctx.scale(side === 0 ? pulse : -pulse, pulse);
    const alpha = .45 + .55 * hp / CRYSTAL_HP;
    ctx.shadowBlur = 35; ctx.shadowColor = side === 0 ? '#50eaff' : '#ff6bd5';
    const g = ctx.createLinearGradient(-55, -145, 45, 145);
    g.addColorStop(0, side === 0 ? `rgba(196,249,255,${alpha})` : `rgba(255,210,247,${alpha})`);
    g.addColorStop(.45, side === 0 ? `rgba(72,178,255,${alpha})` : `rgba(255,79,193,${alpha})`);
    g.addColorStop(1, side === 0 ? `rgba(39,88,196,${alpha})` : `rgba(116,47,183,${alpha})`);
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(235,255,255,.84)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -150); ctx.lineTo(58, -80); ctx.lineTo(48, 91); ctx.lineTo(0, 151); ctx.lineTo(-48, 91); ctx.lineTo(-58, -80); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(0, 151); ctx.moveTo(-58, -80); ctx.lineTo(48, 91); ctx.moveTo(58, -80); ctx.lineTo(-48, 91); ctx.stroke();
    ctx.restore();
  }

  function drawWall(side, wall) {
    if (!wall || !wall.alive) return;
    const x = WALL_X[side], y = laneY(wall.lane);
    ctx.save(); ctx.translate(x, y);
    ctx.shadowBlur = 22; ctx.shadowColor = '#8feeff';
    const g = ctx.createLinearGradient(-16, -42, 16, 42);
    g.addColorStop(0, 'rgba(225,255,255,.9)'); g.addColorStop(.5, 'rgba(70,196,255,.68)'); g.addColorStop(1, 'rgba(50,104,210,.78)');
    roundedRect(-12, -43, 24, 86, 8); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#c8fbff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(p, now) {
    const x = PLAYER_X[p.side], y = laneY(p.lane);
    let pose = p.pose;
    if (now < p.stunUntil) pose = 'hit';
    else if (p.guarding) pose = 'guard';
    const img = images[pose] || images.idle;
    const h = pose === 'guard' ? 174 : 158;
    const ratio = img.naturalWidth ? img.naturalWidth / img.naturalHeight : 1;
    const w = h * ratio;
    ctx.save(); ctx.translate(x, y + 3); if (p.side === 1) ctx.scale(-1, 1);
    if (now < p.stunUntil) ctx.translate(Math.sin(now * .08) * 4, 0);
    ctx.shadowBlur = 14; ctx.shadowColor = p.side === 0 ? '#2cbcff' : '#ff57c8';
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    if (p.guarding && now >= p.stunUntil) {
      ctx.save();
      ctx.strokeStyle = p.side === 0 ? 'rgba(117,238,255,.8)' : 'rgba(255,128,221,.8)';
      ctx.lineWidth = 5; ctx.shadowBlur = 18; ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();
      const dir = p.side === 0 ? 1 : -1;
      ctx.arc(x + dir * 34, y, 42, p.side === 0 ? -1.15 : Math.PI - 1.15, p.side === 0 ? 1.15 : Math.PI + 1.15);
      ctx.stroke(); ctx.restore();
    }

    if (p.charge) {
      const ratioCharge = Math.min(1, (now - p.charge.started) / CHARGE_MS);
      const dir = p.side === 0 ? 1 : -1;
      const cx = x + dir * 68, cy = y;
      ctx.save();
      ctx.shadowBlur = 20 + 20 * ratioCharge; ctx.shadowColor = p.side === 0 ? '#6cecff' : '#ff78d5';
      ctx.fillStyle = p.side === 0 ? 'rgba(112,236,255,.85)' : 'rgba(255,119,212,.85)';
      ctx.beginPath(); ctx.arc(cx, cy, 7 + ratioCharge * 17, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawBullet(b) {
    const color = b.side === 0 ? '#72edff' : '#ff82d8';
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = color;
    const dir = Math.sign(b.vx);
    const tail = ctx.createLinearGradient(b.x - dir * 42, b.y, b.x, b.y);
    tail.addColorStop(0, 'rgba(255,255,255,0)'); tail.addColorStop(1, color);
    ctx.strokeStyle = tail; ctx.lineWidth = Math.max(4, b.radius * .65); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x - dir * (30 + b.radius), b.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.beginPath(); ctx.arc(b.x + dir * b.radius * .2, b.y - b.radius * .2, b.radius * .42, 0, Math.PI * 2); ctx.fill();
    ctx.font = '900 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#071120'; ctx.fillText(b.type.toUpperCase(), b.x, b.y + 1); ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    if (!state.paused || !state.running) return;
    ctx.fillStyle = 'rgba(1,5,13,.62)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 48px system-ui'; ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.textAlign = 'left';
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (state.shake > .2) ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
    drawBackground();
    drawHUD();
    drawCrystal(0, state.players[0].hp);
    drawCrystal(1, state.players[1].hp);
    drawWall(0, state.players[0].wall);
    drawWall(1, state.players[1].wall);
    state.bullets.forEach(drawBullet);
    drawPlayer(state.players[0], now);
    drawPlayer(state.players[1], now);
    drawParticles();
    ctx.restore();
    drawPaused();
  }

  function frame(now) {
    const dt = Math.min(.033, (now - state.last) / 1000 || 0);
    state.last = now;
    update(dt, now);
    draw(now);
    requestAnimationFrame(frame);
  }

  function startBattle() {
    startOverlay.classList.remove('show');
    state.running = true;
    state.paused = false;
    state.last = performance.now();
    canvas.focus();
  }

  const startBtn = document.getElementById('startBtn');
  startBtn.addEventListener('click', startBattle);
  startBtn.addEventListener('pointerup', e => { e.preventDefault(); startBattle(); });
  window.addEventListener('keydown', e => {
    if (!state.running && startOverlay.classList.contains('show') && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      startBattle();
    }
  });
  document.getElementById('againBtn').addEventListener('click', () => resetGame(true));
  document.getElementById('resetBtn').addEventListener('click', () => resetGame(true));
  pauseBtn.addEventListener('click', () => {
    if (!state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? '再開' : '一時停止';
  });

  resetGame(false);
  requestAnimationFrame(frame);
})();
