/* ===== Staff portal: hand over, inspect, fleet status ===== */

const staffLogin = document.getElementById("staffLogin");
const staffView = document.getElementById("staffView");
const handoverDialog = document.getElementById("handoverDialog");
const inspectDialog = document.getElementById("inspectDialog");
let filter = "action";
let activeBookingId = null;

/* ---------- Auth ---------- */
document.getElementById("staffForm").addEventListener("submit", e => {
  e.preventDefault();
  const res = login(sEmail.value, sPass.value, "staff");
  if (!res.ok) { document.getElementById("staffMsg").innerHTML = `<div class="form-msg error">${esc(res.error)}</div>`; return; }
  render();
});
document.getElementById("staffLogout").addEventListener("click", () => { logout(); render(); });

/* ---------- Dashboard ---------- */
function renderStats() {
  const b = getBookings();
  const count = s => b.filter(x => x.status === s).length;
  const available = CARS.filter(c => getCarStatus(c.id) === "Available").length;
  const items = [
    ["Reserved (to hand over)", count("Reserved")],
    ["Currently rented", count("Rented")],
    ["Awaiting inspection", count("Returned")],
    ["Awaiting payment", count("Inspected")],
    ["Cars available", available + " / " + CARS.length]
  ];
  document.getElementById("stats").innerHTML = items.map(([label, n]) => `<div class="card stat"><b>${n}</b><span>${label}</span></div>`).join("");
}

function rowAction(b) {
  if (b.status === "Reserved") return `<button class="btn btn-sm" data-act="handover" data-id="${b.id}">Hand over car</button>`;
  if (b.status === "Returned") return `<button class="btn btn-orange btn-sm" data-act="inspect" data-id="${b.id}">Inspect car</button>`;
  if (b.status === "Inspected") return `<span class="muted">Bill ${money(b.finalBill)} – awaiting payment</span>`;
  if (b.status === "Completed") return `<span class="muted">Paid ${money(b.finalBill)}</span>`;
  if (b.status === "Rented") return `<span class="muted">With customer</span>`;
  return "–";
}

function renderBookingRows() {
  const needsAction = b => b.status === "Reserved" || b.status === "Returned";
  const list = getBookings().filter(b => filter === "all" || needsAction(b)).reverse();
  const users = getUsers();
  document.getElementById("bookingRows").innerHTML = list.length ? list.map(b => {
    const customer = users.find(u => u.email === b.userEmail);
    return `<tr>
      <td><b>${b.id}</b></td>
      <td>${esc(customer?.name)}<br><small class="muted">${esc(customer?.phone || "")}</small></td>
      <td>${getCar(b.carId).name}</td>
      <td>${fmtDate(b.pickupDate)} → ${fmtDate(b.returnDate)}</td>
      <td><span class="badge ${slug(b.status)}">${b.status}</span>${b.returnCarPark ? `<br><small class="muted">${esc(b.returnCarPark)}</small>` : ""}</td>
      <td>${rowAction(b)}</td></tr>`;
  }).join("") : `<tr><td colspan="6" class="empty">${filter === "all" ? "No bookings yet." : "Nothing needs action right now."}</td></tr>`;
}

function renderFleetRows() {
  document.getElementById("fleetRows").innerHTML = CARS.map(c => {
    const s = getCarStatus(c.id);
    const action = s === "Maintenance" ? `<button class="btn btn-sm" data-act="available" data-car="${c.id}">Mark repaired / available</button>` : "–";
    return `<tr><td><b>${c.name}</b></td><td>${c.type}</td><td>${money(c.rate)}</td><td><span class="badge ${slug(s)}">${s}</span></td><td>${action}</td></tr>`;
  }).join("");
}

function renderDashboard() {
  document.getElementById("staffName").textContent = currentUser().name;
  renderStats(); renderBookingRows(); renderFleetRows();
}

