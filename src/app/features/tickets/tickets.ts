import { Component } from '@angular/core';

export interface Ticket {
  codigoSitio: string;
  actividad: string;
  fechaAsignacion: string;
  estado: string;
  prioridad: string;
  responsable: string;
}

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [],
  templateUrl: './tickets.html'
})
export class TicketsComponent {
  public tickets: Ticket[] = [
    { codigoSitio: 'C00123', actividad: 'Mantenimiento Preventivo AA', fechaAsignacion: '2026-03-01', estado: 'Abierto', prioridad: 'Alta', responsable: 'Carlos Ruiz' },
    { codigoSitio: 'C00156', actividad: 'Revisión Tablero Eléctrico', fechaAsignacion: '2026-03-03', estado: 'En Proceso', prioridad: 'Media', responsable: 'Ana Gómez' },
    { codigoSitio: 'C00289', actividad: 'Reparación Tubería', fechaAsignacion: '2026-03-04', estado: 'Cerrado', prioridad: 'Baja', responsable: 'Juan Pérez' },
    { codigoSitio: 'C00341', actividad: 'Inspección de Techo', fechaAsignacion: '2026-03-05', estado: 'Abierto', prioridad: 'Media', responsable: 'Laura Martinez' }
  ];
}
