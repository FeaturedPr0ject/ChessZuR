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

## Gemini chess review (secure server-side setup)

The browser does **not** store or send the Gemini API key. The review UI calls the authenticated `chess-review` Edge Function; the function reads `GEMINI_API_KEY` from Supabase Secrets and calls Gemini server-side.

### One-time setup

1. Open the existing project: https://supabase.com/dashboard/project/rbdlfzoqwuchkjbgzmjb
2. Open **Edge Functions → Secrets** and add:
   - Name: `GEMINI_API_KEY`
   - Value: your existing Gemini API key
3. Deploy `supabase/functions/chess-review/index.ts` as an Edge Function named `chess-review`.
4. Keep JWT verification enabled. `supabase/config.toml` sets `verify_jwt = true` for this function. The website signs in anonymously and invokes it with the user's Supabase session.

If deploying with the Supabase CLI from the repository root:

```bash
supabase login
supabase link --project-ref rbdlfzoqwuchkjbgzmjb
supabase functions deploy chess-review
```

Set the secret in the Dashboard before testing. Supabase Secrets are read by Edge Functions at runtime; the function does not need the key in GitHub or in the browser.

The function accepts only authenticated Supabase sessions, checks the GitHub Pages origin, limits the input size, and applies a short per-session cooldown. Gemini's result is an AI coaching hint, not a chess-engine-certified evaluation.

**Important:** the Supabase publishable key already used by the website is not a Gemini API key. Do not put a Supabase secret/service-role key in the browser or commit either provider's secret to GitHub.
