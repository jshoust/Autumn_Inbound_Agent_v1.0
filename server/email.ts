import { ServerClient } from "postmark";
import type { Candidate } from "@shared/schema";

const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN || "");

export interface EmailService {
  sendRecruiterNotification(candidate: Candidate): Promise<void>;
}

export class PostmarkEmailService implements EmailService {
  async sendRecruiterNotification(candidate: Candidate): Promise<void> {
    if (!process.env.POSTMARK_SERVER_TOKEN) {
      console.warn("POSTMARK_SERVER_TOKEN not configured, skipping recruiter notification");
      return;
    }

    if (!process.env.FROM_EMAIL) {
      console.warn("FROM_EMAIL not configured, skipping recruiter notification");
      return;
    }

    if (!process.env.RECRUITER_EMAIL) {
      console.warn("RECRUITER_EMAIL not configured, skipping recruiter notification");
      return;
    }

    try {
      await postmarkClient.sendEmail({
        From: process.env.FROM_EMAIL,
        To: process.env.RECRUITER_EMAIL,
        Subject: `New Qualified Driver Candidate - ${candidate.phone}`,
        HtmlBody: this.generateRecruiterNotificationHtml(candidate),
        TextBody: this.generateRecruiterNotificationText(candidate),
        MessageStream: "outbound"
      });
      
      console.log(`Recruiter notification sent for candidate ${candidate.id}`);
    } catch (error) {
      console.error("Failed to send recruiter notification:", error);
      throw error;
    }
  }

  private generateRecruiterNotificationHtml(candidate: Candidate): string {
    const qualificationBadge = candidate.qualified === true ? 
      '<span style="background: #16a34a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">QUALIFIED</span>' :
      candidate.qualified === false ?
      '<span style="background: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">NOT QUALIFIED</span>' :
      '<span style="background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PENDING REVIEW</span>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Driver Candidate</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .candidate-info { background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .button { 
            display: inline-block; 
            background: #2563eb; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📞 TruckRecruit Pro</h1>
            <h2>New Qualified Driver Candidate</h2>
          </div>
          
          <div class="content">
            <div class="candidate-info">
              <h3>Candidate Details ${qualificationBadge}</h3>
              <ul>
                <li><strong>Phone:</strong> ${candidate.phone}</li>
                <li><strong>CDL Status:</strong> ${candidate.cdlType || 'Not specified'}</li>
                <li><strong>Experience:</strong> ${candidate.experience || 'Not specified'}</li>
                <li><strong>Call ID:</strong> #${candidate.callId || candidate.id}</li>
                <li><strong>Call Time:</strong> ${new Date(candidate.createdAt).toLocaleString()}</li>
              </ul>
            </div>
            
            ${candidate.transcript ? `
            <h4>Call Summary:</h4>
            <div style="background: white; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 14px; max-height: 200px; overflow-y: auto;">
              ${JSON.stringify(candidate.transcript, null, 2)}
            </div>
            ` : ''}
            
            <h4>Recommended Actions:</h4>
            <ul>
              <li>Review candidate qualification in the dashboard</li>
              <li>Contact candidate within 24 hours if qualified</li>
              <li>Schedule follow-up interview if needed</li>
              <li>Request additional documentation</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${process.env.DASHBOARD_URL || 'http://localhost:5000'}" class="button">
                View in Dashboard
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from TruckRecruit Pro</p>
            <p>Candidate ID: ${candidate.id} | Generated: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateRecruiterNotificationText(candidate: Candidate): string {
    const status = candidate.qualified === true ? 'QUALIFIED' : 
                  candidate.qualified === false ? 'NOT QUALIFIED' : 'PENDING REVIEW';
    
    return `
TruckRecruit Pro - New Driver Candidate [${status}]

Candidate Details:
- Phone: ${candidate.phone}
- CDL Status: ${candidate.cdlType || 'Not specified'}
- Experience: ${candidate.experience || 'Not specified'}
- Call ID: #${candidate.callId || candidate.id}
- Call Time: ${new Date(candidate.createdAt).toLocaleString()}

${candidate.transcript ? 'Call transcript available in dashboard' : 'No transcript available'}

Recommended Actions:
• Review candidate qualification in dashboard
• Contact candidate within 24 hours if qualified
• Schedule follow-up interview if needed
• Request additional documentation

Dashboard: ${process.env.DASHBOARD_URL || 'http://localhost:5000'}
Candidate ID: ${candidate.id}
    `;
  }
}

export const emailService = new PostmarkEmailService();