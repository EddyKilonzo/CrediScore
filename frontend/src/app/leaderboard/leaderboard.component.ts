import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface LeaderboardUser {
  rank: number;
  id: string;
  name: string;
  avatar?: string;
  reputation: number;
  reviewCount?: number;
  verifiedReviews?: number;
}

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.css'
})
export class LeaderboardComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api';

  users: LeaderboardUser[] = [];
  isLoading = true;
  error: string | null = null;
  limit = 50;

  ngOnInit() {
    this.loadLeaderboard();
  }

  loadLeaderboard() {
    this.isLoading = true;
    this.http.get<any>(`${this.API_URL}/user/leaderboard?limit=${this.limit}`).subscribe({
      next: (data) => {
        const raw: any[] = Array.isArray(data) ? data : (data.users || data.leaderboard || []);
        this.users = raw.map((u, i) => ({
          rank: i + 1,
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          reputation: u.reputation ?? 0,
          reviewCount: u._count?.reviews ?? u.reviewCount ?? 0,
          verifiedReviews: u.verifiedReviews ?? 0,
        }));
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load leaderboard.';
        this.isLoading = false;
      }
    });
  }

  getUserInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  getRankBadgeColor(rank: number): string {
    if (rank === 1) return '#f59e0b';
    if (rank === 2) return '#9ca3af';
    if (rank === 3) return '#b45309';
    return '#2C5270';
  }

  getRankIcon(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }
}
