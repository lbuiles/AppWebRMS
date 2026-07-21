import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CurrencyPipe, CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { ClienteService } from '../../core/services/cliente';
import { TrackerService } from '../../core/services/tracker';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [BaseChartDirective, CurrencyPipe, CommonModule],
  templateUrl: './dashboard.html'
})
export class DashboardComponent implements OnInit {

  private clienteService  = inject(ClienteService);
  private trackerService  = inject(TrackerService);
  private authService     = inject(AuthService);

  public cargando         = signal(true);
  public cantidadClientes = signal(0);
  public resumen          = signal<any>(null);
  public todosProyectos   = signal<any[]>([]);

  // Filtros
  public filtroDivision   = signal('todas');
  public filtroEstado     = signal('todos');

  // ── Getters de rol ──────────────────────────────────────────────
  get esGerente(): boolean {
    return this.authService.hasPermission('proyectos.editar');
  }

  get usuarioActual() {
    return this.authService.usuarioActual();
  }

  // ── Proyectos filtrados según rol y filtros ─────────────────────
  public proyectosFiltrados = computed(() => {
    let lista = this.todosProyectos();

    // Vista por rol: coordinador solo ve sus proyectos
    if (!this.esGerente) {
      const uid = this.usuarioActual?.id;
      lista = lista.filter(p => p.responsable?.id === uid);
    }

    if (this.filtroDivision() !== 'todas')
      lista = lista.filter(p => p.lineaNegocio === this.filtroDivision());

    if (this.filtroEstado() !== 'todos')
      lista = lista.filter(p => p.estado === this.filtroEstado());

    return lista;
  });

  // ── KPIs calculados ────────────────────────────────────────────
  public kpiActivos = computed(() =>
    this.proyectosFiltrados().filter(p =>
      !['FINALIZADO_TOTAL','Cancelado','Incumplimiento'].includes(p.estado)
    ).length
  );

  public kpiFacturado = computed(() =>
    this.proyectosFiltrados().reduce((s, p) => s + (p.valorFacturado || 0), 0)
  );

  public kpiPresupuestado = computed(() =>
    this.proyectosFiltrados().reduce((s, p) => s + (p.valorOC || 0), 0)
  );

  public kpiGasto = computed(() =>
    this.proyectosFiltrados().reduce((s, p) => s + (p.valorGasto || 0), 0)
  );

  public kpiUtilidad = computed(() =>
    this.kpiFacturado() - this.kpiGasto()
  );

  public kpiMargen = computed(() => {
    const f = this.kpiFacturado();
    return f > 0 ? ((this.kpiUtilidad() / f) * 100).toFixed(1) : '0.0';
  });

  // ── Gráfica 1: Estado del portafolio (Doughnut) ────────────────
  public estadosChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const ps = this.proyectosFiltrados();
    const pendiente       = ps.filter(p => p.estado === 'PENDIENTE').length;
    const preliminares    = ps.filter(p => p.estado === 'PENDIENTE_PRELIMINARES').length;
    const enEjecucion     = ps.filter(p => p.estado === 'EN_EJECUCIÓN').length;
    const parcial         = ps.filter(p => p.estado === 'FINALIZADO_PARCIAL').length;
    const total           = ps.filter(p => p.estado === 'FINALIZADO_TOTAL').length;
    const cancelado       = ps.filter(p => ['Cancelado','Incumplimiento'].includes(p.estado)).length;

    return {
      labels: ['Pendiente','Preliminares','En Ejecución','Fin. Parcial','Finalizado','Cancelado'],
      datasets: [{
        data: [pendiente, preliminares, enEjecucion, parcial, total, cancelado],
        backgroundColor: ['#ffb31c','#f97316','#1e3a8a','#8b5cf6','#10b981','#ef4444'],
        borderWidth: 0
      }]
    };
  });

  public estadosOptions: ChartOptions<'doughnut'> = {
    responsive: true, maintainAspectRatio: false, cutout: '68%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 10 } } }
    }
  };

  // ── Gráfica 2: Proyectos por División (Barras horizontales) ─────
  public divisionChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const ps = this.proyectosFiltrados();
    const divs = ['civiles','energia','telecomunicaciones'];
    const labels = ['Construcción','Energía','O&M'];
    const activos     = divs.map(d => ps.filter(p => p.lineaNegocio === d && !['FINALIZADO_TOTAL','Cancelado'].includes(p.estado)).length);
    const finalizados = divs.map(d => ps.filter(p => p.lineaNegocio === d && p.estado === 'FINALIZADO_TOTAL').length);

    return {
      labels,
      datasets: [
        { label: 'Activos',     data: activos,     backgroundColor: '#1e3a8a', borderRadius: 4 },
        { label: 'Finalizados', data: finalizados, backgroundColor: '#10b981', borderRadius: 4 }
      ]
    };
  });

  public divisionOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } } },
    scales: { x: { ticks: { stepSize: 1 } } }
  };

  // ── Gráfica 3: Top proyectos — Facturado vs Presupuestado ──────
  public facturacionChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const ps = [...this.proyectosFiltrados()]
      .filter(p => p.valorOC > 0)
      .sort((a, b) => b.valorOC - a.valorOC)
      .slice(0, 6);

    return {
      labels: ps.map(p => p.codigo || p.nombre.substring(0, 10)),
      datasets: [
        { label: 'Presupuestado', data: ps.map(p => p.valorOC || 0),        backgroundColor: '#d1d5db', borderRadius: 4 },
        { label: 'Facturado',     data: ps.map(p => p.valorFacturado || 0),  backgroundColor: '#1e3a8a', borderRadius: 4 },
        { label: 'Gasto',         data: ps.map(p => p.valorGasto || 0),      backgroundColor: '#ffb31c', borderRadius: 4 }
      ]
    };
  });

  public facturacionOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } } },
    scales: { y: { ticks: { callback: (v: any) => '$' + (v/1000000).toFixed(1) + 'M' } } }
  };

  // ── Tabla ───────────────────────────────────────────────────────
  public tablaProyectos = computed(() =>
    [...this.proyectosFiltrados()]
      .sort((a, b) => new Date(b.fechaAsignacion).getTime() - new Date(a.fechaAsignacion).getTime())
  );

  // ── División display ────────────────────────────────────────────
  divisionLabel(linea: string): string {
    return { civiles: 'Construcción', energia: 'Energía', telecomunicaciones: 'O&M' }[linea] || linea;
  }

  estadoClass(estado: string): string {
    const map: Record<string, string> = {
      'PENDIENTE': 'bg-amber-50 text-amber-700',
      'PENDIENTE_PRELIMINARES': 'bg-orange-50 text-orange-700',
      'EN_EJECUCIÓN': 'bg-blue-50 text-blue-700',
      'FINALIZADO_PARCIAL': 'bg-purple-50 text-purple-700',
      'FINALIZADO_TOTAL': 'bg-emerald-50 text-emerald-700',
      'Cancelado': 'bg-red-50 text-red-600',
      'Incumplimiento': 'bg-red-50 text-red-600',
    };
    return map[estado] || 'bg-slate-50 text-slate-600';
  }

  // ── Carga ───────────────────────────────────────────────────────
  ngOnInit() {
    this.clienteService.getClientes().subscribe(cs =>
      this.cantidadClientes.set(cs.filter((c: any) => c.estado === 'ACTIVO').length)
    );

    this.trackerService.getTodosLosProyectosDashboard().subscribe({
      next: data => { this.todosProyectos.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false)
    });
  }
}
