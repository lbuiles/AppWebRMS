import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MenuService } from '../../services/menu';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent implements OnInit {
  public menuService = inject(MenuService);
  public auth = inject(AuthService);

  // 1. Reemplazamos el array estático por una señal que almacenará los datos de la DB
  private modulosDesdeDB = signal<any[]>([]);

  ngOnInit() {

  this.menuService.getMenuConfig().subscribe({
    next: (data) => {
      this.modulosDesdeDB.set(data);
    },
    error: (err) => {

    }
  });
}

  // 3. Filtramos el menú usando la información real de la base de datos
  public menuItems = computed(() => {
    const usuario = this.auth.usuarioActual();
    const modulos = this.modulosDesdeDB();

    // Si no hay usuario o aún no cargan los módulos, menú vacío
    if (!usuario || modulos.length === 0) return [];

    // Filtramos los módulos de la DB según el permisoRaiz (slugRaiz en el backend)
  return modulos
    .filter(m => this.auth.hasModule(m.slugRaiz) && !m.slugRaiz.includes('.'))
    .sort((a, b) => a.orden - b.orden);
    });
}
