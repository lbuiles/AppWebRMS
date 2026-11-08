import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// ============================================================
// INTERFACES
// ============================================================

export type TipoRegistro = 'Actividad' | 'VisitaSupervision' | 'Permiso' | 'Descanso' | 'Disponible' | 'Locativa';

export interface CuadrillaHistorial {
  id: string;
  fecha: string;
  texto: string;
  usuario?: { id: string; nombre: string } | null;
}

export interface CuadrillaActividad {
  id: string;
  fecha: string;
  tecnicoId: string;
  cuadrillaId?: string | null;
  proyectoId?: string | null;
  proyectoReferencia?: string | null;
  lineaNegocio?: string | null;
  tipoRegistro: TipoRegistro;
  actividad: string;
  ot?: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  horasPlaneadas?: number | null;
  horasReales?: number | null;
  prioridad: string;
  estado: string;
  estadoPlanificacion: string;
  tipoNovedad?: string | null;
  detalleBloqueo?: string | null;
  siguienteAccion?: string | null;
  observaciones?: string | null;
  fechaCierre?: string | null;
  supervisorTipo?: string | null;
  supervisorContactoId?: string | null;
  supervisorUsuarioId?: string | null;
  supervisorNombre?: string | null;
  tecnico?: { id: string; nombre: string } | null;
  cuadrilla?: { id: string; nombre: string } | null;
  proyecto?: { id: string; codigo: string; nombre: string; lineaNegocio: string } | null;
  historial?: CuadrillaHistorial[];
}

export interface CuadrillaTecnico { id: string; nombre: string; cuadrillas: string[]; }

export interface CuadrillaProyectoOpcion {
  id: string; codigo: string; nombre: string; lineaNegocio: string;
  clienteId: string; clienteNombre: string; supervisorCliente?: string | null;
}

export interface CuadrillaSupervisorOpcion { id: string; nombre: string; cargo?: string | null; tipo: string; }

export interface CuadrillaMiembro { usuarioId: string; usuario?: { id: string; nombre: string } | null; }
export interface Cuadrilla {
  id: string; nombre: string; lineaNegocio?: string | null; activa: boolean; miembros: CuadrillaMiembro[];
}

export interface CuadrillaCompensatorio {
  tecnicoId: string; tecnicoNombre: string; diasAcumulados: number; diasGastados: number; diasPendientes: number;
}

export interface CuadrillaConfigHoras {
  id: string; tecnicoId?: string | null; horasSemanales: number; diasLaborales: number; vigenteDesde: string;
  tecnico?: { id: string; nombre: string } | null;
}

export interface CuadrillaCopiaResultado { copiadas: number; omitidas: number; detalle?: string | null; }

export interface CuadrillaParametros { diasMaxRetroactivo: number; }

export interface CuadrillaFestivo { fecha: string; nombre: string; }

export interface CuadrillaDiaImproductivoManual {
  id: string; tecnicoId: string; fecha: string; tipo: string; motivo: string;
  tecnico?: { id: string; nombre: string } | null;
}

export interface CuadrillaIndicador {
  codigo: string; titulo: string; valor?: number | null; numerador: number; denominador: number;
  meta?: number | null; peso?: number | null; tieneDatos: boolean; cumple?: boolean | null;
  formula: string; frecuencia: string;
}

export interface CuadrillaKpiBloque {
  indicadores: CuadrillaIndicador[];
  horasProductivas: number; horasDisponibles: number; diasImproductivos: number; diasJustificados: number;
}

export interface CuadrillaDiaImproductivo {
  tecnicoId: string; tecnicoNombre: string; fecha: string; origen: string; motivo: string; justificado: boolean;
}

export interface CuadrillaKpiResult {
  desde: string; hasta: string; corteHasta: string; notas: string[];
  global: CuadrillaKpiBloque;
  porTecnico: { tecnicoId: string; tecnicoNombre: string; resultado: CuadrillaKpiBloque }[];
  diasImproductivos: CuadrillaDiaImproductivo[];
}

