import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';

// 1. Query básico para el Sidebar (Solo lo necesario para navegar)
const GET_MENU_CONFIG = gql`
  query GetMenuConfig {
    menuConfig {
      id
      nombre
      ruta
      icono
      slugRaiz
    }
  }
`;

// 2. Query para el Diccionario (Incluye los permisos de cada módulo)
const GET_MENU_COMPLETO = gql`
  query GetMenuCompleto {
    menuConfig {
      id
      nombre
      slugRaiz
      listaPermisos {  # <--- Asegúrate que diga listaPermisos
        id
        nombre
        slug
      }
    }
  }
`;

// 3. Mutation para crear permisos desde la interfaz
const CREATE_PERMISO = gql`
  mutation CreatePermiso($input: PermisoInputDtoInput!) {
    createPermiso(permisoInputData: $input) {
      id
      nombre
      slug
    }
  }
`;

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private apollo = inject(Apollo);

  // --- Lógica de UI (Sidebar Toggle) ---
  private menuOpen = new BehaviorSubject<boolean>(false);
  public menuOpen$ = this.menuOpen.asObservable();

  toggle() {
    this.menuOpen.next(!this.menuOpen.value);
  }

  // --- Lógica de Datos ---

  /** Usado por el Sidebar */
  getMenuConfig() {
    return this.apollo.query<any>({
      query: GET_MENU_CONFIG,
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => result.data.menuConfig)
    );
  }

  /** Usado por el Diccionario de Permisos */
  getMenuCompleto() {
    return this.apollo.query<any>({
      query: GET_MENU_COMPLETO,
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => result.data.menuConfig)
    );
  }

  /** Mutation para insertar nuevos permisos en la DB */
  crearPermiso(moduloId: number, nombre: string, slug: string, area: string) {
  return this.apollo.mutate({
    mutation: CREATE_PERMISO,
    variables: {
      input: {
        moduloId: moduloId,
        nombre: nombre,
        slug: slug,
        area: area
      }
    }
  });
}

}
