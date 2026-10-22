-- Coyuntura política: snapshot generado desde RSS chilenos y analizado con OpenAI.
-- Se guarda en tabla (no en caché de memoria) para servir la home al instante,
-- conservar historial del clima político y permitir refresco manual desde admin.
create table if not exists political_briefs (
  id uuid primary key default gen_random_uuid(),
  climate_summary text not null,
  climate_tone text not null,
  highlight_area text,
  highlight_subject text,
  highlight_reason text,
  items jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  headline_count integer not null default 0,
  model text not null,
  generated_at timestamptz not null default now()
);

create index if not exists political_briefs_generated_at_idx
  on political_briefs (generated_at desc);

alter table political_briefs enable row level security;

-- Contenido compartido, no por usuario: lectura para autenticados.
-- La escritura pasa siempre por el service role vía las rutas de API.
create policy "Authenticated users can read political briefs" on political_briefs
  for select to authenticated using (true);
