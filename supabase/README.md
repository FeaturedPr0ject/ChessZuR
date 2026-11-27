# ChessZuR — Supabase cloud history

ChessZuR uses Supabase Auth anonymous sessions and a private per-user game-history table. The browser uses only the project's publishable key; never put a secret or service_role key in GitHub Pages.

## One-time setup

1. In Supabase Dashboard, open Authentication settings and enable **Allow anonymous sign-ins**.
2. Open SQL Editor and run the complete SQL in [schema.sql](schema.sql).
3. Confirm the Data API exposes `public.chess_games` if the project uses restricted Data API exposure.
4. Reload the GitHub Pages site. The browser will create an anonymous account and sync completed games.

Anonymous sessions are tied to the current browser storage. Clearing site data or switching devices creates a different anonymous user; link a permanent sign-in provider later if cross-device identity is required.

## Local fallback

Theme, piece style, sound, vibration, and up to 50 completed games are also saved in browser local storage. The app continues to work locally if Supabase is unavailable.
