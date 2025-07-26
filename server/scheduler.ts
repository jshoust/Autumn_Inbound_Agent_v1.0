import * as cron from 'node-cron';
import { storage } from './storage';
import { reportGenerator } from './report-generator';

export class ReportScheduler {
  private jobs: Map<number, cron.ScheduledTask> = new Map();
  private isRunning: boolean = false;

  /**
   * Start the scheduler - check for reports to send every minute
   */
  start(): void {
    if (this.isRunning) {
      console.log('Report scheduler is already running');
      return;
    }

    console.log('Starting report scheduler...');
    
    // Check for scheduled reports every minute
    const task = cron.schedule('* * * * *', async () => {
      await this.processScheduledReports();
    }, {
      scheduled: false // Don't start automatically
    });

    task.start();
    this.isRunning = true;
    
    console.log('Report scheduler started - checking for reports every minute');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Report scheduler is not running');
      return;
    }

    // Stop all individual report jobs
    this.jobs.forEach((job) => {
      job.stop();
    });
    this.jobs.clear();

    this.isRunning = false;
    console.log('Report scheduler stopped');
  }

  /**
   * Process all scheduled reports that are due
   */
  private async processScheduledReports(): Promise<void> {
    try {
      const scheduledReports = await storage.getScheduledReports();
      
      if (scheduledReports.length === 0) {
        return; // No reports to process
      }

      console.log(`Found ${scheduledReports.length} scheduled reports to process`);

      for (const reportConfig of scheduledReports) {
        try {
          console.log(`Processing scheduled report: ${reportConfig.name}`);
          
          const result = await reportGenerator.sendScheduledReport(reportConfig);
          
          console.log(`Report "${reportConfig.name}" completed: ${result.sent} sent, ${result.failed} failed`);
          
          if (result.errors.length > 0) {
            console.warn(`Errors in report "${reportConfig.name}":`, result.errors);
          }
        } catch (error) {
          console.error(`Failed to process report "${reportConfig.name}":`, error);
        }
      }
    } catch (error) {
      console.error('Error processing scheduled reports:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { running: boolean; activeJobs: number } {
    return {
      running: this.isRunning,
      activeJobs: this.jobs.size,
    };
  }

  /**
   * Force process all scheduled reports now (for testing)
   */
  async forceProcessReports(): Promise<void> {
    console.log('Force processing all scheduled reports...');
    await this.processScheduledReports();
  }

  /**
   * Add a specific report to the scheduler (advanced usage)
   */
  scheduleReport(reportConfig: any): void {
    if (this.jobs.has(reportConfig.id)) {
      // Remove existing job first
      this.jobs.get(reportConfig.id)?.stop();
      this.jobs.delete(reportConfig.id);
    }

    // Create cron expression based on report configuration
    const cronExpression = this.createCronExpression(reportConfig);
    
    if (!cronExpression) {
      console.warn(`Could not create cron expression for report: ${reportConfig.name}`);
      return;
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        console.log(`Executing scheduled report: ${reportConfig.name}`);
        await reportGenerator.sendScheduledReport(reportConfig);
      } catch (error) {
        console.error(`Failed to execute scheduled report "${reportConfig.name}":`, error);
      }
    }, {
      scheduled: false,
      timezone: 'America/New_York' // Adjust timezone as needed
    });

    this.jobs.set(reportConfig.id, job);
    job.start();
    
    console.log(`Scheduled report "${reportConfig.name}" with cron: ${cronExpression}`);
  }

  /**
   * Remove a report from the scheduler
   */
  unscheduleReport(reportId: number): void {
    const job = this.jobs.get(reportId);
    if (job) {
      job.stop();
      this.jobs.delete(reportId);
      console.log(`Unscheduled report ID: ${reportId}`);
    }
  }

  /**
   * Create cron expression from report configuration
   */
  private createCronExpression(reportConfig: any): string | null {
    const hour = reportConfig.hourOfDay || 9;
    const minute = 0; // Always at the top of the hour

    switch (reportConfig.frequency) {
      case 'daily':
        // Every day at specified hour
        return `${minute} ${hour} * * *`;
        
      case 'weekly':
        // Weekly on specified day (0=Sunday, 1=Monday, etc.)
        const dayOfWeek = reportConfig.dayOfWeek || 1; // Default to Monday
        return `${minute} ${hour} * * ${dayOfWeek}`;
        
      case 'monthly':
        // Monthly on specified day
        const dayOfMonth = reportConfig.dayOfMonth || 1; // Default to 1st of month
        return `${minute} ${hour} ${dayOfMonth} * *`;
        
      default:
        console.warn(`Unknown frequency: ${reportConfig.frequency}`);
        return null;
    }
  }

  /**
   * Refresh all scheduled reports (reload from database)
   */
  async refreshSchedule(): Promise<void> {
    console.log('Refreshing report schedule...');
    
    try {
      // Stop all current jobs
      this.jobs.forEach((job) => {
        job.stop();
      });
      this.jobs.clear();

      // Load all enabled reports from database
      const allReports = await storage.getReportConfigs();
      const enabledReports = allReports.filter(report => report.enabled);

      // Schedule each enabled report
      for (const reportConfig of enabledReports) {
        this.scheduleReport(reportConfig);
      }

      console.log(`Refreshed schedule with ${enabledReports.length} active reports`);
    } catch (error) {
      console.error('Error refreshing report schedule:', error);
    }
  }
}

// Export singleton instance
export const reportScheduler = new ReportScheduler();

// Auto-start scheduler when module is imported (in production)
if (process.env.NODE_ENV === 'production') {
  reportScheduler.start();
  
  // Refresh schedule every hour to pick up changes
  cron.schedule('0 * * * *', async () => {
    await reportScheduler.refreshSchedule();
  });
  
  console.log('Report scheduler auto-started in production mode');
} 