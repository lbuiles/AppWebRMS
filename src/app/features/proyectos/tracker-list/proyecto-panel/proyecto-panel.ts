import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { TrackerService } from '../../../../core/services/tracker';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrencyMaskDirective } from '../../../../core/directives/currency-mask';
import { confirmarDescartarCambios } from '../../../../core/guards/cambios-pendientes.guard';
import { erroresGraphQL, esSinConexion, esSinPermiso, mensajeError } from '../../../../core/errores';

/**
 * Panel lateral de un proyecto del Tracker: resumen, detalles, bitácora, finanzas y cierre.
 * Se crea al abrir el panel y trabaja sobre su propia copia del proyecto; avisa al Tracker
 * cuando algo cambia para que refresque la lista.
 */
@Component({
  selector: 'app-proyecto-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyMaskDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './proyecto-panel.html'
})
export class ProyectoPanelComponent implements OnInit {
  private trackerService = inject(TrackerService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  readonly proyecto = input.required<any>();
  readonly configVisual = input<any>({});
  readonly listas = input<{ clientes: any[]; usuarios: any[]; contratistas: any[] }>({ clientes: [], usuarios: [], contratistas: [] });

  /** El usuario cerró el panel (ya confirmó si había cambios). */
  readonly cerrar = output<void>();
  /** Se guardó algo en el servidor: el Tracker recarga la lista. */
  readonly cambiado = output<void>();
  /** Cambio local del proyecto (p. ej. una observación nueva) para reflejarlo en la lista sin recargar. */
  readonly proyectoActualizado = output<any>();
  readonly abrirCorte = output<any>();
  readonly archivar = output<any>();
  readonly eliminar = output<any>();

  public proyectoSeleccionado = signal<any>(null);
  public esAdminFase = signal<boolean>(
    this.authService.hasPermission('proyectos.fase.administrativa') ||
    this.authService.hasPermission('proyectos.editar')
  );

  ngOnInit() {
    this.proyectoSeleccionado.set(this.proyecto());
    this.cargarFormularioPanel();
    this.cargarSubFlujos(this.proyecto().id);
  }

  tieneCambios(): boolean {
    return !!this.actualizarForm?.dirty;
  }

  async cancelar() {
    if (this.actualizarForm?.dirty && !(await confirmarDescartarCambios())) return;
    this.cerrar.emit();
  }

  calcularDiasDiferencia(fechaInicial: string | null, fechaFinal: string | null): number | null {
    if (!fechaInicial || !fechaFinal) return null;
    const f1 = new Date(fechaInicial).setHours(0,0,0,0);
    const f2 = new Date(fechaFinal).setHours(0,0,0,0);
    const diffTime = Math.abs(f2 - f1);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
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

  get esGerente(): boolean {
    // Punto 8 (semana 39, revisión final): la visibilidad de TODOS los proyectos
    // de la división (en vez de solo los propios, ver proyectosFiltrados abajo)
    // depende exclusivamente de 'proyectos.gerente'. 'proyectos.editar' es un
    // permiso distinto (habilita editar campos) y NO debe dar acceso a ver los
    // proyectos de otros usuarios.
    return this.authService.hasPermission('proyectos.gerente');
  }

  public actualizando = signal<boolean>(false);

  public actualizarForm!: FormGroup;

  public vistaPanel = signal<'resumen' | 'resumen_general' | 'detalles' | 'bitacora' | 'compras' | 'control'>('resumen');

  public nuevaObservacion = signal<string>('');

  public guardandoObs = signal<boolean>(false);

  public requisiciones = signal<any[]>([]);

  public ordenesTrabajo = signal<any[]>([]);

  public cargandoSubFlujos = signal<boolean>(false);

  // Retorna el nombre del ejecutor desde la primera OT activa del proyecto
  obtenerEjecutorDesdeOT(p: any): string | null {
    const ots = p.ordenesTrabajo || this.ordenesTrabajo() || [];
    if (!ots.length) return null;
    const ot = ots[0];
    if (ot.tecnicoInterno?.nombre) return ot.tecnicoInterno.nombre;
    if (ot.contratistaNombre) return ot.contratistaNombre;
    return null;
  }

  /**
   * Calcula cuántos días han pasado desde la fecha tentativa de fin hasta hoy.
   * Positivo = retraso, Negativo = adelanto, 0 = en fecha.
   */
  calcularDiasDesviacion(fechaTentativa: string | null): number {
    if (!fechaTentativa) return 0;
    const tentativa = new Date(fechaTentativa + 'T00:00:00').setHours(0, 0, 0, 0);
    const hoy = new Date().setHours(0, 0, 0, 0);
    return Math.floor((hoy - tentativa) / (1000 * 60 * 60 * 24));
  }

  /** Diferencia con signo: positivo = real fue después de tentativa (retraso), negativo = adelanto */
  calcularDesviacionFecha(fechaTentativa: string | null, fechaReal: string | null): number {
    if (!fechaTentativa || !fechaReal) return 0;
    const t = new Date(fechaTentativa).setHours(0,0,0,0);
    const r = new Date(fechaReal).setHours(0,0,0,0);
    return Math.floor((r - t) / (1000 * 60 * 60 * 24));
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
        this.proyectoActualizado.emit(proyectoActualizado);

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

  // Signal para alternar entre selector de clientes y texto libre
  // Contratista en el flujo de proyecto: false = seleccionar de los ya registrados, true = texto libre
  public contratistaModoLibre = signal<boolean>(false);

  onSeleccionarContratistaProyecto(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    if (val === '__OTRO__') {
      this.contratistaModoLibre.set(true);
      this.actualizarForm.get('contratista')?.setValue('');
      return;
    }
    this.actualizarForm.get('contratista')?.setValue(val);
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

    const contratistasRegistrados = this.listas().contratistas || [];
    const nombreContratistaActual = (p.contratista || '').trim();
    const coincideConRegistrado = !nombreContratistaActual || contratistasRegistrados.some(
      (c: any) => (c.razonSocial || c.nombreCompleto || '').trim() === nombreContratistaActual
    );
    this.contratistaModoLibre.set(!coincideConRegistrado);

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
      fechaInicioObra: [this.formatToDateInput(p.fechaInicioObra)],
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
          'fechaInicioActividades', 'fechaInicioObra', 'fechaTentativaFin', 'fechaFinalizacionActividades'
        ];
        camposOperativos.forEach(c => this.actualizarForm.get(c)?.disable());
      }
      // valorGasto y costoRealTotal ahora son editables manualmente
    }
  }

