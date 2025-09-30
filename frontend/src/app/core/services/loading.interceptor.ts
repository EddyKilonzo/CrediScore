import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { signal } from '@angular/core';

let loadingCount = 0;
const loadingSignal = signal(false);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip loading for certain requests
  if (shouldSkipLoading(req)) {
    return next(req);
  }

  // Increment loading count
  loadingCount++;
  loadingSignal.set(true);

  return next(req).pipe(
    finalize(() => {
      // Decrement loading count
      loadingCount--;
      
      // Set loading to false when all requests are complete
      if (loadingCount === 0) {
        loadingSignal.set(false);
      }
    })
  );
};

function shouldSkipLoading(req: any): boolean {
  // Skip loading for certain endpoints or request types
  const skipLoadingEndpoints = [
    '/api/auth/refresh',
    '/api/health',
    '/api/ping'
  ];

  return skipLoadingEndpoints.some(endpoint => req.url.includes(endpoint));
}

export function isLoading() {
  return loadingSignal.asReadonly();
}