/* ---------- Actions ---------- */
document.getElementById("bookingTabs").addEventListener("click", e => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  filter = tab.dataset.filter;
  document.querySelectorAll("#bookingTabs .tab").forEach(t => t.classList.toggle("active", t === tab));
  renderBookingRows();
});

staffView.addEventListener("click", e => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  if (btn.dataset.act === "handover") openHandover(btn.dataset.id);
  if (btn.dataset.act === "inspect") openInspect(btn.dataset.id);
  if (btn.dataset.act === "available") {
    setCarStatus(btn.dataset.car, "Available");
    toast("Car is back in the fleet.");
    renderDashboard();
  }
});
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

/* Hand over (customer rents the car at the office) */
function openHandover(id) {
  activeBookingId = id;
  const b = getBooking(id);
  const customer = getUsers().find(u => u.email === b.userEmail);
  document.getElementById("handoverInfo").innerHTML =
    `${b.id} · <b>${getCar(b.carId).name}</b> for <b>${esc(customer.name)}</b><br>Licence no: ${esc(customer.licence)}`;
  idChecked.checked = false; carChecked.checked = false;
  handoverDialog.showModal();
}
document.getElementById("handoverForm").addEventListener("submit", e => {
  if (!idChecked.checked || !carChecked.checked) { e.preventDefault(); toast("Please tick both checks first.", "error"); return; }
  const b = getBooking(activeBookingId);
  b.status = "Rented";
  b.rentedAt = new Date().toISOString();
  saveBooking(b);
  setCarStatus(b.carId, "Rented");
  toast("Car handed over to customer.");
  renderDashboard();
});

/* Inspection (employee checks the returned car) */
function damageTotal() {
  const ticked = [...document.querySelectorAll("#damageList input:checked")].reduce((s, i) => s + +i.dataset.fee, 0);
  return ticked + (parseFloat(otherFee.value) || 0);
}
function openInspect(id) {
  activeBookingId = id;
  const b = getBooking(id);
  document.getElementById("inspectInfo").innerHTML = `${b.id} · <b>${getCar(b.carId).name}</b> returned at ${esc(b.returnCarPark)}`;
  document.getElementById("damageList").innerHTML = DAMAGE_ITEMS.map(d =>
    `<label><span><input type="checkbox" data-id="${d.id}" data-fee="${d.fee}"> ${d.label}</span><b>${money(d.fee)}</b></label>`).join("");
  otherFee.value = 0; notes.value = "";
  document.getElementById("damageTotal").textContent = money(0);
  inspectDialog.showModal();
}
document.getElementById("inspectDialog").addEventListener("input", () => {
  document.getElementById("damageTotal").textContent = money(damageTotal());
});
document.getElementById("inspectForm").addEventListener("submit", () => {
  const b = getBooking(activeBookingId);
  const damages = [...document.querySelectorAll("#damageList input:checked")].map(i => {
    const item = DAMAGE_ITEMS.find(d => d.id === i.dataset.id);
    return { label: item.label, fee: item.fee };
  });
  const other = parseFloat(otherFee.value) || 0;
  if (other > 0) damages.push({ label: "Other damage" + (notes.value ? " (" + notes.value + ")" : ""), fee: other });

  const damageSum = damages.reduce((s, d) => s + d.fee, 0);
  b.inspection = { damages, notes: notes.value.trim(), damageTotal: damageSum, inspectedAt: new Date().toISOString(), by: currentUser().name };
  b.finalBill = b.rentalCost + damageSum;
  b.status = "Inspected";
  saveBooking(b);
  setCarStatus(b.carId, damages.length ? "Maintenance" : "Available");
  toast(damages.length ? "Damage recorded – car sent to maintenance." : "No damage – car is available again.");
  renderDashboard();
});

function render() {
  const user = currentUser();
  const isStaff = user && user.role === "staff";
  staffLogin.classList.toggle("hidden", isStaff);
  staffView.classList.toggle("hidden", !isStaff);
  if (isStaff) renderDashboard();
}
render();
