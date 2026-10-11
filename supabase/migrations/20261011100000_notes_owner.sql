-- 1. The board's title ("Leave a note :)" and its underline) with a little
--    air round it: no note may be pinned or moved onto it or right against
--    it. Its letters stand in 1023-1777 x 867-1111 of the board (2800 x 2000,
--    tilt and all); the box below is that plus 20px all round -- the same box
--    the board itself keeps clear (NotesBoard.tsx). This replaces the
--    tighter title box of ..._notes_title_guard.sql. A note is taken as
--    190 x 180, as before.
-- 2. The owner may move anyone's note: owner_move_note, with the owner's key.
--    Only the key's SHA-256 is kept here (note_owner); the key itself stays in
--    the owner's browser. Nobody else can read the table or do without it.

create or replace function public.note_spot_free(p_x real, p_y real)
returns boolean
language sql
immutable
as $$
  select not (
    -- Yug's note
    (p_x < 0.4564 and p_x + 0.0679 > 0.3850 and p_y < 0.3910 and p_y + 0.0900 > 0.2900)
    or
    -- Dexter
    (p_x < 0.4543 and p_x + 0.0679 > 0.3700 and p_y < 0.7075 and p_y + 0.0900 > 0.5850)
    or
    -- the title, with its air
    (p_x < 0.6421 and p_x + 0.0679 > 0.3579 and p_y < 0.5655 and p_y + 0.0900 > 0.4235)
  );
$$;
revoke all on function public.note_spot_free(real, real) from public;

-- the owner's key, as its SHA-256 in hex (added by hand, once: see the note at the end)
create table if not exists public.note_owner (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$')
);
alter table public.note_owner enable row level security;
-- (no policies: nobody reads or writes it through the API)
revoke all on public.note_owner from anon, authenticated;

-- is this the owner's key?
create or replace function public.owner_check(p_key text)
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select char_length(coalesce(p_key, '')) >= 32
     and exists (select 1 from public.note_owner where key_hash = encode(digest(p_key, 'sha256'), 'hex'));
$$;

-- move any note, with the owner's key; still never over Yug's note, Dexter or the title
create or replace function public.owner_move_note(p_key text, p_id uuid, p_x real, p_y real)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_x real := least(greatest(coalesce(p_x, 0.5), 0), 1);
  v_y real := least(greatest(coalesce(p_y, 0.5), 0), 1);
begin
  if not public.owner_check(p_key) then
    raise exception 'not_owner' using errcode = 'P0001';
  end if;
  if not public.note_spot_free(v_x, v_y) then
    raise exception 'blocked_spot' using errcode = 'P0001';
  end if;
  update public.notes set x = v_x, y = v_y where id = p_id;
  if not found then
    raise exception 'no_note' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.owner_check(text) from public;
revoke all on function public.owner_move_note(text, uuid, real, real) from public;
grant execute on function public.owner_check(text) to anon, authenticated;
grant execute on function public.owner_move_note(text, uuid, real, real) to anon, authenticated;

-- To become the owner, run once (with your key's SHA-256, never the key itself):
--   insert into public.note_owner (key_hash) values ('<64 hex characters>');
