# VillaTrack

Landing page for VillaTrack, owner-side construction control for villa builds in Bali.
Pay your contractor only for verified work.

- `index.html`: the whole site (English and Bahasa Indonesia).
- `pilot/`: the pilot app as a public demo with example data. Each visitor's changes are saved only in their own browser.
- `supabase-waitlist.sql`: creates the `waitlist` table for sign-ups. Run it once in the Supabase SQL Editor.

## Turn on sign-ups
In `index.html`, replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your project's URL and anon public key
(Supabase > Project Settings > API). Never put the `service_role` key here.

## Hosting
Served by GitHub Pages from the `main` branch root.

## Live pilot app (`app/`)
The working app, with email sign-in and shared project data in Supabase.

1. Supabase > SQL Editor: open `supabase/pilot-schema.sql`, change `CHANGE_ME@example.com` to the admin's email, run it.
2. Run `supabase/pilot-seed.sql` to load the starting plan (7 payment milestones, schedule, budget breakdown, equipment list).
3. Supabase > Authentication > URL Configuration: set Site URL to `https://bitterzee.github.io/villatrack-site/app/` and add it to Redirect URLs.
4. Put the project URL and anon key in `app/config.js`.
5. Sign in as the admin, set up the project, then add people: they sign in once, then the admin gives them a role (owner, contractor or inspector) under People.
