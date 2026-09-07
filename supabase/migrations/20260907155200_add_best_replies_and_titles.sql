-- Best replies and title catalog. This migration is additive and safe to re-run.

create table if not exists public.haiku_best_replies (
  haiku_id bigint primary key references public.haikus_2(id) on delete cascade,
  reply_id bigint not null unique references public.replies_2(id) on delete cascade,
  selected_by uuid not null references auth.users(id) on delete cascade,
  selected_at timestamptz not null default now()
);

alter table public.haiku_best_replies enable row level security;

drop policy if exists "best replies are publicly readable" on public.haiku_best_replies;
create policy "best replies are publicly readable"
on public.haiku_best_replies for select
using (true);

revoke all on table public.haiku_best_replies from public, anon, authenticated;
grant select on table public.haiku_best_replies to anon, authenticated;

create or replace function public.toggle_best_reply(
  p_haiku_id bigint,
  p_reply_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_reply_user_id uuid;
  v_current_reply_id bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.haikus_2
    where id = p_haiku_id and user_id = v_user_id
  ) then
    raise exception 'only the haiku author can select a best reply';
  end if;

  select user_id into v_reply_user_id
  from public.replies_2
  where id = p_reply_id and haiku_id = p_haiku_id;

  if v_reply_user_id is null then
    raise exception 'reply not found';
  end if;

  if v_reply_user_id = v_user_id then
    raise exception 'your own reply cannot be selected';
  end if;

  select reply_id into v_current_reply_id
  from public.haiku_best_replies
  where haiku_id = p_haiku_id;

  if v_current_reply_id = p_reply_id then
    delete from public.haiku_best_replies where haiku_id = p_haiku_id;
    return null;
  end if;

  insert into public.haiku_best_replies (haiku_id, reply_id, selected_by)
  values (p_haiku_id, p_reply_id, v_user_id)
  on conflict (haiku_id) do update
    set reply_id = excluded.reply_id,
        selected_by = excluded.selected_by,
        selected_at = now();

  return p_reply_id;
end;
$$;

revoke all on function public.toggle_best_reply(bigint, bigint) from public, anon;
grant execute on function public.toggle_best_reply(bigint, bigint) to authenticated;

create table if not exists public.title_catalog (
  id text primary key,
  name text not null,
  description text not null,
  requirement_key text not null,
  requirement_value integer not null check (requirement_value >= 0),
  display_order integer not null default 0,
  is_public boolean not null default true
);

create table if not exists public.user_titles (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null references public.title_catalog(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

create table if not exists public.user_equipped_titles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  title_id text not null,
  equipped_at timestamptz not null default now(),
  foreign key (user_id, title_id)
    references public.user_titles(user_id, title_id) on delete cascade
);

alter table public.title_catalog enable row level security;
alter table public.user_titles enable row level security;
alter table public.user_equipped_titles enable row level security;

drop policy if exists "public titles are readable" on public.title_catalog;
create policy "public titles are readable" on public.title_catalog
for select using (is_public);
drop policy if exists "earned titles are readable" on public.user_titles;
create policy "earned titles are readable" on public.user_titles
for select using (true);
drop policy if exists "equipped titles are readable" on public.user_equipped_titles;
create policy "equipped titles are readable" on public.user_equipped_titles
for select using (true);

revoke all on table public.title_catalog, public.user_titles, public.user_equipped_titles
from public, anon, authenticated;
grant select on table public.title_catalog, public.user_titles, public.user_equipped_titles
to anon, authenticated;

insert into public.title_catalog
  (id, name, description, requirement_key, requirement_value, display_order)
values
  ('first_verse', '初筆', 'はじめて一句を投稿した証', 'haiku_count', 1, 10),
  ('ten_verses', '十葉', '十句を投稿した証', 'haiku_count', 10, 20),
  ('ten_graces', '雅集め', '十の雅を受けた証', 'received_like_count', 10, 30),
  ('utaawase_debut', '歌合初陣', '歌合へ参加した証', 'utaawase_count', 1, 40)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  requirement_key = excluded.requirement_key,
  requirement_value = excluded.requirement_value,
  display_order = excluded.display_order;

create or replace function public.refresh_my_titles()
returns setof text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required'; end if;

  insert into public.user_titles (user_id, title_id)
  select v_user_id, catalog.id
  from public.title_catalog catalog
  where catalog.is_public
    and case catalog.requirement_key
      when 'haiku_count' then (select count(*) from public.haikus_2 where user_id = v_user_id)
      when 'received_like_count' then (
        select count(*) from public.likes_2 likes
        join public.haikus_2 haiku on haiku.id = likes.haiku_id
        where haiku.user_id = v_user_id
      )
      when 'utaawase_count' then (select count(*) from public.utaawase_members where user_id = v_user_id)
      else 0
    end >= catalog.requirement_value
  on conflict do nothing;

  return query select title_id from public.user_titles where user_id = v_user_id;
end;
$$;

create or replace function public.equip_my_title(p_title_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_title_id is null then
    delete from public.user_equipped_titles where user_id = v_user_id;
    return;
  end if;
  if not exists (select 1 from public.user_titles where user_id = v_user_id and title_id = p_title_id) then
    raise exception 'title is not owned';
  end if;
  insert into public.user_equipped_titles(user_id, title_id)
  values (v_user_id, p_title_id)
  on conflict (user_id) do update set title_id = excluded.title_id, equipped_at = now();
end;
$$;

revoke all on function public.refresh_my_titles() from public, anon;
revoke all on function public.equip_my_title(text) from public, anon;
grant execute on function public.refresh_my_titles() to authenticated;
grant execute on function public.equip_my_title(text) to authenticated;
