# Mash Poa Online Booking

A dedicated Mash Poa coach-booking platform.

## Customer booking journey
1. Search route and travel date.
2. Compare available buses, departure times, fares and amenities.
3. Select seats from the seat map.
4. Enter passenger details and review the booking.
5. Choose M-PESA and press **Pay KES** to continue in the live-chat booking assistant with the booking reference and summary.
6. Admin initiates and records payment; verify payment before issuing a ticket.

## Payment safety
Never tell a customer that an M-PESA STK Push was sent unless an authorized admin action actually initiated it. Never issue a ticket before payment verification.

## Project status
Repository scaffold. Real routes, schedules, fares, seat inventory, payment credentials and live-chat provider configuration must be supplied/configured before live bookings and payments can operate.

## Architecture
Keep Mash Poa branding and booking records separate. Reuse compatible patterns from the established ENA Coach / Easy Coach booking architecture.
