begin;

create table if not exists public.sub_services (
  sub_service_id bigint generated always as identity not null,
  service_id bigint not null,
  name text not null,
  price numeric(12,2) not null default 0,
  restaurant text not null,
  food_package_id bigint,
  expenses numeric(12,2) not null default 0,
  penalty numeric(12,2) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sub_services_pkey primary key (sub_service_id),
  constraint sub_services_service_id_fkey foreign key (service_id)
    references public.services (service_id) on delete cascade,
  constraint sub_services_food_package_id_fkey foreign key (food_package_id)
    references public.food_packages (food_package_id) on delete set null,
  constraint sub_services_price_check check (price >= 0),
  constraint sub_services_expenses_check check (expenses >= 0),
  constraint sub_services_penalty_check check (penalty >= 0),
  constraint sub_services_restaurant_check check (
    restaurant = any (array['Lakay Ago'::text, 'Aroo'::text, 'Both'::text])
  )
);

create table if not exists public.sub_service_assets (
  sub_service_asset_id bigint generated always as identity not null,
  sub_service_id bigint not null,
  asset_id bigint not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  constraint sub_service_assets_pkey primary key (sub_service_asset_id),
  constraint sub_service_assets_sub_service_id_fkey foreign key (sub_service_id)
    references public.sub_services (sub_service_id) on delete cascade,
  constraint sub_service_assets_asset_id_fkey foreign key (asset_id)
    references public.assets_inventory (asset_id) on delete restrict,
  constraint sub_service_assets_quantity_check check (quantity > 0)
);

create index if not exists idx_sub_services_service_id
  on public.sub_services (service_id, is_archived, created_at desc);

create index if not exists idx_sub_service_assets_sub_service_id
  on public.sub_service_assets (sub_service_id, asset_id);

commit;
