import { Component, inject, OnInit, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe, CommonModule } from '@angular/common';
import { NgApexchartsModule,
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexDataLabels, ApexPlotOptions,
  ApexLegend, ApexTooltip, ApexGrid, ApexStroke, ApexFill, ApexMarkers } from 'ng-apexcharts';
import { ClienteService } from '../../core/services/cliente';
import { TrackerService } from '../../core/services/tracker';
import { AuthService } from '../../core/auth/auth.service';

type CampoOrden = 'codigo' | 'cliente' | 'valorOC' | 'valorFacturado' | 'valorGasto' | 'margen' | 'fechaAsignacion';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgApexchartsModule, CurrencyPipe, CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
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
    // Punto 8 (semana 39, revisión final): 'proyectos.editar' NO debe otorgar
    // visibilidad de proyectos ajenos -- ese permiso solo habilita EDITAR datos.
    // La visibilidad total (ver todos los proyectos, no solo los propios) depende
    // exclusivamente de 'proyectos.gerente'. Antes este getter incluía
    // 'proyectos.editar' como alternativa, lo que hacía que cualquier usuario con
    // permiso de edición viera los proyectos de sus compañeros indebidamente.
    return this.authService.hasPermission('proyectos.gerente');
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

  public kpiCostoOTs = computed(() =>
    this.proyectosFiltrados().reduce((s, p) => s + (p.costoRealTotal || 0), 0)
  );

  // Punto 13 (semana 38/39): antes esta utilidad era Facturado - Gasto, sin
  // descontar los Costos de OTs, por eso no coincidía con la utilidad correcta
  // que se ve dentro de cada proyecto (Control PO). Usamos el campo `utilidad`
  // que ya trae cada proyecto desde el backend (Facturado - Gasto - CostoOTs),
  // sumado por proyecto, para que ambas vistas siempre coincidan.
  public kpiUtilidad = computed(() =>
    this.proyectosFiltrados().reduce((s, p) => s + (p.utilidad ?? (p.valorFacturado || 0) - (p.valorGasto || 0) - (p.costoRealTotal || 0)), 0)
  );

  public kpiMargen = computed(() => {
    const f = this.kpiFacturado();
    return f > 0 ? ((this.kpiUtilidad() / f) * 100).toFixed(1) : '0.0';
  });

  // ── Formatos ────────────────────────────────────────────────────
  private static pesos(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);
  }
  private static millones(v: number): string {
    const m = (v || 0) / 1_000_000;
    return '$' + (Math.abs(m) >= 100 ? m.toFixed(0) : m.toFixed(1)) + ' M';
  }
  private static readonly FUENTE = 'Inter, ui-sans-serif, system-ui, sans-serif';

  // ── Gráfica 1: Estado del portafolio (dona con total al centro) ─
  public chartEstados = computed(() => {
    const ps = this.proyectosFiltrados();
    const cuenta = (...e: string[]) => ps.filter(p => e.includes(p.estado)).length;
    const series = [
      cuenta('PENDIENTE'), cuenta('PENDIENTE_PRELIMINARES'), cuenta('EN_EJECUCIÓN'),
      cuenta('FINALIZADO_PARCIAL'), cuenta('FINALIZADO_TOTAL'), cuenta('Cancelado', 'Incumplimiento')
    ];
    return {
      series,
      chart: { type: 'donut', height: 270, fontFamily: DashboardComponent.FUENTE, animations: { speed: 400 } } as ApexChart,
      labels: ['Pendiente', 'Preliminares', 'En ejecución', 'Fin. parcial', 'Finalizado', 'Cancelado'],
      colors: ['#ffb31c', '#f97316', '#1e3a8a', '#8b5cf6', '#10b981', '#ef4444'],
      legend: { position: 'bottom', fontSize: '11px', itemMargin: { horizontal: 6, vertical: 2 }, markers: { size: 5 } } as ApexLegend,
      dataLabels: { enabled: false } as ApexDataLabels,
      stroke: { width: 2, colors: ['#ffffff'] } as ApexStroke,
      plotOptions: {
        pie: { donut: { size: '68%', labels: {
          show: true,
          value: { fontSize: '26px', fontWeight: 800, color: '#0f172a', offsetY: 4 },
          total: { show: true, label: 'Proyectos', fontSize: '11px', color: '#64748b',
                   formatter: (w: any) => String(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)) }
        } } }
      } as ApexPlotOptions,
      tooltip: { y: { formatter: (v: number) => `${v} proyecto(s)` } } as ApexTooltip
    };
  });

  // ── Gráfica 2: Proyectos por división (barras horizontales apiladas) ─
  public chartDivision = computed(() => {
    const ps = this.proyectosFiltrados();
    const divs = ['civiles', 'energia', 'telecomunicaciones'];
    const activos     = divs.map(d => ps.filter(p => p.lineaNegocio === d && !['FINALIZADO_TOTAL', 'Cancelado', 'Incumplimiento'].includes(p.estado)).length);
    const finalizados = divs.map(d => ps.filter(p => p.lineaNegocio === d && p.estado === 'FINALIZADO_TOTAL').length);
    return {
      series: [{ name: 'Activos', data: activos }, { name: 'Finalizados', data: finalizados }] as ApexAxisChartSeries,
      chart: { type: 'bar', height: 270, stacked: true, toolbar: { show: false }, fontFamily: DashboardComponent.FUENTE, animations: { speed: 400 } } as ApexChart,
      plotOptions: { bar: { horizontal: true, barHeight: '55%', borderRadius: 5, borderRadiusApplication: 'end', borderRadiusWhenStacked: 'last' } } as ApexPlotOptions,
      colors: ['#1e3a8a', '#10b981'],
      fill: { opacity: 1 } as ApexFill,
      dataLabels: { enabled: true, style: { fontSize: '11px', fontWeight: 700 }, formatter: (v: number) => (v ? String(v) : '') } as ApexDataLabels,
      xaxis: { categories: ['Construcción', 'Energía', 'O&M'], labels: { formatter: (v: string) => (Number(v) % 1 === 0 ? v : '') } } as ApexXAxis,
      yaxis: { labels: { style: { fontSize: '12px', fontWeight: 600, colors: '#334155' } } } as ApexYAxis,
      legend: { position: 'bottom', fontSize: '11px', markers: { size: 5 } } as ApexLegend,
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 } as ApexGrid,
      tooltip: { y: { formatter: (v: number) => `${v} proyecto(s)` } } as ApexTooltip
    };
  });

  // ── Gráfica 3: Top proyectos — % del PO facturado y gastado ─────
  // En porcentaje: con montos, un proyecto grande aplasta a los demás y sus barras no se ven.
  public chartTop = computed(() => {
    const ps = [...this.proyectosFiltrados()]
      .filter(p => p.valorOC > 0)
      .sort((a, b) => b.valorOC - a.valorOC)
      .slice(0, 6);
    const pct = (v: number, po: number) => Math.round(((v || 0) / po) * 1000) / 10;
    return {
      series: [
        { name: 'Facturado', data: ps.map(p => pct(p.valorFacturado, p.valorOC)) },
        { name: 'Gasto',     data: ps.map(p => pct(p.valorGasto, p.valorOC)) }
      ] as ApexAxisChartSeries,
      chart: { type: 'bar', height: 270, toolbar: { show: false }, fontFamily: DashboardComponent.FUENTE, animations: { speed: 400 } } as ApexChart,
      plotOptions: { bar: { horizontal: true, barHeight: '70%', borderRadius: 3, borderRadiusApplication: 'end' } } as ApexPlotOptions,
      colors: ['#1e3a8a', '#ffb31c'],
      fill: { opacity: 1 } as ApexFill,
      dataLabels: { enabled: false } as ApexDataLabels,
      xaxis: {
        categories: ps.map(p => { const c = p.codigo || p.nombre; return c.length > 20 ? c.slice(0, 19) + '…' : c; }),
        min: 0,
        max: Math.max(100, ...ps.map(p => Math.max(pct(p.valorFacturado, p.valorOC), pct(p.valorGasto, p.valorOC)))),
        tickAmount: 4,
        labels: { formatter: (v: any) => Math.round(Number(v)) + '%', style: { fontSize: '10px' } }
      } as ApexXAxis,
      yaxis: { labels: { maxWidth: 170, style: { fontSize: '11px', fontWeight: 600, colors: '#334155' } } } as ApexYAxis,
      legend: { position: 'bottom', fontSize: '11px', markers: { size: 5 } } as ApexLegend,
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 } as ApexGrid,
      tooltip: {
        shared: false, intersect: true,
        custom: ({ dataPointIndex }: any) => {
          const p = ps[dataPointIndex];
          if (!p) return '';
          const fila = (color: string, nombre: string, v: number) =>
            `<div style="display:flex;justify-content:space-between;gap:16px"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:6px"></span>${nombre}</span><b>${DashboardComponent.pesos(v)} (${pct(v, p.valorOC)}%)</b></div>`;
          return `<div style="padding:8px 10px;font-size:11px;min-width:240px">
            <div style="font-weight:700;color:#0f172a;margin-bottom:2px">${p.codigo}</div>
            <div style="color:#64748b;margin-bottom:6px;white-space:normal;max-width:280px">${p.nombre}</div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:2px"><span>Valor PO</span><b>${DashboardComponent.pesos(p.valorOC)}</b></div>
            ${fila('#1e3a8a', 'Facturado', p.valorFacturado)}${fila('#ffb31c', 'Gasto', p.valorGasto)}</div>`;
        }
      } as ApexTooltip
    };
  });

  // ── Tabla: oculta por defecto, con filtros y orden por columna ───
  public tablaVisible   = signal(false);
  public busqueda       = signal('');
  public filtroCliente  = signal('todos');
  public filtroResponsable = signal('todos');
  public orden          = signal<{ campo: CampoOrden; asc: boolean }>({ campo: 'fechaAsignacion', asc: false });

  public clientesTabla = computed(() =>
    [...new Set(this.proyectosFiltrados().map(p => p.cliente?.razonSocial).filter(Boolean))].sort() as string[]);

  public responsablesTabla = computed(() => {
    const m = new Map<string, string>();
    this.proyectosFiltrados().forEach(p => { if (p.responsable?.id) m.set(p.responsable.id, p.responsable.nombre); });
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  public hayFiltrosTabla = computed(() =>
    !!this.busqueda().trim() || this.filtroCliente() !== 'todos' || this.filtroResponsable() !== 'todos');

  limpiarFiltrosTabla() {
    this.busqueda.set(''); this.filtroCliente.set('todos'); this.filtroResponsable.set('todos');
  }

  margen(p: any): number | null {
    return p.valorFacturado > 0 ? ((p.utilidad ?? 0) / p.valorFacturado) * 100 : null;
  }

  ordenarPor(campo: CampoOrden) {
    const o = this.orden();
    this.orden.set({ campo, asc: o.campo === campo ? !o.asc : (campo === 'codigo' || campo === 'cliente') });
  }

  /** Celular: el orden se elige en una lista (los encabezados de la tabla no se ven). */
  public readonly opcionesOrden: { valor: string; etiqueta: string }[] = [
    { valor: 'fechaAsignacion:desc', etiqueta: 'Más recientes primero' },
    { valor: 'fechaAsignacion:asc',  etiqueta: 'Más antiguos primero' },
    { valor: 'valorOC:desc',         etiqueta: 'Mayor valor PO' },
    { valor: 'valorFacturado:desc',  etiqueta: 'Más facturado' },
    { valor: 'valorGasto:desc',      etiqueta: 'Más gasto' },
    { valor: 'margen:asc',           etiqueta: 'Menor margen' },
    { valor: 'codigo:asc',           etiqueta: 'Código (A–Z)' },
    { valor: 'cliente:asc',          etiqueta: 'Cliente (A–Z)' }
  ];
  public valorOrdenActual = computed(() => `${this.orden().campo}:${this.orden().asc ? 'asc' : 'desc'}`);
  ordenarDesdeLista(valor: string) {
    const [campo, sentido] = valor.split(':');
    this.orden.set({ campo: campo as CampoOrden, asc: sentido === 'asc' });
  }

  ariaOrden(campo: CampoOrden): 'ascending' | 'descending' | 'none' {
    const o = this.orden();
    return o.campo !== campo ? 'none' : (o.asc ? 'ascending' : 'descending');
  }

  public tablaProyectos = computed(() => {
    const norm = (t: any) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const palabras = norm(this.busqueda()).split(/\s+/).filter(Boolean);
    let lista = this.proyectosFiltrados().filter(p => {
      if (this.filtroCliente() !== 'todos' && p.cliente?.razonSocial !== this.filtroCliente()) return false;
      if (this.filtroResponsable() !== 'todos' && p.responsable?.id !== this.filtroResponsable()) return false;
      if (!palabras.length) return true;
      const donde = norm(`${p.codigo} ${p.nombre} ${p.cliente?.razonSocial ?? ''} ${p.numeroOC ?? ''}`);
      return palabras.every(w => donde.includes(w));
    });

    const { campo, asc } = this.orden();
    const valor = (p: any): number | string => {
      switch (campo) {
        case 'codigo':          return norm(p.codigo);
        case 'cliente':         return norm(p.cliente?.razonSocial);
        case 'margen':          return this.margen(p) ?? -Infinity;
        case 'fechaAsignacion': return p.fechaAsignacion ? new Date(p.fechaAsignacion).getTime() : 0;
        default:                return p[campo] ?? 0;
      }
    };
    lista = [...lista].sort((a, b) => {
      const va = valor(a), vb = valor(b);
      const r = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return asc ? r : -r;
    });
    return lista;
  });

  // ── Paginación de la tabla (10 filas): filtros y orden aplican sobre todos los proyectos ─
  public readonly porPagina = 10;
  public pagina = signal(1);
  public totalPaginas = computed(() => Math.max(1, Math.ceil(this.tablaProyectos().length / this.porPagina)));
  public paginaActual = computed(() => Math.min(this.pagina(), this.totalPaginas()));
  public filasPagina = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.porPagina;
    return this.tablaProyectos().slice(inicio, inicio + this.porPagina);
  });
  /** Texto "11–20 de 57". */
  public rangoPagina = computed(() => {
    const total = this.tablaProyectos().length;
    if (!total) return '0 de 0';
    const desde = (this.paginaActual() - 1) * this.porPagina + 1;
    return `${desde}–${Math.min(desde + this.porPagina - 1, total)} de ${total}`;
  });

  // Al cambiar filtros u orden se vuelve a la primera página
  private reiniciarPagina = effect(() => {
    this.busqueda(); this.filtroCliente(); this.filtroResponsable(); this.orden();
    this.filtroDivision(); this.filtroEstado();
    this.pagina.set(1);
  });

  irAPagina(n: number) {
    this.pagina.set(Math.min(Math.max(1, n), this.totalPaginas()));
  }

  // ── Flujo financiero mes a mes (oculto por defecto) ─────────────
  public flujoVisible  = signal(false);
  public flujoCargando = signal(false);
  public flujoError    = signal(false);
  public rangoFlujo    = signal<'6M' | 'YTD' | '1A' | 'TODO'>('6M');
  private flujoMeses   = signal<{ mes: string; facturado: number; gasto: number }[]>([]);
  public readonly rangos: { id: '6M' | 'YTD' | '1A' | 'TODO'; etiqueta: string }[] = [
    { id: '6M', etiqueta: '6 meses' }, { id: 'YTD', etiqueta: 'Este año' }, { id: '1A', etiqueta: '12 meses' }, { id: 'TODO', etiqueta: 'Todo' }
  ];

  // Filtro de división propio de la sección: arranca igual al de arriba y se puede cambiar aquí
  public readonly divisionesFlujo = [
    { id: 'todas', etiqueta: 'Todas', color: 'bg-[#1e3a8a]' },
    { id: 'civiles', etiqueta: 'Construcción', color: 'bg-blue-500' },
    { id: 'energia', etiqueta: 'Energía', color: 'bg-amber-500' },
    { id: 'telecomunicaciones', etiqueta: 'O&M', color: 'bg-emerald-500' }
  ];
  private divisionFlujoElegida = signal<string | null>(null);
  public divisionFlujo = computed(() => this.divisionFlujoElegida() ?? this.filtroDivision());
  elegirDivisionFlujo(id: string) { this.divisionFlujoElegida.set(id); }
  // Si cambia el filtro de arriba, la sección vuelve a seguirlo
  private seguirFiltroDeArriba = effect(() => { this.filtroDivision(); this.divisionFlujoElegida.set(null); });

  /** Proyectos de la sección: los visibles del usuario con el estado de arriba y la división de la sección. */
  private proyectosFlujo = computed(() => {
    let lista = this.todosProyectos();
    if (!this.esGerente) lista = lista.filter(p => p.responsable?.id === this.usuarioActual?.id);
    if (this.divisionFlujo() !== 'todas') lista = lista.filter(p => p.lineaNegocio === this.divisionFlujo());
    if (this.filtroEstado() !== 'todos') lista = lista.filter(p => p.estado === this.filtroEstado());
    return lista;
  });
  public flujoFacturado = computed(() => this.proyectosFlujo().reduce((s, p) => s + (p.valorFacturado || 0), 0));
  public flujoGastoTotal = computed(() => this.proyectosFlujo().reduce((s, p) => s + (p.valorGasto || 0), 0));
  public flujoUtilidad = computed(() =>
    this.proyectosFlujo().reduce((s, p) => s + (p.utilidad ?? (p.valorFacturado || 0) - (p.valorGasto || 0) - (p.costoRealTotal || 0)), 0));
  public flujoMargen = computed(() => {
    const f = this.flujoFacturado();
    return f > 0 ? ((this.flujoUtilidad() / f) * 100).toFixed(1) : '0.0';
  });

  /** Se consulta al abrir la sección y cada vez que cambia su división o el estado de arriba. */
  private cargarFlujo = effect(() => {
    if (!this.flujoVisible()) return;
    const linea = this.divisionFlujo(), estado = this.filtroEstado();
    this.flujoCargando.set(true); this.flujoError.set(false);
    this.trackerService.getFlujoMensual(linea, estado).subscribe({
      next: m => { this.flujoMeses.set(m); this.flujoCargando.set(false); },
      error: () => { this.flujoCargando.set(false); this.flujoError.set(true); }
    });
  });

  private static claveMes(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  private static nombreMes(clave: string, largo = false) {
    const [y, m] = clave.split('-').map(Number);
    const t = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: largo ? 'long' : 'short', year: 'numeric' }).replace('.', '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /** Serie acumulada mes a mes (desde el primer movimiento hasta el mes actual), recortada al rango elegido. */
  public flujo = computed(() => {
    const datos = this.flujoMeses();
    const hoy = new Date();
    const actual = DashboardComponent.claveMes(hoy);
    if (!datos.length) return { meses: [] as string[], fact: [] as number[], gasto: [] as number[], delMesF: [] as number[], delMesG: [] as number[], actual };

    const porMes = new Map(datos.map(d => [d.mes, d]));
    const [y0, m0] = datos[0].mes.split('-').map(Number);
    const meses: string[] = [];
    for (let d = new Date(y0, m0 - 1, 1); DashboardComponent.claveMes(d) <= actual || meses.length === 0; d.setMonth(d.getMonth() + 1)) {
      meses.push(DashboardComponent.claveMes(d));
      if (meses.length > 600) break;
    }
    let accF = 0, accG = 0;
    const fact: number[] = [], gasto: number[] = [], delMesF: number[] = [], delMesG: number[] = [];
    for (const m of meses) {
      const d = porMes.get(m);
      delMesF.push(d?.facturado ?? 0); delMesG.push(d?.gasto ?? 0);
      accF += d?.facturado ?? 0; accG += d?.gasto ?? 0;
      fact.push(accF); gasto.push(accG);
    }
    let desde = 0;
    const r = this.rangoFlujo();
    if (r === '6M') desde = Math.max(0, meses.length - 6);
    else if (r === '1A') desde = Math.max(0, meses.length - 12);
    else if (r === 'YTD') { const i = meses.findIndex(m => m.startsWith(String(hoy.getFullYear()))); desde = i < 0 ? meses.length - 1 : i; }
    return {
      meses: meses.slice(desde), fact: fact.slice(desde), gasto: gasto.slice(desde),
      delMesF: delMesF.slice(desde), delMesG: delMesG.slice(desde), actual
    };
  });

  /** Primer mes en que lo facturado acumulado alcanza al gasto acumulado (si antes estaba por debajo). */
  public inflexion = computed(() => {
    const f = this.flujo();
    let estuvoAbajo = false;
    for (let i = 0; i < f.meses.length; i++) {
      if (f.fact[i] < f.gasto[i]) estuvoAbajo = true;
      else if (estuvoAbajo) return DashboardComponent.nombreMes(f.meses[i]);
    }
    return null;
  });

  /** Lo registrado en los proyectos sin movimiento con fecha (ajustes manuales): no aparece en la curva. */
  public sinFecha = computed(() => {
    const datos = this.flujoMeses();
    const f = this.flujoFacturado() - datos.reduce((s, d) => s + d.facturado, 0);
    const g = this.flujoGastoTotal() - datos.reduce((s, d) => s + d.gasto, 0);
    const relevante = (v: number, total: number) => Math.abs(v) > Math.max(1000, Math.abs(total) * 0.005);
    return { facturado: relevante(f, this.flujoFacturado()) ? f : 0, gasto: relevante(g, this.flujoGastoTotal()) ? g : 0 };
  });

  public chartFlujo = computed(() => {
    const f = this.flujo();
    return {
      series: [{ name: 'Facturado', data: f.fact }, { name: 'Gasto real', data: f.gasto }] as ApexAxisChartSeries,
      chart: { type: 'area', height: 300, toolbar: { show: false }, zoom: { enabled: false }, fontFamily: DashboardComponent.FUENTE, animations: { speed: 400 } } as ApexChart,
      colors: ['#2563eb', '#f59e0b'],
      stroke: { curve: 'smooth', width: [3, 2.5] } as ApexStroke,
      fill: { type: ['gradient', 'solid'], opacity: [1, 0.08],
              gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 95] } } as ApexFill,
      markers: { size: 4, strokeWidth: 2, strokeColors: '#ffffff', hover: { size: 6 } } as ApexMarkers,
      dataLabels: { enabled: false } as ApexDataLabels,
      xaxis: {
        categories: f.meses.map(m => DashboardComponent.nombreMes(m)),
        labels: { style: { fontSize: '11px', colors: '#64748b' } },
        axisBorder: { show: false }, axisTicks: { show: false },
        crosshairs: { stroke: { color: '#94a3b8', dashArray: 4 } }
      } as ApexXAxis,
      yaxis: { labels: { formatter: (v: number) => DashboardComponent.millones(v), style: { fontSize: '10px', colors: '#94a3b8' } } } as ApexYAxis,
      legend: { show: false } as ApexLegend,
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 } as ApexGrid,
      tooltip: {
        shared: true, intersect: false,
        custom: ({ dataPointIndex: i }: any) => {
          if (i == null || i < 0) return '';
          const fa = f.fact[i], ga = f.gasto[i], neto = fa - ga;
          const curso = f.meses[i] === f.actual ? ' <span style="background:#065f46;color:#a7f3d0;border-radius:4px;padding:1px 5px;font-size:9px;margin-left:4px">En curso</span>' : '';
          const fila = (c: string, n: string, v: number, mes: number) =>
            `<div style="display:flex;justify-content:space-between;gap:14px;margin-top:3px"><span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:6px"></span>${n}</span><span><b style="font-family:monospace">${DashboardComponent.pesos(v)}</b>${mes ? `<span style="color:#94a3b8"> (+${DashboardComponent.millones(mes)} en el mes)</span>` : ''}</span></div>`;
          return `<div style="background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:10px;font-size:11px;min-width:250px">
            <div style="font-weight:700;color:#fff">${DashboardComponent.nombreMes(f.meses[i], true)}${curso}</div>
            ${fila('#3b82f6', 'Facturado', fa, f.delMesF[i])}${fila('#f59e0b', 'Gasto real', ga, f.delMesG[i])}
            <div style="display:flex;justify-content:space-between;gap:14px;margin-top:6px;padding-top:6px;border-top:1px solid #334155"><span>Margen neto acumulado</span><b style="font-family:monospace;color:${neto >= 0 ? '#34d399' : '#f87171'}">${DashboardComponent.pesos(neto)}</b></div>
            <div style="color:#64748b;font-size:9px;margin-top:4px">Valores acumulados</div></div>`;
        }
      } as ApexTooltip
    };
  });

  public pesosCortos(v: number) { return DashboardComponent.millones(v); }

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
