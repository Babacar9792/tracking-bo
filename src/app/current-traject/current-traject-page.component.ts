import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewInit,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import {
  TrackingService,
  TrajetDto,
  TrackingPoint,
  TrackingError,
  OptimalRoute
} from '../tracking/tracking.service';

type WsStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

@Component({
  selector: 'app-current-traject-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-screen flex flex-col bg-gray-900">

      <!-- Header -->
      <header class="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-10 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
          </div>
          <div>
            <h1 class="text-white font-bold text-sm leading-none">Itinéraire en cours</h1>
            @if (trajet()) {
              <p class="text-gray-400 text-xs mt-0.5">{{ trajet()!.clientId }}</p>
            }
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Distance + ETA chips -->
          @if (routeDistanceKm() > 0) {
            <div class="flex items-center gap-2">
              <div class="bg-gray-800 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
                <span class="text-white text-xs font-semibold">{{ routeDistanceKm() }} km</span>
              </div>
              <div class="bg-gray-800 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="text-white text-xs font-semibold">{{ routeDurationMin() }} min</span>
              </div>
            </div>
          }

          <!-- WS status -->
          <div class="flex items-center gap-1.5 text-xs font-medium">
            @if (wsStatus() === 'connected') {
              <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span class="text-emerald-400">En direct</span>
            } @else if (wsStatus() === 'connecting') {
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span class="text-amber-400">Connexion...</span>
            } @else if (wsStatus() === 'error') {
              <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>
              <span class="text-red-400">Hors ligne</span>
            }
          </div>
        </div>
      </header>

      <!-- Recalc banner -->
      @if (isRecalculating()) {
        <div class="bg-amber-500 px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span class="text-white text-xs font-semibold">Déviation détectée — Recalcul de l'itinéraire...</span>
        </div>
      }

      <!-- Map (fills remaining height) -->
      <div class="flex-1 relative">

        @if (loading()) {
          <div class="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-20 gap-4">
            <div class="relative w-14 h-14">
              <div class="absolute inset-0 rounded-full border-4 border-gray-700"></div>
              <div class="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
            </div>
            <p class="text-gray-300 text-sm font-medium">Chargement du trajet...</p>
          </div>
        }

        @if (error() && !loading()) {
          <div class="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-20 gap-4 px-8 text-center">
            <div class="w-14 h-14 bg-red-900/50 rounded-2xl flex items-center justify-center">
              <svg class="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div>
              <p class="text-white font-semibold">{{ errorLabel() }}</p>
              <p class="text-gray-400 text-sm mt-1">Vérifiez le shareToken et réessayez.</p>
            </div>
          </div>
        }

        @if (!error() && !loading() && !livePoint() && wsStatus() !== 'error') {
          <div class="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-20 gap-3">
            <div class="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-gray-300 text-sm">En attente de la position GPS...</p>
          </div>
        }

        <div #mapContainer class="w-full h-full"></div>

        <!-- Live coordinates overlay -->
        @if (livePoint()) {
          <div class="absolute bottom-6 left-4 z-10 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl px-4 py-3 shadow-xl">
            <div class="flex items-center gap-2 mb-2">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span class="text-blue-400 text-xs font-semibold uppercase tracking-wider">Position actuelle</span>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span class="text-gray-400 text-xs">Latitude</span>
              <span class="text-white font-mono text-xs font-semibold">{{ livePoint()!.latitude.toFixed(6) }}</span>
              <span class="text-gray-400 text-xs">Longitude</span>
              <span class="text-white font-mono text-xs font-semibold">{{ livePoint()!.longitude.toFixed(6) }}</span>
              <span class="text-gray-400 text-xs">Mis à jour</span>
              <span class="text-white font-mono text-xs">{{ formatTime(livePoint()!.timestamp) }}</span>
            </div>
          </div>
        }
      </div>

    </div>
  `
})
export class CurrentTrajectPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private readonly route = inject(ActivatedRoute);
  private readonly trackingService = inject(TrackingService);
  private readonly ngZone = inject(NgZone);

  shareToken = signal<string | null>(null);
  trajet = signal<TrajetDto | null>(null);
  livePoint = signal<TrackingPoint | null>(null);
  loading = signal(false);
  error = signal<TrackingError | null>(null);
  wsStatus = signal<WsStatus>('disconnected');
  routeDistanceKm = signal<number>(0);
  routeDurationMin = signal<number>(0);
  isRecalculating = signal(false);

  private subs: Subscription[] = [];
  private map: L.Map | null = null;
  private routePolyline: L.Polyline | null = null;
  private mobileMarker: L.Marker | null = null;
  private arrivalMarker: L.Marker | null = null;
  private mapReady = false;

  private readonly DEVIATION_THRESHOLD_M = 300;
  private readonly RECALC_COOLDOWN_MS = 30_000;
  private lastRecalcAt = 0;

  errorLabel = computed(() => {
    const labels: Record<string, string> = {
      INVALID_TOKEN: 'Token invalide',
      EXPIRED_TOKEN: 'Token expiré',
      NOT_FOUND: 'Trajet introuvable',
      NETWORK_ERROR: 'Erreur réseau'
    };
    return labels[this.error() ?? 'NETWORK_ERROR'];
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const token = params.get('shareToken');
      this.shareToken.set(token);
      if (token) this.load(token);
    });
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initMap();
      this.injectStyles();
    });
    this.mapReady = true;
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.map?.remove();
  }

  // --- Map init ---

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [48.8566, 2.3522],
      zoom: 13,
      zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
  }

  private injectStyles(): void {
    if (document.getElementById('current-traject-styles')) return;
    const style = document.createElement('style');
    style.id = 'current-traject-styles';
    style.textContent = `
      @keyframes mobileRing {
        0%   { transform: scale(1);   opacity: 0.8; }
        100% { transform: scale(2.8); opacity: 0; }
      }
      .mobile-ring {
        position: absolute; inset: 0;
        border-radius: 50%;
        background: rgba(59,130,246,0.5);
        animation: mobileRing 1.4s ease-out infinite;
      }
      .mobile-dot {
        position: absolute; inset: 7px;
        background: #2563eb;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 2px #3b82f6, 0 4px 12px rgba(37,99,235,0.6);
      }
    `;
    document.head.appendChild(style);
  }

  // --- Data loading ---

  private load(shareToken: string): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
    this.loading.set(true);
    this.error.set(null);
    this.livePoint.set(null);
    this.trajet.set(null);
    this.wsStatus.set('disconnected');

    const trajetSub = this.trackingService.getTrajet(shareToken).subscribe({
      next: (trajet) => {
        this.trajet.set(trajet);
        this.loading.set(false);
        this.ngZone.runOutsideAngular(() => this.renderArrivalMarker(trajet));
        this.connectLive(trajet.id);
      },
      error: (err: { type: TrackingError }) => {
        this.error.set(err.type ?? 'NETWORK_ERROR');
        this.loading.set(false);
      }
    });

    this.subs.push(trajetSub);
  }

  private connectLive(trajetId: string): void {
    this.wsStatus.set('connecting');

    const liveSub = this.trackingService.connectLive(trajetId).subscribe({
      next: (point) => {
        this.wsStatus.set('connected');
        this.livePoint.set(point);
        this.ngZone.runOutsideAngular(() => this.updateMobileMarker(point));
        this.recalcRouteFrom(point);
      },
      error: () => this.wsStatus.set('error')
    });

    this.subs.push(liveSub);
  }

  // --- Route recalculation ---

  private recalcRouteFrom(point: TrackingPoint, force = false): void {
    const trajet = this.trajet();
    if (!trajet) return;

    const now = Date.now();
    if (!force && now - this.lastRecalcAt < this.RECALC_COOLDOWN_MS) return;

    const currentRoute = this.routePolyline?.getLatLngs() as L.LatLng[] | undefined;
    if (!force && currentRoute && currentRoute.length > 0) {
      const minDist = Math.min(...currentRoute.map((ll) =>
        this.haversineM(point.latitude, point.longitude, ll.lat, ll.lng)
      ));
      if (minDist <= this.DEVIATION_THRESHOLD_M) return;
      this.isRecalculating.set(true);
    } else {
      // First time — always calculate
      this.isRecalculating.set(true);
    }

    this.lastRecalcAt = now;

    const routeSub = this.trackingService
      .getOptimalRoute(
        point.latitude, point.longitude,
        trajet.arrivalLatitude, trajet.arrivalLongitude
      )
      .subscribe({
        next: (newRoute: OptimalRoute) => {
          const coords: [number, number][] = newRoute.coordinates.length > 0
            ? newRoute.coordinates
            : [[point.latitude, point.longitude], [trajet.arrivalLatitude, trajet.arrivalLongitude]];

          this.routeDistanceKm.set(Math.round(newRoute.distanceMeters / 100) / 10);
          this.routeDurationMin.set(Math.round(newRoute.durationSeconds / 60));
          this.ngZone.runOutsideAngular(() => this.renderRoute(coords));
          this.isRecalculating.set(false);
        },
        error: () => this.isRecalculating.set(false)
      });

    this.subs.push(routeSub);
  }

  // --- Leaflet rendering ---

  private renderRoute(coords: [number, number][]): void {
    if (!this.map) return;

    if (this.routePolyline) {
      this.routePolyline.setLatLngs(coords);
    } else {
      this.routePolyline = L.polyline(coords, {
        color: '#3b82f6',
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(this.map);
    }

    // Fit bounds only on first render
    if (coords.length > 1 && !this.mobileMarker) {
      this.map.fitBounds(this.routePolyline.getBounds(), { padding: [60, 60] });
    }
  }

  private updateMobileMarker(point: TrackingPoint): void {
    if (!this.map) return;
    const latlng: L.LatLngExpression = [point.latitude, point.longitude];

    if (this.mobileMarker) {
      this.mobileMarker.setLatLng(latlng);
    } else {
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:44px;height:44px">
                 <div class="mobile-ring"></div>
                 <div class="mobile-dot"></div>
               </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -26]
      });
      this.mobileMarker = L.marker(latlng, { icon, zIndexOffset: 2000 })
        .addTo(this.map)
        .bindPopup(`<div style="font-family:system-ui;font-weight:700;color:#1d4ed8;font-size:12px">Mobile — Position actuelle</div>`);
    }

    this.map.panTo(latlng);

    // On first point, calculate the route
    if (!this.routePolyline) {
      this.recalcRouteFrom(point, true);
    }
  }

  private renderArrivalMarker(trajet: TrajetDto): void {
    if (!this.map || !trajet.arrivalLatitude || !trajet.arrivalLongitude) return;

    if (this.arrivalMarker) {
      this.map.removeLayer(this.arrivalMarker);
    }

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:36px;height:36px;
        background:#ef4444;
        border:3px solid white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 4px 12px rgba(0,0,0,.3);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);color:white;font-size:12px;font-weight:700">A</span>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });

    this.arrivalMarker = L.marker(
      [trajet.arrivalLatitude, trajet.arrivalLongitude],
      { icon, zIndexOffset: 1000 }
    )
      .addTo(this.map)
      .bindPopup(`<div style="font-family:system-ui;font-weight:700;color:#b91c1c;font-size:12px">Arrivée</div>`);
  }

  // --- Geo utils ---

  private haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  formatTime(date: Date | string): string {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}
