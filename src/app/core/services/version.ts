import { Injectable, inject, signal, computed } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { BUILD_INFO } from '../build-info';

export interface InfoVersion { fecha: string | null; commit: string | null; }

const GET_VERSION_API = gql`
  query VersionApi {
    versionApi { fecha commit }
  }
`;

/** Versión legible a partir de la fecha de compilación, en hora de Colombia: v2026.11.26-1603 */
export function etiquetaVersion(iso?: string | null): string {
  const p = partes(iso);
  return p ? `v${p.year}.${p.month}.${p.day}-${p.hour}${p.minute}` : 'desarrollo';
}

/** Fecha y hora completas para el detalle: 26/11/2026 16:03 */
export function fechaVersion(iso?: string | null): string {
  const p = partes(iso);
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : '—';
}

interface Partes { year: string; month: string; day: string; hour: string; minute: string; }

function partes(iso?: string | null): Partes | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const v = (t: string) => fmt.formatToParts(d).find(x => x.type === t)?.value ?? '';
  return { year: v('year'), month: v('month'), day: v('day'), hour: v('hour'), minute: v('minute') };
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  private apollo = inject(Apollo);

  readonly web: InfoVersion = { fecha: BUILD_INFO.fecha || null, commit: BUILD_INFO.commit || null };
  readonly api = signal<InfoVersion | null>(null);

  readonly etiquetaWeb = etiquetaVersion(this.web.fecha);
  readonly etiquetaApi = computed(() => this.api() ? etiquetaVersion(this.api()!.fecha) : '…');

  cargarApi(): void {
    this.apollo.query<{ versionApi: InfoVersion }>({ query: GET_VERSION_API, fetchPolicy: 'network-only' })
      .subscribe({
        next: r => this.api.set(r.data?.versionApi ?? null),
        error: () => this.api.set({ fecha: null, commit: null })
      });
  }
}
