import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { TrackerService } from '../../../core/services/tracker';
import { AuthService } from '../../../core/auth/auth.service';
import Swal from 'sweetalert2';
import { CurrencyMaskDirective } from '../../../core/directives/currency-mask';

@Component({
  selector: 'app-tracker-list',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, ReactiveFormsModule, FormsModule, CurrencyMaskDirective],
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
  public configVisual = signal<any>({});
  public proyectos = signal<any[]>([]);
  public cargando = signal<boolean>(true);

  // Señales y variables del Modal
  public modalAbierto = signal<boolean>(false);
  public guardando = signal<boolean>(false);
  public listasFormulario = signal<{clientes: any[], usuarios: any[]}>({ clientes: [], usuarios: [] });
  public proyectoForm!: FormGroup;
  public panelAbierto = signal<boolean>(false);
  public proyectoSeleccionado = signal<any>(null);

  public modalActualizarAbierto = signal<boolean>(false);
  public actualizando = signal<boolean>(false);
  public actualizarForm!: FormGroup;

  public vistaPanel = signal<'resumen' | 'bitacora'>('resumen');
  public nuevaObservacion = signal<string>('');
  public guardandoObs = signal<boolean>(false);
  public esAdminFase = signal<boolean>(false);

  // ==========================================
  // SEÑALES Y CÁLCULOS PARA EL DASHBOARD DE ALERTAS
  // ==========================================
  public vistaPrincipal = signal<'portafolio' | 'alertas'>('portafolio');

  public kpiSLA = computed(() => {
    let aTiempo = 0;
    let retraso = 0;
    let pendiente = 0;

    this.proyectos().forEach(p => {
      const estado = this.obtenerEstadoSLA(p).estado;
      if (estado === 'a_tiempo') aTiempo++;
      else if (estado === 'retraso') retraso++;
      else pendiente++;
    });
    return { aTiempo, retraso, pendiente };
  });

  public kpiOC = computed(() => {
    return this.proyectos().filter(p => this.obtenerAlertaOC(p).estado === 'sin_oc').length;
  });

  public kpiCierre = computed(() => {
    return this.proyectos().filter(p => p.estado === 'Pendiente cierre administrativo').length;
  });

  private temas: Record<string, any> = {
    'civiles': { titulo: 'Obra Civil y Comercial', textoColor: 'text-[#1e3a8a]', bgColor: 'bg-[#1e3a8a]', bgClaro: 'bg-blue-50', borde: 'border-blue-200' },
    'energia': { titulo: 'Obra Eléctrica y Energías', textoColor: 'text-[#ffb31c]', bgColor: 'bg-[#ffb31c]', bgClaro: 'bg-yellow-50', borde: 'border-yellow-200' },
    'telecomunicaciones': { titulo: 'Telecomunicaciones', textoColor: 'text-emerald-600', bgColor: 'bg-emerald-600', bgClaro: 'bg-emerald-50', borde: 'border-emerald-200' }
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
        'telecomunicaciones': 'proyectos.telecom'
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
  calcularDiasDiferencia(fechaInicial: string | null, fechaFinal: string | null): number | null {
    if (!fechaInicial || !fechaFinal) return null;
    // Ajuste de zona horaria básico (solo tomamos las fechas y las pasamos a UTC local)
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
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Preliminares':
        return 'bg-white text-gray-600 border-gray-200';
      case 'En ejecución':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Pendiente cierre administrativo':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Finalizado':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Cancelado':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'Incumplimiento':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  }

  abrirPanel(proyecto: any) {
    this.proyectoSeleccionado.set(proyecto);
    this.vistaPanel.set('resumen');
    this.panelAbierto.set(true);
  }

  cerrarPanel() {
    this.panelAbierto.set(false);
    setTimeout(() => this.proyectoSeleccionado.set(null), 300);
  }

  // --- MÉTODOS DE DATOS ---
  cargarProyectos(linea: string) {
    this.cargando.set(true);
    this.trackerService.getProyectosPorLinea(linea).subscribe({
      next: (data) => { this.proyectos.set(data); this.cargando.set(false); },
      error: () => { this.cargando.set(false); }
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
      valorOC: [0, [Validators.required, Validators.min(0)]]
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

  private formatToDateInput(dateString: string | null | undefined): string {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  }

  abrirModalActualizar() {
    const p = this.proyectoSeleccionado();
    if (!p) return;

    this.actualizarForm = this.fb.group({
      nombre: [p.nombre, Validators.required],
      responsableId: [p.responsable?.id || ''],
      supervisorCliente: [p.supervisorCliente || ''],
      contratista: [p.contratista || ''],
      polizas: [p.polizas || ''],
      centroDeCostos: [p.centroDeCostos || ''],
      numeroOC: [p.numeroOC || ''],
      valorOC: [p.valorOC || 0, [Validators.required, Validators.min(0)]],
      valorFacturado: [p.valorFacturado || 0, Validators.min(0)],
      valorGasto: [p.valorGasto || 0, Validators.min(0)],

      fechaRespuestaCliente: [this.formatToDateInput(p.fechaRespuestaCliente)],
      fechaSolicitudPermisos: [this.formatToDateInput(p.fechaSolicitudPermisos)],
      fechaEnvioPermiso: [this.formatToDateInput(p.fechaEnvioPermiso)],
      fechaAprobacionPermisos: [this.formatToDateInput(p.fechaAprobacionPermisos)],
      fechaEnvioPresupuesto: [this.formatToDateInput(p.fechaEnvioPresupuesto)],
      fechaAprobacionPresupuesto: [this.formatToDateInput(p.fechaAprobacionPresupuesto)],
      fechaInicioActividades: [this.formatToDateInput(p.fechaInicioActividades)],
      fechaFinalizacionActividades: [this.formatToDateInput(p.fechaFinalizacionActividades)],

      dossierEntregado: [p.dossierEntregado || false],
      liquidacionTerminada: [p.liquidacionTerminada || false],
      facturacionCompletada: [p.facturacionCompletada || false]
    });

    const esSuperAdmin = this.authService.hasPermission('proyectos.editar');
    const esAdminFase = this.authService.hasPermission('proyectos.fase.administrativa') || esSuperAdmin;
    const esOperativoFase = this.authService.hasPermission('proyectos.fase.operativa') || esSuperAdmin;

    if (!esAdminFase) {
      const camposAdmin = ['numeroOC', 'valorOC', 'valorFacturado', 'valorGasto', 'contratista', 'polizas', 'centroDeCostos', 'dossierEntregado', 'liquidacionTerminada', 'facturacionCompletada'];
      camposAdmin.forEach(c => this.actualizarForm.get(c)?.disable());
    }

    if (!esOperativoFase) {
      const camposOperativos = ['fechaRespuestaCliente', 'fechaSolicitudPermisos', 'fechaEnvioPermiso', 'fechaAprobacionPermisos', 'fechaEnvioPresupuesto', 'fechaAprobacionPresupuesto', 'fechaInicioActividades', 'fechaFinalizacionActividades'];
      camposOperativos.forEach(c => this.actualizarForm.get(c)?.disable());
    }

    this.modalActualizarAbierto.set(true);
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

    // IMPORTANTE: Usamos getRawValue() para incluir los campos que están disabled
    // por permisos, de lo contrario Angular enviará null y podrías borrar datos en la BD.
    const dataCruda = this.actualizarForm.getRawValue();
    const inputLimpio: any = {};

    for (const key in dataCruda) {
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
        this.cerrarModalActualizar();

        Swal.fire({
          icon: 'success',
          title: 'Tracker Actualizado',
          text: 'El estado y las fechas se actualizaron correctamente.',
          confirmButtonColor: '#1e3a8a',
          timer: 2000
        });

        this.cargarProyectos(this.lineaActiva());
        this.proyectoSeleccionado.set({ ...p, ...resultado });
      },
      error: (err) => {
        this.actualizando.set(false);
        console.error('Error completo:', err); // Para depuración

        // 1. Intentamos extraer el mensaje real de GraphQL
        let mensajeServidor = '';

        if (err.graphQLErrors && err.graphQLErrors.length > 0) {
          // Esto captura: "Auditoría fallida: Debes definir el Estado de Pólizas..."
          mensajeServidor = err.graphQLErrors[0].message;
        } else if (err.message) {
          mensajeServidor = err.message;
        }

        const errorStr = JSON.stringify(err).toLowerCase();

        // 2. Clasificamos el error para mostrar el icono adecuado
        if (errorStr.includes('not authorized') || errorStr.includes('permission')) {
          Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'No tienes permisos para modificar estos campos.',
            confirmButtonColor: '#ef4444'
          });
        }
        else if (mensajeServidor) {
          // Si hay un mensaje del servidor (como el de las pólizas), lo mostramos tal cual
          Swal.fire({
            icon: 'warning',
            title: 'Validación de Auditoría',
            text: mensajeServidor,
            confirmButtonColor: '#f59e0b'
          });
        }
        else {
          // Error genérico si todo lo anterior falla
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
}
