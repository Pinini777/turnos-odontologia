import { describirCodigoNegocio, type DetalleErrorCampo } from './errores';

export type RolUsuario = 'profesional' | 'recepcionista' | 'paciente';

export interface UsuarioPublico {
  readonly id: string;
  readonly email: string;
  readonly rol: RolUsuario;
  readonly activo: boolean;
}

export interface PacienteApi {
  readonly id: string;
  readonly usuarioId?: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly documento: string;
  readonly email: string;
  readonly telefono?: string;
  readonly obraSocial?: string;
  readonly plan?: string;
  readonly nroAfiliado?: string;
}

export interface EntradaLogin {
  readonly email: string;
  readonly password: string;
}

export interface ResultadoLogin {
  readonly token: string;
  readonly usuario: UsuarioPublico;
}

export interface EntradaRegistroPaciente {
  readonly nombre: string;
  readonly apellido: string;
  readonly documento: string;
  readonly email: string;
  readonly password: string;
  readonly telefono?: string;
  readonly obraSocial?: string;
  readonly plan?: string;
  readonly nroAfiliado?: string;
}

export interface ResultadoRegistroPaciente {
  readonly token: string;
  readonly usuario: UsuarioPublico;
  readonly paciente: PacienteApi;
}

export class ErrorApi extends Error {
  readonly status: number;
  readonly code: string;
  readonly mensajeLegible: string;
  readonly detalles: readonly DetalleErrorCampo[];

  constructor(
    status: number,
    code: string,
    detalles: readonly DetalleErrorCampo[] = [],
  ) {
    const mensajeLegible = describirCodigoNegocio(code);
    super(mensajeLegible);
    this.name = 'ErrorApi';
    this.status = status;
    this.code = code;
    this.mensajeLegible = mensajeLegible;
    this.detalles = detalles;
  }
}

export interface OpcionesClienteHttp {
  readonly obtenerToken: () => string | null;
  readonly onUnauthorized?: () => void;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export interface ClienteHttp {
  get<T>(ruta: string): Promise<T>;
  post<T>(ruta: string, cuerpo?: unknown): Promise<T>;
  patch<T>(ruta: string, cuerpo?: unknown): Promise<T>;
  put<T>(ruta: string, cuerpo?: unknown): Promise<T>;
  delete<T>(ruta: string): Promise<T>;
}

interface CuerpoErrorApi {
  code?: unknown;
  detalles?: unknown;
}

function extraerDetalles(valor: unknown): DetalleErrorCampo[] {
  if (!Array.isArray(valor)) return [];
  const lista: DetalleErrorCampo[] = [];
  for (const item of valor) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'campo' in item &&
      'motivo' in item &&
      typeof item.campo === 'string' &&
      typeof item.motivo === 'string'
    ) {
      lista.push({ campo: item.campo, motivo: item.motivo });
    }
  }
  return lista;
}

function codigoPorStatus(status: number): string {
  if (status === 400) return 'FORMATO_INVALIDO';
  if (status === 401) return 'NO_AUTENTICADO';
  if (status === 403) return 'SIN_PERMISO';
  if (status === 404) return 'NO_ENCONTRADO';
  return 'ERROR_INTERNO';
}

export function crearClienteHttp(opciones: OpcionesClienteHttp): ClienteHttp {
  const baseUrl = opciones.baseUrl ?? '';
  const fetchFn = opciones.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function solicitar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
    const headers = new Headers();
    const token = opciones.obtenerToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (cuerpo !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    let respuesta: Response;
    try {
      respuesta = await fetchFn(`${baseUrl}${ruta}`, {
        method: metodo,
        headers,
        ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
      });
    } catch {
      throw new ErrorApi(0, 'RED_NO_DISPONIBLE');
    }

    const texto = await respuesta.text();
    let json: unknown = undefined;
    if (texto.length > 0) {
      try {
        json = JSON.parse(texto);
      } catch {
        json = undefined;
      }
    }

    if (!respuesta.ok) {
      const cuerpoError: CuerpoErrorApi =
        typeof json === 'object' && json !== null ? (json as CuerpoErrorApi) : {};
      const code =
        typeof cuerpoError.code === 'string' && cuerpoError.code.length > 0
          ? cuerpoError.code
          : codigoPorStatus(respuesta.status);
      const detalles = extraerDetalles(cuerpoError.detalles);

      if (respuesta.status === 401 && opciones.onUnauthorized) {
        try {
          opciones.onUnauthorized();
        } catch {
          // Aislar fallos del manejador de sesión vencida.
        }
      }
      throw new ErrorApi(respuesta.status, code, detalles);
    }

    return json as T;
  }

  return {
    get: <T,>(ruta: string) => solicitar<T>('GET', ruta),
    post: <T,>(ruta: string, cuerpo?: unknown) => solicitar<T>('POST', ruta, cuerpo),
    patch: <T,>(ruta: string, cuerpo?: unknown) => solicitar<T>('PATCH', ruta, cuerpo),
    put: <T,>(ruta: string, cuerpo?: unknown) => solicitar<T>('PUT', ruta, cuerpo),
    delete: <T,>(ruta: string) => solicitar<T>('DELETE', ruta),
  };
}

export function loginApi(cliente: ClienteHttp, entrada: EntradaLogin): Promise<ResultadoLogin> {
  return cliente.post<ResultadoLogin>('/api/public/login', entrada);
}

export function registrarPacienteApi(
  cliente: ClienteHttp,
  entrada: EntradaRegistroPaciente,
): Promise<ResultadoRegistroPaciente> {
  return cliente.post<ResultadoRegistroPaciente>('/api/public/pacientes/registro', entrada);
}
