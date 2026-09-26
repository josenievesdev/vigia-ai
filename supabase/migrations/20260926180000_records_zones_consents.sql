-- VigíaAI · Fase 9b — Registro diario de producción, varios galpones por granja y autorización
-- de tratamiento de datos (Ley 1581 de 2012).

-- Apoyo: administrador o instalador.
create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'installer')
  )
$$;

revoke execute on function private.is_staff() from public, anon;
grant execute on function private.is_staff() to authenticated;

-- Varios galpones por granja ------------------------------------------------------------------------

-- Un galpón puede quedar vacío (entre un lote y otro, o si mueren todas las aves).
alter table public.zones drop constraint zones_population_check;
alter table public.zones add constraint zones_population_check check (population between 0 and 200000);

-- Quien ve la granja puede agregarle galpones; solo el administrador o el instalador los borra.
grant insert (farm_id, name, species, population, hatch_date, lighting, thresholds) on public.zones to authenticated;
grant delete on public.zones to authenticated;

create policy zones_insert on public.zones
  for insert to authenticated
  with check (exists (select 1 from public.farms f where f.id = farm_id));

create policy zones_delete on public.zones
  for delete to authenticated
  using ((select private.is_staff()) and exists (select 1 from public.farms f where f.id = farm_id));

-- La granja no se queda sin galpones (salvo cuando se borra la granja entera).
create function private.keep_one_zone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.farms where id = old.farm_id)
     and (select count(*) from public.zones where farm_id = old.farm_id) <= 1 then
    raise exception 'La granja debe tener al menos un galpón.' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger zones_keep_one before delete on public.zones
  for each row execute function private.keep_one_zone();

-- Registro diario de producción -----------------------------------------------------------------------

create table public.production_records (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones (id) on delete cascade,
  record_date date not null,
  eggs_collected integer not null check (eggs_collected between 0 and 1000000),
  eggs_broken integer not null default 0 check (eggs_broken >= 0),
  eggs_floor integer not null default 0 check (eggs_floor >= 0),
  eggs_dirty integer not null default 0 check (eggs_dirty >= 0),
  deaths integer not null default 0 check (deaths between 0 and 200000),
  feed_kg numeric(10, 1) check (feed_kg is null or feed_kg between 0 and 100000),
  notes text check (notes is null or char_length(notes) <= 500),
  recorded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (zone_id, record_date),
  check (eggs_broken + eggs_floor + eggs_dirty <= eggs_collected)
);

comment on table public.production_records is
  'Lo que se recogió cada día en cada galpón: el dato real. El modelo de la app es la referencia ("esperado").';
comment on column public.production_records.eggs_collected is
  'Todos los huevos recogidos del galpón (cubetas de 30 + sueltos), incluidos rotos, de piso y sucios.';
comment on column public.production_records.deaths is 'Aves muertas ese día: se descuentan de zones.population.';

create index production_records_zone_date_idx on public.production_records (zone_id, record_date desc);
create trigger production_records_touch_updated_at before update on public.production_records
  for each row execute function public.touch_updated_at();

-- Las muertes registradas descuentan las aves vivas del galpón (y se devuelven si se corrige o borra).
create function private.apply_record_deaths()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.zones set population = greatest(0, population - new.deaths) where id = new.zone_id;
  elsif tg_op = 'UPDATE' then
    update public.zones set population = greatest(0, population - (new.deaths - old.deaths)) where id = new.zone_id;
  else
    update public.zones set population = least(200000, population + old.deaths) where id = old.zone_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger production_records_deaths after insert or update of deaths or delete on public.production_records
  for each row execute function private.apply_record_deaths();

alter table public.production_records enable row level security;
revoke all on public.production_records from anon;
revoke all on public.production_records from authenticated;
grant select, delete on public.production_records to authenticated;
grant insert (zone_id, record_date, eggs_collected, eggs_broken, eggs_floor, eggs_dirty, deaths, feed_kg, notes)
  on public.production_records to authenticated;
grant update (eggs_collected, eggs_broken, eggs_floor, eggs_dirty, deaths, feed_kg, notes)
  on public.production_records to authenticated;

-- Quien ve el galpón (dueño al día, su instalador, el administrador) ve y registra su producción.
create policy records_select on public.production_records
  for select to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id));

create policy records_insert on public.production_records
  for insert to authenticated
  with check (exists (select 1 from public.zones z where z.id = zone_id));

create policy records_update on public.production_records
  for update to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id))
  with check (exists (select 1 from public.zones z where z.id = zone_id));

create policy records_delete on public.production_records
  for delete to authenticated
  using (exists (select 1 from public.zones z where z.id = zone_id));

-- Autorización de tratamiento de datos (Ley 1581 de 2012) ------------------------------------------------

create table public.data_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  unique (user_id, policy_version)
);

comment on table public.data_consents is
  'Prueba de la autorización previa, expresa e informada de cada usuario (Ley 1581 de 2012): versión y fecha.';

alter table public.data_consents enable row level security;
revoke all on public.data_consents from anon;
revoke all on public.data_consents from authenticated;
grant select on public.data_consents to authenticated;
grant insert (policy_version) on public.data_consents to authenticated;

-- Cada quien registra y ve solo su autorización; el administrador las ve todas (evidencia).
create policy consents_select on public.data_consents
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy consents_insert on public.data_consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke execute on function private.keep_one_zone(), private.apply_record_deaths() from public, anon, authenticated;
