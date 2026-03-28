import { Component } from '@angular/core';
import { CurrencyPipe, NgClass } from '@angular/common'; // <-- Añadimos NgClass aquí
import { RouterLink } from '@angular/router';

export interface CategoriaProyecto {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  cantidadActivos: number;
  presupuestoTotal: number;
  colorTema: string;
  bgTema: string;
}

@Component({
  selector: 'app-proyectos',
  standalone: true,
  // <-- Añadimos NgClass al arreglo de imports
  imports: [CurrencyPipe, RouterLink, NgClass],
  templateUrl: './proyectos.html'
})
export class ProyectosComponent {

  public categorias: CategoriaProyecto[] = [
    {
      id: 'civiles',
      nombre: 'Obra Civil y Comercial',
      descripcion: 'Diseño, construcción y remodelación de vivienda, espacio público y locales comerciales.',
      icono: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      cantidadActivos: 14,
      presupuestoTotal: 1250000000,
      colorTema: 'text-[#1e3a8a]',
      bgTema: 'bg-blue-50'
    },
    {
      id: 'energia',
      nombre: 'Obra Eléctrica y Energías',
      descripcion: 'Sistemas de energía limpia, paneles solares, adecuaciones eléctricas y legalización de energía.',
      icono: 'M13 10V3L4 14h7v7l9-11h-7z',
      cantidadActivos: 8,
      presupuestoTotal: 450000000,
      colorTema: 'text-[#ffb31c]',
      bgTema: 'bg-yellow-50'
    },
    {
      id: 'telecomunicaciones',
      nombre: 'Telecomunicaciones',
      descripcion: 'Infraestructura de redes, estaciones Greenfield, Rooftop, NOC y mantenimiento estructural.',
      icono: 'M8.04 4.04C8.54 3.54 9.46 3.54 9.96 4.04L13.96 8.04C14.46 8.54 14.46 9.46 13.96 9.96L11.5 12.42C12.82 14.6 14.6 16.38 16.78 17.7L19.24 15.24C19.74 14.74 20.66 14.74 21.16 15.24L25.16 19.24C25.66 19.74 25.66 20.66 21.16 21.16L19.24 23.08C18.24 24.08 16.5 24.42 15 23.82C10.5 22.02 6.5 18.02 4.7 13.52C4.1 12.02 4.44 10.28 5.44 9.28L7.36 7.36C7.86 6.86 8.78 6.86 9.28 7.36Z',
      cantidadActivos: 22,
      presupuestoTotal: 3200000000,
      colorTema: 'text-emerald-600',
      bgTema: 'bg-emerald-50'
    }
  ];
}
