import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';

// --- QUERIES ---
const GET_PROYECTOS_POR_LINEA = gql`
  query GetProyectos($linea: String!) {
    proyectos(where: { lineaNegocio: { eq: $linea } }, order: { fechaAsignacion: DESC }) {
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
      fechaEnvioPermiso
      fechaAprobacionPermisos
      fechaEnvioPresupuesto
      fechaAprobacionPresupuesto
      fechaInicioActividades
      fechaFinalizacionActividades
      supervisorCliente
      contratista
      polizas
      centroDeCostos
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

// NUEVO: Queries para los selects del formulario
const GET_DATOS_FORMULARIO = gql`
  query GetDatosFormulario {
    clientesTracker(order: { razonSocial: ASC }) { id razonSocial }
    usuariosTracker(order: { nombre: ASC }) { id nombre }
  }
`;

// --- MUTATIONS ---
const CREAR_PROYECTO = gql`
  mutation CrearProyecto($input: ProyectoInput!) {
    addProyecto(input: $input) { id codigo nombre estado lineaNegocio }
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
      fechaEnvioPermiso
      fechaAprobacionPermisos
      fechaEnvioPresupuesto
      fechaAprobacionPresupuesto
      fechaInicioActividades
      fechaFinalizacionActividades
      supervisorCliente
      contratista
      polizas
      centroDeCostos
      dossierEntregado
      liquidacionTerminada
      facturacionCompletada
    }
  }
`;

@Injectable({
  providedIn: 'root'
})
export class TrackerService {
  private apollo = inject(Apollo);

  getProyectosPorLinea(lineaNegocio: string): Observable<any[]> {
    return this.apollo.watchQuery<any>({
      query: GET_PROYECTOS_POR_LINEA,
      variables: { linea: lineaNegocio },
      fetchPolicy: 'network-only'
    }).valueChanges.pipe(map(result => result.data?.proyectos || []));
  }

  // NUEVO: Obtener clientes y usuarios
  getDatosParaFormulario(): Observable<{clientes: any[], usuarios: any[]}> {
    return this.apollo.query<any>({
      query: GET_DATOS_FORMULARIO,
      fetchPolicy: 'network-only' // Usar network-only para pruebas
    }).pipe(
      map(result => {
        // Mapeamos los nombres nuevos
        return {
          clientes: result.data?.clientesTracker || [],
          usuarios: result.data?.usuariosTracker || []
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

  agregarObservacion(proyectoId: string, usuarioId: string, texto: string): Observable<any> {
    return this.apollo.mutate({
      mutation: AGREGAR_OBSERVACION,
      variables: {
        input: { proyectoId: proyectoId, usuarioId: usuarioId, observacionTexto: texto }
      }
    }).pipe(map((result: any) => result.data?.addObservacion));
  }
}
