/* ==========================================================
   AZoom Car Rental - application logic (front-end demo only)
   Sections: 1 Store | 2 Helpers | 3 Billing | 4 Auth | 5 Views
             6 Customer actions | 7 Staff actions | 8 Events
   ========================================================== */
'use strict';

/* ---------- 1. Store (localStorage "database") ---------- */
const DB_KEY = 'azoom_db_v1';
let db = loadDB();

function loadDB() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { /* ignore */ }
  if (!data || !Array.isArray(data.users) || !Array.isArray(data.bookings)) {
    data = { users: [], bookings: [], sessionUserId: null };
  }
  // make sure the demo staff account always exists
  SEED_USERS.forEach(seed => {
    if (!data.users.some(u => u.email === seed.email)) data.users.push({ ...seed });
  });
  return data;
}
function saveDB() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* storage unavailable */ }
}

/* ---------- 2. Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = n => 'S$' + Number(n).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getCar = id => CARS.find(c => c.id === id);
const getPark = id => CAR_PARKS.find(p => p.id === id);
const currentUser = () => db.users.find(u => u.id === db.sessionUserId) || null;
const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const addDaysISO = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = ts => new Date(ts).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const round2 = n => Math.round(n * 100) / 100;

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}

function openModal(html) {
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
  const first = $('#modalBody input, #modalBody select, #modalBody button');
  if (first) first.focus();
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = ''; }

/* ---------- 3. Billing & availability ---------- */
const BLOCKING = ['Reserved', 'Rented', 'Returned'];

function carStatus(carId) {
  const active = db.bookings.find(b => b.carId === carId && ['Rented', 'Returned'].includes(b.status));
  if (!active) return 'Available';
  return active.status === 'Rented' ? 'On rental' : 'Awaiting inspection';
}

function isCarFree(carId, start, end) {
  // two date ranges overlap when each one starts before the other ends
  return !db.bookings.some(b =>
    b.carId === carId && BLOCKING.includes(b.status) && start < b.endDate && b.startDate < end);
}

function calcBill(b) {
  const car = getCar(b.carId);
  const actualDays = b.returnInfo ? daysBetween(b.startDate, b.returnInfo.date) : b.days;
  const lateDays = Math.max(0, actualDays - b.days);
  const rental = round2(b.days * car.rate);
  const lateFee = round2(lateDays * car.rate * LATE_MULTIPLIER);
  const damages = b.inspection ? b.inspection.damages : [];
  const damageTotal = round2(damages.reduce((sum, d) => sum + d.cost, 0));
  const subtotal = round2(rental + lateFee + damageTotal);
  const gst = round2(subtotal * GST_RATE);
  return { car, rental, lateDays, lateFee, damages, damageTotal, subtotal, gst, total: round2(subtotal + gst) };
}

/* ---------- 4. Auth ---------- */
function openAuthModal(tab = 'login') {
  const isLogin = tab === 'login';
  openModal(`
    <h2 id="modalTitle">${isLogin ? 'Welcome back' : 'Create your account'}</h2>
    <div class="tabs" role="tablist">
      <button class="tab ${isLogin ? 'active' : ''}" data-action="auth-tab" data-tab="login">Log in</button>
      <button class="tab ${!isLogin ? 'active' : ''}" data-action="auth-tab" data-tab="register">Register</button>
    </div>
    <form id="authForm" class="stack" data-mode="${tab}" novalidate>
      ${isLogin ? '' : '<label class="field">Full name<input type="text" id="aName" autocomplete="name" required></label>'}
      <label class="field">Email<input type="email" id="aEmail" autocomplete="email" required></label>
      <label class="field">Password<input type="password" id="aPass" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required></label>
      ${isLogin ? '' : '<label class="field">Confirm password<input type="password" id="aPass2" autocomplete="new-password" required></label>'}
      <p class="form-error" id="authError" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">${isLogin ? 'Log in' : 'Create account'}</button>
      <div class="demo-box">Demo only: passwords are saved in this browser's localStorage, not on a server.<br>
        <strong>Staff demo login:</strong> staff@azoom.com / staff123</div>
    </form>`);
}

