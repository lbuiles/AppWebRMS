import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { NgClass } from '@angular/common';
import { UbicacionService } from '../../core/services/ubicacion';
import { ClienteService } from '../../core/services/cliente';
import Swal from 'sweetalert2';
import { LoadingService } from '../../core/services/loading';
import { AuthService } from '../../core/auth/auth.service';

export interface Contacto { nombre: string; cargo?: string; email?: string; telefono?: string; }
export interface Sucursal { nombre: string; departamento: string; ciudad: string; direccion: string; telefono: string; contactos?: Contacto[]; }

export interface Cliente {
  id: string; razonSocial: string; nit: string; departamento: string; ciudad: string;
  direccion: string; telefono: string; email: string; contactoPrincipal: string; estado: 'ACTIVO' | 'INACTIVO';
  tipoClienteId?: number;
  condiciones?: { tipoContratoId?: number; condicionPagoId?: number; monedaId?: number; tipoFacturacionId?: number; emailFacturacion?: string; requiereOC?: boolean; requierePolizas?: boolean; };
  operacion?: { prioridadId?: number; slaDias?: number; };
  clientePolizas?: { tipoPolizaId: number }[];
  clienteServicios?: { tipoServicioId: number }[];
  clienteRegiones?: { regionId: number }[];
  sucursales?: Sucursal[];
}

const MULTI_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\s*,\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})*$/;

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass],
  templateUrl: './clientes.html'
})
export class ClientesComponent implements OnInit {
  private fb = inject(FormBuilder);
  public ubicacionService = inject(UbicacionService);
  private clienteService = inject(ClienteService);
  public loadingService = inject(LoadingService);
  public authService = inject(AuthService);

  // --- SEÑALES DE ESTADO ---
  public clientes = signal<Cliente[]>([]);
  public clienteIdEnEdicion = signal<string | null>(null);
  public modalAbierto = signal<boolean>(false);
  public clienteSeleccionado = signal<Cliente | null>(null); // Para el Panel Lateral
  public ciudadesDisponibles = signal<string[]>([]);
  public terminoBusqueda = signal<string>('');

  // --- SEÑALES PARA CATÁLOGOS ---
  public catTiposCliente = signal<any[]>([]);
  public catTiposContrato = signal<any[]>([]);
  public catMonedas = signal<any[]>([]);
  public catTiposFacturacion = signal<any[]>([]);
  public catPrioridades = signal<any[]>([]);
  public catCondicionesPago = signal<any[]>([]);
  public catTiposPoliza = signal<any[]>([]);
  public catTiposServicio = signal<any[]>([]);
  public catRegiones = signal<any[]>([]);

  public clienteForm: FormGroup = this.fb.group({
    razonSocial: ['', [Validators.required, Validators.minLength(3)]],
    nit: ['', Validators.required],
    departamento: ['', Validators.required],
    ciudad: [{ value: '', disabled: true }, Validators.required],
    direccion: ['', Validators.required],
    telefono: ['', Validators.required],
    email: ['', [Validators.required, Validators.pattern(MULTI_EMAIL_REGEX)]],
    contactoPrincipal: ['', Validators.required],
    tipoClienteId: [null],
    tipoContratoId: [null],
    condicionPagoId: [null],
    monedaId: [null],
    tipoFacturacionId: [null],
    emailFacturacion: [''],
    requiereOC: [false],
    requierePolizas: [false],
    prioridadId: [null],
    slaDias: [0],
    regionesIds: [[]],
    serviciosIds: [[]],
    polizasIds: [[]],
    sucursales: this.fb.array([])
  });

  get sucursales() { return this.clienteForm.get('sucursales') as FormArray; }
  public ciudadesSucursales = signal<{ [key: number]: string[] }>({});

  ngOnInit() {
    this.cargarCatalogos();
    this.cargarClientes();
  }

