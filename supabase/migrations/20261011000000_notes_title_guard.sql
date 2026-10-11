-- The board's title ("Leave a note :)" and its underline) kept clear as well:
-- no note may be pinned or moved over it. Its letters stand in 1023-1777 x
-- 867-1111 of the board (2800 x 2000, tilt and all); the box below is drawn
-- in 22px all round, so a note may just catch the edge of a letter but never
-- cover a word -- the same box the board itself keeps clear (NotesBoard.tsx).
-- A note is taken as 190 x 180, as before. add_note and move_my_note already
-- ask this function, so only it changes.

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
    -- the title
    (p_x < 0.6268 and p_x + 0.0679 > 0.3732 and p_y < 0.5445 and p_y + 0.0900 > 0.4445)
  );
$$;

revoke all on function public.note_spot_free(real, real) from public;
