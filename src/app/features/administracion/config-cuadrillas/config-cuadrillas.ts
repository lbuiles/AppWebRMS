import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CuadrillaService, CuadrillaTecnico } from '../../../core/services/cuadrilla';
import { CuadrillasConfigComponent } from '../../proyectos/cuadrillas/cuadrillas-config';

/** Pantalla de Administración: reglas y catálogos del módulo Cuadrillas (permiso proyectos.cuadrillas.config). */
@Component({
  selector: 'app-config-cuadrillas',
  standalone: true,
  imports: [RouterLink, CuadrillasConfigComponent],
  template: `
<div class="p-6 max-w-7xl mx-auto space-y-4">
  <div class="border-b border-gray-200 pb-4">
    <a routerLink="/administracion" class="text-xs text-gray-500 hover:text-[#1e3a8a]">← Administración</a>
    <h1 class="text-2xl font-extrabold text-gray-900">Configuración de Cuadrillas</h1>
    <p class="text-gray-500 text-sm">Reglas de fechas, base de horas, festivos, compensatorios y cuadrillas.</p>
  </div>
  <app-cuadrillas-config [tecnicos]="tecnicos()" />
</div>
  `,
})
export class ConfigCuadrillasComponent implements OnInit {
  private svc = inject(CuadrillaService);
  tecnicos = signal<CuadrillaTecnico[]>([]);
  ngOnInit() { this.svc.getTecnicos().subscribe(t => this.tecnicos.set(t)); }
}
