import { ServerClient } from "postmark";
import type { Candidate } from "@shared/schema";

const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN || "");

export interface EmailService {
  sendQualificationNotification(candidate: Candidate): Promise<void>;
}

export class PostmarkEmailService implements EmailService {
  async sendQualificationNotification(candidate: Candidate): Promise<void> {
    if (!process.env.POSTMARK_SERVER_TOKEN) {
      console.warn("POSTMARK_SERVER_TOKEN not configured, skipping email notification");
      return;
    }

    if (!process.env.FROM_EMAIL) {
      console.warn("FROM_EMAIL not configured, skipping email notification");
      return;
    }

    if (!candidate.phone) {
      console.warn("Candidate has no phone number, cannot send notification");
      return;
    }

    // Extract potential email from phone or use a placeholder
    // In a real application, you'd need to collect email during the call or have a way to convert phone to email
    const candidateEmail = this.extractOrGenerateEmail(candidate.phone);

    try {
      await postmarkClient.sendEmail({
        From: process.env.FROM_EMAIL,
        To: candidateEmail,
        Subject: "Congratulations! You've Been Pre-Qualified for Truck Driving Opportunities",
        HtmlBody: this.generateQualificationEmailHtml(candidate),
        TextBody: this.generateQualificationEmailText(candidate),
        MessageStream: "outbound"
      });
      
      console.log(`Qualification email sent to ${candidateEmail} for candidate ${candidate.id}`);
    } catch (error) {
      console.error("Failed to send qualification email:", error);
      throw error;
    }
  }

  private extractOrGenerateEmail(phone: string): string {
    // In a real application, you would have collected email during the call
    // For demo purposes, we'll use a placeholder pattern
    const cleanPhone = phone.replace(/\D/g, '');
    return `driver.${cleanPhone}@placeholder-domain.com`;
  }

  private generateQualificationEmailHtml(candidate: Candidate): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Pre-Qualification Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .button { 
            display: inline-block; 
            background: #16a34a; 
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
            <h1>🚛 TruckRecruit Pro</h1>
            <h2>Pre-Qualification Approved!</h2>
          </div>
          
          <div class="content">
            <h3>Congratulations!</h3>
            <p>Based on your recent phone screening, you've been pre-qualified for truck driving opportunities with our partner companies.</p>
            
            <h4>Your Qualification Details:</h4>
            <ul>
              <li><strong>Phone:</strong> ${candidate.phone}</li>
              <li><strong>CDL Status:</strong> ${candidate.cdlType || 'Under Review'}</li>
              <li><strong>Experience:</strong> ${candidate.experience || 'Under Review'}</li>
              <li><strong>Call ID:</strong> #${candidate.callId || candidate.id}</li>
            </ul>
            
            <h4>Next Steps:</h4>
            <p>Our recruitment team will contact you within 24-48 hours to discuss available opportunities and next steps in the hiring process.</p>
            
            <p>In the meantime, please ensure you have the following documents ready:</p>
            <ul>
              <li>Valid CDL-A License</li>
              <li>DOT Medical Certificate</li>
              <li>Driving Record (MVR)</li>
              <li>Employment History</li>
            </ul>
            
            ${process.env.CONTACT_PHONE ? `
            <div style="text-align: center;">
              <a href="tel:${process.env.CONTACT_PHONE}" class="button">
                Call Us: ${process.env.CONTACT_PHONE}
              </a>
            </div>
            ` : ''}
          </div>
          
          <div class="footer">
            <p>This is an automated message from TruckRecruit Pro. Please do not reply to this email.</p>
            ${process.env.CONTACT_PHONE ? `<p>If you have questions, call us at ${process.env.CONTACT_PHONE}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateQualificationEmailText(candidate: Candidate): string {
    return `
TruckRecruit Pro - Pre-Qualification Approved!

Congratulations!

Based on your recent phone screening, you've been pre-qualified for truck driving opportunities with our partner companies.

Your Qualification Details:
- Phone: ${candidate.phone}
- CDL Status: ${candidate.cdlType || 'Under Review'}
- Experience: ${candidate.experience || 'Under Review'}
- Call ID: #${candidate.callId || candidate.id}

Next Steps:
Our recruitment team will contact you within 24-48 hours to discuss available opportunities and next steps in the hiring process.

Please ensure you have the following documents ready:
• Valid CDL-A License
• DOT Medical Certificate
• Driving Record (MVR)
• Employment History

${process.env.CONTACT_PHONE ? `Questions? Call us at ${process.env.CONTACT_PHONE}\n\n` : ''}This is an automated message from TruckRecruit Pro.
    `;
  }
}

export const emailService = new PostmarkEmailService();