/** Datos de PLANIFICACIÓN (los edita quien programa). `fecha` en formato 'YYYY-MM-DD'. */
export interface CuadrillaActividadInput {
  fecha: string;
  tecnicoId: string;
  cuadrillaId?: string | null;
  proyectoId?: string | null;
  proyectoReferencia?: string | null;
  lineaNegocio?: string | null;
  tipoRegistro: string;
  actividad?: string | null;
  ot?: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  horasPlaneadas?: number | null;
  prioridad?: string | null;
  estado?: string | null;
  estadoPlanificacion?: string | null;
  supervisorTipo?: string | null;
  supervisorContactoId?: string | null;
  supervisorUsuarioId?: string | null;
  supervisorNombre?: string | null;
  observaciones?: string | null;
  permitirCruce?: boolean | null;
}

export interface CuadrillaEjecucionInput {
  estado: string;
  horasReales?: number | null;
  tipoNovedad?: string | null;
  detalleBloqueo?: string | null;
  siguienteAccion?: string | null;
  observaciones?: string | null;
  fechaCierre?: string | null;
}

/** Convierte 'YYYY-MM-DD' al ISO completo que espera HotChocolate DateTime */
export function toIsoDate(d: string): string {
  return d.substring(0, 10) + 'T00:00:00.000Z';
}

/** Extrae 'YYYY-MM-DD' de lo que devuelve la API (sin conversión de zona horaria) */
export function soloFecha(d?: string | null): string {
  return d ? d.substring(0, 10) : '';
}

// ============================================================
// FRAGMENTOS / QUERIES
// ============================================================

const ACTIVIDAD_FIELDS = `
  id fecha tecnicoId cuadrillaId proyectoId proyectoReferencia lineaNegocio tipoRegistro actividad ot
  horaInicio horaFin horasPlaneadas horasReales prioridad estado estadoPlanificacion tipoNovedad
  detalleBloqueo siguienteAccion observaciones fechaCierre
  supervisorTipo supervisorContactoId supervisorUsuarioId supervisorNombre
  tecnico { id nombre }
  cuadrilla { id nombre }
  proyecto { id codigo nombre lineaNegocio }
`;

const ACTIVIDAD_DETALLE_FIELDS = `
  ${ACTIVIDAD_FIELDS}
  historial { id fecha texto usuario { id nombre } }
`;

const BLOQUE_FIELDS = `
  indicadores { codigo titulo valor numerador denominador meta peso tieneDatos cumple formula frecuencia }
  horasProductivas horasDisponibles diasImproductivos diasJustificados
`;

const GET_ACTIVIDADES = gql`
  query CuadrillaActividades($desde: DateTime!, $hasta: DateTime!) {
    cuadrillaActividades(desde: $desde, hasta: $hasta) { ${ACTIVIDAD_FIELDS} }
  }
`;

const GET_ACTIVIDAD = gql`
  query CuadrillaActividad($id: UUID!) {
    cuadrillaActividad(id: $id) { ${ACTIVIDAD_DETALLE_FIELDS} }
  }
`;

const GET_TECNICOS = gql`
  query CuadrillaTecnicos { cuadrillaTecnicos { id nombre cuadrillas } }
`;

const GET_CUADRILLAS = gql`
  query Cuadrillas {
    cuadrillas { id nombre lineaNegocio activa miembros { usuarioId usuario { id nombre } } }
  }
`;

const GET_PROYECTOS_DISPONIBLES = gql`
  query CuadrillaProyectosDisponibles {
    cuadrillaProyectosDisponibles { id codigo nombre lineaNegocio clienteId clienteNombre supervisorCliente }
  }
`;

const GET_SUPERVISORES_CLIENTE = gql`
  query CuadrillaSupervisoresCliente($proyectoId: UUID!) {
    cuadrillaSupervisoresCliente(proyectoId: $proyectoId) { id nombre cargo tipo }
  }
`;

const GET_SUPERVISORES_INTERNOS = gql`
  query CuadrillaSupervisoresInternos {
    cuadrillaSupervisoresInternos { id nombre cargo tipo }
  }
`;

const GET_KPIS = gql`
  query CuadrillaKpis($desde: DateTime!, $hasta: DateTime!, $tecnicoId: UUID, $cuadrillaId: UUID, $proyectoId: UUID) {
    cuadrillaKpis(desde: $desde, hasta: $hasta, tecnicoId: $tecnicoId, cuadrillaId: $cuadrillaId, proyectoId: $proyectoId) {
      desde hasta corteHasta notas
      global { ${BLOQUE_FIELDS} }
      porTecnico { tecnicoId tecnicoNombre resultado { ${BLOQUE_FIELDS} } }
      diasImproductivos { tecnicoId tecnicoNombre fecha origen motivo justificado }
    }
  }
`;

