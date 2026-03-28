import { Component } from '@angular/core';

export interface Tarea {
  id: string;
  titulo: string;
  proyecto: string;
  estado: 'Por Hacer' | 'En Curso' | 'Terminado';
  prioridad: 'Alta' | 'Media' | 'Baja';
  responsable: string;
}

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [],
  templateUrl: './tareas.html'
})
export class TareasComponent {
  public tareas: Tarea[] = [
    { id: 'TSK-101', titulo: 'Aprobación de planos estructurales', proyecto: 'Edificio Corporativo Norte', estado: 'Por Hacer', prioridad: 'Alta', responsable: 'Carlos Ruiz' },
    { id: 'TSK-102', titulo: 'Cotización de materiales', proyecto: 'Remodelación Oficinas Sur', estado: 'Por Hacer', prioridad: 'Media', responsable: 'Ana Gómez' },
    { id: 'TSK-103', titulo: 'Revisión de PBIs y configuración de red', proyecto: 'Bodega Industrial Logística', estado: 'En Curso', prioridad: 'Alta', responsable: 'Juan Pérez' },
    { id: 'TSK-104', titulo: 'Permisos de obra civil', proyecto: 'Edificio Corporativo Norte', estado: 'En Curso', prioridad: 'Media', responsable: 'Laura Martinez' },
    { id: 'TSK-105', titulo: 'Levantamiento topográfico', proyecto: 'Bodega Industrial Logística', estado: 'Terminado', prioridad: 'Baja', responsable: 'Carlos Ruiz' }
  ];

  // Estas funciones filtran las tareas automáticamente para cada columna del tablero
  get porHacer() { return this.tareas.filter(t => t.estado === 'Por Hacer'); }
  get enCurso() { return this.tareas.filter(t => t.estado === 'En Curso'); }
  get terminado() { return this.tareas.filter(t => t.estado === 'Terminado'); }
}
