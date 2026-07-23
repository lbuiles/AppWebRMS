import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';

// ============================================================
// INTERFACES
// ============================================================

export interface EstadoTarea {
  id: number;
  nombre: string;
  color: string;
  orden: number;
  esEstadoInicial: boolean;
  esEstadoFinal: boolean;
  activo: boolean;
}

export interface TareaAsignado {
  tareaId: string;
  usuarioId: string;
  asignadoPorId: string;
  fechaAsignacion: string;
  usuario: { id: string; nombre: string; avatarUrl?: string };
  asignadoPor: { id: string; nombre: string };
}

export interface TareaComentario {
  id: string;
  tareaId: string;
  usuarioId: string;
  comentario: string;
  fechaRegistro: string;
  usuario: { id: string; nombre: string; avatarUrl?: string };
}

export interface TareaMovimiento {
  id: string;
  tareaId: string;
  semanaOrigen: string;
  semanaDestino: string;
  fechaMovimiento: string;
  motivo?: string;
  movidoPor: { id: string; nombre: string };
}

export interface TareaHistorialEstado {
  id: string;
  tareaId: string;
  estadoAnteriorId?: number;
  estadoNuevoId: number;
  fechaCambio: string;
  estadoAnterior?: { id: number; nombre: string; color: string };
  estadoNuevo: { id: number; nombre: string; color: string };
  cambiadoPor: { id: string; nombre: string };
}

export interface Tarea {
  id: string;
  titulo: string;
  descripcion?: string;
  estadoId: number;
  estado: EstadoTarea;
  fechaPresupuestoInicio?: string;
  fechaPresupuestoFin?: string;
  fechaRealFinalizacion?: string;
  semanaProgramada: string;
  vecesMovida: number;
  creadoPorId: string;
  creadoPor: { id: string; nombre: string; avatarUrl?: string };
  fechaCreacion: string;
  fechaActualizacion?: string;
  asignados: TareaAsignado[];
  comentarios: TareaComentario[];
  movimientos: TareaMovimiento[];
  historialEstados: TareaHistorialEstado[];
}

export interface TareaResumenDto {
  id: string;
  titulo: string;
  estadoNombre: string;
  estadoColor: string;
  fechaPresupuestoFin?: string;
  vecesMovida: number;
  asignados: string[];
}

export interface TareaPersonaResumenDto {
  id: string;
  titulo: string;
  estadoNombre: string;
  estadoColor: string;
  esEstadoFinal: boolean;
  semanaProgramada: string;
  fechaPresupuestoFin?: string;
  fechaRealFinalizacion?: string;
  vecesMovida: number;
  esVencida: boolean;
  /** La tarea se completó después del domingo de la semana programada */
  completadaTarde: boolean;
  /** Días de retraso respecto al domingo de la semana programada (0 = a tiempo) */
  diasRetraso: number;
}

export interface CumplimientoPersonaDto {
  usuarioId: string;
  nombre: string;
  avatarUrl?: string;
  total: number;
  completadas: number;
  /** Completadas dentro del domingo de la semana programada */
  completadasATiempo: number;
  /** Completadas después del domingo de la semana programada */
  completadasTarde: number;
  pendientes: number;
  vencidas: number;
  movidas: number;
  /** % de tareas completadas (a tiempo + tarde) sobre el total */
  porcentajeCumplimiento: number;
  /** % de tareas completadas A TIEMPO sobre el total */
  porcentajeATiempo: number;
  /** % de tareas completadas CON RETRASO sobre el total */
  porcentajeTarde: number;
  tareas: TareaPersonaResumenDto[];
}

export interface CumplimientoPersonaMesDto {
  usuarioId: string;
  nombre: string;
  avatarUrl?: string;
  total: number;
  completadas: number;
  completadasATiempo: number;
  completadasTarde: number;
  vencidas: number;
  porcentajeCumplimiento: number;
  porcentajeATiempo: number;
  porcentajeTarde: number;
}

export interface CumplimientoMensualDto {
  anio: number;
  mes: number;
  nombreMes: string;
  total: number;
  completadas: number;
  completadasATiempo: number;
  completadasTarde: number;
  vencidas: number;
  porcentajeCumplimiento: number;
  porcentajeATiempo: number;
  porcentajeTarde: number;
  personas: CumplimientoPersonaMesDto[];
}

export interface TareaDetalleReporteDto {
  id: string;
  titulo: string;
  descripcion?: string;
  semanaProgramada: string;
  estadoNombre: string;
  estadoColor: string;
  esEstadoFinal: boolean;
  responsables: string[];
  fechaPresupuestoInicio?: string;
  fechaPresupuestoFin?: string;
  fechaRealFinalizacion?: string;
  /** Días entre FechaPresupuestoFin y FechaRealFinalizacion (positivo = tarde, negativo = adelantado) */
  diasVsPresupuesto?: number | null;
  vecesMovida: number;
  esVencida: boolean;
  completadaTarde: boolean;
  diasRetraso: number;
  comentariosCount: number;
}

