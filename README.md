# VillaTrack

Landing page for VillaTrack, owner-side construction control for villa builds in Bali.
Pay your contractor only for verified work.

- `index.html`: the whole site (English and Bahasa Indonesia).
- `pilot/`: the pilot app as a public demo with example data. Each visitor's changes are saved only in their own browser.
- `supabase/landing-waitlist.sql`: creates the `waitlist` table for early-access sign-ups.

## Hosting
Served by GitHub Pages from the `main` branch root.

## Live pilot app (`app/`)
The working app, with email sign-in and shared project data in Supabase.

1. Supabase > SQL Editor: open `supabase/pilot-schema.sql`, change `CHANGE_ME@example.com` to the admin's email, run it.
2. Run `supabase/pilot-roles.sql` so each role only sees and changes what it should (admin: everything).
3. Run `supabase/pilot-signup.sql` (password sign-up with a chosen role, confirmed by the admin).
4. Run `supabase/pilot-seed.sql` to load the starting plan (7 payment milestones, schedule, budget breakdown, equipment list).
5. Supabase > Authentication > URL Configuration: set Site URL to `https://bitterzee.github.io/villatrack-site/app/` and add it to Redirect URLs.
6. Put the project URL and anon key in `app/config.js`.
7. Create your account with the admin email, set up the project. Others create an account and pick a role; approve them under Admin > People > Join requests.
