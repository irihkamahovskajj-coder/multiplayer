const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");
const hud = document.getElementById("hud");
const mobileControls = document.getElementById("mobileControls");
const nameInput = document.getElementById("nameInput");
const serverInput = document.getElementById("serverInput");
const playButton = document.getElementById("playButton");
const statusEl = document.getElementById("status");
const playerCountEl = document.getElementById("playerCount");
const connectionEl = document.getElementById("connection");

const WORLD = { width: 2400, height: 1400 };
const keys = new Set();
const players = new Map();

let socket = null;
let myId = "local";
let me = {
  id: myId,
  name: "Игрок",
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  color: "#22c55e"
};
let camera = { x: 0, y: 0 };
let last = performance.now();
let lastSent = 0;

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

const params = new URLSearchParams(location.search);
const urlServer = params.get("server");
const savedServer = localStorage.getItem("pixelArenaServer");
if (urlServer) serverInput.value = urlServer;
else if (savedServer) serverInput.value = savedServer;

function setKey(key, down) {
  if (down) keys.add(key);
  else keys.delete(key);
}

addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"," "].includes(key)) {
    e.preventDefault();
    setKey(key, true);
  }
});

addEventListener("keyup", e => setKey(e.key.toLowerCase(), false));
addEventListener("blur", () => keys.clear());

for (const btn of document.querySelectorAll("#mobileControls button")) {
  const key = btn.dataset.key;
  const down = e => { e.preventDefault(); setKey(key, true); };
  const up = e => { e.preventDefault(); setKey(key, false); };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
}

function localMode() {
  socket?.disconnect();
  socket = null;
  myId = "local";
  me.id = myId;
  players.clear();
  players.set(me.id, me);
  playerCountEl.textContent = "Игроков: 1";
  connectionEl.textContent = "Локальный режим";
}

function connectMultiplayer(serverUrl) {
  if (!serverUrl || !window.io) return;

  statusEl.textContent = "Подключение к multiplayer-серверу…";
  connectionEl.textContent = "Подключение…";

  socket = io(serverUrl, {
    transports: ["websocket", "polling"],
    timeout: 6000,
    reconnection: true
  });

  socket.on("connect", () => {
    myId = socket.id;
    me.id = myId;
    socket.emit("join", { name: me.name });
    statusEl.textContent = "Multiplayer подключён";
    connectionEl.textContent = "Онлайн";
  });

  socket.on("world", data => {
    players.clear();
    for (const p of data.players || []) players.set(p.id, p);
    me = players.get(myId) || me;
    playerCountEl.textContent = `Игроков: ${players.size}`;
  });

  socket.on("playerJoined", p => {
    players.set(p.id, p);
    playerCountEl.textContent = `Игроков: ${players.size}`;
  });

  socket.on("playerMoved", p => {
    if (p.id === myId) return;
    players.set(p.id, p);
  });

  socket.on("playerLeft", id => {
    players.delete(id);
    playerCountEl.textContent = `Игроков: ${players.size}`;
  });

  socket.on("connect_error", () => {
    // The game remains playable locally.
    statusEl.textContent = "Сервер недоступен — игра работает локально";
    connectionEl.textContent = "Локальный режим";
    localMode();
  });

  socket.on("disconnect", () => {
    connectionEl.textContent = "Локальный режим";
  });
}

playButton.addEventListener("click", startGame);
nameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") startGame();
});

function startGame() {
  me.name = (nameInput.value.trim() || "Игрок").slice(0, 16);
  me.x = WORLD.width / 2;
  me.y = WORLD.height / 2;

  localMode();
  players.set(me.id, me);

  const serverUrl = serverInput.value.trim().replace(/\/$/, "");
  if (serverUrl) {
    localStorage.setItem("pixelArenaServer", serverUrl);
    connectMultiplayer(serverUrl);
  } else {
    statusEl.textContent = "Готово — WASD или стрелки";
  }

  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  mobileControls.classList.remove("hidden");
}

function update(dt, now) {
  let dx = 0, dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const speed = 280;
    me.x = Math.max(30, Math.min(WORLD.width - 30, me.x + dx / len * speed * dt));
    me.y = Math.max(30, Math.min(WORLD.height - 30, me.y + dy / len * speed * dt));
    players.set(myId, me);

    if (socket?.connected && now - lastSent > 40) {
      socket.emit("move", { x: me.x, y: me.y });
      lastSent = now;
    }
  }

  camera.x = Math.max(0, Math.min(WORLD.width - innerWidth, me.x - innerWidth / 2));
  camera.y = Math.max(0, Math.min(WORLD.height - innerHeight, me.y - innerHeight / 2));
}

function draw() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  ctx.fillStyle = "#18212f";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.strokeStyle = "rgba(148,163,184,.10)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.width; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
  }
  for (let y = 0; y <= WORLD.height; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
  }

  const blocks = [
    [280,260,260,90],[740,190,110,280],[1120,500,320,90],
    [1650,250,300,110],[1860,700,130,300],[480,920,340,90],
    [1060,1020,120,230],[1480,930,330,90]
  ];
  for (const [x,y,w,h] of blocks) {
    ctx.fillStyle = "#334155";
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(x,y,w,h);
  }

  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 5;
  ctx.strokeRect(0,0,WORLD.width,WORLD.height);

  for (const p of players.values()) drawPlayer(p);
  ctx.restore();
}

function drawPlayer(p) {
  const isMe = p.id === myId;
  ctx.save();

  ctx.shadowColor = isMe ? "#22c55e" : "#000";
  ctx.shadowBlur = isMe ? 18 : 7;

  ctx.beginPath();
  ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = p.color || "#60a5fa";
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = isMe ? 4 : 2;
  ctx.strokeStyle = isMe ? "#dcfce7" : "#e2e8f0";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(p.x + 7, p.y - 6, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#0f172a";
  ctx.fill();

  ctx.font = "600 14px system-ui";
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,.85)";
  ctx.strokeText(p.name, p.x, p.y - 34);
  ctx.fillStyle = "#fff";
  ctx.fillText(p.name, p.x, p.y - 34);

  ctx.restore();
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt, now);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
