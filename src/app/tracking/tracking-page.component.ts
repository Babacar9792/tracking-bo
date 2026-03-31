import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { MapComponent } from './map.component';
import {
  TrackingService,
  TrajetDto,
  TrackingPoint,
  TrackingError
} from './tracking.service';

type WsStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

@Component({
  selector: 'app-tracking-page',
  standalone: true,
  imports: [CommonModule, MapComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">

      <!-- Header -->
      <header class="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <div>
                <h1 class="text-lg font-bold text-gray-900">TrackingBO</h1>
                <p class="text-xs text-gray-500 leading-none">Suivi de déplacements</p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              @if (shareToken()) {
                <div class="hidden sm:flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                  <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                  </svg>
                  <span class="text-xs font-mono text-blue-700 max-w-[140px] truncate">{{ shareToken() }}</span>
                </div>
              }

              <!-- WebSocket status indicator -->
              @if (trajet()) {
                <div class="flex items-center gap-1.5 text-xs font-medium" [class]="wsStatusColor()">
                  @if (wsStatus() === 'connected') {
                    <span class="relative flex h-2.5 w-2.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    En direct
                  } @else if (wsStatus() === 'connecting') {
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                    Connexion...
                  } @else if (wsStatus() === 'error') {
                    <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                    Hors ligne
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </header>

      <!-- Main content -->
      <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <!-- No token -->
        @if (!shareToken()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div class="bg-white rounded-2xl p-10 shadow-lg border border-gray-100 text-center max-w-md">
              <div class="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg class="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h2 class="text-xl font-bold text-gray-900 mb-2">Aucun token fourni</h2>
              <p class="text-gray-500 text-sm">
                Accédez via <code class="text-blue-600 font-mono text-xs bg-blue-50 px-2 py-0.5 rounded">/tracking/&#123;shareToken&#125;</code>
              </p>
            </div>
          </div>
        }

        <!-- Loading -->
        @if (loading() && shareToken()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div class="bg-white rounded-2xl p-10 shadow-lg border border-gray-100 text-center">
              <div class="relative w-16 h-16 mx-auto mb-6">
                <div class="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                <div class="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                <div class="absolute inset-2 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  </svg>
                </div>
              </div>
              <h2 class="text-lg font-semibold text-gray-800 mb-1">Chargement du trajet</h2>
              <p class="text-sm text-gray-500">Récupération des données GPS...</p>
            </div>
          </div>
        }

        <!-- Error -->
        @if (error() && !loading()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div class="bg-white rounded-2xl p-10 shadow-lg border border-gray-100 text-center max-w-md w-full">
              <div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" [class]="errorConfig().bgClass">
                <svg class="w-8 h-8" [class]="errorConfig().iconClass" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="errorConfig().iconPath"/>
                </svg>
              </div>
              <h2 class="text-xl font-bold text-gray-900 mb-2">{{ errorConfig().title }}</h2>
              <p class="text-gray-500 text-sm mb-6">{{ errorConfig().message }}</p>
              <button (click)="retry()"
                class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Réessayer
              </button>
            </div>
          </div>
        }

        <!-- Loaded -->
        @if (trajet() && !loading() && !error()) {
          <div class="space-y-6 animate-slide-up">

            <!-- Trajet info -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="text-lg font-bold text-gray-900">{{ trajet()!.clientId }}</div>
                    <div class="text-xs text-gray-400 mt-0.5">
                      Créé le {{ formatDate(trajet()!.createdAt) }} à {{ formatTime(trajet()!.createdAt) }}
                    </div>
                  </div>
                </div>
                <span [class]="statutBadgeClass()" class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full self-start sm:self-auto">
                  <span class="w-1.5 h-1.5 rounded-full" [class]="statutDotClass()"></span>
                  {{ statutLabel() }}
                </span>
              </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div class="text-2xl font-bold text-blue-600">{{ points().length }}</div>
                <div class="text-xs text-gray-500 mt-0.5 font-medium">Points GPS</div>
              </div>
              <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div class="text-2xl font-bold text-violet-600">{{ duration() }}</div>
                <div class="text-xs text-gray-500 mt-0.5 font-medium">Durée</div>
              </div>
              <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100 col-span-2 sm:col-span-2">
                <div class="text-sm font-mono font-medium text-gray-500 truncate">{{ trajet()!.id }}</div>
                <div class="text-xs text-gray-400 mt-0.5 font-medium">ID du trajet</div>
              </div>
            </div>

            <!-- Map -->
            @if (points().length > 0) {
              <app-map [points]="points()" />
            } @else {
              <div class="bg-white rounded-xl shadow-sm border border-gray-100 h-64 flex flex-col items-center justify-center gap-3 text-center px-6">
                <div class="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  </svg>
                </div>
                @if (wsStatus() === 'connecting' || wsStatus() === 'connected') {
                  <p class="text-gray-500 font-medium">En attente de positions GPS...</p>
                  <p class="text-gray-400 text-sm">La carte s'affichera dès que le véhicule commencera à se déplacer</p>
                } @else {
                  <p class="text-gray-500 font-medium">Aucun point GPS disponible</p>
                  <p class="text-gray-400 text-sm">Aucun déplacement enregistré pour ce trajet</p>
                }
              </div>
            }

            <!-- History table -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-lg font-semibold text-gray-900">Historique des positions</h2>
                <span class="text-xs text-gray-400">{{ points().length }} enregistrement{{ points().length > 1 ? 's' : '' }}</span>
              </div>

              <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                @if (points().length === 0) {
                  <div class="flex flex-col items-center justify-center py-16 text-center">
                    <p class="text-gray-500 font-medium">Aucune position enregistrée</p>
                    <p class="text-gray-400 text-sm mt-1">Les positions apparaîtront ici en temps réel</p>
                  </div>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="w-full">
                      <thead>
                        <tr class="bg-gray-50 border-b border-gray-100">
                          <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                          <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Heure</th>
                          <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Latitude</th>
                          <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Longitude</th>
                          <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-50">
                        @for (point of points(); track point.id ?? point.timestamp; let i = $index) {
                          <tr class="hover:bg-blue-50/50 transition-colors duration-100">
                            <td class="px-4 py-3">
                              <span class="text-xs font-mono text-gray-400">{{ i + 1 }}</span>
                            </td>
                            <td class="px-4 py-3">
                              <div class="text-sm font-medium text-gray-900">{{ formatDate(point.timestamp) }}</div>
                              <div class="text-xs text-gray-400">{{ formatTime(point.timestamp) }}</div>
                            </td>
                            <td class="px-4 py-3">
                              <span class="text-sm font-mono text-gray-600">{{ point.latitude.toFixed(6) }}</span>
                            </td>
                            <td class="px-4 py-3">
                              <span class="text-sm font-mono text-gray-600">{{ point.longitude.toFixed(6) }}</span>
                            </td>
                            <td class="px-4 py-3">
                              @if (i === 0) {
                                <span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-md">Départ</span>
                              } @else if (i === points().length - 1) {
                                <span class="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-md">Position actuelle</span>
                              } @else {
                                <span class="inline-flex items-center gap-1 bg-gray-50 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-md">En route</span>
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            </div>

          </div>
        }

      </main>
    </div>
  `
})
export class TrackingPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly trackingService = inject(TrackingService);

  shareToken = signal<string | null>(null);
  trajet = signal<TrajetDto | null>(null);
  points = signal<TrackingPoint[]>([]);
  loading = signal(false);
  error = signal<TrackingError | null>(null);
  wsStatus = signal<WsStatus>('disconnected');

  private subs: Subscription[] = [];

  // --- Computed ---

  statutLabel = computed(() => {
    const labels: Record<string, string> = {
      STARTED: 'Démarré',
      IN_PROGRESS: 'En cours',
      STOPPED: 'Arrêté',
      COMPLETED: 'Terminé'
    };
    const s = this.trajet()?.statut ?? '';
    return labels[s] ?? s;
  });

  statutBadgeClass = computed(() => {
    const classes: Record<string, string> = {
      STARTED: 'bg-blue-50 text-blue-700',
      IN_PROGRESS: 'bg-emerald-50 text-emerald-700',
      STOPPED: 'bg-red-50 text-red-700',
      COMPLETED: 'bg-gray-100 text-gray-600'
    };
    return classes[this.trajet()?.statut ?? ''] ?? 'bg-gray-100 text-gray-600';
  });

  statutDotClass = computed(() => {
    const classes: Record<string, string> = {
      STARTED: 'bg-blue-500',
      IN_PROGRESS: 'bg-emerald-500',
      STOPPED: 'bg-red-500',
      COMPLETED: 'bg-gray-400'
    };
    return classes[this.trajet()?.statut ?? ''] ?? 'bg-gray-400';
  });

  wsStatusColor = computed(() => {
    const colors: Record<WsStatus, string> = {
      connected: 'text-emerald-600',
      connecting: 'text-amber-500',
      error: 'text-red-500',
      disconnected: 'text-gray-400'
    };
    return colors[this.wsStatus()];
  });

  duration = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return '—';
    const diffMs = new Date(pts.at(-1)!.timestamp).getTime() - new Date(pts[0].timestamp).getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    if (hours > 0) return `${hours}h${minutes.toString().padStart(2, '0')}`;
    return `${minutes}min`;
  });

  errorConfig = computed(() => {
    const err = this.error();
    const configs: Record<string, { title: string; message: string; bgClass: string; iconClass: string; iconPath: string }> = {
      INVALID_TOKEN: {
        title: 'Token invalide',
        message: 'Le token de partage fourni est invalide ou mal formaté.',
        bgClass: 'bg-red-100', iconClass: 'text-red-500',
        iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
      },
      EXPIRED_TOKEN: {
        title: 'Token expiré',
        message: 'Ce lien de partage a expiré.',
        bgClass: 'bg-amber-100', iconClass: 'text-amber-500',
        iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
      },
      NOT_FOUND: {
        title: 'Trajet introuvable',
        message: "Aucun trajet associé à ce token n'a été trouvé.",
        bgClass: 'bg-blue-100', iconClass: 'text-blue-500',
        iconPath: 'M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
      },
      NETWORK_ERROR: {
        title: 'Erreur réseau',
        message: 'Impossible de contacter le serveur.',
        bgClass: 'bg-gray-100', iconClass: 'text-gray-500',
        iconPath: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0'
      }
    };
    return configs[err ?? 'NETWORK_ERROR'];
  });

  // --- Lifecycle ---

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const token = params.get('shareToken');
      this.shareToken.set(token);
      if (token) this.load(token);
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  retry(): void {
    const token = this.shareToken();
    if (token) {
      this.error.set(null);
      this.load(token);
    }
  }

  // --- Private ---

  private load(shareToken: string): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
    this.loading.set(true);
    this.error.set(null);
    this.points.set([]);
    this.trajet.set(null);
    this.wsStatus.set('disconnected');

    // Step 1 — fetch trajet metadata
    const trajetSub = this.trackingService.getTrajet(shareToken).subscribe({
      next: (trajet) => {
        this.trajet.set(trajet);
        this.loading.set(false);

        // Step 2 — load history
        this.loadHistory(trajet.id);

        // Step 3 — connect live
        this.connectLive(trajet.id);
      },
      error: (err: { type: TrackingError }) => {
        this.error.set(err.type ?? 'NETWORK_ERROR');
        this.loading.set(false);
      }
    });

    this.subs.push(trajetSub);
  }

  private loadHistory(trajetId: string): void {
    const historySub = this.trackingService.getHistory(trajetId).subscribe({
      next: (history) => {
        this.points.set(history);
      },
      error: () => {
        // History unavailable — not fatal, live will still work
      }
    });
    this.subs.push(historySub);
  }

  private connectLive(trajetId: string): void {
    this.wsStatus.set('connecting');

    const liveSub = this.trackingService.connectLive(trajetId).subscribe({
      next: (point) => {
        this.wsStatus.set('connected');
        // Avoid duplicates (live may replay last history point)
        const current = this.points();
        const isDuplicate = current.some(
          (p) => p.id && p.id === point.id
        );
        if (!isDuplicate) {
          this.points.set([...current, point]);
        }
      },
      error: () => {
        this.wsStatus.set('error');
      }
    });

    this.subs.push(liveSub);
  }

  // --- Helpers ---

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}