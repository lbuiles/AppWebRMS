import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

const GET_CONTRATISTAS = gql`
  query GetContratistaProveedores {
    contratistaProveedores(order: { fechaCreacion: DESC }) {
      id
      estado
      tipoTercero
      tipoPersona
      estadoRegistro
      fechaCreacion
      fechaDiligenciamiento

      # §1 Persona Natural
      nombreCompleto
      tipoDocumento
      numeroDocumento
      fechaExpedicion
      lugarExpedicion
      nacionalidad
      estadoCivil
      numeroContacto
      correoElectronico
      direccionResidencia
      ciudad
      departamento
      actividadEconomica
      codigoCIIU
      empleadosACargo

      # §2 Persona Jurídica
      razonSocial
      nit
      digitoVerificador
      direccionEmpresa
      paisEmpresa
      ciudadEmpresa
      departamentoEmpresa
      actividadEconomicaEmpresa
      codigoCIIUEmpresa
      emailEmpresa
      telefonoEmpresa
      tipoEmpresa
      paginaWeb
      nombreRepresentanteLegal
      documentoRepresentanteLegal

      # PEP
      esPEP
      administraRecursosPublicos
      pagoConRecursosPublicos
      sancionadoLavadoActivos
      tieneVinculoPEP
      vinculoPEPNombre
      vinculoPEPDocumento
      vinculoPEPParentesco

      # §3 Tributaria
      esAgenteRetencion
      esGranContribuyente
      resolucionGranContribuyente
      esAutoretenedor
      resolucionAutoretenedor
      esNoResponsableIVA
      esRegimenSimple
      esRegimenEspecial
      cualRegimenEspecial
      esRegimenComun
      obligadoFacturacionElectronica
      esDeclaranteRenta

      # §4 Financiera
      ingresosMensuales
      egresosMensuales
      totalActivos
      totalPasivos
      patrimonio
      otrosIngresos
      conceptoOtrosIngresos

      # §5 Internacional
      poseeCuentasExterior
      paisCuentaExterior

      # §7
      declaracionOrigenFondos

      # §10 Documentos recibidos
      docIdentificacion
      docRUT
      docCertificacionBancaria
      docPlanillaSeguridadSocial
      docReferenciasComerciales
      docDeclaracionRenta
      docAutorizacionDatos
      docCertificadoExistencia
      docEstadosFinancieros

      # Relaciones
      documentos { id tipoDocumento url fechaSubida }
      cuentasBancarias { id tipoProducto numeroCuenta entidad ciudad departamento pais observaciones }
      referencias { id entidad nombreContacto telefono }
      accionistas { id nombreRazonSocial tipoDocumento numeroDocumento tieneCategoriaPEP }
    }
  }
`;

const ADD_CONTRATISTA = gql`
  mutation AddContratistaProveedor($input: ContratistaProveedorInput!) {
    addContratistaProveedor(input: $input) {
      id tipoTercero tipoPersona nombreCompleto razonSocial nit
    }
  }
`;

const UPDATE_CONTRATISTA = gql`
  mutation UpdateContratistaProveedor($id: UUID!, $input: ContratistaProveedorInput!) {
    updateContratistaProveedor(id: $id, input: $input) {
      id tipoTercero tipoPersona nombreCompleto razonSocial nit
    }
  }
`;

const DELETE_CONTRATISTA = gql`
  mutation DeleteContratistaProveedor($id: UUID!) {
    deleteContratistaProveedor(id: $id)
  }
`;

const ACTIVATE_CONTRATISTA = gql`
  mutation ActivateContratistaProveedor($id: UUID!) {
    activateContratistaProveedor(id: $id)
  }
`;

const DELETE_CP_DOCUMENTO = gql`
  mutation DeleteCPDocumento($id: UUID!) {
    deleteCPDocumento(id: $id)
  }
`;

@Injectable({ providedIn: 'root' })
export class ContratistaService {
  private apollo = inject(Apollo);
  private http = inject(HttpClient);

  getAll(): Observable<any[]> {
    return this.apollo.watchQuery<any>({
      query: GET_CONTRATISTAS,
      fetchPolicy: 'network-only'
    }).valueChanges.pipe(map(r => r.data?.contratistaProveedores || []));
  }

  add(input: any): Observable<any> {
    return this.apollo.mutate({
      mutation: ADD_CONTRATISTA,
      variables: { input }
    }).pipe(map((r: any) => r.data?.addContratistaProveedor));
  }

  update(id: string, input: any): Observable<any> {
    return this.apollo.mutate({
      mutation: UPDATE_CONTRATISTA,
      variables: { id, input }
    }).pipe(map((r: any) => r.data?.updateContratistaProveedor));
  }

  delete(id: string): Observable<boolean> {
    return this.apollo.mutate({
      mutation: DELETE_CONTRATISTA,
      variables: { id }
    }).pipe(map((r: any) => r.data?.deleteContratistaProveedor));
  }

  activate(id: string): Observable<boolean> {
    return this.apollo.mutate({
      mutation: ACTIVATE_CONTRATISTA,
      variables: { id }
    }).pipe(map((r: any) => r.data?.activateContratistaProveedor));
  }

  deleteDocumento(id: string): Observable<boolean> {
    return this.apollo.mutate({
      mutation: DELETE_CP_DOCUMENTO,
      variables: { id }
    }).pipe(map((r: any) => r.data?.deleteCPDocumento));
  }

  subirDocumento(archivo: File, modulo: string = 'contratistas'): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('modulo', modulo);
    // Mismo patrón exacto que cliente.service.ts
    return this.http.post<{ url: string }>(`${environment.restUrl}/upload/documento`, formData);
  }
}
