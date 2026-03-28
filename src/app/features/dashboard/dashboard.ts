import { Component } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

export interface Proyecto {
  codigo: string;
  nombre: string;
  cliente: string;
  estado: string;
  noPO: number;
  valorPO: number;
  facturado: number;
  gasto: number;
  responsable: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [BaseChartDirective, CurrencyPipe],
  templateUrl: './dashboard.html'
})
export class DashboardComponent {

  // ==========================================
  // 1. DATOS PARA GRÁFICOS (CHART.JS)
  // ==========================================

  // Gráfico 1: Facturación General (Barras)
  public facturacionData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      // Azul corporativo para lo Facturado
      { data: [15, 12, 18, 20, 16, 19, 17, 18, 16, 19, 16, 15], label: 'Facturado', backgroundColor: '#1e3a8a', borderRadius: 4 },
      // Gris elegante para el PO
      { data: [4, 6, 3, 4, 5, 2, 6, 2, 4, 3, 5, 4], label: 'PO', backgroundColor: '#d1d5db', borderRadius: 4 }
    ]
  };
  public facturacionOptions: ChartOptions<'bar'> = { responsive: true, maintainAspectRatio: false };

  // Gráfico 2: Distribución de estados generales (Doughnut)
  public estadosData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Pendiente', 'En ejecución', 'Finalizado'],
    datasets: [
      {
        data: [25, 44, 20],
        // Paleta RMS adaptada
        backgroundColor: ['#ffb31c', '#1e3a8a', '#10b981'],
        hoverBackgroundColor: ['#e6a219', '#172c6b', '#059669'],
        borderWidth: 0
      }
    ]
  };
  public estadosOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { family: 'sans-serif' } } }
    },
    layout: { padding: 10 }
  };

  // Gráfico 3: Utilidad por proyecto (Barras descendentes)
  public utilidadData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    datasets: [
      // Amarillo corporativo para la utilidad
      { data: [50, 42, 42, 38, 30, 22, 18, 10], label: 'Utilidad %', backgroundColor: '#ffb31c', borderRadius: 4 }
    ]
  };
  public utilidadOptions: ChartOptions<'bar'> = { responsive: true, maintainAspectRatio: false };

  // ==========================================
  // 2. DATOS PARA LA TABLA DE PROYECTOS
  // ==========================================

  public proyectos: Proyecto[] = [
    { codigo: 'C00123', nombre: 'Proyecto A', cliente: 'Cliente X', estado: 'En ejecución', noPO: 6, valorPO: 5000000, facturado: 3000000, gasto: 2800000, responsable: 'Juan Pérez' },
    { codigo: 'C00156', nombre: 'Proyecto B', cliente: 'Cliente Y', estado: 'Pendiente', noPO: 0, valorPO: 0, facturado: 6000, gasto: 6200, responsable: 'Ana Gómez' },
    { codigo: 'C00289', nombre: 'Proyecto C', cliente: 'Cliente Z', estado: 'Finalizado', noPO: 1, valorPO: 8000000, facturado: 5000000, gasto: 6500000, responsable: 'Carlos Ruiz' },
    { codigo: 'C00145', nombre: 'Proyecto D', cliente: 'Cliente X', estado: 'Cancelado', noPO: 0, valorPO: 0, facturado: 60, gasto: 0.50, responsable: 'Laura Martinez' }
  ];
}
