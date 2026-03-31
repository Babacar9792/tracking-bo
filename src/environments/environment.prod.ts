declare global {
  interface Window {
    __env?: {
      apiBaseUrl?: string;
      wsUrl?: string;
    };
  }
}

export const environment = {
  production: true,
  get apiBaseUrl(): string {
    return window.__env?.apiBaseUrl ?? 'http://localhost:8083/api';
  },
  get wsUrl(): string {
    return window.__env?.wsUrl ?? 'ws://localhost:8083/ws';
  }
};