function handleAuthSubmit(form) {
  const mode = form.dataset.mode;
  const email = $('#aEmail').value.trim().toLowerCase();
  const pass = $('#aPass').value;
  const err = msg => { $('#authError').textContent = msg; };

  if (!/^\S+@\S+\.\S+$/.test(email)) return err('Please enter a valid email address.');
  if (!pass) return err('Please enter your password.');

  if (mode === 'login') {
    const user = db.users.find(u => u.email === email && u.password === pass);
    if (!user) return err('Incorrect email or password.');
    db.sessionUserId = user.id;
  } else {
    const name = $('#aName').value.trim();
    if (name.length < 2) return err('Please enter your full name.');
    if (pass.length < 6) return err('Password must be at least 6 characters.');
    if (pass !== $('#aPass2').value) return err('Passwords do not match.');
    if (db.users.some(u => u.email === email)) return err('An account with this email already exists.');
    const user = { id: 'u-' + Date.now(), role: 'customer', name, email, password: pass };
    db.users.push(user);
    db.sessionUserId = user.id;
  }
  saveDB();
  closeModal();
  const user = currentUser();
  toast(`Welcome, ${user.name.split(' ')[0]}!`);
  updateNav();
  if (user.role === 'staff') showView('staff');
  else showView(pendingView === 'reserve' ? 'reserve' : 'bookings');
  pendingView = null;
}

function logout() {
  db.sessionUserId = null;
  saveDB();
  updateNav();
  showView('home');
  toast('You have been logged out.');
}

/* ---------- 5. Views ---------- */
let currentView = 'home';
let pendingView = null; // view to open after the person logs in
let pendingCar = null;  // car chosen before logging in

function updateNav() {
  const user = currentUser();
  $('#navBookings').classList.toggle('hidden', !(user && user.role === 'customer'));
  $('#navStaff').classList.toggle('hidden', !(user && user.role === 'staff'));
  $('#navAuth').innerHTML = user
    ? `<span class="user-chip">Hi, <strong>${esc(user.name.split(' ')[0])}</strong>${user.role === 'staff' ? ' (staff)' : ''}</span>
       <button class="btn btn-outline btn-sm" data-action="logout">Log out</button>`
    : `<button class="btn btn-outline btn-sm" data-action="open-login">Log in</button>
       <button class="btn btn-primary btn-sm" data-action="open-register">Register</button>`;
}

function showView(name) {
  const user = currentUser();
  // guard: bookings need a customer, staff portal needs staff
  if (name === 'bookings' && !(user && user.role === 'customer')) { pendingView = name; return openAuthModal('login'); }
  if (name === 'staff' && !(user && user.role === 'staff')) { pendingView = name; return openAuthModal('login'); }

  currentView = name;
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#view-' + name).classList.remove('hidden');
  $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.nav === name));
  $('#navLinks').classList.remove('open');
  $('#navAuth').classList.remove('open');
  $('#navToggle').setAttribute('aria-expanded', 'false');

  if (name === 'reserve') renderReserve();
  if (name === 'bookings') renderBookings();
  if (name === 'staff') renderStaff();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToSection(id) {
  if (currentView !== 'home') showView('home');
  setTimeout(() => document.getElementById(id).scrollIntoView({ behavior: 'smooth' }), 50);
}

/* ----- Fleet ----- */
function renderFleet() {
  $('#fleetGrid').innerHTML = CARS.map(c => `
    <article class="car-card">
      <div class="car-img"><img src="${c.img}" alt="${esc(c.name)}" loading="lazy"></div>
      <div class="car-body">
        <h3>${esc(c.name)}</h3>
        <div class="car-meta">
          <span class="chip">${c.type}</span><span class="chip">${c.seats} seats</span>
          <span class="chip">~${c.range} km range</span><span class="chip">Electric</span>
        </div>
        <p>${esc(c.blurb)}</p>
        <div class="car-foot">
          <div class="price">${money(c.rate).replace('.00', '')}<small> / day</small></div>
          <button class="btn btn-accent btn-sm" data-action="reserve-car" data-car="${c.id}">Reserve</button>
        </div>
      </div>
    </article>`).join('');
}

