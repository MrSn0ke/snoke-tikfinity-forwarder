import WebSocket from "ws";
import fetch from "node-fetch";

// 1) מקור האירועים של TikFinity (מקומי על המחשב שלך)
const TIKFINITY_WS = "ws://localhost:21213";

// 2) ה-Relay שלך ב-Render
const RELAY_URL = "https://snoke-relay.onrender.com/webhooks/tikfinity";

// 3) אותו SECRET ששמת ב-Render
const SECRET = "Snoke_2025_live";

// לוג עזר קצר
const log = (...args) => console.log(new Date().toISOString(), ...args);

// מנרמל את אירועי TikFinity לפורמט שהאתר שלך מבין
function normalize(ev) {
  const type = ev.event || ev.type || "unknown";
  const d = ev.data || ev.payload || {};

  const user = d.user || d.sender || d.username ? {
    id: d.userId || d.uid || undefined,
    name: d.username || d.user || d.sender || "Someone",
    avatar: d.profilePictureUrl || d.avatar || undefined
  } : undefined;

  const gift = d.gift ? {
    name: d.gift.name || d.giftType || "Gift",
    amount: d.gift.repeatCount || d.gift.amount || 1,
    value: d.gift.diamondCount || d.gift.value || 0
  } : undefined;

  const payload =
    type === "gift" ? { gift } :
    type === "live_status" ? { isLive: d.isLive, viewers: d.viewers } :
    d;

  return { type, user, payload, ts: Date.now() };
}

function start() {
  const ws = new WebSocket(TIKFINITY_WS);

  ws.on("open", () => log("Connected to TikFinity WS:", TIKFINITY_WS));

  ws.on("message", async (buf) => {
    try {
      const raw = JSON.parse(buf.toString());
      const event = normalize(raw);
      log("Event:", event.type, event.user?.name ?? "", event.payload?.gift?.name ?? "");

      const res = await fetch(RELAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": SECRET
        },
        body: JSON.stringify(event)
      });

      if (!res.ok) {
        log("Relay POST failed", res.status, await res.text());
      }
    } catch (e) {
      log("Parse/send error:", e.message);
    }
  });

  ws.on("close", () => {
    log("TikFinity WS closed. Reconnecting in 3s...");
    setTimeout(start, 3000);
  });

  ws.on("error", (err) => log("WS error:", err.message));
}

start();
