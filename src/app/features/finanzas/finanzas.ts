import { Component } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

export interface Factura {
  numero: string;
  cliente: string;
  fechaEmision: Date;
  monto: number;
  estado: 'Pagada' | 'Pendiente' | 'Vencida';
}

@Component({
  selector: 'app-finanzas',
  standalone: true,
  // ¡Muy importante importar BaseChartDirective para que el gráfico funcione!
  imports: [BaseChartDirective, CurrencyPipe, DatePipe],
  templateUrl: './finanzas.html'
})
export class FinanzasComponent {

  // 1. Datos para las Tarjetas KPI
  public totalFacturado = 450000000;
  public porCobrar = 125680000;
  public totalEgresos = 210000000;
  public margenUtilidad = '35%';

  // 2. Configuración del Gráfico de Flujo de Caja (Barras)
  public flujoCajaData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'],
    datasets: [
      { data: [650, 590, 800, 810, 560, 550], label: 'Ingresos (Millones)', backgroundColor: '#3b82f6' }, // Azul corporativo
      { data: [280, 480, 400, 190, 860, 270], label: 'Egresos (Millones)', backgroundColor: '#94a3b8' }  // Gris pizarra suave
    ]
  };
  public flujoCajaOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' }
    }
  };

  // 3. Tabla de Facturas Recientes
  public facturas: Factura[] = [
    { numero: 'FAC-2026-001', cliente: 'Inversiones ABC', fechaEmision: new Date(2026, 2, 1), monto: 45000000, estado: 'Pagada' },
    { numero: 'FAC-2026-002', cliente: 'TechCorp SAS', fechaEmision: new Date(2026, 2, 3), monto: 12500000, estado: 'Pendiente' },
    { numero: 'FAC-2026-003', cliente: 'Constructora XYZ', fechaEmision: new Date(2026, 1, 15), monto: 85000000, estado: 'Vencida' },
    { numero: 'FAC-2026-004', cliente: 'Logística Express', fechaEmision: new Date(2026, 2, 5), monto: 32000000, estado: 'Pendiente' }
  ];
}
