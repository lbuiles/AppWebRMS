import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

// ==========================================
// 1. QUERIES PRINCIPALES (PROYECTOS)
// ==========================================
const GET_PROYECTOS_POR_LINEA = gql`
  query GetProyectos($linea: String!) {
    proyectos(where: { and: [{ lineaNegocio: { eq: $linea } }, { archivado: { neq: true } }] }, order: { fechaAsignacion: DESC }) {
      id
      codigo
      nombre
      estado
      numeroOC
      valorOC
      valorFacturado
      valorGasto
      porcentajeAvanceFinanciero
      utilidad
      fechaAsignacion
      fechaRespuestaCliente
      fechaSolicitudPermisos
      fechaVisitaTecnica
      fechaEnvioPermiso
      fechaAprobacionPermisos
      fechaEnvioPresupuesto
      fechaAprobacionPresupuesto
      fechaInicioActividades
      fechaInicioObra
      fechaTentativaFin
      fechaFinalizacionActividades
      anticiposDirectos { id valorAnticipo concepto beneficiario estado fechaSolicitud idEgresoWorldOffice fechaPago solicitante { id nombre } aprobador { id nombre } }
      cortesFacturacion { id valorCorte numeroFactura observaciones estado fechaCorte registradoPor { id nombre } }
      ordenesTrabajo { id consecutivo estado contratistaNombre contratistaNit tecnicoInterno { id nombre } }
      requisiciones { id consecutivo estado }
      supervisorCliente
      contratista
      ejecutorInternoId
      ejecutorInterno {
        id
        nombre
      }
      polizas
      centroDeCostos
      cierreTecnicoAprobado
      costoRealTotal
      dossierEntregado
      liquidacionTerminada
      facturacionCompletada
      cliente {
        id
        razonSocial
      }
      responsable {
        id
        nombre
      }
      observaciones {
        id
        observacion
        fechaRegistro
        usuario {
          nombre
        }
      }
    }
  }
`;

const GET_PROYECTOS_ARCHIVADOS_POR_LINEA = gql`
  query GetProyectosArchivados($linea: String!) {
    proyectos(where: { and: [{ lineaNegocio: { eq: $linea } }, { archivado: { eq: true } }] }, order: { fechaArchivado: DESC }) {
      id
      codigo
      nombre
      estado
      fechaArchivado
      archivadoPor { nombre }
      cliente { razonSocial }
    }
  }
`;

const ARCHIVAR_PROYECTO = gql`
  mutation ArchivarProyecto($id: UUID!, $usuarioId: UUID!) {
    archivarProyecto(id: $id, usuarioId: $usuarioId) {
      id
      archivado
      fechaArchivado
    }
  }
`;

const REACTIVAR_PROYECTO = gql`
  mutation ReactivarProyecto($id: UUID!) {
    reactivarProyecto(id: $id) {
      id
      archivado
    }
  }
`;

const ELIMINAR_PROYECTO_DEFINITIVO = gql`
  mutation EliminarProyectoDefinitivo($id: UUID!) {
    eliminarProyectoDefinitivo(id: $id)
  }
`;

const GET_PROYECTOS_TODAS_LINEAS = gql`
  query GetProyectosTodas {
    proyectos(where: { archivado: { neq: true } }, order: { fechaAsignacion: DESC }) {
      id codigo nombre estado lineaNegocio valorOC valorFacturado valorGasto utilidad
      porcentajeAvanceFinanciero fechaAsignacion fechaRespuestaCliente fechaInicioActividades fechaFinalizacionActividades
      fechaTentativaFin numeroOC polizas centroDeCostos
      supervisorCliente contratista
      cierreTecnicoAprobado dossierEntregado liquidacionTerminada facturacionCompletada
      cliente { id razonSocial }
      responsable { id nombre }
      ordenesTrabajo { id consecutivo estado contratistaNombre contratistaNit tecnicoInterno { id nombre } }
      requisiciones { id consecutivo estado }
      anticiposDirectos { id valorAnticipo concepto beneficiario estado fechaSolicitud idEgresoWorldOffice fechaPago solicitante { id nombre } aprobador { id nombre } }
      cortesFacturacion { id valorCorte numeroFactura observaciones estado fechaCorte registradoPor { id nombre } }
    }
  }
`;