/* ----- Reserve ----- */
function renderReserve(preselect) {
  const user = currentUser();
  const gate = $('#reserveGate');
  const form = $('#reserveForm');

  if (!user || user.role !== 'customer') {
    form.classList.add('hidden');
    gate.innerHTML = `<div class="card gate">
      <h3>${user ? 'Customer accounts only' : 'Please log in to reserve'}</h3>
      <p class="modal-sub">${user ? 'Staff accounts cannot make reservations. Use the Staff Portal instead.' : 'Create a free account or log in to book your car.'}</p>
      ${user ? '' : `<div class="actions" style="justify-content:center">
        <button class="btn btn-primary" data-action="open-login">Log in</button>
        <button class="btn btn-outline" data-action="open-register">Register</button></div>`}
    </div>`;
    return;
  }

  gate.innerHTML = '';
  form.classList.remove('hidden');
  const today = todayISO();
  const keep = {
    car: preselect || pendingCar || $('#rCar').value || CARS[0].id,
    start: $('#rStart').value || today,
    end: $('#rEnd').value || addDaysISO(today, 2)
  };
  $('#rStart').min = today;
  $('#rStart').value = keep.start;
  $('#rEnd').value = keep.end;
  if (!$('#rName').value) $('#rName').value = user.name;
  pendingCar = null;
  refreshCarOptions(keep.car);
}

function refreshCarOptions(selectedId) {
  const start = $('#rStart').value, end = $('#rEnd').value;
  const validDates = start && end && end > start;
  $('#rEnd').min = start ? addDaysISO(start, 1) : '';
  $('#rCar').innerHTML = CARS.map(c => {
    const free = !validDates || isCarFree(c.id, start, end);
    return `<option value="${c.id}" ${free ? '' : 'disabled'}>${c.name} - ${money(c.rate).replace('.00', '')}/day${free ? '' : ' (not available on these dates)'}</option>`;
  }).join('');
  const sel = selectedId || $('#rCar').value;
  const opt = $(`#rCar option[value="${sel}"]`);
  $('#rCar').value = opt && !opt.disabled ? sel : (($('#rCar option:not([disabled])') || {}).value || sel);
  renderSummary();
}

function renderSummary() {
  const car = getCar($('#rCar').value);
  const start = $('#rStart').value, end = $('#rEnd').value;
  if (!car) return;
  const ok = start && end && end > start;
  const days = ok ? daysBetween(start, end) : 0;
  const sub = days * car.rate, gst = round2(sub * GST_RATE);
  $('#reserveSummary').innerHTML = `
    <img src="${car.img}" alt="${esc(car.name)}">
    <h3>${esc(car.name)}</h3>
    <p class="modal-sub">${car.type} &middot; ${car.seats} seats &middot; Electric</p>
    <div class="line-row"><span>Daily rate</span><span>${money(car.rate)}</span></div>
    <div class="line-row"><span>Days</span><span>${ok ? days : '-'}</span></div>
    <div class="line-row"><span>Subtotal</span><span>${ok ? money(sub) : '-'}</span></div>
    <div class="line-row"><span>GST (9%)</span><span>${ok ? money(gst) : '-'}</span></div>
    <div class="line-row total"><span>Estimated total</span><span>${ok ? money(sub + gst) : '-'}</span></div>
    <p class="hint">Collect from: ${OFFICE.name}, ${OFFICE.address}.<br>Late returns are charged at 1.5x the daily rate. Any damage found is added to the final bill.</p>
    <button class="btn btn-primary btn-block" type="submit">Confirm reservation</button>`;
}

