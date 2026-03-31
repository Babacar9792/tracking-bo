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
    path: '**',
    redirectTo: '/tracking'
  }
];
