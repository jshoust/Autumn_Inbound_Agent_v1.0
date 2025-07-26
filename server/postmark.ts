import { ServerClient } from 'postmark';
import type { CallRecord, ReportsConfig, EmailLog } from '@shared/schema';
import * as XLSX from 'xlsx';

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
   * Generate Excel file from call record data
   */
  private generateExcelAttachment(callRecord: CallRecord): string {
    const workbook = XLSX.utils.book_new();
    
    // Extract data from JSONB fields
    const extractedData = callRecord.extractedData as any || {};
    const rawData = callRecord.rawData as any || {};
    
    // Main candidate information
    const candidateData = [{
      'Application Date': new Date(callRecord.createdAt).toLocaleDateString(),
      'Candidate Name': `${callRecord.firstName || 'Unknown'} ${callRecord.lastName || ''}`.trim(),
      'Phone Number': callRecord.phone || 'Not provided',
      'Conversation ID': callRecord.conversationId,
      'Agent ID': callRecord.agentId,
      'Status': callRecord.qualified ? 'APPROVED' : 'DENIED',
      'CDL Class A': extractedData.cdlA ? 'Yes' : 'No',
      'Has 24+ Months Experience': extractedData.experience24Months ? 'Yes' : 'No',
      'Work Eligible': extractedData.workEligible ? 'Yes' : 'No',
      'Has Violations': extractedData.hasViolations ? 'Yes' : 'No',
      'Call Duration (seconds)': extractedData.callDuration || 'Unknown',
      'Call Successful': extractedData.callSuccessful ? 'Yes' : 'No'
    }];

    // Add candidate data sheet
    const candidateSheet = XLSX.utils.json_to_sheet(candidateData);
    XLSX.utils.book_append_sheet(workbook, candidateSheet, 'Candidate Details');

    // Extract questions and answers if available
    if (rawData.analysis?.data_collection_results) {
      const qaData = [];
      const dataCollection = rawData.analysis.data_collection_results;
      
      for (const [key, value] of Object.entries(dataCollection)) {
        const question = value as any;
        qaData.push({
          'Question ID': key,
          'Question': question.json_schema?.description || 'No question text',
          'Answer': question.value !== null ? String(question.value) : 'Not answered',
          'Rationale': question.rationale || 'No rationale provided'
        });
      }
      
      if (qaData.length > 0) {
        const qaSheet = XLSX.utils.json_to_sheet(qaData);
        XLSX.utils.book_append_sheet(workbook, qaSheet, 'Q&A Details');
      }
    }

    // Convert to base64 for email attachment
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return excelBuffer.toString('base64');
  }

  /**
   * Send candidate application notification email
   */
  async sendCandidateNotification(
    recipientEmail: string,
    callRecord: CallRecord,
    approved: boolean
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Postmark not configured' };
    }

    try {
      const candidateName = `${callRecord.firstName || 'Unknown'} ${callRecord.lastName || ''}`.trim();
      const subject = approved ? 'New Candidate Application Approved' : 'New Candidate Application Denied';
      const status = approved ? 'APPROVED' : 'DENIED';
      const statusColor = approved ? '#10b981' : '#ef4444';
      
      // Generate Excel attachment
      const excelAttachment = this.generateExcelAttachment(callRecord);
      const fileName = `candidate_${callRecord.conversationId}_${approved ? 'approved' : 'denied'}.xlsx`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin: 0 0 10px 0;">TruckRecruit Pro - Application Update</h2>
            <div style="background-color: ${statusColor}; color: white; padding: 10px; border-radius: 4px; text-align: center; font-weight: bold; font-size: 16px;">
              APPLICATION ${status}
            </div>
          </div>
          
          <h3 style="color: #1e293b;">Candidate Information</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Name:</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${candidateName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Phone:</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${callRecord.phone || 'Not provided'}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Application Date:</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date(callRecord.createdAt).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">Conversation ID:</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${callRecord.conversationId}</td>
            </tr>
          </table>

          <h3 style="color: #1e293b;">Call Details</h3>
          <p style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            Complete call details and qualification information are available in the attached Excel file.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from TruckRecruit Pro.<br>
            Generated at: ${new Date().toLocaleString()}
          </p>
        </div>
      `;

      const textBody = `
TruckRecruit Pro - Application Update

APPLICATION ${status}

Candidate Information:
- Name: ${candidateName}
- Phone: ${callRecord.phone || 'Not provided'}
- Application Date: ${new Date(callRecord.createdAt).toLocaleDateString()}
- Conversation ID: ${callRecord.conversationId}

Complete call details are available in the attached Excel file.

Generated at: ${new Date().toLocaleString()}
      `;

      // Use the same email structure as the working sendTestEmail method
      const response = await this.client.sendEmail({
        From: process.env.FROM_EMAIL || 'noreply@truckrecruit.pro',
        To: recipientEmail,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
        Attachments: [{
          Name: fileName,
          Content: excelAttachment,
          ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }],
        MessageStream: 'outbound',
        TrackOpens: true
      });

      console.log(`Candidate notification sent to ${recipientEmail}, MessageID: ${response.MessageID}`);
      
      return {
        success: true,
        messageId: response.MessageID,
      };
    } catch (error) {
      console.error('Failed to send candidate notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
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