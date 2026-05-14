const canvas = document.querySelector("#raceCanvas");
const ctx = canvas.getContext("2d");

const startBtn = document.querySelector("#startBtn");
const resetBtn = document.querySelector("#resetBtn");
const sampleBtn = document.querySelector("#sampleBtn");
const applyNamesBtn = document.querySelector("#applyNamesBtn");
const nameInput = document.querySelector("#nameInput");
const raceStatus = document.querySelector("#raceStatus");
const leaderboard = document.querySelector("#leaderboard");
const raceClock = document.querySelector("#raceClock");
const sectionGuideToggle = document.querySelector("#sectionGuideToggle");

const W = canvas.width;
const H = canvas.height;
const TRACK_TOP = 96;
const TRACK_BOTTOM = H - 48;
const WORLD_WIDTH = 8500;
const START_X = 100;
const FINISH_X = 8000;
const PIG_RADIUS = 25;
const PIG_DRAW_SCALE = 0.82;
const COURSE_CENTER = (TRACK_TOP + TRACK_BOTTOM) / 2;
const GUIDE_LANE_COUNT = 10;
const OUTER_ROUTE_OFFSET = 185;
const CHOICE_ROUTE_OFFSET = 170;
const FINAL_GATE_OFFSET = 165;
const MAZE_ROUTE_OFFSET = 176;
const ZIGZAG_LANE_OFFSET = 150;
const ZIGZAG_DIVIDER_OFFSET = 82;
const DIAMOND_X = 1250;
const DIAMOND_W = 232;
const DIAMOND_H = 185;
const FUNNEL_END_X = 1500;
const CORRIDOR_HALF = 66;
const BOTTLENECK_END_X = 3000;
const MAZE_START_X = 3500;
const MAZE_END_X = 5000;
const CHOICE_START_X = 5500;
const CHOICE_END_X = 7000;
const FINAL_GATE_X = 7500;
const COURSE_UNIT_WIDTH = 100;
const MAJOR_UNIT_EVERY = 5;

const trackSections = {
  giantWindmill: { name: "대왕풍차", startX: 500, endX: 1000 },
  diamondJunction: { name: "마름모 교차로", startX: 1000, endX: 1500 },
  zigzagWindmills: { name: "지그재그 풍차", startX: FUNNEL_END_X, endX: BOTTLENECK_END_X },
  mazePath: { name: "울타리 미로", startX: MAZE_START_X, endX: MAZE_END_X },
  splitLanes: { name: "삼갈래 선택길", startX: CHOICE_START_X, endX: CHOICE_END_X },
  finalGates: { name: "결승 게이트", startX: CHOICE_END_X, endX: FINISH_X },
};

const defaultNameInput = "분홍탄환\n꿀꿀번개\n진흙왕\n옥수대장\n사과코\n통통로켓";
const fallbackNames = ["분홍탄환", "꿀꿀번개", "진흙왕", "옥수대장", "사과코", "통통로켓"];
const pigColors = ["#eec0bd", "#f1aaa9", "#f3c7c2", "#e9a6b5", "#f0bbb2", "#efb3c4"];
const earColors = ["#e8818a", "#e67586", "#ed9299", "#d96b86", "#e98a83", "#de7898"];
const laneColors = ["#86df69", "#78d65c", "#91e576", "#7ddc62", "#88e06d", "#73d258"];

let pigs = [];
let hazards = [];
let particles = [];
let roster = [];
let raceState = "idle";
let winner = null;
let elapsed = 0;
let cameraX = 0;
let lastTime = 0;
let animationId = 0;
let rosterInputTimer = 0;

