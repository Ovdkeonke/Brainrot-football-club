import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { brainrotCoinGrantsTable, brainrotRedeemCodesTable, db } from "@workspace/db";

const router = Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

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
  if (!expected) {
    res.status(500).json({ error: "BROADCAST_SECRET not configured." });
    return;
  }
  if (secret !== expected) {
    res.status(401).json({ error: "Falsches Passwort." });
    return;
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "Nachricht darf nicht leer sein." });
    return;
  }
  broadcast = { message: message.trim(), active: true, timestamp: Date.now() };
  res.json({ ok: true });
});

router.delete("/broadcast", (req, res) => {
  const { secret } = req.body as { secret?: string };
  const expected = getSecret();
  if (!expected) {
    res.status(500).json({ error: "BROADCAST_SECRET not configured." });
    return;
  }
  if (secret !== expected) {
    res.status(401).json({ error: "Falsches Passwort." });
    return;
  }
  broadcast = null;
  res.json({ ok: true });
});
let boostUntil: number = 0;
router.post("/boost", (req, res) => {
  const { secret } = req.body as { secret?: string };
  const expected = getSecret();
  if (!expected) {
    res.status(500).json({ error: "BROADCAST_SECRET not configured." });
    return;
  }
  if (secret !== expected) {
    res.status(401).json({ error: "Falsches Passwort." });
    return;
  }
  boostUntil = Date.now() + 180000;
  res.json({ ok: true });
});
router.get("/boost", (_req, res) => {
  res.json({ active: Date.now() < boostUntil, until: boostUntil });
});

const activePlayers = new Map<string, number>();
router.post("/coins", async (req, res): Promise<void> => {
  const { secret } = req.body as { secret?: string };
  const expected = getSecret();
  if (!expected) {
    res.status(500).json({ error: "BROADCAST_SECRET not configured." });
    return;
  }
  if (secret !== expected) {
    res.status(401).json({ error: "Falsches Passwort." });
    return;
  }

  const now = Date.now();
  const onlineCutoff = now - 60_000;
  let recipients = 0;
  for (const [clientId, lastSeen] of activePlayers) {
    if (lastSeen < onlineCutoff) {
      activePlayers.delete(clientId);
      continue;
    }
    recipients++;
  }
  const recipientIds = [...activePlayers]
    .filter(([, lastSeen]) => lastSeen >= onlineCutoff)
    .map(([clientId]) => clientId);
  await Promise.all(recipientIds.map((clientId) =>
    db.insert(brainrotCoinGrantsTable)
      .values({ clientId, amount: 200 })
      .onConflictDoUpdate({
        target: brainrotCoinGrantsTable.clientId,
        set: {
          amount: sql`${brainrotCoinGrantsTable.amount} + 200`,
          updatedAt: new Date(),
        },
      }),
  ));
  res.json({ ok: true, recipients });
});
router.get("/coins", async (req, res): Promise<void> => {
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(clientId)) {
    res.status(400).json({ error: "Ungültige Spieler-ID." });
    return;
  }

  activePlayers.set(clientId, Date.now());
  const [grantRow] = await db.delete(brainrotCoinGrantsTable)
    .where(eq(brainrotCoinGrantsTable.clientId, clientId))
    .returning({ amount: brainrotCoinGrantsTable.amount });
  const grant = grantRow?.amount ?? 0;
  res.json({ grant });
});

function normalizedCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}
function validCodeLimit(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}
router.post("/codes", async (req, res): Promise<void> => {
  const { secret, code: rawCode, limit: rawLimit } = req.body as {
    secret?: string;
    code?: unknown;
    limit?: unknown;
  };
  const expected = getSecret();
  if (!expected) {
    res.status(500).json({ error: "BROADCAST_SECRET not configured." });
    return;
  }
  if (secret !== expected) {
    res.status(401).json({ error: "Falsches Passwort." });
    return;
  }

  const code = normalizedCode(rawCode);
  const limit = Number(rawLimit);
  if (!code || code.length > 64 || !validCodeLimit(limit)) {
    res.status(400).json({ error: "Code und ein gültiges Limit eingeben." });
    return;
  }

  const [existing] = await db.select({
    used: brainrotRedeemCodesTable.used,
  }).from(brainrotRedeemCodesTable)
    .where(eq(brainrotRedeemCodesTable.code, code))
    .limit(1);
  if (existing && limit < existing.used) {
    res.status(400).json({ error: "Das Limit kann nicht kleiner als die bisherigen Einlösungen sein." });
    return;
  }
  const [saved] = await db.insert(brainrotRedeemCodesTable)
    .values({ code, limit, used: existing?.used ?? 0 })
    .onConflictDoUpdate({
      target: brainrotRedeemCodesTable.code,
      set: { limit },
    })
    .returning({
      limit: brainrotRedeemCodesTable.limit,
      used: brainrotRedeemCodesTable.used,
    });
  res.json({ ok: true, code, limit: saved.limit, used: saved.used });
});
router.post("/codes/import", async (req, res): Promise<void> => {
  const { secret, codes } = req.body as {
    secret?: string;
    codes?: Record<string, { limit?: unknown; used?: unknown }>;
  };
  const expected = getSecret();
  if (!expected) {
    res.status(500).json({ error: "BROADCAST_SECRET not configured." });
    return;
  }
  if (secret !== expected) {
    res.status(401).json({ error: "Falsches Passwort." });
    return;
  }
  if (!codes || typeof codes !== "object" || Array.isArray(codes)) {
    res.status(400).json({ error: "Keine gültigen Codes übergeben." });
    return;
  }

  const rows: { code: string; limit: number; used: number }[] = [];
  for (const [rawCode, data] of Object.entries(codes)) {
    const code = normalizedCode(rawCode);
    const limit = Number(data?.limit);
    const used = Number(data?.used ?? 0);
    if (!code || code.length > 64 || !validCodeLimit(limit) ||
        !Number.isSafeInteger(used) || used < 0 || used > limit) continue;
    rows.push({ code, limit, used });
  }
  if (!rows.length) {
    res.json({ ok: true, imported: 0 });
    return;
  }
  const imported = await db.insert(brainrotRedeemCodesTable)
    .values(rows)
    .onConflictDoNothing()
    .returning({ code: brainrotRedeemCodesTable.code });
  res.json({ ok: true, imported: imported.length });
});
router.post("/redeem", async (req, res): Promise<void> => {
  const code = normalizedCode((req.body as { code?: unknown }).code);
  if (!code) {
    res.status(400).json({ error: "Code eingeben." });
    return;
  }
  const [redeemData] = await db.update(brainrotRedeemCodesTable)
    .set({ used: sql`${brainrotRedeemCodesTable.used} + 1` })
    .where(and(
      eq(brainrotRedeemCodesTable.code, code),
      sql`${brainrotRedeemCodesTable.used} < ${brainrotRedeemCodesTable.limit}`,
    ))
    .returning({
      used: brainrotRedeemCodesTable.used,
      limit: brainrotRedeemCodesTable.limit,
    });
  if (redeemData) {
    res.json({ ok: true, coins: 1000, remaining: redeemData.limit - redeemData.used });
    return;
  }
  const [existing] = await db.select({
    code: brainrotRedeemCodesTable.code,
  }).from(brainrotRedeemCodesTable)
    .where(eq(brainrotRedeemCodesTable.code, code))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Code ungültig." });
    return;
  }
  res.status(409).json({ error: "Dieser Code ist aufgebraucht." });
  return;
});

type Poll = {
  question: string;
  optionA: string;
  optionB: string;
  votesA: number;
  votesB: number;
  active: boolean;
  voters: string[];
};
let poll: Poll | null = null;
router.post("/poll/start", (req, res) => {
  const { secret, question, optionA, optionB } = req.body as {
    secret?: string;
    question?: string;
    optionA?: string;
    optionB?: string;
  };
  const expected = getSecret();
  if (!expected || secret !== expected) {
    res.status(expected ? 401 : 500).json({
      error: expected ? "Falsches Passwort." : "BROADCAST_SECRET not configured.",
    });
    return;
  }
  if (!question?.trim() || !optionA?.trim() || !optionB?.trim()) {
    res.status(400).json({ error: "Frage und beide Antworten eingeben." });
    return;
  }
  poll = {
    question: question.trim(),
    optionA: optionA.trim(),
    optionB: optionB.trim(),
    votesA: 0,
    votesB: 0,
    active: true,
    voters: [],
  };
  res.json({ ok: true });
});
router.post("/poll/vote", (req, res) => {
  const { option, voterId } = req.body as { option?: string; voterId?: string };
  if (!poll || !poll.active) {
    res.status(400).json({ error: "Keine aktive Umfrage." });
    return;
  }
  if (typeof voterId !== "string" || !voterId.trim() || poll.voters.includes(voterId)) {
    res.status(400).json({ error: "Bereits abgestimmt." });
    return;
  }
  if (option !== "A" && option !== "B") {
    res.status(400).json({ error: "Ungültige Antwort." });
    return;
  }
  poll.voters.push(voterId);
  if (option === "A") poll.votesA++;
  else poll.votesB++;
  res.json({ ok: true });
});
router.get("/poll", (_req, res) => {
  res.json(poll ?? { active: false });
});
router.post("/poll/stop", (req, res) => {
  const { secret } = req.body as { secret?: string };
  const expected = getSecret();
  if (!expected || secret !== expected) {
    res.status(expected ? 401 : 500).json({
      error: expected ? "Falsches Passwort." : "BROADCAST_SECRET not configured.",
    });
    return;
  }
  if (poll) poll.active = false;
  res.json({ ok: true });
});

export default router;
