import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';

interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  recruiterEmail: string;
  defaultDurationMinutes: number;
  timezone: string;
}

interface InterviewSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
}

interface ScheduledInterview {
  id: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateName: string;
  recruiterEmail: string;
  calendarEventId?: string;
}

interface ElevenLabsToolResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class CalendarService {
  private config: CalendarConfig;
  private graphClient: Client;

  constructor(config: CalendarConfig) {
    this.config = config;
    this.initializeGraphClient();
  }

  private initializeGraphClient() {
    const credential = new ClientSecretCredential(
      this.config.tenantId,
      this.config.clientId,
      this.config.clientSecret
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    });

    this.graphClient = Client.initWithMiddleware({
      authProvider: authProvider
    });
  }

  /**
   * Get available slots using ElevenLabs tool
   */
  async getAvailableSlots(daysAhead: number = 7): Promise<InterviewSlot[]> {
    try {
      // Call your existing ElevenLabs get_available_slots tool
      const response = await this.callElevenLabsTool('get_available_slots', {
        days_ahead: daysAhead,
        duration_minutes: this.config.defaultDurationMinutes,
        timezone: this.config.timezone
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to get available slots');
      }

      // Convert the response to InterviewSlot format
      return response.data.map((slot: any) => ({
        startTime: new Date(slot.start_time),
        endTime: new Date(slot.end_time),
        available: slot.available
      }));
    } catch (error) {
      console.error('Error getting available slots:', error);
      throw new Error('Failed to get available interview slots');
    }
  }

  /**
   * Check availability for a specific time
   */
  async checkAvailability(startTime: Date, endTime: Date): Promise<boolean> {
    try {
      const response = await this.callElevenLabsTool('check_availability', {
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        timezone: this.config.timezone
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to check availability');
      }

      return response.data.available;
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  }

  /**
   * Book appointment using ElevenLabs tool
   */
  async bookAppointment(candidate: {
    name: string;
    phone: string;
    email?: string;
    schedule?: string;
  }): Promise<ScheduledInterview> {
    try {
      // First get available slots
      const availableSlots = await this.getAvailableSlots();
      
      if (availableSlots.length === 0) {
        throw new Error('No available interview slots found');
      }

      // Use the first available slot
      const selectedSlot = availableSlots[0];

      // Book the appointment using your ElevenLabs tool
      const response = await this.callElevenLabsTool('book_appointment', {
        candidate_name: candidate.name,
        candidate_phone: candidate.phone,
        candidate_email: candidate.email,
        start_time: selectedSlot.startTime.toISOString(),
        end_time: selectedSlot.endTime.toISOString(),
        duration_minutes: this.config.defaultDurationMinutes,
        recruiter_email: this.config.recruiterEmail,
        timezone: this.config.timezone,
        subject: `Interview: ${candidate.name}`
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to book appointment');
      }

      const scheduledInterview: ScheduledInterview = {
        id: response.data.id || `interview_${Date.now()}`,
        subject: response.data.subject || `Interview: ${candidate.name}`,
        startTime: new Date(response.data.start_time),
        endTime: new Date(response.data.end_time),
        candidateEmail: candidate.email,
        candidatePhone: candidate.phone,
        candidateName: candidate.name,
        recruiterEmail: this.config.recruiterEmail,
        calendarEventId: response.data.calendar_event_id
      };

      return scheduledInterview;
    } catch (error) {
      console.error('Error booking appointment:', error);
      throw new Error('Failed to book interview appointment');
    }
  }

  /**
   * Get next appointment using ElevenLabs tool
   */
  async getNextAppointment(): Promise<ScheduledInterview | null> {
    try {
      const response = await this.callElevenLabsTool('get_next_appointment', {
        recruiter_email: this.config.recruiterEmail
      });

      if (!response.success || !response.data) {
        return null;
      }

      return {
        id: response.data.id,
        subject: response.data.subject,
        startTime: new Date(response.data.start_time),
        endTime: new Date(response.data.end_time),
        candidateEmail: response.data.candidate_email,
        candidatePhone: response.data.candidate_phone,
        candidateName: response.data.candidate_name,
        recruiterEmail: this.config.recruiterEmail,
        calendarEventId: response.data.calendar_event_id
      };
    } catch (error) {
      console.error('Error getting next appointment:', error);
      return null;
    }
  }

  /**
   * Call ElevenLabs tool (placeholder - integrate with your actual ElevenLabs setup)
   */
  private async callElevenLabsTool(toolName: string, params: any): Promise<ElevenLabsToolResponse> {
    try {
      // TODO: Replace this with your actual ElevenLabs tool calling mechanism
      // This is a placeholder that you'll need to replace with your actual implementation
      
      console.log(`Calling ElevenLabs tool: ${toolName}`, params);
      
      // For now, return a mock response
      // You'll need to integrate this with your actual ElevenLabs tools
      switch (toolName) {
        case 'get_available_slots':
          return this.mockGetAvailableSlots(params);
        case 'check_availability':
          return this.mockCheckAvailability(params);
        case 'book_appointment':
          return this.mockBookAppointment(params);
        case 'get_next_appointment':
          return this.mockGetNextAppointment(params);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Error calling ElevenLabs tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Mock implementations - replace with actual ElevenLabs tool calls
   */
  private mockGetAvailableSlots(params: any): ElevenLabsToolResponse {
    const slots = [];
    const now = new Date();
    
    for (let day = 0; day < (params.days_ahead || 7); day++) {
      const currentDate = new Date(now);
      currentDate.setDate(currentDate.getDate() + day);
      
      // Skip weekends
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) continue;
      
      // Generate slots for business hours (9 AM - 5 PM)
      for (let hour = 9; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startTime = new Date(currentDate);
          startTime.setHours(hour, minute, 0, 0);
          
          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + (params.duration_minutes || 30));
          
          if (startTime > now) {
            slots.push({
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              available: true
            });
          }
        }
      }
    }
    
    return {
      success: true,
      data: slots.slice(0, 20) // Return first 20 slots
    };
  }

  private mockCheckAvailability(params: any): ElevenLabsToolResponse {
    // Mock availability check - always return true for demo
    return {
      success: true,
      data: { available: true }
    };
  }

  private mockBookAppointment(params: any): ElevenLabsToolResponse {
    return {
      success: true,
      data: {
        id: `appointment_${Date.now()}`,
        subject: params.subject,
        start_time: params.start_time,
        end_time: params.end_time,
        calendar_event_id: `event_${Date.now()}`,
        candidate_name: params.candidate_name,
        candidate_phone: params.candidate_phone,
        candidate_email: params.candidate_email
      }
    };
  }

  private mockGetNextAppointment(params: any): ElevenLabsToolResponse {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1);
    
    return {
      success: true,
      data: {
        id: 'next_appointment_1',
        subject: 'Interview: John Doe',
        start_time: nextHour.toISOString(),
        end_time: new Date(nextHour.getTime() + 30 * 60000).toISOString(),
        candidate_name: 'John Doe',
        candidate_phone: '555-123-4567',
        candidate_email: 'john@example.com',
        calendar_event_id: 'event_123'
      }
    };
  }

  /**
   * Send confirmation SMS to candidate
   */
  async sendCandidateConfirmation(interview: ScheduledInterview): Promise<void> {
    try {
      const formattedTime = interview.startTime.toLocaleString('en-US', {
        timeZone: this.config.timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const message = `Hi ${interview.candidateName}! Your interview with Autumn Transport has been scheduled for ${formattedTime}. You'll receive a calendar invite shortly. Please call ${interview.recruiterEmail} if you need to reschedule.`;

      // TODO: Integrate with your existing SMS service
      console.log('SMS to candidate:', {
        phone: interview.candidatePhone,
        message: message
      });
    } catch (error) {
      console.error('Error sending candidate confirmation:', error);
    }
  }

  /**
   * Send notification to recruiter
   */
  async sendRecruiterNotification(interview: ScheduledInterview): Promise<void> {
    try {
      const message = `New interview scheduled: ${interview.candidateName} on ${interview.startTime.toLocaleString('en-US', {
        timeZone: this.config.timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}. Phone: ${interview.candidatePhone}`;

      // TODO: Integrate with your existing notification system
      console.log('Recruiter notification:', {
        email: interview.recruiterEmail,
        message: message
      });
    } catch (error) {
      console.error('Error sending recruiter notification:', error);
    }
  }

  /**
   * Auto-book interview for qualified candidate
   */
  async autoBookInterview(candidate: {
    name: string;
    phone: string;
    email?: string;
    schedule?: string;
  }): Promise<ScheduledInterview> {
    try {
      // Book the appointment using your ElevenLabs tool
      const interview = await this.bookAppointment(candidate);

      // Send confirmations
      await this.sendCandidateConfirmation(interview);
      await this.sendRecruiterNotification(interview);

      return interview;
    } catch (error) {
      console.error('Error in auto-booking interview:', error);
      throw error;
    }
  }
}