const GET_COMPENSATORIOS = gql`
  query CuadrillaCompensatorios {
    cuadrillaCompensatorios { tecnicoId tecnicoNombre diasAcumulados diasGastados diasPendientes }
  }
`;

const GET_CONFIG_HORAS = gql`
  query CuadrillaConfigHoras {
    cuadrillaConfigHoras { id tecnicoId horasSemanales diasLaborales vigenteDesde tecnico { id nombre } }
  }
`;

const GET_FESTIVOS = gql`
  query CuadrillaFestivos($anio: Int!) { cuadrillaFestivos(anio: $anio) { fecha nombre } }
`;

const GET_DIAS_IMPRODUCTIVOS = gql`
  query CuadrillaDiasImproductivos($desde: DateTime!, $hasta: DateTime!, $tecnicoId: UUID) {
    cuadrillaDiasImproductivos(desde: $desde, hasta: $hasta, tecnicoId: $tecnicoId) {
      id tecnicoId fecha tipo motivo tecnico { id nombre }
    }
  }
`;

// ============================================================
// MUTATIONS
// ============================================================

const CREAR_ACTIVIDAD = gql`
  mutation CrearCuadrillaActividad($input: CuadrillaActividadInput!) {
    crearCuadrillaActividad(input: $input) { ${ACTIVIDAD_DETALLE_FIELDS} }
  }
`;

const CREAR_LOTE = gql`
  mutation CrearCuadrillaActividadesLote($input: CuadrillaActividadInput!, $tecnicoIds: [UUID!]!, $fechas: [DateTime!]!) {
    crearCuadrillaActividadesLote(input: $input, tecnicoIds: $tecnicoIds, fechas: $fechas)
  }
`;

const COPIAR_SEMANA = gql`
  mutation CopiarCuadrillaSemana($semanaOrigen: DateTime!, $semanaDestino: DateTime!, $tecnicoIds: [UUID!], $permitirCruce: Boolean) {
    copiarCuadrillaSemana(semanaOrigen: $semanaOrigen, semanaDestino: $semanaDestino, tecnicoIds: $tecnicoIds, permitirCruce: $permitirCruce) {
      copiadas omitidas detalle
    }
  }
`;

const ACTUALIZAR_ACTIVIDAD = gql`
  mutation ActualizarCuadrillaActividad($id: UUID!, $input: CuadrillaActividadInput!) {
    actualizarCuadrillaActividad(id: $id, input: $input) { ${ACTIVIDAD_DETALLE_FIELDS} }
  }
`;

const ACTUALIZAR_EJECUCION = gql`
  mutation ActualizarEjecucionCuadrillaActividad($id: UUID!, $input: CuadrillaEjecucionInput!) {
    actualizarEjecucionCuadrillaActividad(id: $id, input: $input) { ${ACTIVIDAD_DETALLE_FIELDS} }
  }
`;

const ELIMINAR_ACTIVIDAD = gql`
  mutation EliminarCuadrillaActividad($id: UUID!) { eliminarCuadrillaActividad(id: $id) }
`;

const MARCAR_DIA_IMPRODUCTIVO = gql`
  mutation MarcarCuadrillaDiaImproductivo($tecnicoId: UUID!, $fecha: DateTime!, $tipo: String!, $motivo: String!) {
    marcarCuadrillaDiaImproductivo(tecnicoId: $tecnicoId, fecha: $fecha, tipo: $tipo, motivo: $motivo) {
      id tecnicoId fecha tipo motivo
    }
  }
`;

const ELIMINAR_DIA_IMPRODUCTIVO = gql`
  mutation EliminarCuadrillaDiaImproductivo($id: UUID!) { eliminarCuadrillaDiaImproductivo(id: $id) }
`;

const GUARDAR_COMPENSATORIO = gql`
  mutation GuardarCuadrillaCompensatorio($tecnicoId: UUID!, $diasAcumulados: Decimal!) {
    guardarCuadrillaCompensatorio(tecnicoId: $tecnicoId, diasAcumulados: $diasAcumulados)
  }
`;

