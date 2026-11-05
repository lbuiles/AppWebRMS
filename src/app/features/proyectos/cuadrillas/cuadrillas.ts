import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CuadrillaService, CuadrillaActividad, CuadrillaTecnico, CuadrillaProyectoOpcion,
  CuadrillaSupervisorOpcion, CuadrillaActividadInput, soloFecha, esCruceHorario, mensajeError
} from '../../../core/services/cuadrilla';
import { CuadrillasKpiComponent } from './cuadrillas-kpi';

type Modo = 'mes' | 'q1' | 'q2' | 'semana';
type Tab = 'agenda' | 'actividades' | 'kpi';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDias = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const lunesDe = (d: Date) => { const r = new Date(d); const w = r.getDay(); r.setDate(r.getDate() + (w === 0 ? -6 : 1 - w)); r.setHours(0, 0, 0, 0); return r; };
const aMin = (h?: string | null) => { if (!h) return null; const [a, b] = h.split(':').map(Number); return a * 60 + b; };

export const ESTADOS_EJECUCION = ['Planeada', 'En ejecución', 'Finalizada', 'Bloqueada', 'Reprogramada'];
export const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];
export const ESTADOS_PLANIFICACION = ['Programada', 'Pendiente de confirmar', 'Reprogramada', 'Cancelada'];
export const TIPOS_REGISTRO = [
  { v: 'Actividad', t: 'Actividad' },
  { v: 'VisitaSupervision', t: 'Visita de supervisión' },
  { v: 'Locativa', t: 'Locativa / oficina' },
  { v: 'Permiso', t: 'Permiso' },
  { v: 'Descanso', t: 'Descanso / compensatorio' },
  { v: 'Disponible', t: 'Disponible' },
];

const COLOR_ESTADO: Record<string, string> = {
  'Planeada': 'bg-blue-100 text-blue-800 border-blue-300',
  'En ejecución': 'bg-amber-100 text-amber-800 border-amber-300',
  'Finalizada': 'bg-green-100 text-green-800 border-green-300',
  'Bloqueada': 'bg-red-100 text-red-800 border-red-300',
  'Reprogramada': 'bg-purple-100 text-purple-800 border-purple-300',
};

@Component({
  selector: 'app-cuadrillas',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, CuadrillasKpiComponent],
  templateUrl: './cuadrillas.html',
})
export class CuadrillasComponent implements OnInit {
  private svc = inject(CuadrillaService);
  private fb = inject(FormBuilder);
  auth = inject(AuthService);

  readonly estados = ESTADOS_EJECUCION;
  readonly prioridades = PRIORIDADES;
  readonly estadosPlan = ESTADOS_PLANIFICACION;
  readonly tipos = TIPOS_REGISTRO;
  readonly diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  puedeProgramar = this.auth.hasPermission('proyectos.cuadrillas.programar');
  puedeKpi = this.auth.hasPermission('proyectos.cuadrillas.kpi');
  puedeConfig = this.auth.hasPermission('proyectos.cuadrillas.config');
  diasMaxRetro = signal(7);

  modo = signal<Modo>('mes');
  ancla = signal<Date>(new Date());
  tab = signal<Tab>('agenda');
  cargando = signal(false);

  actividades = signal<CuadrillaActividad[]>([]);
  tecnicos = signal<CuadrillaTecnico[]>([]);
  proyectos = signal<CuadrillaProyectoOpcion[]>([]);
  supervisores = signal<CuadrillaSupervisorOpcion[]>([]);

  filtroTecnico = signal('');
  filtroProyecto = signal('');
  filtroEstado = signal('');
  busqueda = signal('');

  // Modales
  detalle = signal<CuadrillaActividad | null>(null);
  formAbierto = signal(false);
  editandoId = signal<string | null>(null);
  guardando = signal(false);

