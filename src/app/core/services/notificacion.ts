import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable, map, catchError, of } from 'rxjs';

export interface NotificacionDto {
  id: number;
  tipo: string;
  mensaje: string;
  entidadId?: string | null;   // Guid de la tarea relacionada
  leida: boolean;
  fechaCreacion: string;
}

const GET_MIS_NOTIFICACIONES = gql`
  query GetMisNotificaciones {
    misNotificaciones {
      id
      tipo
      mensaje
      entidadId
      leida
      fechaCreacion
    }
  }
`;

const MARCAR_LEIDA = gql`
  mutation MarcarNotificacionLeida($id: Int!) {
    marcarNotificacionLeida(id: $id) {
      id
      leida
    }
  }
`;

const MARCAR_TODAS_LEIDAS = gql`
  mutation MarcarTodasNotificacionesLeidas {
    marcarTodasNotificacionesLeidas
  }
`;

const ELIMINAR_NOTIFICACION = gql`
  mutation EliminarNotificacion($id: Int!) {
    eliminarNotificacion(id: $id)
  }
`;

const ELIMINAR_LEIDAS = gql`
  mutation EliminarNotificacionesLeidas {
    eliminarNotificacionesLeidas
  }
`;

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private apollo = inject(Apollo);

  getMisNotificaciones(): Observable<NotificacionDto[]> {
    return this.apollo.query<any>({
      query: GET_MIS_NOTIFICACIONES,
      fetchPolicy: 'network-only'
    }).pipe(
      map(r => r.data?.misNotificaciones ?? []),
      catchError(() => of([]))
    );
  }

  marcarLeida(id: number): Observable<boolean> {
    return this.apollo.mutate<any>({
      mutation: MARCAR_LEIDA,
      variables: { id }
    }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  marcarTodasLeidas(): Observable<boolean> {
    return this.apollo.mutate<any>({
      mutation: MARCAR_TODAS_LEIDAS
    }).pipe(
      map(r => r.data?.marcarTodasNotificacionesLeidas ?? false),
      catchError(() => of(false))
    );
  }

  eliminarNotificacion(id: number): Observable<boolean> {
    return this.apollo.mutate<any>({
      mutation: ELIMINAR_NOTIFICACION,
      variables: { id }
    }).pipe(
      map(r => r.data?.eliminarNotificacion ?? false),
      catchError(() => of(false))
    );
  }

  eliminarNotificacionesLeidas(): Observable<boolean> {
    return this.apollo.mutate<any>({
      mutation: ELIMINAR_LEIDAS
    }).pipe(
      map(r => r.data?.eliminarNotificacionesLeidas ?? false),
      catchError(() => of(false))
    );
  }
}
