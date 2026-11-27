# ChessZuR Supabase setup

This folder contains the Supabase Edge Function that connects ChessZuR to a private AI API.

## 1. Create a Supabase project

Use the same setup flow from the earlier Supabase setup:
1. Open https://supabase.com/dashboard.
2. Create or select an Organization.
3. Choose the Free plan.
4. Select **New project**.
5. For this project, use the name **ChessZuR** and choose **Singapore** as the region.
6. Set and save the database password somewhere safe.

Create a separate ChessZuR project; do not put this prototype into the older SWGC Chat project.

## 2. Install and link Supabase CLI

Install the Supabase CLI using the official instructions:
https://supabase.com/docs/guides/cli

From the repository root, run:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

The project ref is shown in the Supabase Dashboard project URL or Project Settings.

## 3. Add private AI provider secrets

The Edge Function expects an OpenAI-compatible Chat Completions API.

```bash
supabase secrets set AI_API_URL=https://YOUR_PROVIDER/v1/chat/completions
supabase secrets set AI_API_KEY=YOUR_PRIVATE_API_KEY
supabase secrets set AI_MODEL=YOUR_MODEL_NAME
```

Never put the private AI API key in `index.html`, `script.js`, GitHub Pages, or any public file.

## 4. Deploy the function

```bash
supabase functions deploy chess-ai --no-verify-jwt
```

Function URL:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/chess-ai
```

## 5. Request format

Send a POST request with the current FEN, SAN move history, and legal SAN moves:

```json
{
  "fen": "current FEN",
  "history": ["e4", "e5"],
  "legalMoves": ["Nf3", "Bc4", "Qh5"]
}
```

The function returns one selected move:

```json
{ "move": "Nf3" }
```

The move must exactly match one of the legal moves supplied by the frontend. The frontend integration and provider selection are intentionally left for the next step; this scaffold does not expose API secrets.
