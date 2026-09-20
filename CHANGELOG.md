# Changelog

## V2.1.0 — Workflow + Calendar Rebuild

### Lead / Customer
- Lead can start with only WhatsApp display name; real name and phone are optional.
- Lead conversion preserves WhatsApp identity and does not invent a real name when it is unknown.
- Customer cards/profile use a safe display fallback: real name → WhatsApp name → phone.
- Clear Book Appointment vs Start Service explanation in Customer Profile.

### Calendar / Appointment
- Rebuilt Calendar with Month / Week / Day / Agenda / Map.
- Click empty date/time to create a booking.
- Click booking to open details.
- Separate Date + Start Time fields for easy rescheduling.
- Desktop drag/drop to reschedule Month / Week / Day bookings.
- Booking details use an Asana-style right-side pane on desktop and bottom sheet on mobile.
- Month/Week consistently start Monday.
- Team filter, Today navigation and date jump retained.
- In-progress appointments stay blocked by database overlap protection.

### Service
- Service is now explicitly actual work, not another booking form.
- Booked appointment → Start Service → In Progress → Complete.
- Walk-in Service automatically creates a Calendar appointment first.
- Completion updates Calendar appointment to Completed.
- Completion records service history, payment, consumable deductions and next maintenance.
- Completion screen offers Customer / Before-After / Book next visit.
- Added Follow-up tab for due maintenance.

### Before / After
- Functional upload flow with Customer + Service association.
- Before / Process / After types.
- Consent: private / public blur / public.
- Gallery, Compare, signed private images, delete, mobile camera capture.

### Payments
- All / Outstanding / Paid / Refund filters.
- Search by customer/method/reference.
- One-tap Mark Paid for outstanding payments.

### UI / Mobile
- Reworked visual hierarchy, spacing, typography, forms, cards and tactile buttons.
- Desktop sidebar retained; mobile bottom nav reduced to 5 primary actions.
- Mobile forms and booking details become bottom-sheet style.
- Calendar defaults to Day on smaller screens; Month/Week remain available.

## V2.0.3
- Fixed Google Places Autocomplete 400 error caused by invalid location-bias radius.
- JB location bias set to 35 km.

## V2.0.1
- Fixed PostgreSQL 42P17 appointment exclusion constraint by materializing blocked_start / blocked_end.
