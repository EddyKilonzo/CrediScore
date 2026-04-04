import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ReviewBusiness {
  id: string;
  name: string;
  isVerified: boolean;
  isActive: boolean;
}

export interface ReviewReplyUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

export interface ReviewReply {
  id: string;
  content: string;
  userId: string;
  reviewId: string;
  createdAt: string;
  updatedAt: string;
  user?: ReviewReplyUser;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  userId: string;
  businessId: string;
  credibility: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  amount: number | null;
  receiptData: any | null;
  receiptUrl: string | null;
  reviewDate: string | null;
  validationResult: any | null;
  mpesaCode?: string | null;
  mpesaVerified?: boolean;
  business: ReviewBusiness;
  replies?: ReviewReply[];
  helpfulCount?: number;
  notHelpfulCount?: number;
  userVote?: 'HELPFUL' | 'NOT_HELPFUL' | null;
  votes?: Array<{ userId: string; vote: string }>;
}

export interface ReviewsResponse {
  reviews: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ReviewService {
  private readonly API_URL = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) { }

  getUserReviews(page: number = 1, limit: number = 20): Observable<ReviewsResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<ReviewsResponse>(`${this.API_URL}/user/reviews`, { params });
  }

  updateReview(reviewId: string, updateData: { rating?: number; comment?: string }): Observable<Review> {
    return this.http.patch<Review>(`${this.API_URL}/user/reviews/${reviewId}`, updateData);
  }

  deleteReview(reviewId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/user/reviews/${reviewId}`);
  }

  // Review Reply Methods
  createReviewReply(reviewId: string, content: string): Observable<ReviewReply> {
    return this.http.post<ReviewReply>(
      `${this.API_URL}/business/reviews/${reviewId}/replies`,
      { content }
    );
  }

  updateReviewReply(replyId: string, content: string): Observable<ReviewReply> {
    return this.http.patch<ReviewReply>(
      `${this.API_URL}/business/replies/${replyId}`,
      { content }
    );
  }

  deleteReviewReply(replyId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.API_URL}/business/replies/${replyId}`
    );
  }

  getReviewReplies(reviewId: string): Observable<ReviewReply[]> {
    return this.http.get<ReviewReply[]>(
      `${this.API_URL}/business/reviews/${reviewId}/replies`
    );
  }

  voteReview(reviewId: string, vote: 'HELPFUL' | 'NOT_HELPFUL'): Observable<{ helpfulCount: number; notHelpfulCount: number; userVote: string | null }> {
    return this.http.post<any>(`${this.API_URL}/user/reviews/${reviewId}/vote`, { vote });
  }

  uploadReceipt(reviewId: string, file: File): Observable<{ receiptUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.API_URL}/user/reviews/upload-receipt`, formData).pipe(
      map(res => ({ receiptUrl: res.receiptUrl || res.url }))
    );
  }

  flagReview(reviewId: string, reason: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/user/reviews/${reviewId}/flag`, { reason });
  }

  disputeReview(reviewId: string, reason: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/user/reviews/${reviewId}/dispute`, { reason });
  }

  getBookmarks(page: number = 1, limit: number = 20): Observable<any> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<any>(`${this.API_URL}/user/bookmarks`, { params });
  }

  toggleBookmark(businessId: string): Observable<{ bookmarked: boolean; message: string }> {
    return this.http.post<any>(`${this.API_URL}/user/bookmarks/${businessId}`, {});
  }

  removeBookmark(businessId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/user/bookmarks/${businessId}`);
  }

  /** Trust & safety: customer report → admin fraud-reports queue */
  submitFraudReport(payload: {
    businessId: string;
    reason: string;
    description: string;
  }): Observable<unknown> {
    return this.http.post(`${this.API_URL}/user/fraud-reports`, payload);
  }
}

