import { AISLES, guessAisle } from "./categories.js";
import { icon } from "./icons.js";
import * as store from "./store.js";

const $ = id => document.getElementById(id);
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const ID_RE = /^[A-Za-z0-9]{20,40}$/;

let listId = null, myName = "", uid = null;
let items = [], aisle = "אחר", manual = false, confirming = false, ready = false;

/* ---------- list link (the secret family code lives after the #) ---------- */
function newListId() {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const r = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(r, b => abc[b % abc.length]).join("");
}
function idFromText(text) {
  const m = String(text || "").trim().match(/#?([A-Za-z0-9]{20,40})\s*$/);
  return m && ID_RE.test(m[1]) ? m[1] : null;
}
const listUrl = () => location.origin + location.pathname + "#" + listId;

function chooseList() {
  const fromHash = idFromText(location.hash);
  if (fromHash) { LS.set("listId", fromHash); return fromHash; }
  const saved = LS.get("listId");
  if (saved && ID_RE.test(saved)) { history.replaceState(null, "", "#" + saved); return saved; }
  return null;
}

/* ---------- ui helpers ---------- */
function status(msg, err) { const s = $("status"); s.hidden = !msg; s.textContent = msg || ""; s.classList.toggle("err", !!err); }
let toastTimer;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2600); }
function show(which) { ["welcome", "nameBox", "app"].forEach(id => $(id).hidden = id !== which); }
function setAisle(a) { aisle = a; [...$("aisles").children].forEach(c => c.setAttribute("aria-pressed", c.dataset.a === a)); }

AISLES.forEach(a => {
  const b = document.createElement("button"); b.type = "button"; b.dataset.a = a;
  b.append(icon(a, "sm"), a); b.setAttribute("aria-pressed", a === aisle);
  b.onclick = () => {
    if (swiped) return;                       // a swipe across the chip row is not a choice
    setAisle(a);
    // Only a choice made after typing overrides the automatic one; a chip tapped on an
    // empty field (often by accident) gives way to the guess as soon as typing starts.
    manual = $("item").value.trim() !== "";
    $("item").focus();
  };
  $("aisles").append(b);
});
let swipeStart = 0, swiped = false;
$("aisles").addEventListener("pointerdown", () => { swipeStart = $("aisles").scrollLeft; swiped = false; });
$("aisles").addEventListener("scroll", () => { if (Math.abs($("aisles").scrollLeft - swipeStart) > 6) swiped = true; });
$("item").addEventListener("input", () => {
  if ($("item").value.trim() === "") manual = false;
  if (!manual) setAisle(guessAisle($("item").value) || "אחר");
});

/* ---------- render ---------- */
function render() {
  const open = items.filter(i => !i.done), bought = items.filter(i => i.done);
  $("count").textContent = "";
  if (items.length) { const b = document.createElement("b"); b.textContent = open.length; $("count").append(b, " פריטים חסרים"); }
  const list = $("list"); list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = '<div class="empty"><strong>הרשימה ריקה</strong>כתבו למעלה מה חסר ולחצו "הוספה". המחלקה נבחרת לבד, וכל מי שיש לו את הקישור יראה את זה מיד.</div>';
    return;
  }
  AISLES.forEach(a => {
    const g = open.filter(i => (i.aisle || "אחר") === a); if (!g.length) return;
    const sec = document.createElement("section"); const h = document.createElement("h2");
    h.append(icon(a, "sm"), a + " · " + g.length); sec.append(h, makeList(g)); list.append(sec);
  });
  if (!open.length) { const e = document.createElement("div"); e.className = "empty"; e.innerHTML = "<strong>הכל נקנה</strong>אין כרגע מה לקנות."; list.append(e); }
  if (bought.length) {
    const head = document.createElement("div"); head.className = "bought-head";
    const h = document.createElement("h2"); h.textContent = "נקנו (" + bought.length + ")"; head.append(h);
    if (!confirming) {
      const c = document.createElement("button"); c.className = "clear"; c.textContent = "ניקוי מה שנקנה";
      c.onclick = () => { confirming = true; render(); }; head.append(c);
    } else {
      const w = document.createElement("div"); w.className = "confirm"; w.append("למחוק " + bought.length + " פריטים?");
      const y = document.createElement("button"); y.className = "yes"; y.textContent = "מחיקה"; y.onclick = clearBought;
      const n = document.createElement("button"); n.textContent = "ביטול"; n.onclick = () => { confirming = false; render(); };
      w.append(y, n); head.append(w);
    }
    list.append(head, makeList(bought));
  }
}