const luhnOk = num => {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = +num[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
};

function handleReserveSubmit() {
  const user = currentUser();
  const err = msg => { $('#reserveError').textContent = msg; toast(msg, true); };
  const carId = $('#rCar').value, start = $('#rStart').value, end = $('#rEnd').value;
  const name = $('#rName').value.trim(), phone = $('#rPhone').value.trim();
  const cardName = $('#rCardName').value.trim();
  const cardNum = $('#rCardNum').value.replace(/\s/g, '');
  const exp = $('#rCardExp').value.trim();
  const cvv = $('#rCardCvv').value.trim();

  if (!start || !end) return err('Please choose your pick-up and return dates.');
  if (start < todayISO()) return err('Pick-up date cannot be in the past.');
  if (end <= start) return err('Return date must be after the pick-up date.');
  if (!isCarFree(carId, start, end)) return err('That car is already booked on those dates.');
  if (name.length < 2) return err('Please enter your full name.');
  if (!/^[\d\s+-]{8,15}$/.test(phone)) return err('Please enter a valid mobile number.');
  if (cardName.length < 2) return err('Please enter the name on your card.');
  if (!/^\d{13,19}$/.test(cardNum) || !luhnOk(cardNum)) return err('That card number is not valid.');
  const m = exp.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!m) return err('Enter the card expiry as MM/YY.');
  const now = new Date();
  if (+m[2] < now.getFullYear() % 100 || (+m[2] === now.getFullYear() % 100 && +m[1] < now.getMonth() + 1)) return err('That card has expired.');
  if (!/^\d{3,4}$/.test(cvv)) return err('Enter the 3 or 4 digit CVV.');

  $('#reserveError').textContent = '';
  const booking = {
    id: 'AZ-' + String(Math.floor(100000 + Math.random() * 900000)),
    userId: user.id, customerName: name, phone,
    carId, startDate: start, endDate: end, days: daysBetween(start, end),
    status: 'Reserved', createdAt: Date.now(),
    // only the last 4 digits are kept; the full number and CVV are never stored
    card: { holder: cardName, last4: cardNum.slice(-4), exp },
    rentInfo: null, returnInfo: null, inspection: null, payment: null
  };
  db.bookings.push(booking);
  saveDB();
  $('#reserveForm').reset();

  openModal(`
    <div class="center">
      <div class="success-icon">&#10003;</div>
      <h2 id="modalTitle">Reservation confirmed!</h2>
      <p class="modal-sub">Your reference number</p>
      <div class="big-ref">${booking.id}</div>
      <p>${esc(getCar(carId).name)} &middot; ${fmtDate(start)} to ${fmtDate(end)}<br>
      Card ending in ${booking.card.last4} (not charged yet)</p>
      <p class="modal-sub">Next step: collect your car at the ${OFFICE.name}.</p>
      <button class="btn btn-primary" data-action="go-bookings">Go to My Bookings</button>
    </div>`);
}

/* ----- My Bookings (customer) ----- */
function trackerHTML(b) {
  if (b.status === 'Cancelled') return '';
  const idx = b.status === 'Completed' ? 4 : STAGES.indexOf(b.status);
  return `<ol class="tracker">${STAGES.map((s, i) => {
    const cls = b.status === 'Completed' || i < idx ? 'done' : i === idx ? 'current done' : '';
    return `<li class="${cls}">${s}</li>`;
  }).join('')}</ol>`;
}

function bookingActions(b) {
  switch (b.status) {
    case 'Reserved': return `<button class="btn btn-primary btn-sm" data-action="rent" data-id="${b.id}">Collect car at office</button>
                             <button class="btn btn-danger btn-sm" data-action="cancel" data-id="${b.id}">Cancel</button>`;
    case 'Rented': return `<button class="btn btn-primary btn-sm" data-action="return" data-id="${b.id}">Return car</button>`;
    case 'Returned': return `<span class="modal-sub">Our staff are inspecting your car. Your bill will appear here shortly.</span>`;
    case 'Inspected': return `<button class="btn btn-accent btn-sm" data-action="bill" data-id="${b.id}">View &amp; pay final bill</button>`;
    case 'Completed': return `<button class="btn btn-outline btn-sm" data-action="bill" data-id="${b.id}">View receipt</button>`;
    default: return '';
  }
}

