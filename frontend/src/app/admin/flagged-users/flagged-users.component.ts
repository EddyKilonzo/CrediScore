import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-flagged-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flagged-users.component.html',
  styleUrl: './flagged-users.component.css'
})
export class FlaggedUsersComponent {
  constructor(private router: Router) {}

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }
  mockFlaggedUsers = [
    {
      id: 1,
      name: 'John Smith',
      email: 'john.smith@email.com',
      flagReason: 'spam',
      flagDescription: 'Multiple spam reviews detected',
      flaggedBy: 'System',
      flaggedDate: new Date('2024-01-15'),
      totalReviews: 25,
      reportsCount: 3,
      joinDate: new Date('2023-12-01')
    },
    {
      id: 2,
      name: 'Jane Doe',
      email: 'jane.doe@email.com',
      flagReason: 'fraud',
      flagDescription: 'Suspicious payment activities',
      flaggedBy: 'Admin',
      flaggedDate: new Date('2024-01-14'),
      totalReviews: 12,
      reportsCount: 5,
      joinDate: new Date('2023-11-15')
    },
    {
      id: 3,
      name: 'Mike Johnson',
      email: 'mike.johnson@email.com',
      flagReason: 'abuse',
      flagDescription: 'Inappropriate content in reviews',
      flaggedBy: 'User Report',
      flaggedDate: new Date('2024-01-13'),
      totalReviews: 8,
      reportsCount: 2,
      joinDate: new Date('2023-10-20')
    }
  ];

  suspendUser(userId: number): void {
    console.log('Suspending user:', userId);
    // Implement suspend logic
  }

  warnUser(userId: number): void {
    console.log('Warning user:', userId);
    // Implement warn logic
  }

  clearFlag(userId: number): void {
    console.log('Clearing flag for user:', userId);
    // Implement clear flag logic
  }
}
