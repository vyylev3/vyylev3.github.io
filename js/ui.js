/* ===== Shared UI helpers: nav, toast, scroll-reveal ===== */

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = "toast " + (type === "error" ? "error" : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function initNav() {
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  toggle?.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });

  // Show the logged-in customer's name / Login link
  const user = currentUser();
  const accountLink = document.getElementById("accountLink");
  if (accountLink && user && user.role === "customer") accountLink.textContent = "My Bookings (" + user.name.split(" ")[0] + ")";
}

function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { items.forEach(i => i.classList.add("visible")); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  items.forEach(i => io.observe(i));
}

/* Booking progress bar markup (used by customer + staff views) */
function stepperHTML(status) {
  const idx = status === "Cancelled" ? -1 : BOOKING_STEPS.indexOf(status);
  const labels = { Reserved: "Reserved", Rented: "Picked up", Returned: "Returned", Inspected: "Inspected", Completed: "Paid" };
  return '<ol class="stepper">' + BOOKING_STEPS.map((s, i) => {
    const cls = i < idx ? "done" : i === idx ? (status === "Completed" ? "done" : "done current") : "";
    return `<li class="${cls}">${labels[s]}</li>`;
  }).join("") + "</ol>";
}

document.addEventListener("DOMContentLoaded", () => { initNav(); initReveal(); });
