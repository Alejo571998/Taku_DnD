-- ════════════════════════════════════════════════════════════════════════════
-- Recursión infinita al compartir un personaje en una campaña
--
-- SÍNTOMA
--   insert into campaign_characters (...)
--   → ERROR: infinite recursion detected in policy for relation
--            "campaign_characters"
--
--   Compartir un personaje en una campaña —la razón de existir de las
--   campañas— falla SIEMPRE, incluso para el dueño del personaje en su propia
--   campaña. No es una fuga: es la función entera caída.
--
-- CAUSA
--   `campaign_characters_insert` comprueba contra `public.characters`, y
--   `characters_select` comprueba contra `public.campaign_characters`:
--
--     campaign_characters (INSERT) → characters (SELECT) → campaign_characters
--
--   Postgres lleva la cuenta de RELACIONES en la pila de expansión de
--   políticas, no de políticas concretas. En cuanto `campaign_characters`
--   aparece por segunda vez, corta. Que las dos políticas implicadas sean de
--   comandos distintos —INSERT y SELECT— no lo salva.
--
-- ARREGLO
--   La misma técnica que `0001` usa para la recursión de `workspace_members`:
--   sacar la consulta a una función `security definer`, que no dispara las
--   políticas de la tabla que lee y por tanto no reentra.
--
-- REGLA PARA LA PRÓXIMA POLÍTICA
--   Ninguna política puede consultar una tabla que, a su vez, consulte la
--   tabla que la contiene. Si hace falta ese salto, va en una función
--   `security definer` que reciba un id concreto y devuelva un booleano.
-- ════════════════════════════════════════════════════════════════════════════

/**
 * ¿El personaje pertenece a un workspace del usuario actual?
 *
 * `security definer` lee `characters` SIN aplicar sus políticas, que es justo
 * lo que rompe el ciclo. No filtra nada: recibe un id concreto y solo devuelve
 * un booleano sobre la pertenencia del que pregunta. No se puede usar para
 * enumerar personajes ajenos.
 */
create or replace function public.owns_character(target_character_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.characters c
    where c.id = target_character_id
      and c.workspace_id in (
        select workspace_id from public.workspace_members where user_id = auth.uid()
      )
  )
$$;

/** ¿El usuario actual dirige esta campaña? */
create or replace function public.is_campaign_dm(target_campaign_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.campaigns c
    where c.id = target_campaign_id
      and c.dm_user_id = auth.uid()
  )
$$;

-- Un jugador comparte SU personaje; el DM no puede meter personajes ajenos.
drop policy if exists campaign_characters_insert on public.campaign_characters;
create policy campaign_characters_insert on public.campaign_characters
  for insert with check (public.owns_character(character_id));

-- Lo saca de la campaña su dueño, o el DM de esa mesa.
drop policy if exists campaign_characters_delete on public.campaign_characters;
create policy campaign_characters_delete on public.campaign_characters
  for delete using (
    public.owns_character(character_id)
    or public.is_campaign_dm(campaign_id)
  );

-- `campaigns_update` hacía lo mismo por otra vía; queda igual de claro y deja
-- de depender de una subconsulta sobre una tabla con RLS.
drop policy if exists campaigns_update on public.campaigns;
create policy campaigns_update on public.campaigns
  for update using (dm_user_id = auth.uid());

revoke execute on function public.owns_character(uuid) from public;
revoke execute on function public.is_campaign_dm(uuid) from public;
grant  execute on function public.owns_character(uuid) to authenticated, service_role;
grant  execute on function public.is_campaign_dm(uuid) to authenticated, service_role;