export interface ReporteSemanalDto {
  semana: string;
  totalTareas: number;
  completadas: number;
  vencidas: number;
  movidas: number;
  porcentajeCumplimiento: number;
  tareasVencidas: TareaResumenDto[];
  tareasMovidasMultiple: TareaResumenDto[];
}

// ============================================================
// GQL FRAGMENTS
// ============================================================

const TAREA_CARD_FIELDS = `
  id titulo descripcion estadoId vecesMovida
  semanaProgramada fechaPresupuestoInicio fechaPresupuestoFin fechaRealFinalizacion
  fechaCreacion fechaActualizacion
  estado { id nombre color orden esEstadoFinal }
  creadoPor { id nombre avatarUrl }
  asignados { tareaId usuarioId usuario { id nombre avatarUrl } }
`;

const TAREA_FULL_FIELDS = `
  id titulo descripcion estadoId vecesMovida
  semanaProgramada fechaPresupuestoInicio fechaPresupuestoFin fechaRealFinalizacion
  fechaCreacion fechaActualizacion creadoPorId
  estado { id nombre color orden esEstadoInicial esEstadoFinal }
  creadoPor { id nombre avatarUrl }
  asignados { tareaId usuarioId fechaAsignacion
    usuario { id nombre avatarUrl }
    asignadoPor { id nombre }
  }
  comentarios { id comentario fechaRegistro usuario { id nombre avatarUrl } }
  movimientos { id semanaOrigen semanaDestino fechaMovimiento motivo movidoPor { id nombre } }
  historialEstados {
    id estadoAnteriorId estadoNuevoId fechaCambio
    estadoAnterior { id nombre color }
    estadoNuevo { id nombre color }
    cambiadoPor { id nombre }
  }
`;

// ============================================================
// QUERIES
// ============================================================

const GET_TAREAS_SEMANA = gql`
  query GetTareasSemana($semana: DateTime!) {
    tareasSemana(semana: $semana) { ${TAREA_CARD_FIELDS} }
  }
`;

const GET_TAREA = gql`
  query GetTarea($id: UUID!) {
    tarea(id: $id) { ${TAREA_FULL_FIELDS} }
  }
`;

const GET_ESTADOS_TAREA = gql`
  query GetEstadosTarea {
    estadosTarea { id nombre color orden esEstadoInicial esEstadoFinal activo }
  }
`;

const GET_TODOS_ESTADOS_TAREA = gql`
  query GetTodosEstadosTarea {
    todosEstadosTarea { id nombre color orden esEstadoInicial esEstadoFinal activo }
  }
`;

const GET_REPORTE_SEMANAL = gql`
  query GetReporteSemanal($semana: DateTime!) {
    reporteSemanal(semana: $semana) {
      semana totalTareas completadas vencidas movidas porcentajeCumplimiento
      tareasVencidas { id titulo estadoNombre estadoColor fechaPresupuestoFin vecesMovida asignados }
      tareasMovidasMultiple { id titulo estadoNombre estadoColor fechaPresupuestoFin vecesMovida asignados }
    }
  }
`;

const GET_MIS_TAREAS = gql`
  query GetMisTareas($usuarioId: UUID!) {
    misTareas(usuarioId: $usuarioId) { ${TAREA_CARD_FIELDS} }
  }
`;

const GET_CUMPLIMIENTO_MENSUAL = gql`
  query GetCumplimientoMensual($anio: Int!) {
    cumplimientoMensual(anio: $anio) {
      anio mes nombreMes
      total completadas completadasATiempo completadasTarde vencidas
      porcentajeCumplimiento porcentajeATiempo porcentajeTarde
      personas {
        usuarioId nombre avatarUrl
        total completadas completadasATiempo completadasTarde vencidas
        porcentajeCumplimiento porcentajeATiempo porcentajeTarde
      }
    }
  }
`;

const GET_TAREAS_DETALLE = gql`
  query GetTareasDetalle($desde: DateTime!, $hasta: DateTime!) {
    tareasDetalle(desde: $desde, hasta: $hasta) {
      id titulo descripcion semanaProgramada
      estadoNombre estadoColor esEstadoFinal
      responsables
      fechaPresupuestoInicio fechaPresupuestoFin fechaRealFinalizacion
      diasVsPresupuesto vecesMovida esVencida completadaTarde diasRetraso comentariosCount
    }
  }
`;