  form = this.fb.group({
    fecha: ['', Validators.required],
    tecnicoId: ['', Validators.required],
    tipoRegistro: ['Actividad', Validators.required],
    proyectoId: [''],
    proyectoReferencia: [''],
    actividad: [''],
    ot: [''],
    horaInicio: [''],
    horaFin: [''],
    horasPlaneadas: [null as number | null],
    prioridad: ['Media'],
    estado: ['Planeada'],
    estadoPlanificacion: ['Programada'],
    supervisorTipo: [''],
    supervisorContactoId: [''],
    supervisorUsuarioId: [''],
    supervisorNombre: [''],
    observaciones: [''],
    repetirHasta: [''],
  });

  ejec = this.fb.group({
    estado: ['Planeada', Validators.required],
    horasReales: [null as number | null],
    tipoNovedad: [''],
    detalleBloqueo: [''],
    siguienteAccion: [''],
    observaciones: [''],
    fechaCierre: [''],
  });

  // ---------- Lote: varios técnicos / varios días ----------
  extraTecnicos = signal<string[]>([]);
  diasRep = signal<boolean[]>([true, true, true, true, true, false, false]); // Lun..Dom

  toggleExtra(id: string) {
    this.extraTecnicos.update(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);
  }
  toggleDia(i: number) {
    this.diasRep.update(l => l.map((v, k) => k === i ? !v : v));
  }
  fechasLote(): string[] {
    const f = this.form.value.fecha;
    const h = this.form.value.repetirHasta;
    if (!f) return [];
    const res = [f];
    if (h && h > f) {
      const tope = fmt(addDias(parse(f), 120));
      const fin = parse(h > tope ? tope : h);
      for (let d = addDias(parse(f), 1); d <= fin; d = addDias(d, 1)) {
        if (this.diasRep()[(d.getDay() + 6) % 7]) res.push(fmt(d));
      }
    }
    return res;
  }
  tecnicosLote(): string[] {
    const t = this.form.value.tecnicoId;
    return t ? [t, ...this.extraTecnicos().filter(x => x !== t)] : [];
  }
  totalLote(): number { return this.fechasLote().length * this.tecnicosLote().length; }

  // ---------- Exportar ----------
  exportando = signal(false);
  exportar() {
    const r = this.rango();
    this.exportando.set(true);
    this.svc.exportarExcel(r.desde, r.hasta, this.filtroTecnico() || null).subscribe({
      next: blob => {
        this.exportando.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cuadrillas_${r.desde}_${r.hasta}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.exportando.set(false);
        Swal.fire('No se pudo exportar', 'No se pudo generar el archivo de Excel. Intenta de nuevo.', 'error');
      }
    });
  }

  // ---------- Copiar semana ----------
  copiaAbierta = signal(false);
  copiaOrigen = signal('');
  copiaDestino = signal('');

  abrirCopia() {
    const base = lunesDe(parse(this.rango().desde));
    this.copiaOrigen.set(fmt(base));
    this.copiaDestino.set(fmt(addDias(base, 7)));
    this.copiaAbierta.set(true);
  }
  cerrarCopia() { this.copiaAbierta.set(false); }

  nombreFiltroTecnico() {
    return this.tecnicos().find(t => t.id === this.filtroTecnico())?.nombre ?? '';
  }

  ejecutarCopia(permitirCruce = false) {
    if (!this.copiaOrigen() || !this.copiaDestino()) return;
    this.guardando.set(true);
    const ids = this.filtroTecnico() ? [this.filtroTecnico()] : null;
    this.svc.copiarSemana(this.copiaOrigen(), this.copiaDestino(), ids, permitirCruce).subscribe({
      next: r => {
        this.guardando.set(false);
        this.copiaAbierta.set(false);
        Swal.fire({
          icon: 'success', title: `${r.copiadas} actividad(es) copiada(s)`,
          text: r.omitidas ? `${r.omitidas} omitida(s): ya existían en la semana destino o son de técnicos inactivos.` : undefined
        });
        this.ancla.set(parse(this.copiaDestino()));
        this.cargar();
      },
      error: async e => {
        this.guardando.set(false);
        if (esCruceHorario(e)) {
          const r = await Swal.fire({
            title: 'Cruce de horario', text: `${mensajeError(e)}`, icon: 'warning',
            showCancelButton: true, confirmButtonText: 'Copiar de todas formas', cancelButtonText: 'Cancelar'
          });
          if (r.isConfirmed) this.ejecutarCopia(true);
        } else {
          Swal.fire('No se pudo copiar', mensajeError(e), 'error');
        }
      }
    });
  }

