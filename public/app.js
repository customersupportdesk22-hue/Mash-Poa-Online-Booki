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

let cfg = null;
async function routes() {
  if (!cfg) { const r = await fetch("/api/booking-config"); cfg = await r.json(); }
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
  const wanted = [["Nairobi", "Mombasa"], ["Mombasa", "Nairobi"], ["Nairobi", "Kampala"], ["Mombasa", "Busia"], ["Nairobi", "Malindi"], ["Mombasa", "Malaba"]];
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
  <section class="hero"><div class="wrap">
    <p class="hero-kicker">Official Mash Poa booking website</p>
    <h1>Mash Poa – Official Online Bus Booking Website</h1>
    <p>Search routes, choose your seat and pay securely online.</p>
  </div></section>
  <div class="wrap"><form class="search" id="search">
    <div class="tabs"><button type="button" class="tab on" data-trip="one">One way</button><button type="button" class="tab" data-trip="round">Round trip</button></div>
    <div class="fld"><label>From</label><div class="ctl">${ico.pin("#e3221c")}<select id="from" required><option value="" disabled ${saved.from ? "" : "selected"}>Leaving from</option>${opt(origins, saved.from)}</select></div></div>
    <div class="swap-row"><button type="button" class="swap" id="swap" aria-label="Swap">⇄</button></div>
    <div class="fld"><label>To</label><div class="ctl">${ico.pin("#e3221c")}<select id="to" required></select></div></div>
    <div class="fld"><label>Departure</label><div class="ctl">${ico.cal}<input id="date" type="date" required></div></div>
    <button class="btn block" type="submit">Search buses</button>
    <div class="feedback" id="feedback" role="status"></div>
    <div class="pay-via">You can pay via <span class="mpesa">M-PESA</span></div>
  </form></div>
  <section class="section"><div class="wrap">
    <h2>Top routes</h2><p class="sub">Explore popular routes served by Mash Poa</p>
    <div class="route-grid">${feats.map((r, i) => `<a class="route-card" data-link href="/booking/${todayIso()}?from=${encodeURIComponent(r.origin)}&to=${encodeURIComponent(r.destination)}"><div class="route-img c${i % 6}"><span class="badge">${esc(r.destination)}</span></div><div class="route-body"><h3>${esc(r.origin)} → ${esc(r.destination)}</h3><span>Search buses <b>→</b></span></div></a>`).join("")}</div>
  </div></section>
  <section class="section"><div class="wrap"><div class="features">
    <div class="feature"><i style="background:#fde4e4">🚌</i><h3>Top-tier service</h3><p>A travel experience shaped around comfort, punctuality and service on every trip.</p></div>
    <div class="feature"><i style="background:#fef3c7">🎟️</i><h3>Easy online booking</h3><p>Pick your seat, pay with M-PESA and get your ticket in live chat.</p></div>
    <div class="feature"><i style="background:#d9f7e6">🛡️</i><h3>Safety first</h3><p>Well-maintained fleets and careful operating standards throughout your journey.</p></div>
  </div></div></section>`;
  const dateEl = $("#date"); dateEl.min = todayIso(); dateEl.value = saved.date && saved.date >= todayIso() ? saved.date : todayIso();
  const fromEl = $("#from"), toEl = $("#to");
  const fillTo = keep => {
    const dests = [...new Set(rs.filter(r => !fromEl.value || r.origin === fromEl.value).map(r => r.destination))].sort();
    toEl.innerHTML = `<option value="" disabled ${keep && dests.includes(keep) ? "" : "selected"}>Going to</option>` + opt(dests, keep);
  };
  fillTo(saved.to); fromEl.onchange = () => fillTo("");
  $("#swap").onclick = () => {
    const a = fromEl.value, b = toEl.value; if (!b) return;
    if (![...fromEl.options].some(o => o.value === b)) return;
    fromEl.value = b; fillTo(a);
  };
  let round = false;
  $$(".tab").forEach(t => t.onclick = () => { $$(".tab").forEach(x => x.classList.toggle("on", x === t)); round = t.dataset.trip === "round"; $("#feedback").textContent = round ? "Round-trip booking is not available yet. Book each direction as a one way trip." : ""; });
  $("#search").onsubmit = e => {
    e.preventDefault();
    const from = fromEl.value, to = toEl.value, date = dateEl.value;
    if (!from || !to) { $("#feedback").textContent = "Choose where you are leaving from and going to."; return; }
    if (round) { $("#feedback").textContent = "Round-trip booking is not available yet. Book each direction as a one way trip."; return; }
    store.set("mp_search", { from, to, date });
    go(`/booking/${date}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
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
  document.title = `${from} to ${to} bus tickets – Mash Poa`;
  const url = d => `/booking/${d}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const days = [0, 1, 2, 3].map(i => addDays(date, i));
  app.innerHTML = `
  <section class="results-head"><div class="wrap"><div><h1>${esc(from)}<em>→</em>${esc(to)}</h1><small>${esc(longDate(date))} ${esc(date.slice(0, 4))}</small></div><button class="edit-search" id="edit">Edit search</button></div></section>
  <div class="wrap">
    <div class="datestrip"><button class="arrow" id="prev" ${date <= todayIso() ? "disabled" : ""}>‹</button>${days.map((d, i) => `<button class="${i === 0 ? "on" : ""}" data-d="${d}">${esc(dayName(d))}<b>${Number(d.slice(8))}</b>${new Date(d + "T12:00:00").toLocaleDateString("en-GB", { month: "short" })}</button>`).join("")}<button class="arrow" id="next">›</button></div>
    <div class="count-row"><span id="count">Searching…</span></div>
    <div class="bus-list" id="buses"></div>
  </div>`;
  $("#edit").onclick = () => go("/");
  $("#prev").onclick = () => go(url(addDays(date, -1)));
  $("#next").onclick = () => go(url(addDays(date, 1)));
  $$("[data-d]").forEach(b => b.onclick = () => go(url(b.dataset.d)));
  const list = $("#buses");
  let trips = [];
  try {
    const r = await fetch("/api/schedules?" + new URLSearchParams({ from, to, date }));
    trips = await r.json(); if (!r.ok) throw Error(trips.error || "Could not load buses.");
  } catch (e) { $("#count").textContent = ""; list.innerHTML = `<div class="empty"><b>We could not load buses</b>${esc(e.message)}</div>`; return; }
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  trips = trips.filter(t => date !== todayIso() || mins(t.time) > nowMin).sort((a, b) => mins(a.time) - mins(b.time));
  $("#count").textContent = `${trips.length} bus${trips.length === 1 ? "" : "es"} available`;
  if (!trips.length) { list.innerHTML = `<div class="empty"><b>No buses for this date</b>Try another day from the date bar, or ask live chat for help.</div>`; return; }
  list.innerHTML = trips.map(t => `<article class="bus">
    <div class="l t">${esc(t.time)}<small>${esc(longDate(t.date))} · ${esc(t.route.origin)}</small>${t.availableSeats ? `<span class="seats-left">${t.availableSeats} seat${t.availableSeats === 1 ? "" : "s"} left</span>` : `<span class="seats-left">Sold out</span>`}</div>
    <div class="mid"><b>Route: ${esc(t.route.origin)} – ${esc(t.route.destination)}</b><i></i>${esc(t.duration || "")}</div>
    ${t.arrival ? `<div class="t r" style="text-align:right;display:none">${esc(t.arrival)}</div>` : ""}
    <div class="price"><div>Normal<b>${ksh(t.fare_kes)}</b></div><button class="btn sm" data-id="${esc(t._id)}" ${t.availableSeats ? "" : "disabled"}>Select seats</button></div>
  </article>`).join("");
  $$("[data-id]", list).forEach(b => b.onclick = () => openSeats(trips.find(t => t._id === b.dataset.id)));
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
function openSeats(trip, keep) {
  const sel = new Set(keep || []);
  const cap = trip.capacity, rows = Math.ceil(cap / 4);
  const logo = `<span class="logo-text" style="font-size:16px">MASH<i style="font-size:10px">Poa</i></span>`;
  const el = openSheet(`
    <div class="sheet-head">${logo}<div><h3>${esc(trip.route.origin)} → ${esc(trip.route.destination)}</h3><small>${esc(longDate(trip.date))} · ${esc(trip.time)}${trip.arrival ? " → " + esc(trip.arrival) : ""}</small><small class="ok">${trip.availableSeats} seats remaining</small></div><button class="x" aria-label="Close">×</button></div>
    <div class="sheet-body"><div class="bus-map"><div class="wheel"></div><div id="grid"></div></div>
      <div class="legend"><span><i></i>Available</span><span><i class="m"></i>Your seat</span><span><i class="t"></i>Occupied</span></div>
      <p class="hint" style="text-align:center;margin-top:12px">Fare ${ksh(trip.fare_kes)} per seat · choose up to 8 seats</p></div>
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
    const go = $("#go", el); go.disabled = !sel.size; go.textContent = sel.size ? `Continue with ${sel.size} seat${sel.size > 1 ? "s" : ""}` : "Select seats to continue";
    $$("[data-s]", el).forEach(b => b.onclick = () => { const s = b.dataset.s; if (sel.has(s)) sel.delete(s); else if (sel.size < 8) sel.add(s); draw(); });
  };
  draw();
  $("#go", el).onclick = () => openPoints(trip, [...sel]);
}
function openPoints(trip, seats) {
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
  $("#bk", el).onclick = () => openSeats(trip, seats);
  $$(".pt", el).forEach(b => b.onclick = () => {
    $$(`.pt[data-k="${b.dataset.k}"]`, el).forEach(x => x.classList.toggle("on", x === b));
    if (b.dataset.k === "b") boarding = b.dataset.v; else drop = b.dataset.v;
    const c = $("#cont", el); c.disabled = !(boarding && drop); c.textContent = boarding && drop ? "Continue" : "Select both points";
  });
  $("#cont", el).onclick = () => {
    store.set("mp_trip", { trip: { _id: trip._id, routeId: trip.route._id, origin: o, destination: d, date: trip.date, time: trip.time, arrival: trip.arrival || "", fare: trip.fare_kes }, seats, boarding, drop });
    store.del("mp_pax"); store.set("mp_step", "details");
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
  const total = T.trip.fare * T.seats.length;
  const save = () => store.set("mp_pax", pax);
  const summary = full => `<div class="card"><h3>${full ? "Booking summary" : "Fare summary"}</h3>
    <div class="sum-trip"><span class="tag">OUTBOUND</span>
      <div class="sum-row"><b>${esc(T.trip.origin)} → ${esc(T.trip.destination)}</b><span>${esc(longDate(T.trip.date))}</span></div>
      <div class="sum-row"><span>${esc(T.trip.time)}${T.trip.arrival ? " → " + esc(T.trip.arrival) : ""}</span></div>
      ${full ? `<div class="sum-row"><span>Boarding</span><b>${esc(T.boarding.toUpperCase())}</b></div><div class="sum-row"><span>Drop-off</span><b>${esc(T.drop.toUpperCase())}</b></div><div class="sum-row"><span>Seats</span><b>${esc(T.seats.join(", "))}</b></div>` : ""}
      <div class="sum-row"><span>Standard seat × ${T.seats.length}</span><b>${ksh(total)}</b></div></div>
    <div class="total"><span>Total payable</span><b>${ksh(total)}</b></div>`;
  const paint = () => {
    if (step === "pay") return paintPay();
    app.innerHTML = `<div class="wrap">${`<button class="back" id="bk">← Back to buses</button>`}${stepsBar("details")}
      <div class="cols"><div>
        <div class="card trip-strip"><div><small style="color:var(--red);font-weight:800">OUTBOUND</small><b>${esc(T.trip.origin)} → ${esc(T.trip.destination)}</b><small>${esc(longDate(T.trip.date))} · ${esc(T.trip.time)}${T.trip.arrival ? " → " + esc(T.trip.arrival) : ""}</small></div><span class="pill">${T.seats.length} seat${T.seats.length > 1 ? "s" : ""} · ${esc(T.seats.join(", "))}</span></div>
        <h3 style="margin:16px 2px 10px;font-size:14px">Passenger details</h3>
        <div id="paxlist">${pax.map((p, i) => paxHtml(p, i, i === open)).join("")}</div>
        <div class="card pts-card"><div><small>Boarding</small><b>${esc(T.boarding.toUpperCase())}</b><small style="margin-top:8px">Drop-off</small><b>${esc(T.drop.toUpperCase())}</b></div><button class="btn ghost sm" id="editpts">Edit</button></div>
      </div><div>${summary(false)}<button class="btn block" id="topay" ${pax.every(p => p.done) ? "" : "disabled"}>Continue to payment</button><div class="secure">256-bit secured booking</div></div></div></div>`;
    $("#bk").onclick = () => history.back();
    $("#editpts").onclick = () => history.back();
    $("#topay").onclick = () => { step = "pay"; store.set("mp_step", "pay"); paint(); window.scrollTo(0, 0); };
    $$(".pax-h").forEach(h => h.onclick = () => { open = Number(h.dataset.i); paint(); });
    $$(".savepax").forEach(b => b.onclick = () => savePax(Number(b.dataset.i)));
  };
  const paxHtml = (p, i, isOpen) => {
    const head = `<div class="pax-h ${p.done ? "ok" : ""}" data-i="${i}"><span class="num">${p.done ? "✓" : i + 1}</span><div><b>Passenger ${i + 1}</b><small>Outbound seat ${esc(p.seat)} · Standard${p.done ? " · " + esc(p.first + " " + p.last) : ""}</small></div><span class="pill ${p.done ? "ok" : "warn"}">${p.done ? "Complete" : "Action required"}</span></div>`;
    if (!isOpen) return `<div class="pax">${head}</div>`;
    return `<div class="pax open">${head}<div class="pax-f" data-i="${i}">
      <div><label>First name <em>*</em></label><input class="in" name="first" value="${esc(p.first)}" placeholder="First name" autocomplete="given-name"></div>
      <div><label>Last name <em>*</em></label><input class="in" name="last" value="${esc(p.last)}" placeholder="Last name" autocomplete="family-name"></div>
      <div><label>Document type <em>*</em></label><select class="in" name="docType">${["National ID", "Passport", "Alien ID"].map(x => `<option ${p.docType === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div><label>Document number <em>*</em></label><input class="in" name="docNumber" value="${esc(p.docNumber)}" placeholder="Enter document number"></div>
      <div><label>Nationality <em>*</em></label><select class="in" name="nationality"><option value="">Select nationality</option>${NATIONS.map(x => `<option ${p.nationality === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
      <div><label>Passenger phone <em>*</em></label><div class="phone"><select class="in" name="code">${CODES.map(([c, n]) => `<option value="${c}" ${p.code === c ? "selected" : ""}>${c} ${n}</option>`).join("")}</select><input class="in" name="phone" inputmode="tel" value="${esc(p.phone)}" placeholder="712 345 678"></div></div>
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
        <div class="card"><div class="amount-box"><span style="color:var(--muted);font-size:12px">Amount to pay</span><b>${ksh(total)}</b></div>
          <label style="font-size:11px;font-weight:700;color:var(--muted)">Payment phone number</label>
          <input class="in" id="payphone" inputmode="tel" value="${esc(phone)}" style="margin-top:5px">
          <p class="hint">We never ask for your M-PESA PIN on this website. An agent will send official payment details in live chat.</p>
          <label class="chk"><input type="checkbox" id="agree" checked><span>I confirm the passenger details and accept the applicable terms and conditions.</span></label>
          <button class="btn block" id="paybtn">Confirm booking</button><div class="err" id="payerr"></div></div>
      </div><div>${summary(true)}</div>
        <div class="card" style="grid-column:auto"><h3>Passenger details</h3>${pax.map((p, i) => `<div class="sum-row"><b>${esc(p.first + " " + p.last)}</b><span>Seat ${esc(p.seat)}</span></div>`).join("")}</div></div></div>`;
    $("#bk").onclick = () => { step = "details"; store.set("mp_step", "details"); paint(); };
    $("#paybtn").onclick = async () => {
      const b = $("#paybtn"), err = $("#payerr"); err.textContent = "";
      if (!$("#agree").checked) { err.textContent = "Please accept the terms and conditions to continue."; return; }
      const digits = $("#payphone").value.replace(/\D/g, ""); if (digits.length < 9) { err.textContent = "Enter a valid phone number."; return; }
      b.disabled = true; b.textContent = "Creating your booking…";
      try {
        const passengers = pax.map(p => ({ name: (p.first + " " + p.last).trim(), phone: (p.code || "+254") + p.phone, docType: p.docType, docNumber: p.docNumber, nationality: p.nationality, email: p.email }));
        const r = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routeId: T.trip.routeId, scheduleId: T.trip._id, seats: T.seats, passengers, boarding: T.boarding, dropoff: T.drop }) });
        const data = await r.json(); if (!r.ok) throw Error(data.error || "Could not create the booking.");
        const bk = data.booking;
        store.set("mp_booking", { ref: bk.ref, name: passengers[0].name, phone: "+" + digits.replace(/^\+/, ""), from: bk.from, to: bk.to, date: bk.date, time: bk.time, seats: bk.seats, amount: bk.amount });
        store.del("mp_trip"); store.del("mp_pax"); store.del("mp_step");
        location.href = "/chat.html";
      } catch (e) { err.textContent = e.message; b.disabled = false; b.textContent = "Confirm booking"; }
    };
  };
  paint();
}

render();
})();