const GET_CUMPLIMIENTO_PERSONAS = gql`
  query GetCumplimientoPersonas($desde: DateTime!, $hasta: DateTime!) {
    cumplimientoPersonas(desde: $desde, hasta: $hasta) {
      usuarioId nombre avatarUrl
      total completadas completadasATiempo completadasTarde pendientes vencidas movidas
      porcentajeCumplimiento porcentajeATiempo porcentajeTarde
      tareas {
        id titulo estadoNombre estadoColor esEstadoFinal
        semanaProgramada fechaPresupuestoFin fechaRealFinalizacion
        vecesMovida esVencida completadaTarde diasRetraso
      }
    }
  }
`;

// ============================================================
// MUTATIONS
// ============================================================

const ADD_TAREA = gql`
  mutation AddTarea($input: TareaInput!) {
    addTarea(input: $input) { ${TAREA_CARD_FIELDS} }
  }
`;

const UPDATE_TAREA = gql`
  mutation UpdateTarea($id: UUID!, $input: TareaUpdateInput!) {
    updateTarea(id: $id, input: $input) { ${TAREA_CARD_FIELDS} }
  }
`;

const CAMBIAR_ESTADO_TAREA = gql`
  mutation CambiarEstadoTarea($input: CambiarEstadoInput!) {
    cambiarEstadoTarea(input: $input) { id estadoId estado { id nombre color } fechaRealFinalizacion }
  }
`;

const MOVER_TAREA_SEMANA = gql`
  mutation MoverTareaSemana($input: MoverTareaInput!) {
    moverTareaSemana(input: $input) { id semanaProgramada vecesMovida }
  }
`;

const ADD_COMENTARIO = gql`
  mutation AddComentarioTarea($input: ComentarioInput!) {
    addComentarioTarea(input: $input) {
      id comentario fechaRegistro usuario { id nombre avatarUrl }
    }
  }
`;

const ASIGNAR_USUARIO = gql`
  mutation AsignarUsuarioTarea($input: AsignarUsuarioInput!) {
    asignarUsuarioTarea(input: $input) {
      id asignados { tareaId usuarioId usuario { id nombre avatarUrl } }
    }
  }
`;

const DESASIGNAR_USUARIO = gql`
  mutation DesasignarUsuarioTarea($tareaId: UUID!, $usuarioId: UUID!) {
    desasignarUsuarioTarea(tareaId: $tareaId, usuarioId: $usuarioId)
  }
`;

const DELETE_TAREA = gql`
  mutation DeleteTarea($id: UUID!) {
    deleteTarea(id: $id)
  }
`;

const ADD_ESTADO_TAREA = gql`
  mutation AddEstadoTarea($input: EstadoTareaInput!) {
    addEstadoTarea(input: $input) { id nombre color orden esEstadoInicial esEstadoFinal activo }
  }
`;

const UPDATE_ESTADO_TAREA = gql`
  mutation UpdateEstadoTarea($id: Int!, $input: EstadoTareaInput!) {
    updateEstadoTarea(id: $id, input: $input) { id nombre color orden esEstadoInicial esEstadoFinal activo }
  }
`;

const TOGGLE_ESTADO_TAREA = gql`
  mutation ToggleEstadoTarea($id: Int!) {
    toggleEstadoTarea(id: $id)
  }
`;

// ============================================================
// SERVICE
// ============================================================

@Injectable({ providedIn: 'root' })
export class TareaService {
  private apollo = inject(Apollo);

  // ── Queries ──────────────────────────────────────────────

  getTareasSemana(semana: Date): Observable<Tarea[]> {
    return this.apollo.query<any>({
      query: GET_TAREAS_SEMANA,
      variables: { semana: semana.toISOString() },
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.tareasSemana ?? []));
  }

  getTarea(id: string): Observable<Tarea | null> {
    return this.apollo.query<any>({
      query: GET_TAREA,
      variables: { id },
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.tarea ?? null));
  }

  getEstadosTarea(): Observable<EstadoTarea[]> {
    return this.apollo.query<any>({
      query: GET_ESTADOS_TAREA,
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.estadosTarea ?? []));
  }

  getTodosEstadosTarea(): Observable<EstadoTarea[]> {
    return this.apollo.query<any>({
      query: GET_TODOS_ESTADOS_TAREA,
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.todosEstadosTarea ?? []));
  }

  getReporteSemanal(semana: Date): Observable<ReporteSemanalDto> {
    return this.apollo.query<any>({
      query: GET_REPORTE_SEMANAL,
      variables: { semana: semana.toISOString() },
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.reporteSemanal));
  }

  getMisTareas(usuarioId: string): Observable<Tarea[]> {
    return this.apollo.query<any>({
      query: GET_MIS_TAREAS,
      variables: { usuarioId },
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.misTareas ?? []));
  }

