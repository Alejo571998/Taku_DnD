-- ════════════════════════════════════════════════════════════════════════════
-- TAKU D&D — Esquema inicial
--
-- Multi-tenencia desde el primer día: añadir `workspace_id` a
-- posteriori habría sido un rediseño, no una migración.
--
-- Todo dato de usuario lleva `workspace_id` y está protegido por RLS. La RLS
-- es DEFENSA EN PROFUNDIDAD: la barrera principal es el API de sincronización,
-- que valida las invariantes de dominio antes de escribir.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Workspaces ──────────────────────────────────────────────────────────────

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mi espacio',
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'OWNER' check (role in ('OWNER', 'ADMIN', 'MEMBER')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- ── Registro de cambios ─────────────────────────────────────────────────────
--
-- El cursor de sincronización es esta SECUENCIA, no un timestamp:
-- los relojes de los clientes están sesgados y una sincronización basada en
-- tiempo pierde registros en silencio.

create table public.change_log (
  seq          bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_type  text not null,
  entity_id    uuid not null,
  operation    text not null check (operation in ('upsert', 'delete')),
  actor_id     uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index change_log_workspace_seq_idx on public.change_log (workspace_id, seq);

-- ── Personajes ──────────────────────────────────────────────────────────────
--
-- El estado del personaje se guarda como JSONB: es un agregado que SIEMPRE se
-- lee y escribe entero, y descomponerlo en veinte tablas solo añadiría uniones
-- sin ganar nada. Los campos que se consultan o se filtran SÍ son columnas.

create table public.characters (
  id             uuid primary key,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  name           text not null,
  ruleset        text not null check (ruleset in ('2014', '2024')),
  level          integer not null default 1,
  -- Concurrencia optimista: una escritura con una versión vieja se rechaza.
  version        integer not null default 1,
  state          jsonb not null,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index characters_workspace_idx on public.characters (workspace_id) where deleted_at is null;
create index characters_updated_idx on public.characters (workspace_id, updated_at desc);

-- ── Idempotencia ────────────────────────────────────────────────────────────
--
-- La clave primaria ES la garantía: un reintento choca con ella y se descarta.
-- Así se cumple "nunca duplicar acciones por un retry" (MASTER PROMPT §41) con
-- una restricción de base de datos, no con una comprobación esperanzada.

create table public.applied_operations (
  client_op_id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  character_id uuid,
  command_type text not null,
  applied_at   timestamptz not null default now(),
  result_seq   bigint
);

create index applied_operations_workspace_idx on public.applied_operations (workspace_id, applied_at desc);

-- Las operaciones viejas no aportan nada: un cliente que estuvo 30 días sin
-- conexión ya tiene otros problemas. Se purgan con un cron.
create index applied_operations_applied_at_idx on public.applied_operations (applied_at);

-- ── Conflictos ──────────────────────────────────────────────────────────────
--
-- Cuando dos dispositivos divergen NO se sobrescribe en silencio
-- (MASTER PROMPT §42): queda registrado y, si hace falta, se le pregunta.

create table public.sync_conflicts (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  entity_type    text not null,
  entity_id      uuid not null,
  client_op_id   uuid,
  local_version  integer,
  server_version integer,
  command        jsonb not null,
  resolution     text check (resolution in ('serverWins', 'clientWins', 'merged', 'pending')),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

create index sync_conflicts_workspace_idx on public.sync_conflicts (workspace_id, created_at desc);

-- ── Campañas ────────────────────────────────────────────────────────────────
--
-- El MODELO entra en el MVP aunque la interfaz sea posterior:
-- añadir un segundo eje de compartición más tarde es un rediseño.

create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null,
  description  text not null default '',
  ruleset      text not null check (ruleset in ('2014', '2024')),
  dm_user_id   uuid not null references auth.users (id) on delete cascade,
  settings     jsonb not null default '{}'::jsonb,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'PLAYER' check (role in ('OWNER', 'DM', 'PLAYER', 'ADMIN')),
  created_at  timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index campaign_members_user_idx on public.campaign_members (user_id);

-- Un personaje pertenece a un workspace y se COMPARTE con una campaña.
-- No cambia de propietario: es el segundo eje de compartición.
create table public.campaign_characters (
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (campaign_id, character_id)
);

create index campaign_characters_character_idx on public.campaign_characters (character_id);

-- ── Contenido propio e importado ────────────────────────────────────────────

create table public.content_packs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  slug         text not null,
  name         text not null,
  description  text not null default '',
  version      text not null default '1.0.0',
  ruleset      text not null check (ruleset in ('2014', '2024')),
  language     text not null default 'es-419',
  source       jsonb not null,
  visibility   text not null default 'private' check (visibility in ('private', 'campaign', 'public')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, slug, version)
);

create table public.content_definitions (
  id           text not null,
  pack_id      uuid not null references public.content_packs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type         text not null,
  name         text not null,
  rulesets     text[] not null,
  data         jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (pack_id, id)
);

create index content_definitions_workspace_type_idx on public.content_definitions (workspace_id, type);
create index content_definitions_name_idx on public.content_definitions using gin (to_tsvector('simple', name));

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
--
-- Un usuario JAMÁS puede ver datos de otro tenant (MASTER SPEC §41).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.workspaces          enable row level security;
alter table public.workspace_members   enable row level security;
alter table public.characters          enable row level security;
alter table public.change_log          enable row level security;
alter table public.applied_operations  enable row level security;
alter table public.sync_conflicts      enable row level security;
alter table public.campaigns           enable row level security;
alter table public.campaign_members    enable row level security;
alter table public.campaign_characters enable row level security;
alter table public.content_packs       enable row level security;
alter table public.content_definitions enable row level security;

/**
 * Función auxiliar: workspaces del usuario actual.
 *
 * `security definer` + `stable` evita la recursión infinita de políticas que
 * aparece si una política sobre workspace_members consulta workspace_members.
 */
create or replace function public.user_workspace_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select workspace_id from public.workspace_members where user_id = auth.uid()
$$;

create or replace function public.user_campaign_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select campaign_id from public.campaign_members where user_id = auth.uid()
$$;

-- ── Workspaces ──────────────────────────────────────────────────────────────

create policy workspaces_select on public.workspaces
  for select using (id in (select public.user_workspace_ids()));

create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());

create policy workspaces_update on public.workspaces
  for update using (owner_id = auth.uid());

create policy workspace_members_select on public.workspace_members
  for select using (user_id = auth.uid() or workspace_id in (select public.user_workspace_ids()));

create policy workspace_members_insert on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  );

-- ── Personajes ──────────────────────────────────────────────────────────────
--
-- Visible si es de un workspace del usuario, O si está compartido en una
-- campaña de la que el usuario es miembro. Esta política es la superficie de
-- fuga más probable del sistema: tiene test propio.

create policy characters_select on public.characters
  for select using (
    workspace_id in (select public.user_workspace_ids())
    or exists (
      select 1
      from public.campaign_characters cc
      where cc.character_id = characters.id
        and cc.campaign_id in (select public.user_campaign_ids())
    )
  );

-- Escribir un personaje SOLO lo puede hacer su workspace. Que un DM lo vea no
-- le da permiso para modificarlo.
create policy characters_insert on public.characters
  for insert with check (workspace_id in (select public.user_workspace_ids()));

create policy characters_update on public.characters
  for update using (workspace_id in (select public.user_workspace_ids()));

create policy characters_delete on public.characters
  for delete using (workspace_id in (select public.user_workspace_ids()));

-- ── Sincronización ──────────────────────────────────────────────────────────

create policy change_log_select on public.change_log
  for select using (workspace_id in (select public.user_workspace_ids()));

create policy applied_operations_select on public.applied_operations
  for select using (workspace_id in (select public.user_workspace_ids()));

create policy sync_conflicts_select on public.sync_conflicts
  for select using (workspace_id in (select public.user_workspace_ids()));

create policy sync_conflicts_update on public.sync_conflicts
  for update using (workspace_id in (select public.user_workspace_ids()));

-- ── Campañas ────────────────────────────────────────────────────────────────

create policy campaigns_select on public.campaigns
  for select using (
    workspace_id in (select public.user_workspace_ids())
    or id in (select public.user_campaign_ids())
  );

create policy campaigns_insert on public.campaigns
  for insert with check (workspace_id in (select public.user_workspace_ids()));

create policy campaigns_update on public.campaigns
  for update using (dm_user_id = auth.uid());

create policy campaign_members_select on public.campaign_members
  for select using (user_id = auth.uid() or campaign_id in (select public.user_campaign_ids()));

create policy campaign_characters_select on public.campaign_characters
  for select using (campaign_id in (select public.user_campaign_ids()));

-- Un jugador comparte SU personaje; el DM no puede meter personajes ajenos.
create policy campaign_characters_insert on public.campaign_characters
  for insert with check (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.workspace_id in (select public.user_workspace_ids())
    )
  );