const isTestMode = new URLSearchParams(window.location.search).get("test") === "1";
let showSectionGuides = isTestMode;

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function parseRosterInput(value) {
  const parts = value
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const parsed = [];

  for (const part of parts) {
    const match = part.match(/^(.+?)(?:\s*[xX×*]\s*(\d+))?$/);
    const rawName = (match?.[1] || part).trim();
    const name = rawName.replace(/\s+/g, " ").slice(0, 10);
    const count = Math.max(1, Math.min(12, Number(match?.[2] || 1)));
    if (!name) continue;
    for (let i = 0; i < count; i += 1) parsed.push(name);
  }

  const names = parsed.length ? parsed : fallbackNames;
  const totals = names.reduce((acc, name) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const seen = {};
  return names.slice(0, 12).map((name, index) => {
    seen[name] = (seen[name] || 0) + 1;
    const label = totals[name] > 1 ? `${name} ${seen[name]}` : name;
    return { id: `${index}-${name}-${seen[name]}`, name, label };
  });
}

function applyRosterFromInput() {
  if (raceState === "running") return;
  roster = parseRosterInput(nameInput.value || defaultNameInput);
  setupRace(true);
}

function scheduleRosterApply() {
  if (raceState === "running") return;
  clearTimeout(rosterInputTimer);
  rosterInputTimer = setTimeout(applyRosterFromInput, 450);
}

function laneBounds(index, total) {
  const height = (TRACK_BOTTOM - TRACK_TOP) / total;
  const top = TRACK_TOP + index * height;
  return { top, bottom: top + height, center: top + height / 2, height };
}

function buildPig(entry, index, total) {
  const lane = laneBounds(index, total);
  return {
    id: entry.id,
    name: entry.name,
    label: entry.label,
    index,
    x: START_X,
    y: lane.center + 12,
    targetY: lane.center + 12,
    routeSide: index % 2 === 0 ? -1 : 1,
    routeOffset: randomRange(-18, 18),
    decisionTimer: randomRange(0.3, 1.4),
    vx: randomRange(225, 275),
    vy: randomRange(-95, 95),
    baseSpeed: randomRange(230, 292),
    burst: randomRange(0.88, 1.2),
    luck: randomRange(0.84, 1.18),
    dodge: randomRange(0.28, 0.78),
    tired: 0,
    boostTimer: 0,
    mudTimer: 0,
    flipTimer: 0,
    recoilTimer: 0,
    rollTimer: 0,
    rollAngle: 0,
    rollSpeed: 0,
    pushTimer: 0,
    pushAngle: 0,
    stuckSpinner: null,
    stuckArm: null,
    spin: 0,
    tilt: 0,
    run: Math.random() * Math.PI * 2,
    bob: Math.random() * Math.PI * 2,
    color: pigColors[index % pigColors.length],
    ear: earColors[index % earColors.length],
    bib: index + 1,
    eventText: "",
    eventTimer: 0,
    finishedAt: null,
  };
}

function makeHazards(total) {
  return [
    {
      type: "spinner",
      section: "giantWindmill",
      x: 750,
      y: COURSE_CENTER,
      radius: 236,
      armWidth: 18,
      bladeCount: 4,
      speed: -1.65,
      phase: 0,
    },
    {
      type: "spinner",
      section: "zigzagWindmills",
      x: 1750,
      y: COURSE_CENTER - ZIGZAG_DIVIDER_OFFSET,
      radius: 124,
      armWidth: 15,
      bladeCount: 2,
      clearancePadding: 3,
      speed: 1.22,
      phase: 0.65,
    },
    {
      type: "spinner",
      section: "zigzagWindmills",
      x: 2250,
      y: COURSE_CENTER + ZIGZAG_DIVIDER_OFFSET,
      radius: 124,
      armWidth: 15,
      bladeCount: 2,
      clearancePadding: 3,
      speed: -1.26,
      phase: 1.2,
    },
    {
      type: "spinner",
      section: "zigzagWindmills",
      x: 2750,
      y: COURSE_CENTER - ZIGZAG_DIVIDER_OFFSET,
      radius: 124,
      armWidth: 15,
      bladeCount: 2,
      clearancePadding: 3,
      speed: 1.16,
      phase: 2.05,
    },
    {
      type: "mud",
      section: "splitLanes",
      x: 5750,
      y: COURSE_CENTER - CHOICE_ROUTE_OFFSET,
      r: 42,
      usedBy: new Set(),
    },
    {
      type: "mud",
      section: "splitLanes",
      x: 6250,
      y: COURSE_CENTER - CHOICE_ROUTE_OFFSET + 16,
      r: 38,
      usedBy: new Set(),
    },
    {
      type: "feed",
      section: "splitLanes",
      x: 5750,
      y: COURSE_CENTER + CHOICE_ROUTE_OFFSET,
      r: 34,
      usedBy: new Set(),
    },
    {
      type: "feed",
      section: "splitLanes",
      x: 6750,
      y: COURSE_CENTER + CHOICE_ROUTE_OFFSET - 14,
      r: 34,
      usedBy: new Set(),
    },
    { type: "spring", section: "splitLanes", x: 6250, y: COURSE_CENTER, r: 36, phase: 0.7, usedBy: new Set() },
    { type: "gate", section: "finalGates", x: FINAL_GATE_X, y: COURSE_CENTER - FINAL_GATE_OFFSET, phase: 0.2, usedBy: new Set() },
    { type: "gate", section: "finalGates", x: FINAL_GATE_X, y: COURSE_CENTER, phase: 1.7, usedBy: new Set() },
    { type: "gate", section: "finalGates", x: FINAL_GATE_X, y: COURSE_CENTER + FINAL_GATE_OFFSET, phase: 3.1, usedBy: new Set() },
  ];
}

function setupRace(keepSelection = true) {
  const order = keepSelection ? roster : shuffle(roster);
  pigs = order.map((entry, index) => buildPig(entry, index, order.length));
  hazards = makeHazards(pigs.length);
  particles = [];
  winner = null;
  elapsed = 0;
  cameraX = 0;
  raceState = "idle";
  raceStatus.textContent = "출전 돼지를 정하고 출발하세요";
  raceClock.textContent = "00.0s";
  startBtn.disabled = false;
  sampleBtn.disabled = false;
  updateLeaderboard();
  draw();
}

function startRace() {
  if (raceState === "running") return;
  winner = null;
  elapsed = 0;
  raceState = "running";
  startBtn.disabled = true;
  sampleBtn.disabled = true;
  applyNamesBtn.disabled = true;
  nameInput.disabled = true;
  raceStatus.textContent = `${pigs.length}마리 출발`;
}

function update(dt) {
  if (raceState === "running") {
    elapsed += dt;
    for (const pig of pigs) updatePig(pig, dt);
    updateCamera(dt);
    checkWinner();
    raceClock.textContent = `${elapsed.toFixed(1).padStart(4, "0")}s`;
  }

  for (const pig of pigs) {
    pig.eventTimer = Math.max(0, pig.eventTimer - dt);
    pig.run += dt * (8 + Math.max(0, pig.vx) / 52);
    pig.bob += dt * 5;
  }

  updateParticles(dt);
  updateLeaderboard();
}

function updatePig(pig, dt) {
  if (pig.stuckSpinner) {
    updateStuckOnSpinner(pig, dt);
    return;
  }

  pig.boostTimer = Math.max(0, pig.boostTimer - dt);
  pig.mudTimer = Math.max(0, pig.mudTimer - dt);
  pig.flipTimer = Math.max(0, pig.flipTimer - dt);
  pig.recoilTimer = Math.max(0, pig.recoilTimer - dt);
  pig.rollTimer = Math.max(0, pig.rollTimer - dt);
  pig.pushTimer = Math.max(0, pig.pushTimer - dt);
  pig.decisionTimer -= dt;
  pig.tired = Math.min(0.22, pig.tired + dt * 0.006);
  if (pig.decisionTimer <= 0) {
    if (Math.random() < 0.18) pig.routeSide *= -1;
    pig.routeOffset = randomRange(-22, 22);
    pig.decisionTimer = randomRange(0.65, 1.6);
  }
  pig.targetY = chooseTargetY(pig);

  const targetSpeed = pig.baseSpeed * pig.burst * (1 - pig.tired);
  const boost = pig.boostTimer > 0 ? 132 : 0;
  const mud = pig.mudTimer > 0 ? 96 : 0;
  const steering = pig.recoilTimer > 0 ? 0.05 : 2.1;
  const ySteering = pig.recoilTimer > 0 ? 0.15 : 1.6;
  pig.vx += (targetSpeed + boost - mud - pig.vx) * Math.min(1, dt * steering);
  pig.vy += (pig.targetY - pig.y) * dt * ySteering;
  pig.vy *= pig.recoilTimer > 0 ? 0.985 : 0.955;
  pig.spin += pig.vx * dt * 0.012 + pig.vy * dt * 0.006;
  if (pig.rollTimer > 0) {
    pig.rollAngle += pig.rollSpeed * dt;
    pig.rollSpeed *= 0.992;
  } else {
    pig.rollAngle += (0 - pig.rollAngle) * Math.min(1, dt * 8);
  }
  pig.tilt += ((pig.recoilTimer > 0 ? Math.sign(pig.vy || 1) * 0.34 : 0) - pig.tilt) * Math.min(1, dt * 8);

  const prevX = pig.x;
  const prevY = pig.y;
  pig.x += pig.vx * dt;
  pig.y += pig.vy * dt;
  if (pig.y < TRACK_TOP + 34) {
    pig.y = TRACK_TOP + 34;
    pig.vy = Math.abs(pig.vy) * 0.72;
    pig.recoilTimer = Math.max(pig.recoilTimer, 0.16);
    startRoll(pig, { nx: 0, ny: 1 }, 0.35);
  }
  if (pig.y > TRACK_BOTTOM - 30) {
    pig.y = TRACK_BOTTOM - 30;
    pig.vy = -Math.abs(pig.vy) * 0.72;
    pig.recoilTimer = Math.max(pig.recoilTimer, 0.16);
    startRoll(pig, { nx: 0, ny: -1 }, 0.35);
  }

  applyCourseFences(pig, prevX, prevY);
  for (const hazard of hazards) applyHazard(pig, hazard);
}

function chooseTargetY(pig) {
  const center = COURSE_CENTER;
  const upper = center - OUTER_ROUTE_OFFSET + pig.routeOffset;
  const lower = center + OUTER_ROUTE_OFFSET + pig.routeOffset;

  const spinner = hazards[0];
  if (spinner && pig.x > spinner.x - 390 && pig.x < spinner.x + 245) {
    if (pig.x < spinner.x - 250 && Math.abs(pig.y - center) < 96) {
      pig.routeSide = pig.y < center ? -1 : 1;
    }
    return clampTrackY(pig.routeSide < 0 ? upper : lower);
  }

  if (pig.x > DIAMOND_X - 420 && pig.x < DIAMOND_X + DIAMOND_W + 70) {
    if (pig.x < DIAMOND_X - 300 && Math.abs(pig.y - center) < 120) {
      pig.routeSide = pig.y < center ? -1 : 1;
    }
    return clampTrackY(pig.routeSide < 0 ? upper : lower);
  }

  const funnelStart = DIAMOND_X + DIAMOND_W;
  if (pig.x >= funnelStart && pig.x < FUNNEL_END_X) {
    const t = Math.max(0, Math.min(1, (pig.x - funnelStart) / (FUNNEL_END_X - funnelStart)));
    const sideY = pig.routeSide < 0 ? upper : lower;
    return clampTrackY(sideY + (center - sideY) * t + pig.routeOffset * 0.15);
  }

  if (pig.x >= FUNNEL_END_X && pig.x < BOTTLENECK_END_X) {
    const lane = pig.index % 3;
    const laneY = lane === 0 ? center - ZIGZAG_LANE_OFFSET : lane === 1 ? center : center + ZIGZAG_LANE_OFFSET;
    const wiggle = Math.sin((pig.x - FUNNEL_END_X) / 170 + pig.index) * 10;
    return clampTrackY(laneY + wiggle + pig.routeOffset * 0.12);
  }

  if (pig.x >= BOTTLENECK_END_X && pig.x < MAZE_START_X) {
    return clampTrackY(center - MAZE_ROUTE_OFFSET * 0.85 + pig.routeOffset * 0.2);
  }

  if (pig.x >= MAZE_START_X && pig.x < MAZE_END_X) {
    if (pig.x < MAZE_START_X + 500) return clampTrackY(center - MAZE_ROUTE_OFFSET + pig.routeOffset * 0.18);
    if (pig.x < MAZE_START_X + 1000) return clampTrackY(center + MAZE_ROUTE_OFFSET + pig.routeOffset * 0.18);
    if (pig.x < MAZE_START_X + 1250) return clampTrackY(center - MAZE_ROUTE_OFFSET * 0.9 + pig.routeOffset * 0.18);
    return clampTrackY(center + pig.routeOffset * 0.25);
  }

  if (pig.x >= CHOICE_START_X && pig.x < CHOICE_END_X) {
    const choice = pig.index % 3;
    if (choice === 0) return clampTrackY(center - CHOICE_ROUTE_OFFSET + pig.routeOffset * 0.25);
    if (choice === 1) return clampTrackY(center + pig.routeOffset * 0.35);
    return clampTrackY(center + CHOICE_ROUTE_OFFSET + pig.routeOffset * 0.25);
  }

  if (pig.x >= CHOICE_END_X && pig.x < FINAL_GATE_X + 180) {
    const gateLane = (pig.index + Math.floor(elapsed * 0.18)) % 3;
    if (gateLane === 0) return clampTrackY(center - FINAL_GATE_OFFSET + pig.routeOffset * 0.15);
    if (gateLane === 1) return clampTrackY(center + pig.routeOffset * 0.2);
    return clampTrackY(center + FINAL_GATE_OFFSET + pig.routeOffset * 0.15);
  }

  return clampTrackY(center + pig.routeOffset);
}

function clampTrackY(y) {
  return Math.max(TRACK_TOP + 42, Math.min(TRACK_BOTTOM - 38, y));
}

function applyHazard(pig, hazard) {
  if (hazard.type === "spinner") {
    applySpinner(pig, hazard);
    return;
  }

  if (hazard.type === "bar") {
    if (isBoingBarOpen(hazard)) return;
    const segment = boingBarSegment(hazard);
    const hit = segmentCircle(segment.x1, segment.y1, segment.x2, segment.y2, pig.x, pig.y, PIG_RADIUS);
    if (!hit) return;
    applySolidImpact(pig, hit, 0.92, 130);
    pig.recoilTimer = Math.max(pig.recoilTimer, randomRange(0.45, 0.75));
    pig.flipTimer = 0.8;
    if (pig.eventTimer < 0.18) {
      event(pig, "펜스 반사", "#f1d39b");
      burst(hazard.x, hazard.y, "#f1d39b", 8);
    }
    return;
  }

  if (hazard.type === "gate") {
    const segment = gateSegment(hazard);
    if (isGateOpen(hazard)) {
      if (!hazard.usedBy.has(pig.id) && Math.abs(pig.x - hazard.x) < 26) {
        hazard.usedBy.add(pig.id);
        pig.vx += randomRange(55, 120);
        event(pig, "열림 통과", "#ffffff");
      }
      return;
    }

    const hit = segmentCircle(segment.x1, segment.y1, segment.x2, segment.y2, pig.x, pig.y, PIG_RADIUS);
    if (!hit) return;
    applySolidImpact(pig, hit, 0.9, 115);
    pig.recoilTimer = Math.max(pig.recoilTimer, 0.65);
    pig.flipTimer = Math.max(pig.flipTimer, 0.65);
    if (pig.eventTimer < 0.18) {
      event(pig, "닫힌 문", "#d9b06f");
      burst(hazard.x, hazard.y, "#d9b06f", 8);
    }
    return;
  }

  if (hazard.usedBy.has(pig.id)) return;

  const dx = pig.x - hazard.x;
  const dy = pig.y - hazard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > hazard.r + 32) return;

  hazard.usedBy.add(pig.id);
  const nx = dx / (dist || 1);
  const ny = dy / (dist || 1);
  const hit = { nx, ny, overlap: hazard.r + 32 - dist };
  const normal = incomingNormal(pig, nx, ny);
  pig.x += normal.nx * Math.max(4, hit.overlap);
  pig.y += normal.ny * Math.max(4, hit.overlap);

  if (hazard.type === "bumper") {
    const lucky = Math.random() < pig.luck * 0.34;
    reflectPig(pig, normal.nx, normal.ny, lucky ? 1.08 : 0.98);
    pig.vx += normal.nx * (lucky ? 120 : 210);
    pig.vy += normal.ny * (lucky ? 120 : 210);
    pig.boostTimer = lucky ? 0.65 : pig.boostTimer;
    pig.recoilTimer = lucky ? 0.25 : randomRange(0.5, 0.85);
    pig.flipTimer = randomRange(0.35, 0.7);
    startRoll(pig, normal, lucky ? 0.65 : 0.95);
    event(pig, lucky ? "보잉 가속" : "보잉 반사", lucky ? "#f2bd42" : "#f7b7c9");
    burst(hazard.x, hazard.y, lucky ? "#f2bd42" : "#f7b7c9", 18);
    return;
  }

  if (hazard.type === "mud") {
    const dodge = Math.random() < pig.dodge;
    pig.mudTimer = dodge ? 0 : randomRange(0.6, 1.1);
    pig.vy += dodge ? randomRange(-80, 80) : randomRange(-35, 35);
    event(pig, dodge ? "진흙 회피" : "진흙 감속", dodge ? "#ffffff" : "#8a5d4f");
    burst(hazard.x, hazard.y, "#8a5d4f", 8);
    return;
  }

  if (hazard.type === "spring") {
    const backfire = Math.random() < 0.3;
    const springNormal = backfire ? { nx: -0.85, ny: ny || -0.35 } : { nx: 0.85, ny: ny || -0.35 };
    pig.vx += springNormal.nx * randomRange(180, 300);
    pig.vy += springNormal.ny * randomRange(180, 320);
    pig.flipTimer = 0.72;
    pig.recoilTimer = backfire ? 0.55 : 0.24;
    startRoll(pig, springNormal, backfire ? 0.9 : 0.55);
    event(pig, backfire ? "스프링 역분사" : "스프링 점프", "#83d4ff");
    burst(hazard.x, hazard.y, "#83d4ff", 14);
    return;
  }

  if (hazard.type === "feed") {
    pig.boostTimer = randomRange(0.7, 1.2);
    pig.vx += randomRange(50, 115);
    event(pig, "먹이 부스트", "#efb842");
    burst(hazard.x, hazard.y, "#efb842", 10);
    return;
  }

  if (hazard.type === "flipper") {
    const forward = Math.random() < 0.72;
    const side = forward ? 1 : -1;
    pig.vx += side * randomRange(180, 330);
    pig.vy += (Math.random() > 0.5 ? 1 : -1) * randomRange(160, 280);
    pig.recoilTimer = forward ? 0.28 : 0.75;
    pig.flipTimer = 0.8;
    startRoll(pig, { nx: side, ny: Math.sign(pig.vy || 1) * 0.35 }, forward ? 0.65 : 1);
    event(pig, forward ? "보잉 패드" : "역보잉", forward ? "#ff8bb3" : "#f7b7c9");
    burst(hazard.x, hazard.y, forward ? "#ff8bb3" : "#f7b7c9", 16);
    return;
  }

}

