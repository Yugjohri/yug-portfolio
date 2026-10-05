-- Notes moderation: a note can be taken off the board without deleting it.
--
-- To hide a note (Supabase SQL editor):
--   update public.notes set hidden = true where id = '<note id>';
-- and `hidden = false` to put it back. Its author still cannot post another.

alter table public.notes add column if not exists hidden boolean not null default false;

-- the public may read only the notes that are not hidden
drop policy if exists "notes are public" on public.notes;
create policy "notes are public" on public.notes for select to anon, authenticated using (not hidden);

-- add_note, as before, with one change: two posts from the same person landing
-- at the same moment could both pass the "already posted" check, and the
-- second then failed on the unique fingerprints with a raw database error.
-- It now gets the same 'already_posted' answer as any second note.
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

  begin
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
  exception when unique_violation then
    -- (the block's insert of the note is undone with it)
    raise exception 'already_posted' using errcode = 'P0001';
  end;

  return v_note;
end;
$$;

revoke all on function public.add_note(text, text, text, real, real) from public;
grant execute on function public.add_note(text, text, text, real, real) to anon, authenticated;
