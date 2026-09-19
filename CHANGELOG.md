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
