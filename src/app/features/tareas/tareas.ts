import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { skip } from 'rxjs/operators';
import { interval } from 'rxjs';
import { filter } from 'rxjs/operators';
// Drag & Drop: API nativa HTML5 — sin dependencia de @angular/cdk
import { TareaService, Tarea, EstadoTarea, TareaComentario, ReporteSemanalDto, CumplimientoPersonaDto } from '../../core/services/tarea';
import { AuthService } from '../../core/auth/auth.service';
import { UsuarioService } from '../../core/services/usuario';
import { NotificacionService, NotificacionDto } from '../../core/services/notificacion';
import Swal from 'sweetalert2';

// ─────────────────────────────────────────────────────────
// HELPER: obtiene el lunes de la semana de una fecha dada
// ─────────────────────────────────────────────────────────
function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0=Dom … 6=Sab
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Convierte "YYYY-MM-DD" al ISO 8601 completo que espera HotChocolate DateTime */
function toIso(dateStr: string): string {
  return dateStr + 'T00:00:00.000Z';
}

/** Devuelve el domingo de la semana de la fecha dada */
function domingoSemana(d: Date): Date {
  const r = new Date(lunesDe(d));
  r.setDate(r.getDate() + 6);
  return r;
}

/** Primer día del mes actual */
function primerDiaMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Último día del mes actual */
function ultimoDiaMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ReactiveFormsModule],
  templateUrl: './tareas.html'
})
export class TareasComponent implements OnInit {
  private tareaService        = inject(TareaService);
  public  authService         = inject(AuthService);
  private usuarioService      = inject(UsuarioService);
  private notificacionService = inject(NotificacionService);
  private fb                  = inject(FormBuilder);
  private destroyRef          = inject(DestroyRef);

  /** IDs vistos en el último poll; vacío = primera carga (no dispara recarga del kanban) */
  private notifIdsAnteriores = new Set<number>();

  constructor() {
    // Cuando cualquier mutación ocurre Y el usuario está viendo la vista 'reporte',
    // refrescar el cumplimiento automáticamente sin recargar la página.
    toObservable(this.tareaService.ultimoCambio)
      .pipe(
        skip(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.vista() === 'reporte') {
          this.cargarCumplimiento();
        }
      });

