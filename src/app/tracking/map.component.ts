import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  SimpleChanges,
  NgZone,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { TrackingPoint } from './tracking.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative rounded-xl shadow-lg border border-gray-200">
      <div #mapContainer class="map-container"></div>

      <!-- Legend -->
      <div class="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
        <div class="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md flex items-center gap-2 text-sm font-medium text-gray-700">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          Départ
        </div>
        <div class="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md flex items-center gap-2 text-sm font-medium text-gray-700">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
          Arrivée
        </div>
        @if (plannedRoute.length > 0) {
          <div class="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md flex items-center gap-2 text-sm font-medium text-gray-700">
            <svg width="20" height="4" viewBox="0 0 20 4"><line x1="0" y1="2" x2="20" y2="2" stroke="#8b5cf6" stroke-width="2.5" stroke-dasharray="6,4"/></svg>
            Route prévue
          </div>
        }
        @if (livePoint) {
          <div class="bg-blue-600/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md flex items-center gap-2 text-sm font-medium text-white">
            <span class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            En direct
          </div>
        }
      </div>

      <!-- Points count -->
      @if (points.length > 0) {
        <div class="absolute bottom-3 right-3 z-10">
          <div class="bg-blue-600/90 backdrop-blur-sm text-white rounded-lg px-3 py-1.5 shadow-md text-sm font-medium">
            {{ points.length }} point{{ points.length > 1 ? 's' : '' }}
          </div>
        </div>
      }
    </div>
  `
})
export class MapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @Input() points: TrackingPoint[] = [];
  @Input() plannedRoute: [number, number][] = [];
  @Input() livePoint: TrackingPoint | null = null;

  private map: L.Map | null = null;
  private polyline: L.Polyline | null = null;
  private startMarker: L.Marker | null = null;
  private endMarker: L.Marker | null = null;
  private midMarkers: L.CircleMarker[] = [];
  private renderedCount = 0;

  private plannedPolyline: L.Polyline | null = null;
  private plannedDepartureMarker: L.Marker | null = null;
  private plannedArrivalMarker: L.Marker | null = null;
  private liveMarker: L.Marker | null = null;

  private readonly ngZone = inject(NgZone);

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.injectLiveMarkerStyles();
      this.initMap();
      if (this.plannedRoute.length > 0) {
        this.renderPlannedRoute();
      }
      if (this.points.length > 0) {
        this.fullRender();
      }
      if (this.livePoint) {
        this.updateLiveMarker(this.livePoint);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;

    if (changes['plannedRoute'] && !changes['plannedRoute'].firstChange) {
      this.ngZone.runOutsideAngular(() => {
        this.clearPlannedRoute();
        if (this.plannedRoute.length > 0) {
          this.renderPlannedRoute();
        }
      });
    }

    if (changes['livePoint']) {
      const pt: TrackingPoint | null = changes['livePoint'].currentValue;
      this.ngZone.runOutsideAngular(() => {
        if (pt) this.updateLiveMarker(pt);
        else this.removeLiveMarker();
      });
    }

    if (changes['points'] && !changes['points'].firstChange) {
      const prev: TrackingPoint[] = changes['points'].previousValue ?? [];
      const curr: TrackingPoint[] = changes['points'].currentValue ?? [];

      this.ngZone.runOutsideAngular(() => {
        if (curr.length === 0) {
          this.clearGpsLayers();
        } else if (prev.length === 0 || curr.length < prev.length) {
          // Full re-render (first load or reset)
          this.clearGpsLayers();
          this.fullRender();
        } else if (curr.length > prev.length) {
          // Incremental: only add new points
          this.addIncrementalPoints(prev.length, curr);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  private injectLiveMarkerStyles(): void {
    if (document.getElementById('live-marker-styles')) return;
    const style = document.createElement('style');
    style.id = 'live-marker-styles';
    style.textContent = `
      @keyframes liveRing {
        0%   { transform: scale(1);   opacity: 0.7; }
        100% { transform: scale(2.4); opacity: 0; }
      }
      .live-ring {
        position: absolute; inset: 0;
        border-radius: 50%;
        background: rgba(59,130,246,0.45);
        animation: liveRing 1.6s ease-out infinite;
      }
      .live-dot {
        position: absolute; inset: 8px;
        background: #2563eb;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(37,99,235,0.6);
      }
    `;
    document.head.appendChild(style);
  }

  private updateLiveMarker(point: TrackingPoint): void {
    if (!this.map) return;
    const latlng: L.LatLngExpression = [point.latitude, point.longitude];

    // Hide the static end marker — the live marker replaces it
    if (this.endMarker) {
      this.map.removeLayer(this.endMarker);
      this.endMarker = null;
    }

    if (this.liveMarker) {
      this.liveMarker.setLatLng(latlng);
      this.liveMarker.setPopupContent(this.buildLivePopup(point));
    } else {
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:44px;height:44px">
                 <div class="live-ring"></div>
                 <div class="live-dot"></div>
               </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -26]
      });
      this.liveMarker = L.marker(latlng, { icon, zIndexOffset: 2000 })
        .addTo(this.map)
        .bindPopup(this.buildLivePopup(point));
    }
    this.map.panTo(latlng);
  }

  private removeLiveMarker(): void {
    if (this.liveMarker) {
      this.map?.removeLayer(this.liveMarker);
      this.liveMarker = null;
    }
  }

  private buildLivePopup(point: TrackingPoint): string {
    const d = new Date(point.timestamp);
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `
      <div style="font-family:system-ui,sans-serif;min-width:160px">
        <div style="font-weight:700;color:#1d4ed8;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <span style="display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:50%"></span>
          Position en direct
        </div>
        <div style="font-size:12px;color:#374151;line-height:1.6">
          <div>Lat : <b>${point.latitude.toFixed(6)}</b></div>
          <div>Lng : <b>${point.longitude.toFixed(6)}</b></div>
          <div style="color:#6b7280;margin-top:2px">${time}</div>
        </div>
      </div>`;
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [48.8566, 2.3522],
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
  }

  private fullRender(): void {
    if (!this.map || this.points.length === 0) return;

    const latlngs = this.toLatLngs(this.points);

    this.polyline = L.polyline(latlngs, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.85,
      smoothFactor: 1.5
    }).addTo(this.map);

    // Mid markers
    for (let i = 1; i < this.points.length - 1; i++) {
      this.midMarkers.push(this.createMidMarker(this.points[i], i + 1));
    }

    // Start marker
    this.startMarker = this.createPinMarker(this.points[0], '#10b981', 'D', 'Départ', 1);

    // End marker — skip if live marker is active
    if (this.points.length > 1 && !this.liveMarker) {
      this.endMarker = this.createPinMarker(
        this.points[this.points.length - 1],
        '#ef4444',
        'A',
        'Arrivée',
        this.points.length
      );
    }

    this.renderedCount = this.points.length;
    this.map.fitBounds(this.polyline.getBounds(), { padding: [40, 40] });
  }

  private addIncrementalPoints(prevCount: number, curr: TrackingPoint[]): void {
    if (!this.map || !this.polyline) return;

    // Promote the previous end point to a mid marker
    if (prevCount >= 2 && this.endMarker) {
      this.map.removeLayer(this.endMarker);
      this.endMarker = null;
      this.midMarkers.push(this.createMidMarker(curr[prevCount - 1], prevCount));
    }

    // If this is the second point ever, promote start to normal start (already done)
    // and add mid markers for intermediate new points
    const newPoints = curr.slice(prevCount);
    const newLatLngs = this.toLatLngs(newPoints);

    // Extend polyline
    const existing = (this.polyline.getLatLngs() as L.LatLng[]);
    this.polyline.setLatLngs([...existing, ...newLatLngs]);

    // Add mid markers for all new points except the last one
    for (let i = 0; i < newPoints.length - 1; i++) {
      this.midMarkers.push(this.createMidMarker(newPoints[i], prevCount + i + 1));
    }

    // New end marker — skip if live marker is active (it represents the current position)
    const lastPoint = curr[curr.length - 1];
    if (!this.liveMarker) {
      this.endMarker = this.createPinMarker(lastPoint, '#ef4444', 'A', 'Arrivée', curr.length);
    }

    // If start marker doesn't exist yet (was single point before), create it
    if (!this.startMarker) {
      this.startMarker = this.createPinMarker(curr[0], '#10b981', 'D', 'Départ', 1);
    }

    this.renderedCount = curr.length;

    // Pan only if no live marker (live marker already pans)
    if (!this.liveMarker) {
      this.map.panTo([lastPoint.latitude, lastPoint.longitude]);
    }
  }

  private createMidMarker(point: TrackingPoint, index: number): L.CircleMarker {
    return L.circleMarker([point.latitude, point.longitude], {
      radius: 5,
      color: '#2563eb',
      fillColor: '#93c5fd',
      fillOpacity: 0.9,
      weight: 2
    })
      .addTo(this.map!)
      .bindPopup(this.buildPopup(point, index));
  }

  private createPinMarker(
    point: TrackingPoint,
    color: string,
    label: string,
    title: string,
    index: number
  ): L.Marker {
    return L.marker([point.latitude, point.longitude], {
      icon: this.createPinIcon(color, label),
      zIndexOffset: 1000
    })
      .addTo(this.map!)
      .bindPopup(this.buildPopup(point, index, title));
  }

  private createPinIcon(color: string, label: string): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `
        <div style="
          width:36px;height:36px;
          background:${color};
          border:3px solid white;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 4px 12px rgba(0,0,0,.25);
          display:flex;align-items:center;justify-content:center;">
          <span style="transform:rotate(45deg);color:white;font-size:13px;font-weight:700;font-family:system-ui">${label}</span>
        </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });
  }

  private buildPopup(point: TrackingPoint, index: number, label?: string): string {
    const d = new Date(point.timestamp);
    const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const header = label
      ? `<div style="font-weight:700;color:#1e3a8a;font-size:13px;margin-bottom:4px">${label}</div>`
      : `<div style="color:#6b7280;font-size:11px;margin-bottom:4px">Point #${index}</div>`;

    return `
      <div style="font-family:system-ui,sans-serif;min-width:150px">
        ${header}
        <div style="font-size:12px;color:#374151">
          <div>${date}</div>
          <div style="font-weight:600;color:#111827">${time}</div>
        </div>
      </div>`;
  }

  private toLatLngs(points: TrackingPoint[]): L.LatLngExpression[] {
    return points.map((p) => [p.latitude, p.longitude]);
  }

  private clearGpsLayers(): void {
    this.midMarkers.forEach((m) => this.map?.removeLayer(m));
    this.midMarkers = [];
    if (this.startMarker) { this.map?.removeLayer(this.startMarker); this.startMarker = null; }
    if (this.endMarker) { this.map?.removeLayer(this.endMarker); this.endMarker = null; }
    if (this.polyline) { this.map?.removeLayer(this.polyline); this.polyline = null; }
    this.renderedCount = 0;
  }

  private renderPlannedRoute(): void {
    if (!this.map || this.plannedRoute.length === 0) return;

    this.plannedPolyline = L.polyline(this.plannedRoute, {
      color: '#8b5cf6',
      weight: 3,
      opacity: 0.65,
      dashArray: '10, 7'
    }).addTo(this.map);

    const dep = this.plannedRoute[0];
    this.plannedDepartureMarker = this.createPlannedPinMarker(dep[0], dep[1], '#10b981', 'D', 'Départ prévu');

    const arr = this.plannedRoute[this.plannedRoute.length - 1];
    this.plannedArrivalMarker = this.createPlannedPinMarker(arr[0], arr[1], '#ef4444', 'A', 'Arrivée prévue');

    // Fit to planned route only when no GPS track is displayed yet
    if (this.points.length === 0) {
      this.map.fitBounds(this.plannedPolyline.getBounds(), { padding: [40, 40] });
    }
  }

  private createPlannedPinMarker(lat: number, lng: number, color: string, label: string, title: string): L.Marker {
    return L.marker([lat, lng], {
      icon: this.createPinIcon(color, label),
      zIndexOffset: 500,
      opacity: 0.8
    })
      .addTo(this.map!)
      .bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:140px">
          <div style="font-weight:700;color:#5b21b6;font-size:13px;margin-bottom:4px">${title}</div>
          <div style="font-size:12px;color:#6b7280">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        </div>`);
  }

  private clearPlannedRoute(): void {
    if (this.plannedPolyline) { this.map?.removeLayer(this.plannedPolyline); this.plannedPolyline = null; }
    if (this.plannedDepartureMarker) { this.map?.removeLayer(this.plannedDepartureMarker); this.plannedDepartureMarker = null; }
    if (this.plannedArrivalMarker) { this.map?.removeLayer(this.plannedArrivalMarker); this.plannedArrivalMarker = null; }
  }
}
