const $ = (selector) => document.querySelector(selector);
const dateInput = $("#travel-date");
const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
dateInput.min = localToday;
dateInput.value = localToday;
$("#year").textContent = new Date().getFullYear();

$("#swap-route").addEventListener("click", () => {
  const from = $("#origin");
  const to = $("#destination");
  [from.value, to.value] = [to.value, from.value];
});

$("#route-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = $("#form-feedback");
  const from = $("#origin").value.trim();
  const to = $("#destination").value.trim();
  if (from.toLowerCase() === to.toLowerCase()) {
    feedback.textContent = "Choose two different locations for your journey.";
    return;
  }
  feedback.textContent = "Checking the booking service…";
  try {
    const response = await fetch("/api/booking-config");
    const config = await response.json();
    if (!config.configured) {
      feedback.textContent = "Online schedules are being connected. We cannot show live buses, fares or seat availability until verified operator data is added.";
      return;
    }
    feedback.textContent = "Booking service is ready. The live schedule search will appear here.";
  } catch (_error) {
    feedback.textContent = "We could not reach the booking service. Please try again later.";
  }
});

const panel = $("#chat-panel");
const backdrop = $("#chat-backdrop");
function openSupport() {
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  backdrop.hidden = false;
}
function closeSupport() {
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
}
$("#open-help").addEventListener("click", openSupport);
$("#close-chat").addEventListener("click", closeSupport);
backdrop.addEventListener("click", closeSupport);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSupport();
});
