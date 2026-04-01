import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TrackingService, TrajetDto, TrackingPoint } from './tracking.service';

describe('TrackingService', () => {
  let service: TrackingService;
  let httpMock: HttpTestingController;

  const mockTrajet: TrajetDto = {
    id: 'bb2318de-f845-4b8b-a439-d5b15fa00f0f',
    clientId: 'Mamadoyu',
    statut: 'STARTED',
    shareToken: 'bf48eacf-f58b-4707-8682-e1fd623ef3d2',
    createdAt: '2026-03-31T12:59:19.790836',
    trackingUrl: 'http://localhost:4200/tracking/bf48eacf-f58b-4707-8682-e1fd623ef3d2',
    departureLatitude: 14.7167,
    departureLongitude: -17.4677,
    arrivalLatitude: 14.6928,
    arrivalLongitude: -17.4467
  };

  const mockHistory: TrackingPoint[] = [
    {
      id: 'a1b2c3d4-0000-0000-0000-000000000001',
      trajetId: 'bb2318de-f845-4b8b-a439-d5b15fa00f0f',
      latitude: 48.8566,
      longitude: 2.3522,
      timestamp: new Date('2026-03-31T13:00:00Z')
    },
    {
      id: 'a1b2c3d4-0000-0000-0000-000000000002',
      trajetId: 'bb2318de-f845-4b8b-a439-d5b15fa00f0f',
      latitude: 48.8600,
      longitude: 2.3600,
      timestamp: new Date('2026-03-31T13:05:00Z')
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TrackingService]
    });
    service = TestBed.inject(TrackingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // --- isValidToken ---

  describe('isValidToken', () => {
    it('should accept a valid UUID v4 token', () => {
      expect(service.isValidToken('bf48eacf-f58b-4707-8682-e1fd623ef3d2')).toBeTrue();
    });

    it('should accept a valid alphanumeric token', () => {
      expect(service.isValidToken('abc12345')).toBeTrue();
    });

    it('should reject an empty string', () => {
      expect(service.isValidToken('')).toBeFalse();
    });

    it('should reject a token that is too short', () => {
      expect(service.isValidToken('abc')).toBeFalse();
    });

    it('should reject a token with spaces or special chars', () => {
      expect(service.isValidToken('bad token!')).toBeFalse();
    });
  });

  // --- getTrajet ---

  describe('getTrajet', () => {
    it('should return a TrajetDto for a valid shareToken', (done) => {
      service.getTrajet('bf48eacf-f58b-4707-8682-e1fd623ef3d2').subscribe((t) => {
        expect(t.id).toBe(mockTrajet.id);
        expect(t.clientId).toBe('Mamadoyu');
        expect(t.statut).toBe('STARTED');
        done();
      });

      const req = httpMock.expectOne(
        'http://localhost:8083/api/trajets/track/bf48eacf-f58b-4707-8682-e1fd623ef3d2'
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockTrajet);
    });

    it('should emit INVALID_TOKEN for a malformed token', (done) => {
      service.getTrajet('bad!').subscribe({
        error: (err) => { expect(err.type).toBe('INVALID_TOKEN'); done(); }
      });
    });

    it('should emit NOT_FOUND on 404', (done) => {
      service.getTrajet('bf48eacf-f58b-4707-8682-e1fd623ef3d2').subscribe({
        error: (err) => { expect(err.type).toBe('NOT_FOUND'); done(); }
      });
      httpMock.expectOne(/trajets\/track/).flush('', { status: 404, statusText: 'Not Found' });
    });

    it('should emit EXPIRED_TOKEN on 410', (done) => {
      service.getTrajet('bf48eacf-f58b-4707-8682-e1fd623ef3d2').subscribe({
        error: (err) => { expect(err.type).toBe('EXPIRED_TOKEN'); done(); }
      });
      httpMock.expectOne(/trajets\/track/).flush('', { status: 410, statusText: 'Gone' });
    });

    it('should emit INVALID_TOKEN on 401', (done) => {
      service.getTrajet('bf48eacf-f58b-4707-8682-e1fd623ef3d2').subscribe({
        error: (err) => { expect(err.type).toBe('INVALID_TOKEN'); done(); }
      });
      httpMock.expectOne(/trajets\/track/).flush('', { status: 401, statusText: 'Unauthorized' });
    });

    it('should emit NETWORK_ERROR on 500', (done) => {
      service.getTrajet('bf48eacf-f58b-4707-8682-e1fd623ef3d2').subscribe({
        error: (err) => { expect(err.type).toBe('NETWORK_ERROR'); done(); }
      });
      httpMock.expectOne(/trajets\/track/).flush('', { status: 500, statusText: 'Server Error' });
    });
  });

  // --- getHistory ---

  describe('getHistory', () => {
    it('should return parsed TrackingPoint[] with Date timestamps', (done) => {
      const trajetId = 'bb2318de-f845-4b8b-a439-d5b15fa00f0f';
      service.getHistory(trajetId).subscribe((pts) => {
        expect(pts.length).toBe(2);
        expect(pts[0].timestamp).toBeInstanceOf(Date);
        expect(pts[0].latitude).toBe(48.8566);
        done();
      });

      const req = httpMock.expectOne(`http://localhost:8083/api/trajets/${trajetId}/history`);
      expect(req.request.method).toBe('GET');
      req.flush(mockHistory);
    });

    it('should return an empty array when history is empty', (done) => {
      service.getHistory('some-id').subscribe((pts) => {
        expect(pts.length).toBe(0);
        done();
      });
      httpMock.expectOne(/history/).flush([]);
    });

    it('should emit NETWORK_ERROR on failure', (done) => {
      service.getHistory('some-id').subscribe({
        error: (err) => { expect(err.type).toBe('NETWORK_ERROR'); done(); }
      });
      httpMock.expectOne(/history/).flush('', { status: 500, statusText: 'Error' });
    });
  });
});