const GUARDAR_CONFIG_HORAS = gql`
  mutation GuardarCuadrillaConfigHoras($input: CuadrillaConfigHorasInput!) {
    guardarCuadrillaConfigHoras(input: $input) { id tecnicoId horasSemanales diasLaborales vigenteDesde }
  }
`;

const GET_PARAMETROS = gql`
  query CuadrillaParametros { cuadrillaParametros { diasMaxRetroactivo } }
`;

const GUARDAR_PARAMETROS = gql`
  mutation GuardarCuadrillaParametros($diasMaxRetroactivo: Int!) {
    guardarCuadrillaParametros(diasMaxRetroactivo: $diasMaxRetroactivo) { diasMaxRetroactivo }
  }
`;

const ELIMINAR_CONFIG_HORAS = gql`
  mutation EliminarCuadrillaConfigHoras($id: UUID!) { eliminarCuadrillaConfigHoras(id: $id) }
`;

const GUARDAR_FESTIVO = gql`
  mutation GuardarCuadrillaFestivo($fecha: DateTime!, $nombre: String!) {
    guardarCuadrillaFestivo(fecha: $fecha, nombre: $nombre) { fecha nombre }
  }
`;

const ELIMINAR_FESTIVO = gql`
  mutation EliminarCuadrillaFestivo($fecha: DateTime!) { eliminarCuadrillaFestivo(fecha: $fecha) }
`;

const GUARDAR_CUADRILLA = gql`
  mutation GuardarCuadrilla($id: UUID, $nombre: String!, $lineaNegocio: String, $activa: Boolean!) {
    guardarCuadrilla(id: $id, nombre: $nombre, lineaNegocio: $lineaNegocio, activa: $activa) { id nombre }
  }
`;

const AGREGAR_MIEMBRO = gql`
  mutation AgregarMiembroCuadrilla($cuadrillaId: UUID!, $usuarioId: UUID!) {
    agregarMiembroCuadrilla(cuadrillaId: $cuadrillaId, usuarioId: $usuarioId)
  }
`;

const QUITAR_MIEMBRO = gql`
  mutation QuitarMiembroCuadrilla($cuadrillaId: UUID!, $usuarioId: UUID!) {
    quitarMiembroCuadrilla(cuadrillaId: $cuadrillaId, usuarioId: $usuarioId)
  }
`;

// ============================================================
// SERVICE
// ============================================================

@Injectable({ providedIn: 'root' })
export class CuadrillaService {
  private apollo = inject(Apollo);
  private http = inject(HttpClient);

  private q<T>(query: any, variables: any, campo: string, vacio: T): Observable<T> {
    return this.apollo.query<any>({ query, variables, fetchPolicy: 'network-only' })
      .pipe(map(r => (r.data?.[campo] ?? vacio) as T));
  }

  private m<T>(mutation: any, variables: any, campo: string): Observable<T> {
    return this.apollo.mutate<any>({ mutation, variables }).pipe(map(r => r.data?.[campo] as T));
  }

