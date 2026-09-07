create table if not exists public.theme_catalog (
  id text primary key,
  name text not null,
  description text not null,
  css_key text not null unique,
  price integer not null default 0 check (price >= 0),
  is_public boolean not null default true,
  display_order integer not null default 0
);
create table if not exists public.avatar_frame_catalog (
  id text primary key,
  name text not null,
  description text not null,
  css_key text not null unique,
  price integer not null default 0 check (price >= 0),
  is_public boolean not null default true,
  display_order integer not null default 0
);
create table if not exists public.user_themes (
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_id text not null references public.theme_catalog(id) on delete cascade,
  acquired_at timestamptz not null default now(), primary key (user_id, theme_id)
);
create table if not exists public.user_avatar_frames (
  user_id uuid not null references auth.users(id) on delete cascade,
  frame_id text not null references public.avatar_frame_catalog(id) on delete cascade,
  acquired_at timestamptz not null default now(), primary key (user_id, frame_id)
);
create table if not exists public.user_cosmetic_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_id text references public.theme_catalog(id),
  frame_id text references public.avatar_frame_catalog(id),
  updated_at timestamptz not null default now()
);

alter table public.theme_catalog enable row level security;
alter table public.avatar_frame_catalog enable row level security;
alter table public.user_themes enable row level security;
alter table public.user_avatar_frames enable row level security;
alter table public.user_cosmetic_settings enable row level security;

revoke all on table public.theme_catalog, public.avatar_frame_catalog, public.user_themes,
  public.user_avatar_frames, public.user_cosmetic_settings from public, anon, authenticated;
grant select on table public.theme_catalog, public.avatar_frame_catalog to anon, authenticated;
grant select on table public.user_cosmetic_settings to anon, authenticated;
grant select on table public.user_themes, public.user_avatar_frames to authenticated;

create policy "public themes are readable" on public.theme_catalog for select using (is_public);
create policy "public frames are readable" on public.avatar_frame_catalog for select using (is_public);
create policy "own themes are readable" on public.user_themes for select using (auth.uid() = user_id);
create policy "own frames are readable" on public.user_avatar_frames for select using (auth.uid() = user_id);
create policy "cosmetic choices are readable" on public.user_cosmetic_settings for select using (true);

insert into public.theme_catalog(id, name, description, css_key, price, display_order) values
  ('default', '標準', '詩花の墨と金を基調にした装い', 'default', 0, 10),
  ('sakura', '桜', '淡い桜色の装い', 'sakura', 300, 20),
  ('yoi', '宵', '夜空を思わせる深い藍の装い', 'yoi', 300, 30),
  ('washi', '和紙', '静かな和紙色の装い', 'washi', 300, 40)
on conflict (id) do update set name=excluded.name, description=excluded.description, css_key=excluded.css_key, price=excluded.price, display_order=excluded.display_order;
insert into public.avatar_frame_catalog(id, name, description, css_key, price, display_order) values
  ('gold-ring', '金輪', '控えめな金色の輪', 'gold-ring', 200, 10),
  ('sakura-ring', '桜輪', '桜色のやわらかな輪', 'sakura-ring', 200, 20)
on conflict (id) do update set name=excluded.name, description=excluded.description, css_key=excluded.css_key, price=excluded.price, display_order=excluded.display_order;

create or replace function public.equip_my_cosmetic(p_kind text, p_item_id text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_kind = 'theme' then
    if p_item_id <> 'default' and not exists (select 1 from public.user_themes where user_id=v_user_id and theme_id=p_item_id) then raise exception 'theme is not owned'; end if;
    insert into public.user_cosmetic_settings(user_id, theme_id) values(v_user_id, p_item_id)
    on conflict(user_id) do update set theme_id=excluded.theme_id, updated_at=now();
  elsif p_kind = 'frame' then
    if p_item_id is not null and not exists (select 1 from public.user_avatar_frames where user_id=v_user_id and frame_id=p_item_id) then raise exception 'frame is not owned'; end if;
    insert into public.user_cosmetic_settings(user_id, frame_id) values(v_user_id, p_item_id)
    on conflict(user_id) do update set frame_id=excluded.frame_id, updated_at=now();
  else raise exception 'unknown cosmetic kind'; end if;
end; $$;
revoke all on function public.equip_my_cosmetic(text, text) from public, anon;
grant execute on function public.equip_my_cosmetic(text, text) to authenticated;