const GET_DATOS_FORMULARIO = gql`
  query GetDatosFormulario {
    clientesTracker(order: { razonSocial: ASC }) { id razonSocial }
    usuariosTracker(order: { nombre: ASC }) { id nombre }
    contratistaProveedores(
      where: { estado: { eq: "ACTIVO" } }
      order: { razonSocial: ASC }
    ) {
      id
      tipoPersona
      razonSocial
      nombreCompleto
      nit
      numeroDocumento
      telefonoEmpresa
      numeroContacto
      emailEmpresa
      correoElectronico
    }
  }
`;

// ==========================================
// 2. QUERIES DE SUB-FLUJOS (COMPRAS Y OTs)
// ==========================================
const GET_REQUISICIONES = gql`
  query GetRequisiciones($proyectoId: UUID!) {
    requisiciones(where: { proyectoId: { eq: $proyectoId } }, order: { fechaSolicitud: DESC }) {
      id
      consecutivo
      estado
      valorEstimado
      fechaSolicitud
      observaciones
      solicitante {
        nombre
      }
      aprobador {
        nombre
      }
      numeroOCCompra
      valorRealCompra
      fechaCompra
      compradoPor {
        nombre
      }
      fechaRecibo
      observacionesRecibo
      recibidoPor {
        nombre
      }
    }
  }
`;

const GET_ORDENES_TRABAJO = gql`
  query GetOrdenesTrabajo($proyectoId: UUID!) {
    ordenesTrabajo(where: { proyectoId: { eq: $proyectoId } }, order: { fechaEmision: DESC }) {
      id
      consecutivo
      contratistaNombre
      contratistaNit
      tecnicoInterno {
        nombre
      }
      valorTotal
      estado
      alcanceServicio
      firmaContratista
      fechaEmision
      creador {
        nombre
      }
      anticipos {
        id
        valorAnticipo
        estado
        fechaSolicitud
        fechaPago
        idEgresoWorldOffice
        solicitante {
          nombre
        }
      }
    }
  }
`;

// ==========================================
// 3. MUTATIONS PRINCIPALES (PROYECTOS)
// ==========================================
const CREAR_PROYECTO = gql`
  mutation CrearProyecto($input: ProyectoInput!) {
    addProyecto(input: $input) { id codigo nombre estado lineaNegocio }
  }
`;

const ACTUALIZAR_NOMBRE_PROYECTO = gql`
  mutation ActualizarNombreProyecto($id: UUID!, $nombre: String!) {
    actualizarNombreProyecto(id: $id, nombre: $nombre) {
      id
      nombre
    }
  }
`;

const ACTUALIZAR_PROYECTO = gql`
  mutation ActualizarProyecto($id: UUID!, $input: ProyectoUpdateInput!) {
    updateProyecto(id: $id, input: $input) {
      id
      estado
      porcentajeAvanceFinanciero
      utilidad
      valorGasto
      valorFacturado
      fechaAsignacion
      fechaRespuestaCliente
      fechaSolicitudPermisos
      fechaVisitaTecnica
      fechaEnvioPermiso
      fechaAprobacionPermisos
      fechaEnvioPresupuesto
      fechaAprobacionPresupuesto
      fechaInicioActividades
      fechaInicioObra
      fechaTentativaFin
      fechaFinalizacionActividades
      supervisorCliente
      contratista
      ejecutorInternoId
      ejecutorInterno {
        id
        nombre
      }
      polizas
      centroDeCostos
      cierreTecnicoAprobado
      costoRealTotal
      dossierEntregado
      liquidacionTerminada
      facturacionCompletada
    }
  }
`;

const AGREGAR_OBSERVACION = gql`
  mutation AgregarObservacion($input: ObservacionInput!) {
    addObservacion(input: $input) {
      id
      observacion
      fechaRegistro
      usuario { nombre }
    }
  }
`;

