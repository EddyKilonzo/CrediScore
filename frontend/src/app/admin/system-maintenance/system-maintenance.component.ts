import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

interface SystemMetrics {
  uptime: string;
  responseTime: string;
  activeUsers: number;
  totalRequests: number;
  errorRate: string;
  lastBackup: Date;
  nextMaintenance: Date;
}

interface MaintenanceTask {
  id: number;
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  scheduledDate: Date;
  estimatedDuration: string;
}

interface SystemLog {
  id: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  source: string;
}

@Component({
  selector: 'app-system-maintenance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './system-maintenance.component.html',
  styleUrl: './system-maintenance.component.css'
})
export class SystemMaintenanceComponent implements OnInit {
  systemStatus: SystemMetrics = {
    uptime: '0%',
    responseTime: '0ms',
    activeUsers: 0,
    totalRequests: 0,
    errorRate: '0%',
    lastBackup: new Date(),
    nextMaintenance: new Date()
  };

  maintenanceTasks: MaintenanceTask[] = [];
  logs: SystemLog[] = [];
  isLoading = true;
  error: string | null = null;

  private readonly API_BASE = '/api/admin/system';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
    this.loadSystemData();
  }

  private async loadSystemData(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;
      
      // Load all data in parallel for better performance
      await Promise.all([
        this.loadSystemMetrics(),
        this.loadMaintenanceTasks(),
        this.loadSystemLogs()
      ]);
      
    } catch (error: any) {
      console.error('Error loading system data:', error);
      this.error = error.message || 'Failed to load system data';
    } finally {
      this.isLoading = false;
    }
  }

  private async loadSystemMetrics(): Promise<void> {
    try {
      const response = await this.http.get<SystemMetrics>(`${this.API_BASE}/metrics`).toPromise();
      if (response) {
        this.systemStatus = {
          ...response,
          lastBackup: new Date(response.lastBackup),
          nextMaintenance: new Date(response.nextMaintenance)
        };
      }
    } catch (error) {
      console.error('Error loading system metrics:', error);
      // Fallback to empty state
      this.systemStatus = {
        uptime: '0%',
        responseTime: '0ms',
        activeUsers: 0,
        totalRequests: 0,
        errorRate: '0%',
        lastBackup: new Date(),
        nextMaintenance: new Date()
      };
    }
  }

  private async loadMaintenanceTasks(): Promise<void> {
    try {
      const response = await this.http.get<MaintenanceTask[]>(`${this.API_BASE}/maintenance-tasks`).toPromise();
      if (response) {
        this.maintenanceTasks = response.map(task => ({
          ...task,
          scheduledDate: new Date(task.scheduledDate)
        }));
      }
    } catch (error) {
      console.error('Error loading maintenance tasks:', error);
      this.maintenanceTasks = [];
    }
  }

  private async loadSystemLogs(): Promise<void> {
    try {
      const response = await this.http.get<SystemLog[]>(`${this.API_BASE}/logs`).toPromise();
      if (response) {
        this.logs = response.map(log => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading system logs:', error);
      this.logs = [];
    }
  }

  getStatusCards(): any[] {
    return [
      {
        icon: 'fas fa-server',
        value: this.systemStatus.uptime,
        label: 'System Uptime'
      },
      {
        icon: 'fas fa-tachometer-alt',
        value: this.systemStatus.responseTime,
        label: 'Response Time'
      },
      {
        icon: 'fas fa-users',
        value: this.systemStatus.activeUsers,
        label: 'Active Users'
      },
      {
        icon: 'fas fa-chart-line',
        value: this.systemStatus.totalRequests,
        label: 'Total Requests'
      },
      {
        icon: 'fas fa-exclamation-triangle',
        value: this.systemStatus.errorRate,
        label: 'Error Rate'
      },
      {
        icon: 'fas fa-database',
        value: this.systemStatus.lastBackup,
        label: 'Last Backup'
      }
    ];
  }

  isBackupRecent(): boolean {
    const now = new Date();
    const backupDate = new Date(this.systemStatus.lastBackup);
    const daysDifference = (now.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDifference <= 7; // Consider backup recent if within 7 days
  }

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  async runMaintenance(taskId: number): Promise<void> {
    try {
      console.log('Running maintenance task:', taskId);
      
      const response = await this.http.post(`${this.API_BASE}/maintenance-tasks/${taskId}/run`, {}).toPromise();
      
      if (response) {
        console.log('Maintenance task started successfully');
        // Refresh maintenance tasks to show updated status
        await this.loadMaintenanceTasks();
      }
    } catch (error) {
      console.error('Error running maintenance task:', error);
      this.error = 'Failed to run maintenance task';
    }
  }

  async scheduleMaintenance(taskId: number): Promise<void> {
    try {
      console.log('Scheduling maintenance task:', taskId);
      
      const response = await this.http.post(`${this.API_BASE}/maintenance-tasks/${taskId}/schedule`, {}).toPromise();
      
      if (response) {
        console.log('Maintenance task scheduled successfully');
        // Refresh maintenance tasks to show updated schedule
        await this.loadMaintenanceTasks();
      }
    } catch (error) {
      console.error('Error scheduling maintenance task:', error);
      this.error = 'Failed to schedule maintenance task';
    }
  }

  async viewLogs(): Promise<void> {
    try {
      console.log('Viewing system logs');
      
      // Navigate to detailed logs view or open modal
      this.router.navigate(['/admin/system/logs']);
    } catch (error) {
      console.error('Error viewing logs:', error);
      this.error = 'Failed to load detailed logs';
    }
  }

  async clearCache(): Promise<void> {
    try {
      console.log('Clearing system cache');
      this.error = null; // Clear any previous errors
      
      // Show loading state for cache clearing
      const originalLoading = this.isLoading;
      this.isLoading = true;
      
      const response = await this.http.post(`${this.API_BASE}/cache/clear`, {}).toPromise();
      
      if (response) {
        console.log('System cache cleared successfully');
        // Refresh system metrics to show updated performance
        await this.loadSystemMetrics();
        
        // Show success message temporarily
        this.showSuccessMessage('System cache cleared successfully');
      }
    } catch (error: any) {
      console.error('Error clearing cache:', error);
      
      // More specific error handling
      if (error.status === 404) {
        this.error = 'Cache clearing service not available';
      } else if (error.status === 403) {
        this.error = 'Insufficient permissions to clear cache';
      } else if (error.status === 500) {
        this.error = 'Server error while clearing cache';
      } else {
        this.error = error.message || 'Failed to clear system cache';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private showSuccessMessage(message: string): void {
    // Create a temporary success message
    const successElement = document.createElement('div');
    successElement.className = 'success-banner fade-in-up';
    successElement.innerHTML = `
      <div class="success-content">
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
      </div>
    `;
    
    // Insert after the header
    const header = document.querySelector('.page-header');
    if (header) {
      header.parentNode?.insertBefore(successElement, header.nextSibling);
      
      // Remove after 3 seconds
      setTimeout(() => {
        successElement.remove();
      }, 3000);
    }
  }

  async backupSystem(): Promise<void> {
    try {
      console.log('Starting system backup');
      
      const response = await this.http.post(`${this.API_BASE}/backup/start`, {}).toPromise();
      
      if (response) {
        console.log('System backup started successfully');
        // Refresh system metrics to show updated backup time
        await this.loadSystemMetrics();
      }
    } catch (error) {
      console.error('Error starting backup:', error);
      this.error = 'Failed to start system backup';
    }
  }
}
