export interface ConversationData {
  conversationId: string;
  transcript: Array<{
    speaker: string;
    text: string;
    timestamp: number;
  }>;
  duration: number;
  callId: string;
  metadata?: any;
}

export class ElevenLabsService {
  async getConversation(conversationId: string): Promise<ConversationData | null> {
    try {
      console.log(`Fetching conversation ${conversationId} from ElevenLabs...`);
      
      const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || ''
        }
      });

      if (!response.ok) {
        console.warn(`Failed to fetch conversation ${conversationId}: ${response.status}`);
        return null;
      }

      const conversation = await response.json();
      
      if (!conversation) {
        console.warn(`Conversation ${conversationId} not found`);
        return null;
      }

      // Parse transcript from ElevenLabs format
      const transcript = conversation.transcript?.map((entry: any) => ({
        speaker: entry.role === 'agent' ? 'AGENT' : 'CALLER',
        text: entry.message || entry.text || '',
        timestamp: entry.timestamp || 0
      })) || [];

      return {
        conversationId,
        transcript,
        duration: conversation.duration_seconds || 0,
        callId: conversation.conversation_id || conversationId,
        metadata: conversation
      };
    } catch (error) {
      console.error(`Failed to fetch conversation ${conversationId}:`, error);
      return null;
    }
  }

  async analyzeConversation(transcript: Array<{ speaker: string; text: string }>): Promise<{
    cdl: boolean;
    cdlType?: string;
    experience?: string;
    qualified: boolean;
  }> {
    const fullText = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n').toLowerCase();
    
    // Look for CDL mentions
    const hasCDL = /cdl|commercial driver|license/.test(fullText);
    const hasCDLA = /cdl-a|cdl a|class a/.test(fullText);
    
    // Extract experience years
    let experienceYears = 0;
    const experienceMatch = fullText.match(/(\d+)\s*years?\s*(of\s*)?(driving|experience|trucking)/);
    if (experienceMatch) {
      experienceYears = parseInt(experienceMatch[1]);
    }
    
    const cdlType = hasCDLA ? 'CDL-A' : hasCDL ? 'CDL' : undefined;
    const qualified = hasCDLA && experienceYears >= 2;
    
    return {
      cdl: hasCDL,
      cdlType,
      experience: experienceYears > 0 ? experienceYears.toString() : undefined,
      qualified
    };
  }
}

export const elevenLabsService = new ElevenLabsService();