// ==========================================
// 4. MUTATIONS DE SUB-FLUJOS (COMPRAS Y OTs)
// ==========================================
const CREAR_REQUISICION = gql`
  mutation CrearRequisicion($input: RequisicionInput!) {
    addRequisicion(input: $input) { id consecutivo estado }
  }
`;

const CREAR_ORDEN_TRABAJO = gql`
  mutation CrearOrdenTrabajo($input: OrdenTrabajoInput!) {
    addOrdenTrabajo(input: $input) { id consecutivo estado valorTotal }
  }
`;

const CREAR_ANTICIPO = gql`
  mutation CrearAnticipo($input: AnticipoInput!) {
    addAnticipo(input: $input) { id valorAnticipo estado }
  }
`;

const PAGAR_ANTICIPO = gql`
  mutation PagarAnticipo($input: PagarAnticipoInput!) {
    pagarAnticipo(input: $input) { id estado idEgresoWorldOffice }
  }
`;

const APROBAR_REQUISICION = gql`
  mutation AprobarRequisicion($id: UUID!, $aprobadorId: UUID!) {
    aprobarRequisicion(id: $id, aprobadorId: $aprobadorId) {
      id
      estado
      fechaAprobacion
    }
  }
`;

const COMPRAR_REQUISICION = gql`
  mutation ComprarRequisicion($input: ComprarRequisicionInput!) {
    comprarRequisicion(input: $input) {
      id
      estado
      numeroOCCompra
      valorRealCompra
      fechaCompra
      compradoPor { nombre }
    }
  }
`;

const RECIBIR_REQUISICION = gql`
  mutation RecibirRequisicion($input: RecibirRequisicionInput!) {
    recibirRequisicion(input: $input) {
      id
      estado
      fechaRecibo
      observacionesRecibo
      recibidoPor { nombre }
    }
  }
`;

const GET_DASHBOARD_RESUMEN = gql`
  query GetDashboardResumen {
    dashboardResumen {
      proyectosActivos
      totalFacturado
      totalGastos
      utilidadProyectada
      requisicionesPendientes
      anticiposPendientes
    }
  }
`;

const GET_TODOS_LOS_PROYECTOS = gql`
  query GetTodosLosProyectos {
    proyectos(where: { archivado: { neq: true } }, order: { fechaAsignacion: DESC }) {
      id
      codigo
      nombre
      estado
      lineaNegocio
      numeroOC
      valorOC
      valorFacturado
      valorGasto
      costoRealTotal
      utilidad
      porcentajeAvanceFinanciero
      fechaAsignacion
      fechaInicioActividades
      fechaFinalizacionActividades
      cliente {
        razonSocial
      }
      responsable {
        id
        nombre
      }
    }
  }
`;

const ADD_ANTICIPO_DIRECTO = gql`
  mutation AddAnticipoDirecto($input: AnticipoDirectoInput!) {
    addAnticipoDirecto(input: $input) {
      id proyectoId valorAnticipo concepto beneficiario estado fechaSolicitud
      solicitante { id nombre }
    }
  }
`;

const APROBAR_ANTICIPO_DIRECTO = gql`
  mutation AprobarAnticipoDirecto($input: AprobarAnticipoDirectoInput!) {
    aprobarAnticipoDirecto(input: $input) {
      id estado fechaAprobacion
    }
  }
`;

const PAGAR_ANTICIPO_DIRECTO = gql`
  mutation PagarAnticipoDirecto($input: PagarAnticipoDirectoInput!) {
    pagarAnticipoDirecto(input: $input) {
      id estado idEgresoWorldOffice fechaPago
    }
  }
`;

const RECHAZAR_ANTICIPO_DIRECTO = gql`
  mutation RechazarAnticipoDirecto($id: UUID!) {
    rechazarAnticipoDirecto(id: $id)
  }
`;


const DESPACHO_INTERNO_REQ = gql`
  mutation DespachoInternoRequisicion($id: UUID!, $aprobadorId: UUID!) {
    despachoInternoRequisicion(id: $id, aprobadorId: $aprobadorId) {
      id estado numeroOCCompra fechaAprobacion
    }
  }
`;

