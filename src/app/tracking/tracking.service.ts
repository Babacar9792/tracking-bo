import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
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
}

export type TrackingError = 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'NETWORK_ERROR' | 'NOT_FOUND';

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly http = inject(HttpClient);
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

  connectLive(trajetId: string): Observable<TrackingPoint> {
    return new Observable<TrackingPoint>((observer) => {
      const client = new Client({
        brokerURL: this.wsUrl,
        reconnectDelay: 5000,
        onConnect: () => {
          client.subscribe(`/topic/trajet/${trajetId}`, (message: IMessage) => {
            try {
              const raw = JSON.parse(message.body);
              observer.next({ ...raw, timestamp: new Date(raw.timestamp) });
            } catch {
              // ignore malformed frames
            }
          });
        },
        onStompError: () => {
          observer.error({ type: 'NETWORK_ERROR' as TrackingError });
        },
        onWebSocketError: () => {
          observer.error({ type: 'NETWORK_ERROR' as TrackingError });
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