function renderBookings() {
  const user = currentUser();
  if (!user) return;
  const mine = db.bookings.filter(b => b.userId === user.id).sort((a, b) => b.createdAt - a.createdAt);
  if (!mine.length) {
    $('#bookingsList').innerHTML = `<div class="card empty"><h3>No bookings yet</h3>
      <p>Reserve your first car to get started.</p>
      <button class="btn btn-primary" data-nav="reserve">Reserve a car</button></div>`;
    return;
  }
  $('#bookingsList').innerHTML = `<div class="booking-list">${mine.map(b => {
    const car = getCar(b.carId);
    return `<article class="card booking">
      <img class="booking-img" src="${car.img}" alt="${esc(car.name)}">
      <div>
        <div class="booking-head"><h3>${esc(car.name)}</h3><span class="badge s-${b.status}">${b.status}</span></div>
        <div class="ref">Ref ${b.id}</div>
        <div class="booking-info">
          <span><strong>${fmtDate(b.startDate)}</strong> to <strong>${fmtDate(b.endDate)}</strong> (${b.days} day${b.days > 1 ? 's' : ''})</span>
          ${b.returnInfo ? `<span>Returned at <strong>${esc(getPark(b.returnInfo.parkId).name)}</strong> on ${fmtDate(b.returnInfo.date)}</span>` : ''}
        </div>
        ${trackerHTML(b)}
        <div class="actions">${bookingActions(b)}</div>
      </div>
    </article>`;
  }).join('')}</div>`;
}