const ELIMINAR_OT = gql`
  mutation EliminarOrdenTrabajo($id: UUID!) {
    eliminarOrdenTrabajo(id: $id)
  }
`;

const ELIMINAR_REQ = gql`
  mutation EliminarRequisicion($id: UUID!) {
    eliminarRequisicion(id: $id)
  }
`;

const ELIMINAR_ANTICIPO_DIRECTO = gql`
  mutation EliminarAnticipoDirecto($id: UUID!) {
    eliminarAnticipoDirecto(id: $id)
  }
`;

const ADD_CORTE_FACTURACION = gql`
  mutation AddCorteFacturacion($input: CorteFacturacionInput!) {
    addCorteFacturacion(input: $input) {
      id proyectoId valorCorte numeroFactura observaciones estado fechaCorte
      registradoPor { id nombre }
    }
  }
`;

const ANULAR_CORTE_FACTURACION = gql`
  mutation AnularCorteFacturacion($id: UUID!) {
    anularCorteFacturacion(id: $id)
  }
`;

const ELIMINAR_CORTE_FACTURACION = gql`
  mutation EliminarCorteFacturacion($id: UUID!) {
    eliminarCorteFacturacion(id: $id)
  }
`;


@Injectable({
  providedIn: 'root'
})
export class TrackerService {
  private apollo = inject(Apollo);
  private http = inject(HttpClient);

  // ==========================================
  // MÉTODOS DEL TRACKER PRINCIPAL
  // ==========================================
  getTodosLosProyectosConsolidado(): Observable<any[]> {
    return this.apollo.query({
      query: GET_PROYECTOS_TODAS_LINEAS,
      fetchPolicy: 'network-only'
    }).pipe(map((r: any) => r.data?.proyectos || []));
  }

  getProyectosPorLinea(lineaNegocio: string): Observable<any[]> {
    return this.apollo.watchQuery<any>({
      query: GET_PROYECTOS_POR_LINEA,
      variables: { linea: lineaNegocio },
      fetchPolicy: 'network-only'
    }).valueChanges.pipe(map(result => result.data?.proyectos || []));
  }

  getDatosParaFormulario(): Observable<{clientes: any[], usuarios: any[], contratistas: any[]}> {
    return this.apollo.query<any>({
      query: GET_DATOS_FORMULARIO,
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => {
        return {
          clientes: result.data?.clientesTracker || [],
          usuarios: result.data?.usuariosTracker || [],
          contratistas: result.data?.contratistaProveedores || []
        };
      })
    );
  }

  crearProyecto(proyectoData: any): Observable<any> {
    return this.apollo.mutate({
      mutation: CREAR_PROYECTO,
      variables: { input: proyectoData }
    }).pipe(map((result: any) => result.data?.addProyecto));
  }

  actualizarProyecto(id: string, proyectoData: any): Observable<any> {
    return this.apollo.mutate({
      mutation: ACTUALIZAR_PROYECTO,
      variables: { id: id, input: proyectoData }
    }).pipe(
      map((result: any) => result.data?.updateProyecto)
    );
  }

  actualizarNombreProyecto(id: string, nombre: string): Observable<any> {
    return this.apollo.mutate({
      mutation: ACTUALIZAR_NOMBRE_PROYECTO,
      variables: { id, nombre }
    }).pipe(
      map((result: any) => result.data?.actualizarNombreProyecto)
    );
  }

  getProyectosArchivadosPorLinea(linea: string): Observable<any[]> {
    return this.apollo.query<any>({
      query: GET_PROYECTOS_ARCHIVADOS_POR_LINEA,
      variables: { linea },
      fetchPolicy: 'network-only'
    }).pipe(map((r: any) => r.data?.proyectos || []));
  }

  archivarProyecto(id: string, usuarioId: string): Observable<any> {
    return this.apollo.mutate({
      mutation: ARCHIVAR_PROYECTO,
      variables: { id, usuarioId }
    }).pipe(map((result: any) => result.data?.archivarProyecto));
  }

  reactivarProyecto(id: string): Observable<any> {
    return this.apollo.mutate({
      mutation: REACTIVAR_PROYECTO,
      variables: { id }
    }).pipe(map((result: any) => result.data?.reactivarProyecto));
  }

