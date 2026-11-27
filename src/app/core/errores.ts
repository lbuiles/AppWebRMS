import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';

/**
 * Utilidades para leer errores de Apollo Client 4.
 * En Apollo 4 los errores ya no traen `graphQLErrors` / `networkError`:
 *  - errores de GraphQL llegan como CombinedGraphQLErrors (con `errors`),
 *  - respuestas HTTP no exitosas llegan como ServerError (con `statusCode` y `bodyText`),
 *  - sin conexión llega un Error genérico ("... 0 Unknown Error").
 */

export interface ErrorGraphQL {
  message: string;
  extensions?: Record<string, any>;
}

/** Errores de GraphQL del error de Apollo (también los que vienen dentro de una respuesta HTTP 4xx/5xx). */
export function erroresGraphQL(err: any): ErrorGraphQL[] {
  if (!err) return [];
  if (CombinedGraphQLErrors.is(err)) return [...err.errors] as ErrorGraphQL[];
  if (Array.isArray(err.graphQLErrors)) return err.graphQLErrors;  // compatibilidad con Apollo 3
  if (ServerError.is(err)) {
    try {
      const cuerpo = JSON.parse(err.bodyText || '{}');
      if (Array.isArray(cuerpo?.errors)) return cuerpo.errors;
    } catch { /* cuerpo que no es JSON */ }
  }
  return [];
}

/** Código del primer error (p. ej. AUTH_NOT_AUTHENTICATED, AUTH_NOT_AUTHORIZED, CRUCE_HORARIO). */
export function codigosError(err: any): string[] {
  return erroresGraphQL(err).map(e => e?.extensions?.['code']).filter(Boolean);
}

/** Estado HTTP del error, o 0 si no hubo respuesta del servidor. */
export function estadoHttp(err: any): number | null {
  if (ServerError.is(err)) return err.statusCode;
  if (typeof err?.status === 'number') return err.status;
  if (/\b0 Unknown Error\b/i.test(String(err?.message ?? ''))) return 0;
  return null;
}

export function esSinConexion(err: any): boolean {
  return estadoHttp(err) === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

export function esSesionVencida(err: any): boolean {
  return estadoHttp(err) === 401 || codigosError(err).includes('AUTH_NOT_AUTHENTICATED');
}

export function esSinPermiso(err: any): boolean {
  return estadoHttp(err) === 403 || codigosError(err).includes('AUTH_NOT_AUTHORIZED');
}

/** Mensajes técnicos del servidor que no le dicen nada al usuario. */
const TECNICO = /unexpected execution error|the variables? |is not compatible with the type|syntax error|cannot be null|was not found on the type/i;

/**
 * Mensaje en español, entendible para el usuario, a partir de cualquier error de Apollo/HTTP.
 * Si el servidor envió un mensaje de negocio (validaciones), se muestra ese.
 */
export function mensajeError(err: any, porDefecto = 'No se pudo completar la operación.'): string {
  if (esSinConexion(err)) return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
  if (esSesionVencida(err)) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (esSinPermiso(err)) return 'No tienes permiso para realizar esta acción.';

  const delServidor = erroresGraphQL(err).map(e => e?.message).find(m => !!m && !TECNICO.test(m));
  if (delServidor) return delServidor;

  const estado = estadoHttp(err);
  if (estado !== null && estado >= 500) return 'El servidor tuvo un problema. Intenta de nuevo en unos minutos.';
  return porDefecto;
}
