import { Component, OnInit, inject } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { forkJoin } from 'rxjs';

interface LeaderboardUser {
  rank: number;
  id: string;
  name: string;
  avatar?: string;
  reputation: number;
  reputationLevel?: string;
  reviewCount?: number;
  verifiedReviews?: number;
}

interface LeaderboardBusiness {
  rank: number;
  id: string;
  name: string;
  logo?: string;
  category?: string;
  trustScore: number;
  reviewCount: number;
  isVerified: boolean;
  leadScore: number;
  leadTier: string;
}

const leaderboardListAnim = trigger('leaderboardListAnim', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        stagger(
          '28ms',
          animate(
            '220ms cubic-bezier(0.22, 1, 0.36, 1)',
            style({ opacity: 1, transform: 'translateY(0)' })
          )
        ),
      ],
      { optional: true }
    ),
    query(
      ':leave',
      [
        animate(
          '150ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'translateY(-4px)' })
        ),
      ],
      { optional: true }
    ),
  ]),
]);

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, RouterModule],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.css',
  animations: [leaderboardListAnim],
})
export class LeaderboardComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api`;

  users: LeaderboardUser[] = [];
  businesses: LeaderboardBusiness[] = [];
  localReviewers: Array<{
    id: string;
    name: string;
    reputation: number;
    reviewCount: number;
    streakDays: number;
    badges: string[];
  }> = [];
  isLoading = true;
  error: string | null = null;
  limit = 50;
  activeBoard: 'customers' | 'businesses' = 'customers';
  reputationTiers = [
    { name: 'Elite', min: 90, max: 100, color: '#2C5270' },
    { name: 'Trusted', min: 75, max: 89, color: '#3E6A8A' },
    { name: 'Reliable', min: 60, max: 74, color: '#5C8BA5' },
    { name: 'Growing', min: 40, max: 59, color: '#7EA5BD' },
    { name: 'New Reviewer', min: 0, max: 39, color: '#9FB7C9' }
  ];

  ngOnInit() {
    this.loadLeaderboard();
    this.loadTopLocalReviewers();
  }

  loadLeaderboard() {
    this.isLoading = true;
    this.error = null;
    forkJoin({
      users: this.http.get<any>(`${this.API_URL}/user/leaderboard?limit=${this.limit}`),
      businesses: this.http.get<any>(`${this.API_URL}/user/top-trusted?limit=${this.limit}`),
    }).subscribe({
      next: ({ users, businesses }) => {
        const rawUsers: any[] = Array.isArray(users)
          ? users
          : users.users || users.leaderboard || [];
        this.users = rawUsers.map((u, i) => ({
          rank: i + 1,
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          reputation: u.reputation ?? 0,
          reputationLevel: this.getTierByScore(u.reputation ?? 0).name,
          reviewCount: u._count?.reviews ?? u.reviewCount ?? 0,
          verifiedReviews: u.verifiedReviews ?? 0,
        }));

        const rawBusinesses: any[] = Array.isArray(businesses)
          ? businesses
          : businesses.businesses || businesses.data || [];
        this.businesses = rawBusinesses
          .map((b, i) => {
            const trustScore = Number(b?.trustScore?.score ?? 0);
            const reviewCount = Number(b?.reviewCount ?? b?._count?.reviews ?? 0);
            const isVerified = !!b?.isVerified;
            const leadScore = this.calculateBusinessLeadScore(trustScore, reviewCount, isVerified);
            return {
              rank: i + 1,
              id: b.id,
              name: b.name,
              logo: b.logo,
              category: b.category,
              trustScore,
              reviewCount,
              isVerified,
              leadScore,
              leadTier: this.getTierByScore(leadScore).name,
            };
          })
          .sort((a, b) => b.leadScore - a.leadScore || b.reviewCount - a.reviewCount)
          .map((b, idx) => ({ ...b, rank: idx + 1 }));

        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load leaderboard.';
        this.isLoading = false;
      },
    });
  }

  setActiveBoard(board: 'customers' | 'businesses'): void {
    this.activeBoard = board;
  }

  /** Stable row identity for list animations and smoother reordering. */
  trackCustomerRow = (_index: number, row: LeaderboardUser) => row.id;
  trackBusinessRow = (_index: number, row: LeaderboardBusiness) => row.id;

  leaderboardCustomersKey(): string {
    return `c|${this.getCustomerListRows()
      .map((u) => u.id)
      .join('|')}`;
  }

  leaderboardBusinessesKey(): string {
    return `b|${this.getBusinessListRows()
      .map((b) => b.id)
      .join('|')}`;
  }

  private calculateBusinessLeadScore(trustScore: number, reviewCount: number, isVerified: boolean): number {
    const trust = Math.max(0, Math.min(100, trustScore || 0));
    const reviewVolume = Math.min((reviewCount / 30) * 100, 100);
    const verificationBoost = isVerified ? 100 : 40;
    const score = trust * 0.6 + reviewVolume * 0.25 + verificationBoost * 0.15;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  getTierByScore(score: number) {
    const safe = Math.max(0, Math.min(100, Math.round(score || 0)));
    return this.reputationTiers.find((t) => safe >= t.min && safe <= t.max) || this.reputationTiers[this.reputationTiers.length - 1];
  }

  getCustomerListRows(): LeaderboardUser[] {
    if (this.users.length === 0) return [];
    const podiumCount = Math.min(3, this.users.length);
    return this.users.slice(podiumCount);
  }

  getBusinessListRows(): LeaderboardBusiness[] {
    if (this.businesses.length === 0) return [];
    const podiumCount = Math.min(3, this.businesses.length);
    return this.businesses.slice(podiumCount);
  }

  getUserInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  getRankBadgeColor(rank: number): string {
    if (rank === 1) return '#2C5270';
    if (rank === 2) return '#3E6A8A';
    if (rank === 3) return '#5C8BA5';
    return '#2C5270';
  }

  getRankIcon(rank: number): string {
    if (rank === 1) return '1';
    if (rank === 2) return '2';
    if (rank === 3) return '3';
    return `#${rank}`;
  }

  getRankIconClass(rank: number): string {
    if (rank === 1) return 'uil-medal medal-gold';
    if (rank === 2) return 'uil-medal medal-silver';
    if (rank === 3) return 'uil-medal medal-bronze';
    return 'uil-hashtag';
  }

  private loadTopLocalReviewers(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.http
          .get<any[]>(
            `${this.API_URL}/user/top-local-reviewers?lat=${latitude}&lng=${longitude}&radiusKm=20&limit=5`,
          )
          .subscribe({
            next: (rows) => {
              this.localReviewers = rows || [];
            },
            error: () => {},
          });
      },
      () => {},
      { timeout: 5000 },
    );
  }
}