  getCumplimientoMensual(anio: number): Observable<CumplimientoMensualDto[]> {
    return this.apollo.query<any>({
      query: GET_CUMPLIMIENTO_MENSUAL,
      variables: { anio },
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.cumplimientoMensual ?? []));
  }

  getTareasDetalle(desde: Date, hasta: Date): Observable<TareaDetalleReporteDto[]> {
    return this.apollo.query<any>({
      query: GET_TAREAS_DETALLE,
      variables: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.tareasDetalle ?? []));
  }

  getCumplimientoPersonas(desde: Date, hasta: Date): Observable<CumplimientoPersonaDto[]> {
    return this.apollo.query<any>({
      query: GET_CUMPLIMIENTO_PERSONAS,
      variables: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.cumplimientoPersonas ?? []));
  }

  // ── Mutations ─────────────────────────────────────────────

  addTarea(input: {
    titulo: string;
    descripcion?: string;
    estadoId: number;
    semanaProgramada: string;
    fechaPresupuestoInicio?: string;
    fechaPresupuestoFin?: string;
    creadoPorId: string;
    usuariosAsignados?: string[];
  }): Observable<Tarea> {
    return this.apollo.mutate<any>({
      mutation: ADD_TAREA,
      variables: { input }
    }).pipe(map(r => r.data?.addTarea));
  }

  updateTarea(id: string, input: {
    titulo: string;
    descripcion?: string;
    fechaPresupuestoInicio?: string;
    fechaPresupuestoFin?: string;
    fechaRealFinalizacion?: string;
  }): Observable<Tarea> {
    return this.apollo.mutate<any>({
      mutation: UPDATE_TAREA,
      variables: { id, input }
    }).pipe(map(r => r.data?.updateTarea));
  }

  cambiarEstado(tareaId: string, nuevoEstadoId: number, cambiadoPorId: string, fechaRealFinalizacion?: string): Observable<any> {
    return this.apollo.mutate<any>({
      mutation: CAMBIAR_ESTADO_TAREA,
      variables: { input: { tareaId, nuevoEstadoId, cambiadoPorId, fechaRealFinalizacion } }
    }).pipe(map(r => r.data?.cambiarEstadoTarea));
  }

  moverSemana(tareaId: string, nuevaSemana: string, movidoPorId: string, motivo?: string): Observable<any> {
    return this.apollo.mutate<any>({
      mutation: MOVER_TAREA_SEMANA,
      variables: { input: { tareaId, nuevaSemana, movidoPorId, motivo } }
    }).pipe(map(r => r.data?.moverTareaSemana));
  }

  addComentario(tareaId: string, usuarioId: string, comentario: string): Observable<TareaComentario> {
    return this.apollo.mutate<any>({
      mutation: ADD_COMENTARIO,
      variables: { input: { tareaId, usuarioId, comentario } }
    }).pipe(map(r => r.data?.addComentarioTarea));
  }

  asignarUsuario(tareaId: string, usuarioId: string, asignadoPorId: string): Observable<any> {
    return this.apollo.mutate<any>({
      mutation: ASIGNAR_USUARIO,
      variables: { input: { tareaId, usuarioId, asignadoPorId } }
    }).pipe(map(r => r.data?.asignarUsuarioTarea));
  }

  desasignarUsuario(tareaId: string, usuarioId: string): Observable<boolean> {
    return this.apollo.mutate<any>({
      mutation: DESASIGNAR_USUARIO,
      variables: { tareaId, usuarioId }
    }).pipe(map(r => r.data?.desasignarUsuarioTarea ?? false));
  }

  deleteTarea(id: string): Observable<boolean> {
    return this.apollo.mutate<any>({
      mutation: DELETE_TAREA,
      variables: { id }
    }).pipe(map(r => r.data?.deleteTarea ?? false));
  }

  // ── Admin Estados ─────────────────────────────────────────

  addEstado(input: {
    nombre: string; color: string; orden: number;
    esEstadoInicial: boolean; esEstadoFinal: boolean;
  }): Observable<EstadoTarea> {
    return this.apollo.mutate<any>({
      mutation: ADD_ESTADO_TAREA,
      variables: { input }
    }).pipe(map(r => r.data?.addEstadoTarea));
  }

  updateEstado(id: number, input: {
    nombre: string; color: string; orden: number;
    esEstadoInicial: boolean; esEstadoFinal: boolean;
  }): Observable<EstadoTarea> {
    return this.apollo.mutate<any>({
      mutation: UPDATE_ESTADO_TAREA,
      variables: { id, input }
    }).pipe(map(r => r.data?.updateEstadoTarea));
  }

  toggleEstado(id: number): Observable<boolean> {
    return this.apollo.mutate<any>({
      mutation: TOGGLE_ESTADO_TAREA,
      variables: { id }
    }).pipe(map(r => r.data?.toggleEstadoTarea ?? false));
  }
}
