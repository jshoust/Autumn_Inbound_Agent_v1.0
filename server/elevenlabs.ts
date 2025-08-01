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
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`https://api.elevenlabs.io/v1${endpoint}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'xi-api-key': 'sk_a8bce414645f45ebfe8da832e0efdfb511e468e9cd64b150',
        ...options.headers,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async getAgents(): Promise<any[]> {
    try {
      console.log('Fetching agents from ElevenLabs...');
      const data = await this.makeRequest('/convai/agents');
      console.log(`Found ${data.agents?.length || 0} agents`);
      return data.agents || [];
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      throw error;
    }
  }

  async getAgentDetails(agentId: string): Promise<any> {
    try {
      console.log(`Fetching agent details for ${agentId}...`);
      const data = await this.makeRequest(`/convai/agents/${agentId}`);
      console.log(`Retrieved agent details: ${data.name}`);
      
      // Extract phone number from phone_numbers array
      const phoneNumber = data.phone_numbers?.[0]?.phone_number || null;
      console.log(`Phone number: ${phoneNumber}`);
      
      return {
        ...data,
        phone_number: phoneNumber // Add phone_number to top level for easy access
      };
    } catch (error) {
      console.error('Failed to fetch agent details:', error);
      throw error;
    }
  }

  async getRecentConversations(limit: number = 10): Promise<any[]> {
    try {
      console.log(`Fetching recent ${limit} conversations from ElevenLabs...`);
      const data = await this.makeRequest(`/convai/conversations?limit=${limit}`);
      console.log(`Found ${data.conversations?.length || 0} recent conversations`);
      return data.conversations || [];
    } catch (error) {
      console.error('Failed to fetch recent conversations:', error);
      throw error;
    }
  }

  async getConversationDetails(conversationId: string): Promise<any> {
    try {
      console.log(`Fetching conversation details for ${conversationId}...`);
      const data = await this.makeRequest(`/convai/conversations/${conversationId}`);
      console.log(`Retrieved conversation details with ${data.transcript?.length || 0} transcript entries`);
      
      // Log the exact API response structure
      console.log('=== API RESPONSE STRUCTURE ===');
      console.log(JSON.stringify({
        transcript_sample: data.transcript?.[0],
        data_collection: data.data_collection,
        call_successful: data.call_successful,
        conversation_id: data.conversation_id,
        agent_id: data.agent_id
      }, null, 2));
      console.log('=== END API RESPONSE ===');

      return data;
    } catch (error) {
      console.error('Failed to fetch conversation details:', error);
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<ConversationData | null> {
    try {
      console.log(`Fetching conversation ${conversationId} from ElevenLabs...`);
      
      const conversation = await this.makeRequest(`/convai/conversations/${conversationId}`);
      
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