  // ── Queries ──────────────────────────────────────────────
  getActividades(desde: string, hasta: string): Observable<CuadrillaActividad[]> {
    return this.q(GET_ACTIVIDADES, { desde: toIsoDate(desde), hasta: toIsoDate(hasta) }, 'cuadrillaActividades', []);
  }
  getActividad(id: string): Observable<CuadrillaActividad | null> {
    return this.q(GET_ACTIVIDAD, { id }, 'cuadrillaActividad', null);
  }
  getTecnicos(): Observable<CuadrillaTecnico[]> {
    return this.q(GET_TECNICOS, {}, 'cuadrillaTecnicos', []);
  }
  getCuadrillas(): Observable<Cuadrilla[]> {
    return this.q(GET_CUADRILLAS, {}, 'cuadrillas', []);
  }
  getProyectosDisponibles(): Observable<CuadrillaProyectoOpcion[]> {
    return this.q(GET_PROYECTOS_DISPONIBLES, {}, 'cuadrillaProyectosDisponibles', []);
  }
  getSupervisoresCliente(proyectoId: string): Observable<CuadrillaSupervisorOpcion[]> {
    return this.q(GET_SUPERVISORES_CLIENTE, { proyectoId }, 'cuadrillaSupervisoresCliente', []);
  }
  getSupervisoresInternos(): Observable<CuadrillaSupervisorOpcion[]> {
    return this.q(GET_SUPERVISORES_INTERNOS, {}, 'cuadrillaSupervisoresInternos', []);
  }
  getKpis(desde: string, hasta: string, tecnicoId?: string | null, cuadrillaId?: string | null, proyectoId?: string | null): Observable<CuadrillaKpiResult | null> {
    return this.q(GET_KPIS, {
      desde: toIsoDate(desde), hasta: toIsoDate(hasta),
      tecnicoId: tecnicoId || null, cuadrillaId: cuadrillaId || null, proyectoId: proyectoId || null
    }, 'cuadrillaKpis', null);
  }
  getCompensatorios(): Observable<CuadrillaCompensatorio[]> {
    return this.q(GET_COMPENSATORIOS, {}, 'cuadrillaCompensatorios', []);
  }
  getConfigHoras(): Observable<CuadrillaConfigHoras[]> {
    return this.q(GET_CONFIG_HORAS, {}, 'cuadrillaConfigHoras', []);
  }
  getFestivos(anio: number): Observable<CuadrillaFestivo[]> {
    return this.q(GET_FESTIVOS, { anio }, 'cuadrillaFestivos', []);
  }
  getDiasImproductivosManuales(desde: string, hasta: string, tecnicoId?: string | null): Observable<CuadrillaDiaImproductivoManual[]> {
    return this.q(GET_DIAS_IMPRODUCTIVOS, { desde: toIsoDate(desde), hasta: toIsoDate(hasta), tecnicoId: tecnicoId || null }, 'cuadrillaDiasImproductivos', []);
  }

