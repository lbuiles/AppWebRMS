import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ContratistaService } from '../../core/services/contratista';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

const TIPOS_DOCUMENTO_CP = [
  { value: 'RUT', label: 'RUT' },
  { value: 'Cedula', label: 'Cédula de Ciudadanía' },
  { value: 'CertExistencia', label: 'Certificado de Existencia y Representación' },
  { value: 'CertBancaria', label: 'Certificación Bancaria' },
  { value: 'PlanillaSS', label: 'Planilla Seguridad Social' },
  { value: 'DeclaracionRenta', label: 'Declaración de Renta' },
  { value: 'AutorizacionDatos', label: 'Autorización Tratamiento de Datos' },
  { value: 'EstadosFinancieros', label: 'Estados Financieros' },
  { value: 'Referencias', label: 'Referencias Comerciales' },
  { value: 'Otro', label: 'Otro' },
];

@Component({
  selector: 'app-contratistas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './contratistas.html',
})
export class ContratistasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private svc = inject(ContratistaService);
  private auth = inject(AuthService);

  // Mismo patrón que clientes.ts para servir archivos en dev vs prod
  public serverUrl = environment.production ? '' : 'http://localhost:5180';

  // State signals
  terceros = signal<any[]>([]);
  cargando = signal(false);
  guardando = signal(false);
  modalAbierto = signal(false);
  mostrarInactivos = signal(false);
  terceroDetalle = signal<any | null>(null);
  panelDetalleAbierto = signal(false);
  terceroEditando = signal<any | null>(null);
  pasoActual = signal(1);
  busqueda = signal('');
  filtroTipo = signal('Todos');
  documentosCargados = signal<{ tipoDocumento: string; url: string }[]>([]);
  tipoDocSelect = '';
  readonly TOTAL_PASOS = 6;
  readonly TIPOS_DOCUMENTO_CP = TIPOS_DOCUMENTO_CP;

  form!: FormGroup;

  get tipoPersona() { return this.form.get('tipoPersona')?.value; }
  get esNatural() { return this.tipoPersona === 'Natural'; }
  get esJuridica() { return this.tipoPersona === 'Jurídica'; }
  get accionistas() { return this.form.get('accionistas') as FormArray; }
  get cuentasBancarias() { return this.form.get('cuentasBancarias') as FormArray; }
  get referencias() { return this.form.get('referencias') as FormArray; }

  get tercerosFiltrados() {
    const q = this.busqueda().toLowerCase();
    const tipo = this.filtroTipo();
    const inactivos = this.mostrarInactivos();
    return this.terceros().filter(t => {
      const nombre = (t.nombreCompleto || t.razonSocial || '').toLowerCase();
      const nit = (t.nit || t.numeroDocumento || '').toLowerCase();
      const matchQ = !q || nombre.includes(q) || nit.includes(q);
      const matchTipo = tipo === 'Todos' || t.tipoTercero === tipo;
      const matchEstado = inactivos ? true : t.estado === 'ACTIVO';
      return matchQ && matchTipo && matchEstado;
    });
  }

  verDetalle(t: any) {
    this.terceroDetalle.set(t);
    this.panelDetalleAbierto.set(true);
  }

  cerrarDetalle() {
    this.panelDetalleAbierto.set(false);
    this.terceroDetalle.set(null);
  }

  toggleEstado(t: any) {
    const esActivo = t.estado === 'ACTIVO';
    Swal.fire({
      title: esActivo ? '¿Inactivar registro?' : '¿Activar registro?',
      text: esActivo
        ? 'El tercero quedará inactivo y no aparecerá en las listas de selección.'
        : 'El tercero volverá a estar disponible.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      confirmButtonColor: '#1e3a8a',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      const op$ = esActivo ? this.svc.delete(t.id) : this.svc.activate(t.id);
      op$.subscribe({
        next: () => {
          const nuevoEstado = esActivo ? 'INACTIVO' : 'ACTIVO';
          this.terceros.update(list => list.map(x => x.id === t.id ? { ...x, estado: nuevoEstado } : x));
          if (this.terceroDetalle()?.id === t.id)
            this.terceroDetalle.update(x => ({ ...x, estado: nuevoEstado }));
          Swal.fire({ icon: 'success', title: esActivo ? 'Inactivado' : 'Activado', timer: 2000, showConfirmButton: false });
        },
        error: () => Swal.fire('Error', 'No se pudo cambiar el estado.', 'error')
      });
    });
  }

  get nombreDisplay() {
    return (t: any) => t.razonSocial || t.nombreCompleto || '—';
  }

  get identificacionDisplay() {
    return (t: any) => t.nit ? `NIT ${t.nit}` : t.numeroDocumento ? `CC ${t.numeroDocumento}` : '—';
  }

  ngOnInit() {
    this.inicializarForm();
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.svc.getAll().subscribe({
      next: data => { this.terceros.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false)
    });
  }

  inicializarForm() {
    this.form = this.fb.group({
      // Clasificación
      tipoTercero:   ['Contratista', Validators.required],
      tipoPersona:   ['Jurídica', Validators.required],
      estadoRegistro: ['Nuevo'],
      fechaDiligenciamiento: [null],

      // §1 Persona Natural
      nombreCompleto: [''], tipoDocumento: [''], numeroDocumento: [''],
      fechaExpedicion: [null], lugarExpedicion: [''], nacionalidad: [''],
      estadoCivil: [''], numeroContacto: [''], correoElectronico: [''],
      direccionResidencia: [''], ciudad: [''], departamento: [''],
      actividadEconomica: [''], codigoCIIU: [''], empleadosACargo: [null],

      // §2 Persona Jurídica
      razonSocial: [''], nit: [''], digitoVerificador: [''],
      direccionEmpresa: [''], paisEmpresa: ['Colombia'], ciudadEmpresa: [''],
      departamentoEmpresa: [''], actividadEconomicaEmpresa: [''], codigoCIIUEmpresa: [''],
      emailEmpresa: [''], telefonoEmpresa: [''], tipoEmpresa: [''],
      paginaWeb: [''], nombreRepresentanteLegal: [''], documentoRepresentanteLegal: [''],

      // PEP
      esPEP: [false], administraRecursosPublicos: [false],
      pagoConRecursosPublicos: [false], sancionadoLavadoActivos: [false],
      tieneVinculoPEP: [false], vinculoPEPNombre: [''],
      vinculoPEPDocumento: [''], vinculoPEPParentesco: [''],

      // §3 Tributaria
      esAgenteRetencion: [false], esGranContribuyente: [false],
      resolucionGranContribuyente: [''], esAutoretenedor: [false],
      resolucionAutoretenedor: [''], esNoResponsableIVA: [false],
      esRegimenSimple: [false], esRegimenEspecial: [false],
      cualRegimenEspecial: [''], esRegimenComun: [false],
      obligadoFacturacionElectronica: [false], esDeclaranteRenta: [false],

      // §4 Financiera
      ingresosMensuales: [null], egresosMensuales: [null],
      totalActivos: [null], totalPasivos: [null],
      patrimonio: [null], otrosIngresos: [null], conceptoOtrosIngresos: [''],

      // §5 Internacional
      poseeCuentasExterior: [false], paisCuentaExterior: [''],

      // §7 Declaración
      declaracionOrigenFondos: [''],

      // §10 Documentos recibidos
      docIdentificacion: [false], docRUT: [false], docCertificacionBancaria: [false],
      docPlanillaSeguridadSocial: [false], docReferenciasComerciales: [false],
      docDeclaracionRenta: [false], docAutorizacionDatos: [false],
      docCertificadoExistencia: [false], docEstadosFinancieros: [false],

      // Arrays
      accionistas: this.fb.array([]),
      cuentasBancarias: this.fb.array([]),
      referencias: this.fb.array([]),
    });
  }

  abrirModal(tercero?: any) {
    this.inicializarForm();
    this.documentosCargados.set([]);
    this.pasoActual.set(1);

    if (tercero) {
      this.terceroEditando.set(tercero);

      // Convertir fechas ISO → yyyy-MM-dd para inputs type="date"
      const toDateInput = (val: any) => {
        if (!val) return null;
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().substring(0, 10);
      };

      this.form.patchValue({
        ...tercero,
        fechaDiligenciamiento: toDateInput(tercero.fechaDiligenciamiento),
        fechaExpedicion:       toDateInput(tercero.fechaExpedicion),
      });

      // Solo cargar los campos que acepta el input — id y fechaSubida causan error en GraphQL
      this.documentosCargados.set(
        (tercero.documentos || []).map((d: any) => ({
          id:            d.id,          // guardarlo para poder eliminarlo individualmente
          tipoDocumento: d.tipoDocumento,
          url:           d.url
        }))
      );

      // Cargar arrays
      tercero.accionistas?.forEach((a: any) => this.agregarAccionista(a));
      tercero.cuentasBancarias?.forEach((c: any) => this.agregarCuenta(c));
      tercero.referencias?.forEach((r: any) => this.agregarReferencia(r));
    } else {
      this.terceroEditando.set(null);
    }
    this.modalAbierto.set(true);
  }

  cerrarModal() { this.modalAbierto.set(false); }

  irPaso(paso: number) {
    if (paso < 1 || paso > this.TOTAL_PASOS) return;
    this.pasoActual.set(paso);
  }

  // ── Accionistas ──
  agregarAccionista(data?: any) {
    this.accionistas.push(this.fb.group({
      nombreRazonSocial: [data?.nombreRazonSocial || '', Validators.required],
      tipoDocumento:     [data?.tipoDocumento || '', Validators.required],
      numeroDocumento:   [data?.numeroDocumento || '', Validators.required],
      tieneCategoriaPEP: [data?.tieneCategoriaPEP || false],
    }));
  }
  eliminarAccionista(i: number) { this.accionistas.removeAt(i); }

  // ── Cuentas Bancarias ──
  agregarCuenta(data?: any) {
    this.cuentasBancarias.push(this.fb.group({
      tipoProducto:  [data?.tipoProducto || '', Validators.required],
      numeroCuenta:  [data?.numeroCuenta || '', Validators.required],
      entidad:       [data?.entidad || '', Validators.required],
      ciudad:        [data?.ciudad || ''],
      departamento:  [data?.departamento || ''],
      pais:          [data?.pais || 'Colombia'],
      observaciones: [data?.observaciones || ''],
    }));
  }
  eliminarCuenta(i: number) { this.cuentasBancarias.removeAt(i); }

  // ── Referencias ──
  agregarReferencia(data?: any) {
    this.referencias.push(this.fb.group({
      entidad:        [data?.entidad || '', Validators.required],
      nombreContacto: [data?.nombreContacto || ''],
      telefono:       [data?.telefono || ''],
    }));
  }
  eliminarReferencia(i: number) { this.referencias.removeAt(i); }

  // ── Documentos ──
  onArchivoSeleccionado(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    if (!this.tipoDocSelect) {
      Swal.fire('Atención', 'Selecciona el tipo de documento antes de subir el archivo.', 'warning');
      event.target.value = ''; return;
    }
    const MAX_BYTES = 4 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      Swal.fire('Archivo muy pesado', 'El límite es 4 MB.', 'warning');
      event.target.value = ''; return;
    }
    this.svc.subirDocumento(file).subscribe({
      next: (res) => {
        this.documentosCargados.update(d => [...d, { tipoDocumento: this.tipoDocSelect, url: res.url }]);
        this.tipoDocSelect = '';
        event.target.value = '';
      },
      error: () => Swal.fire('Error', 'No se pudo subir el archivo.', 'error')
    });
  }

  eliminarDocumento(doc: any, index: number) {
    Swal.fire({
      title: '¿Eliminar documento?',
      html: `<p style="font-size:13px;color:#64748b">Se eliminará <b>${doc.tipoDocumento}</b> permanentemente.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;

      // Si el documento ya existe en BD (tiene id), lo elimina en el servidor
      if (doc.id) {
        this.svc.deleteDocumento(doc.id).subscribe({
          next: () => {
            this.documentosCargados.update(d => d.filter((_, i) => i !== index));
            // Actualizar también el tercero en edición para que no reaparezca
            if (this.terceroEditando()) {
              const t = this.terceroEditando();
              this.terceroEditando.set({
                ...t,
                documentos: (t.documentos || []).filter((d: any) => d.id !== doc.id)
              });
            }
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar el documento.', 'error')
        });
      } else {
        // Documento recién subido aún no guardado — solo quitar del array local
        this.documentosCargados.update(d => d.filter((_, i) => i !== index));
      }
    });
  }

  nombreArchivo(url: string) {
    return url.split('/').pop() || url;
  }

  // ── Guardar ──
  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire('Formulario incompleto', 'Revisa los campos obligatorios.', 'warning');
      return;
    }

    const raw = this.form.getRawValue();

    // HotChocolate exige ISO 8601 completo para DateTime.
    // Los inputs type="date" entregan "YYYY-MM-DD" — hay que agregar la hora
    // y convertir string vacío a null para campos opcionales.
    const toISOOrNull = (val: any) => {
      if (!val || val === '') return null;
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val))
        return `${val}T00:00:00.000Z`;
      return val;
    };

    const input = {
      // Clasificación
      tipoTercero:        raw.tipoTercero,
      tipoPersona:        raw.tipoPersona,
      estadoRegistro:     raw.estadoRegistro,
      fechaDiligenciamiento: toISOOrNull(raw.fechaDiligenciamiento),

      // §1 Persona Natural
      nombreCompleto:     raw.nombreCompleto,
      tipoDocumento:      raw.tipoDocumento,
      numeroDocumento:    raw.numeroDocumento,
      fechaExpedicion:    toISOOrNull(raw.fechaExpedicion),
      lugarExpedicion:    raw.lugarExpedicion,
      nacionalidad:       raw.nacionalidad,
      estadoCivil:        raw.estadoCivil,
      numeroContacto:     raw.numeroContacto,
      correoElectronico:  raw.correoElectronico,
      direccionResidencia: raw.direccionResidencia,
      ciudad:             raw.ciudad,
      departamento:       raw.departamento,
      actividadEconomica: raw.actividadEconomica,
      codigoCIIU:         raw.codigoCIIU,
      empleadosACargo:    raw.empleadosACargo,

      // §2 Persona Jurídica
      razonSocial:               raw.razonSocial,
      nit:                       raw.nit,
      digitoVerificador:         raw.digitoVerificador,
      direccionEmpresa:          raw.direccionEmpresa,
      paisEmpresa:               raw.paisEmpresa,
      ciudadEmpresa:             raw.ciudadEmpresa,
      departamentoEmpresa:       raw.departamentoEmpresa,
      actividadEconomicaEmpresa: raw.actividadEconomicaEmpresa,
      codigoCIIUEmpresa:         raw.codigoCIIUEmpresa,
      emailEmpresa:              raw.emailEmpresa,
      telefonoEmpresa:           raw.telefonoEmpresa,
      tipoEmpresa:               raw.tipoEmpresa,
      paginaWeb:                 raw.paginaWeb,
      nombreRepresentanteLegal:    raw.nombreRepresentanteLegal,
      documentoRepresentanteLegal: raw.documentoRepresentanteLegal,

      // PEP
      esPEP:                      raw.esPEP,
      administraRecursosPublicos: raw.administraRecursosPublicos,
      pagoConRecursosPublicos:    raw.pagoConRecursosPublicos,
      sancionadoLavadoActivos:    raw.sancionadoLavadoActivos,
      tieneVinculoPEP:            raw.tieneVinculoPEP,
      vinculoPEPNombre:           raw.vinculoPEPNombre,
      vinculoPEPDocumento:        raw.vinculoPEPDocumento,
      vinculoPEPParentesco:       raw.vinculoPEPParentesco,

      // §3 Tributaria
      esAgenteRetencion:             raw.esAgenteRetencion,
      esGranContribuyente:           raw.esGranContribuyente,
      resolucionGranContribuyente:   raw.resolucionGranContribuyente,
      esAutoretenedor:               raw.esAutoretenedor,
      resolucionAutoretenedor:       raw.resolucionAutoretenedor,
      esNoResponsableIVA:            raw.esNoResponsableIVA,
      esRegimenSimple:               raw.esRegimenSimple,
      esRegimenEspecial:             raw.esRegimenEspecial,
      cualRegimenEspecial:           raw.cualRegimenEspecial,
      esRegimenComun:                raw.esRegimenComun,
      obligadoFacturacionElectronica: raw.obligadoFacturacionElectronica,
      esDeclaranteRenta:             raw.esDeclaranteRenta,

      // §4 Financiera
      ingresosMensuales:     raw.ingresosMensuales,
      egresosMensuales:      raw.egresosMensuales,
      totalActivos:          raw.totalActivos,
      totalPasivos:          raw.totalPasivos,
      patrimonio:            raw.patrimonio,
      otrosIngresos:         raw.otrosIngresos,
      conceptoOtrosIngresos: raw.conceptoOtrosIngresos,

      // §5 Internacional
      poseeCuentasExterior: raw.poseeCuentasExterior,
      paisCuentaExterior:   raw.paisCuentaExterior,

      // §7
      declaracionOrigenFondos: raw.declaracionOrigenFondos,

      // §10 Documentos recibidos
      docIdentificacion:         raw.docIdentificacion,
      docRUT:                    raw.docRUT,
      docCertificacionBancaria:  raw.docCertificacionBancaria,
      docPlanillaSeguridadSocial: raw.docPlanillaSeguridadSocial,
      docReferenciasComerciales: raw.docReferenciasComerciales,
      docDeclaracionRenta:       raw.docDeclaracionRenta,
      docAutorizacionDatos:      raw.docAutorizacionDatos,
      docCertificadoExistencia:  raw.docCertificadoExistencia,
      docEstadosFinancieros:     raw.docEstadosFinancieros,

      // Arrays
      accionistas:     (raw.accionistas || []).map((a: any) => ({
        nombreRazonSocial: a.nombreRazonSocial,
        tipoDocumento:     a.tipoDocumento,
        numeroDocumento:   a.numeroDocumento,
        tieneCategoriaPEP: a.tieneCategoriaPEP
      })),
      cuentasBancarias: (raw.cuentasBancarias || []).map((c: any) => ({
        tipoProducto:  c.tipoProducto,
        numeroCuenta:  c.numeroCuenta,
        entidad:       c.entidad,
        ciudad:        c.ciudad,
        departamento:  c.departamento,
        pais:          c.pais,
        observaciones: c.observaciones
      })),
      referencias: (raw.referencias || []).map((r: any) => ({
        entidad:        r.entidad,
        nombreContacto: r.nombreContacto,
        telefono:       r.telefono
      })),
      documentos: this.documentosCargados().map(d => ({
        tipoDocumento: d.tipoDocumento,
        url:           d.url
        // NO incluir id ni fechaSubida — no son parte del CPDocumentoInput
      })),
    };

    this.guardando.set(true);
    const op$ = this.terceroEditando()
      ? this.svc.update(this.terceroEditando().id, input)
      : this.svc.add(input);

    op$.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModal();
        this.cargar();
        Swal.fire({ icon: 'success', title: this.terceroEditando() ? 'Actualizado' : 'Registrado', timer: 2500, showConfirmButton: false });
      },
      error: (err) => {
        this.guardando.set(false);
        console.error('ERROR COMPLETO:', JSON.stringify(err, null, 2));
        const msg = err?.graphQLErrors?.[0]?.message
          || err?.networkError?.error?.errors?.[0]?.message
          || err?.message
          || 'No se pudo guardar.';
        Swal.fire('Error al guardar', msg, 'error');
      }
    });
  }

  eliminar(t: any) { this.toggleEstado(t); }
}
