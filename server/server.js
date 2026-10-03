import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3001;
const app = express();
app.use(cors({ origin: true }));

app.get("/", (_req, res) => res.json({ ok: true, service: "Pixel Arena server" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const players = new Map();
const colors = ["#60a5fa","#f472b6","#facc15","#a78bfa","#fb7185","#34d399","#fb923c"];

function spawn() {
  return { x: 120 + Math.random() * 2160, y: 120 + Math.random() * 1160 };
}

io.on("connection", socket => {
  socket.on("join", payload => {
    const name = String(payload?.name || "Игрок").slice(0, 16);
    const pos = spawn();
    const player = {
      id: socket.id,
      name,
      x: pos.x,
      y: pos.y,
      color: colors[Math.floor(Math.random() * colors.length)]
    };

    players.set(socket.id, player);
    socket.emit("world", { players: [...players.values()] });
    socket.broadcast.emit("playerJoined", player);
  });

  socket.on("move", payload => {
    const p = players.get(socket.id);
    if (!p) return;

    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    p.x = Math.max(30, Math.min(2370, x));
    p.y = Math.max(30, Math.min(1370, y));
    socket.broadcast.emit("playerMoved", p);
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    io.emit("playerLeft", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Pixel Arena server listening on ${PORT}`);
});
