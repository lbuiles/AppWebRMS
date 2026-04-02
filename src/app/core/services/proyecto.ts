import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map } from 'rxjs';

const GET_CATEGORIAS_PROYECTO = gql`
  query GetCategoriasProyecto {
    categoriasProyecto {
      id
      nombre
      descripcion
      icono
      cantidadActivos
      presupuestoTotal
      colorTema
      bgTema
      permisoRequerido
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private apollo = inject(Apollo);

  getCategorias(): Observable<any[]> {
    return this.apollo.watchQuery<any>({
      query: GET_CATEGORIAS_PROYECTO,
      fetchPolicy: 'network-only'
    }).valueChanges.pipe(map(r => r.data?.categoriasProyecto || []));
  }
}
