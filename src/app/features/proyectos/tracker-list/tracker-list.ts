import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { TrackerService } from '../../../core/services/tracker';
import { AuthService } from '../../../core/auth/auth.service';
import Swal from 'sweetalert2';
import { CurrencyMaskDirective } from '../../../core/directives/currency-mask';
import { Observable, map, forkJoin } from 'rxjs';

@Component({
  selector: 'app-tracker-list',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, TitleCasePipe, ReactiveFormsModule, FormsModule, CurrencyMaskDirective],
  templateUrl: './tracker-list.html'
})
export class TrackerListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private trackerService = inject(TrackerService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  // Señales de la tabla
  public lineaActiva = signal<string>('');
  public mostrarFinalizados = signal<boolean>(false);
  public modalAnticipoDirectoAbierto = signal<boolean>(false);
  public contratistaSeleccionadoOT = signal<any | null>(null);
  public proyectoParaAnticipo = signal<any | null>(null);
  public anticipoDirectoForm!: FormGroup;
  public anticiposDirectos = signal<any[]>([]);
  public configVisual = signal<any>({});
  public proyectos = signal<any[]>([]);
  public cargando = signal<boolean>(true);

  // Señales y variables del Modal
  public modalAbierto = signal<boolean>(false);
  public guardando = signal<boolean>(false);
  public listasFormulario = signal<{clientes: any[], usuarios: any[], contratistas: any[]}>({ clientes: [], usuarios: [], contratistas: [] });
  public proyectoForm!: FormGroup;
  public panelAbierto = signal<boolean>(false);
  public proyectoSeleccionado = signal<any>(null);
  public modalOTAbierto = signal<boolean>(false);
  public guardandoOT = signal<boolean>(false);
  public otForm!: FormGroup;
  public modalAnticipoAbierto = signal<boolean>(false);
  public guardandoAnticipo = signal<boolean>(false);
  public anticipoForm!: FormGroup;
  public otSeleccionadaParaAnticipo = signal<any>(null);

  // --- VARIABLES PARA PAGO DE ANTICIPO (ERP) ---
  public modalPagoAbierto = signal<boolean>(false);
  public guardandoPago = signal<boolean>(false);
  public pagoForm!: FormGroup;
  public anticipoSeleccionado = signal<any>(null);

  // --- VARIABLES PARA REQUISICIONES ---
  public modalReqAbierto = signal<boolean>(false);
  public guardandoReq = signal<boolean>(false);
  public reqForm!: FormGroup;

  public modalActualizarAbierto = signal<boolean>(false);
  public actualizando = signal<boolean>(false);
  public actualizarForm!: FormGroup;

  public vistaPanel = signal<'resumen' | 'resumen_general' | 'detalles' | 'bitacora' | 'compras'>('resumen');
  public nuevaObservacion = signal<string>('');
  public guardandoObs = signal<boolean>(false);
  public esAdminFase = signal<boolean>(false);
  public requisiciones = signal<any[]>([]);
  public ordenesTrabajo = signal<any[]>([]);
  public cargandoSubFlujos = signal<boolean>(false);

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

  public kpiOC = computed(() =>
    this.proyectos().filter(p => this.obtenerAlertaOC(p).estado === 'sin_oc').length
  );

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
    this.inicializarFormulario();

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

      this.lineaActiva.set(linea);
      this.configVisual.set(this.temas[linea] || this.temas['civiles']);
      this.cargarProyectos(linea);
      this.cargarDatosFormulario();
    });
  }

  // --- FUNCIONES MATEMÁTICAS PARA LAS ALERTAS ---
  // Retorna el nombre del ejecutor desde la primera OT activa del proyecto
  obtenerEjecutorDesdeOT(p: any): string | null {
    const ots = p.ordenesTrabajo || this.ordenesTrabajo() || [];
    if (!ots.length) return null;
    const ot = ots[0];
    if (ot.tecnicoInterno?.nombre) return ot.tecnicoInterno.nombre;
    if (ot.contratistaNombre) return ot.contratistaNombre;
    return null;
  }

  obtenerSLA(p: any): string {
    const respuesta = p.fechaRespuestaCliente || this.actualizarForm?.get('fechaRespuestaCliente')?.value;
    const dias = this.calcularDiasDiferencia(p.fechaAsignacion, respuesta);
    if (dias === null) return '—';
    if (dias <= 1) return `${dias} día ✓`;
    if (dias <= 2) return `${dias} días ⚠`;
    return `${dias} días ✗`;
  }

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

  obtenerAlertaOC(p: any) {
    if (p.fechaInicioActividades) {
      if (p.numeroOC && p.numeroOC.trim() !== '') {
        return { texto: 'Inicio Normal', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', estado: 'normal' };
      } else {
        return { texto: '¡INICIO SIN OC!', badge: 'bg-red-100 text-red-800 font-black border-red-300 shadow-sm', estado: 'sin_oc' };
      }
    }
    return { texto: 'Pendiente', badge: 'bg-slate-100 text-slate-500 border-slate-200', estado: 'pendiente' };
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
      this.vistaPanel.set('resumen');
      this.panelAbierto.set(true);

      this.cargarFormularioPanel();
      this.cargarSubFlujos(proyecto.id);
  }

  cerrarPanel() {
    this.panelAbierto.set(false);
    setTimeout(() => this.proyectoSeleccionado.set(null), 300);
  }

  // --- MÉTODOS DE DATOS ---
  get esGerente(): boolean {
    return this.authService.hasPermission('proyectos.editar');
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

  cargarSubFlujos(proyectoId: string) {
    this.cargandoSubFlujos.set(true);

    forkJoin({
      reqs: this.trackerService.getRequisicionesPorProyecto(proyectoId),
      ots: this.trackerService.getOrdenesTrabajoPorProyecto(proyectoId)
    }).subscribe({
      next: (data) => {
        this.requisiciones.set(data.reqs);
        this.ordenesTrabajo.set(data.ots);
        this.cargandoSubFlujos.set(false);
      },
      error: (err) => {
        console.error('Error al cargar sub-flujos', err);
        this.cargandoSubFlujos.set(false);
      }
    });
  }

  cargarDatosFormulario() {
    this.trackerService.getDatosParaFormulario().subscribe(datos => {
      this.listasFormulario.set(datos);
    });
  }

  enviarObservacion() {
    const texto = this.nuevaObservacion().trim();
    if (!texto) return;

    const proyecto = this.proyectoSeleccionado();
    const usuario = this.authService.usuarioActual();

    if (!proyecto || !usuario?.id) {
      Swal.fire('Error', 'No se pudo identificar tu usuario. Cierra sesión y vuelve a entrar.', 'error');
      return;
    }

    this.guardandoObs.set(true);

    this.trackerService.agregarObservacion(proyecto.id, usuario.id, texto).subscribe({
      next: (nuevaObs) => {
        const observacionesActualizadas = [nuevaObs, ...(proyecto.observaciones || [])];
        const proyectoActualizado = { ...proyecto, observaciones: observacionesActualizadas };

        this.proyectoSeleccionado.set(proyectoActualizado);
        this.proyectos.update(lista =>
          lista.map(p => p.id === proyecto.id ? proyectoActualizado : p)
        );

        this.nuevaObservacion.set('');
        this.guardandoObs.set(false);
      },
      error: (err) => {
        console.error(err);
        this.guardandoObs.set(false);
        Swal.fire('Error', 'No se pudo guardar la observación.', 'error');
      }
    });
  }

  // --- MÉTODOS DEL MODAL ---
  inicializarFormulario() {
    this.proyectoForm = this.fb.group({
      codigo: ['', Validators.required],
      nombre: ['', Validators.required],
      clienteId: ['', Validators.required],
      supervisorCliente: [''],
      responsableId: [''],
      valorOC: [0, [Validators.required, Validators.min(0)]],
      fechaAsignacion: [this.formatToDateInput(new Date().toISOString())],
      fechaRespuestaCliente: [null]
    });

    this.otForm = this.fb.group({
      consecutivo: ['', Validators.required],
      contratistaId: [''],       // Selector del módulo de Contratistas
      contratistaNombre: [''],   // Se rellena automáticamente al seleccionar
      contratistaNit: [''],      // Se rellena automáticamente al seleccionar
      tecnicoInternoId: [''],
      valorTotal: [0, Validators.min(0)],
      alcanceServicio: ['', Validators.required]
    });

    this.anticipoForm = this.fb.group({
      valorAnticipo: [0, [Validators.required, Validators.min(1)]]
    });

    this.pagoForm = this.fb.group({
      idEgresoWorldOffice: ['', Validators.required]
    });

    this.anticipoDirectoForm = this.fb.group({
      valorAnticipo: [0, [Validators.required, Validators.min(1)]],
      concepto:      ['', Validators.required],
      beneficiario:  [''],
      observaciones: ['']
    });

    this.reqForm = this.fb.group({
      consecutivo: ['', Validators.required],

      observaciones: ['', Validators.required]
    });
  }

  abrirModal() {
    this.proyectoForm.reset({ valorOC: 0 });
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
  }

  guardarProyecto() {
    if (this.proyectoForm.invalid) {
      this.proyectoForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);

    const inputData = {
      ...this.proyectoForm.value,
      fechaAsignacion: this.proyectoForm.get('fechaAsignacion')?.value
        ? new Date(this.proyectoForm.get('fechaAsignacion')?.value + 'T00:00:00Z').toISOString()
        : new Date().toISOString(),
      fechaRespuestaCliente: this.proyectoForm.get('fechaRespuestaCliente')?.value
        ? new Date(this.proyectoForm.get('fechaRespuestaCliente')?.value + 'T00:00:00Z').toISOString()
        : null,
      lineaNegocio: this.lineaActiva()
    };

    this.trackerService.crearProyecto(inputData).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModal();
        Swal.fire({ icon: 'success', title: '¡Proyecto Creado!', text: 'El proyecto ya está en el Tracker.', confirmButtonColor: '#1e3a8a', timer: 2000 });
        this.cargarProyectos(this.lineaActiva());
      },
      error: (err) => {
        this.guardando.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Hubo un problema al crear el proyecto.' });
        console.error(err);
      }
    });
  }

  hoy(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatToDateInput(dateString: string | null | undefined): string {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  }

  cargarFormularioPanel() {
    const p = this.proyectoSeleccionado();
    if (!p) return;

    this.actualizarForm = this.fb.group({
      nombre: [p.nombre, Validators.required],
      responsableId: [p.responsable?.id || ''],
      supervisorCliente: [p.supervisorCliente || ''],
      contratista: [p.contratista || ''],
      ejecutorInternoId: [p.ejecutorInterno?.id || p.ejecutorInternoId || ''],
      polizas: [p.polizas || ''],
      centroDeCostos: [p.centroDeCostos || ''],
      numeroOC: [p.numeroOC || ''],
      valorOC: [p.valorOC || 0, [Validators.required, Validators.min(0)]],
      valorFacturado: [p.valorFacturado || 0, Validators.min(0)],
      valorGasto: [p.valorGasto || 0, Validators.min(0)],
      costoRealTotal: [p.costoRealTotal || 0, Validators.min(0)],
      fechaRespuestaCliente: [this.formatToDateInput(p.fechaRespuestaCliente)],
      requierePermisos: [!!p.fechaSolicitudPermisos],
      sinOcAun: [p.numeroOC?.toUpperCase() === 'PENDIENTE'],
      fechaSolicitudPermisos: [this.formatToDateInput(p.fechaSolicitudPermisos)],
      fechaVisitaTecnica: [this.formatToDateInput(p.fechaVisitaTecnica)],
      fechaEnvioPermiso: [this.formatToDateInput(p.fechaEnvioPermiso)],
      fechaAprobacionPermisos: [this.formatToDateInput(p.fechaAprobacionPermisos)],
      fechaEnvioPresupuesto: [this.formatToDateInput(p.fechaEnvioPresupuesto)],
      fechaAprobacionPresupuesto: [this.formatToDateInput(p.fechaAprobacionPresupuesto)],
      fechaInicioActividades: [this.formatToDateInput(p.fechaInicioActividades)],
      fechaTentativaFin: [this.formatToDateInput(p.fechaTentativaFin)],
      fechaFinalizacionActividades: [this.formatToDateInput(p.fechaFinalizacionActividades)],
      cierreTecnicoAprobado: [p.cierreTecnicoAprobado || false],
      dossierEntregado: [p.dossierEntregado || false],
      liquidacionTerminada: [p.liquidacionTerminada || false],
      facturacionCompletada: [p.facturacionCompletada || false]
    });

    const esSuperAdmin = this.authService.hasPermission('proyectos.editar');
    const esAdminFase = this.authService.hasPermission('proyectos.fase.administrativa') || esSuperAdmin;
    const esOperativoFase = this.authService.hasPermission('proyectos.fase.operativa') || esSuperAdmin;

    // ==========================================
    // CANDADO MAESTRO (Modo Solo Lectura)
    // ==========================================
    const estaCerrado = p.estado === 'FINALIZADO_TOTAL' || p.estado === 'Cancelado' || p.estado === 'Incumplimiento';

    if (estaCerrado) {
      // Bloquea absolutamente todo el formulario
      this.actualizarForm.disable();
    } else {
      // Bloqueos regulares de operación normal basados en permisos
      if (!esAdminFase) {
        const camposAdmin = [
          'numeroOC', 'valorOC', 'valorFacturado',
          'contratista', 'ejecutorInternoId', 'polizas', 'centroDeCostos',
          'cierreTecnicoAprobado', 'dossierEntregado', 'liquidacionTerminada', 'facturacionCompletada'
        ];
        camposAdmin.forEach(c => this.actualizarForm.get(c)?.disable());
      }

      if (!esOperativoFase) {
        const camposOperativos = [
          'fechaRespuestaCliente', 'fechaSolicitudPermisos', 'fechaVisitaTecnica', 'fechaEnvioPermiso',
          'fechaAprobacionPermisos', 'fechaEnvioPresupuesto', 'fechaAprobacionPresupuesto',
          'fechaInicioActividades', 'fechaTentativaFin', 'fechaFinalizacionActividades'
        ];
        camposOperativos.forEach(c => this.actualizarForm.get(c)?.disable());
      }

      // IMPORTANTE: Estos dos SIEMPRE se bloquean en edición porque los calcula el backend
      this.actualizarForm.get('valorGasto')?.disable();
      this.actualizarForm.get('costoRealTotal')?.disable();
    }
  }

  cerrarModalActualizar() {
    this.modalActualizarAbierto.set(false);
  }

  guardarActualizacion() {
    if (this.actualizarForm.invalid) {
      this.actualizarForm.markAllAsTouched();
      return;
    }

    const p = this.proyectoSeleccionado();
    this.actualizando.set(true);

    const dataCruda = this.actualizarForm.getRawValue();
    const inputLimpio: any = {};

    // Campos solo locales — no existen en ProyectoUpdateInput
    const camposLocales = ['requierePermisos', 'sinOcAun'];

    for (const key in dataCruda) {
      if (camposLocales.includes(key)) continue;
      const valor = dataCruda[key];
      if (valor === '' || valor === null) {
        inputLimpio[key] = null;
      }
      else if (key.startsWith('fecha') && typeof valor === 'string' && valor.length === 10) {
        inputLimpio[key] = `${valor}T00:00:00.000Z`;
      }
      else {
        inputLimpio[key] = valor;
      }
    }

    this.trackerService.actualizarProyecto(p.id, inputLimpio).subscribe({
      next: (resultado) => {
        this.actualizando.set(false);

        Swal.fire({
          icon: 'success',
          title: 'Tracker Actualizado',
          text: 'El estado y las fechas se actualizaron correctamente.',
          confirmButtonColor: '#1e3a8a',
          timer: 2000
        });

        this.cargarProyectos(this.lineaActiva());
        this.proyectoSeleccionado.set({ ...p, ...resultado });

        // Volvemos a evaluar el formulario por si cambió de estado a FINALIZADO
        this.cargarFormularioPanel();
      },
      error: (err) => {
        this.actualizando.set(false);
        console.error('Error completo:', err);

        let mensajeServidor = '';

        if (err.graphQLErrors && err.graphQLErrors.length > 0) {
          mensajeServidor = err.graphQLErrors[0].message;
        } else if (err.message) {
          mensajeServidor = err.message;
        }

        const errorStr = JSON.stringify(err).toLowerCase();

        if (errorStr.includes('not authorized') || errorStr.includes('permission')) {
          Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'No tienes permisos para modificar estos campos.',
            confirmButtonColor: '#ef4444'
          });
        }
        else if (mensajeServidor) {
          Swal.fire({
            icon: 'warning',
            title: 'Validación de Auditoría',
            text: mensajeServidor,
            confirmButtonColor: '#f59e0b'
          });
        }
        else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo actualizar el Tracker. Por favor, intenta de nuevo.',
            confirmButtonColor: '#ef4444'
          });
        }
      }
    });
  }

  // ==========================================
  // MÉTODOS DEL MODAL OT
  // ==========================================
  abrirModalOT() {
    this.otForm.reset({ valorTotal: 0 });
    this.contratistaSeleccionadoOT.set(null);
    // Cargar sub-flujos si no están cargados aún (cuando se abre desde la tabla sin panel)
    const p = this.proyectoSeleccionado();
    if (p && this.ordenesTrabajo().length === 0) {
      this.trackerService.getOrdenesTrabajoPorProyecto(p.id).subscribe(ots => this.ordenesTrabajo.set(ots));
    }
    this.modalOTAbierto.set(true);
  }

  onContratistaIdChange(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.contratistaSeleccionadoOT.set(null);
      this.otForm.get('contratistaNombre')?.setValue('');
      this.otForm.get('contratistaNit')?.setValue('');
      return;
    }
    const lista = this.listasFormulario().contratistas || [];
    const c = lista.find((x: any) => x.id === id);
    if (c) {
      this.contratistaSeleccionadoOT.set(c);
      const nombre = c.razonSocial || c.nombreCompleto || '';
      const nit = c.nit || c.numeroDocumento || '';
      this.otForm.get('contratistaNombre')?.setValue(nombre);
      this.otForm.get('contratistaNit')?.setValue(nit);
      // Limpiar técnico interno
      this.otForm.get('tecnicoInternoId')?.setValue('');
    }
  }

  // Exclusión mutua: al seleccionar técnico interno, limpia contratista y viceversa
  onTecnicoInternoChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    if (val) {
      this.otForm.get('contratistaNombre')?.setValue('');
      this.otForm.get('contratistaNit')?.setValue('');
    }
  }

  onContratistaNombreChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    if (val.trim()) {
      this.otForm.get('tecnicoInternoId')?.setValue('');
    }
  }

  cerrarModalOT() {
    this.modalOTAbierto.set(false);
  }

  guardarOT() {
    if (this.otForm.invalid) {
      this.otForm.markAllAsTouched();
      return;
    }

    const p = this.proyectoSeleccionado();
    const usuario = this.authService.usuarioActual();
    if (!p || !usuario?.id) return;

    const esTecnicoInterno = !!this.otForm.get('tecnicoInternoId')?.value;
    const esContratista = !!this.otForm.get('contratistaNombre')?.value?.trim();
    const valorTotal = this.otForm.get('valorTotal')?.value || 0;

    // Validación ejecutor: debe tener uno
    if (!esTecnicoInterno && !esContratista) {
      Swal.fire('Falta el ejecutor', 'Debes asignar un Técnico Interno o un Contratista Externo.', 'warning');
      return;
    }

    // Valor obligatorio solo para contratistas externos
    if (esContratista && valorTotal <= 0) {
      Swal.fire('Valor requerido', 'El Valor Total de la OT es obligatorio para contratistas externos.', 'warning');
      return;
    }

    this.guardandoOT.set(true);

    const { contratistaId, ...otFormValues } = this.otForm.value;

    const inputData = {
      proyectoId: p.id,
      creadorId: usuario.id,
      ...otFormValues,
      // HotChocolate exige null para UUID opcionales, no string vacío
      tecnicoInternoId: otFormValues.tecnicoInternoId || null,
      contratistaNombre: otFormValues.contratistaNombre || null,
      contratistaNit: otFormValues.contratistaNit || null,
    };

    this.trackerService.crearOrdenTrabajo(inputData).subscribe({
      next: (nuevaOt) => {
        this.guardandoOT.set(false);
        this.cerrarModalOT();

        Swal.fire({
          icon: 'success',
          title: 'OT Emitida',
          text: `La orden de trabajo ${nuevaOt.consecutivo} se creó correctamente.`,
          confirmButtonColor: '#10b981',
          timer: 2500
        });

        this.ordenesTrabajo.update(ots => [nuevaOt, ...ots]);
        // Actualizar contador en la tabla de proyectos
        this.proyectos.update(ps => ps.map(proj =>
          proj.id === p.id
            ? { ...proj, ordenesTrabajo: [nuevaOt, ...(proj.ordenesTrabajo || [])] }
            : proj
        ));
      },
      error: (err) => {
        this.guardandoOT.set(false);
        console.error(err);
        Swal.fire('Error', 'No se pudo emitir la Orden de Trabajo.', 'error');
      }
    });
  }

  // ==========================================
  // MÉTODOS DEL MODAL ANTICIPOS
  // ==========================================
  abrirModalAnticipo(ot: any) {
    this.otSeleccionadaParaAnticipo.set(ot);
    this.anticipoForm.reset({ valorAnticipo: 0 });
    this.modalAnticipoAbierto.set(true);
  }

  cerrarModalAnticipo() {
    this.modalAnticipoAbierto.set(false);
    setTimeout(() => this.otSeleccionadaParaAnticipo.set(null), 300);
  }

  guardarAnticipo() {
    if (this.anticipoForm.invalid) {
      this.anticipoForm.markAllAsTouched();
      return;
    }

    const p = this.proyectoSeleccionado();
    const ot = this.otSeleccionadaParaAnticipo();
    const usuario = this.authService.usuarioActual();

    if (!p || !ot || !usuario?.id) return;

    this.guardandoAnticipo.set(true);

    const inputData = {
      proyectoId: p.id,
      ordenTrabajoId: ot.id,
      solicitanteId: usuario.id,
      valorAnticipo: this.anticipoForm.get('valorAnticipo')?.value
    };

    this.trackerService.solicitarAnticipo(inputData).subscribe({
      next: (nuevoAnticipo) => {
        this.guardandoAnticipo.set(false);
        this.cerrarModalAnticipo();

        Swal.fire({
          icon: 'success',
          title: 'Anticipo Solicitado',
          text: 'La solicitud ha sido enviada para aprobación.',
          confirmButtonColor: '#10b981',
          timer: 2000
        });

        this.cargarSubFlujos(p.id);
      },
      error: (err) => {
        this.guardandoAnticipo.set(false);

        let mensajeError = 'No se pudo solicitar el anticipo.';
        if (err.graphQLErrors && err.graphQLErrors.length > 0) {
          mensajeError = err.graphQLErrors[0].message;
        }

        Swal.fire({ icon: 'error', title: 'Alerta Financiera', text: mensajeError });
      }
    });
  }

  // ==========================================
  // MÉTODOS DEL MODAL DE PAGO (WORLDOFFICE)
  // ==========================================
  abrirModalPago(anticipo: any) {
    this.anticipoSeleccionado.set(anticipo);
    this.pagoForm.reset();
    this.modalPagoAbierto.set(true);
  }

  cerrarModalPago() {
    this.modalPagoAbierto.set(false);
    setTimeout(() => this.anticipoSeleccionado.set(null), 300);
  }

  guardarPago() {
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      return;
    }

    const ant = this.anticipoSeleccionado();
    const p = this.proyectoSeleccionado();

    if (!ant || !p) return;

    this.guardandoPago.set(true);
    const idEgreso = this.pagoForm.get('idEgresoWorldOffice')?.value;

    this.trackerService.pagarAnticipo(ant.id, idEgreso).subscribe({
      next: () => {
        this.guardandoPago.set(false);
        this.cerrarModalPago();

        Swal.fire({
          icon: 'success',
          title: 'Pago Registrado',
          text: 'El anticipo quedó vinculado a WorldOffice y marcado como PAGADO.',
          confirmButtonColor: '#10b981',
          timer: 2500
        });

        this.cargarSubFlujos(p.id);
      },
      error: (err) => {
        this.guardandoPago.set(false);
        console.error(err);
        Swal.fire('Error', 'No se pudo registrar el pago. Asegúrate de tener permisos administrativos.', 'error');
      }
    });
  }

  // ==========================================
  // MÉTODOS DEL MODAL REQUISICIONES
  // ==========================================
  abrirModalReq() {
    this.reqForm.reset();
    // Cargar sub-flujos si no están cargados aún (cuando se abre desde la tabla sin panel)
    const p = this.proyectoSeleccionado();
    if (p && this.requisiciones().length === 0) {
      this.trackerService.getRequisicionesPorProyecto(p.id).subscribe(reqs => this.requisiciones.set(reqs));
    }
    this.modalReqAbierto.set(true);
  }

  cerrarModalReq() {
    this.modalReqAbierto.set(false);
  }

  guardarReq() {
    if (this.reqForm.invalid) {
      this.reqForm.markAllAsTouched();
      return;
    }

    const p = this.proyectoSeleccionado();
    const usuario = this.authService.usuarioActual();

    if (!p || !usuario?.id) return;

    this.guardandoReq.set(true);

    const inputData = {
      proyectoId: p.id,
      solicitanteId: usuario.id,
      ...this.reqForm.value
    };

    this.trackerService.crearRequisicion(inputData).subscribe({
      next: (nuevaReq) => {
        this.guardandoReq.set(false);
        this.cerrarModalReq();

        Swal.fire({
          icon: 'success',
          title: 'Requisición Creada',
          text: `La solicitud ${nuevaReq.consecutivo} ha sido enviada para aprobación.`,
          confirmButtonColor: '#2563eb',
          timer: 2500
        });

        this.requisiciones.update(reqs => [nuevaReq, ...reqs]);
        // Actualizar contador en la tabla de proyectos
        const pReq = this.proyectoSeleccionado();
        if (pReq) {
          this.proyectos.update(ps => ps.map(proj =>
            proj.id === pReq.id
              ? { ...proj, requisiciones: [nuevaReq, ...(proj.requisiciones || [])] }
              : proj
          ));
        }
      },
      error: (err) => {
        this.guardandoReq.set(false);
        console.error(err);
        Swal.fire('Error', 'No se pudo crear la requisición.', 'error');
      }
    });
  }

  aprobarReq(req: any) {
    const usuario = this.authService.usuarioActual();
    if (!usuario?.id) return;

    Swal.fire({
      title: '¿Aprobar Requisición?',
      text: `¿Confirmas la requisición ${req.consecutivo}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Sí, Aprobar'
    }).then((result) => {
      if (result.isConfirmed) {

        Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        this.trackerService.aprobarRequisicion(req.id, usuario.id).subscribe({
          next: (res) => {
            Swal.fire({
              icon: 'success',
              title: res.estado === 'En Compras' ? '✓ Aprobada — En Compras' : '✓ Aprobada — Pendiente Gerencia',
              text: res.estado === 'En Compras'
                ? 'La requisición fue aprobada y pasó a Coordinación de Compras.'
                : 'El valor supera $1.000.000. Se notificó a Gerencia para su aprobación final.',
              timer: 3000
            });

            const p = this.proyectoSeleccionado();
            if (p) this.cargarSubFlujos(p.id);
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Error', 'No se pudo aprobar la requisición.', 'error');
          }
        });
      }
    });
  }

  comprarReq(req: any) {
    const usuario = this.authService.usuarioActual();
    if (!usuario) return;

    Swal.fire({
      title: `Registrar compra — ${req.consecutivo}`,
      html: `
        <p style="font-size:12px;color:#64748b;margin-bottom:12px">
          Valor estimado: <b>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(req.valorEstimado)}</b>
        </p>
        <input id="swal-oc" class="swal2-input" placeholder="No. OC al proveedor (obligatorio)" style="font-size:13px">
        <input id="swal-valor" type="number" class="swal2-input" placeholder="Valor real de compra (obligatorio)" style="font-size:13px">
      `,
      showCancelButton: true,
      confirmButtonText: 'Registrar compra',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0ea5e9',
      preConfirm: () => {
        const oc = (document.getElementById('swal-oc') as HTMLInputElement).value.trim();
        const valor = parseFloat((document.getElementById('swal-valor') as HTMLInputElement).value);
        if (!oc) { Swal.showValidationMessage('El número de OC es obligatorio'); return; }
        if (!valor || valor <= 0) { Swal.showValidationMessage('El valor real debe ser mayor a cero'); return; }
        return { oc, valor };
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.trackerService.comprarRequisicion(req.id, result.value.oc, result.value.valor, usuario.id).subscribe({
          next: (res) => {
            Swal.fire({ icon: 'success', title: 'Compra registrada', text: `OC: ${res.numeroOCCompra} — Estado: ${res.estado}`, timer: 3000 });
            const p = this.proyectoSeleccionado();
            if (p) this.cargarSubFlujos(p.id);
          },
          error: (err) => {
            const msg = err?.graphQLErrors?.[0]?.message || 'No se pudo registrar la compra.';
            Swal.fire('Error', msg, 'error');
          }
        });
      }
    });
  }

  recibirReq(req: any) {
    const usuario = this.authService.usuarioActual();
    if (!usuario) return;

    Swal.fire({
      title: `Confirmar recibo — ${req.consecutivo}`,
      html: `
        <p style="font-size:12px;color:#64748b;margin-bottom:12px">
        OC Compra: <b>${req.numeroOCCompra ?? 'N/A'}</b> · Valor: <b>${req.valorRealCompra
          ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(req.valorRealCompra)
          : 'N/A'}</b>
        </p>
        <textarea id="swal-obs" class="swal2-textarea" placeholder="Observaciones del recibo (opcional)" style="font-size:13px;height:80px"></textarea>
      `,
      showCancelButton: true,
      confirmButtonText: 'Confirmar recibo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      preConfirm: () => {
        const obs = (document.getElementById('swal-obs') as HTMLTextAreaElement).value.trim();
        return { obs };
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.trackerService.recibirRequisicion(req.id, usuario.id, result.value?.obs).subscribe({
          next: () => {
            Swal.fire({ icon: 'success', title: '¡Material recibido!', text: 'La requisición quedó CERRADA.', timer: 3000 });
            const p = this.proyectoSeleccionado();
            if (p) this.cargarSubFlujos(p.id);
          },
          error: (err) => {
            const msg = err?.graphQLErrors?.[0]?.message || 'No se pudo confirmar el recibo.';
            Swal.fire('Error', msg, 'error');
          }
        });
      }
    });
  }

  // ==========================================
  // CÁLCULOS FINANCIEROS EN TIEMPO REAL
  // ==========================================
  get utilidadBruta(): number {
    if (!this.actualizarForm) return 0;
    const facturado = this.actualizarForm.get('valorFacturado')?.value || 0;
    const gastoMateriales = this.actualizarForm.get('valorGasto')?.value || 0;
    const costoOTs = this.actualizarForm.get('costoRealTotal')?.value || 0;

    return facturado - (gastoMateriales + costoOTs);
  }

  get margenUtilidad(): number {
    if (!this.actualizarForm) return 0;
    const facturado = this.actualizarForm.get('valorFacturado')?.value || 0;
    if (facturado === 0) return 0;
    return (this.utilidadBruta / facturado) * 100;
  }

  // ==========================================
  // VALIDACIÓN PRE-CIERRE (Paso 4 - FINALIZADO_TOTAL)
  // Espeja los 8 candados del backend para auditoría final
  // ==========================================
  get itemsAuditoriaCierre(): { label: string; ok: boolean; critico: boolean }[] {
    const f = this.actualizarForm;
    const p = this.proyectoSeleccionado();
    if (!f || !p) return [];

    const ots  = this.ordenesTrabajo();
    const reqs = this.requisiciones();

    // Requisiciones sin cerrar (estados reales del backend)
    const reqSinCerrar = reqs.filter(
      (r: any) => r.estado !== 'CERRADA' && r.estado !== 'Rechazado'
    );

    // Anticipos directos pendientes (módulo ANT independiente)
    const antDirectosPendientes = (p.anticiposDirectos || []).filter(
      (a: any) => a.estado === 'SOLICITADO' || a.estado === 'APROBADO'
    );

    // Permisos: son opcionales — solo valida si el proyecto los requiere
    const requierePermisos = !!f.get('requierePermisos')?.value;

    return [
      // --- Checkboxes manuales de cierre ---
      {
        label: 'Cierre Técnico en Terreno aprobado',
        ok: !!f.get('cierreTecnicoAprobado')?.value,
        critico: true
      },
      {
        label: 'Dossier / Informe entregado al cliente',
        ok: !!f.get('dossierEntregado')?.value,
        critico: true
      },
      {
        label: 'Liquidación de contratistas terminada',
        ok: !!f.get('liquidacionTerminada')?.value,
        critico: true
      },
      {
        label: 'Facturación emitida al cliente',
        ok: !!f.get('facturacionCompletada')?.value,
        critico: true
      },
      // --- Datos obligatorios ---
      {
        label: 'Centro de Costos (ID WorldOffice) registrado',
        ok: !!f.get('centroDeCostos')?.value?.trim(),
        critico: true
      },
      {
        label: 'Respuesta a cliente (SLA) registrada',
        ok: !!p.fechaRespuestaCliente,
        critico: true
      },
      {
        label: 'Estado de pólizas definido',
        ok: !!f.get('polizas')?.value && f.get('polizas')?.value !== '',
        critico: true
      },
      // --- Autorización / Acceso (solo si el proyecto lo requiere) ---
      ...( requierePermisos ? [
        {
          label: 'Fecha de visita técnica registrada',
          ok: !!p.fechaVisitaTecnica,
          critico: false
        },
        {
          label: 'Aprobación de permisos registrada',
          ok: !!p.fechaAprobacionPermisos,
          critico: false
        }
      ] : [
        {
          label: 'Autorización / Acceso: No requiere permisos',
          ok: true,
          critico: false
        }
      ]),
      // --- Sub-flujos financieros ---
      {
        label: reqSinCerrar.length === 0
          ? 'Todas las requisiciones cerradas ✓'
          : `${reqSinCerrar.length} requisición(es) sin cerrar: ${reqSinCerrar.map((r: any) => r.consecutivo).join(', ')}`,
        ok: reqSinCerrar.length === 0,
        critico: true
      },
      {
        label: antDirectosPendientes.length === 0
          ? 'Sin anticipos directos pendientes ✓'
          : `${antDirectosPendientes.length} anticipo(s) directo(s) sin resolver (pagar o rechazar)`,
        ok: antDirectosPendientes.length === 0,
        critico: true
      },
    ];
  }

  get puedeAuditoriaCierre(): boolean {
    return this.itemsAuditoriaCierre.every(item => item.ok);
  }

  get itemsCierreOk(): number {
    return this.itemsAuditoriaCierre.filter(i => i.ok).length;
  }
  get puedeIniciarObra(): boolean {
    if (!this.actualizarForm) return false;
    const polizas = this.actualizarForm.get('polizas')?.value;
    const polizasOk = polizas && polizas !== 'Requiere - Pendiente';
    // Ejecutor ahora viene de la OT — solo validamos pólizas
    return !!polizasOk;
  }

  // Advertencia de OC sin registrar (no bloquea pero avisa)
  get advertenciaOC(): string {
    const numeroOC = this.actualizarForm?.get('numeroOC')?.value;
    if (!numeroOC?.trim() || numeroOC.trim().toUpperCase() === 'PENDIENTE')
      return 'Inicio de obra sin OC del cliente registrada. Recuerda registrarla cuando esté disponible.';
    return '';
  }

  get razonesBloqueoInicio(): string[] {
    if (!this.actualizarForm) return [];
    const razones: string[] = [];
    const polizas = this.actualizarForm.get('polizas')?.value;
    if (!polizas || polizas === 'Requiere - Pendiente')
      razones.push('Las pólizas deben estar aprobadas o marcadas como "No Requiere".');
    return razones;
  }

  // ==========================================
  // VALIDACIÓN PRE-FIN DE OBRA
  // Espeja los candados del backend para FINALIZADO_PARCIAL
  // Los datos ya están cargados en los signals ordenesTrabajo() y requisiciones()
  // ==========================================
  get razonesBloqueoFinalizacion(): string[] {
    const razones: string[] = [];
    const fechaFin = this.actualizarForm?.get('fechaFinalizacionActividades')?.value;

    if (!fechaFin) return razones;

    // 1. Requisiciones incompletas (si existen, deben cerrarse o rechazarse)
    const reqIncompletas = this.requisiciones().filter(
      (r: any) => r.estado !== 'CERRADA' && r.estado !== 'Rechazado'
    );
    if (reqIncompletas.length > 0)
      razones.push(
        `${reqIncompletas.length} Requisición(es) sin cerrar: ${reqIncompletas.map((r: any) => `${r.consecutivo} (${r.estado})`).join(', ')}.`
      );

    // 2. Anticipos directos pendientes (SOLICITADO o APROBADO sin pagar)
    const p = this.proyectoSeleccionado();
    const antPendientes = (p?.anticiposDirectos || []).filter(
      (a: any) => a.estado === 'SOLICITADO' || a.estado === 'APROBADO'
    );
    if (antPendientes.length > 0)
      razones.push(
        `${antPendientes.length} Anticipo(s) directo(s) sin completar — deben pagarse o rechazarse antes del cierre.`
      );

    return razones;
  }

  get puedeFinalizarObra(): boolean {
    const fechaFin = this.actualizarForm?.get('fechaFinalizacionActividades')?.value;
    return !!fechaFin && this.razonesBloqueoFinalizacion.length === 0;
  }

  // ── Anticipos Directos ──
  abrirModalAnticipoDirecto(p: any) {
    this.proyectoParaAnticipo.set(p);
    this.anticiposDirectos.set(p.anticiposDirectos || []);

    // Autocompletar beneficiario con contratista de la primera OT activa
    const ots = p.ordenesTrabajo || [];
    const otConContratista = ots.find((o: any) => o.contratistaNombre?.trim());
    const beneficiarioPredeterminado = otConContratista?.contratistaNombre || '';

    this.anticipoDirectoForm.reset({
      valorAnticipo: 0,
      beneficiario: beneficiarioPredeterminado
    });
    this.modalAnticipoDirectoAbierto.set(true);
  }

  cerrarModalAnticipoDirecto() {
    this.modalAnticipoDirectoAbierto.set(false);
    this.proyectoParaAnticipo.set(null);
  }

  guardarAnticipoDirecto() {
    if (this.anticipoDirectoForm.invalid) {
      this.anticipoDirectoForm.markAllAsTouched();
      return;
    }
    const p = this.proyectoParaAnticipo();
    const usuario = this.authService.usuarioActual();
    const raw = this.anticipoDirectoForm.value;
    this.trackerService.addAnticipoDirecto({
      proyectoId:    p.id,
      solicitanteId: usuario?.id,
      valorAnticipo: raw.valorAnticipo,
      concepto:      raw.concepto,
      beneficiario:  raw.beneficiario || null,
      observaciones: raw.observaciones || null
    }).subscribe({
      next: (res) => {
        this.anticiposDirectos.update(a => [res, ...a]);
        this.anticipoDirectoForm.reset({ valorAnticipo: 0 });
        // Actualizar contador en la tabla de proyectos
        const pAnt = this.proyectoParaAnticipo();
        if (pAnt) {
          this.proyectos.update(ps => ps.map(proj =>
            proj.id === pAnt.id
              ? { ...proj, anticiposDirectos: [res, ...(proj.anticiposDirectos || [])] }
              : proj
          ));
        }
        Swal.fire({ icon: 'success', title: 'Anticipo solicitado', timer: 2000, showConfirmButton: false });
      },
      error: (err) => {
        const msg = err?.graphQLErrors?.[0]?.message || 'No se pudo crear el anticipo.';
        Swal.fire('Error', msg, 'error');
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

  eliminarOT(ot: any) {
    Swal.fire({
      title: '¿Eliminar OT?',
      text: `La orden ${ot.consecutivo} será eliminada permanentemente.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, eliminar', confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.trackerService.eliminarOrdenTrabajo(ot.id).subscribe({
        next: () => {
          this.ordenesTrabajo.update(a => a.filter((x: any) => x.id !== ot.id));
          this.cargarProyectos(this.lineaActiva());
          Swal.fire({ icon: 'success', title: 'OT eliminada', timer: 1500, showConfirmButton: false });
        },
        error: (err) => Swal.fire('Error', err?.graphQLErrors?.[0]?.message || 'No se pudo eliminar.', 'error')
      });
    });
  }

  despachoInterno(req: any) {
    Swal.fire({
      title: '¿Despacho Interno?',
      text: 'El material se tomará del inventario propio. La requisición pasará directamente a "Por Entregar" sin generar OC de compra.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, despacho interno',
      confirmButtonColor: '#1e3a8a',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      const usuario = this.authService.usuarioActual();
      if (!usuario?.id) return;
      this.trackerService.despachoInternoRequisicion(req.id, usuario.id).subscribe({
        next: (res) => {
          this.requisiciones.update(a => a.map((x: any) => x.id === req.id ? { ...x, ...res } : x));
          Swal.fire({ icon: 'success', title: 'Despacho interno registrado', text: 'La requisición está lista para entrega.', timer: 2500, showConfirmButton: false });
        },
        error: (err) => Swal.fire('Error', err?.graphQLErrors?.[0]?.message || 'No se pudo procesar.', 'error')
      });
    });
  }

  eliminarReq(req: any) {
    Swal.fire({
      title: '¿Eliminar Requisición?',
      text: `La requisición ${req.consecutivo} será eliminada permanentemente.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, eliminar', confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.trackerService.eliminarRequisicion(req.id).subscribe({
        next: () => {
          this.requisiciones.update(a => a.filter((x: any) => x.id !== req.id));
          this.cargarProyectos(this.lineaActiva());
          Swal.fire({ icon: 'success', title: 'Requisición eliminada', timer: 1500, showConfirmButton: false });
        },
        error: (err) => Swal.fire('Error', err?.graphQLErrors?.[0]?.message || 'No se pudo eliminar.', 'error')
      });
    });
  }

  eliminarAnticipoDirectoConfirm(anticipo: any) {
    Swal.fire({
      title: '¿Eliminar Anticipo?',
      text: `El anticipo de ${anticipo.valorAnticipo?.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} será eliminado.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, eliminar', confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.trackerService.eliminarAnticipoDirecto(anticipo.id).subscribe({
        next: () => {
          this.anticiposDirectos.update(a => a.filter((x: any) => x.id !== anticipo.id));
          this.cargarProyectos(this.lineaActiva());
          Swal.fire({ icon: 'success', title: 'Anticipo eliminado', timer: 1500, showConfirmButton: false });
        },
        error: (err) => Swal.fire('Error', err?.graphQLErrors?.[0]?.message || 'No se pudo eliminar.', 'error')
      });
    });
  }

  rechazarAnticipoDirecto(anticipo: any) {
    this.trackerService.rechazarAnticipoDirecto(anticipo.id).subscribe({
      next: () => this.anticiposDirectos.update(a => a.map((x: any) => x.id === anticipo.id ? { ...x, estado: 'RECHAZADO' } : x)),
      error: () => Swal.fire('Error', 'No se pudo rechazar.', 'error')
    });
  }
}