  // ── Mutations ────────────────────────────────────────────
  crearActividad(input: CuadrillaActividadInput): Observable<CuadrillaActividad> {
    return this.m(CREAR_ACTIVIDAD, { input: this.prepararInput(input) }, 'crearCuadrillaActividad');
  }
  /** Crea la misma actividad para varios técnicos y fechas (todo o nada). Devuelve la cantidad creada. */
  crearLote(input: CuadrillaActividadInput, tecnicoIds: string[], fechas: string[]): Observable<number> {
    return this.m(CREAR_LOTE, {
      input: this.prepararInput({ ...input, tecnicoId: tecnicoIds[0], fecha: fechas[0] }),
      tecnicoIds, fechas: fechas.map(toIsoDate)
    }, 'crearCuadrillaActividadesLote');
  }
  copiarSemana(origen: string, destino: string, tecnicoIds: string[] | null, permitirCruce = false): Observable<CuadrillaCopiaResultado> {
    return this.m(COPIAR_SEMANA, {
      semanaOrigen: toIsoDate(origen), semanaDestino: toIsoDate(destino),
      tecnicoIds: tecnicoIds && tecnicoIds.length ? tecnicoIds : null, permitirCruce
    }, 'copiarCuadrillaSemana');
  }
  /** Descarga el Excel (actividades + KPI si tiene permiso) del rango indicado. */
  exportarExcel(desde: string, hasta: string, tecnicoId?: string | null): Observable<Blob> {
    let token = '';
    try { token = localStorage.getItem('rms_token') ?? ''; } catch { /* sin storage */ }
    const headers = new HttpHeaders({ Authorization: token ? `Bearer ${token}` : '' });
    let url = `${environment.restUrl}/cuadrilla-export/excel?desde=${desde}&hasta=${hasta}`;
    if (tecnicoId) url += `&tecnicoId=${tecnicoId}`;
    return this.http.get(url, { headers, responseType: 'blob' });
  }
  actualizarActividad(id: string, input: CuadrillaActividadInput): Observable<CuadrillaActividad> {
    return this.m(ACTUALIZAR_ACTIVIDAD, { id, input: this.prepararInput(input) }, 'actualizarCuadrillaActividad');
  }
  actualizarEjecucion(id: string, input: CuadrillaEjecucionInput): Observable<CuadrillaActividad> {
    const body = { ...input, fechaCierre: input.fechaCierre ? toIsoDate(input.fechaCierre) : null };
    return this.m(ACTUALIZAR_EJECUCION, { id, input: body }, 'actualizarEjecucionCuadrillaActividad');
  }
  eliminarActividad(id: string): Observable<boolean> {
    return this.m(ELIMINAR_ACTIVIDAD, { id }, 'eliminarCuadrillaActividad');
  }
  marcarDiaImproductivo(tecnicoId: string, fecha: string, tipo: 'MARCADO' | 'JUSTIFICADO', motivo: string): Observable<CuadrillaDiaImproductivoManual> {
    return this.m(MARCAR_DIA_IMPRODUCTIVO, { tecnicoId, fecha: toIsoDate(fecha), tipo, motivo }, 'marcarCuadrillaDiaImproductivo');
  }
  eliminarDiaImproductivo(id: string): Observable<boolean> {
    return this.m(ELIMINAR_DIA_IMPRODUCTIVO, { id }, 'eliminarCuadrillaDiaImproductivo');
  }
  guardarCompensatorio(tecnicoId: string, diasAcumulados: number): Observable<boolean> {
    return this.m(GUARDAR_COMPENSATORIO, { tecnicoId, diasAcumulados }, 'guardarCuadrillaCompensatorio');
  }
  guardarConfigHoras(input: { tecnicoId?: string | null; horasSemanales: number; diasLaborales: number; vigenteDesde: string }): Observable<CuadrillaConfigHoras> {
    return this.m(GUARDAR_CONFIG_HORAS, {
      input: { ...input, tecnicoId: input.tecnicoId || null, vigenteDesde: toIsoDate(input.vigenteDesde) }
    }, 'guardarCuadrillaConfigHoras');
  }
  getParametros(): Observable<CuadrillaParametros> {
    return this.q(GET_PARAMETROS, {}, 'cuadrillaParametros', { diasMaxRetroactivo: 7 });
  }
  guardarParametros(diasMaxRetroactivo: number): Observable<CuadrillaParametros> {
    return this.m(GUARDAR_PARAMETROS, { diasMaxRetroactivo }, 'guardarCuadrillaParametros');
  }
  eliminarConfigHoras(id: string): Observable<boolean> {
    return this.m(ELIMINAR_CONFIG_HORAS, { id }, 'eliminarCuadrillaConfigHoras');
  }
  guardarFestivo(fecha: string, nombre: string): Observable<CuadrillaFestivo> {
    return this.m(GUARDAR_FESTIVO, { fecha: toIsoDate(fecha), nombre }, 'guardarCuadrillaFestivo');
  }
  eliminarFestivo(fecha: string): Observable<boolean> {
    return this.m(ELIMINAR_FESTIVO, { fecha: toIsoDate(fecha) }, 'eliminarCuadrillaFestivo');
  }
  guardarCuadrilla(id: string | null, nombre: string, lineaNegocio: string | null, activa: boolean): Observable<{ id: string; nombre: string }> {
    return this.m(GUARDAR_CUADRILLA, { id, nombre, lineaNegocio, activa }, 'guardarCuadrilla');
  }
  agregarMiembro(cuadrillaId: string, usuarioId: string): Observable<boolean> {
    return this.m(AGREGAR_MIEMBRO, { cuadrillaId, usuarioId }, 'agregarMiembroCuadrilla');
  }
  quitarMiembro(cuadrillaId: string, usuarioId: string): Observable<boolean> {
    return this.m(QUITAR_MIEMBRO, { cuadrillaId, usuarioId }, 'quitarMiembroCuadrilla');
  }

  /** Normaliza strings vacíos a null y la fecha al ISO que espera la API. */
  private prepararInput(i: CuadrillaActividadInput): any {
    const limpio: any = { ...i, fecha: toIsoDate(i.fecha) };
    for (const k of Object.keys(limpio)) {
      if (typeof limpio[k] === 'string' && limpio[k].trim() === '') limpio[k] = null;
    }
    return limpio;
  }
}

/** ¿El error de Apollo es el aviso de cruce horario? */
export function esCruceHorario(err: any): boolean {
  return err?.graphQLErrors?.some((e: any) => e?.extensions?.code === 'CRUCE_HORARIO') === true;
}

/** Mensaje legible de un error de Apollo/GraphQL. */
export function mensajeError(err: any, porDefecto = 'No se pudo completar la operación.'): string {
  return err?.graphQLErrors?.[0]?.message || err?.message || porDefecto;
}