    // Cargar notificaciones al inicio y hacer polling cada 30 segundos
    // (solo cuando la pestaña está activa para no desperdiciar recursos)
    this.cargarNotificaciones();
    interval(60_000)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(() => !document.hidden)
      )
      .subscribe(() => this.cargarNotificaciones());
  }

  // ── Vista activa ──────────────────────────────────────────
  public vista = signal<'kanban' | 'reporte' | 'estados'>('kanban');

  // ── Semana activa (siempre es un lunes) ──────────────────
  public semanaActual = signal<Date>(lunesDe(new Date()));

  public labelSemana = computed(() => {
    const l = this.semanaActual();
    const v = addWeeks(l, 1);
    v.setDate(v.getDate() - 1); // domingo
    return `${l.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} – ${v.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  });

  public esSemanaActual = computed(() =>
    formatDate(this.semanaActual()) === formatDate(lunesDe(new Date()))
  );

  // ── Datos ─────────────────────────────────────────────────
  public estados       = signal<EstadoTarea[]>([]);
  public todosEstados  = signal<EstadoTarea[]>([]);
  public tareas        = signal<Tarea[]>([]);
  public usuarios      = signal<any[]>([]);
  public reporte       = signal<ReporteSemanalDto | null>(null);
  public cargando      = signal<boolean>(true);
  public cargandoReporte = signal<boolean>(false);

  // ── Cumplimiento por persona ──────────────────────────────
  public cumplimientoData      = signal<CumplimientoPersonaDto[]>([]);
  public cargandoCumplimiento  = signal<boolean>(false);
  public filtroDesde           = signal<string>(formatDate(lunesDe(new Date())));
  public filtroHasta           = signal<string>(formatDate(domingoSemana(new Date())));
  public filtroPersonaIds      = signal<string[]>([]);
  public personaExpandida      = signal<string | null>(null);
  public periodoRapido         = signal<'semana' | 'semana_ant' | 'mes' | 'personalizado'>('semana');
  public mostrarFiltroPersonas = signal<boolean>(false);

  public cumplimientoFiltrado = computed(() => {
    const ids  = this.filtroPersonaIds();
    const data = this.cumplimientoData();
    return ids.length === 0 ? data : data.filter(p => ids.includes(p.usuarioId));
  });

  public resumenCumplimiento = computed(() => {
    const data        = this.cumplimientoFiltrado();
    const total       = data.reduce((s, p) => s + p.total, 0);
    const completadas = data.reduce((s, p) => s + p.completadas, 0);
    return {
      total,
      completadas,
      vencidas:     data.reduce((s, p) => s + p.vencidas, 0),
      movidas:      data.reduce((s, p) => s + p.movidas, 0),
      porcentaje:   total > 0 ? Math.round(completadas / total * 100) : 0,
      personasCien: data.filter(p => p.porcentajeCumplimiento === 100).length,
      personas:     data.length,
    };
  });

  // ── Kanban: filtros ──────────────────────────────────────
  public filtroResponsableId = signal<string>('');
  public hayFiltrosActivos   = computed(() => !!this.filtroResponsableId());

  // ── Kanban: "Ver más" ─────────────────────────────────────
  public  readonly LIMIT_TARJETAS  = 5;
  private columnasExpandidas       = signal<Set<number>>(new Set());

  // ── Kanban: columnas ─────────────────────────────────────
  public columnas = computed(() => {
    const respId     = this.filtroResponsableId();
    const expandidas = this.columnasExpandidas();

    return this.estados().map(e => {
      const todas     = this.tareas().filter(t => t.estadoId === e.id);
      const filtradas = respId
        ? todas.filter(t => t.asignados.some(a => a.usuarioId === respId))
        : todas;

      const expandida = expandidas.has(e.id);
      const visibles  = expandida ? filtradas : filtradas.slice(0, this.LIMIT_TARJETAS);

      return {
        estado:         e,
        items:          visibles,
        total:          todas.length,
        totalFiltradas: filtradas.length,
        ocultas:        Math.max(0, filtradas.length - visibles.length),
        expandida
      };
    });
  });

  toggleExpandirColumna(estadoId: number): void {
    this.columnasExpandidas.update(set => {
      const nuevo = new Set(set);
      if (nuevo.has(estadoId)) nuevo.delete(estadoId); else nuevo.add(estadoId);
      return nuevo;
    });
  }

  limpiarFiltros(): void {
    this.filtroResponsableId.set('');
  }

  // ── Drag & Drop nativo ────────────────────────────────────
  public draggingTarea        = signal<Tarea | null>(null);
  public draggingOverEstadoId = signal<number | null>(null);

  // ── Notificaciones ────────────────────────────────────────
  public notificaciones  = signal<NotificacionDto[]>([]);
  public cargandoNotifs  = signal<boolean>(false);
  public notifAbiertas   = signal<boolean>(false);
  public notifNoLeidas       = computed(() => this.notificaciones().filter(n => !n.leida).length);
  public tieneNotifLeidas    = computed(() => this.notificaciones().some(n => n.leida));

  // ── Modales ───────────────────────────────────────────────
  // -- Nueva / Editar tarea --
  public modalTareaAbierto = signal<boolean>(false);
  public tareaEditando     = signal<Tarea | null>(null);
  public guardandoTarea    = signal<boolean>(false);
  public tareaForm!: FormGroup;
  public asignadosSeleccionados = signal<string[]>([]);

  // -- Detalle de tarea --
  public panelAbierto      = signal<boolean>(false);
  public tareaDetalle      = signal<Tarea | null>(null);
  public tabDetalle        = signal<'info' | 'comentarios' | 'historial' | 'movimientos'>('info');
  public nuevoComentario   = signal<string>('');
  public guardandoComentario = signal<boolean>(false);
  public usuarioAsignarId  = signal<string>('');

  // -- Mover semana --
  public modalMoverAbierto = signal<boolean>(false);
  public tareaAMover       = signal<Tarea | null>(null);
  public motivoMover       = signal<string>('');
  public nuevaSemanaInput  = signal<string>('');
  public moviendoTarea     = signal<boolean>(false);

  // -- Cambiar estado --
  public cambiandoEstado   = signal<boolean>(false);

  // -- Admin estados --
  public estadoForm!: FormGroup;
  public estadoEditando    = signal<EstadoTarea | null>(null);
  public guardandoEstado   = signal<boolean>(false);
  public modalEstadoAbierto = signal<boolean>(false);

  // ── Permisos ──────────────────────────────────────────────
  public puedeCRear        = computed(() => this.authService.hasPermission('tareas.crear'));
  public puedeAsignar      = computed(() => this.authService.hasPermission('tareas.asignar'));
  public puedeMover        = computed(() => this.authService.hasPermission('tareas.mover'));
  public puedeFinalizar    = computed(() => this.authService.hasPermission('tareas.finalizar'));
  public puedeReportes     = computed(() => this.authService.hasPermission('tareas.reportes'));
  public puedeAdminEstados = computed(() => this.authService.hasPermission('tareas.estados.admin'));

  // Mínima semana seleccionable al crear tarea (el lunes de la semana actual)
  public minSemanaProgramada = computed(() => formatDate(lunesDe(new Date())));

  // Fecha de hoy YYYY-MM-DD — mínimo para fechas presupuestadas al crear
  public readonly hoyStr: string = formatDate(new Date());

  get usuarioId(): string {
    return this.authService.usuarioActual()?.id ?? '';
  }

  // ─────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.initForms();
    this.cargarEstados();
    this.cargarTareas();
    this.cargarUsuarios();
  }

  private initForms(): void {
    this.tareaForm = this.fb.group({
      titulo:                 ['', [Validators.required, Validators.maxLength(250)]],
      descripcion:            [''],
      estadoId:               [null, Validators.required],
      semanaProgramada:       [formatDate(this.semanaActual()), Validators.required],
      fechaPresupuestoInicio: [''],
      fechaPresupuestoFin:    [''],
    });

    this.estadoForm = this.fb.group({
      nombre:          ['', [Validators.required, Validators.maxLength(100)]],
      color:           ['#1e3a8a', Validators.required],
      orden:           [0, Validators.required],
      esEstadoInicial: [false],
      esEstadoFinal:   [false],
    });
  }

  // ── Carga de datos ────────────────────────────────────────

  cargarEstados(): void {
    this.tareaService.getEstadosTarea().subscribe({
      next: e => {
        this.estados.set(e);
        // Pre-seleccionar estado inicial en el form
        const inicial = e.find(x => x.esEstadoInicial);
        if (inicial) this.tareaForm.patchValue({ estadoId: inicial.id });
      },
      error: () => {}
    });
  }

  cargarTareas(): void {
    this.cargando.set(true);
    this.tareaService.getTareasSemana(this.semanaActual()).subscribe({
      next: t => { this.tareas.set(t); this.cargando.set(false); },
      error: () => { this.cargando.set(false); }
    });
  }

  cargarUsuarios(): void {
    this.usuarioService.getUsuarios().subscribe({
      next: u => this.usuarios.set(u),
      error: () => {}
    });
  }

  cargarReporte(): void {
    this.cargandoReporte.set(true);
    this.reporte.set(null);
    this.tareaService.getReporteSemanal(this.semanaActual()).subscribe({
      next: r => { this.reporte.set(r); this.cargandoReporte.set(false); },
      error: () => { this.cargandoReporte.set(false); }
    });
  }

  cargarTodosEstados(): void {
    this.tareaService.getTodosEstadosTarea().subscribe({
      next: e => this.todosEstados.set(e),
      error: () => {}
    });
  }

  // ── Navegación semanal ────────────────────────────────────

  semanaAnterior(): void {
    this.semanaActual.update(s => addWeeks(s, -1));
    this.cargarTareas();
  }

  semanasSiguiente(): void {
    this.semanaActual.update(s => addWeeks(s, 1));
    this.cargarTareas();
  }

  irSemanaActual(): void {
    this.semanaActual.set(lunesDe(new Date()));
    this.cargarTareas();
  }

  cambiarVista(v: 'kanban' | 'reporte' | 'estados'): void {
    this.vista.set(v);
    // Siempre refrescar al entrar a 'reporte' para mostrar datos actualizados
    if (v === 'reporte') this.cargarCumplimiento();
    if (v === 'estados') this.cargarTodosEstados();
  }

  // ── Helpers de UI ────────────────────────────────────────

  esVencida(t: Tarea): boolean {
    if (!t.fechaPresupuestoFin || t.estado?.esEstadoFinal) return false;
    return new Date(t.fechaPresupuestoFin) < new Date();
  }

  /**
   * Devuelve los días de retraso de una tarea completada respecto al
   * domingo de su semana programada. Retorna 0 si fue a tiempo o no aplica.
   */
  diasRetraso(t: Tarea): number {
    if (!t.estado?.esEstadoFinal || !t.fechaRealFinalizacion) return 0;
    const domSemana = new Date(t.semanaProgramada);
    domSemana.setDate(domSemana.getDate() + 6); // domingo
    const finReal = new Date(t.fechaRealFinalizacion);
    return Math.max(0, Math.ceil((finReal.getTime() - domSemana.getTime()) / 86_400_000));
  }

  iniciales(nombre: string): string {
    return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  colorHex(color: string): string {
    // Si el color ya tiene #, úsalo directamente; si no, devuelve un default
    return color?.startsWith('#') ? color : '#6b7280';
  }

  contrasteTexto(hexColor: string): string {
    const c = hexColor.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 128 ? '#1e293b' : '#ffffff';
  }

  // ── Drag & Drop ───────────────────────────────────────────

  // ── Drag & Drop — API nativa HTML5 ───────────────────────

  onDragStart(event: DragEvent, t: Tarea): void {
    this.draggingTarea.set(t);
    event.dataTransfer?.setData('text/plain', String(t.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragEnd(): void {
    this.draggingTarea.set(null);
    this.draggingOverEstadoId.set(null);
  }

  onDragOver(event: DragEvent, estadoId: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.draggingOverEstadoId.set(estadoId);
  }

  onDragLeave(event: DragEvent): void {
    // Solo limpiar si el puntero sale realmente del contenedor
    const el = event.currentTarget as HTMLElement;
    if (!el.contains(event.relatedTarget as Node)) {
      this.draggingOverEstadoId.set(null);
    }
  }

  onDropNative(event: DragEvent, estadoDestino: EstadoTarea): void {
    event.preventDefault();
    this.draggingOverEstadoId.set(null);
    const tarea = this.draggingTarea();
    this.draggingTarea.set(null);

    if (!tarea || tarea.estadoId === estadoDestino.id) return;

    if (estadoDestino.esEstadoFinal && !this.puedeFinalizar()) {
      Swal.fire({
        icon: 'warning',
        title: 'Permiso insuficiente',
        text: 'Solo un supervisor puede marcar tareas como completadas.',
        timer: 2500,
        showConfirmButton: false
      });
      return;
    }

    if (estadoDestino.esEstadoFinal) {
      const hoy = new Date().toISOString().split('T')[0];
      Swal.fire({
        title: '¿Cuándo se completó esta tarea?',
        input: 'date',
        inputValue: hoy,
        inputAttributes: { max: hoy },
        showCancelButton: true,
        confirmButtonColor: '#1e3a8a',
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => (!value ? 'Debes seleccionar una fecha' : null)
      }).then(result => {
        if (!result.isConfirmed) return;
        this.tareas.update(arr => arr.map(x =>
          x.id === tarea.id ? { ...x, estadoId: estadoDestino.id, estado: estadoDestino } : x
        ));
        this._ejecutarCambioEstado(tarea, estadoDestino.id, toIso(result.value));
      });
    } else {
      this.tareas.update(arr => arr.map(x =>
        x.id === tarea.id ? { ...x, estadoId: estadoDestino.id, estado: estadoDestino } : x
      ));
      this._ejecutarCambioEstado(tarea, estadoDestino.id, undefined);
    }
  }

  // ── Modal Nueva / Editar Tarea ────────────────────────────

  abrirNuevaTarea(): void {
    this.tareaEditando.set(null);
    this.asignadosSeleccionados.set([]);
    this.tareaForm.reset({
      estadoId: this.estados().find(e => e.esEstadoInicial)?.id ?? null,
      semanaProgramada: formatDate(this.semanaActual()),
    });
    this.modalTareaAbierto.set(true);
  }

  abrirEditarTarea(t: Tarea, event: Event): void {
    event.stopPropagation();
    this.tareaEditando.set(t);
    this.asignadosSeleccionados.set(t.asignados.map(a => a.usuarioId));
    this.tareaForm.patchValue({
      titulo: t.titulo,
      descripcion: t.descripcion ?? '',
      estadoId: t.estadoId,
      semanaProgramada: formatDate(new Date(t.semanaProgramada)),
      fechaPresupuestoInicio: t.fechaPresupuestoInicio ? formatDate(new Date(t.fechaPresupuestoInicio)) : '',
      fechaPresupuestoFin: t.fechaPresupuestoFin ? formatDate(new Date(t.fechaPresupuestoFin)) : '',
    });
    this.modalTareaAbierto.set(true);
  }

  cerrarModalTarea(): void {
    this.modalTareaAbierto.set(false);
  }

  toggleAsignado(uid: string): void {
    this.asignadosSeleccionados.update(arr =>
      arr.includes(uid) ? arr.filter(x => x !== uid) : [...arr, uid]
    );
  }

  guardarTarea(): void {
    if (this.tareaForm.invalid) return;
    this.guardandoTarea.set(true);
    const v = this.tareaForm.value;

    // Validar que no sea semana pasada (solo al crear, no al editar)
    if (!this.tareaEditando()) {
      const semanaElegida = lunesDe(new Date(v.semanaProgramada + 'T12:00:00'));
      const semanaMinima  = lunesDe(new Date());
      if (semanaElegida < semanaMinima) {
        this.guardandoTarea.set(false);
        Swal.fire({
          icon: 'warning',
          title: 'Semana no válida',
          text: 'No puedes programar tareas en semanas anteriores a la actual.'
        });
        return;
      }
    }

    if (this.tareaEditando()) {
      // Actualizar
      this.tareaService.updateTarea(this.tareaEditando()!.id, {
        titulo: v.titulo,
        descripcion: v.descripcion || undefined,
        fechaPresupuestoInicio: v.fechaPresupuestoInicio ? toIso(v.fechaPresupuestoInicio) : undefined,
        fechaPresupuestoFin: v.fechaPresupuestoFin ? toIso(v.fechaPresupuestoFin) : undefined,
      }).subscribe({
        next: updated => {
          this.tareas.update(arr => arr.map(t => t.id === updated.id ? { ...t, ...updated } : t));
          this.guardandoTarea.set(false);
          this.cerrarModalTarea();
          Swal.fire({ icon: 'success', title: 'Tarea actualizada', timer: 1500, showConfirmButton: false });
        },
        error: err => {
          this.guardandoTarea.set(false);
          Swal.fire({ icon: 'error', title: 'Error', text: err?.message ?? 'No se pudo guardar la tarea' });
        }
      });
    } else {
      // Crear
      this.tareaService.addTarea({
        titulo: v.titulo,
        descripcion: v.descripcion || undefined,
        estadoId: +v.estadoId,
        semanaProgramada: toIso(v.semanaProgramada),
        fechaPresupuestoInicio: v.fechaPresupuestoInicio ? toIso(v.fechaPresupuestoInicio) : undefined,
        fechaPresupuestoFin: v.fechaPresupuestoFin ? toIso(v.fechaPresupuestoFin) : undefined,
        creadoPorId: this.usuarioId,
        usuariosAsignados: this.asignadosSeleccionados(),
      }).subscribe({
        next: nueva => {
          // Solo agregar a la lista si pertenece a la semana actual
          if (formatDate(new Date(nueva.semanaProgramada)) === formatDate(this.semanaActual())) {
            this.tareas.update(arr => [...arr, nueva]);
          }
          this.guardandoTarea.set(false);
          this.cerrarModalTarea();
          Swal.fire({ icon: 'success', title: 'Tarea creada', timer: 1500, showConfirmButton: false });
        },
        error: err => {
          this.guardandoTarea.set(false);
          Swal.fire({ icon: 'error', title: 'Error', text: err?.message ?? 'No se pudo crear la tarea' });
        }
      });
    }
  }

  eliminarTarea(t: Tarea, event: Event): void {
    event.stopPropagation();
    if (!this.puedeMover()) return; // Solo supervisores pueden eliminar
    Swal.fire({
      icon: 'warning',
      title: '¿Eliminar tarea?',
      text: `"${t.titulo}" y todo su historial serán eliminados permanentemente.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.tareaService.deleteTarea(t.id).subscribe({
        next: () => {
          this.tareas.update(arr => arr.filter(x => x.id !== t.id));
          if (this.tareaDetalle()?.id === t.id) this.cerrarPanel();
          Swal.fire({ icon: 'success', title: 'Tarea eliminada', timer: 1400, showConfirmButton: false });
        },
        error: err => Swal.fire({ icon: 'error', title: 'Error', text: err?.message })
      });
    });
  }

  // ── Panel de detalle ──────────────────────────────────────

  abrirDetalle(t: Tarea): void {
    this.tareaDetalle.set(null);
    this.tabDetalle.set('info');
    this.panelAbierto.set(true);
    this.tareaService.getTarea(t.id).subscribe({
      next: full => this.tareaDetalle.set(full),
      error: () => this.panelAbierto.set(false)
    });
  }

  cerrarPanel(): void {
    this.panelAbierto.set(false);
    this.tareaDetalle.set(null);
  }

  // ── Cambiar estado desde el panel ─────────────────────────

  cambiarEstadoDetalle(nuevoEstadoId: number): void {
    const t = this.tareaDetalle();
    if (!t || t.estadoId === nuevoEstadoId) return;

    const nuevoEstado = this.estados().find(e => e.id === nuevoEstadoId);

    // Bloquear estados finales si el usuario no tiene permiso de finalizar
    if (nuevoEstado?.esEstadoFinal && !this.puedeFinalizar()) {
      Swal.fire({
        icon: 'warning',
        title: 'Permiso insuficiente',
        text: 'Solo un supervisor puede marcar tareas como completadas.',
        timer: 2500,
        showConfirmButton: false
      });
      return;
    }

    // Si es estado final, pedir fecha real de completitud
    if (nuevoEstado?.esEstadoFinal) {
      const hoy = new Date().toISOString().split('T')[0];
      Swal.fire({
        title: '¿Cuándo se completó esta tarea?',
        input: 'date',
        inputValue: hoy,
        inputAttributes: { max: hoy },
        showCancelButton: true,
        confirmButtonColor: '#1e3a8a',
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
          if (!value) return 'Debes seleccionar una fecha';
          return null;
        }
      }).then(result => {
        if (!result.isConfirmed) return;
        this._ejecutarCambioEstado(t, nuevoEstadoId, toIso(result.value));
      });
    } else {
      this._ejecutarCambioEstado(t, nuevoEstadoId, undefined);
    }
  }

  _ejecutarCambioEstado(t: Tarea, nuevoEstadoId: number, fechaRealFinalizacion?: string): void {
    this.cambiandoEstado.set(true);
    this.tareaService.cambiarEstado(t.id, nuevoEstadoId, this.usuarioId, fechaRealFinalizacion).subscribe({
      next: updated => {
        const estado = this.estados().find(e => e.id === nuevoEstadoId);
        this.tareaDetalle.update(d => d ? {
          ...d,
          estadoId: nuevoEstadoId,
          estado: estado ?? d.estado,
          fechaRealFinalizacion: updated?.fechaRealFinalizacion ?? d.fechaRealFinalizacion
        } : d);
        this.tareas.update(arr => arr.map(x =>
          x.id === t.id ? { ...x, estadoId: nuevoEstadoId, estado: estado ?? x.estado } : x
        ));
        this.cambiandoEstado.set(false);
      },
      error: err => {
        // En drag & drop revertir el cambio optimista
        this.tareas.update(arr => arr.map(x =>
          x.id === t.id ? { ...x, estadoId: t.estadoId, estado: t.estado } : x
        ));
        this.cambiandoEstado.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: err?.message });
      }
    });
  }

  // ── Comentarios ───────────────────────────────────────────

  enviarComentario(): void {
    const texto = this.nuevoComentario().trim();
    const t = this.tareaDetalle();
    if (!texto || !t) return;
    this.guardandoComentario.set(true);
    this.tareaService.addComentario(t.id, this.usuarioId, texto).subscribe({
      next: c => {
        this.tareaDetalle.update(d => d ? { ...d, comentarios: [c, ...d.comentarios] } : d);
        this.nuevoComentario.set('');
        this.guardandoComentario.set(false);
      },
      error: err => {
        this.guardandoComentario.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: err?.message });
      }
    });
  }

  // ── Asignados en el panel ─────────────────────────────────

  asignarUsuarioEnDetalle(): void {
    const uid = this.usuarioAsignarId();
    const t = this.tareaDetalle();
    if (!uid || !t) return;
    const yaAsignado = t.asignados.some(a => a.usuarioId === uid);
    if (yaAsignado) {
      Swal.fire({ icon: 'info', title: 'Ya asignado', text: 'Ese usuario ya está asignado a esta tarea.', timer: 1500, showConfirmButton: false });
      return;
    }
    this.tareaService.asignarUsuario(t.id, uid, this.usuarioId).subscribe({
      next: updated => {
        this.tareaDetalle.update(d => d ? { ...d, asignados: updated.asignados } : d);
        this.tareas.update(arr => arr.map(x => x.id === t.id ? { ...x, asignados: updated.asignados } : x));
        this.usuarioAsignarId.set('');
      },
      error: err => Swal.fire({ icon: 'error', title: 'Error', text: err?.message })
    });
  }

  desasignarUsuarioEnDetalle(usuarioId: string): void {
    const t = this.tareaDetalle();
    if (!t) return;
    Swal.fire({
      icon: 'question',
      title: '¿Desasignar usuario?',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Desasignar',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.tareaService.desasignarUsuario(t.id, usuarioId).subscribe({
        next: () => {
          this.tareaDetalle.update(d => d ? { ...d, asignados: d.asignados.filter(a => a.usuarioId !== usuarioId) } : d);
          this.tareas.update(arr => arr.map(x =>
            x.id === t.id ? { ...x, asignados: x.asignados.filter(a => a.usuarioId !== usuarioId) } : x
          ));
        },
        error: err => Swal.fire({ icon: 'error', title: 'Error', text: err?.message })
      });
    });
  }

  // ── Mover semana ─────────────────────────────────────────

  abrirMoverSemana(t: Tarea, event?: Event): void {
    event?.stopPropagation();
    this.tareaAMover.set(t);
    this.motivoMover.set('');
    this.nuevaSemanaInput.set(formatDate(addWeeks(this.semanaActual(), 1)));
    this.modalMoverAbierto.set(true);
  }

  cerrarMoverSemana(): void {
    this.modalMoverAbierto.set(false);
    this.tareaAMover.set(null);
  }

  confirmarMoverSemana(): void {
    const t = this.tareaAMover();
    if (!t || !this.nuevaSemanaInput()) return;
    this.moviendoTarea.set(true);
    this.tareaService.moverSemana(t.id, toIso(this.nuevaSemanaInput()), this.usuarioId, this.motivoMover() || undefined).subscribe({
      next: () => {
        // Quitar la tarea de la semana actual
        this.tareas.update(arr => arr.filter(x => x.id !== t.id));
        if (this.tareaDetalle()?.id === t.id) this.cerrarPanel();
        this.moviendoTarea.set(false);
        this.cerrarMoverSemana();
        Swal.fire({ icon: 'success', title: 'Tarea movida', timer: 1500, showConfirmButton: false });
      },
      error: err => {
        this.moviendoTarea.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: err?.message });
      }
    });
  }

  // ── Notificaciones ────────────────────────────────────────

  cargarNotificaciones(): void {
    this.cargandoNotifs.set(true);
    this.notificacionService.getMisNotificaciones().subscribe({
      next: list => {
        this.cargandoNotifs.set(false);

        // Detectar si llegaron notificaciones nuevas desde el último poll
        const esPrimeraCarga = this.notifIdsAnteriores.size === 0;
        const hayNuevas = !esPrimeraCarga && list.some(n => !this.notifIdsAnteriores.has(n.id));

        this.notificaciones.set(list);
        this.notifIdsAnteriores = new Set(list.map(n => n.id));

        // Si hay notificaciones nuevas (creación o eliminación de tarea),
        // refrescar el kanban automáticamente para que refleje el estado real.
        if (hayNuevas) {
          this.cargarTareas();
        }
      },
      error: () => { this.cargandoNotifs.set(false); }
    });
  }

  toggleNotificaciones(): void {
    const abrir = !this.notifAbiertas();
    this.notifAbiertas.set(abrir);
    if (abrir) this.cargarNotificaciones();
  }

  marcarLeida(n: NotificacionDto, event: Event): void {
    event.stopPropagation();
    if (n.leida) return;
    this.notificacionService.marcarLeida(n.id).subscribe({
      next: () => {
        this.notificaciones.update(arr =>
          arr.map(x => x.id === n.id ? { ...x, leida: true } : x)
        );
      },
      error: () => {}
    });
  }

  marcarTodasLeidas(): void {
    this.notificacionService.marcarTodasLeidas().subscribe({
      next: () => {
        this.notificaciones.update(arr => arr.map(x => ({ ...x, leida: true })));
      },
      error: () => {}
    });
  }

  abrirTareaDesdNotif(n: NotificacionDto): void {
    this.notifAbiertas.set(false);

    // Marcar como leída siempre (incluso notificaciones de eliminación sin entidadId)
    if (!n.leida) {
      this.notificacionService.marcarLeida(n.id).subscribe();
      this.notificaciones.update(arr =>
        arr.map(x => x.id === n.id ? { ...x, leida: true } : x)
      );
    }

    // Notificaciones de eliminación no tienen tarea asociada → sólo marcar leída
    if (!n.entidadId) return;

    this.tareaService.getTarea(String(n.entidadId)).subscribe({
      next: t => {
        if (t) {
          // Recargar el tablero de la semana actualmente visible
          // (semanaActual NO se modifica, así se evita cargar la semana incorrecta)
          this.cargarTareas();
          // Abrir panel de detalle
          this.tareaDetalle.set(null);
          this.tabDetalle.set('info');
          this.panelAbierto.set(true);
          this.tareaDetalle.set(t);
        }
      },
      error: () => {}
    });
  }

  eliminarNotificacion(n: NotificacionDto, event: Event): void {
    event.stopPropagation();
    this.notificacionService.eliminarNotificacion(n.id).subscribe({
      next: ok => {
        if (ok) this.notificaciones.update(arr => arr.filter(x => x.id !== n.id));
      },
      error: () => {}
    });
  }

  eliminarTodasLeidas(): void {
    this.notificacionService.eliminarNotificacionesLeidas().subscribe({
      next: ok => {
        if (ok) this.notificaciones.update(arr => arr.filter(x => !x.leida));
      },
      error: () => {}
    });
  }

  // ── Admin de Estados ──────────────────────────────────────

  abrirNuevoEstado(): void {
    this.estadoEditando.set(null);
    this.estadoForm.reset({ color: '#1e3a8a', orden: this.todosEstados().length, esEstadoInicial: false, esEstadoFinal: false });
    this.modalEstadoAbierto.set(true);
  }

  abrirEditarEstado(e: EstadoTarea): void {
    this.estadoEditando.set(e);
    this.estadoForm.patchValue({ nombre: e.nombre, color: e.color, orden: e.orden, esEstadoInicial: e.esEstadoInicial, esEstadoFinal: e.esEstadoFinal });
    this.modalEstadoAbierto.set(true);
  }

  cerrarModalEstado(): void {
    this.modalEstadoAbierto.set(false);
  }

  guardarEstado(): void {
    if (this.estadoForm.invalid) return;
    this.guardandoEstado.set(true);
    const v = this.estadoForm.value;
    const obs = this.estadoEditando()
      ? this.tareaService.updateEstado(this.estadoEditando()!.id, v)
      : this.tareaService.addEstado(v);

    obs.subscribe({
      next: estado => {
        if (this.estadoEditando()) {
          this.todosEstados.update(arr => arr.map(e => e.id === estado.id ? estado : e));
          this.estados.update(arr => arr.map(e => e.id === estado.id ? estado : e));
        } else {
          this.todosEstados.update(arr => [...arr, estado]);
          if (estado.activo) this.estados.update(arr => [...arr, estado]);
        }
        this.guardandoEstado.set(false);
        this.cerrarModalEstado();
        Swal.fire({ icon: 'success', title: 'Estado guardado', timer: 1400, showConfirmButton: false });
      },
      error: err => {
        this.guardandoEstado.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: err?.message });
      }
    });
  }

  toggleActivoEstado(e: EstadoTarea): void {
    const accion = e.activo ? 'desactivar' : 'activar';
    Swal.fire({
      icon: 'question',
      title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el estado "${e.nombre}"?`,
      showCancelButton: true,
      confirmButtonText: accion.charAt(0).toUpperCase() + accion.slice(1),
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.tareaService.toggleEstado(e.id).subscribe({
        next: () => {
          const actualizado = { ...e, activo: !e.activo };
          this.todosEstados.update(arr => arr.map(x => x.id === e.id ? actualizado : x));
          if (actualizado.activo) {
            this.estados.update(arr => [...arr, actualizado].sort((a, b) => a.orden - b.orden));
          } else {
            this.estados.update(arr => arr.filter(x => x.id !== e.id));
          }
        },
        error: err => Swal.fire({ icon: 'error', title: 'Error', text: err?.message })
      });
    });
  }

  // ── Cumplimiento por persona ──────────────────────────────

  cargarCumplimiento(): void {
    this.cargandoCumplimiento.set(true);
    this.mostrarFiltroPersonas.set(false);
    const desde = new Date(this.filtroDesde() + 'T00:00:00.000Z');
    const hasta  = new Date(this.filtroHasta() + 'T00:00:00.000Z');
    this.tareaService.getCumplimientoPersonas(desde, hasta).subscribe({
      next: data => { this.cumplimientoData.set(data); this.cargandoCumplimiento.set(false); },
      error: () => { this.cargandoCumplimiento.set(false); }
    });
  }

  setPeriodoRapido(p: 'semana' | 'semana_ant' | 'mes' | 'personalizado'): void {
    this.periodoRapido.set(p);
    const hoy = new Date();
    if (p === 'semana') {
      this.filtroDesde.set(formatDate(lunesDe(hoy)));
      this.filtroHasta.set(formatDate(domingoSemana(hoy)));
    } else if (p === 'semana_ant') {
      const lunAnt = addWeeks(lunesDe(hoy), -1);
      this.filtroDesde.set(formatDate(lunAnt));
      this.filtroHasta.set(formatDate(domingoSemana(lunAnt)));
    } else if (p === 'mes') {
      this.filtroDesde.set(formatDate(primerDiaMes(hoy)));
      this.filtroHasta.set(formatDate(ultimoDiaMes(hoy)));
    }
    if (p !== 'personalizado') this.cargarCumplimiento();
  }

  togglePersonaExpandida(id: string): void {
    this.personaExpandida.set(this.personaExpandida() === id ? null : id);
  }

  toggleFiltroPersona(id: string): void {
    const ids = this.filtroPersonaIds();
    this.filtroPersonaIds.set(
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  toggleFiltroPersonas(): void {
    this.mostrarFiltroPersonas.set(!this.mostrarFiltroPersonas());
  }

  colorCumplimiento(pct: number): string {
    if (pct >= 80) return '#16a34a';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  }

  exportarCumplimientoCSV(): void {
    const data = this.cumplimientoFiltrado();
    let csv = '﻿';
    csv += `Reporte de Cumplimiento por Persona\n`;
    csv += `Período;${this.filtroDesde()} al ${this.filtroHasta()}\n\n`;
    csv += `Persona;Total;Completadas;Pendientes;Vencidas;Movidas;% Cumplimiento\n`;
    data.forEach(p => {
      csv += `"${p.nombre}";${p.total};${p.completadas};${p.pendientes};${p.vencidas};${p.movidas};${p.porcentajeCumplimiento}%\n`;
      csv += `;;Tarea;Estado;Semana;Vence;Veces movida\n`;
      p.tareas.forEach(t => {
        csv += `;;;"${t.titulo}";"${t.estadoNombre}";"${new Date(t.semanaProgramada).toLocaleDateString('es-CO')}";"${t.fechaPresupuestoFin ? new Date(t.fechaPresupuestoFin).toLocaleDateString('es-CO') : ''}";${t.vecesMovida}\n`;
      });
      csv += '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `cumplimiento-${this.filtroDesde()}-${this.filtroHasta()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Exportación ───────────────────────────────────────────

  exportarPDF(): void {
    window.print();
  }

  exportarExcel(): void {
    const r = this.reporte();
    if (!r) return;

    let csv = `Reporte Semanal de Cumplimiento\n`;
    csv += `Semana;${new Date(r.semana).toLocaleDateString('es-CO')}\n`;
    csv += `Total Tareas;${r.totalTareas}\n`;
    csv += `Completadas;${r.completadas}\n`;
    csv += `Vencidas;${r.vencidas}\n`;
    csv += `Movidas;${r.movidas}\n`;
    csv += `% Cumplimiento;${r.porcentajeCumplimiento}%\n\n`;

    csv += `TAREAS VENCIDAS\n`;
    csv += `Titulo;Estado;Fecha Límite;Veces Movida;Responsables\n`;
    r.tareasVencidas.forEach(t => {
      csv += `"${t.titulo}";"${t.estadoNombre}";"${t.fechaPresupuestoFin ? new Date(t.fechaPresupuestoFin).toLocaleDateString('es-CO') : ''}";"${t.vecesMovida}";"${t.asignados.join(', ')}"\n`;
    });

    csv += `\nTAREAS MOVIDAS VARIAS VECES\n`;
    csv += `Titulo;Estado;Fecha Límite;Veces Movida;Responsables\n`;
    r.tareasMovidasMultiple.forEach(t => {
      csv += `"${t.titulo}";"${t.estadoNombre}";"${t.fechaPresupuestoFin ? new Date(t.fechaPresupuestoFin).toLocaleDateString('es-CO') : ''}";"${t.vecesMovida}";"${t.asignados.join(', ')}"\n`;
    });

    const BOM = '﻿';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-tareas-${formatDate(this.semanaActual())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
