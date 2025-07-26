import { storage } from './storage';
import { postmarkService, type ReportData } from './postmark';
import type { ReportsConfig, CallRecord } from '@shared/schema';

export interface ReportPeriod {
  start: Date;
  end: Date;
  label: string;
}

export class ReportGenerator {
  /**
   * Generate report data for a specific period
   */
  async generateReportData(
    reportConfig: ReportsConfig,
    periodOverride?: ReportPeriod
  ): Promise<ReportData> {
    const period = periodOverride || this.getPeriodForFrequency(reportConfig.frequency);
    
    // Fetch call records for the period
    const callRecords = await this.getCallRecordsForPeriod(period.start, period.end);
    
    // Calculate metrics
    const totalCalls = callRecords.length;
    const qualifiedLeads = callRecords.filter(record => record.qualified === true).length;
    const conversionRate = totalCalls > 0 ? (qualifiedLeads / totalCalls) * 100 : 0;
    
    // Get top performing agents if needed
    const topPerformingAgents = await this.getTopPerformingAgents(callRecords);
    
    return {
      period: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      totalCalls,
      qualifiedLeads,
      conversionRate,
      callRecords,
      topPerformingAgents,
    };
  }

  /**
   * Send report to all eligible users
   */
  async sendScheduledReport(reportConfig: ReportsConfig): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const results = { sent: 0, failed: 0, errors: [] as string[] };
    
    try {
      // Generate report data
      const reportData = await this.generateReportData(reportConfig);
      
      // Get users who should receive this report
      const recipients = await this.getReportRecipients(reportConfig);
      
      if (recipients.length === 0) {
        console.log(`No recipients found for report: ${reportConfig.name}`);
        return results;
      }
      
      // Generate email template
      const template = postmarkService.generateReportTemplate(reportConfig, reportData);
      
      // Send to each recipient
      for (const recipient of recipients) {
        try {
          const result = await postmarkService.sendReportEmail(
            recipient.email,
            template,
            reportData,
            reportConfig
          );
          
          // Log the email attempt
          await storage.logEmailSent({
            reportConfigId: reportConfig.id,
            recipientEmail: recipient.email,
            recipientUserId: recipient.id,
            subject: template.subject,
            status: result.success ? 'sent' : 'failed',
            postmarkMessageId: result.messageId,
            errorMessage: result.error,
            reportPeriodStart: reportData.periodStart,
            reportPeriodEnd: reportData.periodEnd,
            reportData: reportData,
          });
          
          if (result.success) {
            results.sent++;
            console.log(`Report sent successfully to ${recipient.email}`);
          } else {
            results.failed++;
            results.errors.push(`${recipient.email}: ${result.error}`);
            console.error(`Failed to send report to ${recipient.email}:`, result.error);
          }
        } catch (error) {
          results.failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`${recipient.email}: ${errorMsg}`);
          console.error(`Error sending report to ${recipient.email}:`, error);
        }
      }
      
      // Update the report config with last sent time
      await storage.updateReportConfig(reportConfig.id, {
        lastSentAt: new Date(),
        nextSendAt: this.calculateNextSendTime(reportConfig),
      });
      
