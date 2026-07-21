import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TrackerService } from '../../../core/services/tracker';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-gerencial',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, NgClass, RouterLink],
  templateUrl: './gerencial.html'
})
export class GerencialComponent implements OnInit {
  private trackerService = inject(TrackerService);
  private authService   = inject(AuthService);
  private router        = inject(Router);

  public cargando    = signal(true);
  public proyectos   = signal<any[]>([]);
  public filtroDivision = signal('todas');
  public filtroEstado   = signal('todos');
  public mostrarFinalizados = signal(false);

  // ── Filtrado ────────────────────────────────────────────────
  public proyectosFiltrados = computed(() => {
    let lista = this.proyectos();
    if (!this.mostrarFinalizados())
      lista = lista.filter(p => p.estado !== 'FINALIZADO_TOTAL');
    if (this.filtroDivision() !== 'todas')
      lista = lista.filter(p => p.lineaNegocio === this.filtroDivision());
    if (this.filtroEstado() !== 'todos')
      lista = lista.filter(p => p.estado === this.filtroEstado());
    return lista;
  });

  // ── KPIs ────────────────────────────────────────────────────
  public kpiActivos      = computed(() => this.proyectosFiltrados().filter(p => !['FINALIZADO_TOTAL','Cancelado','Incumplimiento'].includes(p.estado)).length);
  public kpiPresupuesto  = computed(() => this.proyectosFiltrados().reduce((s, p) => s + (p.valorOC || 0), 0));
  public kpiFacturado    = computed(() => this.proyectosFiltrados().reduce((s, p) => s + (p.valorFacturado || 0), 0));
  public kpiUtilidad     = computed(() => this.kpiFacturado() - this.proyectosFiltrados().reduce((s, p) => s + (p.valorGasto || 0), 0));

  // ── Helpers ─────────────────────────────────────────────────
  divisionLabel(linea: string): string {
    return ({ civiles: 'Construcción', energia: 'Energía', telecomunicaciones: 'O&M' } as any)[linea] || linea;
  }

  divisionColor(linea: string): string {
    return ({ civiles: 'bg-blue-100 text-blue-700', energia: 'bg-yellow-100 text-yellow-700', telecomunicaciones: 'bg-emerald-100 text-emerald-700' } as any)[linea] || 'bg-slate-100 text-slate-600';
  }

  estadoClass(estado: string): string {
    const m: Record<string,string> = {
      'PENDIENTE':            'bg-amber-50 text-amber-700 border-amber-200',
      'PENDIENTE_PRELIMINARES':'bg-orange-50 text-orange-700 border-orange-200',
      'EN_EJECUCIÓN':         'bg-blue-50 text-blue-700 border-blue-200',
      'FINALIZADO_PARCIAL':   'bg-purple-50 text-purple-700 border-purple-200',
      'FINALIZADO_TOTAL':     'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Cancelado':            'bg-red-50 text-red-600 border-red-200',
    };
    return m[estado] || 'bg-slate-50 text-slate-600 border-slate-200';
  }

  margen(p: any): string {
    if (!p.valorFacturado || p.valorFacturado <= 0) return '—';
    const m = ((p.valorFacturado - p.valorGasto) / p.valorFacturado) * 100;
    return m.toFixed(1) + '%';
  }

  margenColor(p: any): string {
    if (!p.valorFacturado || p.valorFacturado <= 0) return 'text-slate-400';
    const m = (p.valorFacturado - p.valorGasto) / p.valorFacturado;
    return m >= 0.2 ? 'text-emerald-600' : m >= 0 ? 'text-amber-600' : 'text-red-500';
  }

  avanceReal(p: any): number {
    if (p.estado === 'FINALIZADO_TOTAL') return 100;
    if (p.estado === 'PENDIENTE') return 0;
    return Math.min(p.porcentajeAvanceFinanciero || 0, 99);
  }

  avanceColor(p: any): string {
    const v = this.avanceReal(p);
    if (v >= 100) return 'bg-emerald-500';
    if (v >= 60)  return 'bg-[#1e3a8a]';
    if (v >= 30)  return 'bg-amber-500';
    return 'bg-slate-300';
  }

  slaTexto(p: any): string {
    if (!p.fechaAsignacion) return '—';
    const inicio = new Date(p.fechaAsignacion);
    const fin    = p.fechaRespuestaCliente ? new Date(p.fechaRespuestaCliente) : new Date();
    const dias   = Math.floor((fin.getTime() - inicio.getTime()) / 86400000);
    return dias + 'd';
  }

  slaColor(p: any): string {
    if (!p.fechaRespuestaCliente) return 'text-amber-500';
    const inicio = new Date(p.fechaAsignacion);
    const fin    = new Date(p.fechaRespuestaCliente);
    const dias   = Math.floor((fin.getTime() - inicio.getTime()) / 86400000);
    return dias <= 1 ? 'text-emerald-600' : dias <= 2 ? 'text-amber-600' : 'text-red-500';
  }

  ejecutor(p: any): string {
    const ots = p.ordenesTrabajo || [];
    if (!ots.length) return '—';
    const ot = ots[0];
    return ot.tecnicoInterno?.nombre || ot.contratistaNombre || '—';
  }

  ocTexto(p: any): string {
    if (!p.numeroOC?.trim()) return 'Sin OC';
    return p.numeroOC.toUpperCase() === 'PENDIENTE' ? 'PENDIENTE' : p.numeroOC;
  }

  ocColor(p: any): string {
    if (!p.numeroOC?.trim()) return 'text-red-400';
    return p.numeroOC.toUpperCase() === 'PENDIENTE' ? 'text-amber-500' : 'text-slate-700';
  }

  ngOnInit() {
    if (!this.authService.hasPermission('proyectos.gerente')) {
      this.router.navigate(['/proyectos']);
      return;
    }
    this.trackerService.getTodosLosProyectosConsolidado().subscribe({
      next: data => { this.proyectos.set(data); this.cargando.set(false); },
      error: ()  => this.cargando.set(false)
    });
  }
}
