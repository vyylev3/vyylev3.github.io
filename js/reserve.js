/* ===== Reserve page: booking form, live price, card validation ===== */

const form = document.getElementById("reserveForm");
const carSelect = document.getElementById("car");
const pickup = document.getElementById("pickup");
const ret = document.getElementById("return");

function setError(id, msg) { document.getElementById(id).textContent = msg || ""; }

function updateSummary() {
  const car = getCar(carSelect.value);
  document.getElementById("sumImg").src = car.img;
  document.getElementById("sumImg").alt = car.name;
  document.getElementById("sumCar").textContent = car.name;
  document.getElementById("sumRate").textContent = money(car.rate) + " / day";
  if (pickup.value && ret.value && ret.value > pickup.value) {
    const days = daysBetween(pickup.value, ret.value);
    document.getElementById("sumDays").textContent = days;
    document.getElementById("sumTotal").textContent = money(days * car.rate);
  } else {
    document.getElementById("sumDays").textContent = "–";
    document.getElementById("sumTotal").textContent = "–";
  }
}

function validate() {
  let ok = true;
  const today = todayISO();
  setError("pickupErr", ""); setError("returnErr", ""); setError("holderErr", "");
  setError("cardNoErr", ""); setError("expiryErr", ""); setError("cvvErr", "");

  if (!pickup.value || pickup.value < today) { setError("pickupErr", "Choose today or a future date."); ok = false; }
  if (!ret.value || ret.value <= pickup.value) { setError("returnErr", "Return must be after pick-up."); ok = false; }
  if (document.getElementById("holder").value.trim().length < 3) { setError("holderErr", "Enter the name on the card."); ok = false; }

  const digits = document.getElementById("cardNo").value.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(digits)) { setError("cardNoErr", "Enter a valid card number (13–19 digits)."); ok = false; }

  const m = document.getElementById("expiry").value.match(/^(\d{2})\/(\d{2})$/);
  const now = new Date();
  if (!m || +m[1] < 1 || +m[1] > 12 || new Date(2000 + +m[2], +m[1], 0) < now) { setError("expiryErr", "Enter a valid future expiry."); ok = false; }

  if (!/^\d{3,4}$/.test(document.getElementById("cvv").value)) { setError("cvvErr", "3 or 4 digits."); ok = false; }
  return ok;
}

function cardBrand(digits) {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  return "Card";
}

function init() {
  const user = currentUser();
  if (!user || user.role !== "customer") {
    document.getElementById("notLoggedIn").classList.remove("hidden");
    return;
  }
  document.getElementById("reserveLayout").classList.remove("hidden");
  document.getElementById("sumOffice").textContent = OFFICE.name + ", " + OFFICE.address;

  // Only cars that are currently available can be reserved
  const wanted = new URLSearchParams(location.search).get("car");
  const options = CARS.filter(c => getCarStatus(c.id) === "Available" || c.id === wanted && getCarStatus(c.id) === "Available");
  if (options.length === 0) {
    document.getElementById("reserveLayout").innerHTML = '<div class="card empty">Sorry, all cars are currently booked. Please check back soon.</div>';
    return;
  }
  carSelect.innerHTML = options.map(c => `<option value="${c.id}">${c.name} – $${c.rate}/day</option>`).join("");
  if (wanted && options.some(c => c.id === wanted)) carSelect.value = wanted;

  pickup.min = todayISO(); pickup.value = todayISO();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  ret.min = tomorrow; ret.value = tomorrow;
  document.getElementById("holder").value = user.name;
  updateSummary();
}

/* Live updates */
[carSelect, pickup, ret].forEach(el => el.addEventListener("input", updateSummary));
pickup.addEventListener("change", () => {
  const next = new Date(new Date(pickup.value).getTime() + 86400000).toISOString().slice(0, 10);
  ret.min = next;
  if (ret.value <= pickup.value) ret.value = next;
  updateSummary();
});
document.getElementById("cardNo").addEventListener("input", e => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 16);
  e.target.value = d.replace(/(.{4})/g, "$1 ").trim();
  document.getElementById("cardPreview").textContent = (d.padEnd(16, "•")).replace(/(.{4})/g, "$1 ").trim();
});
document.getElementById("holder").addEventListener("input", e => {
  document.getElementById("holderPreview").textContent = e.target.value.toUpperCase() || "CARDHOLDER NAME";
});
document.getElementById("expiry").addEventListener("input", e => {
  let v = e.target.value.replace(/\D/g, "").slice(0, 4);
  if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
  e.target.value = v;
});

form.addEventListener("submit", e => {
  e.preventDefault();
  if (!validate()) return;

  const car = getCar(carSelect.value);
  if (getCarStatus(car.id) !== "Available") { toast("Sorry, that car was just taken.", "error"); return; }

  const days = daysBetween(pickup.value, ret.value);
  const digits = document.getElementById("cardNo").value.replace(/\s/g, "");
  const booking = addBooking({
    userEmail: currentUser().email,
    carId: car.id,
    pickupDate: pickup.value,
    returnDate: ret.value,
    days,
    rate: car.rate,
    rentalCost: days * car.rate,
    card: { brand: cardBrand(digits), last4: digits.slice(-4), holder: document.getElementById("holder").value.trim() },
    status: "Reserved",
    createdAt: new Date().toISOString()
  });
  setCarStatus(car.id, "Reserved");
  toast("Reservation " + booking.id + " confirmed!");
  setTimeout(() => (location.href = "account.html"), 900);
});

init();
