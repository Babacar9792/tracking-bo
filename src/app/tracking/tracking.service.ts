import { Injectable, inject, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Client, IMessage } from '@stomp/stompjs';
import { environment } from '../../environments/environment';


export interface TrackingPoint {
  id?: string;
  trajetId?: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
}

export type TrackingStatut = 'STARTED' | 'IN_PROGRESS' | 'STOPPED' | 'COMPLETED';

export interface TrajetDto {
  id: string;
  clientId: string;
  statut: TrackingStatut;
  shareToken: string;
  createdAt: string;
  trackingUrl: string;
  departureLatitude: number;
  departureLongitude: number;
  arrivalLatitude: number;
  arrivalLongitude: number;
}

export interface OptimalRoute {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

export type TrackingError = 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'NETWORK_ERROR' | 'NOT_FOUND';

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  private readonly apiBaseUrl = environment.apiBaseUrl;
  private readonly wsUrl = environment.wsUrl;

  getTrajet(shareToken: string): Observable<TrajetDto> {
    if (!this.isValidToken(shareToken)) {
      return throwError(() => ({ type: 'INVALID_TOKEN' as TrackingError }));
    }
    return this.http
      .get<TrajetDto>(`${this.apiBaseUrl}/trajets/track/${shareToken}`)
      .pipe(catchError((err: HttpErrorResponse) => this.handleError(err)));
  }

  getHistory(trajetId: string): Observable<TrackingPoint[]> {
    return this.http
      .get<TrackingPoint[]>(`${this.apiBaseUrl}/trajets/${trajetId}/history`)
      .pipe(
        map((points) =>
          points.map((p) => ({ ...p, timestamp: new Date(p.timestamp as unknown as string) }))
        ),
        catchError((err: HttpErrorResponse) => this.handleError(err))
      );
  }

  getOptimalRoute(
    fromLat: number, fromLng: number,
    toLat: number, toLng: number
  ): Observable<OptimalRoute> {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    return this.http.get<any>(url).pipe(
      map((res) => ({
        coordinates: res.routes[0].geometry.coordinates.map(
          (c: number[]) => [c[1], c[0]] as [number, number]
        ),
        distanceMeters: res.routes[0].distance,
        durationSeconds: res.routes[0].duration
      })),
      catchError(() => of({ coordinates: [], distanceMeters: 0, durationSeconds: 0 }))
    );
  }

  connectLive(trajetId: string): Observable<TrackingPoint> {
    return new Observable<TrackingPoint>((observer) => {
      const brokerURL = this.wsUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
      const client = new Client({
        brokerURL,
        reconnectDelay: 5000,
        onConnect: () => {
          client.subscribe(`/topic/trajet/${trajetId}`, (message: IMessage) => {
            try {
              const raw = JSON.parse(message.body);
              this.ngZone.run(() => {
                observer.next({ ...raw, timestamp: new Date(raw.timestamp) });
              });
            } catch {
              // ignore malformed frames
            }
          });
        },
        onStompError: () => {
          this.ngZone.run(() => observer.error({ type: 'NETWORK_ERROR' as TrackingError }));
        },
        onWebSocketError: () => {
          this.ngZone.run(() => observer.error({ type: 'NETWORK_ERROR' as TrackingError }));
        }
      });

      client.activate();

      return () => {
        client.deactivate();
      };
    });
  }

  isValidToken(token: string): boolean {
    if (!token || token.trim().length === 0) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tokenRegex = /^[a-zA-Z0-9_-]{8,128}$/;
    return uuidRegex.test(token) || tokenRegex.test(token);
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    let errorType: TrackingError;
    switch (err.status) {
      case 401:
      case 403:
        errorType = 'INVALID_TOKEN';
        break;
      case 404:
        errorType = 'NOT_FOUND';
        break;
      case 410:
        errorType = 'EXPIRED_TOKEN';
        break;
      default:
        errorType = 'NETWORK_ERROR';
    }
    return throwError(() => ({ type: errorType, originalError: err }));
  }
}