  // ---------- Rango ----------
  rango = computed(() => {
    const a = this.ancla();
    const m = this.modo();
    let d: Date, h: Date;
    if (m === 'semana') { d = lunesDe(a); h = addDias(d, 6); }
    else if (m === 'q1') { d = new Date(a.getFullYear(), a.getMonth(), 1); h = new Date(a.getFullYear(), a.getMonth(), 15); }
    else if (m === 'q2') { d = new Date(a.getFullYear(), a.getMonth(), 16); h = new Date(a.getFullYear(), a.getMonth() + 1, 0); }
    else { d = new Date(a.getFullYear(), a.getMonth(), 1); h = new Date(a.getFullYear(), a.getMonth() + 1, 0); }
    return { desde: fmt(d), hasta: fmt(h) };
  });

  tituloRango = computed(() => {
    const a = this.ancla();
    const m = this.modo();
    const r = this.rango();
    if (m === 'semana') return `Semana ${r.desde} → ${r.hasta}`;
    const base = `${this.meses[a.getMonth()]} ${a.getFullYear()}`;
    if (m === 'q1') return `${base} · 1ª quincena (1–15)`;
    if (m === 'q2') return `${base} · 2ª quincena (16–fin)`;
    return base;
  });

  // ---------- Datos filtrados ----------
  filtradas = computed(() => {
    const t = this.filtroTecnico(), p = this.filtroProyecto(), e = this.filtroEstado();
    const q = this.busqueda().trim().toLowerCase();
    return this.actividades().filter(a => {
      if (t && a.tecnicoId !== t) return false;
      if (p && a.proyectoId !== p) return false;
      if (e && a.estado !== e) return false;
      if (q) {
        const txt = `${a.actividad} ${a.ot ?? ''} ${a.proyecto?.nombre ?? ''} ${a.proyectoReferencia ?? ''} ${a.tecnico?.nombre ?? ''}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    }).sort((x, y) => soloFecha(x.fecha).localeCompare(soloFecha(y.fecha)) || (x.horaInicio ?? '').localeCompare(y.horaInicio ?? ''));
  });

  /** Ids de actividades con cruce horario (mismo técnico, mismo día, horario traslapado) */
  cruces = computed(() => {
    const set = new Set<string>();
    const grupos = new Map<string, CuadrillaActividad[]>();
    for (const a of this.actividades()) {
      if (!a.horaInicio || !a.horaFin || a.estadoPlanificacion === 'Cancelada') continue;
      if (a.tipoRegistro === 'Permiso' || a.tipoRegistro === 'Descanso') continue;
      const k = `${a.tecnicoId}|${soloFecha(a.fecha)}`;
      (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(a);
    }
    grupos.forEach(lista => {
      for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i], b = lista[j];
        if (aMin(a.horaInicio)! < aMin(b.horaFin)! && aMin(b.horaInicio)! < aMin(a.horaFin)!) { set.add(a.id); set.add(b.id); }
      }
    });
    return set;
  });

  /** Semanas (filas) del calendario que cubren el rango, comenzando en lunes */
  semanas = computed(() => {
    const r = this.rango();
    const ini = lunesDe(parse(r.desde));
    const fin = parse(r.hasta);
    const filas: { fecha: string; enRango: boolean; acts: CuadrillaActividad[] }[][] = [];
    const porDia = new Map<string, CuadrillaActividad[]>();
    for (const a of this.filtradas()) {
      const k = soloFecha(a.fecha);
      (porDia.get(k) ?? porDia.set(k, []).get(k)!).push(a);
    }
    let cur = ini;
    while (cur <= fin) {
      const fila = [];
      for (let i = 0; i < 7; i++) {
        const f = fmt(cur);
        fila.push({ fecha: f, enRango: f >= r.desde && f <= r.hasta, acts: porDia.get(f) ?? [] });
        cur = addDias(cur, 1);
      }
      filas.push(fila);
    }
    return filas;
  });

  proyectoSeleccionado = computed(() => this.proyectos().find(p => p.id === this.form.value.proyectoId) ?? null);

  ngOnInit(): void {
    this.svc.getTecnicos().subscribe(t => this.tecnicos.set(t));
    this.svc.getParametros().subscribe(p => this.diasMaxRetro.set(p.diasMaxRetroactivo));
    if (this.puedeProgramar) {
      this.svc.getProyectosDisponibles().subscribe(p => this.proyectos.set(p));
      this.svc.getSupervisoresInternos().subscribe(s => this.supervisores.set(s));
    }
    this.cargar();
  }

  // ---------- Navegación de periodo ----------
  setModo(m: Modo) { this.modo.set(m); this.cargar(); }
  mover(dir: number) {
    const a = this.ancla();
    if (this.modo() === 'semana') this.ancla.set(addDias(a, 7 * dir));
    else this.ancla.set(new Date(a.getFullYear(), a.getMonth() + dir, 1));
    this.cargar();
  }
  hoy() { this.ancla.set(new Date()); this.cargar(); }

  cargar() {
    this.cargando.set(true);
    const r = this.rango();
    this.svc.getActividades(r.desde, r.hasta).subscribe({
      next: a => { this.actividades.set(a); this.cargando.set(false); },
      error: e => { this.cargando.set(false); Swal.fire('Error', mensajeError(e), 'error'); }
    });
  }

  // ---------- Presentación ----------
  fechaCorta(f: string) { return parse(f).getDate(); }
  nombreDia(f: string) { return this.diasSemana[(parse(f).getDay() + 6) % 7]; }
  esHoy(f: string) { return f === fmt(new Date()); }
  claseEstado(e: string) { return COLOR_ESTADO[e] ?? 'bg-gray-100 text-gray-700 border-gray-300'; }
  fecha(a: CuadrillaActividad) { return soloFecha(a.fecha); }
  nombreProyecto(a: CuadrillaActividad) {
    return a.proyecto ? `${a.proyecto.codigo} · ${a.proyecto.nombre}` : (a.proyectoReferencia || '—');
  }
  horario(a: CuadrillaActividad) { return a.horaInicio && a.horaFin ? `${a.horaInicio}–${a.horaFin}` : ''; }
  etiquetaTipo(v: string) { return this.tipos.find(t => t.v === v)?.t ?? v; }
  esNoLaboral(a: CuadrillaActividad) { return a.tipoRegistro === 'Permiso' || a.tipoRegistro === 'Descanso'; }

  // ---------- Detalle / ejecución ----------
  abrirDetalle(a: CuadrillaActividad) {
    this.detalle.set(a);
    this.ejec.reset({
      estado: a.estado, horasReales: a.horasReales ?? null, tipoNovedad: a.tipoNovedad ?? '',
      detalleBloqueo: a.detalleBloqueo ?? '', siguienteAccion: a.siguienteAccion ?? '',
      observaciones: a.observaciones ?? '', fechaCierre: soloFecha(a.fechaCierre),
    });
    this.svc.getActividad(a.id).subscribe(full => { if (full && this.detalle()?.id === a.id) this.detalle.set(full); });
  }
  cerrarDetalle() { this.detalle.set(null); }

  guardarEjecucion() {
    const a = this.detalle(); if (!a) return;
    const v = this.ejec.getRawValue();
    if (v.estado === 'Bloqueada' && !(v.detalleBloqueo || '').trim()) {
      Swal.fire('Falta el detalle', 'Para marcar la actividad como Bloqueada debes describir el bloqueo.', 'warning');
      return;
    }
    this.guardando.set(true);
    this.svc.actualizarEjecucion(a.id, {
      estado: v.estado!, horasReales: v.horasReales, tipoNovedad: v.tipoNovedad || null,
      detalleBloqueo: v.detalleBloqueo || null, siguienteAccion: v.siguienteAccion || null,
      observaciones: v.observaciones || null, fechaCierre: v.fechaCierre || null,
    }).subscribe({
      next: () => { this.guardando.set(false); this.cerrarDetalle(); this.cargar(); },
      error: e => { this.guardando.set(false); Swal.fire('No se pudo guardar', mensajeError(e), 'error'); }
    });
  }

  // ---------- Planeación ----------
  nueva(fecha?: string) {
    this.editandoId.set(null);
    this.form.reset({
      fecha: fecha ?? fmt(new Date()), tecnicoId: this.filtroTecnico() || '', tipoRegistro: 'Actividad',
      proyectoId: '', proyectoReferencia: '', actividad: '', ot: '', horaInicio: '', horaFin: '',
      horasPlaneadas: null, prioridad: 'Media', estado: 'Planeada', estadoPlanificacion: 'Programada',
      supervisorTipo: '', supervisorContactoId: '', supervisorUsuarioId: '', supervisorNombre: '', observaciones: '', repetirHasta: '',
    });
    this.extraTecnicos.set([]);
    this.diasRep.set([true, true, true, true, true, false, false]);
    this.supervisoresCliente.set([]);
    this.formAbierto.set(true);
  }

  editar(a: CuadrillaActividad) {
    this.cerrarDetalle();
    this.editandoId.set(a.id);
    this.form.reset({
      fecha: soloFecha(a.fecha), tecnicoId: a.tecnicoId, tipoRegistro: a.tipoRegistro,
      proyectoId: a.proyectoId ?? '', proyectoReferencia: a.proyectoReferencia ?? '', actividad: a.actividad ?? '',
      ot: a.ot ?? '', horaInicio: a.horaInicio ?? '', horaFin: a.horaFin ?? '', horasPlaneadas: a.horasPlaneadas ?? null,
      prioridad: a.prioridad, estado: a.estado, estadoPlanificacion: a.estadoPlanificacion,
      supervisorTipo: a.supervisorTipo ?? '', supervisorContactoId: a.supervisorContactoId ?? '',
      supervisorUsuarioId: a.supervisorUsuarioId ?? '', supervisorNombre: a.supervisorNombre ?? '',
      observaciones: a.observaciones ?? '', repetirHasta: '',
    });
    this.cargarSupervisoresCliente();
    this.formAbierto.set(true);
  }

  cerrarForm() { this.formAbierto.set(false); }

  /** Al elegir proyecto: hereda línea y recarga contactos del cliente */
  alCambiarProyecto() {
    this.cargarSupervisoresCliente();
  }

  supervisoresCliente = signal<CuadrillaSupervisorOpcion[]>([]);
  private cargarSupervisoresCliente() {
    const pid = this.form.value.proyectoId;
    if (!pid) { this.supervisoresCliente.set([]); return; }
    this.svc.getSupervisoresCliente(pid).subscribe(s => this.supervisoresCliente.set(s));
  }

  /** Valida la fecha frente a la ventana configurada; devuelve false si se cancela. */
  private async confirmarFechaPasada(fecha: string): Promise<boolean> {
    const hoy = fmt(new Date());
    if (fecha >= hoy) return true;
    const limite = fmt(addDias(new Date(), -this.diasMaxRetro()));
    if (fecha < limite && !this.puedeConfig) {
      await Swal.fire('Fecha fuera de la ventana',
        `Solo puedes trabajar con fechas desde ${limite} (${this.diasMaxRetro()} días hacia atrás). Para fechas anteriores solicita apoyo a un administrador de Cuadrillas.`, 'warning');
      return false;
    }
    const r = await Swal.fire({
      title: 'Fecha pasada', icon: 'warning', showCancelButton: true,
      text: 'Estás programando en una fecha anterior a hoy. Esto puede afectar los KPI de ese periodo. ¿Continuar?',
      confirmButtonText: 'Sí, continuar', cancelButtonText: 'Revisar'
    });
    return r.isConfirmed;
  }

  async guardar(permitirCruce = false) {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (!permitirCruce && !(await this.confirmarFechaPasada(this.form.getRawValue().fecha!))) return;
    const v = this.form.getRawValue();
    const tipo = v.tipoRegistro!;
    if (tipo === 'Actividad' && !(v.actividad || '').trim()) {
      Swal.fire('Falta la actividad', 'Describe la actividad a realizar.', 'warning'); return;
    }
    const proy = this.proyectoSeleccionado();
    const input: CuadrillaActividadInput = {
      fecha: v.fecha!, tecnicoId: v.tecnicoId!, tipoRegistro: tipo,
      proyectoId: v.proyectoId || null, proyectoReferencia: v.proyectoId ? null : (v.proyectoReferencia || null),
      lineaNegocio: proy?.lineaNegocio ?? null,
      actividad: v.actividad || null, ot: v.ot || null,
      horaInicio: v.horaInicio || null, horaFin: v.horaFin || null, horasPlaneadas: v.horasPlaneadas,
      prioridad: v.prioridad, estado: v.estado, estadoPlanificacion: v.estadoPlanificacion,
      supervisorTipo: v.supervisorTipo || null,
      supervisorContactoId: v.supervisorTipo === 'CLIENTE' ? (v.supervisorContactoId || null) : null,
      supervisorUsuarioId: v.supervisorTipo === 'INTERNO' ? (v.supervisorUsuarioId || null) : null,
      supervisorNombre: v.supervisorNombre || null,
      observaciones: v.observaciones || null, permitirCruce,
    };
    const id = this.editandoId();

    // Lote: varios técnicos y/o varios días (solo al crear)
    if (!id && this.totalLote() > 1) {
      if (!permitirCruce) {
        const c = await Swal.fire({
          title: `Crear ${this.totalLote()} actividades`,
          text: `${this.tecnicosLote().length} técnico(s) × ${this.fechasLote().length} día(s).`,
          icon: 'question', showCancelButton: true, confirmButtonText: 'Crear', cancelButtonText: 'Revisar'
        });
        if (!c.isConfirmed) return;
      }
      this.guardando.set(true);
      this.svc.crearLote(input, this.tecnicosLote(), this.fechasLote()).subscribe({
        next: () => { this.guardando.set(false); this.formAbierto.set(false); this.cargar(); },
        error: async e => {
          this.guardando.set(false);
          if (esCruceHorario(e)) {
            const r = await Swal.fire({
              title: 'Cruce de horario', text: mensajeError(e), icon: 'warning',
              showCancelButton: true, confirmButtonText: 'Guardar con cruce', cancelButtonText: 'Revisar'
            });
            if (r.isConfirmed) this.guardar(true);
          } else {
            Swal.fire('No se pudo guardar', mensajeError(e), 'error');
          }
        }
      });
      return;
    }

    this.guardando.set(true);
    (id ? this.svc.actualizarActividad(id, input) : this.svc.crearActividad(input)).subscribe({
      next: () => { this.guardando.set(false); this.formAbierto.set(false); this.cargar(); },
      error: async e => {
        this.guardando.set(false);
        if (esCruceHorario(e)) {
          const r = await Swal.fire({
            title: 'Cruce de horario', text: `${mensajeError(e)} ¿Deseas guardar de todas formas?`,
            icon: 'warning', showCancelButton: true, confirmButtonText: 'Guardar con cruce', cancelButtonText: 'Revisar'
          });
          if (r.isConfirmed) this.guardar(true);
        } else {
          Swal.fire('No se pudo guardar', mensajeError(e), 'error');
        }
      }
    });
  }

  async eliminar(a: CuadrillaActividad) {
    const r = await Swal.fire({
      title: '¿Eliminar actividad?', text: a.actividad || this.etiquetaTipo(a.tipoRegistro), icon: 'warning',
      showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626'
    });
    if (!r.isConfirmed) return;
    this.svc.eliminarActividad(a.id).subscribe({
      next: () => { this.cerrarDetalle(); this.cargar(); },
      error: e => Swal.fire('Error', mensajeError(e), 'error')
    });
  }
}
