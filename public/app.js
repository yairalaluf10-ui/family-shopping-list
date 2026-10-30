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

/* ---------- export (WhatsApp text or JPG image) ---------- */
const openGroups = () => {
  const open = items.filter(i => !i.done);
  return AISLES.map(a => [a, open.filter(i => (i.aisle || "אחר") === a)]).filter(([, g]) => g.length);
};
const itemLabel = i => i.name + (i.qty ? " × " + i.qty : "");

function sendListWhatsApp() {
  let text = "🛒 רשימת קניות\n";
  openGroups().forEach(([a, g]) => { text += "\n*" + a + "*\n" + g.map(i => "• " + itemLabel(i)).join("\n") + "\n"; });
  text += "\nלרשימה המעודכנת: " + listUrl();
  openWhatsApp(text);
}

// Always drawn light, whatever the app theme, so the picture reads the same wherever it is shared.
async function listImageBlob() {
  const FONT = '"Assistant", sans-serif', TITLE = '"Secular One", "Assistant", sans-serif';
  try { await Promise.all([document.fonts.load('700 36px Assistant'), document.fonts.load('36px "Secular One"')]); } catch {}
  const groups = openGroups(), W = 1080, PAD = 64, BULLET = 40, LINE = 54;
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
  function wrap(text, maxW) {
    const lines = []; let cur = "";
    text.split(" ").forEach(w => {
      const next = cur ? cur + " " + w : w;
      if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = w; } else cur = next;
    });
    return cur ? lines.concat(cur) : lines;
  }
  function paint(draw) {
    let y = PAD;
    ctx.direction = "rtl"; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    const right = W - PAD, count = groups.reduce((n, [, g]) => n + g.length, 0);
    ctx.font = "64px " + TITLE; ctx.fillStyle = "#2f7a4b"; y += 56;
    if (draw) ctx.fillText("🛒 רשימת קניות", right, y);
    ctx.font = "30px " + FONT; ctx.fillStyle = "#66736b"; y += 48;
    if (draw) ctx.fillText(new Date().toLocaleDateString("he-IL") + " · " + count + " פריטים", right, y);
    groups.forEach(([a, g]) => {
      y += 70; ctx.font = "700 42px " + FONT; ctx.fillStyle = "#2f7a4b";
      if (draw) { ctx.fillText(a, right, y); ctx.fillStyle = "#dde3dc"; ctx.fillRect(PAD, y + 14, W - 2 * PAD, 2); }
      y += 14;
      g.forEach(i => {
        ctx.font = "600 38px " + FONT;
        const lines = wrap(itemLabel(i), W - 2 * PAD - BULLET);
        y += LINE;
        if (draw) { ctx.fillStyle = "#2f7a4b"; ctx.beginPath(); ctx.arc(right - 8, y - 13, 6, 0, 7); ctx.fill(); ctx.fillStyle = "#1c2620"; }
        lines.forEach((l, n) => { if (n) y += LINE - 8; if (draw) ctx.fillText(l, right - BULLET, y); });
      });
    });
    return y + PAD;
  }
  canvas.width = W; canvas.height = paint(false);   // resizing resets the context, so paint again
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, canvas.height);
  paint(true);
  return new Promise(res => canvas.toBlob(res, "image/jpeg", 0.92));
}

async function exportJpg() {
  const blob = await listImageBlob();
  if (!blob) { toast("יצירת התמונה לא הצליחה"); return; }
  const file = new File([blob], "shopping-list.jpg", { type: "image/jpeg" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "רשימת קניות" }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("התמונה נשמרה");
}

$("exportList").onclick = () => {
  if (!openGroups().length) { toast("אין כרגע פריטים חסרים"); return; }
  $("exportDlg").showModal();
};
$("exportWa").onclick = () => { $("exportDlg").close(); sendListWhatsApp(); };
$("exportJpg").onclick = () => { $("exportDlg").close(); exportJpg().catch(e => { console.error(e); toast("יצירת התמונה לא הצליחה"); }); };
$("exportCancel").onclick = () => $("exportDlg").close();
$("exportDlg").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
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
