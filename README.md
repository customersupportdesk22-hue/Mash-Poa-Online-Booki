# Mash Poa Online Booking

A dedicated Mash Poa coach-booking platform. Mash Poa branding and the forest-green / lime visual identity are maintained independently of other coach projects.

## Implemented platform modules

- Mash Poa customer homepage and route search.
- Admin-managed routes, fares, departures and seat capacity.
- Booking creation with passenger details, seat availability checks and unique booking references.
- Global payment settings controlled centrally by Mash Poa admin (Paybill, Till, phone or bank details; admin / automatic / STK workflow).
- Mash Poa customer live chat and agent console using Socket.IO.
- Agent payment-instruction messages based on global payment settings.
- Staff-confirmed STK status message (the agent must actually initiate the STK before pressing the button).
- Payment verification and ticket issue workflow.
- Optional Gemini AI assistant controlled by the admin and grounded in Mash Poa route, schedule and payment configuration.

## Hosting configuration

Set these environment variables in the Node hosting service:

- `MONGODB_URI` — MongoDB connection string. Required for persistent bookings, routes, schedules, payment settings and chat history.
- `MONGODB_DB` — database name; defaults to `mashpoa`.
- `AGENT_PASSWORD` — strong password for both `/admin.html` and `/agent.html`.
- `GEMINI_API_KEY` — optional; required only if enabling the AI assistant in Admin Settings.
- `PORT` is supplied by the hosting platform.

Install with `npm install`; start with `npm start`.

## Admin setup

1. Open `/admin.html` and sign in with `AGENT_PASSWORD`.
2. Save Mash Poa's official global payment details and choose the required payment workflow.
3. Add only verified Mash Poa routes and fares.
4. Add actual departures and the real seat capacity for each bus.
5. If Gemini is configured, enable and test the AI assistant using Mash Poa's verified rules.
6. Open `/agent.html` to answer customers, send payment details, record actual STK initiation, verify payment and issue tickets.

## Payment and ticket safety

- A customer booking is pending payment until verified.
- The system does not claim an STK Push was sent unless an authorized agent explicitly records that they initiated it.
- A ticket is issued only after an authorized agent confirms payment verification.
- Never request or store a customer's M-Pesa PIN.
- Do not enter another operator's payment details or route data. Mash Poa must use its own verified settings.

## Important launch requirements

The repository does not contain verified Mash Poa routes, fares, departure times, seat layouts, official payment details, MongoDB credentials or Gemini key. These must be configured before accepting live bookings. Without `MONGODB_URI`, the server can run in temporary in-memory mode, but records will not survive a restart. No live payment provider API or STK Push API has been connected in this build.