/* ----- Staff portal ----- */
function renderStaff() {
  const user = currentUser();
  if (!user || user.role !== 'staff') return;
  const filter = ($('#staffFilter') || {}).value || 'All';
  const count = s => db.bookings.filter(b => b.status === s).length;
  const rows = db.bookings.filter(b => filter === 'All' || b.status === filter).sort((a, b) => b.createdAt - a.createdAt);

  $('#staffContent').innerHTML = `
    <div class="stats">
      <div class="stat"><b>${count('Reserved')}</b><span>Reserved</span></div>
      <div class="stat"><b>${count('Rented')}</b><span>On rental</span></div>
      <div class="stat warn"><b>${count('Returned')}</b><span>Awaiting inspection</span></div>
      <div class="stat"><b>${count('Inspected')}</b><span>Awaiting payment</span></div>
      <div class="stat"><b>${count('Completed')}</b><span>Completed</span></div>
    </div>

    <div class="toolbar">
      <h3 class="panel-title" style="margin:0">Bookings</h3>
      <select id="staffFilter" aria-label="Filter bookings by status">
        ${['All', 'Reserved', 'Rented', 'Returned', 'Inspected', 'Completed', 'Cancelled']
          .map(s => `<option ${s === filter ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Ref</th><th>Customer</th><th>Car</th><th>Dates</th><th>Return point</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${rows.length ? rows.map(b => `
        <tr>
          <td>${b.id}</td><td>${esc(b.customerName)}<br><small>${esc(b.phone)}</small></td>
          <td>${esc(getCar(b.carId).name)}</td>
          <td>${fmtDate(b.startDate)} - ${fmtDate(b.endDate)}</td>
          <td>${b.returnInfo ? esc(getPark(b.returnInfo.parkId).name) : '-'}</td>
          <td><span class="badge s-${b.status}">${b.status}</span></td>
          <td>${b.status === 'Returned' ? `<button class="btn btn-accent btn-sm" data-action="inspect" data-id="${b.id}">Inspect</button>`
              : ['Inspected', 'Completed'].includes(b.status) ? `<button class="btn btn-outline btn-sm" data-action="bill" data-id="${b.id}">View bill</button>` : '-'}</td>
        </tr>`).join('') : '<tr><td colspan="7" class="empty">No bookings to show.</td></tr>'}
      </tbody></table></div>

    <h3 class="panel-title">Fleet status</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Car</th><th>Type</th><th>Rate / day</th><th>Status</th></tr></thead>
      <tbody>${CARS.map(c => {
        const st = carStatus(c.id);
        return `<tr><td>${esc(c.name)}</td><td>${c.type}</td><td>${money(c.rate)}</td>
          <td><span class="badge ${st === 'Available' ? 's-Available' : st === 'On rental' ? 's-Rented' : 's-Returned'}">${st}</span></td></tr>`;
      }).join('')}</tbody></table></div>`;
}

/* ---------- 6. Customer actions: rent, return, pay ---------- */
const findBooking = id => db.bookings.find(b => b.id === id);

function openRentModal(b) {
  const car = getCar(b.carId);
  openModal(`
    <h2 id="modalTitle">Collect your car</h2>
    <p class="modal-sub">${esc(car.name)} &middot; Ref ${b.id}</p>
    <div class="demo-box">Visit the <strong>${OFFICE.name}</strong>, ${OFFICE.address} (${OFFICE.hours}). Confirm below once you are at the counter.</div>
    <form id="rentForm" class="stack" data-id="${b.id}" style="margin-top:1rem" novalidate>
      <label class="check"><input type="checkbox" id="rentLicence"><span>I have shown my valid driver's licence and ID to the counter staff.</span></label>
      <label class="check"><input type="checkbox" id="rentTerms"><span>I agree to the rental terms, including late-return and damage charges.</span></label>
      <p class="form-error" id="rentError" role="alert"></p>
      <button class="btn btn-primary" type="submit">Confirm &amp; collect car</button>
    </form>`);
}

function handleRent(form) {
  if (!$('#rentLicence').checked || !$('#rentTerms').checked) {
    $('#rentError').textContent = 'Please tick both boxes to continue.';
    return;
  }
  const b = findBooking(form.dataset.id);
  b.status = 'Rented';
  b.rentInfo = { at: Date.now(), office: OFFICE.name };
  saveDB(); closeModal(); renderBookings();
  toast('Enjoy your drive! Car collected.');
}

function openReturnModal(b) {
  const car = getCar(b.carId);
  const today = todayISO();
  openModal(`
    <h2 id="modalTitle">Return your car</h2>
    <p class="modal-sub">${esc(car.name)} &middot; Ref ${b.id}</p>
    <form id="returnForm" class="stack" data-id="${b.id}" novalidate>
      <label class="field">Designated car park
        <select id="retPark">${CAR_PARKS.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
      </label>
      <label class="field">Return date
        <input type="date" id="retDate" value="${today < b.startDate ? b.startDate : today}" min="${b.startDate}">
      </label>
      <p class="hint" style="margin:0">Planned return: ${fmtDate(b.endDate)}. Returning later than planned is charged at 1.5x the daily rate per extra day. (Change the date to try this out in the demo.)</p>
      <label class="check"><input type="checkbox" id="retConfirm"><span>I have parked the car in the designated bay, locked it and taken my belongings.</span></label>
      <p class="form-error" id="retError" role="alert"></p>
      <button class="btn btn-primary" type="submit">Confirm return</button>
    </form>`);
}

function handleReturn(form) {
  const b = findBooking(form.dataset.id);
  const date = $('#retDate').value;
  if (!date || date < b.startDate) return void ($('#retError').textContent = 'Please choose a valid return date.');
  if (!$('#retConfirm').checked) return void ($('#retError').textContent = 'Please confirm the car has been parked and locked.');
  b.status = 'Returned';
  b.returnInfo = { parkId: $('#retPark').value, date, at: Date.now() };
  saveDB(); closeModal(); renderBookings();
  toast('Car returned. Staff will inspect it shortly.');
}

function openBillModal(b) {
  const bill = calcBill(b);
  const user = currentUser();
  const isCustomer = user && user.role === 'customer' && b.userId === user.id;
  const paid = b.status === 'Completed';
  const car = bill.car;

  openModal(`
    <div id="billArea">
      <h2 id="modalTitle">${paid ? 'Receipt' : 'Final bill'}</h2>
      <p class="modal-sub">${esc(car.name)} &middot; Ref ${b.id} &middot; ${esc(b.customerName)}</p>
      ${paid ? '<span class="paid-stamp">PAID</span>' : ''}
      <div class="bill">
        <div class="line-row"><span>Rental: ${b.days} day${b.days > 1 ? 's' : ''} x ${money(car.rate)}</span><span>${money(bill.rental)}</span></div>
        ${bill.lateDays ? `<div class="line-row neg"><span>Late return: ${bill.lateDays} day${bill.lateDays > 1 ? 's' : ''} x ${money(car.rate * LATE_MULTIPLIER)}</span><span>${money(bill.lateFee)}</span></div>` : ''}
        ${bill.damages.length
          ? bill.damages.map(d => `<div class="line-row neg"><span>Damage: ${esc(d.label)}</span><span>${money(d.cost)}</span></div>`).join('')
          : '<div class="line-row"><span>Damage charges (none found)</span><span>' + money(0) + '</span></div>'}
        <div class="line-row"><span>Subtotal</span><span>${money(bill.subtotal)}</span></div>
        <div class="line-row"><span>GST (9%)</span><span>${money(bill.gst)}</span></div>
        <div class="line-row total"><span>Total</span><span>${money(bill.total)}</span></div>
      </div>
      ${b.inspection && b.inspection.notes ? `<p class="hint">Inspection note: ${esc(b.inspection.notes)}</p>` : ''}
      ${b.inspection ? `<p class="hint">Inspected by ${esc(b.inspection.by)} on ${fmtDateTime(b.inspection.at)}.</p>` : ''}
      ${paid ? `<p class="hint">Paid ${fmtDateTime(b.payment.at)} with card ending ${b.payment.last4}. Payment ref ${b.payment.ref}.</p>` : ''}
    </div>
    <div class="actions">
      ${!paid && isCustomer ? `<button class="btn btn-accent" data-action="pay" data-id="${b.id}">Pay ${money(bill.total)} with card ending ${b.card.last4}</button>` : ''}
      ${paid ? '<button class="btn btn-outline" data-action="print">Print receipt</button>' : ''}
      <button class="btn btn-outline" data-action="close-modal">Close</button>
    </div>`);
}

function handlePay(b) {
  b.status = 'Completed';
  b.payment = { at: Date.now(), last4: b.card.last4, amount: calcBill(b).total, ref: 'PAY-' + Math.floor(100000 + Math.random() * 900000) };
  saveDB();
  renderBookings();
  openBillModal(b);
  toast('Payment successful. Thank you!');
}

/* ---------- 7. Staff actions: inspection ---------- */
function openInspectModal(b) {
  const car = getCar(b.carId);
  openModal(`
    <h2 id="modalTitle">Inspect returned car</h2>
    <p class="modal-sub">${esc(car.name)} &middot; Ref ${b.id} &middot; ${esc(b.customerName)}<br>
      Returned at ${esc(getPark(b.returnInfo.parkId).name)} on ${fmtDate(b.returnInfo.date)}</p>
    <form id="inspectForm" class="stack" data-id="${b.id}" novalidate>
      <p style="margin:0;font-weight:600">Tick any damage found (leave blank if the car is fine):</p>
      ${DAMAGE_ITEMS.map(d => `
        <label class="check"><input type="checkbox" name="damage" value="${d.id}">
          <span class="grow">${d.label}</span><span class="cost">+${money(d.cost)}</span></label>`).join('')}
      <label class="field">Inspection notes (optional)
        <textarea id="inspNotes" rows="2" maxlength="200" placeholder="e.g. Scratch on rear left door"></textarea>
      </label>
      <div class="line-row total"><span>Damage total</span><span id="inspTotal">${money(0)}</span></div>
      <button class="btn btn-primary" type="submit">Save inspection &amp; update status</button>
    </form>`);
}

function updateInspectTotal() {
  const ids = $$('#inspectForm input[name="damage"]:checked').map(i => i.value);
  const total = DAMAGE_ITEMS.filter(d => ids.includes(d.id)).reduce((s, d) => s + d.cost, 0);
  $('#inspTotal').textContent = money(total);
}

function handleInspect(form) {
  const b = findBooking(form.dataset.id);
  const ids = $$('input[name="damage"]:checked', form).map(i => i.value);
  b.inspection = {
    by: currentUser().name,
    at: Date.now(),
    damages: DAMAGE_ITEMS.filter(d => ids.includes(d.id)).map(d => ({ id: d.id, label: d.label, cost: d.cost })),
    notes: $('#inspNotes').value.trim()
  };
  b.status = 'Inspected';
  saveDB(); closeModal(); renderStaff();
  toast(ids.length ? 'Inspection saved. Damage added to the bill.' : 'Inspection saved. No damage found.');
}

/* ---------- 8. Events ---------- */
document.addEventListener('click', e => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    e.preventDefault();
    const target = navBtn.dataset.nav;
    if (target === 'fleet' || target === 'how') return scrollToSection(target);
    if (target === 'reserve' && !currentUser()) { pendingView = 'reserve'; }
    return showView(target);
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.action) {
    case 'open-login': openAuthModal('login'); break;
    case 'open-register': openAuthModal('register'); break;
    case 'auth-tab': openAuthModal(el.dataset.tab); break;
    case 'logout': logout(); break;
    case 'close-modal': closeModal(); break;
    case 'go-bookings': closeModal(); showView('bookings'); break;
    case 'reserve-car':
      showView('reserve');
      if (currentUser() && currentUser().role === 'customer') renderReserve(el.dataset.car);
      else { pendingView = 'reserve'; pendingCar = el.dataset.car; }
      break;
    case 'rent': openRentModal(findBooking(id)); break;
    case 'return': openReturnModal(findBooking(id)); break;
    case 'bill': openBillModal(findBooking(id)); break;
    case 'pay': handlePay(findBooking(id)); break;
    case 'print': window.print(); break;
    case 'inspect': openInspectModal(findBooking(id)); break;
    case 'cancel':
      if (confirm('Cancel this reservation?')) {
        findBooking(id).status = 'Cancelled'; saveDB(); renderBookings(); toast('Reservation cancelled.');
      }
      break;
  }
});

document.addEventListener('submit', e => {
  e.preventDefault();
  switch (e.target.id) {
    case 'authForm': handleAuthSubmit(e.target); break;
    case 'reserveForm': handleReserveSubmit(); break;
    case 'rentForm': handleRent(e.target); break;
    case 'returnForm': handleReturn(e.target); break;
    case 'inspectForm': handleInspect(e.target); break;
  }
});

document.addEventListener('change', e => {
  if (['rStart', 'rEnd'].includes(e.target.id)) {
    if (e.target.id === 'rStart' && $('#rEnd').value <= e.target.value) $('#rEnd').value = addDaysISO(e.target.value, 1);
    refreshCarOptions($('#rCar').value);
  }
  if (e.target.id === 'rCar') renderSummary();
  if (e.target.id === 'staffFilter') renderStaff();
  if (e.target.name === 'damage') updateInspectTotal();
});

// card number / expiry input formatting
document.addEventListener('input', e => {
  if (e.target.id === 'rCardNum') {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  }
  if (e.target.id === 'rCardExp') {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    e.target.value = v;
  }
});

$('#modalClose').addEventListener('click', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('#navToggle').addEventListener('click', () => {
  const open = $('#navLinks').classList.toggle('open');
  $('#navAuth').classList.toggle('open', open);
  $('#navToggle').setAttribute('aria-expanded', String(open));
});

/* ---------- Start ---------- */
renderFleet();
updateNav();
showView('home');
