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