  eliminarProyectoDefinitivo(id: string): Observable<boolean> {
    return this.apollo.mutate({
      mutation: ELIMINAR_PROYECTO_DEFINITIVO,
      variables: { id }
    }).pipe(map((result: any) => result.data?.eliminarProyectoDefinitivo));
  }

  agregarObservacion(proyectoId: string, usuarioId: string, texto: string): Observable<any> {
    return this.apollo.mutate({
      mutation: AGREGAR_OBSERVACION,
      variables: {
        input: { proyectoId: proyectoId, usuarioId: usuarioId, observacionTexto: texto }
      }
    }).pipe(map((result: any) => result.data?.addObservacion));
  }

  // ==========================================
  // MÉTODOS PARA SUB-FLUJOS (COMPRAS Y OT)
  // ==========================================
  getRequisicionesPorProyecto(proyectoId: string): Observable<any[]> {
    return this.apollo.query<any>({ // <--- Cambiamos watchQuery por query
      query: GET_REQUISICIONES,
      variables: { proyectoId },
      fetchPolicy: 'network-only'
    }).pipe(map(result => result.data?.requisiciones || [])); // <--- Quitamos el .valueChanges
  }

  getOrdenesTrabajoPorProyecto(proyectoId: string): Observable<any[]> {
    return this.apollo.query<any>({ // <--- Cambiamos watchQuery por query
      query: GET_ORDENES_TRABAJO,
      variables: { proyectoId },
      fetchPolicy: 'network-only'
    }).pipe(map(result => result.data?.ordenesTrabajo || [])); // <--- Quitamos el .valueChanges
  }

  crearRequisicion(inputData: any): Observable<any> {
    return this.apollo.mutate({
      mutation: CREAR_REQUISICION,
      variables: { input: inputData }
    }).pipe(map((result: any) => result.data?.addRequisicion));
  }

  crearOrdenTrabajo(inputData: any): Observable<any> {
    return this.apollo.mutate({
      mutation: CREAR_ORDEN_TRABAJO,
      variables: { input: inputData }
    }).pipe(map((result: any) => result.data?.addOrdenTrabajo));
  }

  solicitarAnticipo(inputData: any): Observable<any> {
    return this.apollo.mutate({
      mutation: CREAR_ANTICIPO,
      variables: { input: inputData }
    }).pipe(map((result: any) => result.data?.addAnticipo));
  }

  pagarAnticipo(anticipoId: string, idEgreso: string): Observable<any> {
    return this.apollo.mutate({
      mutation: PAGAR_ANTICIPO,
      variables: { input: { anticipoId: anticipoId, idEgresoWorldOffice: idEgreso } }
    }).pipe(map((result: any) => result.data?.pagarAnticipo));
  }

  aprobarRequisicion(id: string, aprobadorId: string): Observable<any> {
    return this.apollo.mutate({
      mutation: APROBAR_REQUISICION,
      variables: { id: id, aprobadorId: aprobadorId }
    }).pipe(map((result: any) => result.data?.aprobarRequisicion));
  }

  comprarRequisicion(requisicionId: string, numeroOCCompra: string, valorRealCompra: number, compradoPorId: string): Observable<any> {
    return this.apollo.mutate({
      mutation: COMPRAR_REQUISICION,
      variables: { input: { requisicionId, numeroOCCompra, valorRealCompra, compradoPorId } }
    }).pipe(map((result: any) => result.data?.comprarRequisicion));
  }

  recibirRequisicion(requisicionId: string, recibidoPorId: string, observacionesRecibo?: string): Observable<any> {
    return this.apollo.mutate({
      mutation: RECIBIR_REQUISICION,
      variables: { input: { requisicionId, recibidoPorId, observacionesRecibo } }
    }).pipe(map((result: any) => result.data?.recibirRequisicion));
  }

  getDashboardResumen(): Observable<any> {
    return this.apollo.watchQuery<any>({
      query: GET_DASHBOARD_RESUMEN,
      fetchPolicy: 'network-only' // Siempre queremos datos frescos en el dashboard
    }).valueChanges.pipe(map(result => result.data?.dashboardResumen));
  }