function makeList(arr) {
  const ul = document.createElement("ul");
  arr.forEach(i => {
    const li = document.createElement("li"); if (i.done) li.className = "done";
    const c = document.createElement("button"); c.className = "check"; c.textContent = "✓";
    c.setAttribute("aria-label", i.done ? "החזרה לרשימה" : "סימון כנקנה"); c.onclick = () => toggle(i);
    const t = document.createElement("div"); t.className = "txt";
    const n = document.createElement("div"); n.className = "name"; n.textContent = i.name;
    if (i.qty) { const q = document.createElement("span"); q.className = "qtyb"; q.textContent = " × " + i.qty; n.append(q); }
    t.append(n);
    const w = document.createElement("div"); w.className = "who";
    if (i.by) w.append(i.by === myName && i.uid === uid ? "הוספת את/ה" : i.by);
    if (!i.done) {
      const s = document.createElement("select"); s.className = "move"; s.id = "move-" + i.id;
      s.setAttribute("aria-label", "שינוי מחלקה של " + i.name);
      AISLES.forEach(a => { const o = document.createElement("option"); o.value = a; o.textContent = a; if (a === (i.aisle || "אחר")) o.selected = true; s.append(o); });
      s.onchange = () => run(store.updateItem(listId, i.id, { aisle: s.value }));
      if (i.by) w.append(" · "); w.append(s);
    }
    if (w.childNodes.length) t.append(w);
    const d = document.createElement("button"); d.className = "del"; d.textContent = "×";
    d.setAttribute("aria-label", "מחיקת " + i.name); d.onclick = () => run(store.removeItem(listId, i.id));
    li.append(c, icon(i.aisle || "אחר"), t, d);
    ul.append(li);
  });
  return ul;
}

/* ---------- actions (writes apply locally at once and sync in the background) ---------- */
function run(p) {
  Promise.resolve(p).catch(e => {
    console.error(e);
    status(e && e.code === "permission-denied" ? "אין הרשאה לשמור. בדקו שהקישור נכון." : "השמירה לא הצליחה. בדקו את החיבור ונסו שוב.", true);
  });
}
const toggle = i => run(store.updateItem(listId, i.id, { done: !i.done, doneAt: Date.now() }));
function clearBought() { confirming = false; run(store.removeMany(listId, items.filter(i => i.done).map(i => i.id))); }

$("form").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("item").value.trim(); if (!name || !ready) return;
  const qty = $("qty").value.trim();
  const chosen = manual ? aisle : (guessAisle(name) || "אחר");
  $("item").value = ""; $("qty").value = ""; $("item").focus(); manual = false; setAisle("אחר");
  run(store.addItem(listId, { name, qty, aisle: chosen, done: false, by: myName, uid, createdAt: Date.now() }));
});

/* ---------- WhatsApp ---------- */
function openWhatsApp(text) { window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener"); }
$("invite").onclick = () => openWhatsApp("הצטרפו לרשימת הקניות של המשפחה 🛒\nפותחים את הקישור, ואפשר להוסיף ולסמן פריטים:\n" + listUrl());
$("sendList").onclick = () => {
  const open = items.filter(i => !i.done);
  if (!open.length) { toast("אין כרגע פריטים חסרים"); return; }
  let text = "🛒 רשימת קניות\n";
  AISLES.forEach(a => {
    const g = open.filter(i => (i.aisle || "אחר") === a); if (!g.length) return;
    text += "\n*" + a + "*\n" + g.map(i => "• " + i.name + (i.qty ? " × " + i.qty : "")).join("\n") + "\n";
  });
  text += "\nלרשימה המעודכנת: " + listUrl();
  openWhatsApp(text);
};
$("rename").onclick = () => { $("nameInput").value = myName; show("nameBox"); $("nameInput").focus(); };

/* ---------- start ---------- */
$("joinForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = idFromText($("joinLink").value);
  if (!id) { toast("הקישור לא נראה תקין. העתיקו אותו שוב מהוואטסאפ."); return; }
  location.hash = id; location.reload();
});
$("createList").onclick = () => { const id = newListId(); LS.set("listId", id); location.hash = id; location.reload(); };
$("nameForm").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("nameInput").value.trim(); if (!v) return;
  myName = v; LS.set("myName", v); $("rename").textContent = "מופיעים כ: " + v + " (שינוי)";
  show("app"); render(); $("item").focus();
});
window.addEventListener("hashchange", () => { if (idFromText(location.hash) !== listId) location.reload(); });

async function start() {
  if (!store.isConfigured()) { show("app"); status("האפליקציה עוד לא מחוברת ל-Firebase. צריך להדביק את פרטי הפרויקט בקובץ firebase-config.js.", true); return; }
  listId = chooseList();
  if (!listId) { show("welcome"); return; }
  myName = LS.get("myName") || "";
  $("rename").textContent = myName ? "מופיעים כ: " + myName + " (שינוי)" : "";
  show(myName ? "app" : "nameBox");
  status("טוען את הרשימה…");
  try { ({ uid } = await store.init()); }
  catch (e) {
    console.error(e);
    status(e && e.code === "auth/operation-not-allowed"
      ? "צריך להפעיל כניסה אנונימית ב-Firebase (Authentication ← Sign-in method ← Anonymous)."
      : "אין חיבור לשרת. בדקו את האינטרנט ורעננו את הדף.", true);
    return;
  }
  ready = true;
  store.subscribe(listId, (list, meta) => {
    items = list;
    status(meta.fromCache && !navigator.onLine ? "אין חיבור כרגע. אפשר להמשיך לעבוד, והשינויים יישלחו כשהרשת תחזור." : "");
    render();
  }, err => {
    console.error(err);
    status(err && err.code === "permission-denied" ? "אין גישה לרשימה הזו. בקשו קישור חדש מבן משפחה." : "החיבור לרשימה נותק. רעננו את הדף.", true);
  });
}
start();

if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
