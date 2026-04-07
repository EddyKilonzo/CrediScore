import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../core/services/auth.service';
import { AdminService, AdminDashboardStats, HistoricalData, MonthlyData } from '../../core/services/admin.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { environment } from '../../../environments/environment';
import { TPipe } from '../../shared/pipes/t.pipe';
import { firstValueFrom } from 'rxjs';

type AdminActivityType = 'user_registered' | 'business_verified' | 'fraud_report';

interface AdminRecentActivity {
  id: string;
  type: AdminActivityType;
  title: string;
  timestamp: Date;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TPipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private toastService = inject(ToastService);
  
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;
  readonly apiUrl = environment.apiUrl;
  
  // Component state
  dashboardStats = signal<AdminDashboardStats | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  monthlyUserRegistrations = signal<{ month: string; count: number }[]>([]);
  recentActivities = signal<AdminRecentActivity[]>([]);

  ngOnInit() {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
    // Check if user is admin
    if (!this.isAuthenticated() || !this.isAdmin()) {
      // Redirect non-admin users
      window.location.href = '/dashboard';
      return;
    }

    this.loadDashboardStats();
    this.loadRecentActivities();
  }

  private isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.role === 'admin';
  }

  private async loadDashboardStats(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      // Load dashboard stats and monthly registrations in parallel
      this.adminService.getDashboardStats().subscribe({
        next: (stats) => {
          this.dashboardStats.set(stats);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading dashboard stats:', error);
          this.error.set('Failed to load dashboard statistics');
          this.isLoading.set(false);
          this.toastService.error('Failed to load dashboard statistics');
        }
      });

      // Load monthly user registrations
      this.adminService.getMonthlyUserRegistrations().subscribe({
        next: (monthlyData) => {
          console.log('Monthly user registrations received:', monthlyData);
          this.monthlyUserRegistrations.set(monthlyData);
        },
        error: (error) => {
          console.error('Error loading monthly registrations:', error);
          // Don't show error toast for this as it's not critical
        }
      });
    } catch (error) {
      console.error('Error in loadDashboardStats:', error);
      this.error.set('An unexpected error occurred');
      this.isLoading.set(false);
      this.toastService.error('An unexpected error occurred');
    }
  }

  async refreshStats(): Promise<void> {
    await this.loadDashboardStats();
    await this.loadRecentActivities();
  }

  private async loadRecentActivities(): Promise<void> {
    try {
      const [usersResponse, businessesResponse, reportsResponse] = await Promise.all([
        firstValueFrom(this.adminService.getAllUsers(1, 8)),
        firstValueFrom(this.adminService.getAllBusinesses(1, 8)),
        firstValueFrom(this.adminService.getAllFraudReports(1, 8)),
      ]);

      const userEvents: AdminRecentActivity[] = (usersResponse.users ?? []).map((user) => ({
        id: `user-${user.id}`,
        type: 'user_registered',
        title: user.name ? `${user.name} registered` : 'New user registered',
        timestamp: new Date(user.createdAt),
      }));

      const businessEvents: AdminRecentActivity[] = (businessesResponse.data ?? [])
        .filter((business) => business.isVerified)
        .map((business) => ({
          id: `business-${business.id}`,
          type: 'business_verified',
          title: `${business.name} verified`,
          timestamp: new Date(business.reviewedAt ?? business.updatedAt),
        }));

      const fraudEvents: AdminRecentActivity[] = (reportsResponse.data ?? []).map((report) => ({
        id: `fraud-${report.id}`,
        type: 'fraud_report',
        title: `Fraud report submitted for ${report.business?.name ?? 'a business'}`,
        timestamp: new Date(report.createdAt),
      }));

      const merged = [...userEvents, ...businessEvents, ...fraudEvents]
        .filter((event) => !Number.isNaN(event.timestamp.getTime()))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 8);

      this.recentActivities.set(merged);
    } catch (error) {
      console.error('Error loading recent admin activities:', error);
      this.recentActivities.set([]);
    }
  }

  /** Print-friendly HTML report (user saves as PDF from the print dialog). */
  downloadPDF = (): void => {
    const stats = this.dashboardStats();
    if (!stats) { this.toastService.error('No data to export yet.'); return; }
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const logoUrl = window.location.origin + '/images/CrediScore.png';
    const u = stats.userStats;
    const b = stats.businessStats;
    const f = stats.fraudReportStats;

    const pct = (n: number, d: number) => d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—';

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Admin Dashboard Report — CrediScore</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif; background: #fff; color: #1f2937; }
  .page { max-width: 900px; margin: 0 auto; }

  /* ── Header Banner ── */
  .brand-header {
    background: linear-gradient(135deg, #1a3a52 0%, #2C5270 50%, #3E6A8A 100%);
    padding: 28px 40px 22px; display: flex; align-items: center; justify-content: space-between;
  }
  .brand-left { display: flex; align-items: center; gap: 16px; }
  .brand-logo { height: 52px; width: auto; }
  .brand-name { font-size: 26px; font-family: 'Brush Script MT', 'Segoe Script', cursive; color: white; }
  .brand-tagline { font-size: 11px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 3px; }
  .brand-right { text-align: right; }
  .report-title { font-size: 16px; font-weight: 700; color: white; }
  .report-meta { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 4px; }

  /* ── Confidential strip ── */
  .conf-strip {
    background: #dc2626; color: white; text-align: center;
    font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; padding: 5px;
  }

  /* ── Body ── */
  .body { padding: 32px 40px 40px; }
  .section-title {
    font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
    color: #2C5270; border-left: 4px solid #3E6A8A; padding-left: 10px; margin: 28px 0 14px;
  }
  .section-title:first-child { margin-top: 0; }

  /* ── KPI Grid ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 4px; }
  .kpi { background: #f5f8fb; border: 1px solid #dce8f0; border-radius: 10px; padding: 14px 16px; border-top: 3px solid #3E6A8A; }
  .kpi.red   { border-top-color: #ef4444; }
  .kpi.green { border-top-color: #10b981; }
  .kpi.amber { border-top-color: #f59e0b; }
  .kpi-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  .kpi-value { font-size: 28px; font-weight: 700; color: #1f2937; margin-top: 6px; line-height: 1; }
  .kpi-sub   { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .kpi-pct   { font-size: 11px; color: #5C8BA5; margin-top: 2px; font-weight: 600; }

  /* ── Summary table ── */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { background: linear-gradient(90deg, #2C5270, #3E6A8A); }
  th { color: white; padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  td { padding: 9px 12px; border-bottom: 1px solid #eef2f5; }
  td.num { font-weight: 700; color: #1f2937; }
  td.pct { color: #5C8BA5; font-size: 12px; }
  tbody tr:nth-child(even) td { background: #f8fafc; }

  /* ── Divider ── */
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 4px 0 0; }

  /* ── Footer ── */
  .pdf-footer {
    background: #f5f8fb; border-top: 2px solid #3E6A8A;
    padding: 14px 40px; display: flex; justify-content: space-between; align-items: center;
    font-size: 11px; color: #6b7280;
  }
  .footer-brand { font-size: 14px; font-family: 'Brush Script MT', cursive; color: #3E6A8A; }

  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  @page { margin: 0; size: A4; }
</style>
</head><body>
<div class="page">

  <div class="brand-header">
    <div class="brand-left">
      <img src="${logoUrl}" alt="CrediScore" class="brand-logo" onerror="this.style.display='none'">
      <div>
        <div class="brand-name">CrediScore</div>
        <div class="brand-tagline">Business Trust Platform</div>
      </div>
    </div>
    <div class="brand-right">
      <div class="report-title">Admin Dashboard Report</div>
      <div class="report-meta">Platform Overview &nbsp;·&nbsp; ${date}</div>
    </div>
  </div>
  <div class="conf-strip">Confidential — Admin Use Only</div>

  <div class="body">

    <!-- Users -->
    <div class="section-title">User Statistics</div>
    <div class="kpi-grid">
      <div class="kpi green">
        <div class="kpi-label">Total Users</div>
        <div class="kpi-value">${u.totalUsers.toLocaleString()}</div>
        <div class="kpi-sub">+${u.newUsersThisMonth} this month</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Active Users</div>
        <div class="kpi-value">${u.activeUsers.toLocaleString()}</div>
        <div class="kpi-pct">${pct(u.activeUsers, u.totalUsers)} of total</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Verified Email</div>
        <div class="kpi-value">${u.usersWithVerifiedEmail.toLocaleString()}</div>
        <div class="kpi-pct">${pct(u.usersWithVerifiedEmail, u.totalUsers)} of total</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Business Owners</div>
        <div class="kpi-value">${u.businessOwners.toLocaleString()}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Customers</div>
        <div class="kpi-value">${u.customers.toLocaleString()}</div>
      </div>
      <div class="kpi amber">
        <div class="kpi-label">Admins</div>
        <div class="kpi-value">${u.admins}</div>
      </div>
    </div>

    <!-- Businesses -->
    <div class="section-title">Business Statistics</div>
    <div class="kpi-grid">
      <div class="kpi green">
        <div class="kpi-label">Total Businesses</div>
        <div class="kpi-value">${b.totalBusinesses.toLocaleString()}</div>
        <div class="kpi-sub">+${b.newBusinessesThisMonth} this month</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Verified</div>
        <div class="kpi-value">${b.verifiedBusinesses.toLocaleString()}</div>
        <div class="kpi-pct">${pct(b.verifiedBusinesses, b.totalBusinesses)} verified</div>
      </div>
      <div class="kpi amber">
        <div class="kpi-label">Pending Verification</div>
        <div class="kpi-value">${b.pendingVerification.toLocaleString()}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Active</div>
        <div class="kpi-value">${b.activeBusinesses.toLocaleString()}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">With Trust Scores</div>
        <div class="kpi-value">${b.businessesWithTrustScores.toLocaleString()}</div>
      </div>
      <div class="kpi red">
        <div class="kpi-label">Inactive</div>
        <div class="kpi-value">${b.inactiveBusinesses.toLocaleString()}</div>
      </div>
    </div>

    <!-- Fraud Reports -->
    <div class="section-title">Fraud Report Statistics</div>
    <table>
      <thead><tr><th>Status</th><th>Count</th><th>% of Total</th></tr></thead>
      <tbody>
        <tr><td>Total Reports</td><td class="num">${f.totalReports}</td><td class="pct">—</td></tr>
        <tr><td>Pending</td><td class="num">${f.pendingReports}</td><td class="pct">${pct(f.pendingReports, f.totalReports)}</td></tr>
        <tr><td>Under Review</td><td class="num">${f.underReviewReports}</td><td class="pct">${pct(f.underReviewReports, f.totalReports)}</td></tr>
        <tr><td>Resolved</td><td class="num">${f.resolvedReports}</td><td class="pct">${pct(f.resolvedReports, f.totalReports)}</td></tr>
        <tr><td>Dismissed</td><td class="num">${f.dismissedReports}</td><td class="pct">${pct(f.dismissedReports, f.totalReports)}</td></tr>
        <tr><td>Substantiated (upheld)</td><td class="num">${f.upheldReports ?? 0}</td><td class="pct">${pct(f.upheldReports ?? 0, f.totalReports)}</td></tr>
        <tr><td><strong>Reports This Month</strong></td><td class="num"><strong>${f.reportsThisMonth}</strong></td><td class="pct">—</td></tr>
      </tbody>
    </table>

  </div>

  <div class="pdf-footer">
    <div><span class="footer-brand">CrediScore</span> &nbsp;Admin Dashboard Report</div>
    <div style="text-align:right;">
      <div>${date}</div>
      <div style="font-size:10px;color:#9ca3af;">Confidential — Admin Use Only</div>
    </div>
  </div>

</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=1000,height=780');
    if (!win) { this.toastService.error('Pop-ups are blocked. Please allow pop-ups and try again.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 700);
    this.toastService.success('Branded PDF report is ready to print/download.');
  };

  async downloadCsvExport(type: 'users' | 'reviews'): Promise<void> {
    try {
      const token = localStorage.getItem('token') || '';
      const endpoint = `${this.apiUrl}/api/admin/export/${type}`;
      const response = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      link.href = objectUrl;
      link.download = `crediscore-${type}-export-${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      this.toastService.success(`${type === 'users' ? 'Users' : 'Reviews'} CSV download started.`);
    } catch (error) {
      console.error(`Error downloading ${type} CSV export:`, error);
      this.toastService.error(`Failed to download ${type} CSV.`);
    }
  }

  getStats(): AdminDashboardStats | null {
    return this.dashboardStats();
  }

  getLoadingState(): boolean {
    return this.isLoading();
  }

  getErrorState(): string | null {
    return this.error();
  }

  // Chart data generation based on real stats
  getUserGrowthData(): { month: string; value: number; height: string }[] {
    const monthlyData = this.monthlyUserRegistrations();
    
    // If we have monthly data, use it (counts are NEW registrations per month from backend)
    if (monthlyData && monthlyData.length > 0) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const data: { month: string; value: number; height: string }[] = [];
      
      // Get current month (0-11, where 0 = January)
      const currentDate = new Date();
      const currentMonthIndex = currentDate.getMonth();
      
      // Create a map for quick lookup (counts are new registrations per month)
      const monthlyMap = new Map<string, number>();
      monthlyData.forEach(item => {
        if (item && item.month && typeof item.count === 'number') {
          monthlyMap.set(item.month, item.count);
        }
      });
      
      
      // Find the maximum value for scaling
      let maxValue = 0;
      for (let i = 0; i <= currentMonthIndex; i++) {
        const month = months[i];
        const count = monthlyMap.get(month) || 0;
        maxValue = Math.max(maxValue, count);
      }
      
      // Ensure maxValue is at least 1 to avoid division by zero
      if (maxValue === 0) {
        maxValue = 1;
      }
      
      
      // Build chart data (showing new registrations per month, not cumulative)
      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const newRegistrations = monthlyMap.get(month) || 0;
        
        // Only show data up to current month
        if (i <= currentMonthIndex) {
          // Calculate height based on new registrations (scale to max value)
          const height = maxValue > 0 ? Math.min(95, Math.max(5, (newRegistrations / maxValue) * 100)) : 0;
          
          data.push({
            month,
            value: newRegistrations,
            height: `${height}%`
          });
        } else {
          // Future months show no data
          data.push({
            month,
            value: 0,
            height: '0%'
          });
        }
      }
      
      return data;
    }
    
    // Fallback to default if no monthly data available
    return this.getDefaultUserGrowthData();
  }

  getBusinessVerificationData(): { verified: number; pending: number; percentage: number } {
    const stats = this.getStats();
    if (!stats) {
      return { verified: 245, pending: 105, percentage: 70 };
    }

    const verified = stats.businessStats.verifiedBusinesses;
    const pending = stats.businessStats.pendingVerification;
    const total = verified + pending;
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;

    return { verified, pending, percentage };
  }

  private getDefaultUserGrowthData(): { month: string; value: number; height: string }[] {
    // Get current month (0-11, where 0 = January)
    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth();
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data: { month: string; value: number; height: string }[] = [];
    
    // Use actual total users from stats if available, otherwise 0
    const stats = this.getStats();
    const totalUsers = stats?.userStats?.totalUsers || 0;
    
    // Distribute total users evenly across months up to current month
    // Or show 0 for months with no data
    let cumulativeUsers = 0;
    
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      
      // Only show data up to current month
      if (i <= currentMonthIndex) {
        // If we have total users but no monthly breakdown, 
        // show them all in the last month that has data
        if (i === currentMonthIndex && totalUsers > 0) {
          cumulativeUsers = totalUsers;
        }
        
        const height = cumulativeUsers > 0 ? '100%' : '0%';
        
        data.push({
          month,
          value: cumulativeUsers,
          height
        });
      } else {
        // Future months show no data
        data.push({
          month,
          value: 0,
          height: '0%'
        });
      }
    }
    
    return data;
  }

  getRecentActivityIcon(activityType: AdminActivityType): string {
    switch (activityType) {
      case 'user_registered':
        return 'uil uil-user-plus';
      case 'business_verified':
        return 'uil uil-check-circle';
      case 'fraud_report':
        return 'uil uil-shield-exclamation';
      default:
        return 'uil uil-bell';
    }
  }

  formatTimeAgo(date: Date): string {
    const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  }
}