  getTodosLosProyectosDashboard(): Observable<any[]> {
    return this.apollo.query<any>({
      query: GET_TODOS_LOS_PROYECTOS,
      fetchPolicy: 'network-only'
    }).pipe(map(result => result.data?.proyectos || []));
  }

  // ── Anticipos Directos ──
  addAnticipoDirecto(input: any): Observable<any> {
    return this.apollo.mutate({
      mutation: ADD_ANTICIPO_DIRECTO,
      variables: { input }
    }).pipe(map((r: any) => r.data?.addAnticipoDirecto));
  }

  aprobarAnticipoDirecto(anticipoId: string): Observable<any> {
    return this.apollo.mutate({
      mutation: APROBAR_ANTICIPO_DIRECTO,
      variables: { input: { anticipoId } }
    }).pipe(map((r: any) => r.data?.aprobarAnticipoDirecto));
  }

  pagarAnticipoDirecto(anticipoId: string, idEgresoWorldOffice: string): Observable<any> {
    return this.apollo.mutate({
      mutation: PAGAR_ANTICIPO_DIRECTO,
      variables: { input: { anticipoId, idEgresoWorldOffice } }
    }).pipe(map((r: any) => r.data?.pagarAnticipoDirecto));
  }

  despachoInternoRequisicion(id: string, aprobadorId: string): Observable<any> {
    return this.apollo.mutate({
      mutation: DESPACHO_INTERNO_REQ,
      variables: { id, aprobadorId }
    }).pipe(map((r: any) => r.data?.despachoInternoRequisicion));
  }

  eliminarOrdenTrabajo(id: string): Observable<any> {
    return this.apollo.mutate({ mutation: ELIMINAR_OT, variables: { id } })
      .pipe(map((r: any) => r.data?.eliminarOrdenTrabajo));
  }

  eliminarRequisicion(id: string): Observable<any> {
    return this.apollo.mutate({ mutation: ELIMINAR_REQ, variables: { id } })
      .pipe(map((r: any) => r.data?.eliminarRequisicion));
  }

  eliminarAnticipoDirecto(id: string): Observable<any> {
    return this.apollo.mutate({ mutation: ELIMINAR_ANTICIPO_DIRECTO, variables: { id } })
      .pipe(map((r: any) => r.data?.eliminarAnticipoDirecto));
  }

  addCorteFacturacion(input: any): Observable<any> {
    return this.apollo.mutate({ mutation: ADD_CORTE_FACTURACION, variables: { input } })
      .pipe(map((r: any) => r.data?.addCorteFacturacion));
  }

  anularCorteFacturacion(id: string): Observable<any> {
    return this.apollo.mutate({ mutation: ANULAR_CORTE_FACTURACION, variables: { id } })
      .pipe(map((r: any) => r.data?.anularCorteFacturacion));
  }

  eliminarCorteFacturacion(id: string): Observable<any> {
    return this.apollo.mutate({ mutation: ELIMINAR_CORTE_FACTURACION, variables: { id } })
      .pipe(map((r: any) => r.data?.eliminarCorteFacturacion));
  }

  rechazarAnticipoDirecto(id: string): Observable<any> {
    return this.apollo.mutate({
      mutation: RECHAZAR_ANTICIPO_DIRECTO,
      variables: { id }
    }).pipe(map((r: any) => r.data?.rechazarAnticipoDirecto));
  }

  notificarAlertaGerencia(proyectoId: string, codigo: string, nombre: string): Observable<any> {
    return this.http.post('/api/n8n/alerta-gerencia', { proyectoId, codigo, nombre, evento: 'ALERTA_MANUAL_GERENCIA' });
  }

  // --- Exportación a Excel (respaldo operativo) ---
  descargarExcelProyectos(linea?: string): Observable<Blob> {
    const token = localStorage.getItem('rms_token');
    const headers = new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : ''
    });
    const params = linea ? new HttpParams().set('linea', linea) : undefined;
    return this.http.get('/api/export/proyectos', {
      headers,
      params,
      responseType: 'blob'
    });
  }
}
