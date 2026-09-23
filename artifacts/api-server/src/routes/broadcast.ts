import { Router } from "express";

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
let boostUntil: number = 0; let pendingCoins: number = 0; router.post("/boost", (req, res) => { const { secret } = req.body as { secret?: string }; const expected = getSecret(); if (secret !== expected) return res.status(401).json({ error: "Falsches Passwort." }); boostUntil = Date.now() + 180000; res.json({ ok: true }); }); router.get("/boost", (_req, res) => { res.json({ active: Date.now() < boostUntil, until: boostUntil }); }); router.post("/coins", (req, res) => { const { secret } = req.body as { secret?: string }; const expected = getSecret(); if (secret !== expected) return res.status(401).json({ error: "Falsches Passwort." }); pendingCoins += 200; res.json({ ok: true }); }); router.get("/coins", (_req, res) => { if(pendingCoins > 0){ const amount = pendingCoins; pendingCoins = 0; res.json({ grant: amount }); } else { res.json({ grant: 0 }); } });
export default router; let poll:{question:string;optionA:string;optionB:string;votesA:number;votesB:number;active:boolean;voters:string[]}|null=null; router.post('/poll/start',(req,res)=>{const{secret,question,optionA,optionB}=req.body;const expected=getSecret();if(secret!==expected)return res.status(401).json({error:'Falsches Passwort.'});poll={question,optionA,optionB,votesA:0,votesB:0,active:true,voters:[]};res.json({ok:true});}); router.post('/poll/vote',(req,res)=>{const{option,voterId}=req.body;if(!poll||!poll.active)return res.status(400).json({error:'Keine aktive Umfrage.'});if(poll.voters.includes(voterId))return res.status(400).json({error:'Bereits abgestimmt.'});poll.voters.push(voterId);if(option==='A')poll.votesA++;else poll.votesB++;res.json({ok:true});}); router.get('/poll',(_req,res)=>{res.json(poll??{active:false});}); router.post('/poll/stop',(req,res)=>{const{secret}=req.body;const expected=getSecret();if(secret!==expected)return res.status(401).json({error:'Falsches Passwort.'});if(poll)poll.active=false;res.json({ok:true});});
