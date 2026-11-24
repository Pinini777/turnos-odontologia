import type postgres from 'postgres';
import type {
  AuditoriaTurno, BloqueoAgenda, Box, EntradaHistoriaClinica, EstadoPieza, HorarioAtencion,
  Odontograma, Paciente, Prestacion, Profesional, Turno, Usuario,
} from '../entidades';
import { ReglaDeNegocioError } from '../errores';
import type { Repositorio, RepositorioAppendOnly, RepositorioConBorrado, Repositorios } from '../repositorios';
import { codificarDetalle, decodificarDetalle } from './detalle';
import { esEsquemaDePrueba } from './migraciones';

type Sql = postgres.Sql;
type Entidad = { id: string };
type Campo<T> = Extract<keyof T, string>;
type Fila = Record<string, unknown>;
type Parametro = postgres.SerializableParameter;

export const TABLAS_APLICACION = [
  'usuarios', 'profesionales', 'boxes', 'prestaciones', 'horarios', 'bloqueos',
  'pacientes', 'turnos', 'odontogramas', 'auditoria', 'historia_clinica', 'estados_pieza',
] as const;
type Tabla = typeof TABLAS_APLICACION[number];

function columna(campo: string): string {
  return campo.replace(/[A-Z]/g, letra => `_${letra.toLowerCase()}`);
}

function esImporte(campo: string): boolean {
  return campo === 'precio' || campo === 'precioAlReservar';
}

function prepararValor(sql: Sql, campo: string, valor: unknown): Parametro {
  if (campo === 'detalle' && typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
    return sql.json(codificarDetalle(Object.fromEntries(Object.entries(valor))));
  }
  if (esImporte(campo) && typeof valor === 'number') {
    const centavos = Math.round(valor * 100);
    if (!Number.isSafeInteger(centavos)) throw new Error('Importe inválido.');
    return centavos;
  }
  if (valor == null) return null;
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean' || valor instanceof Date) return valor;
  throw new Error('Tipo de campo no admitido para persistencia.');
}

function hidratar<T extends Entidad>(campos: readonly Campo<T>[], fila: Fila): T {
  const valores = campos.flatMap(campo => {
    const valor = fila[columna(campo)];
    if (valor == null) return [];
    const dato = campo === 'detalle' ? decodificarDetalle(valor) : esImporte(campo) ? Number(valor) / 100 : valor;
    return [[campo, dato]] as const;
  });
  return Object.fromEntries(valores) as T;
}

const restriccionesUnicas = new Set([
  'usuarios_email_unico', 'pacientes_documento_unico', 'pacientes_email_unico',
  'profesionales_matricula_key', 'boxes_nombre_unico',
]);
async function consultar<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && 'constraint_name' in error) {
      const restriccion = error.constraint_name;
      if (error.code === '23P01') {
        if (restriccion === 'turnos_profesional_sin_solapamiento') throw new ReglaDeNegocioError('SOLAPAMIENTO_PROFESIONAL');
        if (restriccion === 'turnos_box_sin_solapamiento') throw new ReglaDeNegocioError('SOLAPAMIENTO_BOX');
      }
      if (error.code === '23505' && typeof restriccion === 'string' && restriccionesUnicas.has(restriccion)) {
        throw new ReglaDeNegocioError('DUPLICADO');
      }
    }
    // El error del driver puede incluir detalles o parámetros de la consulta.
    throw new Error('No se pudo completar la operación de persistencia.');
  }
}

const idValido = (id: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);

