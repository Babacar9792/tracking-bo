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
    <div class="relative rounded-xl overflow-hidden shadow-lg border border-gray-200">
      <div #mapContainer class="map-container"></div>

      <!-- Legend -->
      <div class="absolute top-3 left-3 z-10 flex gap-2">
        <div class="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md flex items-center gap-2 text-sm font-medium text-gray-700">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          Départ
        </div>
        <div class="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md flex items-center gap-2 text-sm font-medium text-gray-700">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
          Arrivée
        </div>
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

  private map: L.Map | null = null;
  private polyline: L.Polyline | null = null;
  private startMarker: L.Marker | null = null;
  private endMarker: L.Marker | null = null;
  private midMarkers: L.CircleMarker[] = [];
  private renderedCount = 0;

  private readonly ngZone = inject(NgZone);

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initMap();
      if (this.points.length > 0) {
        this.fullRender();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['points'] || changes['points'].firstChange || !this.map) return;

    const prev: TrackingPoint[] = changes['points'].previousValue ?? [];
    const curr: TrackingPoint[] = changes['points'].currentValue ?? [];

    this.ngZone.runOutsideAngular(() => {
      if (curr.length === 0) {
        this.clearMap();
      } else if (prev.length === 0 || curr.length < prev.length) {
        // Full re-render (first load or reset)
        this.clearMap();
        this.fullRender();
      } else if (curr.length > prev.length) {
        // Incremental: only add new points
        this.addIncrementalPoints(prev.length, curr);
      }
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
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

    // End marker (only if more than 1 point)
    if (this.points.length > 1) {
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

    // New end marker
    const lastPoint = curr[curr.length - 1];
    this.endMarker = this.createPinMarker(lastPoint, '#ef4444', 'A', 'Arrivée', curr.length);

    // If start marker doesn't exist yet (was single point before), create it
    if (!this.startMarker) {
      this.startMarker = this.createPinMarker(curr[0], '#10b981', 'D', 'Départ', 1);
    }

    this.renderedCount = curr.length;

    // Pan to latest point
    this.map.panTo([lastPoint.latitude, lastPoint.longitude]);
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

  private clearMap(): void {
    this.midMarkers.forEach((m) => this.map?.removeLayer(m));
    this.midMarkers = [];
    if (this.startMarker) { this.map?.removeLayer(this.startMarker); this.startMarker = null; }
    if (this.endMarker) { this.map?.removeLayer(this.endMarker); this.endMarker = null; }
    if (this.polyline) { this.map?.removeLayer(this.polyline); this.polyline = null; }
    this.renderedCount = 0;
  }
}
