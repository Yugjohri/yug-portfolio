-- A name on a note: signed in its bottom corner after a "-" -- a name, a
-- nickname, initials, anything (or nothing). Up to 24 characters, the same
-- word filter as the note itself.

alter table public.notes add column if not exists name text check (name is null or char_length(name) between 1 and 24);

-- add_note gains the name (last, optional). The old five-argument version is
-- dropped first so the API is never unsure which one is meant.
drop function if exists public.add_note(text, text, text, real, real);

create or replace function public.add_note(p_body text, p_color text, p_client text, p_x real default null, p_y real default null, p_name text default null)
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
  v_name text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  v_note public.notes;
begin
  if char_length(coalesce(p_client, '')) < 16 then
    raise exception 'bad_client' using errcode = 'P0001';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 140 then
    raise exception 'bad_length' using errcode = 'P0001';
  end if;
  if v_name is not null and char_length(v_name) > 24 then
    raise exception 'bad_length' using errcode = 'P0001';
  end if;
  if not public.note_is_clean(v_body) or (v_name is not null and not public.note_is_clean(v_name)) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.note_authors where client_hash = v_client_hash or ip_hash = v_ip_hash) then
    raise exception 'already_posted' using errcode = 'P0001';
  end if;

  begin
    insert into public.notes (body, color, tilt, x, y, name)
    values (
      v_body,
      case when p_color in ('paper', 'blush', 'sage', 'butter') then p_color else 'paper' end,
      round(((random() * 7) - 3.5)::numeric, 2),
      least(greatest(coalesce(p_x, 0.5), 0), 1),
      least(greatest(coalesce(p_y, 0.5), 0), 1),
      v_name
    )
    returning * into v_note;

    insert into public.note_authors (note_id, client_hash, ip_hash)
    values (v_note.id, v_client_hash, v_ip_hash);
  exception when unique_violation then
    raise exception 'already_posted' using errcode = 'P0001';
  end;

  return v_note;
end;
$$;

revoke all on function public.add_note(text, text, text, real, real, text) from public;
grant execute on function public.add_note(text, text, text, real, real, text) to anon, authenticated;