export function crearRepositoriosPostgres(sql: Sql, esquema = 'public'): Repositorios {
  if (esquema !== 'public' && !esEsquemaDePrueba(esquema)) throw new Error('Esquema de repositorios inválido.');

  function operaciones<T extends Entidad>(tabla: Tabla, campos: readonly Campo<T>[]) {
    const destino = sql`${sql(esquema)}.${sql(tabla)}`;
    const aFila = (entidad: T) => Object.fromEntries(campos.map(campo => [columna(campo), prepararValor(sql, campo, entidad[campo])]));
    const listar: Repositorio<T>['listar'] = async (filtro = () => true) => {
      // shortcut: carga la tabla completa y filtra en JS; alcanza para un consultorio de 1 a 3 profesionales; pasar a consultas SQL si crece el volumen.
      const filas = await consultar(async () => (await sql<Fila[]>`select * from ${destino} order by orden`).map(fila => hidratar<T>(campos, fila)));
      return filas.filter(filtro);
    };
    return { destino, aFila, listar };
  }

  function editable<T extends Entidad>(tabla: Tabla, campos: readonly Campo<T>[]): RepositorioConBorrado<T> {
    const { destino, aFila, listar } = operaciones<T>(tabla, campos);
    return {
      guardar: entidad => consultar(async () => {
        const fila = aFila(entidad);
        const actualizar = Object.fromEntries(Object.entries(fila).filter(([clave]) => clave !== 'id'));
        await sql`insert into ${destino} ${sql(fila)} on conflict (id) do update set ${sql(actualizar)}`;
      }),
      buscarPorId: id => consultar(async () => {
        if (!idValido(id)) return undefined;
        const [fila] = await sql<Fila[]>`select * from ${destino} where id = ${id}`;
        return fila ? hidratar<T>(campos, fila) : undefined;
      }),
      existe: id => consultar(async () => {
        if (!idValido(id)) return false;
        const [fila] = await sql<{ existe: boolean }[]>`select exists(select 1 from ${destino} where id = ${id}) as existe`;
        return fila?.existe === true;
      }),
      listar,
      borrar: id => consultar(async () => {
        if (idValido(id)) await sql`delete from ${destino} where id = ${id}`;
      }),
    };
  }

  function repositorio<T extends Entidad>(tabla: Tabla, campos: readonly Campo<T>[]): Repositorio<T> {
    const { guardar, buscarPorId, existe, listar } = editable<T>(tabla, campos);
    return { guardar, buscarPorId, existe, listar };
  }

  function appendOnly<T extends Entidad>(tabla: Tabla, campos: readonly Campo<T>[]): RepositorioAppendOnly<T> {
    const { destino, aFila, listar } = operaciones<T>(tabla, campos);
    return {
      listar,
      agregar: entidad => consultar(async () => { await sql`insert into ${destino} ${sql(aFila(entidad))}`; }),
    };
  }

  return {
    usuarios: repositorio<Usuario>('usuarios', ['id', 'email', 'hashPassword', 'rol', 'activo']),
    profesionales: repositorio<Profesional>('profesionales', ['id', 'nombre', 'matricula', 'activo', 'usuarioId']),
    boxes: repositorio<Box>('boxes', ['id', 'nombre', 'activo']),
    prestaciones: repositorio<Prestacion>('prestaciones', ['id', 'nombre', 'duracionMin', 'precio', 'reservableOnline', 'activa']),
    horarios: editable<HorarioAtencion>('horarios', ['id', 'profesionalId', 'diaSemana', 'desde', 'hasta']),
    bloqueos: editable<BloqueoAgenda>('bloqueos', ['id', 'profesionalId', 'boxId', 'inicio', 'fin', 'motivo']),
    pacientes: repositorio<Paciente>('pacientes', ['id', 'usuarioId', 'nombre', 'apellido', 'documento', 'email', 'telefono', 'obraSocial', 'plan', 'nroAfiliado']),
    turnos: repositorio<Turno>('turnos', ['id', 'profesionalId', 'boxId', 'prestacionId', 'pacienteId', 'inicio', 'fin', 'estado', 'origen', 'precioAlReservar', 'creadoPor', 'creadoEn']),
    odontogramas: repositorio<Odontograma>('odontogramas', ['id', 'pacienteId', 'actualizadoEn']),
    auditoria: appendOnly<AuditoriaTurno>('auditoria', ['id', 'turnoId', 'accion', 'actor', 'fecha', 'detalle']),
    historiaClinica: appendOnly<EntradaHistoriaClinica>('historia_clinica', ['id', 'pacienteId', 'profesionalId', 'fecha', 'texto', 'turnoId', 'corrigeAId']),
    estadosPieza: appendOnly<EstadoPieza>('estados_pieza', ['id', 'odontogramaId', 'pieza', 'cara', 'estado', 'registradoPor', 'fecha']),
  };
}
