import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';

// --- CONSULTAS ---
const GET_USUARIOS = gql`
  query GetUsuarios {
    usuarios {
      id
      nombre
      email
      estado
      usuarioPermisos {
        permiso {
          id
          nombre
          slug
        }
      }
    }
  }
`;

const GET_TODOS_LOS_PERMISOS = gql`
  query GetTodosLosPermisos {
    todosLosPermisos {
      id
      nombre
      slug
      moduloRelacion {
        nombre
        area
      }
    }
  }
`;

// --- MUTACIONES DE USUARIOS ---
const CREATE_USUARIO = gql`
  mutation AddUsuario($input: UserInputDtoInput!, $permisos: [String!]!) {
    addUsuario(input: $input, permisos: $permisos) {
      id
      nombre
      email
    }
  }
`;

const UPDATE_USUARIO = gql`
  mutation UpdateUsuario($id: UUID!, $input: UserInputDtoInput!, $permisos: [String!]!) {
    updateUsuario(id: $id, input: $input, permisos: $permisos) {
      id
      nombre
      email
    }
  }
`;

const ACTIVATE_USUARIO = gql`
  mutation ActivateUsuario($id: UUID!) {
    activateUsuario(id: $id)
  }
`;

const DELETE_USUARIO = gql`
  mutation DeleteUsuario($id: UUID!) {
    deleteUsuario(id: $id)
  }
`;

// --- NUEVAS MUTACIONES DE DICCIONARIO DE PERMISOS ---
const UPDATE_PERMISO = gql`
  mutation UpdatePermiso($id: Int!, $nombre: String!, $area: String!, $moduloId: Int!) {
    updatePermiso(id: $id, nombre: $nombre, area: $area, moduloId: $moduloId) {
      id
      nombre
      area
      moduloRelacion {
        nombre
      }
    }
  }
`;

const DELETE_PERMISO = gql`
  mutation DeletePermiso($id: Int!) {
    deletePermiso(id: $id)
  }
`;

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private apollo = inject(Apollo);

  // --- MÉTODOS DE USUARIOS ---
  getUsuarios(): Observable<any[]> {
    return this.apollo.watchQuery<any>({
      query: GET_USUARIOS,
      fetchPolicy: 'network-only'
    }).valueChanges.pipe(map(r => r.data?.usuarios || []));
  }

  getTodosLosPermisos(): Observable<any[]> {
    return this.apollo.query<any>({
      query: GET_TODOS_LOS_PERMISOS,
      fetchPolicy: 'network-only'
    }).pipe(map(r => r.data?.todosLosPermisos || []));
  }

  createUsuario(nombre: string, email: string, permisos: string[]): Observable<any> {
    return this.apollo.mutate({
      mutation: CREATE_USUARIO,
      variables: {
        input: { nombre, email },
        permisos: permisos
      }
    }).pipe(map((result: any) => result.data?.addUsuario));
  }

  updateUsuario(id: string, nombre: string, email: string, permisos: string[]): Observable<any> {
    return this.apollo.mutate({
      mutation: UPDATE_USUARIO,
      variables: {
        id,
        input: { nombre, email },
        permisos: permisos
      }
    }).pipe(map((result: any) => result.data?.updateUsuario));
  }

  deleteUsuario(id: string): Observable<boolean> {
    return this.apollo.mutate({
      mutation: DELETE_USUARIO,
      variables: { id }
    }).pipe(map((result: any) => result.data?.deleteUsuario));
  }

  activateUsuario(id: string): Observable<boolean> {
    return this.apollo.mutate({
      mutation: ACTIVATE_USUARIO,
      variables: { id }
    }).pipe(map((result: any) => result.data?.activateUsuario));
  }

  // --- MÉTODOS DE DICCIONARIO DE PERMISOS ---
  updatePermiso(id: number, nombre: string, area: string, moduloId: number): Observable<any> {
    return this.apollo.mutate({
      mutation: UPDATE_PERMISO,
      variables: { id, nombre, area, moduloId }
    }).pipe(map((result: any) => result.data?.updatePermiso));
  }

  deletePermiso(id: number): Observable<boolean> {
    return this.apollo.mutate({
      mutation: DELETE_PERMISO,
      variables: { id }
    }).pipe(map((result: any) => result.data?.deletePermiso));
  }
}
