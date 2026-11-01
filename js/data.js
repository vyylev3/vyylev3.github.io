const CARS = [
  { id: "nissan-leaf",  name: "Nissan Leaf",      type: "Hatchback", seats: 5, range: 385, rate: 70,  img: "img/cars/nissan-leaf.jpg" },
  { id: "mg4",          name: "MG4 Electric",     type: "Hatchback", seats: 5, range: 450, rate: 65,  img: "img/cars/mg4.jpg" },
  { id: "byd-atto-3",   name: "BYD Atto 3",       type: "SUV",       seats: 5, range: 420, rate: 75,  img: "img/cars/byd-atto-3.jpg" },
  { id: "hyundai-ioniq-5", name: "Hyundai Ioniq 5 N", type: "Performance", seats: 5, range: 350, rate: 110, img: "img/cars/hyundai-ioniq-5.jpg" },
  { id: "kia-ev6",      name: "Kia EV6",          type: "Crossover", seats: 5, range: 500, rate: 105, img: "img/cars/kia-ev6.jpg" },
  { id: "tesla-model-3", name: "Tesla Model 3",   type: "Sedan",     seats: 5, range: 510, rate: 120, img: "img/cars/tesla-model-3.jpg" },
  { id: "bmw-i4",       name: "BMW i4",           type: "Sedan",     seats: 5, range: 520, rate: 140, img: "img/cars/bmw-i4.jpg" },
  { id: "vw-id-buzz",   name: "VW ID. Buzz",      type: "Van",       seats: 7, range: 420, rate: 150, img: "img/cars/vw-id-buzz.png" }
];

const CAR_PARKS = [
  { id: "cp-central", name: "Central Car Park – Level B1", note: "Next to the AZoom office" },
  { id: "cp-airport", name: "Airport Car Park – Zone C",   note: "Opposite arrivals hall" },
  { id: "cp-harbour", name: "Harbour Car Park – Bay 12",   note: "Near the waterfront terminal" }
];

const OFFICE = {
  name: "AZoom Car Rental Office",
  address: "12 Zoom Avenue, City Centre",
  hours: "Daily 8:00 am – 8:00 pm",
  phone: "+00 1234 5678"
};

/* Damage items the employee can tick during inspection */
const DAMAGE_ITEMS = [
  { id: "front-bumper", label: "Front bumper scratch / dent", fee: 80 },
  { id: "rear-bumper",  label: "Rear bumper scratch / dent",  fee: 150 },
  { id: "side-panel",   label: "Side panel / door scratch",   fee: 120 },
  { id: "windscreen",   label: "Windscreen chip or crack",    fee: 200 },
  { id: "wheel",        label: "Wheel / rim scuff",           fee: 90 },
  { id: "interior",     label: "Interior stain or damage",    fee: 100 },
  { id: "cable",        label: "Charging cable missing",      fee: 120 }
];

/* Pre-stored staff account */
const STAFF_ACCOUNT = {
  name: "AZoom Staff", email: "staff@azoom.com", password: "staff123", role: "staff"
};

/* The lifecycle of a booking, in order */
const BOOKING_STEPS = ["Reserved", "Rented", "Returned", "Inspected", "Completed"];
