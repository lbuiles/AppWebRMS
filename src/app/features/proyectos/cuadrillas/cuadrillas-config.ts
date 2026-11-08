import { Component, OnInit, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  CuadrillaService, CuadrillaTecnico, CuadrillaCompensatorio, CuadrillaConfigHoras, CuadrillaFestivo,
  Cuadrilla, mensajeError, soloFecha
} from '../../../core/services/cuadrilla';

@Component({
  selector: 'app-cuadrillas-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">

  <!-- Parámetros generales -->
  <section class="bg-white rounded-xl border border-gray-200 p-4 space-y-3 xl:col-span-2">
    <h3 class="font-bold text-[#1e3a8a]">Reglas de fechas</h3>
    <div class="flex flex-wrap items-end gap-3 text-sm">
      <label class="block"><span class="text-xs text-gray-500">Días hacia atrás permitidos para crear / editar / eliminar actividades</span>
        <input type="number" min="0" max="365" [(ngModel)]="diasRetro" class="w-28 border border-gray-300 rounded-lg px-2 py-1.5"></label>
      <button type="button" (click)="guardarParametros()" class="px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold">Guardar</button>
    </div>
    <p class="text-xs text-gray-500">Quien programa puede trabajar con fechas desde hoy menos estos días. Más atrás solo quien tiene permiso de configuración. La fecha de hoy y el futuro son libres.</p>
  </section>

  <!-- Base de horas -->
  <section class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
    <h3 class="font-bold text-[#1e3a8a]">Base de horas</h3>
    <p class="text-xs text-gray-500">La configuración vigente más reciente (por técnico o general) define las horas disponibles. Sin técnico = general.</p>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-2 items-end text-sm">
      <label class="block md:col-span-2"><span class="text-xs text-gray-500">Técnico</span>
        <select [(ngModel)]="cfg.tecnicoId" class="w-full border border-gray-300 rounded-lg px-2 py-1.5">
          <option value="">General (todos)</option>
          @for (t of tecnicos(); track t.id) { <option [value]="t.id">{{ t.nombre }}</option> }
        </select></label>
      <label class="block"><span class="text-xs text-gray-500">Horas/sem</span>
        <input type="number" min="1" step="0.5" [(ngModel)]="cfg.horasSemanales" class="w-full border border-gray-300 rounded-lg px-2 py-1.5"></label>
      <label class="block"><span class="text-xs text-gray-500">Días/sem</span>
        <input type="number" min="1" max="7" [(ngModel)]="cfg.diasLaborales" class="w-full border border-gray-300 rounded-lg px-2 py-1.5"></label>
      <label class="block"><span class="text-xs text-gray-500">Vigente desde</span>
        <input type="date" [(ngModel)]="cfg.vigenteDesde" class="w-full border border-gray-300 rounded-lg px-2 py-1.5"></label>
    </div>
    <button type="button" (click)="guardarCfg()" class="px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold">Guardar configuración</button>

    <table class="min-w-full text-sm">
      <thead class="text-xs uppercase text-gray-500"><tr><th class="text-left px-2 py-1">Aplica a</th><th class="text-right px-2 py-1">H/sem</th><th class="text-right px-2 py-1">Días</th><th class="text-left px-2 py-1">Desde</th><th></th></tr></thead>
      <tbody>
        @for (c of configs(); track c.id) {
          <tr class="border-t border-gray-100">
            <td class="px-2 py-1">{{ c.tecnico?.nombre || 'General' }}</td>
            <td class="px-2 py-1 text-right">{{ c.horasSemanales }}</td>
            <td class="px-2 py-1 text-right">{{ c.diasLaborales }}</td>
            <td class="px-2 py-1">{{ soloFecha(c.vigenteDesde) }}</td>
            <td class="px-2 py-1 text-right"><button type="button" (click)="quitarCfg(c)" class="text-xs text-red-600 hover:underline">Quitar</button></td>
          </tr>
        }
      </tbody>
    </table>
  </section>

  <!-- Compensatorios -->
  <section class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
    <h3 class="font-bold text-[#1e3a8a]">Compensatorios</h3>
    <p class="text-xs text-gray-500">Los días gastados se calculan con los registros tipo "Descanso"; aquí se edita lo acumulado.</p>
    <table class="min-w-full text-sm">
      <thead class="text-xs uppercase text-gray-500"><tr><th class="text-left px-2 py-1">Técnico</th><th class="text-right px-2 py-1">Acumulados</th><th class="text-right px-2 py-1">Gastados</th><th class="text-right px-2 py-1">Pendientes</th></tr></thead>
      <tbody>
        @for (c of compensatorios(); track c.tecnicoId) {
          <tr class="border-t border-gray-100">
            <td class="px-2 py-1">{{ c.tecnicoNombre }}</td>
            <td class="px-2 py-1 text-right">
              <input type="number" min="0" step="0.5" [ngModel]="c.diasAcumulados" (change)="guardarComp(c, $any($event.target).value)"
                     class="w-20 border border-gray-300 rounded px-1 py-0.5 text-right">
            </td>
            <td class="px-2 py-1 text-right">{{ c.diasGastados }}</td>
            <td class="px-2 py-1 text-right font-semibold" [class.text-red-600]="c.diasPendientes < 0">{{ c.diasPendientes }}</td>
          </tr>
        }
      </tbody>
    </table>
  </section>

  <!-- Festivos -->
  <section class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="font-bold text-[#1e3a8a]">Festivos (Colombia)</h3>
      <select [ngModel]="anio()" (ngModelChange)="anio.set(+$event); cargarFestivos()" class="border border-gray-300 rounded-lg px-2 py-1 text-sm">
        @for (a of anios; track a) { <option [value]="a">{{ a }}</option> }
      </select>
    </div>
    <div class="flex gap-2 text-sm">
      <input type="date" [(ngModel)]="nuevoFestivo.fecha" class="border border-gray-300 rounded-lg px-2 py-1.5">
      <input type="text" [(ngModel)]="nuevoFestivo.nombre" placeholder="Nombre" class="flex-1 border border-gray-300 rounded-lg px-2 py-1.5">
      <button type="button" (click)="agregarFestivo()" class="px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold">Agregar</button>
    </div>
    <ul class="text-sm divide-y divide-gray-100 max-h-72 overflow-y-auto">
      @for (f of festivos(); track f.fecha) {
        <li class="flex items-center justify-between py-1">
          <span>{{ soloFecha(f.fecha) }} · {{ f.nombre }}</span>
          <button type="button" (click)="quitarFestivo(f)" class="text-xs text-red-600 hover:underline">Quitar</button>
        </li>
      }
    </ul>
  </section>

  <!-- Cuadrillas -->
  <section class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
    <h3 class="font-bold text-[#1e3a8a]">Cuadrillas y miembros</h3>
    <div class="flex gap-2 text-sm">
      <input type="text" [(ngModel)]="nuevaCuadrilla" placeholder="Nombre de nueva cuadrilla" class="flex-1 border border-gray-300 rounded-lg px-2 py-1.5">
      <button type="button" (click)="crearCuadrilla()" class="px-3 py-1.5 rounded-lg bg-[#1e3a8a] text-white text-xs font-semibold">Crear</button>
    </div>
    @for (c of cuadrillas(); track c.id) {
      <div class="border border-gray-200 rounded-lg p-3 space-y-2">
        <div class="font-semibold">{{ c.nombre }} <span class="text-xs text-gray-400">{{ c.lineaNegocio }}</span></div>
        <div class="flex flex-wrap gap-1">
          @for (m of c.miembros; track m.usuarioId) {
            <span class="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2 py-0.5 text-xs">
              {{ m.usuario?.nombre }}
              <button type="button" (click)="quitarMiembro(c, m.usuarioId)" class="text-red-500 font-bold">×</button>
            </span>
          }
        </div>
        <select (change)="agregarMiembro(c, $any($event.target).value); $any($event.target).value = ''" class="border border-gray-300 rounded-lg px-2 py-1 text-xs">
          <option value="">+ Agregar miembro…</option>
          @for (t of tecnicos(); track t.id) { <option [value]="t.id">{{ t.nombre }}</option> }
        </select>
      </div>
    }
  </section>
</div>
  `,
})
export class CuadrillasConfigComponent implements OnInit {
  private svc = inject(CuadrillaService);
  tecnicos = input<CuadrillaTecnico[]>([]);

  soloFecha = soloFecha;
  anios = [2026, 2027, 2028];
  anio = signal(new Date().getFullYear());

  compensatorios = signal<CuadrillaCompensatorio[]>([]);
  configs = signal<CuadrillaConfigHoras[]>([]);
  festivos = signal<CuadrillaFestivo[]>([]);
  cuadrillas = signal<Cuadrilla[]>([]);

  diasRetro = 7;
  cfg = { tecnicoId: '', horasSemanales: 42, diasLaborales: 6, vigenteDesde: '' };
  nuevoFestivo = { fecha: '', nombre: '' };
  nuevaCuadrilla = '';

  ngOnInit() {
    if (!this.anios.includes(this.anio())) this.anios = [...this.anios, this.anio()].sort();
    this.cargarTodo();
  }

  private err = (e: any) => Swal.fire('Error', mensajeError(e), 'error');

  cargarTodo() {
    this.svc.getParametros().subscribe(p => this.diasRetro = p.diasMaxRetroactivo);
    this.svc.getCompensatorios().subscribe(c => this.compensatorios.set(c));
    this.svc.getConfigHoras().subscribe(c => this.configs.set(c));
    this.svc.getCuadrillas().subscribe(c => this.cuadrillas.set(c));
    this.cargarFestivos();
  }
  cargarFestivos() { this.svc.getFestivos(this.anio()).subscribe(f => this.festivos.set(f)); }

  guardarParametros() {
    const n = Number(this.diasRetro);
    if (!Number.isInteger(n) || n < 0 || n > 365) {
      Swal.fire('Valor no válido', 'Ingresa un número entero entre 0 y 365.', 'warning'); return;
    }
    this.svc.guardarParametros(n).subscribe({
      next: () => Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false }),
      error: this.err
    });
  }

  guardarCfg() {
    if (!this.cfg.vigenteDesde || !this.cfg.horasSemanales || !this.cfg.diasLaborales) {
      Swal.fire('Datos incompletos', 'Indica horas, días y fecha de vigencia.', 'warning'); return;
    }
    this.svc.guardarConfigHoras({ ...this.cfg, tecnicoId: this.cfg.tecnicoId || null }).subscribe({
      next: () => this.svc.getConfigHoras().subscribe(c => this.configs.set(c)), error: this.err
    });
  }
  quitarCfg(c: CuadrillaConfigHoras) {
    this.svc.eliminarConfigHoras(c.id).subscribe({
      next: () => this.svc.getConfigHoras().subscribe(x => this.configs.set(x)), error: this.err
    });
  }

  guardarComp(c: CuadrillaCompensatorio, v: string) {
    const n = Number(v);
    if (isNaN(n) || n < 0) return;
    this.svc.guardarCompensatorio(c.tecnicoId, n).subscribe({
      next: () => this.svc.getCompensatorios().subscribe(x => this.compensatorios.set(x)), error: this.err
    });
  }

  agregarFestivo() {
    if (!this.nuevoFestivo.fecha || !this.nuevoFestivo.nombre.trim()) return;
    this.svc.guardarFestivo(this.nuevoFestivo.fecha, this.nuevoFestivo.nombre.trim()).subscribe({
      next: () => { this.nuevoFestivo = { fecha: '', nombre: '' }; this.cargarFestivos(); }, error: this.err
    });
  }
  quitarFestivo(f: CuadrillaFestivo) {
    this.svc.eliminarFestivo(soloFecha(f.fecha)).subscribe({ next: () => this.cargarFestivos(), error: this.err });
  }

  crearCuadrilla() {
    if (!this.nuevaCuadrilla.trim()) return;
    this.svc.guardarCuadrilla(null, this.nuevaCuadrilla.trim(), null, true).subscribe({
      next: () => { this.nuevaCuadrilla = ''; this.svc.getCuadrillas().subscribe(c => this.cuadrillas.set(c)); }, error: this.err
    });
  }
  agregarMiembro(c: Cuadrilla, usuarioId: string) {
    if (!usuarioId) return;
    this.svc.agregarMiembro(c.id, usuarioId).subscribe({
      next: () => this.svc.getCuadrillas().subscribe(x => this.cuadrillas.set(x)), error: this.err
    });
  }
  quitarMiembro(c: Cuadrilla, usuarioId: string) {
    this.svc.quitarMiembro(c.id, usuarioId).subscribe({
      next: () => this.svc.getCuadrillas().subscribe(x => this.cuadrillas.set(x)), error: this.err
    });
  }
}
