const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Mash Poa Online Booking", mode: "setup" });
});

// Intentionally no invented routes, fares, seat inventory or payment credentials.
// Connect verified operator data and the authorized booking/payment services here.
app.get("/api/booking-config", (_req, res) => {
  res.json({
    configured: false,
    message: "Booking schedules, fares, seat inventory and payment services are not configured yet."
  });
});

// Payment initiation is deliberately disabled until a verified M-PESA provider
// and an authorized admin approval workflow are connected.
app.post("/api/payments/initiate", (_req, res) => {
  res.status(503).json({
    ok: false,
    code: "PAYMENTS_NOT_CONFIGURED",
    message: "M-PESA payments are not enabled. No STK Push has been sent."
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, message: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
  console.log(`Mash Poa Online Booking listening on port ${PORT}`);
});
