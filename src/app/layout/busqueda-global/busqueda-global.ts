import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TrackerService } from '../../core/services/tracker';
import { AuthService } from '../../core/auth/auth.service';

const LINEAS: Record<string, { titulo: string; permiso: string; color: string }> = {
  civiles:            { titulo: 'Construcción', permiso: 'proyectos.civiles', color: 'bg-blue-50 text-[#1e3a8a]' },
  energia:            { titulo: 'Energía',      permiso: 'proyectos.energia', color: 'bg-yellow-50 text-amber-700' },
  telecomunicaciones: { titulo: 'O&M',          permiso: 'proyectos.telecom', color: 'bg-emerald-50 text-emerald-700' }
};

/** Quita tildes y pasa a minúsculas para comparar sin importar cómo se escriba. */
const normalizar = (t: any) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Búsqueda global de proyectos (Ctrl+K o el botón Buscar del encabezado).
 * Busca por código, nombre o cliente entre los proyectos que el usuario puede ver en el Tracker
 * y abre el panel del proyecto en su división.
 */
@Component({
  selector: 'app-busqueda-global',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './busqueda-global.html'
})
export class BusquedaGlobalComponent {
  private trackerService = inject(TrackerService);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly lineas = LINEAS;
  readonly abierta = signal(false);
  readonly texto = signal('');
  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly seleccion = signal(0);
  private proyectos = signal<any[]>([]);
  private cargadoEn = 0;

  private campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  /** Solo quien puede leer proyectos ve el buscador. */
  get disponible(): boolean {
    return this.authService.hasPermission('proyectos.leer');
  }

  get esMac(): boolean {
    return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  }

  /** Proyectos que el usuario vería en el Tracker: divisiones con permiso y, si no es gerente, solo los suyos. */
  private visibles = computed(() => {
    const usuario = this.authService.usuarioActual();
    const gerente = this.authService.hasPermission('proyectos.gerente');
    return this.proyectos().filter(p => {
      const linea = LINEAS[this.clave(p)];
      if (!linea || !this.authService.hasPermission(linea.permiso)) return false;
      return gerente || p.responsable?.id === usuario?.id;
    });
  });

  readonly resultados = computed(() => {
    const palabras = normalizar(this.texto()).split(/\s+/).filter(Boolean);
    if (!palabras.length) return [];
    return this.visibles()
      .filter(p => {
        const donde = normalizar(`${p.codigo} ${p.nombre} ${p.cliente?.razonSocial ?? ''}`);
        return palabras.every(w => donde.includes(w));
      })
      .slice(0, 8);
  });

  @HostListener('document:keydown', ['$event'])
  atajo(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (!this.disponible) return;
      e.preventDefault();
      this.abierta() ? this.cerrar() : this.abrir();
    } else if (e.key === 'Escape' && this.abierta()) {
      this.cerrar();
    }
  }

  abrir() {
    this.texto.set('');
    this.seleccion.set(0);
    this.abierta.set(true);
    setTimeout(() => this.campo()?.nativeElement.focus());
    // La lista se guarda un par de minutos para no consultar en cada apertura
    if (Date.now() - this.cargadoEn > 120_000) this.cargar();
  }

  cerrar() {
    this.abierta.set(false);
  }

  private cargar() {
    this.cargando.set(true);
    this.error.set(false);
    this.trackerService.buscarProyectos().subscribe({
      next: lista => { this.proyectos.set(lista); this.cargadoEn = Date.now(); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.error.set(true); }
    });
  }

  escribir(valor: string) {
    this.texto.set(valor);
    this.seleccion.set(0);
  }

  teclas(e: KeyboardEvent) {
    const n = this.resultados().length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); this.seleccion.set((this.seleccion() + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); this.seleccion.set((this.seleccion() - 1 + n) % n); }
    else if (e.key === 'Enter' && n) { e.preventDefault(); this.ir(this.resultados()[this.seleccion()]); }
  }

  ir(p: any) {
    this.cerrar();
    this.router.navigate(['/proyectos', this.clave(p)], { queryParams: { proyecto: p.id } });
  }

  /** División del proyecto como aparece en la dirección (civiles, energia, telecomunicaciones). */
  clave(p: any): string {
    return normalizar(p.lineaNegocio);
  }

  estado(e: string): string {
    return (e || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
  }
}