function spinnerAngle(hazard) {
  return hazard.phase + elapsed * hazard.speed;
}

function spinnerArms(hazard) {
  const angle = spinnerAngle(hazard);
  const bladeCount = hazard.bladeCount || 3;
  return Array.from({ length: bladeCount }, (_, index) => {
    const armAngle = angle + ((Math.PI * 2) / bladeCount) * index;
    const dx = Math.cos(armAngle) * hazard.radius;
    const dy = Math.sin(armAngle) * hazard.radius;
    return {
      x1: hazard.x,
      y1: hazard.y,
      x2: hazard.x + dx,
      y2: hazard.y + dy,
      angle: armAngle,
    };
  });
}

function spinnerCollisionRadius(hazard) {
  return PIG_RADIUS + hazard.armWidth / 2 + (hazard.clearancePadding ?? 12);
}

function applySpinner(pig, hazard) {
  const arms = spinnerArms(hazard);
  for (let index = 0; index < arms.length; index += 1) {
    const arm = arms[index];
    const hit = segmentCircle(arm.x1, arm.y1, arm.x2, arm.y2, pig.x, pig.y, spinnerCollisionRadius(hazard));
    if (!hit) continue;

    const normal = incomingNormal(pig, hit.nx, hit.ny);
    attachToSpinner(pig, hazard, index, normal);
    return;
  }
}