  // --- MÉTODOS DE CARGA ---
  cargarCatalogos() {
    this.clienteService.getCatalogos().subscribe(data => {
      if(data) {
        this.catTiposCliente.set(data.tiposCliente || []);
        this.catTiposContrato.set(data.tiposContrato || []);
        this.catMonedas.set(data.monedas || []);
        this.catTiposFacturacion.set(data.tiposFacturacion || []);
        this.catPrioridades.set(data.prioridades || []);
        this.catCondicionesPago.set(data.condicionesPago || []);
        this.catTiposPoliza.set(data.tiposPoliza || []);
        this.catTiposServicio.set(data.tiposServicio || []);
        this.catRegiones.set(data.regiones || []);
      }
    });
  }

  cargarClientes() {
    this.clienteService.getClientes().subscribe({
      next: (datos) => this.clientes.set(datos),
      error: () => Swal.fire('Error', 'No se pudo conectar con el servidor', 'error')
    });
  }

  // --- GESTIÓN DE PANEL LATERAL (DETALLES) ---
  verDetalle(cliente: Cliente) {
    this.clienteSeleccionado.set(cliente);
  }

  cerrarDetalle() {
    this.clienteSeleccionado.set(null);
  }

  getNombreRegion(id: number): string {
    return this.catRegiones().find(r => r.id === id)?.nombre || `Región ${id}`;
  }

  getNombreServicio(id: number): string {
    return this.catTiposServicio().find(s => s.id === id)?.nombre || `Servicio ${id}`;
  }

  getNombreMoneda(id: number | undefined): string {
    if (!id) return 'No definida';
    return this.catMonedas().find(m => m.id === id)?.codigo || 'N/A';
  }

  getNombrePago(id: number | undefined): string {
    if (!id) return 'No definida';
    return this.catCondicionesPago().find(p => p.id === id)?.nombre || 'N/A';
  }

  getNombrePoliza(id: number): string {
    return this.catTiposPoliza().find(p => p.id === id)?.nombre || `Póliza ${id}`;
  }

  // --- GESTIÓN DE FORMULARIO / MODAL ---
  abrirModalParaCrear() {
    this.cerrarDetalle();
    this.clienteIdEnEdicion.set(null);
    this.sucursales.clear();
    this.clienteForm.reset({ requiereOC: false, requierePolizas: false, slaDias: 0, regionesIds: [], serviciosIds: [], polizasIds: [] });
    this.clienteForm.get('ciudad')?.disable();
    this.modalAbierto.set(true);
  }

  abrirModalParaEditar(cliente: Cliente) {
    if (cliente.estado === 'INACTIVO') {
      Swal.fire({
        icon: 'warning',
        title: 'Cliente Inactivo',
        text: 'No puedes editar la ficha de un cliente inactivo. Por favor, reactívalo primero.',
        confirmButtonColor: '#1e3a8a'
      });
      return;
    }

    this.cerrarDetalle();
    this.clienteIdEnEdicion.set(cliente.id);
    this.sucursales.clear();
    this.ciudadesSucursales.set({});

    if (cliente.sucursales) {
      cliente.sucursales.forEach((suc, sIdx) => {
        this.agregarSucursal();
        if (suc.departamento) {
          const ciudades = this.ubicacionService.obtenerCiudades(suc.departamento);
          this.ciudadesSucursales.update(prev => ({ ...prev, [sIdx]: ciudades }));
          this.sucursales.at(sIdx).get('ciudad')?.enable();
        }
        if (suc.contactos) {
          suc.contactos.forEach(() => this.agregarContacto(sIdx));
        }
      });
    }

    const formData = {
      ...cliente,
      tipoContratoId: cliente.condiciones?.tipoContratoId || null,
      condicionPagoId: cliente.condiciones?.condicionPagoId || null,
      monedaId: cliente.condiciones?.monedaId || null,
      tipoFacturacionId: cliente.condiciones?.tipoFacturacionId || null,
      emailFacturacion: cliente.condiciones?.emailFacturacion || '',
      requiereOC: cliente.condiciones?.requiereOC || false,
      requierePolizas: cliente.condiciones?.requierePolizas || false,
      prioridadId: cliente.operacion?.prioridadId || null,
      slaDias: cliente.operacion?.slaDias || 0,
      polizasIds: cliente.clientePolizas?.map(p => p.tipoPolizaId) || [],
      serviciosIds: cliente.clienteServicios?.map(s => s.tipoServicioId) || [],
      regionesIds: cliente.clienteRegiones?.map(r => r.regionId) || []
    };

    this.clienteForm.patchValue(formData);
    this.ciudadesDisponibles.set(this.ubicacionService.obtenerCiudades(cliente.departamento));
    this.clienteForm.get('ciudad')?.enable();
    this.modalAbierto.set(true);
  }

