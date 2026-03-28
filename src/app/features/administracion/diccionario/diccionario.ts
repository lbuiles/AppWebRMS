import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuService } from '../../../services/menu';
import { UsuarioService } from '../../../core/services/usuario';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-diccionario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diccionario.html',
  styleUrl: './diccionario.scss'
})
export class Diccionario implements OnInit {
  private menuService = inject(MenuService);
  private usuarioService = inject(UsuarioService);

  public modulos = signal<any[]>([]);

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.menuService.getMenuCompleto().subscribe({
      next: (res) => this.modulos.set(res),
      error: (err) => console.error('Error al cargar el diccionario', err)
    });
  }

  async agregarPermisoRapido(modulo: any) {
    const { value: formValues } = await Swal.fire({
      title: `<span class="text-xl font-bold text-indigo-900">Nuevo para ${modulo.nombre}</span>`,
      html: `
        <div class="flex flex-col gap-4 mt-4 text-left">
          <div>
            <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre Visible</label>
            <input id="swal-nombre" class="w-full p-3 border rounded-xl mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ej: Gestionar Facturas">
          </div>
          <div>
            <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acción (Sufijo)</label>
            <select id="swal-accion" class="w-full p-3 border rounded-xl mt-1 focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="leer">Ver / Listar (.leer)</option>
              <option value="editar">Gestionar / Editar (.editar)</option>
              <option value="crear">Crear Nuevo (.crear)</option>
              <option value="eliminar">Eliminar (.eliminar)</option>
              <option value="status">Cambiar Estado (.status)</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Slug Técnico Generado</label>
            <input id="swal-slug" class="w-full p-3 border rounded-xl mt-1 bg-gray-50 font-mono text-xs text-indigo-600" value="${modulo.slugRaiz}.leer" readonly>
          </div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Guardar Permiso',
      confirmButtonColor: '#4f46e5',
      didOpen: () => {
        const select = document.getElementById('swal-accion') as HTMLSelectElement;
        const slugInput = document.getElementById('swal-slug') as HTMLInputElement;
        select.addEventListener('change', () => {
          slugInput.value = `${modulo.slugRaiz}.${select.value}`;
        });
      },
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value;
        const slug = (document.getElementById('swal-slug') as HTMLInputElement).value;
        if (!nombre) Swal.showValidationMessage('El nombre es obligatorio');
        return { nombre, slug };
      }
    });

    if (formValues) {
    // fíjate que ahora usamos modulo.area que viene directamente del objeto módulo
      this.menuService.crearPermiso(
        modulo.id,
        formValues.nombre,
        formValues.slug,
        modulo.area // El área ya viene del módulo, no hay error de dedo
      ).subscribe({
        next: () => {
          this.notificarExito('Permiso creado con éxito');
          this.cargarDatos();
        },
        error: (err) => this.manejarError(err)
      });
    }
  }

  async editarPermiso(permiso: any, modulo: any) {
    const { value: nuevoNombre } = await Swal.fire({
      title: 'Editar Nombre',
      input: 'text',
      inputValue: permiso.nombre,
      showCancelButton: true,
      inputValidator: (value) => !value ? 'El nombre no puede estar vacío' : null
    });

    if (nuevoNombre) {
      this.usuarioService.updatePermiso(permiso.id, nuevoNombre, modulo.area || 'GENERAL', modulo.id).subscribe({
        next: () => {
          this.notificarExito('Actualizado correctamente');
          this.cargarDatos();
        },
        error: (err) => this.manejarError(err)
      });
    }
  }

  eliminarPermiso(id: number): void {
    Swal.fire({
      title: '¿Eliminar permiso?',
      text: "Esta acción es irreversible y puede afectar el acceso de los usuarios.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, borrar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.usuarioService.deletePermiso(id).subscribe({
          next: () => {
            this.notificarExito('Permiso eliminado del sistema');
            this.cargarDatos();
          },
          error: (err) => this.manejarError(err)
        });
      }
    });
  }

  private notificarExito(mensaje: string) {
    Swal.fire({ icon: 'success', title: mensaje, timer: 1500, showConfirmButton: false });
  }

  private manejarError(error: any) {
    let msg = error.message?.replace('GraphQL error: ', '') || 'Error de servidor';
    Swal.fire('Operación Fallida', msg, 'error');
  }
}
