import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { skip, filter } from 'rxjs/operators';
import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexDataLabels, ApexPlotOptions, ApexFill, ApexLegend,
  ApexTooltip, ApexGrid, ApexNonAxisChartSeries, ApexResponsive
} from 'ng-apexcharts';
import { TareaService, CumplimientoPersonaDto, CumplimientoMensualDto, CumplimientoPersonaMesDto, TareaPersonaResumenDto, TareaDetalleReporteDto, TareaComentario } from '../../../core/services/tarea';
import { AuthService } from '../../../core/auth/auth.service';

// ─── Tipos de opciones de gráficos ───────────────────────────────────────────
export type ChartBarOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  fill: ApexFill;
  legend: ApexLegend;
  tooltip: ApexTooltip;
  grid: ApexGrid;
  colors: string[];
};

export type ChartLineOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  dataLabels: ApexDataLabels;
  fill: ApexFill;
  legend: ApexLegend;
  tooltip: ApexTooltip;
  grid: ApexGrid;
  colors: string[];
  stroke: any;
  markers: any;
};

export type ChartDonutOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  colors: string[];
  legend: ApexLegend;
  tooltip: ApexTooltip;
  responsive: ApexResponsive[];
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay();
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function primerDiaMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function ultimoDiaMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}

@Component({
  selector: 'app-tareas-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgApexchartsModule],
  templateUrl: './tareas-reportes.html'
})
export class TareasReportesComponent implements OnInit {
  private tareaService = inject(TareaService);
  public  authService  = inject(AuthService);
  private destroyRef   = inject(DestroyRef);

  // ── Tab activo ────────────────────────────────────────────
  public tab = signal<'personas' | 'mensual' | 'detalle'>('personas');

  // ── Filtros (tab personas) ────────────────────────────────
  public filtroDesde  = signal<string>(formatDate(primerDiaMes(new Date())));
  public filtroHasta  = signal<string>(formatDate(ultimoDiaMes(new Date())));
  public periodo      = signal<'semana' | 'semana_ant' | 'mes' | 'personalizado'>('mes');

  // ── Filtros (tab mensual) ─────────────────────────────────
  public anioSeleccionado = signal<number>(new Date().getFullYear());
  public aniosDisponibles = computed(() => {
    const anioActual = new Date().getFullYear();
    return [anioActual - 2, anioActual - 1, anioActual];
  });

  // ── Datos ─────────────────────────────────────────────────
  public data         = signal<CumplimientoPersonaDto[]>([]);
  public cargando     = signal<boolean>(false);
  public personaSel   = signal<CumplimientoPersonaDto | null>(null);

  // ── Datos detalle (tabla completa) ───────────────────────
  public dataDetalle       = signal<TareaDetalleReporteDto[]>([]);
  public cargandoDetalle   = signal<boolean>(false);
  public busquedaDetalle   = signal<string>('');
  public ordenDetalleCol   = signal<string>('semana');
  public ordenDetalleDir   = signal<'asc' | 'desc'>('asc');