      console.log(`Report "${reportConfig.name}" completed: ${results.sent} sent, ${results.failed} failed`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`Report generation failed: ${errorMsg}`);
      console.error(`Failed to generate/send report "${reportConfig.name}":`, error);
    }
    
    return results;
  }

  /**
   * Send a test report to a specific email
   */
  async sendTestReport(
    recipientEmail: string,
    reportConfigId?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Use provided config or create a default test config
      let reportConfig: ReportsConfig;
      
      if (reportConfigId) {
        const config = await storage.getReportConfig(reportConfigId);
        if (!config) {
          return { success: false, error: 'Report configuration not found' };
        }
        reportConfig = config;
      } else {
        // Create a default test configuration
        reportConfig = {
          id: 0,
          name: 'Test Report',
          enabled: true,
          frequency: 'weekly',
          frequencyValue: 1,
          dayOfWeek: null,
          dayOfMonth: null,
          hourOfDay: 9,
          reportType: 'summary',
          includeMetrics: { total_calls: true, qualified_leads: true, conversion_rate: true },
          includeCallDetails: true,
          includeCharts: false,
          subjectTemplate: 'TruckRecruit Pro - Test Report',
          templateData: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSentAt: null,
          nextSendAt: null,
        };
      }
      
      // Generate test report data (last 7 days)
      const period = this.getPeriodForFrequency('weekly');
      const reportData = await this.generateReportData(reportConfig, period);
      
      // Generate and send email
      const template = postmarkService.generateReportTemplate(reportConfig, reportData);
      const result = await postmarkService.sendReportEmail(
        recipientEmail,
        template,
        reportData,
        reportConfig
      );
      
      if (result.success) {
        console.log(`Test report sent successfully to ${recipientEmail}`);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to send test report:', error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get call records for a specific time period
   */
  private async getCallRecordsForPeriod(startDate: Date, endDate: Date): Promise<CallRecord[]> {
    // Note: This assumes the storage class has a method to get records by date range
    // You may need to add this method to your storage class
    try {
      return await storage.getCallRecordsByDateRange(startDate, endDate);
    } catch (error) {
      console.error('Error fetching call records for period:', error);
      // Fallback: get recent records and filter
      const allRecords = await storage.getCallRecords();
      return allRecords.filter(record => {
        const recordDate = new Date(record.createdAt);
        return recordDate >= startDate && recordDate <= endDate;
      });
    }
  }

  /**
   * Get users who should receive reports based on their preferences
   */
  private async getReportRecipients(reportConfig: ReportsConfig): Promise<Array<{ id: number; email: string }>> {
    const allUsers = await storage.getUsers();
    
    return allUsers.filter(user => {
      // Skip users who have disabled email notifications
      if (user.emailNotifications === false) {
        return false;
      }
      
      // Check if user's frequency preference matches this report
      // For now, send to all users who have notifications enabled
      // Later you can add more sophisticated filtering based on user preferences
      return user.emailNotifications === true;
    }).map(user => ({
      id: user.id,
      email: user.email,
    }));
  }

  /**
   * Calculate top performing agents from call records
   */
  private async getTopPerformingAgents(callRecords: CallRecord[]): Promise<Array<{ agentId: string; calls: number; qualified: number }>> {
    const agentStats = new Map<string, { calls: number; qualified: number }>();
    
    callRecords.forEach(record => {
      const agentId = record.agentId;
      if (!agentStats.has(agentId)) {
        agentStats.set(agentId, { calls: 0, qualified: 0 });
      }
      
      const stats = agentStats.get(agentId)!;
      stats.calls++;
      if (record.qualified) {
        stats.qualified++;
      }
    });
    
    // Convert to array and sort by qualification rate, then by total calls
    return Array.from(agentStats.entries())
      .map(([agentId, stats]) => ({ agentId, ...stats }))
      .sort((a, b) => {
        const aRate = a.calls > 0 ? a.qualified / a.calls : 0;
        const bRate = b.calls > 0 ? b.qualified / b.calls : 0;
        if (aRate !== bRate) return bRate - aRate; // Higher rate first
        return b.calls - a.calls; // More calls first if same rate
      })
      .slice(0, 5); // Top 5 agents
  }

  /**
   * Get the appropriate time period for a given frequency
   */
  private getPeriodForFrequency(frequency: string): ReportPeriod {
    const now = new Date();
    let start: Date;
    let end: Date;
    let label: string;
    
    switch (frequency) {
      case 'daily':
        start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        end.setMilliseconds(-1);
        
        label = `Daily Report - ${start.toLocaleDateString()}`;
        break;
        
      case 'weekly':
        // Get last 7 days
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        
        label = `Weekly Report - ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
        break;
        
      case 'monthly':
        // Get last 30 days
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        
        label = `Monthly Report - ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
        break;
        
      default:
        // Default to weekly
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        
        label = `Weekly Report - ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
    }
    
    return { start, end, label };
  }

  /**
   * Calculate the next send time for a report configuration
   */
  private calculateNextSendTime(reportConfig: ReportsConfig): Date {
    const now = new Date();
    const nextSend = new Date();
    
    switch (reportConfig.frequency) {
      case 'daily':
        nextSend.setDate(now.getDate() + (reportConfig.frequencyValue || 1));
        nextSend.setHours(reportConfig.hourOfDay || 9, 0, 0, 0);
        break;
        
      case 'weekly':
        const daysToAdd = (reportConfig.frequencyValue || 1) * 7;
        nextSend.setDate(now.getDate() + daysToAdd);
        nextSend.setHours(reportConfig.hourOfDay || 9, 0, 0, 0);
        break;
        
      case 'monthly':
        nextSend.setMonth(now.getMonth() + (reportConfig.frequencyValue || 1));
        if (reportConfig.dayOfMonth) {
          nextSend.setDate(reportConfig.dayOfMonth);
        }
        nextSend.setHours(reportConfig.hourOfDay || 9, 0, 0, 0);
        break;
        
      default:
        // Default to 7 days from now
        nextSend.setDate(now.getDate() + 7);
        nextSend.setHours(9, 0, 0, 0);
    }
    
    return nextSend;
  }
}

// Export singleton instance
export const reportGenerator = new ReportGenerator(); 