create table usuarios (
  id uuid primary key,
  orden bigint generated always as identity,
  email text not null,
  hash_password text not null,
  rol text not null check (rol in ('profesional', 'recepcionista', 'paciente')),
  activo boolean not null
);
create unique index usuarios_email_unico on usuarios (lower(btrim(email)));

create table profesionales (
  id uuid primary key,
  orden bigint generated always as identity,
  nombre text not null,
  matricula text not null unique,
  activo boolean not null,
  usuario_id uuid not null references usuarios(id)
);
create index profesionales_usuario_id_idx on profesionales(usuario_id);

create table boxes (
  id uuid primary key,
  orden bigint generated always as identity,
  nombre text not null,
  activo boolean not null
);
create unique index boxes_nombre_unico on boxes (lower(btrim(nombre)));

create table prestaciones (
  id uuid primary key,
  orden bigint generated always as identity,
  nombre text not null,
  duracion_min integer not null check (duracion_min > 0 and duracion_min % 15 = 0),
  precio bigint not null check (precio between 0 and 999999999999),
  reservable_online boolean not null,
  activa boolean not null
);

create table horarios (
  id uuid primary key,
  orden bigint generated always as identity,
  profesional_id uuid not null references profesionales(id),
  dia_semana smallint not null check (dia_semana between 1 and 7),
  desde text not null check (desde ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'),
  hasta text not null check (hasta ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'),
  check (desde < hasta)
);
create index horarios_profesional_id_idx on horarios(profesional_id);

create table bloqueos (
  id uuid primary key,
  orden bigint generated always as identity,
  profesional_id uuid references profesionales(id),
  box_id uuid references boxes(id),
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text not null,
  check ((profesional_id is null) <> (box_id is null)),
  check (inicio < fin)
);
create index bloqueos_profesional_id_idx on bloqueos(profesional_id);
create index bloqueos_box_id_idx on bloqueos(box_id);

create table pacientes (
  id uuid primary key,
  orden bigint generated always as identity,
  usuario_id uuid references usuarios(id),
  nombre text not null,
  apellido text not null,
  documento text not null,
  email text not null,
  telefono text,
  obra_social text,
  plan text,
  nro_afiliado text
);
create unique index pacientes_documento_unico on pacientes (btrim(documento));
create unique index pacientes_email_unico on pacientes (lower(btrim(email)));
create index pacientes_usuario_id_idx on pacientes(usuario_id);

create table turnos (
  id uuid primary key,
  orden bigint generated always as identity,
  profesional_id uuid not null references profesionales(id),
  box_id uuid not null references boxes(id),
  prestacion_id uuid not null references prestaciones(id),
  paciente_id uuid not null references pacientes(id),
  inicio timestamptz not null,
  fin timestamptz not null,
  estado text not null check (estado in ('reservado', 'confirmado', 'atendido', 'ausente', 'cancelado')),
  origen text not null check (origen in ('online', 'recepcion', 'profesional')),
  precio_al_reservar bigint not null check (precio_al_reservar between 0 and 999999999999),
  creado_por uuid not null references usuarios(id),
  creado_en timestamptz not null,
  check (inicio < fin),
  constraint turnos_profesional_sin_solapamiento exclude using gist
    (profesional_id with =, tstzrange(inicio, fin, '[)') with &&) where (estado <> 'cancelado'),
  constraint turnos_box_sin_solapamiento exclude using gist
    (box_id with =, tstzrange(inicio, fin, '[)') with &&) where (estado <> 'cancelado')
);
create index turnos_profesional_inicio_idx on turnos(profesional_id, inicio);
create index turnos_box_inicio_idx on turnos(box_id, inicio);
create index turnos_paciente_inicio_idx on turnos(paciente_id, inicio);
create index turnos_prestacion_id_idx on turnos(prestacion_id);
create index turnos_creado_por_idx on turnos(creado_por);

create table odontogramas (
  id uuid primary key,
  orden bigint generated always as identity,
  paciente_id uuid not null unique references pacientes(id),
  actualizado_en timestamptz not null
);

-- La reserva online escribe la auditoría antes del turno y su actor puede ser el literal 'paciente'.
create table auditoria (
  id uuid primary key,
  orden bigint generated always as identity,
  turno_id uuid not null,
  accion text not null check (accion in ('creado', 'reprogramado', 'cancelado', 'estado_cambiado')),
  actor text not null,
  fecha timestamptz not null,
  detalle jsonb not null
);
create index auditoria_turno_id_idx on auditoria(turno_id);

create table historia_clinica (
  id uuid primary key,
  orden bigint generated always as identity,
  paciente_id uuid not null references pacientes(id),
  profesional_id uuid not null references profesionales(id),
  fecha timestamptz not null,
  texto text not null,
  turno_id uuid references turnos(id),
  corrige_a_id uuid references historia_clinica(id)
);
create index historia_clinica_paciente_id_idx on historia_clinica(paciente_id);
create index historia_clinica_profesional_id_idx on historia_clinica(profesional_id);
create index historia_clinica_turno_id_idx on historia_clinica(turno_id);
create index historia_clinica_corrige_a_id_idx on historia_clinica(corrige_a_id);

-- La primera actualización guarda estados de pieza antes de la cabecera del odontograma.
create table estados_pieza (
  id uuid primary key,
  orden bigint generated always as identity,
  odontograma_id uuid not null,
  pieza smallint not null check (pieza between 11 and 48 or pieza between 51 and 85),
  cara text check (cara in ('oclusal', 'mesial', 'distal', 'vestibular', 'lingual')),
  estado text not null check (estado in ('sano', 'caries', 'obturado', 'ausente', 'corona', 'endodoncia', 'a_extraer')),
  registrado_por uuid not null references profesionales(id),
  fecha timestamptz not null
);
create index estados_pieza_odontograma_id_idx on estados_pieza(odontograma_id);
create index estados_pieza_registrado_por_idx on estados_pieza(registrado_por);

create function impedir_mutacion_registro() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  raise exception using errcode = '23514', message = 'La operación está prohibida para este registro.';
end;
$$;
revoke all on function impedir_mutacion_registro() from public, anon, authenticated;

create trigger turnos_sin_borrado before delete on turnos
for each row execute function impedir_mutacion_registro();
create trigger auditoria_inmutable before update or delete on auditoria
for each row execute function impedir_mutacion_registro();
create trigger historia_clinica_inmutable before update or delete on historia_clinica
for each row execute function impedir_mutacion_registro();
create trigger estados_pieza_inmutables before update or delete on estados_pieza
for each row execute function impedir_mutacion_registro();

alter table usuarios enable row level security;
alter table profesionales enable row level security;
alter table boxes enable row level security;
alter table prestaciones enable row level security;
alter table horarios enable row level security;
alter table bloqueos enable row level security;
alter table pacientes enable row level security;
alter table turnos enable row level security;
alter table odontogramas enable row level security;
alter table auditoria enable row level security;
alter table historia_clinica enable row level security;
alter table estados_pieza enable row level security;

revoke all on table usuarios, profesionales, boxes, prestaciones, horarios, bloqueos, pacientes,
  turnos, odontogramas, auditoria, historia_clinica, estados_pieza from public, anon, authenticated;
