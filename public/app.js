(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ksh = n => "Ksh " + Number(n || 0).toLocaleString("en-KE");
const app = $("#app");
const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); } catch {} }
};
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const todayIso = () => iso(new Date());
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const dayName = s => s === todayIso() ? "Today" : s === addDays(todayIso(), 1) ? "Tomorrow" : new Date(s + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" });
const longDate = s => new Date(s + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
const mins = t => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(t || "").trim()); if (!m) return 0; let h = Number(m[1]) % 12; if ((m[3] || "").toUpperCase() === "PM") h += 12; return h * 60 + Number(m[2]); };
const ico = {
  pin: c => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
  cal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e3221c" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`
};

const PHOTO = { Mombasa: "mombasa", Nairobi: "nairobi", Kampala: "kampala", Busia: "busia", Malindi: "malindi", Malaba: "malaba" };
const photo = r => "/" + (PHOTO[r.destination] || "hero") + ".jpg";
const logoImg = h => `<img src="/logo.png" alt="Mash Poa" style="height:${h}px;width:auto;display:block">`;
let cfg = null;
async function routes() {
  if (!cfg) {
    let cached = null; try { cached = JSON.parse(localStorage.getItem("mp_cfg")); } catch {}
    const load = async () => { const r = await fetch("/api/booking-config?light=1"); const d = await r.json(); try { localStorage.setItem("mp_cfg", JSON.stringify(d)); } catch {} return d; };
    if (cached && cached.routes) { cfg = cached; load().then(d => { cfg = d; }).catch(() => {}); } else { cfg = await load(); }
  }
  return (cfg.routes || []).filter(r => r.active !== false);
}

/* ---------- router ---------- */
function go(url, replace) { history[replace ? "replaceState" : "pushState"]({}, "", url); render(); window.scrollTo(0, 0); }
document.addEventListener("click", e => { const a = e.target.closest("a[data-link]"); if (a) { e.preventDefault(); $("#menu").hidden = true; go(a.getAttribute("href")); } });
window.addEventListener("popstate", render);
$("#menu-btn").onclick = () => { const m = $("#menu"); m.hidden = !m.hidden; };
document.addEventListener("click", e => { if (!e.target.closest("#menu,#menu-btn")) $("#menu").hidden = true; });
$("#year").textContent = new Date().getFullYear();
function render() {
  closeSheet();
  const p = location.pathname;
  if (p.startsWith("/booking/")) return viewResults();
  if (p === "/checkout") return viewCheckout();
  return viewHome();
}