  guardarCliente() {

    const nombresSucursales = this.sucursales.controls.map(s => s.get('nombre')?.value?.trim().toUpperCase());
    const nombresDuplicados = nombresSucursales.filter((nombre, index) => nombre !== '' && nombresSucursales.indexOf(nombre) !== index);

    if (nombresDuplicados.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sedes Duplicadas',
        text: `No puedes tener más de una sede llamada "${nombresDuplicados[0]}". Por favor, usa nombres únicos.`,
        confirmButtonColor: '#1e3a8a'
      });
      return; // Detiene el guardado inmediatamente
    }
    // 1. Validación estricta que tenías originalmente
    if (this.clienteForm.invalid) {
      this.clienteForm.markAllAsTouched();
      this.sucursales.controls.forEach(suc => {
        suc.markAllAsTouched();
        (suc.get('contactos') as FormArray).controls.forEach(con => con.markAllAsTouched());
      });
      Swal.fire({ icon: 'error', title: '¡Faltan datos!', text: 'Debes completar todos los campos obligatorios marcados en rojo.', confirmButtonColor: '#1e3a8a' });
      return;
    }

    this.loadingService.show();
    const formRaw = this.clienteForm.getRawValue();
    const emailUsuarioLogueado = this.authService.usuarioActual()?.email || 'SISTEMA';

    // 2. Parseo de Ids (ESTO FUE LO QUE OMITÍ Y ROMPIÓ EL GUARDADO)
    const parseId = (val: any) => val ? parseInt(val.toString()) : null;
    const parseIdArray = (arr: any[]) => arr ? arr.map(x => parseInt(x.toString())) : [];

    const datosParaEnviar = {
      ...formRaw,
      // Formateo correcto de emails
      email: formRaw.email.split(',').map((e: string) => e.trim()).filter((e: string) => e !== '').join(','),
      razonSocial: formRaw.razonSocial.toUpperCase(),
      contactoPrincipal: formRaw.contactoPrincipal.toUpperCase(),
      direccion: formRaw.direccion.toUpperCase(),
      emailFacturacion: (formRaw.emailFacturacion || '').toLowerCase(),
      usuarioCreacion: emailUsuarioLogueado,

      // Asignación de Ids parseados a enteros para C#
      tipoClienteId: parseId(formRaw.tipoClienteId),
      tipoContratoId: parseId(formRaw.tipoContratoId),
      condicionPagoId: parseId(formRaw.condicionPagoId),
      monedaId: parseId(formRaw.monedaId),
      tipoFacturacionId: parseId(formRaw.tipoFacturacionId),
      prioridadId: parseId(formRaw.prioridadId),

      regionesIds: parseIdArray(formRaw.regionesIds),
      serviciosIds: parseIdArray(formRaw.serviciosIds),
      polizasIds: parseIdArray(formRaw.polizasIds),

      // Mapeo correcto de sucursales anidadas
      sucursales: formRaw.sucursales.map((s: any) => ({
        ...s,
        nombre: s.nombre.toUpperCase(),
        direccion: s.direccion.toUpperCase(),
        contactos: s.contactos.map((c: any) => ({
          ...c, nombre: c.nombre.toUpperCase(), cargo: c.cargo?.toUpperCase()
        }))
      }))
    };

    const id = this.clienteIdEnEdicion();
    const operacion = id
      ? this.clienteService.updateCliente(id, datosParaEnviar)
      : this.clienteService.crearCliente(datosParaEnviar);

    operacion.subscribe({
      next: () => {
        this.cargarClientes();
        this.cerrarModal();
        this.loadingService.hide();
        Swal.fire({ icon: 'success', title: id ? 'Cliente actualizado' : 'Cliente creado', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        console.error(err);
        this.loadingService.hide();
        Swal.fire('Error', err.error?.message || 'Hubo un problema al guardar', 'error');
      }
    });
  }

  cerrarModal() { this.modalAbierto.set(false); }

  // --- LÓGICA DE FILTRADO Y BÚSQUEDA ---
  public clientesFiltrados = computed(() => {
    const term = this.terminoBusqueda().toLowerCase();
    return this.clientes().filter(c => c.razonSocial.toLowerCase().includes(term) || c.nit.includes(term));
  });

  buscar(event: Event) { this.terminoBusqueda.set((event.target as HTMLInputElement).value); }

  onDepartamentoChange(event: Event) {
    const dpto = (event.target as HTMLSelectElement).value;
    if (dpto) {
      this.ciudadesDisponibles.set(this.ubicacionService.obtenerCiudades(dpto));
      this.clienteForm.get('ciudad')?.enable();
    } else {
      this.clienteForm.get('ciudad')?.disable();
    }
  }

  // --- MÉTODOS DE SUCURSALES Y CONTACTOS ---
  agregarSucursal() {
    const sucursalForm = this.fb.group({
      nombre: ['', Validators.required],
      departamento: ['', Validators.required],
      ciudad: [{ value: '', disabled: true }, Validators.required],
      direccion: ['', Validators.required],
      contactos: this.fb.array([])
    });
    this.sucursales.push(sucursalForm);
  }

  onDepartamentoSucursalChange(event: Event, index: number) {
    const dpto = (event.target as HTMLSelectElement).value;
    const sucursalGroup = this.sucursales.at(index) as FormGroup;
    if (dpto) {
      const ciudades = this.ubicacionService.obtenerCiudades(dpto);
      this.ciudadesSucursales.update(prev => ({ ...prev, [index]: ciudades }));
      sucursalGroup.get('ciudad')?.enable();
    } else {
      sucursalGroup.get('ciudad')?.disable();
      sucursalGroup.get('ciudad')?.setValue('');
    }
  }

  eliminarSucursal(index: number) { this.sucursales.removeAt(index); }
  getContactos(sucursalIndex: number) { return this.sucursales.at(sucursalIndex).get('contactos') as FormArray; }
  agregarContacto(sucursalIndex: number) {
    this.getContactos(sucursalIndex).push(this.fb.group({ nombre: ['', Validators.required], cargo: [''], email: ['', Validators.email], telefono: [''] }));
  }
  eliminarContacto(sucursalIndex: number, contactoIndex: number) { this.getContactos(sucursalIndex).removeAt(contactoIndex); }

  validarNombreSucursalUnico(index: number) {
    const currentCtrl = this.sucursales.at(index).get('nombre');
    const nombre = currentCtrl?.value?.trim().toUpperCase();

    // 1. Limpiamos el error previo de "repetido" para volver a evaluar
    if (currentCtrl?.hasError('repetido')) {
      const errors = { ...currentCtrl.errors };
      delete errors['repetido'];
      currentCtrl.setErrors(Object.keys(errors).length > 0 ? errors : null);
    }

    if (!nombre) return;

    // 2. Buscamos si hay otro con el mismo nombre
    const duplicado = this.sucursales.controls.some((ctrl, i) =>
      i !== index && ctrl.get('nombre')?.value?.trim().toUpperCase() === nombre
    );

    // 3. Si es duplicado, le asignamos el error
    if (duplicado) {
      currentCtrl?.setErrors({ ...currentCtrl.errors, repetido: true });
    }
  }

  toggleEstadoCliente(cliente: Cliente) {
    const esActivo = cliente.estado === 'ACTIVO';
    const nuevoEstado = esActivo ? 'INACTIVO' : 'ACTIVO';
    Swal.fire({
      title: esActivo ? '¿Desactivar cliente?' : '¿Reactivar cliente?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      confirmButtonColor: '#1e3a8a'
    }).then((result) => {
      if (result.isConfirmed) {
        const peticion = esActivo ? this.clienteService.deleteCliente(cliente.id) : this.clienteService.activateCliente(cliente.id);
        peticion.subscribe(() => {
          this.clientes.update(list => list.map(c => c.id === cliente.id ? { ...c, estado: nuevoEstado } : c));
          Swal.fire('¡Éxito!', `Cliente actualizado correctamente`, 'success');
        });
      }
    });
  }
}
