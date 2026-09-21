# V2.3.3 — Mobile Overlay & UX Reliability

- Render Modal / Drawer through a React portal so dialogs are positioned against the real viewport, not animated page containers.
- Rebuilt mobile long-form behavior with dynamic viewport height (`dvh`) and reliable internal scrolling.
- Removed sticky action bars that could cover the last fields/buttons on phones.
- Mobile page headers stack cleanly and primary actions become full-width on narrow screens.
- Removed automatic keyboard pop-up on New Lead for a calmer mobile opening experience.
- Fixed switching Free Home Consultation → Studio Consultation leaving home/travel-buffer settings behind.
- Fixed Customer Profile appointment actions so consultation bookings open Consultation flow, while technical bookings open Service flow.
- Modal/Drawer z-index and overflow isolation hardened.
- No database migration required.

# V2.3.1
- Fix desktop notification popover clipping.
- Add clear notifications.
- Add testing-friendly delete controls for bookings, clients and payments.
- Improve lead delete cleanup.

# Changelog

## V2.3.0 — Hair System Core Workflow

### Business logic
- Lead stays a lead until consultation is signed.
- Consultation is separated from technical Service.
- Consultation outcome: Signed / Follow up / Not signed.
- Signed outcome creates a Client + Deal.
- Deal records Hair System specs, source, price, discount, deposit and balance.
- Ready stock can be reserved at signing.
- New System Installation activates the client and installs the reserved system.
- Maintenance cycle only applies to Active Clients.

### Calendar
- Consultation bookings can belong to Leads before a Client record exists.
- Consultation events use Start / Continue Consultation.
- Technical service events use Start / Continue Service.
- Month / Week / Day / Agenda / Map remain available.

### Staff operations
- Dashboard now shows My Jobs for the logged-in admin/staff member.
- Appointment assignment creates in-app notifications.
- Rescheduling an assigned job creates an in-app notification.
- Bell notification center added on desktop and mobile.

### Customer profile
- Signed Client and Active Client are visually different.
- Signed Client prioritizes Book Installation.
- Active Client prioritizes Maintenance / technical service.
- Signed Deal summary added.

### Next phases
- V2.4: real Customer Login + self-booking + available slots + loyalty points.
- V2.5: WhatsApp Cloud API + Email automation + appointment reminders + notification delivery logs.

## V2.3.4 — Leads CRM + In-progress Status
- Rebuilt Leads as a clickable CRM list + detail drawer.
- Added Next Follow-up, Last Contacted, follow-up logging and follow-up history.
- Fixed Lead Save flow with an explicit database-safe payload.
- Added Open / Due / Consultation booked / Signed lead KPIs and filters.
- Added safe Return to booked / Cancel controls for in-progress consultation and service workflows.
- Completed work remains protected from unsafe status rollback.
- Fixed service-to-appointment lookup so the latest service record wins.
