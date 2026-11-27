create table if not exists public.chess_games (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  result text not null,
  pgn text not null default '',
  fen text not null,
  moves jsonb not null default '[]'::jsonb,
  white_ms integer not null default 0,
  black_ms integer not null default 0,
  clock_seconds integer not null default 300,
  increment_seconds integer not null default 0,
  played_at timestamptz not null default now()
);

alter table public.chess_games enable row level security;
revoke all on table public.chess_games from anon;
grant select, insert, update, delete on table public.chess_games to authenticated;

create policy "Players can read their own chess games"
on public.chess_games for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Players can insert their own chess games"
on public.chess_games for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Players can update their own chess games"
on public.chess_games for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Players can delete their own chess games"
on public.chess_games for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists chess_games_user_played_at_idx
on public.chess_games (user_id, played_at desc);
