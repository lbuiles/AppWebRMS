import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

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
  private router = inject(Router);

  // --- Lógica de UI (Sidebar Toggle) ---
  private menuOpen = new BehaviorSubject<boolean>(false);
  public menuOpen$ = this.menuOpen.asObservable();

  constructor() {
    // Punto 2 (semana 39): en móvil el menú lateral quedaba abierto y
    // congelaba la navegación al cambiar de ruta (nadie lo cerraba).
    // Lo cerramos automáticamente en cada navegación completada.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.close());
  }

  toggle() {
    this.menuOpen.next(!this.menuOpen.value);
  }

  close() {
    this.menuOpen.next(false);
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
