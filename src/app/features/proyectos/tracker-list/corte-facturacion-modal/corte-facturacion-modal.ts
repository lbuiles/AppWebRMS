import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { TrackerService } from '../../../../core/services/tracker';
import { AuthService } from '../../../../core/auth/auth.service';
import { confirmarDescartarCambios } from '../../../../core/guards/cambios-pendientes.guard';
import { mensajeError } from '../../../../core/errores';

/** Modal "Cortes de Facturación" de un proyecto: registrar, anular y eliminar cortes. */
@Component({
  selector: 'app-corte-facturacion-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './corte-facturacion-modal.html'
})
export class CorteFacturacionModalComponent {
  private fb = inject(FormBuilder);
  private trackerService = inject(TrackerService);
  private authService = inject(AuthService);

  readonly proyecto = input.required<any>();
  readonly configVisual = input<any>({});

  readonly cerrar = output<void>();
  /** Se registró un corte nuevo (el padre lo suma al proyecto en la lista). */
  readonly corteAgregado = output<any>();
  /** Se anuló o eliminó un corte (el padre recarga la lista). */
  readonly cortesCambiados = output<void>();

  public cortes = signal<any[]>([]);

  public corteFacturacionForm = this.fb.group({
    valorCorte:    [0, [Validators.required, Validators.min(1)]],
    numeroFactura: [''],
    observaciones: ['']
  });

  ngOnInit() {
    this.cortes.set(this.proyecto()?.cortesFacturacion || []);
  }

  tieneCambios(): boolean {
    return this.corteFacturacionForm.dirty;
  }

  async cancelar() {
    if (this.corteFacturacionForm.dirty && !(await confirmarDescartarCambios())) return;
    this.cerrar.emit();
  }

  get totalCortesActivos(): number {
    return this.cortes()
      .filter((c: any) => c.estado !== 'ANULADO')
      .reduce((sum: number, c: any) => sum + (c.valorCorte || 0), 0);
  }

  guardarCorteFacturacion() {
    if (this.corteFacturacionForm.invalid) {
      this.corteFacturacionForm.markAllAsTouched();
      return;
    }
    const p = this.proyecto();
    const usuario = this.authService.usuarioActual();
    const raw = this.corteFacturacionForm.value;
    this.trackerService.addCorteFacturacion({
      proyectoId:      p.id,
      registradoPorId: usuario?.id,
      valorCorte:      raw.valorCorte,
      numeroFactura:   raw.numeroFactura || null,
      observaciones:   raw.observaciones || null
    }).subscribe({
      next: (res) => {
        this.cortes.update(a => [res, ...a]);
        this.corteFacturacionForm.reset({ valorCorte: 0 });
        this.corteAgregado.emit(res);
        Swal.fire({ icon: 'success', title: 'Corte de facturación registrado', timer: 2000, showConfirmButton: false });
      },
      error: (err) => {
        const msg = mensajeError(err, 'No se pudo registrar el corte de facturación.');
        Swal.fire('Error', msg, 'error');
      }
    });
  }

  anularCorteFacturacionConfirm(corte: any) {
    Swal.fire({
      title: '¿Anular corte de facturación?',
      text: `El corte de ${corte.valorCorte?.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} se marcará como anulado y se descontará del total facturado.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, anular', confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.trackerService.anularCorteFacturacion(corte.id).subscribe({
        next: () => {
          this.cortes.update(a => a.map((x: any) => x.id === corte.id ? { ...x, estado: 'ANULADO' } : x));
          this.cortesCambiados.emit();
          Swal.fire({ icon: 'success', title: 'Corte anulado', timer: 1500, showConfirmButton: false });
        },
        error: (err) => Swal.fire('Error', mensajeError(err, 'No se pudo anular el corte.'), 'error')
      });
    });
  }

  eliminarCorteFacturacionConfirm(corte: any) {
    Swal.fire({
      title: '¿Eliminar corte de facturación?',
      text: `El corte de ${corte.valorCorte?.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })} será eliminado permanentemente.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sí, eliminar', confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar'
    }).then(r => {
      if (!r.isConfirmed) return;
      this.trackerService.eliminarCorteFacturacion(corte.id).subscribe({
        next: () => {
          this.cortes.update(a => a.filter((x: any) => x.id !== corte.id));
          this.cortesCambiados.emit();
          Swal.fire({ icon: 'success', title: 'Corte eliminado', timer: 1500, showConfirmButton: false });
        },
        error: (err) => Swal.fire('Error', mensajeError(err, 'No se pudo eliminar el corte.'), 'error')
      });
    });
  }
}
