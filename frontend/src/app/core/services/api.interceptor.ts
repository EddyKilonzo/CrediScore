import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);

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

  // Add common headers
  authReq = authReq.clone({
    setHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

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
        errorMessage = 'Unauthorized. Please login again.';
        authService.logout();
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
