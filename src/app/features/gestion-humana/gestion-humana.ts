import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';

export interface Capacitacion {
  tema: string;
  fecha: Date;
  modalidad: string;
  estado: 'Programada' | 'En Curso' | 'Completada';
}

export interface AlertaSST {
  tipo: string;
  descripcion: string;
  nivel: 'Alto' | 'Medio' | 'Bajo';
  fecha: Date;
}

@Component({
  selector: 'app-gestion-humana',
  standalone: true,
  imports: [DatePipe], // Importamos el pipe de fechas
  templateUrl: './gestion-humana.html'
})
export class GestionHumanaComponent {

  // KPIs
  public totalEmpleados = 142;
  public indiceAusentismo = '2.4%';
  public capacitacionesPendientes = 5;
  public incidentesActivos = 1;

  // Tabla de Capacitaciones
  public capacitaciones: Capacitacion[] = [
    { tema: 'Manejo seguro de herramientas', fecha: new Date(2026, 2, 10), modalidad: 'Presencial - Obra Sur', estado: 'Programada' },
    { tema: 'Primeros Auxilios Básicos', fecha: new Date(2026, 2, 15), modalidad: 'Virtual', estado: 'Programada' },
    { tema: 'Trabajo en Alturas (Reentrenamiento)', fecha: new Date(2026, 2, 5), modalidad: 'Presencial - Centro', estado: 'Completada' }
  ];

  // Lista de Alertas SST
  public alertas: AlertaSST[] = [
    { tipo: 'Incidente Leve', descripcion: 'Corte superficial en mano - Operario Juan Pérez', nivel: 'Medio', fecha: new Date(2026, 2, 4) },
    { tipo: 'Examen Médico', descripcion: 'Exámenes ocupacionales periódicos por vencer (3 empleados)', nivel: 'Alto', fecha: new Date(2026, 2, 20) },
    { tipo: 'Inspección', descripcion: 'Revisión de extintores en Bodega Principal', nivel: 'Bajo', fecha: new Date(2026, 2, 12) }
  ];
}
