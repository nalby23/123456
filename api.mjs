import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const CATS = ["pitch", "gear", "snacks", "ref", "other"];
const EMPTY = { rev: 0, updated: null, incomes: [], expenses: [] };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function passwordOk(req) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real) return false;
  const a = Buffer.from(req.headers.get("x-admin-password") || "");
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

const isId = (v) => typeof v === "string" && /^[\w-]{1,40}$/.test(v);
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isAmt = (v) => typeof v === "number" && isFinite(v) && v > 0 && v < 100000000;
const text = (v, max) => String(v == null ? "" : v).slice(0, max);

function clean(s) {
  if (!s || !Array.isArray(s.incomes) || !Array.isArray(s.expenses)) return null;
  if (s.incomes.length > 5000 || s.expenses.length > 5000) return null;
  const incomes = [];
  for (const i of s.incomes) {
    if (!isId(i.id) || !isAmt(i.amount) || !isDate(i.date)) return null;
    incomes.push({ id: i.id, amount: i.amount, date: i.date, note: text(i.note, 200) });
  }
  const expenses = [];
  for (const e of s.expenses) {
    if (!isId(e.id) || !isAmt(e.amount) || !isDate(e.date)) return null;
    expenses.push({
      id: e.id,
      name: text(e.name, 200),
      cat: CATS.includes(e.cat) ? e.cat : "other",
      amount: e.amount,
      date: e.date,
      hasReceipt: !!e.hasReceipt,
    });
  }
  return { incomes, expenses };
}

export default async (req) => {
  const store = getStore({ name: "kupa", consistency: "strong" });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");

  if (path === "data" && req.method === "GET") {
    return json((await store.get("state", { type: "json" })) || EMPTY);
  }

  if (path === "receipt" && req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!isId(id)) return json({ error: "bad id" }, 400);
    const src = await store.get("receipt-" + id);
    if (!src) return json({ error: "not found" }, 404);
    return json({ src });
  }

  if (path === "login" && req.method === "POST") {
    return passwordOk(req) ? json({ ok: true }) : json({ ok: false }, 401);
  }

  if (path === "save" && req.method === "POST") {
    if (!passwordOk(req)) return json({ error: "unauthorized" }, 401);
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const next = clean(body && body.state);
    if (!next) return json({ error: "bad state" }, 400);

    const current = (await store.get("state", { type: "json" })) || EMPTY;
    if (body.baseRev !== current.rev) return json({ error: "conflict", state: current }, 409);

    const receipts = body.receipts && typeof body.receipts === "object" ? body.receipts : {};
    for (const [id, src] of Object.entries(receipts)) {
      if (!isId(id) || typeof src !== "string" || !src.startsWith("data:image/") || src.length > 1500000) {
        return json({ error: "bad receipt" }, 400);
      }
    }
    for (const e of next.expenses) {
      if (receipts[e.id]) e.hasReceipt = true;
    }
    for (const [id, src] of Object.entries(receipts)) {
      if (next.expenses.some((e) => e.id === id)) await store.set("receipt-" + id, src);
    }
    const keep = new Set(next.expenses.filter((e) => e.hasReceipt).map((e) => e.id));
    for (const e of current.expenses) {
      if (e.hasReceipt && !keep.has(e.id)) await store.delete("receipt-" + e.id);
    }

    const saved = { rev: current.rev + 1, updated: new Date().toISOString(), ...next };
    await store.setJSON("state", saved);
    return json(saved);
  }

  return json({ error: "not found" }, 404);
};

export const config = { path: "/api/*" };