function attachToSpinner(pig, hazard, armIndex, normal) {
  pig.stuckSpinner = hazard;
  pig.stuckArm = armIndex;
  pig.vx = 0;
  pig.vy = 0;
  pig.recoilTimer = 0.18;
  pig.flipTimer = 0.12;
  pig.pushTimer = 0.26;
  pig.pushAngle = Math.atan2(-normal.ny, -normal.nx);
  keepPigOutsideSpinnerArm(pig, hazard, armIndex, normal);
  if (pig.eventTimer < 0.16) {
    event(pig, "회전문 막힘", "#d7a76b");
  }
}

function updateStuckOnSpinner(pig, dt) {
  pig.boostTimer = Math.max(0, pig.boostTimer - dt);
  pig.mudTimer = Math.max(0, pig.mudTimer - dt);
  pig.flipTimer = Math.max(0, pig.flipTimer - dt);
  pig.recoilTimer = Math.max(0, pig.recoilTimer - dt);
  pig.rollTimer = 0;
  pig.pushTimer = 0.24;
  pig.run += dt * 13;
  pig.bob += dt * 8;

  const hazard = pig.stuckSpinner;
  const armIndex = pig.stuckArm;
  const arm = spinnerArms(hazard)[armIndex];
  const hit = segmentCircle(arm.x1, arm.y1, arm.x2, arm.y2, pig.x, pig.y, spinnerCollisionRadius(hazard));

  if (!hit) {
    pig.stuckSpinner = null;
    pig.stuckArm = null;
    pig.vx = Math.max(pig.vx, 120);
    pig.vy *= 0.45;
    pig.pushTimer = 0;
    pig.decisionTimer = 0;
    event(pig, "틈 통과", "#ffffff");
    return;
  }

  const normal = incomingNormal(pig, hit.nx, hit.ny);
  keepPigOutsideSpinnerArm(pig, hazard, armIndex, normal);
  const tangent = { x: -Math.sin(arm.angle), y: Math.cos(arm.angle) };
  pig.x += tangent.x * hazard.speed * 18 * dt;
  pig.y += tangent.y * hazard.speed * 18 * dt;
  pig.vx = 0;
  pig.vy = 0;
  pig.pushAngle = Math.atan2(-normal.ny, -normal.nx);

  if (pig.y < TRACK_TOP + 34) pig.y = TRACK_TOP + 34;
  if (pig.y > TRACK_BOTTOM - 30) pig.y = TRACK_BOTTOM - 30;
}

function keepPigOutsideSpinnerArm(pig, hazard, armIndex, fallbackNormal) {
  const arm = spinnerArms(hazard)[armIndex];
  const hit = segmentCircle(arm.x1, arm.y1, arm.x2, arm.y2, pig.x, pig.y, spinnerCollisionRadius(hazard));
  if (!hit) return;
  const normal = incomingNormal(pig, hit.nx || fallbackNormal.nx, hit.ny || fallbackNormal.ny);
  pig.x += normal.nx * Math.max(hit.overlap + 6, 6);
  pig.y += normal.ny * Math.max(hit.overlap + 6, 6);
}

function event(pig, text, color) {
  pig.eventText = text;
  pig.eventTimer = 0.9;
  pig.eventColor = color;
}

function boingBarSegment(hazard) {
  const angle = boingBarAngle(hazard);
  const half = hazard.length / 2;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  const lift = Math.abs(Math.sin(angle)) < 0.24 ? -64 : 0;
  return {
    x1: hazard.x - dx,
    y1: hazard.y - dy + lift,
    x2: hazard.x + dx,
    y2: hazard.y + dy + lift,
  };
}

function boingBarAngle(hazard) {
  return hazard.angle + Math.sin(elapsed * 1.9 + hazard.phase) * 1.15;
}

function isBoingBarOpen(hazard) {
  const angle = boingBarAngle(hazard);
  return Math.abs(Math.sin(angle)) < 0.24;
}

function gateAngle(hazard) {
  return 0;
}

function isGateOpen(hazard) {
  return Math.sin(elapsed * 1.25 + hazard.phase) > 0.48;
}

function gateSegment(hazard) {
  const angle = gateAngle(hazard);
  const half = 45;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  return {
    x1: hazard.x - dx,
    y1: hazard.y - dy,
    x2: hazard.x + dx,
    y2: hazard.y + dy,
  };
}

function segmentCircle(x1, y1, x2, y2, cx, cy, radius) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  const t = Math.max(0, Math.min(1, ((cx - x1) * vx + (cy - y1) * vy) / lenSq));
  const px = x1 + vx * t;
  const py = y1 + vy * t;
  const dx = cx - px;
  const dy = cy - py;
  const dist = Math.hypot(dx, dy);
  if (dist >= radius) return null;
  return {
    nx: dx / (dist || 1),
    ny: dy / (dist || 1),
    overlap: radius - dist,
  };
}

