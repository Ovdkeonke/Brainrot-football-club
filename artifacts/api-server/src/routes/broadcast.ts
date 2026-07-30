import { Router } from "express";

const router = Router();

// In-memory store — resets on server restart, simple and sufficient
let broadcast: { message: string; active: boolean; timestamp: number } | null = null;

function getSecret(): string {
  return process.env.BROADCAST_SECRET ?? "";
}

router.get("/broadcast", (_req, res) => {
  res.json(broadcast ?? { message: "", active: false, timestamp: 0 });
});

router.post("/broadcast", (req, res) => {
  const { message, secret } = req.body as { message?: string; secret?: string };
  const expected = getSecret();
  if (!expected) return res.status(500).json({ error: "BROADCAST_SECRET not configured." });
  if (secret !== expected) return res.status(401).json({ error: "Falsches Passwort." });
  if (!message || typeof message !== "string" || !message.trim())
    return res.status(400).json({ error: "Nachricht darf nicht leer sein." });
  broadcast = { message: message.trim(), active: true, timestamp: Date.now() };
  res.json({ ok: true });
});

router.delete("/broadcast", (req, res) => {
  const { secret } = req.body as { secret?: string };
  const expected = getSecret();
  if (!expected) return res.status(500).json({ error: "BROADCAST_SECRET not configured." });
  if (secret !== expected) return res.status(401).json({ error: "Falsches Passwort." });
  broadcast = null;
  res.json({ ok: true });
});

export default router;
