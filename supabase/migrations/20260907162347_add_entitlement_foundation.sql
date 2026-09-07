-- Disabled payment foundation only. No checkout provider, price ID, or webhook is configured.
create table if not exists public.entitlement_catalog (
  id text primary key, name text not null, description text not null,
  is_enabled boolean not null default false, display_order integer not null default 0
);
create table if not exists public.user_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_id text not null references public.entitlement_catalog(id),
  source text not null, valid_from timestamptz not null default now(), valid_until timestamptz,
  created_at timestamptz not null default now(), primary key(user_id, entitlement_id, source),
  check(valid_until is null or valid_until > valid_from)
);
alter table public.entitlement_catalog enable row level security;
alter table public.user_entitlements enable row level security;
revoke all on table public.entitlement_catalog, public.user_entitlements from public,anon,authenticated;
grant select on table public.entitlement_catalog to anon,authenticated;
grant select on table public.user_entitlements to authenticated;
create policy "enabled entitlements are readable" on public.entitlement_catalog for select using(is_enabled);
create policy "own entitlements are readable" on public.user_entitlements for select using(auth.uid()=user_id);
insert into public.entitlement_catalog(id,name,description,is_enabled) values
 ('supporter','詩花応援プラン','将来提供予定の応援者向け権利',false)
on conflict(id) do update set name=excluded.name,description=excluded.description,is_enabled=false;
