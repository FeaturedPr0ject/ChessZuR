# ChessZuR — Supabase + Gemini

This folder contains the Supabase Edge Function used by the GitHub Pages frontend to request a chess move from Gemini. The Gemini API key stays on the server in Supabase Secrets.

## Supabase project

- Project ref: `rbdlfzoqwuchkjbgzmjb`
- Project URL: `https://rbdlfzoqwuchkjbgzmjb.supabase.co`
- Region: Singapore

## Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create a Gemini API key.
3. In Supabase Dashboard, open **Edge Functions → Secrets**.
4. Add:
   - `GEMINI_API_KEY` = your private Gemini API key
   - `GEMINI_MODEL` = `gemini-3.8-flash` (optional; can be changed to a model enabled for your API key)

Never commit the Gemini key to GitHub or put it in `index.html` / `script.js`.

## Deploy

From the repository root, install and authenticate the Supabase CLI, then run:

```bash
supabase login
supabase link --project-ref rbdlfzoqwuchkjbgzmjb
supabase functions deploy chess-ai
```

The function is configured with `verify_jwt = false` because the static GitHub Pages app uses a publishable key rather than a user JWT. The function checks the supplied `apikey` against the project's configured publishable key and restricts browser origins to the ChessZuR GitHub Pages site. A publishable key is public by design; this is not a substitute for rate limiting or abuse controls.

Function URL:

```
https://rbdlfzoqwuchkjbgzmjb.supabase.co/functions/v1/chess-ai
```

## Request

```json
{
  "fen": "current FEN",
  "history": ["e4", "e5"],
  "legalMoves": ["Nf3", "Bc4", "Qh5"]
}
```

Response:

```json
{ "move": "Nf3", "model": "gemini-3.8-flash" }
```

The frontend must validate the returned SAN move with chess.js before applying it. Gemini is a language model, not a dedicated chess engine, so invalid responses should fall back to the local bot.
