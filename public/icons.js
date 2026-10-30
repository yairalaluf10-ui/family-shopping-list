// One line-drawn icon per aisle, tinted with that aisle's color token.
const ICON={
 "ירקות ופירות":['--c-veg','<path d="M15.6 8.4c-1.5-1.5-4-1.5-5.5 0L3.6 19.2c-.4.6.3 1.3.9.9l10.8-6.5c1.5-1.5 1.5-4 .3-5.2Z"/><path d="M16 8l1.6-4.2M16 8l4.4-1.4M16 8l3.6 2.4"/><path d="M8.6 12.6l1.6 1.6M6.4 15.8l1.2 1.2"/>'],
 "מוצרי חלב":['--c-dairy','<path d="M8 2.5h8v3l2.5 3.5v12.5h-13V9L8 5.5Z"/><path d="M8 5.5h8M5.5 9h13"/><path d="M9.5 14h5"/>'],
 "לחם ומאפים":['--c-bread','<path d="M5 11.5a3.8 3.8 0 0 1 1.5-7.3h11a3.8 3.8 0 0 1 1.5 7.3V20H5Z"/><path d="M9.5 8 8 11M13.5 8 12 11M17 8.5 16 10.5"/>'],
 "בשר ודגים":['--c-meat','<path d="M2.5 12c3-4.8 9-6.6 13.8-2.8L21 6.5v11l-4.7-2.7C11.5 18.6 5.5 16.8 2.5 12Z"/><circle cx="7.3" cy="11.2" r=".9" fill="currentColor" stroke="none"/>'],
 "מזווה":['--c-pantry','<rect x="7" y="2.8" width="10" height="3.2" rx="1"/><path d="M6.2 6h11.6v13a2.2 2.2 0 0 1-2.2 2.2H8.4A2.2 2.2 0 0 1 6.2 19Z"/><path d="M6.2 11h11.6M6.2 16h11.6"/>'],
 "חטיפים ומתוקים":['--c-snack','<circle cx="12" cy="12" r="4.2"/><path d="M8.2 10.4 3 7.8v8.4l5.2-2.6M15.8 10.4 21 7.8v8.4l-5.2-2.6"/><path d="M10.6 10.2l2.8 3.6"/>'],
 "קפואים":['--c-frozen','<path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8"/><path d="M9.3 4.2 12 6l2.7-1.8M9.3 19.8 12 18l2.7 1.8"/>'],
 "שתייה":['--c-drink','<path d="M10 2.5h4v3l2.2 3.2V19.3a2.2 2.2 0 0 1-2.2 2.2h-4a2.2 2.2 0 0 1-2.2-2.2V8.7L10 5.5Z"/><path d="M7.8 12h8.4M7.8 16.5h8.4"/>'],
 "ניקיון וטואלטיקה":['--c-clean','<path d="M7.5 10h6l1.5 3v7.3a1.2 1.2 0 0 1-1.2 1.2H8.7a1.2 1.2 0 0 1-1.2-1.2Z"/><path d="M9 10V5.5h5l2.5 2H13.5V10"/><path d="M19 4.5h.01M20.5 7.5h.01M19 10.5h.01" stroke-width="2.4"/>'],
 "תינוקות":['--c-baby','<path d="M10 2.5h4v2.4h-4Z"/><path d="M9 4.9h6l1.3 3.1H7.7Z"/><path d="M7.7 8h8.6v11.3a2.2 2.2 0 0 1-2.2 2.2h-4.2a2.2 2.2 0 0 1-2.2-2.2Z"/><path d="M7.7 12.5H11M7.7 16H11"/>'],
 "אחר":['--c-other','<path d="M5 8h14l-1.2 13H6.2Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>']
};
function icon(a,size){const [tok,paths]=ICON[a]||ICON["אחר"];const s=document.createElement("span");s.className="ic";s.style.setProperty("--c","var("+tok+")");
  if(size)s.classList.add(size);s.setAttribute("aria-hidden","true");
  s.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';return s}
export { ICON, icon };
