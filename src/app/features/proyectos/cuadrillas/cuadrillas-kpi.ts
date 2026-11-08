import { Component, inject, input, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  CuadrillaService, CuadrillaKpiResult, CuadrillaKpiBloque, CuadrillaIndicador, CuadrillaTecnico,
  CuadrillaProyectoOpcion, CuadrillaDiaImproductivoManual, CuadrillaDiaImproductivo, mensajeError, soloFecha
} from '../../../core/services/cuadrilla';

@Component({
  selector: 'app-cuadrillas-kpi',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="space-y-4">
  <div class="flex flex-wrap gap-2 bg-white rounded-xl border border-gray-200 p-3">
    <select [ngModel]="fTecnico()" (ngModelChange)="fTecnico.set($event); cargar()" class="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
      <option value="">Todos los técnicos</option>
      @for (t of tecnicos(); track t.id) { <option [value]="t.id">{{ t.nombre }}</option> }
    </select>
    @if (puedeProgramar()) {
      <select [ngModel]="fProyecto()" (ngModelChange)="fProyecto.set($event); cargar()" class="border border-gray-300 rounded-lg px-2 py-1.5 text-sm max-w-[16rem]">
        <option value="">Todos los proyectos</option>
        @for (p of proyectos(); track p.id) { <option [value]="p.id">{{ p.codigo }} · {{ p.nombre }}</option> }
      </select>
    }
    @if (kpi(); as k) { <span class="ml-auto text-xs text-gray-500 self-center">Corte de cálculo: {{ k.corteHasta.substring(0,10) }}</span> }
  </div>

  @if (cargando()) { <div class="text-sm text-gray-500">Calculando…</div> }

  @if (kpi(); as k) {
    <!-- Indicadores globales -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      @for (i of k.global.indicadores; track i.codigo) {
        <div class="bg-white rounded-xl border p-4" [class]="borde(i)">
          <div class="text-xs font-semibold text-gray-500 uppercase">{{ i.titulo }}</div>
          <div class="text-3xl font-bold mt-1" [class]="texto(i)">{{ valor(i) }}</div>
          <div class="text-xs text-gray-500 mt-1">
            @if (i.meta != null) { Meta {{ i.meta }}% · }
            {{ i.numerador }} / {{ i.denominador }}
            @if (i.peso != null) { · Peso {{ i.peso }}% }
          </div>
          <div class="text-[11px] text-gray-400 mt-2">{{ i.formula }} · {{ i.frecuencia }}</div>
        </div>
      }
    </div>

    <div class="flex flex-wrap gap-4 text-sm text-gray-600">
      <span>Horas productivas: <b>{{ k.global.horasProductivas }}</b></span>
      <span>Horas disponibles: <b>{{ k.global.horasDisponibles }}</b></span>
      <span>Días improductivos: <b>{{ k.global.diasImproductivos }}</b></span>
      <span>Días justificados: <b>{{ k.global.diasJustificados }}</b></span>
    </div>

    <!-- Por técnico -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th class="px-3 py-2 text-left">Técnico</th>
            @for (i of k.global.indicadores; track i.codigo) { <th class="px-3 py-2 text-right">{{ i.titulo }}</th> }
            <th class="px-3 py-2 text-right">H. prod.</th>
            <th class="px-3 py-2 text-right">H. disp.</th>
            <th class="px-3 py-2 text-right">Días improd.</th>
          </tr>
        </thead>
        <tbody>
          @for (t of k.porTecnico; track t.tecnicoId) {
            <tr class="border-t border-gray-100">
              <td class="px-3 py-2 font-medium">{{ t.tecnicoNombre }}</td>
              @for (i of t.resultado.indicadores; track i.codigo) {
                <td class="px-3 py-2 text-right font-semibold" [class]="texto(i)">{{ valor(i) }}</td>
              }
              <td class="px-3 py-2 text-right">{{ t.resultado.horasProductivas }}</td>
              <td class="px-3 py-2 text-right">{{ t.resultado.horasDisponibles }}</td>
              <td class="px-3 py-2 text-right">{{ t.resultado.diasImproductivos }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Días improductivos -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-bold text-[#1e3a8a]">Días improductivos</h3>
        @if (puedeProgramar()) {
          <button type="button" (click)="marcarManual()" class="px-3 py-1.5 rounded-lg bg-[#ffb31c] text-[#1e3a8a] text-xs font-bold">+ Marcar día improductivo</button>
        }
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase text-gray-500">
            <tr><th class="px-2 py-1 text-left">Fecha</th><th class="px-2 py-1 text-left">Técnico</th><th class="px-2 py-1 text-left">Origen</th><th class="px-2 py-1 text-left">Motivo</th><th></th></tr>
          </thead>
          <tbody>
            @for (d of k.diasImproductivos; track d.tecnicoId + d.fecha) {
              <tr class="border-t border-gray-100">
                <td class="px-2 py-1 whitespace-nowrap">{{ d.fecha.substring(0,10) }}</td>
                <td class="px-2 py-1">{{ d.tecnicoNombre }}</td>
                <td class="px-2 py-1">{{ d.origen }} @if (d.justificado) { <span class="text-green-600 font-semibold">· justificado</span> }</td>
                <td class="px-2 py-1">{{ d.motivo }}</td>
                <td class="px-2 py-1 text-right">
                  @if (puedeProgramar() && !d.justificado) {
                    <button type="button" (click)="justificar(d)" class="text-xs text-[#1e3a8a] font-semibold hover:underline">Justificar</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="px-2 py-4 text-center text-gray-400">Sin días improductivos en el periodo.</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (manuales().length) {
        <div class="pt-2 border-t border-gray-100">
          <div class="text-xs font-semibold text-gray-500 mb-1">Registros manuales</div>
          <ul class="text-xs text-gray-600 space-y-1">
            @for (m of manuales(); track m.id) {
              <li class="flex items-center justify-between">
                <span>{{ soloFecha(m.fecha) }} · {{ m.tecnico?.nombre }} · {{ m.tipo }} — {{ m.motivo }}</span>
                @if (puedeProgramar()) { <button type="button" (click)="quitarManual(m)" class="text-red-600 hover:underline">Quitar</button> }
              </li>
            }
          </ul>
        </div>
      }
    </div>

    @if (k.notas.length) {
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
        @for (n of k.notas; track $index) { <div>• {{ n }}</div> }
      </div>
    }
  }
</div>
  `,
})
export class CuadrillasKpiComponent {
  private svc = inject(CuadrillaService);

  desde = input.required<string>();
  hasta = input.required<string>();
  tecnicos = input<CuadrillaTecnico[]>([]);
  proyectos = input<CuadrillaProyectoOpcion[]>([]);
  puedeProgramar = input<boolean>(false);

  fTecnico = signal('');
  fProyecto = signal('');
  kpi = signal<CuadrillaKpiResult | null>(null);
  manuales = signal<CuadrillaDiaImproductivoManual[]>([]);
  cargando = signal(false);
  soloFecha = soloFecha;

  constructor() {
    effect(() => { this.desde(); this.hasta(); this.cargar(); });
  }

  cargar() {
    this.cargando.set(true);
    const d = this.desde(), h = this.hasta();
    this.svc.getKpis(d, h, this.fTecnico() || null, null, this.fProyecto() || null).subscribe({
      next: r => { this.kpi.set(r); this.cargando.set(false); },
      error: e => { this.cargando.set(false); Swal.fire('Error', mensajeError(e), 'error'); }
    });
    this.svc.getDiasImproductivosManuales(d, h, this.fTecnico() || null).subscribe(m => this.manuales.set(m));
  }

  valor(i: CuadrillaIndicador) { return i.tieneDatos && i.valor != null ? `${i.valor}%` : 'N/D'; }
  texto(i: CuadrillaIndicador) {
    if (!i.tieneDatos || i.cumple == null) return 'text-gray-500';
    return i.cumple ? 'text-green-600' : 'text-red-600';
  }
  borde(i: CuadrillaIndicador) {
    if (!i.tieneDatos || i.cumple == null) return 'border-gray-200';
    return i.cumple ? 'border-green-300' : 'border-red-300';
  }

  async justificar(d: CuadrillaDiaImproductivo) {
    const r = await Swal.fire({
      title: 'Justificar día improductivo', text: `${d.tecnicoNombre} · ${d.fecha.substring(0, 10)}`,
      input: 'text', inputPlaceholder: 'Motivo de la justificación', showCancelButton: true,
      inputValidator: v => (!v?.trim() ? 'El motivo es obligatorio' : null)
    });
    if (!r.isConfirmed) return;
    this.svc.marcarDiaImproductivo(d.tecnicoId, d.fecha.substring(0, 10), 'JUSTIFICADO', r.value).subscribe({
      next: () => this.cargar(), error: e => Swal.fire('Error', mensajeError(e), 'error')
    });
  }

  async marcarManual() {
    const opciones = this.tecnicos().map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
    const r = await Swal.fire({
      title: 'Marcar día improductivo',
      html: `<select id="sw-tec" class="swal2-input">${opciones}</select>
             <input id="sw-fecha" type="date" class="swal2-input">
             <input id="sw-motivo" class="swal2-input" placeholder="Motivo">`,
      showCancelButton: true, focusConfirm: false,
      preConfirm: () => {
        const tec = (document.getElementById('sw-tec') as HTMLSelectElement).value;
        const fecha = (document.getElementById('sw-fecha') as HTMLInputElement).value;
        const motivo = (document.getElementById('sw-motivo') as HTMLInputElement).value.trim();
        if (!tec || !fecha || !motivo) { Swal.showValidationMessage('Completa técnico, fecha y motivo'); return false; }
        return { tec, fecha, motivo };
      }
    });
    if (!r.isConfirmed || !r.value) return;
    this.svc.marcarDiaImproductivo(r.value.tec, r.value.fecha, 'MARCADO', r.value.motivo).subscribe({
      next: () => this.cargar(), error: e => Swal.fire('Error', mensajeError(e), 'error')
    });
  }

  quitarManual(m: CuadrillaDiaImproductivoManual) {
    this.svc.eliminarDiaImproductivo(m.id).subscribe({
      next: () => this.cargar(), error: e => Swal.fire('Error', mensajeError(e), 'error')
    });
  }
}
