import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuService } from '../../services/menu'; // Ajusta la ruta según tu proyecto
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-administracion',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './administracion.html'
})
export class AdministracionComponent implements OnInit {
  private menuService = inject(MenuService);
  private auth = inject(AuthService);

  // Señal para guardar los módulos que vienen de la DB
  private modulosDesdeDB = signal<any[]>([]);

  ngOnInit() {
    this.menuService.getMenuConfig().subscribe({
      next: (data) => this.modulosDesdeDB.set(data),
      error: (err) => console.error('Error cargando administración dinámica:', err)
    });
  }

  // Transformamos y filtramos los módulos
  public modulosAdmin = computed(() => {
    const modulos = this.modulosDesdeDB();

    // Solo mostramos lo que el usuario tiene permitido ver
    return modulos
      .filter(m => this.auth.hasModule(m.slugRaiz) && m.slugRaiz.startsWith('admin.'))
      .map(m => {
        // Buscamos si tenemos estilos definidos para este slug,
        // si no, ponemos uno por defecto (indigo)
        const estilo = this.configuracionVisual[m.slugRaiz] || this.configuracionVisual['default'];

        return {
          id: m.id,
          titulo: m.nombre, // Cambiamos 'nombre' de DB por 'titulo' del HTML
          ruta: m.ruta,
          icono: m.icono,
          descripcion: estilo.descripcion,
          color: estilo.color,
          bg: estilo.bg
        };
      });
  });

  // Diccionario para mantener tus textos y colores bonitos
  // (Esto es temporal hasta que decidas llevar descripción/color a la DB)
  private configuracionVisual: any = {
    'admin.clientes': {
      descripcion: 'Gestiona las empresas contratantes, NITs y contactos principales.',
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    'admin.proveedores': {
      descripcion: 'Registro de contratistas y proveedores — Formulario RMS-ADM-FT-02.',
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    'admin.contratistas': {
      descripcion: 'Registro de contratistas y proveedores — Formulario RMS-ADM-FT-02.',
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    'admin.usuarios': {
      descripcion: 'Administra los roles de acceso al sistema (Directores, Residentes).',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    'admin.costos': { // Asegúrate de que este slug coincida con tu DB
      descripcion: 'Configuración financiera para la facturación de los proyectos.',
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    'admin.configuracion': {
      descripcion: 'Configuración técnica de módulos y slugs de seguridad para el control de acceso.',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
    },
    'default': {
      descripcion: 'Gestión de catálogo maestro del sistema.',
      color: 'text-gray-600',
      bg: 'bg-gray-50'
    }
  };
}