/* ---------- home ---------- */
function featured(rs) {
  const wanted = [["Nairobi", "Mombasa"], ["Mombasa", "Nairobi"], ["Nairobi", "Kampala"], ["Mombasa", "Busia"], ["Nairobi", "Malindi"], ["Mombasa", "Malaba"], ["Nairobi", "Busia"], ["Nairobi", "Malaba"]];
  const out = [];
  wanted.forEach(([a, b]) => { const r = rs.find(x => x.origin === a && x.destination === b); if (r) out.push(r); });
  rs.forEach(r => { if (out.length < 6 && !out.includes(r)) out.push(r); });
  return out.slice(0, 6);
}
async function viewHome() {
  document.title = "Mash Poa – Official Online Bus Booking Website";
  const rs = await routes();
  const saved = store.get("mp_search") || {};
  const origins = [...new Set(rs.map(r => r.origin))].sort();
  const opt = (list, v) => list.map(x => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
  const feats = featured(rs);
  app.innerHTML = `
  <section class="hero" style="--hero:url(/hero.jpg)"><div class="wrap">
    <p class="hero-kicker">Official Mash Poa booking website</p>
    <h1>Mash Poa – Official Online Bus Booking Website</h1>
    <p>Search routes, choose your seat and pay securely online.</p>
  </div></section>
  <div class="wrap"><form class="search" id="search">
    <div class="tabs"><button type="button" class="tab on" data-trip="one">One way</button><button type="button" class="tab" data-trip="round">Round trip</button></div>
    <div class="fld"><label>From</label><div class="ctl">${ico.pin("#e3221c")}<input id="from" type="text" placeholder="Leaving from" autocomplete="off" autocapitalize="words" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="from-list"></div><ul class="sugg" id="from-list" role="listbox" hidden></ul></div>
    <div class="swap-row"><button type="button" class="swap" id="swap" aria-label="Swap">⇄</button></div>
    <div class="fld"><label>To</label><div class="ctl">${ico.pin("#e3221c")}<input id="to" type="text" placeholder="Going to" autocomplete="off" autocapitalize="words" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="to-list"></div><ul class="sugg" id="to-list" role="listbox" hidden></ul></div>
    <div class="fld"><label>Departure</label><div class="ctl">${ico.cal}<input id="date" type="date" required></div></div>
    <div class="fld" id="retfld" hidden><label>Return</label><div class="ctl">${ico.cal}<input id="retdate" type="date"></div></div>
    <button class="btn block" type="submit">Search buses</button>
    <div class="feedback" id="feedback" role="status"></div>
    <div class="pay-via">You can pay via <span class="mpesa">M-PESA</span></div>
  </form></div>
  <section class="section"><div class="wrap">
    <h2>Top routes</h2><p class="sub">Explore popular routes served by Mash Poa</p>
    <div class="route-grid">${feats.map((r, i) => `<a class="route-card" data-link href="/booking/${todayIso()}?from=${encodeURIComponent(r.origin)}&to=${encodeURIComponent(r.destination)}"><div class="route-img"><img src="${photo(r)}" alt="${esc(r.destination)}" width="640" height="420" ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"><span class="badge">${esc(r.destination)}</span></div><div class="route-body"><h3>${esc(r.origin)} → ${esc(r.destination)}</h3><span>Search buses <b>→</b></span></div></a>`).join("")}</div>
  </div></section>
  <section class="section"><div class="wrap"><div class="features">
    <div class="feature"><i style="background:#fde4e4">🚌</i><h3>Top-tier service</h3><p>A travel experience shaped around comfort, punctuality and service on every trip.</p></div>
    <div class="feature"><i style="background:#fef3c7">🎟️</i><h3>Easy online booking</h3><p>Pick your seat, pay with M-PESA and get your ticket in live chat.</p></div>
    <div class="feature"><i style="background:#d9f7e6">🛡️</i><h3>Safety first</h3><p>Well-maintained fleets and careful operating standards throughout your journey.</p></div>
  </div></div></section>`;
  const dateEl = $("#date"); dateEl.min = todayIso(); dateEl.value = saved.date && saved.date >= todayIso() ? saved.date : todayIso();
  const fromEl = $("#from"), toEl = $("#to");
  const destsFor = from => [...new Set(rs.filter(r => !from || r.origin === from).map(r => r.destination))].sort();
  const exact = (list, v) => list.find(x => x.toLowerCase() === String(v || "").trim().toLowerCase()) || "";
  // Type-ahead: nothing is listed until at least 3 letters are typed.
  const combo = (input, listEl, getList, onPick) => {
    const hide = () => { listEl.hidden = true; input.setAttribute("aria-expanded", "false"); };
    const pick = v => { input.value = v; hide(); onPick && onPick(v); };
    const show = () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 3) { listEl.innerHTML = `<li class="hint-li">Type at least 3 letters to search</li>`; listEl.hidden = !document.activeElement || document.activeElement !== input; return; }
      const all = getList();
      const hits = all.filter(x => x.toLowerCase().includes(q)).sort((a, b) => (b.toLowerCase().startsWith(q) - a.toLowerCase().startsWith(q)) || a.localeCompare(b)).slice(0, 8);
      listEl.innerHTML = hits.length ? hits.map(h => `<li role="option" data-v="${esc(h)}">${esc(h)}</li>`).join("") : `<li class="hint-li">No matching place. Check the spelling.</li>`;
      listEl.hidden = false; input.setAttribute("aria-expanded", "true");
    };
    input.addEventListener("input", show);
    input.addEventListener("focus", show);
    input.addEventListener("blur", () => setTimeout(() => { hide(); const m = exact(getList(), input.value); if (m) input.value = m; }, 150));
    input.addEventListener("keydown", e => { if (e.key === "Enter" && !listEl.hidden) { const f = listEl.querySelector("[data-v]"); if (f) { e.preventDefault(); pick(f.dataset.v); } } });
    listEl.addEventListener("pointerdown", e => { const li = e.target.closest("[data-v]"); if (li) { e.preventDefault(); pick(li.dataset.v); } });
  };
  combo(fromEl, $("#from-list"), () => origins, v => { if (!exact(destsFor(v), toEl.value)) toEl.value = ""; });
  combo(toEl, $("#to-list"), () => destsFor(exact(origins, fromEl.value)));
  fromEl.value = saved.from || ""; toEl.value = saved.to || "";
  $("#swap").onclick = () => {
    const a = exact(origins, fromEl.value), b = exact(destsFor(a), toEl.value) || exact(origins, toEl.value);
    if (!b) return;
    fromEl.value = b; toEl.value = destsFor(b).includes(a) ? a : "";
  };
  let round = !!saved.round;
  const retEl = $("#retdate");
  const syncRound = () => {
    $$(".tab").forEach(x => x.classList.toggle("on", (x.dataset.trip === "round") === round));
    $("#retfld").hidden = !round; retEl.required = round; $("#feedback").textContent = "";
    retEl.min = dateEl.value; if (!retEl.value || retEl.value < dateEl.value) retEl.value = saved.ret && saved.ret >= dateEl.value ? saved.ret : addDays(dateEl.value, 1);
  };
  $$(".tab").forEach(t => t.onclick = () => { round = t.dataset.trip === "round"; syncRound(); });
  dateEl.onchange = () => { if (round) { retEl.min = dateEl.value; if (retEl.value < dateEl.value) retEl.value = dateEl.value; } };
  syncRound();
  $("#search").onsubmit = e => {
    e.preventDefault();
    const from = exact(origins, fromEl.value), to = exact(destsFor(from), toEl.value), date = dateEl.value;
    if (!from || !to) { $("#feedback").textContent = !from ? "Type at least 3 letters and pick where you are leaving from." : "Pick a destination from the list. Only places Mash Poa travels to from " + from + " are shown."; return; }
    const ret = retEl.value;
    if (round) {
      if (!ret || ret < date) { $("#feedback").textContent = "Choose a return date on or after your departure date."; return; }
      if (!rs.some(r => r.origin === to && r.destination === from)) { $("#feedback").textContent = `There is no return bus from ${to} to ${from}. Try a one way trip or another route.`; return; }
    }
    fetch("/api/schedules?" + new URLSearchParams({ from, to, date })).then(r => r.json()).then(t => { try { sessionStorage.setItem("mp_s:" + from + "|" + to + "|" + date, JSON.stringify(t)); } catch {} }).catch(() => {});
    store.set("mp_search", { from, to, date, round, ret });
    store.del("mp_out");
    go(`/booking/${date}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${round ? "&return=" + ret : ""}`);
  };
  renderFooter(rs);
}
function renderFooter(rs) {
  $("#footer-routes").innerHTML = featured(rs).map(r => `<a data-link href="/booking/${todayIso()}?from=${encodeURIComponent(r.origin)}&to=${encodeURIComponent(r.destination)}">${esc(r.origin)} → ${esc(r.destination)}</a>`).join("");
}

/* ---------- results ---------- */
async function viewResults() {
  const date = location.pathname.split("/")[2] || todayIso();
  const q = new URLSearchParams(location.search), from = q.get("from") || "", to = q.get("to") || "";
  if (!from || !to) { go("/", true); return; }
  document.title = `${from} to ${to} bus tickets – Mash Poa`;
  const isRet = q.get("leg") === "return", retDate = q.get("return") || "";
  const out0 = store.get("mp_out");
  if (isRet && !out0) { go("/", true); return; }
  const minDate = isRet ? out0.trip.date : todayIso();
  const url = d => `/booking/${d}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${isRet ? "&leg=return" : ""}${retDate ? "&return=" + retDate : ""}`;
  const days = [0, 1, 2, 3].map(i => addDays(date, i));
  app.innerHTML = `
  <section class="results-head"><div class="wrap"><div><h1>${esc(from)}<em>→</em>${esc(to)}</h1><small>${isRet ? "Return bus · " : retDate ? "Outbound bus · " : ""}${esc(longDate(date))} ${esc(date.slice(0, 4))}</small></div><button class="edit-search" id="edit">Edit search</button></div></section>
  <div class="wrap">
    <div class="datestrip"><button class="arrow" id="prev" ${date <= minDate ? "disabled" : ""}>‹</button>${days.map((d, i) => `<button class="${i === 0 ? "on" : ""}" data-d="${d}">${esc(dayName(d))}<b>${Number(d.slice(8))}</b>${new Date(d + "T12:00:00").toLocaleDateString("en-GB", { month: "short" })}</button>`).join("")}<button class="arrow" id="next">›</button></div>
    <div class="count-row"><span id="count">Searching…</span></div>
    <div class="bus-list" id="buses"></div>
  </div>`;
  $("#edit").onclick = () => go("/");
  if (isRet) $("#edit").textContent = "Change outbound";
  $("#prev").onclick = () => go(url(addDays(date, -1)));
  $("#next").onclick = () => go(url(addDays(date, 1)));
  $$("[data-d]").forEach(b => b.onclick = () => go(url(b.dataset.d)));
  const list = $("#buses");
  const note = store.get("mp_note"); store.del("mp_note");
  const noteHtml = note ? `<div class="note">${esc(note)}</div>` : "";
  const ck = "mp_s:" + from + "|" + to + "|" + date;
  const paintTrips = all => {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const trips = all.filter(t => date !== todayIso() || mins(t.time) > nowMin).sort((a, b) => mins(a.time) - mins(b.time));
    if (!trips.length && date === todayIso() && all.length) {
      store.set("mp_note", "Today's buses have already left. Showing tomorrow's buses.");
      go(url(addDays(date, 1)), true); return;
    }
    $("#count").textContent = `${trips.length} bus${trips.length === 1 ? "" : "es"} available`;
    if (!trips.length) { list.innerHTML = noteHtml + `<div class="empty"><b>No buses for this date</b>Try another day from the date bar, or <a href="/chat.html" style="color:var(--red);font-weight:700">chat with support</a>.</div>`; return; }
    list.innerHTML = noteHtml + trips.map(t => `<article class="bus">
    <div class="l t">${esc(t.time)}<small>${esc(longDate(t.date))} · ${esc(t.route.origin)}</small>${t.availableSeats ? `<span class="seats-left">${t.availableSeats} seat${t.availableSeats === 1 ? "" : "s"} left</span>` : `<span class="seats-left">Sold out</span>`}</div>
    <div class="mid"><b>Route: ${esc(t.route.origin)} – ${esc(t.route.destination)}</b><i></i>${esc(t.duration || "")}</div>
    ${t.arrival ? `<div class="t r" style="text-align:right;display:none">${esc(t.arrival)}</div>` : ""}
    <div class="price"><div>Normal<b>${ksh(t.fare_kes)}</b></div><button class="btn sm" data-id="${esc(t._id)}" ${t.availableSeats ? "" : "disabled"}>Select seats</button></div>
  </article>`).join("");
    $$("[data-id]", list).forEach(b => b.onclick = () => openSeats(trips.find(t => t._id === b.dataset.id), null, isRet ? out0.seats.length : 0));
  };
  // show something instantly: last result if we have one, otherwise placeholders
  let cached = null; try { cached = JSON.parse(sessionStorage.getItem(ck)); } catch {}
  if (cached) paintTrips(cached);
  else { $("#count").textContent = "Searching…"; list.innerHTML = noteHtml + '<div class="skel"><i></i><i></i><i></i></div>'.repeat(3); }
  try {
    const r = await fetch("/api/schedules?" + new URLSearchParams({ from, to, date }));
    const fresh = await r.json(); if (!r.ok) throw Error(fresh.error || "Could not load buses.");
    try { sessionStorage.setItem(ck, JSON.stringify(fresh)); } catch {}
    paintTrips(fresh);
  } catch (e) { if (!cached) { $("#count").textContent = ""; list.innerHTML = `<div class="empty"><b>We could not load buses</b>${esc(e.message)}</div>`; } }
}

/* ---------- bottom sheets: seats, boarding & drop-off ---------- */
let sheet = null;
function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } }
function openSheet(html) {
  closeSheet();
  sheet = document.createElement("div"); sheet.className = "sheet-back";
  sheet.innerHTML = `<div class="sheet">${html}</div>`;
  sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });
  document.body.appendChild(sheet);
  return sheet.firstElementChild;
}
function openSeats(trip, keep, need) {
  need = need || 0;
  const sel = new Set(keep || []);
  const cap = trip.capacity, rows = Math.ceil(cap / 4);
  const logo = logoImg(26);
  const el = openSheet(`
    <div class="sheet-head">${logo}<div><h3>${esc(trip.route.origin)} → ${esc(trip.route.destination)}</h3><small>${esc(longDate(trip.date))} · ${esc(trip.time)}${trip.arrival ? " → " + esc(trip.arrival) : ""}</small><small class="ok">${trip.availableSeats} seats remaining</small></div><button class="x" aria-label="Close">×</button></div>
    <div class="sheet-body"><div class="bus-map"><div class="wheel"></div><div id="grid"></div></div>
      <div class="legend"><span><i></i>Available</span><span><i class="m"></i>Your seat</span><span><i class="t"></i>Occupied</span></div>
      <p class="hint" style="text-align:center;margin-top:12px">Fare ${ksh(trip.fare_kes)} per seat · ${need ? `choose exactly ${need} seat${need > 1 ? "s" : ""} to match your outbound trip` : "choose up to 8 seats"}</p></div>
    <div class="sheet-foot"><div><small id="cnt"></small><b id="tot"></b></div><button class="btn" id="go">Continue</button></div>`);
  $(".x", el).onclick = closeSheet;
  const draw = () => {
    let h = "";
    for (let r = 0; r < rows; r++) {
      h += '<div class="srow">';
      for (let k = 0; k < 4; k++) {
        const n = r * 4 + k + 1; if (k === 2) h += '<span class="aisle"></span>';
        if (n > cap) { h += '<span class="seat ghost"></span>'; continue; }
        const s = String(n), taken = trip.takenSeats.includes(s);
        h += `<button type="button" class="seat ${taken ? "taken" : sel.has(s) ? "mine" : ""}" data-s="${s}" ${taken ? "disabled" : ""}>${s}</button>`;
      }
      h += "</div>";
    }
    $("#grid", el).innerHTML = h;
    $("#cnt", el).textContent = `${sel.size} seat(s) selected`;
    $("#tot", el).textContent = ksh(trip.fare_kes * sel.size);
    const go = $("#go", el); go.disabled = need ? sel.size !== need : !sel.size; go.textContent = need && sel.size !== need ? `Select ${need} seat${need > 1 ? "s" : ""} (${sel.size}/${need})` : sel.size ? `Continue with ${sel.size} seat${sel.size > 1 ? "s" : ""}` : "Select seats to continue";
    $$("[data-s]", el).forEach(b => b.onclick = () => { const s = b.dataset.s; if (sel.has(s)) sel.delete(s); else if (sel.size < (need || 8)) sel.add(s); draw(); });
  };
  draw();
  $("#go", el).onclick = () => openPoints(trip, [...sel], need);
}
function openPoints(trip, seats, need) {
  let boarding = "", drop = "";
  const o = trip.route.origin, d = trip.route.destination;
  const el = openSheet(`
    <div class="sheet-head"><button class="x" id="bk" style="margin:0" aria-label="Back">←</button><div><h3>Boarding &amp; drop-off</h3><small>${seats.length} seat${seats.length > 1 ? "s" : ""} · ${esc(seats.join(", "))}</small></div><button class="x" aria-label="Close">×</button></div>
    <div class="sheet-body">
      <div class="pt-title"><b>1</b>Boarding point</div>
      <button class="pt" data-k="b" data-v="${esc(o)}"><span class="dot"></span><div><b>${esc(o.toUpperCase())}</b><small>${esc(o.toUpperCase())}</small></div><span class="tm">${esc(trip.time)}</span></button>
      <div class="pt-title"><b class="r">2</b>Drop-off point</div>
      <button class="pt" data-k="d" data-v="${esc(d)}"><span class="dot"></span><div><b>${esc(d.toUpperCase())}</b><small>${esc(d.toUpperCase())}</small></div>${trip.arrival ? `<span class="tm" style="color:var(--red)">≈ ${esc(trip.arrival)}</span>` : ""}</button>
      <div class="note">Please arrive at your pickup point at least 30 minutes before departure.</div>
    </div>
    <div class="sheet-foot"><div><small>Total (${seats.length} seat${seats.length > 1 ? "s" : ""})</small><b>${ksh(trip.fare_kes * seats.length)}</b></div><button class="btn" id="cont" disabled>Select both points</button></div>`);
  $$(".x", el).forEach(x => { if (x.id !== "bk") x.onclick = closeSheet; });
  $("#bk", el).onclick = () => openSeats(trip, seats, need);
  $$(".pt", el).forEach(b => b.onclick = () => {
    $$(`.pt[data-k="${b.dataset.k}"]`, el).forEach(x => x.classList.toggle("on", x === b));
    if (b.dataset.k === "b") boarding = b.dataset.v; else drop = b.dataset.v;
    const c = $("#cont", el); c.disabled = !(boarding && drop); c.textContent = boarding && drop ? "Continue" : "Select both points";
  });
  $("#cont", el).onclick = () => {
    const leg = { trip: { _id: trip._id, routeId: trip.route._id, origin: o, destination: d, date: trip.date, time: trip.time, arrival: trip.arrival || "", fare: trip.fare_kes }, seats, boarding, drop };
    const q = new URLSearchParams(location.search);
    if (q.get("return") && q.get("leg") !== "return") {
      store.set("mp_out", leg);
      go(`/booking/${q.get("return")}?from=${encodeURIComponent(d)}&to=${encodeURIComponent(o)}&leg=return&return=${q.get("return")}`);
      return;
    }
    const out = q.get("leg") === "return" ? store.get("mp_out") : null;
    store.set("mp_trip", out ? { ...out, ret: leg } : leg);
    store.del("mp_out"); store.del("mp_pax"); store.set("mp_step", "details");
    go("/checkout");
  };
}

/* ---------- checkout ---------- */
const NATIONS = ["Kenyan", "Ugandan", "Tanzanian", "Rwandan", "Burundian", "South Sudanese", "Other"];
const CODES = [["+254", "Kenya"], ["+256", "Uganda"], ["+255", "Tanzania"], ["+250", "Rwanda"]];
function stepsBar(step) {
  const d = step === "pay";
  return `<div class="steps"><div class="s done"><span class="n">✓</span>Seats</div><span class="ln done"></span><div class="s ${d ? "done" : "cur"}"><span class="n">${d ? "✓" : "2"}</span>Passenger details</div><span class="ln ${d ? "done" : ""}"></span><div class="s ${d ? "cur" : ""}"><span class="n">3</span>Payment</div></div>`;
}
function viewCheckout() {
  const T = store.get("mp_trip");
  if (!T) { go("/", true); return; }
  document.title = "Checkout – Mash Poa";
  const pax = store.get("mp_pax") || T.seats.map(s => ({ seat: s, done: false }));
  let open = Math.max(0, pax.findIndex(p => !p.done));
  let step = store.get("mp_step") || "details";
  const R = T.ret || null;
  const total = T.trip.fare * T.seats.length + (R ? R.trip.fare * R.seats.length : 0);
  const legBox = (tag, L, full) => `<div class="sum-trip"><span class="tag">${tag}</span>
      <div class="sum-row"><b>${esc(L.trip.origin)} → ${esc(L.trip.destination)}</b><span>${esc(longDate(L.trip.date))}</span></div>
      <div class="sum-row"><span>${esc(L.trip.time)}${L.trip.arrival ? " → " + esc(L.trip.arrival) : ""}</span></div>
      ${full ? `<div class="sum-row"><span>Boarding</span><b>${esc(L.boarding.toUpperCase())}</b></div><div class="sum-row"><span>Drop-off</span><b>${esc(L.drop.toUpperCase())}</b></div><div class="sum-row"><span>Seats</span><b>${esc(L.seats.join(", "))}</b></div>` : ""}
      <div class="sum-row"><span>Standard seat × ${L.seats.length}</span><b>${ksh(L.trip.fare * L.seats.length)}</b></div></div>`;
  const save = () => store.set("mp_pax", pax);
  const summary = full => `<div class="card"><h3>${full ? "Booking summary" : "Fare summary"}</h3>
    ${legBox(R ? "OUTBOUND" : "TRIP", T, full)}${R ? legBox("RETURN", R, full) : ""}
    <div class="total"><span>Total payable</span><b>${ksh(total)}</b></div>`;
  const paint = () => {
    if (step === "pay") return paintPay();
    app.innerHTML = `<div class="wrap">${`<button class="back" id="bk">← Back to buses</button>`}${stepsBar("details")}
      <div class="cols"><div>
        <div class="card trip-strip"><div><small style="color:var(--red);font-weight:800">${R ? "OUTBOUND" : "TRIP"}</small><b>${esc(T.trip.origin)} → ${esc(T.trip.destination)}</b><small>${esc(longDate(T.trip.date))} · ${esc(T.trip.time)}${T.trip.arrival ? " → " + esc(T.trip.arrival) : ""}</small></div><span class="pill">${T.seats.length} seat${T.seats.length > 1 ? "s" : ""} · ${esc(T.seats.join(", "))}</span></div>
        <h3 style="margin:16px 2px 10px;font-size:14px">Passenger details</h3>
        <div id="paxlist">${pax.map((p, i) => paxHtml(p, i, i === open)).join("")}</div>
        ${R ? `<div class="card trip-strip"><div><small style="color:var(--red);font-weight:800">RETURN</small><b>${esc(R.trip.origin)} → ${esc(R.trip.destination)}</b><small>${esc(longDate(R.trip.date))} · ${esc(R.trip.time)}</small></div><span class="pill">${R.seats.length} seat${R.seats.length > 1 ? "s" : ""} · ${esc(R.seats.join(", "))}</span></div>` : ""}
        <div class="card pts-card"><div><small>Boarding</small><b>${esc(T.boarding.toUpperCase())}</b><small style="margin-top:8px">Drop-off</small><b>${esc(T.drop.toUpperCase())}</b></div><button class="btn ghost sm" id="editpts">Edit</button></div>
      </div><div>${summary(false)}<button class="btn block" id="topay" ${pax.every(p => p.done) ? "" : "disabled"}>Continue to payment</button><div class="secure">256-bit secured booking</div></div></div></div>`;
    $("#bk").onclick = () => history.back();
    $("#editpts").onclick = () => history.back();
    $("#topay").onclick = () => { step = "pay"; store.set("mp_step", "pay"); paint(); window.scrollTo(0, 0); };
    $$(".pax-h").forEach(h => h.onclick = () => { open = Number(h.dataset.i); paint(); });
    $$(".savepax").forEach(b => b.onclick = () => savePax(Number(b.dataset.i)));
  };
  const paxHtml = (p, i, isOpen) => {
    const head = `<div class="pax-h ${p.done ? "ok" : ""}" data-i="${i}"><span class="num">${p.done ? "✓" : i + 1}</span><div><b>Passenger ${i + 1}</b><small>${R ? "Outbound seat " + esc(p.seat) + " · Return seat " + esc(R.seats[i]) : "Seat " + esc(p.seat)} · Standard${p.done ? " · " + esc(p.first + " " + p.last) : ""}</small></div><span class="pill ${p.done ? "ok" : "warn"}">${p.done ? "Complete" : "Action required"}</span></div>`;
    if (!isOpen) return `<div class="pax">${head}</div>`;
    return `<div class="pax open">${head}<div class="pax-f" data-i="${i}">
      <div><label>First name <em>*</em></label><input class="in" name="first" value="${esc(p.first)}" placeholder="First name" autocomplete="given-name"></div>
      <div><label>Last name <em>*</em></label><input class="in" name="last" value="${esc(p.last)}" placeholder="Last name" autocomplete="family-name"></div>
      <div><label>Document type <em>*</em></label><select class="in" name="docType">${["National ID", "Passport", "Alien ID"].map(x => `<option ${p.docType === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div><label>Document number <em>*</em></label><input class="in" name="docNumber" value="${esc(p.docNumber)}" placeholder="Enter document number"></div>
      <div><label>Nationality <em>*</em></label><select class="in" name="nationality"><option value="">Select nationality</option>${NATIONS.map(x => `<option ${p.nationality === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div class="phone-wrap"><label>Passenger phone <em>*</em></label><div class="phone"><select class="in" name="code">${CODES.map(([c, n]) => `<option value="${c}" ${p.code === c ? "selected" : ""}>${c} ${n}</option>`).join("")}</select><input class="in" name="phone" inputmode="tel" value="${esc(p.phone)}" placeholder="712 345 678"></div></div>
      <div class="full"><label>Ticket email <em>*</em></label><input class="in" name="email" type="email" value="${esc(p.email)}" placeholder="you@example.com" autocomplete="email"></div>
      <div class="full"><div class="err" id="err${i}"></div><button class="btn dark sm savepax" data-i="${i}">Save passenger</button></div></div></div>`;
  };
  const savePax = i => {
    const f = $(`.pax-f[data-i="${i}"]`), v = n => (f.querySelector(`[name="${n}"]`).value || "").trim();
    const d = { first: v("first"), last: v("last"), docType: v("docType"), docNumber: v("docNumber"), nationality: v("nationality"), code: v("code"), phone: v("phone").replace(/\D/g, "").replace(/^0+/, ""), email: v("email") };
    const err = m => { $("#err" + i).textContent = m; };
    if (!d.first || !d.last) return err("Enter the passenger's first and last name.");
    if (d.docNumber.length < 5) return err("Enter a valid document number.");
    if (!d.nationality) return err("Select the passenger's nationality.");
    if (d.phone.length < 8 || d.phone.length > 12) return err("Enter a valid phone number, for example 712 345 678.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return err("Enter a valid email for the ticket.");
    Object.assign(pax[i], d, { done: true }); save();
    open = pax.findIndex(p => !p.done); paint();
  };
  const paintPay = () => {
    const p1 = pax[0], phone = (p1.code || "+254") + p1.phone;
    app.innerHTML = `<div class="wrap"><button class="back" id="bk">← Back to passenger details</button>${stepsBar("pay")}
      <div class="cols"><div>
        <h3 style="margin:16px 2px 10px;font-size:14px">Choose how to pay</h3>
        <div class="method"><span class="dot"></span><div><b>M-PESA</b><small>Pay securely with M-PESA</small></div><span class="mpesa">M-PESA</span></div>
        <div class="card"><div class="pay-logo">${logoImg(40)}<span>Secure checkout</span></div><div class="amount-box"><span style="color:var(--muted);font-size:12px">Amount to pay</span><b>${ksh(total)}</b></div>
          <label style="font-size:11px;font-weight:700;color:var(--muted)">Payment phone number</label>
          <input class="in" id="payphone" inputmode="tel" value="${esc(phone)}" style="margin-top:5px">
          <p class="hint">We never ask for your M-PESA PIN on this website. An agent will send official payment details in live chat.</p>
          <label class="chk"><input type="checkbox" id="agree" checked><span>I confirm the passenger details and accept the applicable terms and conditions.</span></label>
          <button class="btn block" id="paybtn">Confirm booking</button><div class="err" id="payerr"></div></div>
      </div><div>${summary(true)}</div>
        <div class="card" style="grid-column:auto"><h3>Passenger details</h3>${pax.map((p, i) => `<div class="sum-row"><b>${esc(p.first + " " + p.last)}</b><span>Seat ${esc(p.seat)}${R ? " / " + esc(R.seats[i]) : ""}</span></div>`).join("")}</div></div></div>`;
    $("#bk").onclick = () => { step = "details"; store.set("mp_step", "details"); paint(); };
    $("#paybtn").onclick = async () => {
      const b = $("#paybtn"), err = $("#payerr"); err.textContent = "";
      if (!$("#agree").checked) { err.textContent = "Please accept the terms and conditions to continue."; return; }
      const digits = $("#payphone").value.replace(/\D/g, ""); if (digits.length < 9) { err.textContent = "Enter a valid phone number."; return; }
      b.disabled = true; b.textContent = "Creating your booking…";
      try {
        const passengers = pax.map(p => ({ name: (p.first + " " + p.last).trim(), phone: (p.code || "+254") + p.phone, docType: p.docType, docNumber: p.docNumber, nationality: p.nationality, email: p.email }));
        const legs = [T].concat(R ? [R] : []), made = [];
        for (const L of legs) {
          const r = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routeId: L.trip.routeId, scheduleId: L.trip._id, seats: L.seats, passengers, boarding: L.boarding, dropoff: L.drop }) });
          const data = await r.json(); if (!r.ok) throw Error((made.length ? "Your outbound seats were reserved, but the return could not be booked: " : "") + (data.error || "Could not create the booking."));
          made.push(data.booking);
        }
        store.set("mp_booking", { name: passengers[0].name, phone: "+" + digits.replace(/^\+/, ""), bookings: made.map(bk => ({ ref: bk.ref, from: bk.from, to: bk.to, date: bk.date, time: bk.time, seats: bk.seats, amount: bk.amount })) });
        store.del("mp_trip"); store.del("mp_pax"); store.del("mp_step");
        location.href = "/chat.html";
      } catch (e) { err.textContent = e.message; b.disabled = false; b.textContent = "Confirm booking"; }
    };
  };
  paint();
}

render();
})();
