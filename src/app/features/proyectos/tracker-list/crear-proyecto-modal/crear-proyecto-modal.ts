import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { TrackerService } from '../../../../core/services/tracker';
import { CurrencyMaskDirective } from '../../../../core/directives/currency-mask';
import { confirmarDescartarCambios } from '../../../../core/guards/cambios-pendientes.guard';

/** Modal "Registrar Nuevo Proyecto" del Tracker. Se crea cada vez que se abre, así el formulario arranca limpio. */
@Component({
  selector: 'app-crear-proyecto-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyMaskDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './crear-proyecto-modal.html'
})
export class CrearProyectoModalComponent {
  private fb = inject(FormBuilder);
  private trackerService = inject(TrackerService);

  readonly linea = input.required<string>();
  readonly configVisual = input<any>({});
  readonly listas = input<{ clientes: any[]; usuarios: any[]; contratistas: any[] }>({ clientes: [], usuarios: [], contratistas: [] });

  /** Se cerró el modal (cancelado o guardado). */
  readonly cerrar = output<void>();
  /** Se creó el proyecto; el padre recarga la lista. */
  readonly creado = output<void>();

  public guardando = signal<boolean>(false);
  public clienteLibre = signal<boolean>(true); // Default: texto libre (sin dropdown)

  public proyectoForm = this.fb.group({
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    clienteId: [''],
    clienteNombre: ['', Validators.required],
    supervisorCliente: [''],
    responsableId: [''],
    valorOC: [0, [Validators.required, Validators.min(0)]],
    fechaAsignacion: [this.fechaHoy()],
    fechaRespuestaCliente: [null as string | null]
  });

  tieneCambios(): boolean {
    return this.proyectoForm.dirty;
  }

  async cancelar() {
    if (this.proyectoForm.dirty && !(await confirmarDescartarCambios())) return;
    this.cerrar.emit();
  }

  toggleClienteLibre() {
    const nuevo = !this.clienteLibre();
    this.clienteLibre.set(nuevo);
    const ctrl = this.proyectoForm.get('clienteId');
    const ctrlNombre = this.proyectoForm.get('clienteNombre');
    if (nuevo) {
      // Texto libre: quitar validación obligatoria del select
      ctrl?.clearValidators(); ctrl?.setValue(''); ctrl?.updateValueAndValidity();
      ctrlNombre?.setValidators(Validators.required); ctrlNombre?.updateValueAndValidity();
    } else {
      // Selector: restaurar validación
      ctrlNombre?.clearValidators(); ctrlNombre?.setValue(''); ctrlNombre?.updateValueAndValidity();
      ctrl?.setValidators(Validators.required); ctrl?.updateValueAndValidity();
    }
  }

  guardarProyecto() {
    if (this.proyectoForm.invalid) {
      this.proyectoForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);

    // Campos vacíos van como null: la API espera Guid? en responsableId/clienteId y un "" la hace fallar (400)
    const rawForm: any = Object.fromEntries(
      Object.entries(this.proyectoForm.value).map(([k, v]) => [k, v === '' ? null : v])
    );

    // Limpiar el campo no usado según el modo del selector de cliente
    if (this.clienteLibre()) {
      delete rawForm['clienteId'];
    } else {
      delete rawForm['clienteNombre'];
    }

    const inputData = {
      ...rawForm,
      fechaAsignacion: rawForm.fechaAsignacion
        ? new Date(rawForm.fechaAsignacion + 'T00:00:00Z').toISOString()
        : new Date().toISOString(),
      fechaRespuestaCliente: rawForm.fechaRespuestaCliente
        ? new Date(rawForm.fechaRespuestaCliente + 'T00:00:00Z').toISOString()
        : null,
      lineaNegocio: this.linea()
    };

    this.trackerService.crearProyecto(inputData).subscribe({
      next: () => {
        this.guardando.set(false);
        Swal.fire({ icon: 'success', title: '¡Proyecto Creado!', text: 'El proyecto ya está en el Tracker.', confirmButtonColor: '#1e3a8a', timer: 2000 });
        this.creado.emit();
        this.cerrar.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Hubo un problema al crear el proyecto.' });
        console.error(err);
      }
    });
  }

  private fechaHoy(): string {
    return new Date().toISOString().split('T')[0];
  }
}
