-- The notes board (src/components/story/NotesBoard.tsx): anonymous sticky notes,
-- one per person, readable by everyone.
--
-- Run once in the Supabase project's SQL editor (or `supabase db push`).
--
-- How "one per person" is kept: a note can only be added through add_note(),
-- which records two fingerprints of its author in a table nobody can read --
-- a hash of the browser's own random id, and a hash of the request's IP -- and
-- refuses a second note from either. (A person on a new browser AND a new
-- network can post again; for an anonymous wall that is the honest limit.)
-- The notes themselves carry nothing about who wrote them.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(btrim(body)) between 1 and 140),
  color text not null default 'paper' check (color in ('paper', 'blush', 'sage', 'butter')),
  tilt real not null default 0 check (tilt between -6 and 6),
  -- where it is pinned on the board, as shares of its width and height
  x real check (x between 0 and 1),
  y real check (y between 0 and 1),
  created_at timestamptz not null default now()
);

create table if not exists public.note_authors (
  note_id uuid primary key references public.notes (id) on delete cascade,
  client_hash text not null unique,
  ip_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;
alter table public.note_authors enable row level security;

-- everyone may read the notes; nobody may write them directly
drop policy if exists "notes are public" on public.notes;
create policy "notes are public" on public.notes for select to anon, authenticated using (true);
-- note_authors: no policies at all -- not readable or writable through the API

create index if not exists notes_created_at_idx on public.notes (created_at desc);

-- a short list of words that keep a note off the board (lower-case, matched as words)
create or replace function public.note_is_clean(p_body text)
returns boolean
language sql
immutable
as $$
  select not (lower(p_body) ~ '\m(fuck|shit|bitch|cunt|nigg\w*|fag\w*|retard\w*|whore|slut|rape\w*|kys)\M')
     and not (p_body ~* '(https?://|www\.)');
$$;

create or replace function public.add_note(p_body text, p_color text, p_client text, p_x real default null, p_y real default null)
returns public.notes
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_ip text := coalesce(
    nullif(split_part(v_headers ->> 'x-forwarded-for', ',', 1), ''),
    v_headers ->> 'cf-connecting-ip',
    'unknown'
  );
  v_salt text := 'yug-portfolio-notes';
  v_ip_hash text := encode(digest(v_salt || btrim(v_ip), 'sha256'), 'hex');
  v_client_hash text := encode(digest(v_salt || coalesce(p_client, ''), 'sha256'), 'hex');
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  v_note public.notes;
begin
  if char_length(coalesce(p_client, '')) < 16 then
    raise exception 'bad_client' using errcode = 'P0001';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 140 then
    raise exception 'bad_length' using errcode = 'P0001';
  end if;
  if not public.note_is_clean(v_body) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.note_authors where client_hash = v_client_hash or ip_hash = v_ip_hash) then
    raise exception 'already_posted' using errcode = 'P0001';
  end if;

  insert into public.notes (body, color, tilt, x, y)
  values (
    v_body,
    case when p_color in ('paper', 'blush', 'sage', 'butter') then p_color else 'paper' end,
    round(((random() * 7) - 3.5)::numeric, 2),
    least(greatest(coalesce(p_x, 0.5), 0), 1),
    least(greatest(coalesce(p_y, 0.5), 0), 1)
  )
  returning * into v_note;

  insert into public.note_authors (note_id, client_hash, ip_hash)
  values (v_note.id, v_client_hash, v_ip_hash);

  return v_note;
end;
$$;

revoke all on function public.add_note(text, text, text, real, real) from public;
grant execute on function public.add_note(text, text, text, real, real) to anon, authenticated;
revoke all on function public.note_is_clean(text) from public;