  /** Cambia el modo del campo OC/PO: normal (número), pendiente (sin OC aún), noAplica */
  setModoOC(modo: 'normal' | 'pendiente' | 'noAplica') {
    const ctrlNumero = this.actualizarForm.get('numeroOC');
    const ctrlSinOc  = this.actualizarForm.get('sinOcAun');
    if (!ctrlNumero || !ctrlSinOc) return;

    if (modo === 'normal') {
      ctrlSinOc.setValue(false);
      // Limpia el valor si era un marcador especial
      const val = (ctrlNumero.value || '').toString().toUpperCase();
      if (val === 'PENDIENTE' || val === 'NO_APLICA') ctrlNumero.setValue('');
    } else if (modo === 'pendiente') {
      ctrlSinOc.setValue(true);
      ctrlNumero.setValue('PENDIENTE');
    } else {
      ctrlSinOc.setValue(false);
      ctrlNumero.setValue('NO_APLICA');
    }
  }

  /**
   * Guarda solo el Nombre del Proyecto, sin depender de la validez del resto
   * del formulario gigante de actualización (que tiene muchos otros campos
   * requeridos en otras secciones/pestañas). Antes, el botón "Guardar" junto
   * al nombre llamaba a guardarActualizacion(), que fallaba silenciosamente
   * si cualquier otro campo del formulario estaba incompleto.
   */
  guardarNombreProyecto() {
    const ctrlNombre = this.actualizarForm.get('nombre');
    if (!ctrlNombre || !ctrlNombre.value?.trim()) {
      ctrlNombre?.markAsTouched();
      Swal.fire({ icon: 'warning', title: 'Nombre requerido', text: 'El nombre del proyecto no puede quedar vacío.' });
      return;
    }

    const p = this.proyectoSeleccionado();
    if (!p) return;

    this.actualizando.set(true);
    this.trackerService.actualizarNombreProyecto(p.id, ctrlNombre.value.trim()).subscribe({
      next: () => {
        this.actualizando.set(false);
        Swal.fire({ icon: 'success', title: 'Nombre actualizado', timer: 1500, showConfirmButton: false });
        this.proyectoSeleccionado.set({ ...p, nombre: ctrlNombre.value.trim() });
        this.cambiado.emit();
      },
      error: (err) => {
        this.actualizando.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el nombre del proyecto.' });
        console.error(err);
      }
    });
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

        this.cambiado.emit();
        this.proyectoSeleccionado.set({ ...p, ...resultado });

        // Volvemos a evaluar el formulario por si cambió de estado a FINALIZADO
        this.cargarFormularioPanel();
      },
      error: (err) => {
        this.actualizando.set(false);
        console.error('Error completo:', err);

        // Mensaje de negocio del servidor (candados de auditoría), si lo hay
        const mensajeServidor = erroresGraphQL(err).length && !esSinPermiso(err) && !esSinConexion(err)
          ? mensajeError(err, '')
          : '';

        if (esSinPermiso(err)) {
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
            text: mensajeError(err, 'No se pudo actualizar el Tracker. Por favor, intenta de nuevo.'),
            confirmButtonColor: '#ef4444'
          });
        }
      }
    });
  }

  async revertirCierreObra() {
    const result = await Swal.fire({
      title: '¿Revertir el cierre de obra?',
      html: `Se borrará la <b>fecha de finalización de actividades</b>.<br>
             El proyecto volverá a estado <b>En Ejecución</b> y podrás corregir la información.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, revertir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#64748b'
    });

    if (!result.isConfirmed) return;

    // Re-habilitar el formulario en caso de que esté deshabilitado (FINALIZADO_TOTAL)
    this.actualizarForm.enable();

    // Limpiar solo la fecha de finalización de actividades
    this.actualizarForm.patchValue({ fechaFinalizacionActividades: '' });

    this.guardarActualizacion();
  }

  async revertirCierreCompleto() {
    const result = await Swal.fire({
      title: '¿Revertir cierre completo?',
      html: `Se borrarán la <b>fecha de finalización</b> y todos los <b>ítems documentales</b> marcados.<br>
             El proyecto quedará pendiente de cierre nuevamente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, revertir todo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    });

    if (!result.isConfirmed) return;

    // Re-habilitar el formulario (FINALIZADO_TOTAL lo deshabilita por completo)
    this.actualizarForm.enable();

    // Limpiar fecha de fin + todos los ítems de cierre
    this.actualizarForm.patchValue({
      fechaFinalizacionActividades: '',
      cierreTecnicoAprobado: false,
      dossierEntregado: false,
      liquidacionTerminada: false,
      facturacionCompletada: false
    });

    this.guardarActualizacion();
  }

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

  /** Porcentaje del PO (valorOC) ya facturado */
  get porcentajeFacturacion(): number {
    if (!this.actualizarForm) return 0;
    const po = this.actualizarForm.get('valorOC')?.value || 0;
    const facturado = this.actualizarForm.get('valorFacturado')?.value || 0;
    if (po === 0) return 0;
    return Math.min((facturado / po) * 100, 100);
  }

  /** Saldo pendiente de facturar contra el PO */
  get saldoPorFacturar(): number {
    if (!this.actualizarForm) return 0;
    const po = this.actualizarForm.get('valorOC')?.value || 0;
    const facturado = this.actualizarForm.get('valorFacturado')?.value || 0;
    return Math.max(po - facturado, 0);
  }

  /** Costo total acumulado (REQ + OTs) */
  get costoTotalAcumulado(): number {
    if (!this.actualizarForm) return 0;
    return (this.actualizarForm.get('valorGasto')?.value || 0)
         + (this.actualizarForm.get('costoRealTotal')?.value || 0);
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
    // Las pólizas son informativas: se muestra advertencia si están pendientes
    // pero NO bloquean el inicio de obra (decisión de negocio — Bug #4).
    return !!this.actualizarForm;
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
    // Las pólizas ya no bloquean el inicio, solo se muestran como advertencia
    const polizas = this.actualizarForm.get('polizas')?.value;
    if (!polizas || polizas === 'Requiere - Pendiente')
      razones.push('Advertencia: Las pólizas aún están pendientes. Recuerda actualizarlas.');
    return razones;
  }

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
}
