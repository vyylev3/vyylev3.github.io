/* ===== Customer account: login / register, bookings, return, pay ===== */

const authView = document.getElementById("authView");
const bookingsView = document.getElementById("bookingsView");

function showMsg(text) {
  document.getElementById("authMsg").innerHTML = text ? `<div class="form-msg error">${esc(text)}</div>` : "";
}

/* ---------- Auth ---------- */
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
  document.getElementById("loginForm").classList.toggle("hidden", tab.dataset.tab !== "login");
  document.getElementById("registerForm").classList.toggle("hidden", tab.dataset.tab !== "register");
  showMsg("");
}));

document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const res = login(lEmail.value, lPass.value, "customer");
  if (!res.ok) return showMsg(res.error);
  render();
});

document.getElementById("registerForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!rName.value.trim() || !rPhone.value.trim() || !rLicence.value.trim()) return showMsg("Please fill in all fields.");
  if (!/^\S+@\S+\.\S+$/.test(rEmail.value)) return showMsg("Enter a valid email address.");
  if (rPass.value.length < 6) return showMsg("Password must be at least 6 characters.");
  const res = registerCustomer({ name: rName.value, email: rEmail.value, phone: rPhone.value, licence: rLicence.value, password: rPass.value });
  if (!res.ok) return showMsg(res.error);
  toast("Welcome to AZoom!");
  render();
});

document.getElementById("logoutBtn").addEventListener("click", () => { logout(); render(); });

/* ---------- Bookings ---------- */
function billHTML(b) {
  const damages = b.inspection.damages.map(d => `<div class="summary-row"><span>${esc(d.label)}</span><span>${money(d.fee)}</span></div>`).join("");
  return `<div class="bill">
    <div class="summary-row"><span>Rental (${b.days} day${b.days > 1 ? "s" : ""} × ${money(b.rate)})</span><span>${money(b.rentalCost)}</span></div>
    ${damages || '<div class="summary-row"><span>Damage charges</span><span>$0.00</span></div>'}
    <div class="summary-row total"><span>Final bill</span><span>${money(b.finalBill)}</span></div>
  </div>`;
}

function actionsHTML(b) {
  switch (b.status) {
    case "Reserved":
      return `<p class="muted" style="margin:0">Collect your car at <b>${OFFICE.name}</b> on ${fmtDate(b.pickupDate)} with your driving licence.</p>
              <button class="btn btn-outline btn-sm" data-act="cancel" data-id="${b.id}">Cancel reservation</button>`;
    case "Rented":
      return `<div class="field"><label for="park-${b.id}">Return car park</label>
                <select id="park-${b.id}">${CAR_PARKS.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}</select></div>
              <button class="btn btn-sm" data-act="return" data-id="${b.id}">Return car here</button>`;
    case "Returned":
      return `<p class="muted" style="margin:0">Returned at <b>${esc(b.returnCarPark)}</b>. Waiting for an AZoom employee to inspect the car…</p>`;
    case "Inspected":
      return `${billHTML(b)}
              <button class="btn btn-orange btn-sm" data-act="pay" data-id="${b.id}">Pay ${money(b.finalBill)} with card ending ${b.card.last4}</button>`;
    case "Completed":
      return `${billHTML(b)}<p style="margin:6px 0 0"><span class="badge paid">Paid ${fmtDateTime(b.paidAt)}</span> Thank you for choosing AZoom!</p>`;
    default:
      return "";
  }
}

function bookingHTML(b) {
  const car = getCar(b.carId);
  return `<article class="card booking reveal visible">
    <img src="${car.img}" alt="${car.name}">
    <div>
      <div class="booking-head">
        <h3>${car.name} <small class="muted">· ${b.id}</small></h3>
        <span class="badge ${slug(b.status)}">${b.status}</span>
      </div>
      <div class="booking-meta">
        <span>Pick-up: <b>${fmtDate(b.pickupDate)}</b></span>
        <span>Return: <b>${fmtDate(b.returnDate)}</b></span>
        <span>Estimated: <b>${money(b.rentalCost)}</b></span>
        <span>Card: <b>${b.card.brand} ••${b.card.last4}</b></span>
      </div>
      ${stepperHTML(b.status)}
      <div class="booking-actions">${actionsHTML(b)}</div>
    </div>
  </article>`;
}

function renderBookings() {
  const user = currentUser();
  document.getElementById("welcome").textContent = "Hello, " + user.name.split(" ")[0] + " 👋";
  const mine = getBookings().filter(b => b.userEmail === user.email).reverse();
  document.getElementById("bookingList").innerHTML = mine.length
    ? mine.map(bookingHTML).join("")
    : `<div class="card empty"><h3>No bookings yet</h3><p>Pick one of our electric cars and make your first reservation.</p><a class="btn" href="index.html#fleet">Browse cars</a></div>`;
}

document.getElementById("bookingList").addEventListener("click", e => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const b = getBooking(btn.dataset.id);

  if (btn.dataset.act === "cancel") {
    b.status = "Cancelled";
    setCarStatus(b.carId, "Available");
    toast("Reservation cancelled.");
  }
  if (btn.dataset.act === "return") {
    const parkId = document.getElementById("park-" + b.id).value;
    b.status = "Returned";
    b.returnCarPark = CAR_PARKS.find(p => p.id === parkId).name;
    b.returnedAt = new Date().toISOString();
    setCarStatus(b.carId, "Awaiting Inspection");
    toast("Car returned. An employee will inspect it shortly.");
  }
  if (btn.dataset.act === "pay") {
    b.status = "Completed";
    b.paidAt = new Date().toISOString();
    toast("Payment of " + money(b.finalBill) + " successful. Thank you!");
  }
  saveBooking(b);
  renderBookings();
});

function render() {
  const user = currentUser();
  const loggedIn = user && user.role === "customer";
  authView.classList.toggle("hidden", loggedIn);
  bookingsView.classList.toggle("hidden", !loggedIn);
  if (loggedIn) renderBookings();
  initNav();
}
render();
