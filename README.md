# ChessZuR ♟️

A lightweight Vietnamese chess website where you play against the ChessZuR bot.

## Features
- Play against the AI bot: you play White, bot plays Black
- Three bot difficulty levels: Easy, Medium and Hard
- Bot uses minimax search with alpha-beta pruning for Medium and Hard
- Interactive chessboard with legal move validation
- Check, checkmate, draw and stalemate detection
- Castling, en passant and pawn promotion
- Move history, undo, new game and board flip
- Copy current position as FEN
- Responsive dark interface in Vietnamese

## Project structure
- `index.html` — page structure
- `styles.css` — layout and visual styles
- `script.js` — chessboard and bot logic
- `assets/logo.svg` — circular ChessZuR logo
- `assets/icons/` — SVG icons used by action buttons
- `supabase/` — Supabase project config and private AI Edge Function

See [`supabase/README.md`](supabase/README.md) for project creation and deployment steps.

## Run locally
Open `index.html` in a modern browser with internet access (the chess rules library loads from jsDelivr).

## Publish with GitHub Pages
1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/ (root)`, then save.
4. After deployment, your site will be available at the GitHub Pages URL shown there.

ChessZuR is a static website; no backend or account is required to play.
