-- Yug's own note and Dexter stay in view: no note may be pinned or moved over
-- either. Their boxes on the board, as shares of its width and height
-- (2800 x 2000), from NotesBoard.tsx: the "now" note at (1078, 580), 200 x 202,
-- and Dexter at (1036, 1170), 236 x 245. A note is taken as 190 x 180 -- a
-- little smaller than any real one, so a place the board itself has cleared
-- (it keeps 14px of air round them) is never refused here.

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
  );
$$;

-- add_note, as before, refusing a place over either of them
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
  v_x real := least(greatest(coalesce(p_x, 0.5), 0), 1);
  v_y real := least(greatest(coalesce(p_y, 0.5), 0), 1);
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
  if not public.note_spot_free(v_x, v_y) then
    raise exception 'blocked_spot' using errcode = 'P0001';
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
      v_x,
      v_y,
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

-- move_my_note, as before, refusing a place over either of them
create or replace function public.move_my_note(p_client text, p_x real, p_y real)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_client_hash text := encode(digest('yug-portfolio-notes' || coalesce(p_client, ''), 'sha256'), 'hex');
  v_x real := least(greatest(coalesce(p_x, 0.5), 0), 1);
  v_y real := least(greatest(coalesce(p_y, 0.5), 0), 1);
begin
  if char_length(coalesce(p_client, '')) < 16 then
    raise exception 'bad_client' using errcode = 'P0001';
  end if;
  if not public.note_spot_free(v_x, v_y) then
    raise exception 'blocked_spot' using errcode = 'P0001';
  end if;
  update public.notes set x = v_x, y = v_y
   where id = (select note_id from public.note_authors where client_hash = v_client_hash);
  if not found then
    raise exception 'not_yours' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.note_spot_free(real, real) from public;
revoke all on function public.add_note(text, text, text, real, real, text) from public;
revoke all on function public.move_my_note(text, real, real) from public;
grant execute on function public.add_note(text, text, text, real, real, text) to anon, authenticated;
grant execute on function public.move_my_note(text, real, real) to anon, authenticated;
