import { Component, OnInit, inject, signal, computed, effect, ChangeDetectionStrategy, HostListener, viewChild } from '@angular/core';
import { ConCambiosPendientes } from '../../../core/guards/cambios-pendientes.guard';
import { CommonModule, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { TrackerService } from '../../../core/services/tracker';
import { AuthService } from '../../../core/auth/auth.service';
import Swal from 'sweetalert2';
import { CrearProyectoModalComponent } from './crear-proyecto-modal/crear-proyecto-modal';
import { CorteFacturacionModalComponent } from './corte-facturacion-modal/corte-facturacion-modal';
import { ProyectoPanelComponent } from './proyecto-panel/proyecto-panel';

@Component({
  selector: 'app-tracker-list',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, TitleCasePipe, CrearProyectoModalComponent, CorteFacturacionModalComponent, ProyectoPanelComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './tracker-list.html'
})
export class TrackerListComponent implements OnInit, ConCambiosPendientes {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private trackerService = inject(TrackerService);
  private authService = inject(AuthService);

  // Señales de la tabla
  public lineaActiva = signal<string>('');
  public mostrarFinalizados = signal<boolean>(false);
  public filtroEstado = signal<string>('todos');
  public filtroResponsable = signal<string>('todos');
  public filtroCliente = signal<string>('todos');

  /** Celular: los filtros se muestran solo al tocar el botón "Filtros". */
  public filtrosAbiertos = signal<boolean>(false);
  /** Cuántos filtros o vistas especiales están activos (se muestra en el botón "Filtros"). */
  public filtrosActivos = computed(() =>
    [this.filtroEstado(), this.filtroResponsable(), this.filtroCliente()].filter(f => f !== 'todos').length
    + (this.mostrarFinalizados() ? 1 : 0)
    + (this.viendoArchivados() ? 1 : 0)
  );

  // --- Filtros guardados: cada usuario recupera sus últimos filtros en cada división ---
  private claveFiltros(linea: string): string {
    return `rms_tracker_filtros_${this.authService.usuarioActual()?.email ?? 'anonimo'}_${linea}`;
  }

  /** Carga los filtros guardados de la división (o los deja en "todos" si no hay). */
  private restaurarFiltros(linea: string) {
    let f: any = {};
    try { f = JSON.parse(localStorage.getItem(this.claveFiltros(linea)) || '{}') || {}; } catch { f = {}; }
    this.filtroEstado.set(typeof f.estado === 'string' ? f.estado : 'todos');
    this.filtroResponsable.set(typeof f.responsable === 'string' ? f.responsable : 'todos');
    this.filtroCliente.set(typeof f.cliente === 'string' ? f.cliente : 'todos');
    this.mostrarFinalizados.set(f.finalizados === true);
  }

  /** Cada cambio de filtro se guarda para la división activa. */
  private guardarFiltros = effect(() => {
    const linea = this.lineaActiva();
    const filtros = {
      estado: this.filtroEstado(),
      responsable: this.filtroResponsable(),
      cliente: this.filtroCliente(),
      finalizados: this.mostrarFinalizados()
    };
    if (!linea) return;
    try { localStorage.setItem(this.claveFiltros(linea), JSON.stringify(filtros)); } catch { /* sin almacenamiento: no se guardan */ }
  });

  // --- Archivar / Eliminar proyectos (punto 17) ---
  public viendoArchivados   = signal<boolean>(false);
  public proyectosArchivados = signal<any[]>([]);
  public cargandoArchivados  = signal<boolean>(false);

  toggleVerArchivados() {
    const nuevo = !this.viendoArchivados();
    this.viendoArchivados.set(nuevo);
    if (nuevo) this.cargarProyectosArchivados();
  }

  cargarProyectosArchivados() {
    this.cargandoArchivados.set(true);
    this.trackerService.getProyectosArchivadosPorLinea(this.lineaActiva()).subscribe({
      next: (data) => { this.proyectosArchivados.set(data); this.cargandoArchivados.set(false); },
      error: () => this.cargandoArchivados.set(false)
    });
  }

  confirmarArchivarProyecto(p: any) {
    Swal.fire({
      icon: 'warning',
      title: '¿Archivar este proyecto?',
      html: `El proyecto <b>${p.codigo}</b> se ocultará del listado activo, pero conserva todo su historial. Podrás reactivarlo después desde "Ver archivados".`,
      showCancelButton: true,
      confirmButtonText: 'Sí, archivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b'
    }).then((res) => {
      if (!res.isConfirmed) return;
      const usuario = this.authService.usuarioActual();
      if (!usuario?.id) return;

      this.trackerService.archivarProyecto(p.id, usuario.id).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Proyecto archivado', timer: 1500, showConfirmButton: false });
          this.cerrarPanel();
          this.cargarProyectos(this.lineaActiva());
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo archivar el proyecto.' });
          console.error(err);
        }
      });
    });
  }

  confirmarReactivarProyecto(p: any) {
    Swal.fire({
      icon: 'question',
      title: '¿Reactivar este proyecto?',
      html: `El proyecto <b>${p.codigo}</b> volverá a aparecer en el listado activo.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1e3a8a'
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.trackerService.reactivarProyecto(p.id).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Proyecto reactivado', timer: 1500, showConfirmButton: false });
          this.cargarProyectosArchivados();
          this.cargarProyectos(this.lineaActiva());
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo reactivar el proyecto.' });
          console.error(err);
        }
      });
    });
  }

  confirmarEliminarDefinitivo(p: any) {
    Swal.fire({
      icon: 'error',
      title: 'Eliminar definitivamente',
      html: `Esta acción <b>no se puede deshacer</b>. Se eliminará por completo el proyecto <b>${p.codigo} — ${p.nombre}</b>.<br><br>Solo es posible si el proyecto no tiene OTs, requisiciones, anticipos ni valores financieros registrados.<br><br>Escribe <b>ELIMINAR</b> para confirmar.`,
      input: 'text',
      inputPlaceholder: 'ELIMINAR',
      showCancelButton: true,
      confirmButtonText: 'Eliminar definitivamente',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      preConfirm: (valor) => {
        if (valor !== 'ELIMINAR') {
          Swal.showValidationMessage('Debes escribir ELIMINAR exactamente para confirmar.');
          return false;
        }
        return true;
      }
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.trackerService.eliminarProyectoDefinitivo(p.id).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Proyecto eliminado', timer: 1500, showConfirmButton: false });
          this.cerrarPanel();
          this.cargarProyectos(this.lineaActiva());
          if (this.viendoArchivados()) this.cargarProyectosArchivados();
        },
        error: (err) => {
          const mensaje = err?.graphQLErrors?.[0]?.message || 'No se pudo eliminar el proyecto.';
          Swal.fire({ icon: 'error', title: 'No se puede eliminar', text: mensaje });
        }
      });
    });
  }
  public anticiposDirectos = signal<any[]>([]);
  public modalCorteFacturacionAbierto = signal<boolean>(false);
  public proyectoParaCorte = signal<any | null>(null);
  private corteModal = viewChild(CorteFacturacionModalComponent);
  private crearProyectoModal = viewChild(CrearProyectoModalComponent);
  private panelProyecto = viewChild(ProyectoPanelComponent);
  public configVisual = signal<any>({});
  public proyectos = signal<any[]>([]);
  public cargando = signal<boolean>(true);

  // Señales y variables del Modal
  public modalAbierto = signal<boolean>(false);
  public listasFormulario = signal<{clientes: any[], usuarios: any[], contratistas: any[]}>({ clientes: [], usuarios: [], contratistas: [] });
  public panelAbierto = signal<boolean>(false);
  public proyectoSeleccionado = signal<any>(null);

  public esAdminFase = signal<boolean>(false);

  // ==========================================
  // SEÑALES Y CÁLCULOS PARA EL DASHBOARD DE ALERTAS
  // ==========================================
  public vistaPrincipal = signal<'portafolio' | 'alertas'>('portafolio');
  public filtroAlertas = signal<'todos' | 'criticos' | 'ejecucion' | 'cierre' | 'ok'>('todos');

  // ==========================================
  // MOTOR DE ALERTAS
  // Cada proyecto recibe un array de alertas
  // calculadas en tiempo real desde los signals
  // ==========================================
  private diasDesdeHoy(fecha: string | null): number | null {
    if (!fecha) return null;
    const f = new Date(fecha).setHours(0, 0, 0, 0);
    const hoy = new Date().setHours(0, 0, 0, 0);
    return Math.floor((hoy - f) / (1000 * 60 * 60 * 24));
  }

  obtenerAlertas(p: any): { texto: string; tipo: 'rojo' | 'ambar' | 'azul' | 'verde'; icono: string }[] {
    const alertas: { texto: string; tipo: 'rojo' | 'ambar' | 'azul' | 'verde'; icono: string }[] = [];
    const estadosActivos = ['PENDIENTE', 'PENDIENTE_PRELIMINARES', 'EN_EJECUCIÓN', 'FINALIZADO_PARCIAL'];
    if (!estadosActivos.includes(p.estado)) return alertas;

    // 1. SLA respuesta al cliente
    if (!p.fechaRespuestaCliente) {
      alertas.push({ texto: 'Sin respuesta al cliente (SLA pendiente)', tipo: 'ambar', icono: 'ti-clock' });
    } else {
      const dias = this.calcularDiasDiferencia(p.fechaAsignacion, p.fechaRespuestaCliente);
      if (dias !== null && dias > 1)
        alertas.push({ texto: `SLA vencido — respuesta con ${dias} día(s) de retraso`, tipo: 'rojo', icono: 'ti-alert-circle' });
    }

    // 2. Inicio de obra sin OC
    if (p.fechaInicioActividades && (!p.numeroOC || !p.numeroOC.trim()))
      alertas.push({ texto: 'Inicio de obra registrado sin OC del cliente', tipo: 'rojo', icono: 'ti-file-x' });

    // 3. Ejecución vencida (fin de obra superado)
    if (p.estado === 'EN_EJECUCIÓN' && p.fechaFinalizacionActividades) {
      const dias = this.diasDesdeHoy(p.fechaFinalizacionActividades);
      if (dias !== null && dias > 0)
        alertas.push({ texto: `Fin de obra vencido hace ${dias} día(s)`, tipo: 'rojo', icono: 'ti-clock-exclamation' });
    }

    // 4. En ejecución sin fecha fin definida y más de 60 días desde inicio
    if (p.estado === 'EN_EJECUCIÓN' && p.fechaInicioActividades && !p.fechaFinalizacionActividades) {
      const dias = this.diasDesdeHoy(p.fechaInicioActividades);
      if (dias !== null && dias > 60)
        alertas.push({ texto: `En ejecución hace ${dias} días sin fecha de fin definida`, tipo: 'ambar', icono: 'ti-clock' });
    }

    // 5. Atascado en FINALIZADO_PARCIAL
    if (p.estado === 'FINALIZADO_PARCIAL') {
      const dias = this.diasDesdeHoy(p.fechaFinalizacionActividades);
      if (dias !== null && dias > 15)
        alertas.push({ texto: `Finalizado parcial hace ${dias} días — cierre admin pendiente`, tipo: 'azul', icono: 'ti-file-invoice' });
      if (!p.facturacionCompletada)
        alertas.push({ texto: 'Sin factura emitida al cliente', tipo: 'ambar', icono: 'ti-receipt' });
    }

    // 6. Sin alertas
    if (alertas.length === 0)
      alertas.push({ texto: 'Sin alertas activas', tipo: 'verde', icono: 'ti-circle-check' });

    return alertas;
  }

  get severidadProyecto(): (p: any) => 'critico' | 'advertencia' | 'cierre' | 'ok' {
    return (p: any) => {
      const alertas = this.obtenerAlertas(p);
      if (alertas.some(a => a.tipo === 'rojo')) return 'critico';
      if (alertas.some(a => a.tipo === 'azul')) return 'cierre';
      if (alertas.some(a => a.tipo === 'ambar')) return 'advertencia';
      return 'ok';
    };
  }

  public proyectosConAlertas = computed(() => {
    return this.proyectos()
      .map(p => ({ ...p, _alertas: this.obtenerAlertas(p), _severidad: this.severidadProyecto(p) }))
      .filter(p => ['PENDIENTE', 'PENDIENTE_PRELIMINARES', 'EN_EJECUCIÓN', 'FINALIZADO_PARCIAL'].includes(p.estado))
      .sort((a, b) => {
        const orden: Record<string, number> = { critico: 0, advertencia: 1, cierre: 2, ok: 3 };
        return orden[a._severidad] - orden[b._severidad];
      });
  });

  public alertasFiltradas = computed(() => {
    const filtro = this.filtroAlertas();
    const proyectos = this.proyectosConAlertas();
    if (filtro === 'todos')      return proyectos;
    if (filtro === 'criticos')   return proyectos.filter(p => p._severidad === 'critico');
    if (filtro === 'ejecucion')  return proyectos.filter(p => p._alertas.some((a: any) => a.icono === 'ti-clock-exclamation' || a.icono === 'ti-clock'));
    if (filtro === 'cierre')     return proyectos.filter(p => p._severidad === 'cierre');
    if (filtro === 'ok')         return proyectos.filter(p => p._severidad === 'ok');
    return proyectos;
  });

  public kpiSLA = computed(() => {
    let aTiempo = 0, retraso = 0, pendiente = 0;
    // Solo proyectos activos — misma fuente que proyectosConAlertas
    const estadosActivos = ['PENDIENTE', 'PENDIENTE_PRELIMINARES', 'EN_EJECUCIÓN', 'FINALIZADO_PARCIAL'];
    this.proyectos()
      .filter(p => estadosActivos.includes(p.estado))
      .forEach(p => {
        const estado = this.obtenerEstadoSLA(p).estado;
        if (estado === 'a_tiempo') aTiempo++;
        else if (estado === 'retraso') retraso++;
        else pendiente++;
      });
    return { aTiempo, retraso, pendiente };
  });

  public kpiEjecucionVencida = computed(() =>
    this.proyectosConAlertas().filter(p =>
      p._alertas.some((a: any) => a.icono === 'ti-clock-exclamation')
    ).length
  );

  public kpiCierre = computed(() =>
    this.proyectos().filter(p => p.estado === 'FINALIZADO_PARCIAL').length
  );

  public kpiCriticos = computed(() =>
    this.proyectosConAlertas().filter(p => p._severidad === 'critico').length
  );

  setFiltroAlertas(id: string) {
    this.filtroAlertas.set(id as 'todos' | 'criticos' | 'ejecucion' | 'cierre' | 'ok');
  }

  tieneCriticosEnFiltro(): boolean {
    return this.alertasFiltradas().some(p => p._severidad === 'critico');
  }

  notificarGerencia(p: any) {
    Swal.fire({
      title: `Notificar Gerencia`,
      html: `<p style="font-size:13px;color:#64748b">Se enviará una alerta vía n8n para el proyecto:<br><b style="color:#0f172a">${p.nombre}</b></p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Enviar alerta',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    }).then(result => {
      if (result.isConfirmed) {
        this.trackerService.notificarAlertaGerencia(p.id, p.codigo, p.nombre).subscribe({
          next: () => Swal.fire({ icon: 'success', title: 'Alerta enviada', text: 'Gerencia fue notificada vía WhatsApp y correo.', timer: 3000 }),
          error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo conectar con n8n. Intenta de nuevo.' })
        });
      }
    });
  }

  private temas: Record<string, any> = {
    'civiles': { titulo: 'Construcción', textoColor: 'text-[#1e3a8a]', bgColor: 'bg-[#1e3a8a]', bgClaro: 'bg-blue-50', borde: 'border-blue-200' },
    'energia': { titulo: 'Energía', textoColor: 'text-[#ffb31c]', bgColor: 'bg-[#ffb31c]', bgClaro: 'bg-yellow-50', borde: 'border-yellow-200' },
    'telecomunicaciones': { titulo: 'O&M - Operación y Mantenimiento', textoColor: 'text-emerald-600', bgColor: 'bg-emerald-600', bgClaro: 'bg-emerald-50', borde: 'border-emerald-200' },
    'todas': { titulo: 'Vista Consolidada — Todos los Proyectos', textoColor: 'text-slate-700', bgColor: 'bg-slate-700', bgClaro: 'bg-slate-50', borde: 'border-slate-200' }
  };

  ngOnInit() {
    this.esAdminFase.set(
      this.authService.hasPermission('proyectos.fase.administrativa') ||
      this.authService.hasPermission('proyectos.editar')
    );

    this.route.paramMap.subscribe(params => {
      const linea = params.get('linea') || 'civiles';

      const permisosPorLinea: Record<string, string> = {
        'civiles': 'proyectos.civiles',
        'energia': 'proyectos.energia',
        'telecomunicaciones': 'proyectos.telecom',
        'todas': 'proyectos.gerente'
      };

      if (!this.authService.hasPermission(permisosPorLinea[linea])) {
        this.router.navigate(['/proyectos']).then(() => {
          Swal.fire({ icon: 'warning', title: 'Acceso Restringido', text: 'No tienes los permisos necesarios.', confirmButtonColor: '#1e3a8a' });
        });
        return;
      }

      this.restaurarFiltros(linea);
      this.lineaActiva.set(linea);
      this.configVisual.set(this.temas[linea] || this.temas['civiles']);
      this.cargarProyectos(linea);
      this.cargarDatosFormulario();
    });
  }

  // --- FUNCIONES MATEMÁTICAS PARA LAS ALERTAS ---

  calcularDiasDiferencia(fechaInicial: string | null, fechaFinal: string | null): number | null {
    if (!fechaInicial || !fechaFinal) return null;
    const f1 = new Date(fechaInicial).setHours(0,0,0,0);
    const f2 = new Date(fechaFinal).setHours(0,0,0,0);
    const diffTime = Math.abs(f2 - f1);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  obtenerEstadoSLA(p: any) {
    if (!p.fechaRespuestaCliente) {
      return { texto: 'Respuesta Pendiente', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', estado: 'pendiente', dias: null };
    }
    const dias = this.calcularDiasDiferencia(p.fechaAsignacion, p.fechaRespuestaCliente);
    if (dias !== null && dias <= 1) {
      return { texto: 'A Tiempo', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', estado: 'a_tiempo', dias: dias };
    } else {
      return { texto: 'Con Retraso', badge: 'bg-red-100 text-red-700 border-red-200', estado: 'retraso', dias: dias };
    }
  }

  obtenerClaseEstado(estado: string): string {
    switch (estado) {
      case 'PENDIENTE':
        return 'bg-amber-50 text-amber-700';
      case 'PENDIENTE_PRELIMINARES':
        return 'bg-orange-50 text-orange-600';
      case 'EN_EJECUCIÓN':
        return 'bg-blue-50 text-blue-700';
      case 'FINALIZADO_PARCIAL':
        return 'bg-purple-50 text-purple-700';
      case 'FINALIZADO_TOTAL':
        return 'bg-emerald-50 text-emerald-700';
      case 'Cancelado':
        return 'bg-slate-100 text-slate-500';
      case 'Incumplimiento':
        return 'bg-red-50 text-red-600';
      default:
        return 'bg-slate-50 text-slate-400';
    }
  }

  abrirPanel(proyecto: any) {
    this.proyectoSeleccionado.set(proyecto);
    this.panelAbierto.set(true);
  }

  /** Hay un formulario abierto con cambios sin guardar (lo usan el guard de ruta y el aviso del navegador). */
  tieneCambiosSinGuardar(): boolean {
    return !!this.panelProyecto()?.tieneCambios()
      || !!this.crearProyectoModal()?.tieneCambios()
      || !!this.corteModal()?.tieneCambios();
  }

  /** Al cerrar o recargar la pestaña con cambios sin guardar, el navegador pide confirmación. */
  @HostListener('window:beforeunload', ['$event'])
  avisarAntesDeSalir(evento: BeforeUnloadEvent) {
    if (this.tieneCambiosSinGuardar()) { evento.preventDefault(); evento.returnValue = ''; }
  }

  cerrarPanel() {
    this.panelAbierto.set(false);
    this.proyectoSeleccionado.set(null);
  }

  /** Refleja en la lista un cambio local hecho desde el panel. */
  reemplazarProyecto(proyecto: any) {
    this.proyectos.update(lista => lista.map(p => p.id === proyecto.id ? proyecto : p));
  }

  // --- MÉTODOS DE DATOS ---
  get esGerente(): boolean {
    // Punto 8 (semana 39, revisión final): la visibilidad de TODOS los proyectos
    // de la división (en vez de solo los propios, ver proyectosFiltrados abajo)
    // depende exclusivamente de 'proyectos.gerente'. 'proyectos.editar' es un
    // permiso distinto (habilita editar campos) y NO debe dar acceso a ver los
    // proyectos de otros usuarios.
    return this.authService.hasPermission('proyectos.gerente');
  }

  get responsablesDisponibles() {
    const mapa = new Map<string, string>();
    for (const p of this.proyectos()) {
      if (p.responsable?.id && p.responsable?.nombre) {
        mapa.set(p.responsable.id, p.responsable.nombre);
      }
    }
    return Array.from(mapa.entries()).map(([id, nombre]) => ({ id, nombre }));
  }

  get clientesDisponibles(): string[] {
    const set = new Set<string>();
    for (const p of this.proyectos()) {
      if (p.cliente?.razonSocial) set.add(p.cliente.razonSocial);
    }
    return Array.from(set).sort();
  }

  get proyectosFiltrados() {
    const usuario = this.authService.usuarioActual();
    let lista = this.proyectos();

    // Vista por rol: coordinador solo ve sus proyectos, gerente ve todos
    if (!this.esGerente && usuario) {
      lista = lista.filter(p => p.responsable?.id === usuario.id);
    }

    // Ocultar finalizados salvo que el toggle esté activo
    if (!this.mostrarFinalizados()) {
      lista = lista.filter(p => p.estado !== 'FINALIZADO_TOTAL');
    }

    // Filtro por estado
    if (this.filtroEstado() !== 'todos') {
      lista = lista.filter(p => p.estado === this.filtroEstado());
    }

    // Filtro por responsable
    if (this.filtroResponsable() !== 'todos') {
      lista = lista.filter(p => p.responsable?.id === this.filtroResponsable());
    }

    // Filtro por cliente
    if (this.filtroCliente() !== 'todos') {
      lista = lista.filter(p => p.cliente?.razonSocial === this.filtroCliente());
    }

    // Más reciente primero por Fecha de Asignación
    lista = [...lista].sort((a, b) =>
      new Date(b.fechaAsignacion).getTime() - new Date(a.fechaAsignacion).getTime()
    );

    return lista;
  }

  cargarProyectos(linea: string) {
    this.cargando.set(true);
    const obs = linea === 'todas'
      ? this.trackerService.getTodosLosProyectosConsolidado()
      : this.trackerService.getProyectosPorLinea(linea);
    obs.subscribe({
      next: (data) => { this.proyectos.set(data); this.cargando.set(false); },
      error: () => { this.cargando.set(false); }
    });
  }

  cargarDatosFormulario() {
    this.trackerService.getDatosParaFormulario().subscribe(datos => {
      this.listasFormulario.set(datos);
    });
  }

  // --- MODAL CREAR PROYECTO (componente CrearProyectoModalComponent) ---
  abrirModal() {
    this.modalAbierto.set(true);
  }

  // --- MODAL CORTES DE FACTURACIÓN (componente CorteFacturacionModalComponent) ---
  abrirModalCorteFacturacion(p: any) {
    this.proyectoParaCorte.set(p);
    this.modalCorteFacturacionAbierto.set(true);
  }

  cerrarModalCorteFacturacion() {
    this.modalCorteFacturacionAbierto.set(false);
    this.proyectoParaCorte.set(null);
  }

  /** Suma el corte recién registrado al proyecto en la lista, sin recargar. */
  alAgregarCorte(proyectoId: any, corte: any) {
    this.proyectos.update(ps => ps.map(proj => {
      if (proj.id !== proyectoId) return proj;
      const cortes = [corte, ...(proj.cortesFacturacion || [])];
      return {
        ...proj,
        cortesFacturacion: cortes,
        valorFacturado: cortes
          .filter((c: any) => c.estado !== 'ANULADO')
          .reduce((sum: number, c: any) => sum + (c.valorCorte || 0), 0)
      };
    }));
  }

  descargandoExcel = signal<boolean>(false);

  descargarExcel() {
    this.descargandoExcel.set(true);
    this.trackerService.descargarExcelProyectos(this.lineaActiva()).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RMS_Tracker_${this.lineaActiva()}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        this.descargandoExcel.set(false);
      },
      error: (err) => {
        this.descargandoExcel.set(false);
        if (err?.status === 401) {
          Swal.fire('Sesión expirada', 'Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.', 'warning');
        } else {
          Swal.fire('Error', 'No se pudo generar el archivo Excel.', 'error');
        }
      }
    });
  }

  aprobarAnticipoDirecto(anticipo: any) {
    this.trackerService.aprobarAnticipoDirecto(anticipo.id).subscribe({
      next: (res) => {
        this.anticiposDirectos.update(a => a.map((x: any) => x.id === anticipo.id ? { ...x, ...res } : x));
        Swal.fire({ icon: 'success', title: 'Anticipo aprobado', timer: 2000, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo aprobar.', 'error')
    });
  }

  pagarAnticipoDirecto(anticipo: any) {
    Swal.fire({
      title: 'Registrar pago WorldOffice',
      input: 'text',
      inputLabel: 'ID de Egreso WorldOffice',
      inputPlaceholder: 'Ej: EG-2024-001',
      showCancelButton: true,
      confirmButtonText: 'Registrar Pago',
      confirmButtonColor: '#1e3a8a'
    }).then(r => {
      if (r.isConfirmed && r.value?.trim()) {
        this.trackerService.pagarAnticipoDirecto(anticipo.id, r.value.trim()).subscribe({
          next: (res) => {
            this.anticiposDirectos.update(a => a.map((x: any) => x.id === anticipo.id ? { ...x, ...res } : x));
            Swal.fire({ icon: 'success', title: 'Pago registrado', timer: 2000, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo registrar el pago.', 'error')
        });
      }
    });
  }

  rechazarAnticipoDirecto(anticipo: any) {
    this.trackerService.rechazarAnticipoDirecto(anticipo.id).subscribe({
      next: () => this.anticiposDirectos.update(a => a.map((x: any) => x.id === anticipo.id ? { ...x, estado: 'RECHAZADO' } : x)),
      error: () => Swal.fire('Error', 'No se pudo rechazar.', 'error')
    });
  }
}
