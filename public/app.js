import { AISLES, guessAisle } from "./categories.js";
import { ICON, icon } from "./icons.js";
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
  const groups = openGroups(), count = groups.reduce((n, [, g]) => n + g.length, 0);
  const W = 1080, M = 48, PADX = 36, HERO = 240, HEAD = 112, ROW = 78, LH = 48, GAP = 32;
  const css = getComputedStyle(document.documentElement);
  const color = a => css.getPropertyValue((ICON[a] || ICON["אחר"])[0]).trim() || "#6f7a73";

  // The same line icons as the app, tinted with the aisle color.
  const pics = {};
  await Promise.all(groups.map(async ([a]) => {
    const c = color(a), img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      (ICON[a] || ICON["אחר"])[1].replaceAll("currentColor", c) + "</svg>");
    try { await img.decode(); pics[a] = img; } catch {}
  }));

  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
  function wrap(text, maxW) {
    const lines = []; let cur = "";
    text.split(" ").forEach(w => {
      const next = cur ? cur + " " + w : w;
      if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = w; } else cur = next;
    });
    return cur ? lines.concat(cur) : lines;
  }
  function round(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const itemLines = (i, maxW) => { ctx.font = "600 38px " + FONT; return wrap(i.name, maxW); };
  const qtyWidth = i => { ctx.font = "700 30px " + FONT; return i.qty ? ctx.measureText(i.qty).width + 40 : 0; };

  function paint(draw) {
    ctx.direction = "rtl"; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    if (draw) {
      ctx.fillStyle = "#f3f5f1"; ctx.fillRect(0, 0, W, canvas.height);
      const g = ctx.createLinearGradient(0, 0, W, HERO); g.addColorStop(0, "#3a8d58"); g.addColorStop(1, "#1f5c37");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, HERO);
      ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.beginPath(); ctx.arc(120, 40, 190, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(300, 250, 110, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "76px " + TITLE; ctx.fillText("🛒 רשימת קניות", W - M, 118);
      const sub = new Date().toLocaleDateString("he-IL") + " · " + count + " פריטים";
      ctx.font = "700 32px " + FONT; const sw = ctx.measureText(sub).width + 48;
      ctx.fillStyle = "rgba(255,255,255,.2)"; round(W - M - sw, 148, sw, 56, 28); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(sub, W - M - 24, 188);
    }
    let y = HERO + GAP + 8;
    const left = M, right = W - M;
    groups.forEach(([a, g]) => {
      const c = color(a), innerR = right - PADX, innerL = left + PADX, textR = innerR - 52;
      const rows = g.map(i => { const q = qtyWidth(i), lines = itemLines(i, textR - innerL - (q ? q + 24 : 0)); return { i, q, lines, h: ROW + (lines.length - 1) * LH }; });
      const h = HEAD + rows.reduce((n, r) => n + r.h, 0) + 20;
      if (draw) {
        ctx.save(); ctx.shadowColor = "rgba(28,38,32,.12)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8;
        ctx.fillStyle = "#fff"; round(left, y, right - left, h, 32); ctx.fill(); ctx.restore();
        ctx.save(); round(left, y, right - left, h, 32); ctx.clip(); ctx.fillStyle = c + "1f"; ctx.fillRect(left, y, right - left, HEAD); ctx.restore();
        ctx.fillStyle = c + "2e"; round(innerR - 72, y + 20, 72, 72, 20); ctx.fill();
        if (pics[a]) ctx.drawImage(pics[a], innerR - 72 + 14, y + 20 + 14, 44, 44);
        ctx.fillStyle = c; ctx.font = "700 46px " + FONT; ctx.fillText(a, innerR - 72 - 22, y + 72);
        const n = String(g.length); ctx.font = "700 32px " + FONT; const bw = Math.max(52, ctx.measureText(n).width + 32);
        ctx.fillStyle = c; round(innerL, y + 28, bw, 56, 28); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText(n, innerL + bw / 2, y + 68); ctx.textAlign = "right";
      }
      let ry = y + HEAD;
      rows.forEach((r, k) => {
        if (draw) {
          const base = ry + 52;
          ctx.strokeStyle = c; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(innerR - 16, base - 13, 14, 0, 7); ctx.stroke();
          ctx.fillStyle = "#1c2620"; ctx.font = "600 38px " + FONT;
          r.lines.forEach((l, n) => ctx.fillText(l, textR, base + n * LH));
          if (r.q) {
            ctx.fillStyle = c + "22"; round(innerL, base - 35, r.q, 50, 25); ctx.fill();
            ctx.fillStyle = c; ctx.font = "700 30px " + FONT; ctx.textAlign = "center"; ctx.fillText(r.i.qty, innerL + r.q / 2, base); ctx.textAlign = "right";
          }
          if (k < rows.length - 1) { ctx.fillStyle = "#eef1ed"; ctx.fillRect(innerL, ry + r.h - 1, innerR - innerL, 2); }
        }
        ry += r.h;
      });
      y += h + GAP;
    });
    return y + 8;
  }
  canvas.width = W; canvas.height = paint(false);   // resizing resets the context, so paint again
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
