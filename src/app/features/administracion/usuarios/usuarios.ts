import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UsuarioService } from '../../../core/services/usuario';
import { AuthService } from '../../../core/auth/auth.service';
import Swal from 'sweetalert2';

interface UsuarioData {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  usuarioPermisos: any[];
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './usuarios.html'
})
export class UsuariosComponent implements OnInit {
  private usuarioService = inject(UsuarioService);
  public authService = inject(AuthService);

  // Datos
  public usuariosOriginales: UsuarioData[] = [];
  public usuariosFiltrados: UsuarioData[] = [];
  public gruposPermisos: any[] = []; // Estructura jerárquica para el modal

  // UI
  public searchTerm: string = '';
  public loading: boolean = true;
  public showModal: boolean = false;
  public isEditing: boolean = false;

  // Formulario
  public usuarioIdParaEditar: string | null = null;
  public nuevoUsuario = { nombre: '', email: '' };
  public permisosSeleccionados: string[] = [];

  ngOnInit(): void {
    this.listar();
    this.cargarCatalogoPermisos();
  }

  listar(): void {
    this.loading = true;
    this.usuarioService.getUsuarios().subscribe({
      next: (data) => {
        this.usuariosOriginales = data;
        this.usuariosFiltrados = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  cargarCatalogoPermisos(): void {
    this.usuarioService.getTodosLosPermisos().subscribe(permisosDb => {
      this.gruposPermisos = permisosDb.reduce((acc: any[], curr: any) => {

        // 1. OBTENEMOS EL ÁREA DESDE EL MÓDULO PADRE
        // Ya no usamos curr.area, sino el área definida en el módulo relacionado
        const nombreArea = curr.moduloRelacion?.area
          ? curr.moduloRelacion.area.toUpperCase().trim()
          : 'SIN CLASIFICAR';

        // 2. BUSCAR O CREAR EL ÁREA EN EL ACUMULADOR
        let area = acc.find(a => a.titulo === nombreArea);
        if (!area) {
          area = { titulo: nombreArea, modulos: [] };
          acc.push(area);
        }

        // 3. BUSCAR O CREAR EL MÓDULO DENTRO DE ESA ÁREA
        const nombreModulo = curr.moduloRelacion?.nombre || 'General';
        let modulo = area.modulos.find((m: any) => m.nombre === nombreModulo);
        if (!modulo) {
          modulo = { nombre: nombreModulo, permisos: [] };
          area.modulos.push(modulo);
        }

        // 4. INSERTAR EL PERMISO
        modulo.permisos.push({ slug: curr.slug, nombre: curr.nombre });

        return acc;
      }, []);

      // ORDENAR ALFABÉTICAMENTE (Áreas y luego Módulos internos)
      this.gruposPermisos.sort((a, b) => a.titulo.localeCompare(b.titulo));
      this.gruposPermisos.forEach(a => {
        a.modulos.sort((m1: any, m2: any) => m1.nombre.localeCompare(m2.nombre));
      });
    });
  }

  toggleModuloCompleto(modulo: any, event: any): void {
    const isChecked = event.target.checked;
    modulo.permisos.forEach((p: any) => {
      const index = this.permisosSeleccionados.indexOf(p.slug);
      if (isChecked && index === -1) {
        this.permisosSeleccionados.push(p.slug);
      } else if (!isChecked && index > -1) {
        this.permisosSeleccionados.splice(index, 1);
      }
    });
  }

  // Verifica si todos los permisos del módulo están seleccionados para mostrar el check maestro
  isModuloCompleto(modulo: any): boolean {
    if (!modulo.permisos?.length) return false;
    return modulo.permisos.every((p: any) => this.permisosSeleccionados.includes(p.slug));
  }

  tienePermiso(slug: string): boolean {
    return this.permisosSeleccionados.includes(slug);
  }

  togglePermiso(slug: string): void {
    const index = this.permisosSeleccionados.indexOf(slug);
    if (index > -1) {
      this.permisosSeleccionados.splice(index, 1);
    } else {
      this.permisosSeleccionados.push(slug);
    }
  }

  abrirModal(): void {
    this.isEditing = false;
    this.usuarioIdParaEditar = null;
    this.nuevoUsuario = { nombre: '', email: '' };
    this.permisosSeleccionados = [];
    this.showModal = true;
  }

  editarUsuario(u: UsuarioData): void {
    this.isEditing = true;
    this.usuarioIdParaEditar = u.id;
    this.nuevoUsuario = { nombre: u.nombre, email: u.email };
    this.permisosSeleccionados = u.usuarioPermisos?.map(up => up.permiso.slug) || [];
    this.showModal = true;
  }

  cerrarModal(): void {
    this.showModal = false;
  }

  guardarUsuario(): void {
    if (!this.nuevoUsuario.nombre || !this.nuevoUsuario.email) {
      Swal.fire('Atención', 'Nombre y Email son obligatorios', 'warning');
      return;
    }

    const peticion = (this.isEditing && this.usuarioIdParaEditar)
      ? this.usuarioService.updateUsuario(this.usuarioIdParaEditar, this.nuevoUsuario.nombre, this.nuevoUsuario.email, this.permisosSeleccionados)
      : this.usuarioService.createUsuario(this.nuevoUsuario.nombre, this.nuevoUsuario.email, this.permisosSeleccionados);

    peticion.subscribe({
      next: () => {
        Swal.fire({ icon: 'success', title: 'Guardado', timer: 1500, showConfirmButton: false });
        this.listar();
        this.cerrarModal();
      },
      error: (err) => {
        // CAPTURA DE ERROR DE PERMISOS
        if (err.message?.includes('not authorized') || err.message?.includes('permission')) {
          Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'No tienes permisos suficientes para ' + (this.isEditing ? 'editar' : 'crear') + ' usuarios.',
            confirmButtonColor: '#1e3a8a'
          });
        } else {
          Swal.fire('Error', 'No se pudo procesar la solicitud. Intente de nuevo.', 'error');
        }
      }
    });
  }

  toggleEstado(u: UsuarioData): void {
    const esActivo = u.estado === 'ACTIVO';
    const op = esActivo ? this.usuarioService.deleteUsuario(u.id) : this.usuarioService.activateUsuario(u.id);

    op.subscribe({
      next: () => this.listar(),
      error: (err) => {
        if (err.message?.includes('not authorized')) {
          Swal.fire('Acceso Denegado', 'No tienes permiso para cambiar el estado de colaboradores.', 'error');
        } else {
          Swal.fire('Error', 'No se pudo cambiar el estado.', 'error');
        }
      }
    });
  }

  filtrarUsuarios(): void {
    const term = this.searchTerm.toLowerCase();
    this.usuariosFiltrados = this.usuariosOriginales.filter(u =>
      u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }
}
