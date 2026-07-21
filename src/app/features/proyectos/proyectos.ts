import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ProyectoService } from '../../core/services/proyecto'; // <-- Ajusta la ruta

export interface CategoriaProyecto {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  cantidadActivos: number;
  presupuestoTotal: number;
  colorTema: string;
  bgTema: string;
  permisoRequerido: string;
}

@Component({
  selector: 'app-proyectos',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, NgClass],
  templateUrl: './proyectos.html'
})
export class ProyectosComponent implements OnInit {
  private authService = inject(AuthService);
  private proyectoService = inject(ProyectoService);

  public categorias: CategoriaProyecto[] = [];
  public loading: boolean = true;

  ngOnInit(): void {
    this.cargarCategorias();
  }

  cargarCategorias(): void {
    this.proyectoService.getCategorias().subscribe({
      next: (data) => {
        this.categorias = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar las categorías', err);
        this.loading = false;
      }
    });
  }

  tienePermiso(permiso: string): boolean {
    return this.authService.hasPermission(permiso);
  }

  get esGerente(): boolean {
    return this.authService.hasPermission('proyectos.gerente');
  }
}