create policy campaign_characters_delete on public.campaign_characters
  for delete using (
    exists (
      select 1 from public.characters c
      where c.id = character_id and c.workspace_id in (select public.user_workspace_ids())
    )
    or exists (
      select 1 from public.campaigns cm
      where cm.id = campaign_id and cm.dm_user_id = auth.uid()
    )
  );

-- ── Contenido ───────────────────────────────────────────────────────────────

create policy content_packs_select on public.content_packs
  for select using (
    workspace_id in (select public.user_workspace_ids())
    or visibility = 'public'
  );

create policy content_packs_write on public.content_packs
  for all using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

create policy content_definitions_select on public.content_definitions
  for select using (
    workspace_id in (select public.user_workspace_ids())
    or exists (
      select 1 from public.content_packs p
      where p.id = pack_id and p.visibility = 'public'
    )
  );

create policy content_definitions_write on public.content_definitions
  for all using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));

-- ════════════════════════════════════════════════════════════════════════════
-- AUTOMATISMOS
-- ════════════════════════════════════════════════════════════════════════════

/** Cada usuario nuevo recibe su propio workspace personal. */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.workspaces (name, owner_id)
  values ('Mi espacio', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'OWNER');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/** Registra cada cambio de personaje en el change_log para el pull incremental. */
create or replace function public.log_character_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.change_log (workspace_id, entity_type, entity_id, operation, actor_id)
  values (
    coalesce(new.workspace_id, old.workspace_id),
    'character',
    coalesce(new.id, old.id),
    case
      when tg_op = 'DELETE' then 'delete'
      when new.deleted_at is not null then 'delete'
      else 'upsert'
    end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger characters_change_log
  after insert or update or delete on public.characters
  for each row execute function public.log_character_change();

/** `updated_at` lo pone el servidor: el reloj del cliente no es de fiar. */
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger characters_touch before update on public.characters
  for each row execute function public.touch_updated_at();

create trigger campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

create trigger workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();