  public tareasDetalleFiltradas = computed(() => {
    const data = this.dataDetalle();
    const busq = this.busquedaDetalle().toLowerCase().trim();
    const col  = this.ordenDetalleCol();
    const dir  = this.ordenDetalleDir();

    const filtered = busq
      ? data.filter(t =>
          t.titulo.toLowerCase().includes(busq) ||
          (t.descripcion ?? '').toLowerCase().includes(busq) ||
          t.responsables.some(r => r.toLowerCase().includes(busq)) ||
          t.estadoNombre.toLowerCase().includes(busq)
        )
      : data;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'semana':       cmp = a.semanaProgramada.localeCompare(b.semanaProgramada); break;
        case 'titulo':       cmp = a.titulo.localeCompare(b.titulo); break;
        case 'estado':       cmp = a.estadoNombre.localeCompare(b.estadoNombre); break;
        case 'responsable':  cmp = (a.responsables[0] ?? '').localeCompare(b.responsables[0] ?? ''); break;
        case 'fechaFin':     cmp = (a.fechaPresupuestoFin ?? '').localeCompare(b.fechaPresupuestoFin ?? ''); break;
        case 'fechaReal':    cmp = (a.fechaRealFinalizacion ?? '').localeCompare(b.fechaRealFinalizacion ?? ''); break;
        case 'diasVsP':      cmp = (a.diasVsPresupuesto ?? 999) - (b.diasVsPresupuesto ?? 999); break;
        case 'movida':       cmp = a.vecesMovida - b.vecesMovida; break;
        case 'comentarios':  cmp = a.comentariosCount - b.comentariosCount; break;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  // ── Datos mensuales ───────────────────────────────────────
  public dataMensual      = signal<CumplimientoMensualDto[]>([]);
  public cargandoMensual  = signal<boolean>(false);
  public personasMensuales = computed(() => {
    const meses = this.dataMensual();
    if (!meses.length) return [];
    // Obtener todas las personas únicas que aparecen en algún mes
    const personasMap = new Map<string, string>();
    meses.forEach(m => m.personas.forEach(p => personasMap.set(p.usuarioId, p.nombre)));
    return Array.from(personasMap.entries()).map(([id, nombre]) => ({ id, nombre }));
  });

  // ── KPIs del año (tab mensual) — calculados en TS para evitar arrow functions en template
  public kpisMensuales = computed(() => {
    const meses          = this.dataMensual();
    const conTareas      = meses.filter(m => m.total > 0);
    const totalTareas    = meses.reduce((s, m) => s + m.total, 0);
    const totalComp      = meses.reduce((s, m) => s + m.completadas, 0);
    const totalATiempo   = meses.reduce((s, m) => s + m.completadasATiempo, 0);
    const totalTarde     = meses.reduce((s, m) => s + m.completadasTarde, 0);
    const totalVencidas  = meses.reduce((s, m) => s + m.vencidas, 0);

    const pctCumplimiento = totalTareas > 0 ? (totalComp / totalTareas * 100).toFixed(1) + '%' : '0%';
    const pctATiempo      = totalTareas > 0 ? (totalATiempo / totalTareas * 100).toFixed(1) + '%' : '0%';
    const pctTarde        = totalTareas > 0 ? (totalTarde / totalTareas * 100).toFixed(1) + '%' : '0%';

    return [
      { label: 'Total tareas',         valor: totalTareas,      color: 'text-blue-600',   bg: 'bg-blue-50',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
      { label: 'Completadas a tiempo', valor: `${totalATiempo} (${pctATiempo})`,  color: 'text-green-600',  bg: 'bg-green-50',  icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
      { label: 'Completadas con retraso', valor: `${totalTarde} (${pctTarde})`, color: 'text-orange-500', bg: 'bg-orange-50', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      { label: 'Vencidas',             valor: totalVencidas,    color: 'text-red-600',    bg: 'bg-red-50',    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
      { label: '% Cumplimiento año',   valor: pctCumplimiento,  color: 'text-purple-600', bg: 'bg-purple-50', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    ];
  });

  // ── Flag: año sin ninguna tarea (para el estado vacío) ──
  public sinDatosMensual = computed(() => {
    const meses = this.dataMensual();
    return meses.length > 0 && meses.every(m => m.total === 0);
  });

  // ── KPIs consolidados (tab personas) ─────────────────────
  public resumen = computed(() => {
    const d = this.data();
    // Totales — se acumulan por persona (si una tarea tiene 2 asignados, suma en ambos)
    const total              = d.reduce((s, p) => s + p.total, 0);
    const completadas        = d.reduce((s, p) => s + p.completadas, 0);
    const completadasATiempo = d.reduce((s, p) => s + p.completadasATiempo, 0);
    const completadasTarde   = d.reduce((s, p) => s + p.completadasTarde, 0);
    const vencidas           = d.reduce((s, p) => s + p.vencidas, 0);
    const movidas            = d.reduce((s, p) => s + p.movidas, 0);
    return {
      total, completadas, completadasATiempo, completadasTarde, vencidas, movidas,
      porcentaje:        total > 0 ? Math.round(completadas        / total * 100) : 0,
      porcentajeATiempo: total > 0 ? Math.round(completadasATiempo / total * 100) : 0,
      porcentajeTarde:   total > 0 ? Math.round(completadasTarde   / total * 100) : 0,
      personas: d.length,
    };
  });

  // ── Gráfico 1: % cumplimiento por persona (barras horizontales) ───────────
  public chartCumplimiento = computed<ChartBarOptions>(() => {
    const d = [...this.data()].sort((a, b) => b.porcentajeCumplimiento - a.porcentajeCumplimiento);
    return {
      series: [{
        name: '% Cumplimiento',
        data: d.map(p => Math.round(p.porcentajeCumplimiento))
      }],
      chart: { type: 'bar', height: Math.max(200, d.length * 52 + 60), toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { horizontal: true, borderRadius: 6, dataLabels: { position: 'right' } } },
      dataLabels: { enabled: true, formatter: (val: number) => `${val}%`, offsetX: 8, style: { fontSize: '12px', fontWeight: 600, colors: ['#374151'] } },
      xaxis: { categories: d.map(p => p.nombre.split(' ').slice(0, 2).join(' ')), max: 100, labels: { formatter: (val: string) => `${val}%` } },
      yaxis: { labels: { style: { fontSize: '12px', fontWeight: 500 } } },
      fill: { colors: d.map(p => p.porcentajeCumplimiento >= 80 ? '#16a34a' : p.porcentajeCumplimiento >= 50 ? '#f59e0b' : '#ef4444') },
      colors: ['#1e3a8a'],
      legend: { show: false },
      tooltip: { y: { formatter: (val: number) => `${val}%` } },
      grid: { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } }
    };
  });

  // ── Gráfico 2: Distribución apilada por persona ───────────────────────────
  public chartDistribucion = computed<ChartBarOptions>(() => {
    const d = [...this.data()].sort((a, b) => b.porcentajeCumplimiento - a.porcentajeCumplimiento);
    return {
      series: [
        { name: 'Completadas', data: d.map(p => p.completadas) },
        { name: 'Pendientes',  data: d.map(p => p.pendientes - p.vencidas) },
        { name: 'Vencidas',    data: d.map(p => p.vencidas) },
      ],
      chart: { type: 'bar', height: Math.max(200, d.length * 52 + 60), stacked: true, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      dataLabels: { enabled: false },
      xaxis: { categories: d.map(p => p.nombre.split(' ').slice(0, 2).join(' ')), labels: { formatter: (val: string) => `${val}` } },
      yaxis: { labels: { style: { fontSize: '12px', fontWeight: 500 } } },
      fill: { opacity: 1 },
      colors: ['#16a34a', '#93c5fd', '#ef4444'],
      legend: { position: 'top', horizontalAlign: 'left', fontSize: '13px' },
      tooltip: { shared: true, intersect: false },
      grid: { xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } }
    };
  });

  // ── Gráfico donut para persona seleccionada (a tiempo / con retraso / pendientes / vencidas) ──
  public chartDonut = computed<ChartDonutOptions | null>(() => {
    const p = this.personaSel();
    if (!p) return null;
    const pendientesLimpias = Math.max(0, p.pendientes - p.vencidas);
    return {
      series: [p.completadasATiempo, p.completadasTarde, pendientesLimpias, p.vencidas],
      chart: { type: 'donut', height: 280, fontFamily: 'inherit' },
      labels: ['A tiempo', 'Con retraso', 'Pendientes', 'Vencidas'],
      colors: ['#16a34a', '#f59e0b', '#93c5fd', '#ef4444'],
      legend: { position: 'bottom', fontSize: '12px' },
      tooltip: { y: { formatter: (val: number) => `${val} tareas` } },
      responsive: [{ breakpoint: 480, options: { chart: { height: 220 }, legend: { show: false } } }],
      plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Total', formatter: () => `${p.total}` } } } } },
      dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val)}%` }
    };
  });

  // ── Modo de vista del gráfico de líneas: consolidado | aTiempo | tarde | personas ──
  public modoLinea = signal<'consolidado' | 'desglose' | 'personas'>('desglose');

  // ── Gráfico de líneas: % cumplimiento mes a mes (3 modos) ──
  public chartLinea = computed<ChartLineOptions>(() => {
    const meses    = this.dataMensual();
    const personas = this.personasMensuales();
    const labels   = meses.map(m => m.nombreMes.substring(0, 3));
    const modo     = this.modoLinea();

    let series: { name: string; data: (number | null)[] }[];

    if (modo === 'consolidado') {
      // Solo el % general de cumplimiento consolidado
      series = [{
        name: '% Cumplimiento',
        data: meses.map(m => m.total > 0 ? Math.round(m.porcentajeCumplimiento) : null)
      }];
    } else if (modo === 'desglose') {
      // 3 series: total cumplido, a tiempo y con retraso
      series = [
        {
          name: '% Cumplimiento total',
          data: meses.map(m => m.total > 0 ? Math.round(m.porcentajeCumplimiento) : null)
        },
        {
          name: '% A tiempo',
          data: meses.map(m => m.total > 0 ? Math.round(m.porcentajeATiempo) : null)
        },
        {
          name: '% Con retraso',
          data: meses.map(m => m.total > 0 ? Math.round(m.porcentajeTarde) : null)
        },
      ];
    } else {
      // Una serie de % cumplimiento por persona
      series = personas.map(p => ({
        name: p.nombre.split(' ').slice(0, 2).join(' '),
        data: meses.map(m => {
          const per = m.personas.find(x => x.usuarioId === p.id);
          return per && per.total > 0 ? Math.round(per.porcentajeCumplimiento) : null;
        })
      }));
    }

    const nSeries = series.length;
    return {
      series,
      chart: { type: 'line', height: 380, toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: true } },
      xaxis: { categories: labels },
      yaxis: { min: 0, max: 100, labels: { formatter: (v: number) => `${v}%` } },
      dataLabels: { enabled: false },
      fill: { type: 'solid', opacity: 1 },
      stroke: {
        curve: 'smooth',
        width: modo === 'desglose' ? [3, 2, 2] : Array(nSeries).fill(2),
        dashArray: modo === 'desglose' ? [0, 4, 4] : Array(nSeries).fill(0)
      },
      markers: { size: 5, hover: { size: 7 } },
      legend: { position: 'top', horizontalAlign: 'left', fontSize: '12px' },
      tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => v != null ? `${v}%` : 'Sin datos' } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      colors: modo === 'desglose'
        ? ['#1e3a8a', '#16a34a', '#f59e0b']
        : ['#1e3a8a', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']
    };
  });

  // ── Gráfico de barras: tareas a tiempo / con retraso / vencidas por mes ──
  public chartBarrasMensual = computed<ChartBarOptions>(() => {
    const meses = this.dataMensual();
    return {
      series: [
        { name: 'A tiempo',      data: meses.map(m => m.completadasATiempo) },
        { name: 'Con retraso',   data: meses.map(m => m.completadasTarde) },
        { name: 'Vencidas',      data: meses.map(m => m.vencidas) },
      ],
      chart: { type: 'bar', height: 260, stacked: true, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      xaxis: { categories: meses.map(m => m.nombreMes.substring(0, 3)) },
      yaxis: { labels: { formatter: (v: number) => `${v}` } },
      fill: { opacity: 1 },
      colors: ['#16a34a', '#f59e0b', '#ef4444'],
      legend: { position: 'top', horizontalAlign: 'left', fontSize: '12px' },
      tooltip: { shared: true, intersect: false },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 }
    };
  });

  // ── Persona seleccionada en la vista mensual ─────────────
  public personaMensualSel = signal<{ id: string; nombre: string } | null>(null);

  seleccionarPersonaMensual(p: { id: string; nombre: string }): void {
    this.personaMensualSel.set(
      this.personaMensualSel()?.id === p.id ? null : p
    );
  }

  // Totales anuales de una persona seleccionada para el banner de KPIs
  public kpisPersonaMensual = computed(() => {
    const p = this.personaMensualSel();
    if (!p) return null;
    const meses = this.dataMensual()
      .map(m => this.personaEnMes(m, p.id))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const total      = meses.reduce((s, m) => s + m.total, 0);
    const completadas = meses.reduce((s, m) => s + m.completadas, 0);
    const aTiempo    = meses.reduce((s, m) => s + m.completadasATiempo, 0);
    const tarde      = meses.reduce((s, m) => s + m.completadasTarde, 0);
    const vencidas   = meses.reduce((s, m) => s + m.vencidas, 0);
    return {
      total, completadas, aTiempo, tarde, vencidas,
      pctCumplimiento: total > 0 ? (completadas / total * 100).toFixed(1) : '0',
      pctATiempo:      total > 0 ? (aTiempo     / total * 100).toFixed(1) : '0',
      pctTarde:        total > 0 ? (tarde        / total * 100).toFixed(1) : '0',
    };
  });

  // ── Lifecycle ─────────────────────────────────────────────

  constructor() {
    // Reacciona a cualquier mutación de tareas (kanban u otra ruta)
    // skip(1) evita el disparo inicial del signal en valor 0
    toObservable(this.tareaService.ultimoCambio)
      .pipe(
        skip(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const t = this.tab();
        if (t === 'personas' && this.data().length > 0)       this.cargar();
        if (t === 'mensual'  && this.dataMensual().length > 0) this.cargarMensual();
        if (t === 'detalle'  && this.dataDetalle().length > 0) this.cargarDetalle();
      });

    // Red de seguridad: refresca cada 2 minutos si la pestaña del navegador está visible
    interval(120_000)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(() => !document.hidden)
      )
      .subscribe(() => {
        const t = this.tab();
        if (t === 'personas') this.cargar();
        if (t === 'mensual')  this.cargarMensual();
        if (t === 'detalle')  this.cargarDetalle();
      });
  }

  ngOnInit(): void {
    this.cargar();
  }

  // ── Cambiar tab ───────────────────────────────────────────
  cambiarTab(t: 'personas' | 'mensual' | 'detalle'): void {
    this.tab.set(t);
    if (t === 'mensual' && this.dataMensual().length === 0) {
      this.cargarMensual();
    } else if (t === 'detalle' && this.dataDetalle().length === 0) {
      this.cargarDetalle();
    }
  }

  // ── Carga mensual ─────────────────────────────────────────
  cargarMensual(): void {
    this.cargandoMensual.set(true);
    this.tareaService.getCumplimientoMensual(this.anioSeleccionado()).subscribe({
      next: d => { this.dataMensual.set(d); this.cargandoMensual.set(false); },
      error: ()  => { this.cargandoMensual.set(false); }
    });
  }

  cambiarAnio(anio: number): void {
    this.anioSeleccionado.set(anio);
    this.cargarMensual();
  }

  // ── Carga (tab personas) ──────────────────────────────────
  cargar(): void {
    this.cargando.set(true);
    this.personaSel.set(null);
    const desde = new Date(this.filtroDesde() + 'T00:00:00.000Z');
    const hasta  = new Date(this.filtroHasta() + 'T00:00:00.000Z');
    this.tareaService.getCumplimientoPersonas(desde, hasta).subscribe({
      next: d => { this.data.set(d); this.cargando.set(false); },
      error: ()  => { this.cargando.set(false); }
    });
  }

  // ── Períodos rápidos ──────────────────────────────────────
  setPeriodo(p: 'semana' | 'semana_ant' | 'mes' | 'personalizado'): void {
    this.periodo.set(p);
    const hoy = new Date();
    if (p === 'semana') {
      const lun = lunesDe(hoy);
      this.filtroDesde.set(formatDate(lun));
      this.filtroHasta.set(formatDate(addWeeks(lun, 1)));
    } else if (p === 'semana_ant') {
      const lun = addWeeks(lunesDe(hoy), -1);
      this.filtroDesde.set(formatDate(lun));
      this.filtroHasta.set(formatDate(addWeeks(lun, 1)));
    } else if (p === 'mes') {
      this.filtroDesde.set(formatDate(primerDiaMes(hoy)));
      this.filtroHasta.set(formatDate(ultimoDiaMes(hoy)));
    }
    if (p !== 'personalizado') this.cargar();
  }

  // ── Modal comentarios ─────────────────────────────────────
  public comentariosModal        = signal<TareaComentario[]>([]);
  public tareaComentariosAbierta = signal<TareaDetalleReporteDto | null>(null);
  public cargandoComentarios     = signal<boolean>(false);

  abrirComentarios(t: TareaDetalleReporteDto, event: Event): void {
    event.stopPropagation();
    this.tareaComentariosAbierta.set(t);
    this.comentariosModal.set([]);
    this.cargandoComentarios.set(true);
    this.tareaService.getTarea(t.id).subscribe({
      next: tarea => {
        const comentarios = tarea?.comentarios ?? [];
        // ordenar más reciente primero
        this.comentariosModal.set(
          [...comentarios].sort((a, b) =>
            new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime()
          )
        );
        this.cargandoComentarios.set(false);
      },
      error: () => { this.cargandoComentarios.set(false); }
    });
  }

  cerrarComentarios(): void {
    this.tareaComentariosAbierta.set(null);
    this.comentariosModal.set([]);
  }

  // ── Carga detalle ─────────────────────────────────────────
  cargarDetalle(): void {
    this.cargandoDetalle.set(true);
    const desde = new Date(this.filtroDesde() + 'T00:00:00.000Z');
    const hasta  = new Date(this.filtroHasta() + 'T00:00:00.000Z');
    this.tareaService.getTareasDetalle(desde, hasta).subscribe({
      next: d => { this.dataDetalle.set(d); this.cargandoDetalle.set(false); },
      error: ()  => { this.cargandoDetalle.set(false); }
    });
  }

  ordenarDetalle(col: string): void {
    if (this.ordenDetalleCol() === col) {
      this.ordenDetalleDir.set(this.ordenDetalleDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.ordenDetalleCol.set(col);
      this.ordenDetalleDir.set('asc');
    }
  }

  // ── Selección de persona ──────────────────────────────────
  seleccionarPersona(p: CumplimientoPersonaDto): void {
    this.personaSel.set(this.personaSel()?.usuarioId === p.usuarioId ? null : p);
  }

  // ── Helpers UI ────────────────────────────────────────────
  iniciales(nombre: string): string {
    return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  colorPorcentaje(pct: number): string {
    if (pct >= 80) return 'text-green-600';
    if (pct >= 50) return 'text-yellow-600';
    return 'text-red-600';
  }

  bgPorcentaje(pct: number): string {
    if (pct >= 80) return 'bg-green-50 border-green-200';
    if (pct >= 50) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  }

  barColor(pct: number): string {
    if (pct >= 80) return '#16a34a';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  }

  /** Color para el badge de % a tiempo (siempre en escala verde) */
  colorATiempo(pct: number): string {
    if (pct >= 70) return 'text-green-700 bg-green-100';
    if (pct >= 40) return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  }

  /** Color para el badge de % con retraso (escala invertida: menos es mejor) */
  colorTarde(pct: number): string {
    if (pct <= 10) return 'text-green-700 bg-green-100';
    if (pct <= 30) return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  }

  /** Cambiar modo del gráfico de líneas desde el template */
  setModoLinea(modo: 'consolidado' | 'desglose' | 'personas'): void {
    this.modoLinea.set(modo);
  }

  /** Resumen de persona del mes para la tabla mensual */
  personaEnMes(mes: CumplimientoMensualDto, usuarioId: string): CumplimientoPersonaMesDto | null {
    return mes.personas.find(p => p.usuarioId === usuarioId) ?? null;
  }

  // ── Exportar CSV ──────────────────────────────────────────
  exportarCSV(): void {
    const d = this.data();
    let csv = '﻿';
    csv += `Reporte de Cumplimiento por Persona\n`;
    csv += `Período;${this.filtroDesde()} al ${this.filtroHasta()}\n\n`;
    csv += `Persona;Total;Completadas;A tiempo;Con retraso;Pendientes;Vencidas;Movidas;% Cumplimiento;% A tiempo;% Con retraso\n`;
    d.forEach(p => {
      csv += `"${p.nombre}";${p.total};${p.completadas};${p.completadasATiempo};${p.completadasTarde};${p.pendientes};${p.vencidas};${p.movidas};${p.porcentajeCumplimiento}%;${p.porcentajeATiempo}%;${p.porcentajeTarde}%\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `cumplimiento-${this.filtroDesde()}-${this.filtroHasta()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  tareasDePersona(p: CumplimientoPersonaDto): TareaPersonaResumenDto[] {
    return p.tareas;
  }

  exportarCSVDetalle(): void {
    const d = this.tareasDetalleFiltradas();
    let csv = '﻿';
    csv += `Detalle de Tareas\n`;
    csv += `Período;${this.filtroDesde()} al ${this.filtroHasta()}\n\n`;
    csv += `Semana;Título;Descripción;Responsables;Estado;F.Presup.Inicio;F.Presup.Fin;F.Real Fin;Vs.Presupuesto (días);Veces movida;Comentarios\n`;
    d.forEach(t => {
      const diasStr = t.diasVsPresupuesto != null
        ? (t.diasVsPresupuesto > 0 ? `+${t.diasVsPresupuesto}` : `${t.diasVsPresupuesto}`)
        : '';
      csv += [
        t.semanaProgramada.substring(0, 10),
        `"${t.titulo.replace(/"/g, '""')}"`,
        `"${(t.descripcion ?? '').replace(/"/g, '""')}"`,
        `"${t.responsables.join(', ')}"`,
        t.estadoNombre,
        t.fechaPresupuestoInicio?.substring(0, 10) ?? '',
        t.fechaPresupuestoFin?.substring(0, 10) ?? '',
        t.fechaRealFinalizacion?.substring(0, 10) ?? '',
        diasStr,
        t.vecesMovida,
        t.comentariosCount
      ].join(';') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `tareas-detalle-${this.filtroDesde()}-${this.filtroHasta()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
