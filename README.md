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
