# Changelog

## V2.0.3
- Fixed Google Places Autocomplete 400 error caused by an invalid 70 km location-bias radius.
- JB location bias is now 35 km, within Google's 50 km maximum.
- No database/schema changes.

# V2.0.0 — SVR-style rebuild
- Rebuilt as React + Vite app instead of one giant local HTML file.
- Normalized Supabase tables instead of one cloud blob.
- Separate authenticated Yong / Ah Bi admin profiles.
- Google Places Autocomplete (new widget) with Malaysia restriction and JB bias.
- Customer saved place data: formatted address, place name, Google place ID, lat/lng.
- Appointment Calendar / Agenda / Map views.
- Database-level no-overlap appointment rule including travel buffers.
- Hair system inventory + consumable movement flow.
- Atomic service completion with consumable deduction and payment creation.
- Private Supabase Storage media bucket.
- Database-triggered activity log.
- Staged RLS: PREP for testing, FINAL lockdown after validation.
- Desktop sidebar + mobile bottom navigation.

## V2.0 GitHub Edition
- Replaced Hostinger deployment instructions with GitHub Pages development deployment.
- Added GitHub Actions auto-build + deploy workflow.
- Added repository secrets setup guide.
- Kept relative Vite base (`./`) for repository-subpath deployment and easier future migration.
- Added local production build test batch file.


## v2.0.1
- Fixed Supabase/PostgreSQL `42P17 functions in index expression must be marked IMMUTABLE` when creating `appointment_no_overlap`.
- Appointment overlap protection now uses trigger-maintained `blocked_start` / `blocked_end` columns and a GiST exclusion constraint.
- Setup SQL is safe to rerun after the previous partial failure.
