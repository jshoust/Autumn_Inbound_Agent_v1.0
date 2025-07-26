import { ServerClient } from 'postmark';
import type { CallRecord, ReportsConfig, EmailLog } from '@shared/schema';

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface ReportData {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  totalCalls: number;
  qualifiedLeads: number;
  conversionRate: number;
  callRecords: CallRecord[];
  topPerformingAgents?: { agentId: string; calls: number; qualified: number }[];
}

export class PostmarkService {
  private client: ServerClient;
  private isEnabled: boolean = false;

  constructor() {
    const serverToken = process.env.POSTMARK_SERVER_TOKEN;
    
    if (serverToken) {
      this.client = new ServerClient(serverToken);
      this.isEnabled = true;
      console.log('Postmark service initialized');
    } else {
      console.warn('POSTMARK_SERVER_TOKEN not configured - email sending disabled');
    }
  }

  /**
   * Send a report email to a recipient
   */
  async sendReportEmail(
    recipientEmail: string,
    template: EmailTemplate,
    reportData: ReportData,
    reportConfig: ReportsConfig
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Postmark not configured' };
    }

    try {
      const response = await this.client.sendEmail({
        From: process.env.POSTMARK_FROM_EMAIL || 'reports@truckrecruit.pro',
        To: recipientEmail,
        Subject: this.processTemplate(template.subject, reportData),
        HtmlBody: template.htmlBody,
        TextBody: template.textBody,
        MessageStream: 'reports', // Separate stream for reports
        Metadata: {
          reportConfigId: reportConfig.id.toString(),
          reportType: reportConfig.reportType,
          period: reportData.period,
        },
        TrackOpens: true,
        TrackLinks: 'TextOnly',
      });

      console.log(`Report email sent to ${recipientEmail}, MessageID: ${response.MessageID}`);
      
      return {
        success: true,
        messageId: response.MessageID,
      };
    } catch (error) {
      console.error('Failed to send report email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate email template based on report configuration
   */
  generateReportTemplate(reportConfig: ReportsConfig, reportData: ReportData): EmailTemplate {
    const subject = this.processTemplate(
      reportConfig.subjectTemplate || 'TruckRecruit Pro - {period} Report',
      reportData
    );

    // Generate HTML body
    const htmlBody = this.generateHtmlTemplate(reportConfig, reportData);
    
    // Generate text body (simplified version)
    const textBody = this.generateTextTemplate(reportConfig, reportData);

    return { subject, htmlBody, textBody };
  }

  /**
   * Process template variables like {period}, {totalCalls}, etc.
   */
  private processTemplate(template: string, reportData: ReportData): string {
    return template
      .replace(/{period}/g, reportData.period)
      .replace(/{totalCalls}/g, reportData.totalCalls.toString())
      .replace(/{qualifiedLeads}/g, reportData.qualifiedLeads.toString())
      .replace(/{conversionRate}/g, `${reportData.conversionRate.toFixed(1)}%`);
  }

  /**
   * Generate HTML email template
   */
  private generateHtmlTemplate(reportConfig: ReportsConfig, reportData: ReportData): string {
    const metrics = reportConfig.includeMetrics as any || {};
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TruckRecruit Pro Report</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
        .metric { background: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #2563eb; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
        .metric-label { color: #64748b; font-size: 14px; }
        .call-record { border: 1px solid #e2e8f0; margin: 10px 0; padding: 15px; border-radius: 6px; }
        .qualified { border-left-color: #10b981; border-left-width: 4px; }
        .not-qualified { border-left-color: #ef4444; border-left-width: 4px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">TruckRecruit Pro</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${reportData.period} Report</p>
        </div>`;

    // Add metrics section
    if (metrics.total_calls) {
      html += `
        <div class="metric">
          <div class="metric-value">${reportData.totalCalls}</div>
          <div class="metric-label">Total Calls</div>
        </div>`;
    }

    if (metrics.qualified_leads) {
      html += `
        <div class="metric">
          <div class="metric-value">${reportData.qualifiedLeads}</div>
          <div class="metric-label">Qualified Leads</div>
        </div>`;
    }

    if (metrics.conversion_rate) {
      html += `
        <div class="metric">
          <div class="metric-value">${reportData.conversionRate.toFixed(1)}%</div>
          <div class="metric-label">Conversion Rate</div>
        </div>`;
    }

    // Add call details if requested
    if (reportConfig.includeCallDetails && reportData.callRecords.length > 0) {
      html += `<h3 style="margin-top: 30px; color: #1e293b;">Recent Call Details</h3>`;
      
      // Show up to 10 most recent calls
      const recentCalls = reportData.callRecords.slice(0, 10);
      
      recentCalls.forEach(call => {
        const qualifiedClass = call.qualified ? 'qualified' : 'not-qualified';
        const qualifiedText = call.qualified ? '✅ Qualified' : '❌ Not Qualified';
        
        html += `
          <div class="call-record ${qualifiedClass}">
            <strong>${call.firstName || 'Unknown'} ${call.lastName || ''}</strong>
            ${call.phone ? `<br><strong>Phone:</strong> ${call.phone}` : ''}
            <br><strong>Status:</strong> ${qualifiedText}
            <br><strong>Date:</strong> ${new Date(call.createdAt).toLocaleDateString()}
          </div>`;
      });

      if (reportData.callRecords.length > 10) {
        html += `<p style="color: #64748b; font-style: italic;">... and ${reportData.callRecords.length - 10} more calls</p>`;
      }
    }

    html += `
        <div class="footer">
          <p>This is an automated report from TruckRecruit Pro. Report generated on ${new Date().toLocaleString()}.</p>
          <p>Period: ${reportData.periodStart.toLocaleDateString()} - ${reportData.periodEnd.toLocaleDateString()}</p>
        </div>
      </div>
    </body>
    </html>`;

    return html;
  }

  /**
   * Generate plain text email template
   */
  private generateTextTemplate(reportConfig: ReportsConfig, reportData: ReportData): string {
    const metrics = reportConfig.includeMetrics as any || {};
    
    let text = `TRUCKRECRUIT PRO - ${reportData.period.toUpperCase()} REPORT\n`;
    text += `${'='.repeat(50)}\n\n`;

    if (metrics.total_calls) {
      text += `Total Calls: ${reportData.totalCalls}\n`;
    }
    if (metrics.qualified_leads) {
      text += `Qualified Leads: ${reportData.qualifiedLeads}\n`;
    }
    if (metrics.conversion_rate) {
      text += `Conversion Rate: ${reportData.conversionRate.toFixed(1)}%\n`;
    }

    if (reportConfig.includeCallDetails && reportData.callRecords.length > 0) {
      text += `\nRECENT CALL DETAILS:\n${'-'.repeat(30)}\n`;
      
      reportData.callRecords.slice(0, 10).forEach(call => {
        text += `\n${call.firstName || 'Unknown'} ${call.lastName || ''}`;
        if (call.phone) text += `\nPhone: ${call.phone}`;
        text += `\nStatus: ${call.qualified ? 'Qualified' : 'Not Qualified'}`;
        text += `\nDate: ${new Date(call.createdAt).toLocaleDateString()}\n`;
        text += '-'.repeat(20) + '\n';
      });
    }

    text += `\nReport Period: ${reportData.periodStart.toLocaleDateString()} - ${reportData.periodEnd.toLocaleDateString()}`;
    text += `\nGenerated: ${new Date().toLocaleString()}`;

    return text;
  }

  /**
   * Test email sending capability
   */
  async sendTestEmail(
    recipientEmail: string, 
    subject: string, 
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Postmark not configured' };
    }

    try {
      const response = await this.client.sendEmail({
        From: process.env.FROM_EMAIL || 'noreply@truckrecruit.pro',
        To: recipientEmail,
        Subject: subject,
        HtmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e293b;">Test Email from TruckRecruit Pro</h2>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #374151;">${message}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 14px;">
              This is a test email sent from your recruitment system.<br>
              Sent at: ${new Date().toLocaleString()}
            </p>
          </div>
        `,
        TextBody: `Test Email from TruckRecruit Pro\n\n${message}\n\nThis is a test email sent from your recruitment system.\nSent at: ${new Date().toLocaleString()}`,
        MessageStream: 'outbound',
        TrackOpens: true,
      });

      console.log(`Test email sent to ${recipientEmail}, MessageID: ${response.MessageID}`);
      
      return {
        success: true,
        messageId: response.MessageID,
      };
    } catch (error) {
      console.error('Failed to send test email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Postmark not configured' };
    }

    try {
      // Use Postmark's test endpoint
      await this.client.sendEmail({
        From: process.env.POSTMARK_FROM_EMAIL || 'test@truckrecruit.pro',
        To: 'test@blackhole.postmarkapp.com', // Postmark's test email
        Subject: 'TruckRecruit Pro - Connection Test',
        TextBody: 'This is a test email to verify Postmark configuration.',
        MessageStream: 'reports',
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const postmarkService = new PostmarkService(); 