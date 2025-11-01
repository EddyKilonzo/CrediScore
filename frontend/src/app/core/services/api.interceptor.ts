import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);

  // Skip interceptor for Cloudinary requests
  if (req.url.includes('api.cloudinary.com')) {
    return next(req);
  }

  // Add auth token to requests
  const token = authService.getToken();
  let authReq = req;

  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Add common headers (skip Content-Type for FormData requests)
  // FormData requests should not have Content-Type set manually - browser sets it with boundary
  const isFormData = authReq.body instanceof FormData;
  
  if (!isFormData) {
    authReq = authReq.clone({
      setHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      return handleError(error, toastService, authService);
    })
  );
};

function handleError(error: HttpErrorResponse, toastService: ToastService, authService: AuthService) {
  let errorMessage = 'An error occurred';

  if (error.error instanceof ErrorEvent) {
    // Client-side error
    errorMessage = `Error: ${error.error.message}`;
  } else {
    // Server-side error
    switch (error.status) {
      case 400:
        errorMessage = error.error?.message || 'Bad Request';
        break;
      case 401:
        errorMessage = 'Session expired. Please login again.';
        authService.logout(true); // Redirect to home
        break;
      case 403:
        errorMessage = 'Access denied. You do not have permission to perform this action.';
        break;
      case 404:
        errorMessage = 'Resource not found';
        break;
      case 422:
        errorMessage = error.error?.message || 'Validation error';
        break;
      case 431:
        errorMessage = 'Request data too large. Please try again with smaller data.';
        break;
      case 500:
        errorMessage = 'Internal server error. Please try again later.';
        break;
      case 503:
        errorMessage = 'Service unavailable. Please try again later.';
        break;
      default:
        errorMessage = error.error?.message || `Error: ${error.status} ${error.statusText}`;
    }
  }

  // Show error toast
  toastService.error(errorMessage);

  return throwError(() => error);
}
