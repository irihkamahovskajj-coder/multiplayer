import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3001;
const app = express();
app.use(cors());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "Pixel Arena multiplayer server" });
});
app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const players = new Map();
const colors = ["#60a5fa", "#f472b6", "#facc15", "#a78bfa", "#fb7185", "#34d399", "#fb923c"];

function spawn() {
  return {
    x: 120 + Math.random() * 2160,
    y: 120 + Math.random() * 1160
  };
}

io.on("connection", socket => {
  socket.on("join", ({ name }) => {
    if (players.has(socket.id)) return;

    const pos = spawn();
    const player = {
      id: socket.id,
      name: String(name || "Игрок").slice(0, 16),
      x: pos.x,
      y: pos.y,
      color: colors[Math.floor(Math.random() * colors.length)]
    };

    players.set(socket.id, player);
    socket.emit("world", { players: [...players.values()] });
    socket.broadcast.emit("playerJoined", player);
  });

  socket.on("move", ({ x, y }) => {
    const p = players.get(socket.id);
    if (!p) return;

    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;

    // Server-side bounds validation.
    p.x = Math.max(30, Math.min(2370, nx));
    p.y = Math.max(30, Math.min(1370, ny));
    socket.broadcast.emit("playerMoved", p);
  });

  socket.on("disconnect", () => {
    if (players.delete(socket.id)) {
      io.emit("playerLeft", socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Pixel Arena server listening on port ${PORT}`);
});
