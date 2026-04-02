import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tracking',
    pathMatch: 'full'
  },
  {
    path: 'tracking/:shareToken',
    loadComponent: () =>
      import('./tracking/tracking-page.component').then(
        (m) => m.TrackingPageComponent
      )
  },
  {
    path: 'tracking',
    loadComponent: () =>
      import('./tracking/tracking-page.component').then(
        (m) => m.TrackingPageComponent
      )
  },
  {
    path: 'current-traject/:shareToken',
    loadComponent: () =>
      import('./current-traject/current-traject-page.component').then(
        (m) => m.CurrentTrajectPageComponent
      )
  },
  {
    path: '**',
    redirectTo: '/tracking'
  }
];
