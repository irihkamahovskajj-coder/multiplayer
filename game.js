const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");
const hud = document.getElementById("hud");
const nameInput = document.getElementById("nameInput");
const playButton = document.getElementById("playButton");
const hint = document.getElementById("connectionHint");
const playerCount = document.getElementById("playerCount");

const SERVER_URL =
  window.GAME_SERVER_URL ||
  (location.hostname === "localhost" ? "http://localhost:3001" : "https://YOUR-SERVER.onrender.com");

const WORLD = { width: 2400, height: 1400 };
const players = new Map();
const keys = new Set();

let socket = null;
let me = null;
let last = performance.now();
let camera = { x: 0, y: 0 };

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

addEventListener("keydown", e => {
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","w","a","s","d","W","A","S","D"].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.key.toLowerCase());
});
addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));

function connect() {
  const name = (nameInput.value.trim() || "Игрок").slice(0, 16);
  hint.textContent = "Сервер: подключение…";
  socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    hint.textContent = "Сервер: подключён";
    socket.emit("join", { name });
  });

  socket.on("world", snapshot => {
    for (const p of snapshot.players) players.set(p.id, p);
    me = players.get(socket.id) || me;
    playerCount.textContent = `Игроков: ${players.size}`;
  });

  socket.on("playerJoined", p => {
    players.set(p.id, p);
    playerCount.textContent = `Игроков: ${players.size}`;
  });

  socket.on("playerMoved", p => {
    players.set(p.id, p);
    if (p.id === socket.id) me = p;
  });

  socket.on("playerLeft", id => {
    players.delete(id);
    playerCount.textContent = `Игроков: ${players.size}`;
  });

  socket.on("disconnect", () => {
    hint.textContent = "Соединение потеряно";
  });

  socket.on("connect_error", () => {
    hint.textContent = "Не удалось подключиться к игровому серверу";
  });
}

playButton.addEventListener("click", () => {
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  connect();
});
nameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") playButton.click();
});

function update(dt) {
  if (!socket || !socket.connected || !me) return;

  let dx = 0, dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const speed = 260;
    me.x = Math.max(30, Math.min(WORLD.width - 30, me.x + dx / len * speed * dt));
    me.y = Math.max(30, Math.min(WORLD.height - 30, me.y + dy / len * speed * dt));
    socket.emit("move", { x: me.x, y: me.y });
  }

  camera.x = Math.max(0, Math.min(WORLD.width - innerWidth, me.x - innerWidth / 2));
  camera.y = Math.max(0, Math.min(WORLD.height - innerHeight, me.y - innerHeight / 2));
}

function draw() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Background
  ctx.fillStyle = "#1b2636";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Grid
  ctx.strokeStyle = "rgba(148,163,184,.10)";
  ctx.lineWidth = 1;
  const grid = 80;
  for (let x = 0; x <= WORLD.width; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
  }
  for (let y = 0; y <= WORLD.height; y += grid) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
  }

  // Arena border
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);

  // Decorative obstacles
  const blocks = [
    [280, 260, 260, 90], [740, 190, 110, 280], [1120, 500, 320, 90],
    [1650, 250, 300, 110], [1860, 700, 130, 300], [480, 920, 340, 90],
    [1060, 1020, 120, 230], [1480, 930, 330, 90]
  ];
  for (const [x,y,w,h] of blocks) {
    ctx.fillStyle = "#334155";
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(x,y,w,h);
  }

  // Spawn marker
  ctx.beginPath();
  ctx.arc(WORLD.width/2, WORLD.height/2, 70, 0, Math.PI*2);
  ctx.strokeStyle = "rgba(34,197,94,.25)";
  ctx.lineWidth = 3;
  ctx.stroke();

  for (const p of players.values()) drawPlayer(p);
  ctx.restore();
}

function drawPlayer(p) {
  const isMe = socket && p.id === socket.id;
  const radius = 22;

  ctx.save();
  ctx.shadowColor = isMe ? "#22c55e" : "#000";
  ctx.shadowBlur = isMe ? 18 : 8;

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = p.color || "#60a5fa";
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.lineWidth = isMe ? 4 : 2;
  ctx.strokeStyle = isMe ? "#dcfce7" : "#e2e8f0";
  ctx.stroke();

  // Direction/face
  ctx.beginPath();
  ctx.arc(p.x + 7, p.y - 6, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#0f172a";
  ctx.fill();

  ctx.font = "600 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0,0,0,.8)";
  ctx.lineWidth = 4;
  ctx.strokeText(p.name, p.x, p.y - 34);
  ctx.fillText(p.name, p.x, p.y - 34);

  ctx.restore();
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
