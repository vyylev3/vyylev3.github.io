/* ===== Home page: fleet cards + locations ===== */

function renderFleet() {
  const grid = document.getElementById("fleetGrid");
  grid.innerHTML = CARS.map(car => {
    const status = getCarStatus(car.id);
    const available = status === "Available";
    return `
      <article class="car-card reveal">
        <div class="car-img"><img src="${car.img}" alt="${car.name}" loading="lazy"></div>
        <div class="car-body">
          <div class="car-top">
            <span class="badge">${car.type}</span>
            <span class="badge ${slug(status)}">${status}</span>
          </div>
          <h3>${car.name}</h3>
          <div class="car-specs"><span>👥 ${car.seats} seats</span><span>🔋 ${car.range} km range</span></div>
          <div class="car-foot">
            <div class="price">$${car.rate}<small> / day</small></div>
            ${available
              ? `<a class="btn btn-sm" href="reserve.html?car=${car.id}">Reserve</a>`
              : `<button class="btn btn-sm" disabled>Unavailable</button>`}
          </div>
        </div>
      </article>`;
  }).join("");
}

function renderLocations() {
  const office = `<div class="card loc-card reveal"><h3>🏢 ${OFFICE.name}</h3><p>${OFFICE.address}</p><p>${OFFICE.hours}</p><p>Pick up your car here</p></div>`;
  const parks = CAR_PARKS.map(p => `<div class="card loc-card reveal"><h3>🅿️ ${p.name}</h3><p>${p.note}</p><p>Return your car here</p></div>`).join("");
  document.getElementById("locGrid").innerHTML = office + parks;
}

renderFleet();
renderLocations();
initReveal();   // re-run because cards were added after the first scan
