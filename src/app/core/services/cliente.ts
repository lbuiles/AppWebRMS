import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';

// --- QUERIES Y MUTATIONS ---

const GET_CLIENTES = gql`
  query {
    clientes {
      id razonSocial nit departamento ciudad direccion telefono email contactoPrincipal estado tipoClienteId
      condiciones { tipoContratoId condicionPagoId monedaId tipoFacturacionId emailFacturacion requiereOC requierePolizas }
      operacion { prioridadId slaDias }
      clientePolizas { tipoPolizaId }
      clienteServicios { tipoServicioId }
      clienteRegiones { regionId }
      sucursales {
        nombre departamento ciudad direccion telefono
        contactos { nombre cargo email telefono }
      }
    }
  }
`;

// NUEVO: Traer todos los catálogos en una sola llamada
const GET_CATALOGOS = gql`
  query {
    tiposCliente { id nombre }
    tiposContrato { id nombre }
    monedas { id codigo nombre }
    tiposFacturacion { id nombre }
    prioridades { id nombre nivel }
    condicionesPago { id nombre }
    tiposPoliza { id nombre }
    tiposServicio { id nombre }
    regiones { id nombre }
  }
`;

const CREAR_CLIENTE = gql`
  mutation CrearCliente($input: ClienteInput!) {
    addCliente(input: $input) {
      id razonSocial nit estado
    }
  }
`;

const UPDATE_CLIENTE = gql`
  mutation UpdateCliente($id: UUID!, $input: ClienteInput!) {
    updateCliente(id: $id, input: $input) {
      id razonSocial nit estado
    }
  }
`;

const ACTIVATE_CLIENTE = gql`
  mutation ActivateCliente($id: UUID!) {
    activateCliente(id: $id)
  }
`;

const DELETE_CLIENTE = gql`
  mutation DeleteCliente($id: UUID!) {
    deleteCliente(id: $id)
  }
`;

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  private apollo = inject(Apollo);

  constructor() { }

  getClientes(): Observable<any[]> {
    return this.apollo.watchQuery<any>({
      query: GET_CLIENTES,
      fetchPolicy: 'network-only'
    }).valueChanges.pipe(
      map(result => {
        if (result.error) console.error('Error de Apollo:', result.error.message);
        return result.data?.clientes || [];
      })
    );
  }

  // NUEVO: Método para cargar catálogos
  getCatalogos(): Observable<any> {
    return this.apollo.watchQuery<any>({
      query: GET_CATALOGOS,
      fetchPolicy: 'cache-first' // Para no consultar la BD cada vez que abramos el componente
    }).valueChanges.pipe(
      map(result => result.data)
    );
  }

  crearCliente(clienteData: any): Observable<any> {
    return this.apollo.mutate({
      mutation: CREAR_CLIENTE,
      variables: { input: clienteData }
    }).pipe(map((result: any) => result.data?.addCliente));
  }

  updateCliente(id: string, clienteData: any): Observable<any> {
    return this.apollo.mutate({
      mutation: UPDATE_CLIENTE,
      variables: { id: id, input: clienteData }
    }).pipe(map((result: any) => result.data?.updateCliente));
  }

  deleteCliente(id: string): Observable<boolean> {
    return this.apollo.mutate({
      mutation: DELETE_CLIENTE,
      variables: { id: id }
    }).pipe(map((result: any) => result.data?.deleteCliente));
  }

  activateCliente(id: string): Observable<boolean> {
    return this.apollo.mutate({
      mutation: ACTIVATE_CLIENTE,
      variables: { id }
    }).pipe(map((result: any) => result.data?.activateCliente));
  }
}
