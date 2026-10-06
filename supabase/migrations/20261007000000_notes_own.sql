-- Your own note: move it, or take it down. Ownership is the same fingerprint
-- that keeps it to one note per person -- the hash of the browser's own random
-- id (note_authors.client_hash) -- so only the browser that wrote a note can
-- touch it. Nobody else's note can be reached through these.

-- move it: a new place on the board, as shares of its width and height
create or replace function public.move_my_note(p_client text, p_x real, p_y real)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_client_hash text := encode(digest('yug-portfolio-notes' || coalesce(p_client, ''), 'sha256'), 'hex');
begin
  if char_length(coalesce(p_client, '')) < 16 then
    raise exception 'bad_client' using errcode = 'P0001';
  end if;
  update public.notes
     set x = least(greatest(coalesce(p_x, 0.5), 0), 1),
         y = least(greatest(coalesce(p_y, 0.5), 0), 1)
   where id = (select note_id from public.note_authors where client_hash = v_client_hash);
  if not found then
    raise exception 'not_yours' using errcode = 'P0001';
  end if;
end;
$$;

-- take it down: the note goes, and with it (on delete cascade) its fingerprint,
-- so its writer may pin a new one
create or replace function public.delete_my_note(p_client text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_client_hash text := encode(digest('yug-portfolio-notes' || coalesce(p_client, ''), 'sha256'), 'hex');
begin
  if char_length(coalesce(p_client, '')) < 16 then
    raise exception 'bad_client' using errcode = 'P0001';
  end if;
  delete from public.notes
   where id = (select note_id from public.note_authors where client_hash = v_client_hash);
  if not found then
    raise exception 'not_yours' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.move_my_note(text, real, real) from public;
revoke all on function public.delete_my_note(text) from public;
grant execute on function public.move_my_note(text, real, real) to anon, authenticated;
grant execute on function public.delete_my_note(text) to anon, authenticated;