function segmentIntersectionT(ax, ay, bx, by, cx, cy, dx, dy) {
  const abx = bx - ax;
  const aby = by - ay;
  const cdx = dx - cx;
  const cdy = dy - cy;
  const denom = abx * cdy - aby * cdx;
  if (Math.abs(denom) < 0.0001) return null;

  const acx = cx - ax;
  const acy = cy - ay;
  const t = (acx * cdy - acy * cdx) / denom;
  const u = (acx * aby - acy * abx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return t;
}

function sweptFenceHit(fence, pig, prevX, prevY, radius) {
  if (prevX === undefined || prevY === undefined) return null;
  const t = segmentIntersectionT(prevX, prevY, pig.x, pig.y, fence.x1, fence.y1, fence.x2, fence.y2);
  if (t === null) return null;

  const moveX = pig.x - prevX;
  const moveY = pig.y - prevY;
  const fenceX = fence.x2 - fence.x1;
  const fenceY = fence.y2 - fence.y1;
  const fenceLength = Math.hypot(fenceX, fenceY) || 1;
  const n1 = { nx: -fenceY / fenceLength, ny: fenceX / fenceLength };
  const n2 = { nx: -n1.nx, ny: -n1.ny };
  const normal = moveX * n1.nx + moveY * n1.ny < 0 ? n1 : n2;
  const hitX = prevX + moveX * t;
  const hitY = prevY + moveY * t;

  pig.x = hitX + normal.nx * (radius + 3);
  pig.y = hitY + normal.ny * (radius + 3);
  return { nx: normal.nx, ny: normal.ny, overlap: 3 };
}

function reflectPig(pig, nx, ny, restitution) {
  const dot = pig.vx * nx + pig.vy * ny;
  if (dot >= 0) return;
  pig.vx = (pig.vx - 2 * dot * nx) * restitution;
  pig.vy = (pig.vy - 2 * dot * ny) * restitution;
}

function applySolidImpact(pig, hit, restitution, impulse) {
  const normal = incomingNormal(pig, hit.nx, hit.ny);
  pig.x += normal.nx * hit.overlap;
  pig.y += normal.ny * hit.overlap;
  reflectPig(pig, normal.nx, normal.ny, restitution);
  const speed = Math.max(180, Math.min(520, Math.hypot(pig.vx, pig.vy)));
  pig.vx += normal.nx * Math.min(impulse, speed * 0.22);
  pig.vy += normal.ny * Math.min(impulse, speed * 0.22);
  startRoll(pig, normal, Math.min(1.15, 0.45 + speed / 520));
}

function incomingNormal(pig, nx, ny) {
  const dot = pig.vx * nx + pig.vy * ny;
  if (dot > 0) return { nx: -nx, ny: -ny };
  return { nx, ny };
}

function startRoll(pig, normal, strength) {
  const direction = normal.ny >= 0 ? 1 : -1;
  const speed = Math.hypot(pig.vx, pig.vy);
  pig.rollTimer = Math.max(pig.rollTimer, 0.34 + strength * 0.46);
  pig.rollSpeed = direction * Math.max(7, Math.min(18, speed / 34 + strength * 7));
  pig.flipTimer = Math.max(pig.flipTimer, pig.rollTimer);
}

function courseFenceSegments() {
  const center = COURSE_CENTER;
  const x = DIAMOND_X;
  const w = DIAMOND_W;
  const h = DIAMOND_H;
  const mazeTop = TRACK_TOP + 58;
  const mazeBottom = TRACK_BOTTOM - 58;
  const mazeCenter = center;
  return [
    { x1: x, y1: center - h, x2: x + w, y2: center },
    { x1: x + w, y1: center, x2: x, y2: center + h },
    { x1: x, y1: center + h, x2: x - w, y2: center },
    { x1: x - w, y1: center, x2: x, y2: center - h },
    { x1: FUNNEL_END_X, y1: center - ZIGZAG_DIVIDER_OFFSET, x2: BOTTLENECK_END_X, y2: center - ZIGZAG_DIVIDER_OFFSET },
    { x1: FUNNEL_END_X, y1: center + ZIGZAG_DIVIDER_OFFSET, x2: BOTTLENECK_END_X, y2: center + ZIGZAG_DIVIDER_OFFSET },
    { x1: MAZE_START_X, y1: mazeTop, x2: MAZE_END_X, y2: mazeTop },
    { x1: MAZE_START_X, y1: mazeBottom, x2: MAZE_END_X, y2: mazeBottom },
    { x1: MAZE_START_X + 500, y1: mazeCenter - 60, x2: MAZE_START_X + 500, y2: mazeBottom },
    { x1: MAZE_START_X + 1000, y1: mazeTop, x2: MAZE_START_X + 1000, y2: mazeCenter + 60 },
    { x1: FINAL_GATE_X - 120, y1: center - 96, x2: FINAL_GATE_X + 120, y2: center - 96 },
    { x1: FINAL_GATE_X - 120, y1: center + 96, x2: FINAL_GATE_X + 120, y2: center + 96 },
  ];
}

function applyCourseFences(pig, prevX, prevY) {
  for (const fence of courseFenceSegments()) {
    const minX = Math.min(fence.x1, fence.x2, prevX ?? pig.x) - 86;
    const maxX = Math.max(fence.x1, fence.x2, prevX ?? pig.x) + 86;
    if (pig.x < minX || pig.x > maxX) continue;
    const fenceRadius = PIG_RADIUS + 16;
    const hit =
      sweptFenceHit(fence, pig, prevX, prevY, fenceRadius) ||
      segmentCircle(fence.x1, fence.y1, fence.x2, fence.y2, pig.x, pig.y, fenceRadius);
    if (!hit) continue;
    applySolidImpact(pig, hit, 0.66, 36);
    pig.recoilTimer = Math.max(pig.recoilTimer, 0.12);
    pig.flipTimer = Math.max(pig.flipTimer, 0.12);
    if (pig.eventTimer < 0.18) event(pig, "울타리 막힘", "#d7a76b");
  }
  applyDiamondInteriorBlock(pig);
}

function applyDiamondInteriorBlock(pig) {
  const dx = Math.abs(pig.x - DIAMOND_X) / DIAMOND_W;
  const dy = Math.abs(pig.y - COURSE_CENTER) / DIAMOND_H;
  if (dx + dy > 0.98) return;

  let closest = null;
  for (const fence of courseFenceSegments().slice(0, 4)) {
    const vx = fence.x2 - fence.x1;
    const vy = fence.y2 - fence.y1;
    const lenSq = vx * vx + vy * vy;
    const t = Math.max(0, Math.min(1, ((pig.x - fence.x1) * vx + (pig.y - fence.y1) * vy) / lenSq));
    const px = fence.x1 + vx * t;
    const py = fence.y1 + vy * t;
    const awayX = pig.x - px;
    const awayY = pig.y - py;
    const distance = Math.hypot(awayX, awayY) || 1;
    if (!closest || distance < closest.distance) {
      closest = { distance, nx: -awayX / distance, ny: -awayY / distance };
    }
  }

  if (!closest) return;
  const push = closest.distance + PIG_RADIUS + 18;
  pig.x += closest.nx * push;
  pig.y += closest.ny * push;
  reflectPig(pig, closest.nx, closest.ny, 0.52);
  pig.recoilTimer = Math.max(pig.recoilTimer, 0.18);
  pig.flipTimer = Math.max(pig.flipTimer, 0.18);
  if (pig.eventTimer < 0.18) event(pig, "마름모 울타리", "#d7a76b");
}

function rouletteWallSegments() {
  const segments = [];
  for (let x = 520; x < FINISH_X - 260; x += 720) {
    const yTop = TRACK_BOTTOM - 112;
    const points = [
      { x, y: yTop },
      { x: x + 180, y: yTop - 76 },
      { x: x + 350, y: yTop - 8 },
      { x: x + 540, y: yTop - 82 },
      { x: x + 700, y: yTop - 18 },
    ];
    for (let i = 0; i < points.length - 1; i += 1) {
      segments.push({ x1: points[i].x, y1: points[i].y, x2: points[i + 1].x, y2: points[i + 1].y });
    }
  }
  return segments;
}

function applyRouletteWalls(pig) {
  for (const wall of rouletteWallSegments()) {
    if (pig.x < wall.x1 - 80 || pig.x > wall.x2 + 80) continue;
    const hit = segmentCircle(wall.x1, wall.y1, wall.x2, wall.y2, pig.x, pig.y, PIG_RADIUS);
    if (!hit) continue;
    applySolidImpact(pig, hit, 0.86, 70);
    pig.recoilTimer = Math.max(pig.recoilTimer, 0.42);
    pig.flipTimer = Math.max(pig.flipTimer, 0.48);
    if (pig.eventTimer < 0.2) event(pig, "울타리 반사", "#e4c088");
    if (Math.random() < 0.16) burst(pig.x, pig.y, "#e4c088", 5);
  }
}

function updateCamera(dt) {
  const leadX = Math.max(...pigs.map((pig) => pig.x));
  const target = Math.max(0, Math.min(WORLD_WIDTH - W, leadX - W * 0.62));
  cameraX += (target - cameraX) * Math.min(1, dt * 2.5);
}

function checkWinner() {
  if (winner) return;
  const finished = pigs
    .filter((pig) => pig.x >= FINISH_X)
    .sort((a, b) => b.x - a.x);
  if (!finished.length) return;

  winner = finished[0];
  winner.finishedAt = elapsed;
  raceState = "finished";
  startBtn.disabled = false;
  sampleBtn.disabled = false;
  applyNamesBtn.disabled = false;
  nameInput.disabled = false;
  raceStatus.textContent = `${winner.label} 우승`;
}

function updateLeaderboard() {
  const ordered = [...pigs].sort((a, b) => b.x - a.x);
  leaderboard.innerHTML = "";
  ordered.forEach((pig) => {
    const li = document.createElement("li");
    const distance = Math.max(0, FINISH_X - pig.x);
    li.textContent = `${pig.bib}번 ${pig.label} · ${Math.round(distance)}m`;
    leaderboard.append(li);
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-cameraX, 0);
  drawWorld();
  drawHazards();
  for (const pig of pigs) drawPig(pig);
  drawParticles();
  ctx.restore();
}

function drawWorld() {
  const sky = ctx.createLinearGradient(0, 0, 0, TRACK_TOP);
  sky.addColorStop(0, "#cceeff");
  sky.addColorStop(1, "#f9f0d2");
  ctx.fillStyle = sky;
  ctx.fillRect(cameraX, 0, W, TRACK_TOP);

  ctx.fillStyle = "#73cf69";
  ctx.fillRect(0, TRACK_TOP, WORLD_WIDTH, TRACK_BOTTOM - TRACK_TOP);
  ctx.fillStyle = "#7c5947";
  ctx.fillRect(0, TRACK_BOTTOM, WORLD_WIDTH, H - TRACK_BOTTOM);

  for (let i = 0; i < GUIDE_LANE_COUNT; i += 1) {
    const lane = laneBounds(i, GUIDE_LANE_COUNT);
    ctx.fillStyle = laneColors[i % laneColors.length];
    ctx.fillRect(0, lane.top, WORLD_WIDTH, lane.height);
    ctx.strokeStyle = "rgba(255,255,255,0.68)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, lane.bottom);
    ctx.lineTo(WORLD_WIDTH, lane.bottom);
    ctx.stroke();
  }

  drawBarn(142, 38);
  drawDiamondField();
  drawExtendedCourseFields();
  drawCourseFences();
  drawSectionGuides();
  drawFinishLine();
}

function drawSectionGuides() {
  if (!showSectionGuides) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const firstUnit = Math.max(0, Math.floor(cameraX / COURSE_UNIT_WIDTH) - 1);
  const lastUnit = Math.ceil((cameraX + W) / COURSE_UNIT_WIDTH) + 1;
  for (let unit = firstUnit; unit <= lastUnit; unit += 1) {
    const x = unit * COURSE_UNIT_WIDTH;
    if (x < START_X || x > FINISH_X) continue;
    const isMajor = unit % MAJOR_UNIT_EVERY === 0;
    ctx.lineWidth = isMajor ? 1.5 : 1;
    ctx.setLineDash(isMajor ? [] : [4, 8]);
    ctx.strokeStyle = isMajor ? "rgba(17, 64, 45, 0.72)" : "rgba(17, 64, 45, 0.35)";
    ctx.beginPath();
    ctx.moveTo(x + 0.5, TRACK_TOP);
    ctx.lineTo(x + 0.5, TRACK_BOTTOM);
    ctx.stroke();
    if (isMajor) {
      ctx.fillStyle = "rgba(17, 64, 45, 0.82)";
      ctx.font = "900 13px system-ui";
      ctx.fillText(`${unit * 100}cm`, x, TRACK_TOP + 8);
    }
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function drawDiamondField() {
  const center = COURSE_CENTER;
  const x = DIAMOND_X;
  const w = DIAMOND_W;
  const h = DIAMOND_H;
  ctx.save();
  ctx.fillStyle = "rgba(116, 194, 94, 0.42)";
  roundRect(FUNNEL_END_X, TRACK_TOP + 72, BOTTLENECK_END_X - FUNNEL_END_X, TRACK_BOTTOM - TRACK_TOP - 144, 8);
  ctx.fill();

  ctx.fillStyle = "rgba(116, 194, 94, 0.64)";
  ctx.beginPath();
  ctx.moveTo(x, center - h + 10);
  ctx.lineTo(x + w - 16, center);
  ctx.lineTo(x, center + h - 10);
  ctx.lineTo(x - w + 16, center);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawExtendedCourseFields() {
  const center = COURSE_CENTER;
  ctx.save();

  ctx.fillStyle = "rgba(104, 184, 86, 0.42)";
  roundRect(MAZE_START_X - 28, TRACK_TOP + 52, MAZE_END_X - MAZE_START_X + 56, TRACK_BOTTOM - TRACK_TOP - 104, 8);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.moveTo(MAZE_START_X + 40, center - MAZE_ROUTE_OFFSET + 4);
  ctx.bezierCurveTo(
    MAZE_START_X + 300,
    center - MAZE_ROUTE_OFFSET - 14,
    MAZE_START_X + 330,
    center + MAZE_ROUTE_OFFSET - 2,
    MAZE_START_X + 535,
    center + MAZE_ROUTE_OFFSET - 2
  );
  ctx.bezierCurveTo(
    MAZE_START_X + 790,
    center + MAZE_ROUTE_OFFSET - 2,
    MAZE_START_X + 705,
    center - MAZE_ROUTE_OFFSET * 0.9,
    MAZE_START_X + 965,
    center - MAZE_ROUTE_OFFSET * 0.85
  );
  ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
  ctx.lineWidth = 54;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.fillStyle = "rgba(116, 194, 94, 0.36)";
  roundRect(CHOICE_START_X, TRACK_TOP + 56, CHOICE_END_X - CHOICE_START_X, TRACK_BOTTOM - TRACK_TOP - 112, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 14]);
  ctx.beginPath();
  ctx.moveTo(CHOICE_START_X + 30, center - 96);
  ctx.lineTo(CHOICE_END_X - 30, center - 96);
  ctx.moveTo(CHOICE_START_X + 30, center + 96);
  ctx.lineTo(CHOICE_END_X - 30, center + 96);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255, 248, 207, 0.34)";
  roundRect(FINAL_GATE_X - 165, center - 225, 330, 450, 8);
  ctx.fill();

  ctx.restore();
}

function drawCourseFences() {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#6f5338";
  ctx.lineWidth = 18;
  for (const fence of courseFenceSegments()) {
    ctx.beginPath();
    ctx.moveTo(fence.x1, fence.y1);
    ctx.lineTo(fence.x2, fence.y2);
    ctx.stroke();
  }

  ctx.strokeStyle = "#d9bc8c";
  ctx.lineWidth = 6;
  for (const fence of courseFenceSegments()) {
    ctx.beginPath();
    ctx.moveTo(fence.x1, fence.y1 - 3);
    ctx.lineTo(fence.x2, fence.y2 - 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBarn(x, y) {
  ctx.fillStyle = "#b93a37";
  ctx.fillRect(x, y + 50, 210, 86);
  ctx.fillStyle = "#81312a";
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 54);
  ctx.lineTo(x + 105, y);
  ctx.lineTo(x + 222, y + 54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f9e8c8";
  ctx.fillRect(x + 82, y + 86, 44, 50);
}

function drawFinishLine() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(FINISH_X, TRACK_TOP - 34, 16, TRACK_BOTTOM - TRACK_TOP + 50);
  ctx.fillStyle = "#202020";
  for (let y = TRACK_TOP - 30; y < TRACK_BOTTOM + 22; y += 28) {
    ctx.fillRect(FINISH_X, y, 16, 14);
  }
  ctx.fillStyle = "#202020";
  ctx.font = "900 24px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("FINISH", FINISH_X + 8, TRACK_TOP - 48);
}

function drawRouletteWalls() {
  ctx.save();
  ctx.shadowColor = "rgba(92, 57, 31, 0.35)";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#8e653d";
  ctx.lineWidth = 16;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (let x = 520; x < FINISH_X - 260; x += 720) {
    const yTop = TRACK_BOTTOM - 112;
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x + 180, yTop - 76);
    ctx.lineTo(x + 350, yTop - 8);
    ctx.lineTo(x + 540, yTop - 82);
    ctx.lineTo(x + 700, yTop - 18);
    ctx.stroke();
    ctx.strokeStyle = "#e4c088";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, yTop - 2);
    ctx.lineTo(x + 180, yTop - 78);
    ctx.lineTo(x + 350, yTop - 10);
    ctx.lineTo(x + 540, yTop - 84);
    ctx.lineTo(x + 700, yTop - 20);
    ctx.stroke();
    ctx.strokeStyle = "#8e653d";
    ctx.lineWidth = 16;
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawHazards() {
  for (const hazard of hazards) {
    if (hazard.x < cameraX - 280 || hazard.x > cameraX + W + 280) continue;
    if (hazard.type === "spinner") drawSpinner(hazard);
    if (hazard.type === "bar") drawBoingBar(hazard);
    if (hazard.type === "bumper") drawBumper(hazard);
    if (hazard.type === "mud") drawMud(hazard);
    if (hazard.type === "spring") drawSpring(hazard);
    if (hazard.type === "flipper") drawAutoFlipper(hazard);
    if (hazard.type === "feed") drawFeed(hazard);
    if (hazard.type === "gate") drawGate(hazard);
  }
}

function drawSpinner(h) {
  const angle = spinnerAngle(h);
  ctx.save();
  ctx.translate(h.x, h.y);

  ctx.strokeStyle = "rgba(66, 42, 24, 0.18)";
  ctx.lineWidth = h.armWidth + 10;
  ctx.lineCap = "round";
  const bladeCount = h.bladeCount || 3;
  for (let i = 0; i < bladeCount; i += 1) {
    const armAngle = angle + ((Math.PI * 2) / bladeCount) * i;
    ctx.beginPath();
    ctx.moveTo(Math.cos(armAngle) * 8, Math.sin(armAngle) * 8 + 7);
    ctx.lineTo(Math.cos(armAngle) * h.radius, Math.sin(armAngle) * h.radius + 7);
    ctx.stroke();
  }

  ctx.strokeStyle = "#6f5338";
  ctx.lineWidth = h.armWidth;
  ctx.lineCap = "round";
  for (let i = 0; i < bladeCount; i += 1) {
    const armAngle = angle + ((Math.PI * 2) / bladeCount) * i;
    ctx.beginPath();
    ctx.moveTo(Math.cos(armAngle) * 10, Math.sin(armAngle) * 10);
    ctx.lineTo(Math.cos(armAngle) * h.radius, Math.sin(armAngle) * h.radius);
    ctx.stroke();

    ctx.strokeStyle = "#d9bc8c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(armAngle) * 22, Math.sin(armAngle) * 22 - 2);
    ctx.lineTo(Math.cos(armAngle) * (h.radius - 12), Math.sin(armAngle) * (h.radius - 12) - 2);
    ctx.stroke();
    ctx.strokeStyle = "#6f5338";
    ctx.lineWidth = h.armWidth;
  }

  ctx.fillStyle = "#8b7358";
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3f3428";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#b7aa98";
  ctx.beginPath();
  ctx.arc(-7, -7, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

}

function drawBoingBar(h) {
  const segment = boingBarSegment(h);
  const open = isBoingBarOpen(h);
  ctx.save();
  ctx.shadowColor = "rgba(89, 55, 30, 0.35)";
  ctx.shadowBlur = open ? 4 : 10;
  ctx.globalAlpha = open ? 0.52 : 1;
  ctx.strokeStyle = open ? "#caa06d" : "#8e653d";
  ctx.lineWidth = open ? 11 : 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(segment.x1, segment.y1);
  ctx.lineTo(segment.x2, segment.y2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = open ? "#f1d39b" : "#e4c088";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(segment.x1 + 6, segment.y1 - 2);
  ctx.lineTo(segment.x2 - 6, segment.y2 - 2);
  ctx.stroke();
  if (open) {
    ctx.fillStyle = "#6b4a2d";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("열림", h.x, h.y - 76);
  }
  ctx.restore();
}

function drawBumper(h) {
  const wobble = Math.sin(elapsed * 8 + h.phase) * 2;
  ctx.fillStyle = "rgba(80, 45, 36, 0.22)";
  ctx.beginPath();
  ctx.ellipse(h.x, h.y + h.r + 9, h.r + 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f6a9bf";
  ctx.beginPath();
  ctx.ellipse(h.x, h.y + wobble, h.r + 14, h.r + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff2dc";
  ctx.lineWidth = 7;
  ctx.stroke();

  ctx.fillStyle = "#ffd7e2";
  ctx.beginPath();
  ctx.ellipse(h.x - 12, h.y - 9 + wobble, 13, 6, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#7a3a52";
  ctx.font = "900 17px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("보잉", h.x, h.y + 6 + wobble);
}

function drawMud(h) {
  ctx.fillStyle = "#8a5d4f";
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, 38, 20, 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpring(h) {
  ctx.fillStyle = "rgba(80, 45, 36, 0.2)";
  ctx.beginPath();
  ctx.ellipse(h.x, h.y + 25, 38, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c85a8a";
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const x = h.x - 24 + i * 12;
    ctx.lineTo(x, h.y + (i % 2 ? 14 : -14));
  }
  ctx.stroke();
  ctx.fillStyle = "#ffd0df";
  roundRect(h.x - 36, h.y + 13, 72, 16, 8);
  ctx.fill();
  ctx.fillStyle = "#7a3a52";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("통", h.x, h.y + 26);
}

function drawAutoFlipper(h) {
  const angle = Math.sin(elapsed * 7 + h.phase) * 0.24;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(angle);
  ctx.strokeStyle = "#7a3a52";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-42, 0);
  ctx.lineTo(42, 0);
  ctx.stroke();
  ctx.strokeStyle = "#ffbdd0";
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.moveTo(-36, 0);
  ctx.lineTo(36, 0);
  ctx.stroke();
  ctx.fillStyle = "#fff2dc";
  roundRect(-27, -9, 54, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#7a3a52";
  ctx.font = "900 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("보잉", 0, 4);
  ctx.fillStyle = "#7a3a52";
  ctx.beginPath();
  ctx.arc(-42, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFeed(h) {
  ctx.fillStyle = "#9a6a40";
  ctx.fillRect(h.x - 25, h.y - 12, 50, 26);
  ctx.fillStyle = "#efb842";
  ctx.beginPath();
  ctx.arc(h.x, h.y - 12, 20, 0, Math.PI, true);
  ctx.fill();
}

function drawGate(h) {
  const open = isGateOpen(h);
  ctx.save();

  ctx.shadowColor = "rgba(89, 55, 30, 0.35)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#6b4a2d";
  roundRect(h.x - 50, h.y - 35, 12, 70, 3);
  ctx.fill();
  roundRect(h.x + 38, h.y - 35, 12, 70, 3);
  ctx.fill();

  if (open) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 248, 207, 0.55)";
    roundRect(h.x - 32, h.y - 21, 64, 42, 8);
    ctx.fill();
    ctx.strokeStyle = "#e0b873";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 7]);
    ctx.strokeRect(h.x - 30, h.y - 19, 60, 38);
    ctx.setLineDash([]);
    ctx.fillStyle = "#6b4a2d";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("열림", h.x, h.y - 28);
  } else {
    ctx.strokeStyle = "#8e653d";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(h.x - 42, h.y - 16);
    ctx.lineTo(h.x + 42, h.y - 16);
    ctx.moveTo(h.x - 42, h.y + 16);
    ctx.lineTo(h.x + 42, h.y + 16);
    ctx.stroke();

    ctx.strokeStyle = "#e4c088";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(h.x - 35, h.y - 19);
    ctx.lineTo(h.x + 35, h.y - 19);
    ctx.moveTo(h.x - 35, h.y + 13);
    ctx.lineTo(h.x + 35, h.y + 13);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPig(pig) {
  const y = pig.y + Math.sin(pig.bob) * 3;
  const rolling = pig.rollTimer > 0;
  const pushing = pig.pushTimer > 0 && !rolling;
  const squash = rolling ? 0.98 : pushing ? 0.88 : pig.flipTimer > 0 ? 0.9 + Math.sin(pig.run * 2) * 0.04 : 1;
  const stretch = rolling ? 0.98 : pushing ? 1.14 : pig.recoilTimer > 0 ? 1.06 : 1;
  const leg = Math.sin(pig.run) * 5.5;
  const rearLeg = Math.cos(pig.run * 1.12) * 5;

  ctx.fillStyle = "rgba(94, 107, 115, 0.18)";
  ctx.beginPath();
  ctx.ellipse(pig.x - 4, y + 32, 50, 11, -0.03, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(pig.x, y);
  ctx.rotate(rolling ? pig.rollAngle : pushing ? pig.pushAngle * 0.18 : pig.tilt + (pig.flipTimer > 0 ? Math.sin(pig.spin) * 0.18 : 0));
  ctx.scale(PIG_DRAW_SCALE * 1.04 * stretch, PIG_DRAW_SCALE * squash);

  ctx.strokeStyle = "#d99797";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (rolling) {
    ctx.moveTo(-24, 16);
    ctx.lineTo(-34, 23);
    ctx.moveTo(-5, 18);
    ctx.lineTo(-16, 25);
    ctx.moveTo(18, 17);
    ctx.lineTo(28, 24);
    ctx.moveTo(34, 14);
    ctx.lineTo(42, 21);
  } else if (pushing) {
    ctx.moveTo(-23, 18);
    ctx.lineTo(-31, 28);
    ctx.moveTo(-6, 20);
    ctx.lineTo(-14, 29);
    ctx.moveTo(18, 19);
    ctx.lineTo(27, 28);
    ctx.moveTo(34, 16);
    ctx.lineTo(43, 25);
  } else {
    ctx.moveTo(-23, 18);
    ctx.lineTo(-27, 34 + rearLeg);
    ctx.moveTo(-6, 20);
    ctx.lineTo(-9, 34 - rearLeg);
    ctx.moveTo(18, 19);
    ctx.lineTo(21, 34 + leg);
    ctx.moveTo(34, 16);
    ctx.lineTo(37, 32 - leg);
  }
  ctx.stroke();

  ctx.strokeStyle = "#d99797";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(47, -7, 10, -0.55, Math.PI * 1.15);
  ctx.stroke();
  ctx.strokeStyle = pig.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(47, -7, 5, -0.6, Math.PI * 1.1);
  ctx.stroke();

  ctx.fillStyle = pig.color;
  ctx.beginPath();
  ctx.moveTo(-42, -6);
  ctx.quadraticCurveTo(-43, -24, -27, -25);
  ctx.lineTo(30, -25);
  ctx.quadraticCurveTo(50, -24, 54, -5);
  ctx.quadraticCurveTo(59, 20, 36, 24);
  ctx.lineTo(-20, 25);
  ctx.quadraticCurveTo(-47, 22, -47, 2);
  ctx.quadraticCurveTo(-48, -1, -42, -6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#efaaa9";
  ctx.beginPath();
  ctx.ellipse(-45, 1, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pig.ear;
  ctx.beginPath();
  ctx.moveTo(-18, -24);
  ctx.quadraticCurveTo(-8, -43, 7, -30);
  ctx.quadraticCurveTo(0, -17, -18, -24);
  ctx.fill();

  ctx.fillStyle = "#f6c1bf";
  ctx.beginPath();
  ctx.moveTo(-12, -25);
  ctx.quadraticCurveTo(-6, -34, 3, -29);
  ctx.quadraticCurveTo(-2, -22, -12, -25);
  ctx.fill();

  ctx.fillStyle = "#17334b";
  ctx.beginPath();
  ctx.arc(-30, -10, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e98d8a";
  ctx.beginPath();
  ctx.ellipse(-49, 4, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#cf6f73";
  ctx.beginPath();
  ctx.arc(-51, 1, 1.5, 0, Math.PI * 2);
  ctx.arc(-51, 7, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#bd7474";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(-31, 4, 6, 0.25, 1.05);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.ellipse(2, -14, 18, 5, -0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff7df";
  roundRect(3, -17, 24, 19, 5);
  ctx.fill();
  ctx.fillStyle = "#4d3434";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(String(pig.bib), 15, -2);
  ctx.restore();

  if (pushing) {
    ctx.fillStyle = "rgba(255, 247, 222, 0.82)";
    ctx.beginPath();
    ctx.arc(pig.x - 48, y + 3, 5, 0, Math.PI * 2);
    ctx.arc(pig.x - 56, y + 1, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (pig.recoilTimer > 0 && !pushing) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    const trail = rolling ? 18 : 0;
    ctx.moveTo(pig.x + 46 - trail, y - 22);
    ctx.lineTo(pig.x + 72 - trail, y - 28);
    ctx.moveTo(pig.x + 48 - trail, y + 2);
    ctx.lineTo(pig.x + 82 - trail, y + 2);
    ctx.moveTo(pig.x + 42 - trail, y + 24);
    ctx.lineTo(pig.x + 68 - trail, y + 31);
    ctx.stroke();
  }

  ctx.fillStyle = "#2f2425";
  ctx.font = "800 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(pig.label, pig.x, y - 38);

  if (pig.eventTimer > 0) {
    ctx.globalAlpha = Math.min(1, pig.eventTimer * 1.6);
    ctx.fillStyle = pig.eventColor || "#ffffff";
    ctx.font = "900 17px system-ui";
    ctx.fillText(pig.eventText, pig.x, y - 58 - (1 - pig.eventTimer) * 18);
    ctx.globalAlpha = 1;
  }
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.8);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(90, 230);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(0.35, 0.75),
      color,
    });
  }
}

function updateParticles(dt) {
  particles = particles.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    return p.life > 0;
  });
}

function loop(time) {
  const dt = Math.min(0.032, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  animationId = requestAnimationFrame(loop);
}

startBtn.addEventListener("click", startRace);
resetBtn.addEventListener("click", () => setupRace(true));
sampleBtn.addEventListener("click", () => setupRace(false));
applyNamesBtn.addEventListener("click", applyRosterFromInput);
nameInput.addEventListener("input", scheduleRosterApply);

if (isTestMode && sectionGuideToggle) {
  sectionGuideToggle.hidden = false;
  sectionGuideToggle.textContent = showSectionGuides ? "구간선 끄기" : "구간선 켜기";
  sectionGuideToggle.classList.toggle("is-active", showSectionGuides);
  sectionGuideToggle.addEventListener("click", () => {
    showSectionGuides = !showSectionGuides;
    sectionGuideToggle.textContent = showSectionGuides ? "구간선 끄기" : "구간선 켜기";
    sectionGuideToggle.classList.toggle("is-active", showSectionGuides);
    draw();
  });
}

nameInput.value = nameInput.value.trim() || defaultNameInput;
roster = parseRosterInput(nameInput.value);
setupRace(true);
cancelAnimationFrame(animationId);
animationId = requestAnimationFrame(loop);
