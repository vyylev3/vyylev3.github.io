const KEYS = { users: "azoom_users", cars: "azoom_car_status", bookings: "azoom_bookings", session: "azoom_session" };

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

/* ---------- Users & session ---------- */
function getUsers() {
  const users = read(KEYS.users, []);
  if (!users.some(u => u.email === STAFF_ACCOUNT.email)) {   // seed the staff account once
    users.push(STAFF_ACCOUNT);
    write(KEYS.users, users);
  }
  return users;
}

function registerCustomer({ name, email, phone, licence, password }) {
  const users = getUsers();
  email = email.trim().toLowerCase();
  if (users.some(u => u.email === email)) return { ok: false, error: "That email is already registered." };
  users.push({ name: name.trim(), email, phone, licence, password, role: "customer" });
  write(KEYS.users, users);
  sessionStorage.setItem(KEYS.session, email);
  return { ok: true };
}

function login(email, password, role) {
  email = email.trim().toLowerCase();
  const user = getUsers().find(u => u.email === email && u.password === password);
  if (!user) return { ok: false, error: "Incorrect email or password." };
  if (user.role !== role) return { ok: false, error: role === "staff" ? "This page is for AZoom staff only." : "Staff please use the Staff Portal." };
  sessionStorage.setItem(KEYS.session, email);   // sessionStorage lets you stay logged in as customer and staff in different tabs
  return { ok: true };
}

function logout() { sessionStorage.removeItem(KEYS.session); }

function currentUser() {
  const email = sessionStorage.getItem(KEYS.session);
  return email ? getUsers().find(u => u.email === email) || null : null;
}

/* ---------- Car status ---------- */
function getCarStatus(carId) { return read(KEYS.cars, {})[carId] || "Available"; }
function setCarStatus(carId, status) {
  const all = read(KEYS.cars, {});
  all[carId] = status;
  write(KEYS.cars, all);
}
function getCar(carId) { return CARS.find(c => c.id === carId); }

/* ---------- Bookings ---------- */
function getBookings() { return read(KEYS.bookings, []); }
function getBooking(id) { return getBookings().find(b => b.id === id); }
function saveBooking(updated) {
  const all = getBookings().map(b => (b.id === updated.id ? updated : b));
  write(KEYS.bookings, all);
}
function addBooking(booking) {
  const all = getBookings();
  booking.id = "AZ-" + (1001 + all.length);
  all.push(booking);
  write(KEYS.bookings, all);
  return booking;
}

/* ---------- Pricing & formatting ---------- */
function daysBetween(start, end) {
  const ms = new Date(end) - new Date(start);
  return Math.max(1, Math.round(ms / 86400000));
}
function money(n) { return "$" + Number(n).toFixed(2); }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–"; }
function fmtDateTime(iso) { return iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–"; }
function slug(text) { return text.toLowerCase().replace(/\s+/g, "-"); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

/* Escape user-typed text before putting it into innerHTML */
function esc(text) {
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}
