import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCandidateSchema, insertUserSchema, updateUserSchema } from "@shared/schema";
import { emailService } from "./email";
import { elevenLabsService } from "./elevenlabs";
import { z } from "zod";
import crypto from "crypto";
import { 
  requireAuth, 
  optionalAuth, 
  loginHandler, 
  registerHandler, 
  getCurrentUser,
  hashPassword,
  type AuthRequest 
} from "./auth";

// Webhook signature verification - proper ElevenLabs format
function verifyElevenLabsWebhook(body: Buffer, signature: string, secret: string): boolean {
  if (!secret) return true; // Skip verification if no secret configured
  
  try {
    const headers = signature.split(',');
    const timestampHeader = headers.find((e) => e.startsWith('t='));
    const signatureHeader = headers.find((e) => e.startsWith('v0='));
    
    if (!timestampHeader || !signatureHeader) {
      console.log('Missing timestamp or signature in header');
      return false;
    }
    
    const timestamp = timestampHeader.substring(2);
    const signatureHash = signatureHeader;

    // Validate timestamp (30 minute tolerance)
    const reqTimestamp = parseInt(timestamp) * 1000;
    const tolerance = Date.now() - 30 * 60 * 1000;
    if (reqTimestamp < tolerance) {
      console.log('Webhook request expired');
      return false;
    }

    // Validate hash
    const message = `${timestamp}.${body}`;
    const digest = 'v0=' + crypto.createHmac('sha256', secret).update(message).digest('hex');
    
    return signatureHash === digest;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

// Extract candidate information from transcript
function extractCandidateFromTranscript(transcript: Array<{ role: string; message: string }>): {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  cdl?: boolean;
  experience?: string;
  violations?: boolean;
  work_auth?: boolean;
} {
  const fullText = transcript.map(t => `${t.role}: ${t.message}`).join('\n');
  
  console.log('=== TRANSCRIPT EXCERPT FOR DEBUGGING ===');
  console.log(fullText.substring(0, 1000) + '...');
  console.log('=== END TRANSCRIPT EXCERPT ===');
  
  let firstName = '';
  let lastName = '';
  let phoneNumber = '';
  let hasCDL = false;
  let hasExperience = false;
  let hasViolations = false;
  let hasWorkAuth = false;
  
  // More flexible name extraction patterns
  // Look for name patterns after agent asks for name
  const namePatterns = [
    /(?:first\s+name|what.*name|your\s+name)[^?]*\?\s*(?:user|caller):\s*([A-Za-z]+)/i,
    /(?:name\s+is|call\s+me|i'm|my\s+name)\s+([A-Za-z]+)/i,
    /(?:hello|hi).*?(?:i'm|my\s+name\s+is)\s+([A-Za-z]+)/i
  ];
  
  for (const pattern of namePatterns) {
    const match = fullText.match(pattern);
    if (match && !firstName) {
      firstName = match[1].trim();
      break;
    }
  }
  
  // Look for last name patterns
  const lastNamePatterns = [
    /(?:last\s+name|surname)[^?]*\?\s*(?:user|caller):\s*([A-Za-z]+)/i,
    new RegExp(`${firstName}\\s+([A-Za-z]+)`, 'i') // First name followed by last name
  ];
  
  for (const pattern of lastNamePatterns) {
    const match = fullText.match(pattern);
    if (match) {
      lastName = match[1].trim();
      break;
    }
  }
  
  // More flexible phone number extraction
  const phonePatterns = [
    /(?:phone|number|contact)[^?]*\?\s*(?:user|caller):\s*([\d\-\(\)\s]+)/i,
    /(?:call.*back|reach.*at|my\s+number)\s*([\d\-\(\)\s]{10,})/i,
    /((?:\d{3}[-.]?\d{3}[-.]?\d{4})|(?:\(\d{3}\)\s*\d{3}[-.]?\d{4}))/g // Direct phone patterns
  ];
  
  for (const pattern of phonePatterns) {
    const match = fullText.match(pattern);
    if (match) {
      let phone = match[1].replace(/[^\d]/g, ''); // Extract digits only
      if (phone.length === 10) {
        phoneNumber = `${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)}`;
        break;
      }
    }
  }
  
  // Enhanced CDL detection
  hasCDL = /(?:yes.*class\s*a|class\s*a.*yes|cdl.*yes|commercial.*license.*yes|valid.*cdl)/i.test(fullText);
  
  // Enhanced experience detection  
  hasExperience = /(?:yes.*(?:two|2|twenty-four|24).*(?:year|month)|(?:year|month).*yes|experience.*yes)/i.test(fullText);
  
  // Enhanced violations detection (looking for "No" responses)
  hasViolations = /(?:violation.*no|no.*violation|clean.*record|no.*ticket)/i.test(fullText);
  
  // Enhanced work authorization detection
  hasWorkAuth = /(?:yes.*(?:eligible|authorized|legal)|(?:eligible|authorized|legal).*yes|work.*yes)/i.test(fullText);
  
  const result = {
    first_name: firstName || undefined,
    last_name: lastName || undefined, 
    phone_number: phoneNumber || undefined,
    cdl: hasCDL,
    experience: hasExperience ? '24+ months' : undefined,
    violations: !hasViolations, // Invert since we're checking for clean record
    work_auth: hasWorkAuth
  };
  
  console.log('=== EXTRACTION RESULTS ===');
  console.log('Extracted:', result);
  console.log('=== END EXTRACTION ===');
  
  return result;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/register', registerHandler);
  app.get('/api/auth/me', requireAuth, getCurrentUser);
  
  // Target agent ID for filtering inbound calls
  const TARGET_AGENT_ID = process.env.TARGET_AGENT_ID || 'agent_01k076swcgekzt88m03gegfgsr';
  
  // Webhook endpoint to receive call data from ElevenLabs
  app.post('/api/inbound', async (req, res) => {
    try {
      // Parse the raw body to JSON
      const body = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
      let webhookData;
      
      try {
        webhookData = JSON.parse(body.toString());
      } catch (error) {
        console.error('Failed to parse webhook body:', error);
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
      
      // Verify webhook signature if secret is configured
      const signature = req.headers['elevenlabs-signature'] as string;
      const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
      
      console.log('=== WEBHOOK SIGNATURE DEBUG ===');
      console.log('Has signature header:', !!signature);
      console.log('Has webhook secret:', !!webhookSecret);
      console.log('Signature header:', signature ? signature.substring(0, 50) + '...' : 'none');
      
      if (webhookSecret && signature) {
        const isValid = verifyElevenLabsWebhook(body, signature, webhookSecret);
        
        if (!isValid) {
          console.error('Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
        console.log('Webhook signature verified successfully');
      } else {
        console.log('Skipping signature verification - no secret configured');
      }
      
      console.log('Received ElevenLabs webhook:', JSON.stringify(webhookData, null, 2));
      
      // Extract data from the actual ElevenLabs webhook format
      const { data } = webhookData;
      
      if (!data) {
        console.error('No data object in webhook payload');
        return res.status(400).json({ error: 'Invalid webhook format - missing data object' });
      }
      
      const { conversation_id, agent_id } = data;
      
      // STEP 1: Filter by Agent ID
      if (agent_id !== TARGET_AGENT_ID) {
        console.log(`Ignoring webhook - different agent: ${agent_id} (expected: ${TARGET_AGENT_ID})`);
        return res.status(200).json({ 
          status: 'ignored', 
          reason: `Different agent: ${agent_id}`,
          expected: TARGET_AGENT_ID
        });
      }
      
      console.log(`Processing webhook for target agent: ${agent_id}`);
      console.log(`Conversation ID: ${conversation_id}`);
      
      // STEP 2: Trigger API call to get full conversation details
      console.log('Fetching full conversation details from ElevenLabs API...');
      const fullConversationData = await elevenLabsService.getConversationDetails(conversation_id);
      
      // STEP 3: Store in both call records and candidates tables
      const callRecord = await storage.storeCallRecord({
        conversationId: conversation_id,
        agentId: agent_id,
        status: fullConversationData.status || 'completed',
        rawData: fullConversationData
      });
      
      // Also create candidate record for UI
      const candidate = await storage.storeCandidateFromCall(conversation_id, agent_id, fullConversationData);
      
      console.log('=== CALL RECORD STORED ===');
      console.log('Call Record ID:', callRecord.id);
      console.log('Extracted Data:', JSON.stringify(callRecord.extractedData, null, 2));
      console.log('=== END STORAGE ===');
      
      // Send email notification for qualified candidates
      const extractedData = callRecord.extractedData as any;
      if (extractedData?.qualified === true) {
        try {
          // Create a legacy candidate record for email notification
          const legacyCandidate = {
            firstName: extractedData.firstName,
            lastName: extractedData.lastName,
            phone: extractedData.phoneNumber,
            qualified: extractedData.qualified
          };
          await emailService.sendRecruiterNotification(legacyCandidate);
          console.log('Recruiter notification sent successfully');
        } catch (error) {
          console.error('Failed to send recruiter notification:', error);
          // Don't fail the whole request if email fails
        }
      }
      
      res.status(200).json({ 
        status: 'processed', 
        callRecord: {
          id: callRecord.id,
          conversationId: callRecord.conversationId,
          agentId: callRecord.agentId,
          extractedData: callRecord.extractedData
        }
      });
    } catch (error) {
      console.error('Error processing inbound call:', error);
      res.status(500).json({ error: 'Failed to process call data' });
    }
  });

  // Get candidates with optional search and filter (legacy) - Protected
  app.get('/api/candidates', requireAuth, async (req, res) => {
    try {
      const { search, status } = req.query;
      const candidates = await storage.getCandidates(
        search as string, 
        status as string
      );
      res.json(candidates);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      res.status(500).json({ error: 'Failed to fetch candidates' });
    }
  });

  // Get call records (new JSONB-based storage) - Protected  
  app.get('/api/call-records', requireAuth, async (req, res) => {
    try {
      const { agent_id, limit, search } = req.query;
      const agentId = agent_id as string || TARGET_AGENT_ID;
      const limitNum = limit ? parseInt(limit as string) : 50;
      const searchTerm = search as string;
      
      const callRecords = await storage.getCallRecords(agentId, limitNum, searchTerm);
      res.json(callRecords);
    } catch (error) {
      console.error('Error fetching call records:', error);
      res.status(500).json({ error: 'Failed to fetch call records' });
    }
  });

  // Get specific call record details
  app.get('/api/call-records/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const callRecord = await storage.getCallRecordByConversationId(conversationId);
      
      if (!callRecord) {
        return res.status(404).json({ error: 'Call record not found' });
      }
      
      res.json(callRecord);
    } catch (error) {
      console.error('Error fetching call record:', error);
      res.status(500).json({ error: 'Failed to fetch call record' });
    }
  });

  // Update candidate qualification status
  app.post('/api/candidates/:id/qualify', async (req, res) => {
    try {
      const { id } = req.params;
      const { qualified } = req.body;
      
      const candidate = await storage.updateCandidateQualification(
        parseInt(id), 
        qualified
      );
      
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      
      // Send email notification if candidate was manually qualified
      if (qualified === true) {
        try {
          await emailService.sendRecruiterNotification(candidate);
        } catch (error) {
          console.error('Failed to send recruiter notification:', error);
          // Don't fail the whole request if email fails
        }
      }
      
      res.json({ success: true, candidate });
    } catch (error) {
      console.error('Error updating candidate:', error);
      res.status(500).json({ error: 'Failed to update candidate' });
    }
  });

  // Get dashboard stats - Protected
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const stats = await storage.getCandidateStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // ElevenLabs agents endpoint
  app.get('/api/elevenlabs/agents', async (req, res) => {
    try {
      const agents = await elevenLabsService.getAgents();
      res.json(agents);
    } catch (error) {
      console.error('Error fetching ElevenLabs agents:', error);
      res.status(500).json({ error: 'Failed to fetch agents' });
    }
  });

  // ElevenLabs recent conversations endpoint
  app.get('/api/elevenlabs/conversations', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const conversations = await elevenLabsService.getRecentConversations(limit);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching ElevenLabs conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // ElevenLabs conversation details endpoint
  app.get('/api/elevenlabs/conversations/:id', async (req, res) => {
    try {
      const conversationId = req.params.id;
      const conversation = await elevenLabsService.getConversationDetails(conversationId);
      
      // FORCED LOG - EXACT API RESPONSE FOR USER
      console.log('\n=== EXACT API RESPONSE FOR USER ===');
      console.log('transcript[0]:', JSON.stringify(conversation.transcript?.[0], null, 2));
      console.log('data_collection:', JSON.stringify(conversation.data_collection, null, 2));
      console.log('Full response keys:', Object.keys(conversation));
      console.log('=== END EXACT RESPONSE ===\n');
      
      res.json(conversation);
    } catch (error) {
      console.error('Error fetching ElevenLabs conversation details:', error);
      res.status(500).json({ error: 'Failed to fetch conversation details' });
    }
  });

  // Store conversation data endpoint (using current schema)
  app.post('/api/elevenlabs/conversations/:id/store', async (req, res) => {
    try {
      const conversationId = req.params.id;
      const conversation = await elevenLabsService.getConversationDetails(conversationId);
      
      console.log(`Storing conversation data for ${conversationId}...`);
      
      // Extract data from ElevenLabs format
      const dataCollection = conversation.data_collection || {};
      const dynamicVars = conversation.conversation_initiation_client_data?.dynamic_variables || {};
      
      // Store using current candidate schema
      const candidateData = {
        conversationId: conversationId,
        callId: dynamicVars.system__call_sid || conversationId,
        phone: dataCollection.Phone_number?.value || 'Unknown',
        transcript: JSON.stringify(conversation.transcript || []),
        answers: dataCollection,
        qualified: null,
        experience: dataCollection.Question_two?.value ? 'Yes - 18+ months' : 'Unknown',
        cdlType: dataCollection.question_one?.value ? 'CDL-A' : 'None',
      };
      
      console.log('Extracted candidate data:', {
        name: `${dataCollection.First_Name?.value} ${dataCollection.Last_Name?.value}`,
        phone: dataCollection.Phone_number?.value,
        cdl: dataCollection.question_one?.value,
        experience: dataCollection.Question_two?.value,
        violations: dataCollection.Question_three?.value,
        workAuth: dataCollection.question_four?.value,
        schedule: dataCollection.schedule?.value
      });
      
      res.json({ 
        success: true, 
        message: 'Data extracted successfully (database schema update needed for full storage)',
        extractedData: candidateData 
      });
    } catch (error) {
      console.error('Error processing conversation data:', error);
      res.status(500).json({ error: 'Failed to process conversation data' });
    }
  });



  // User management routes - Protected
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', requireAuth, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      // Hash password before storing
      const hashedPassword = await hashPassword(userData.password);
      const userWithHashedPassword = { ...userData, password: hashedPassword };
      const user = await storage.createUser(userWithHashedPassword);
      
      // Return user without password
      const { password, ...userResponse } = user;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(400).json({ error: 'Failed to create user' });
    }
  });

  app.patch('/api/users/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = updateUserSchema.parse(req.body);
      
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const user = await storage.updateUser(parseInt(id), updateData);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Return user without password
      const { password, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(400).json({ error: 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteUser(parseInt(id));
      
      if (!success) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteUser(parseInt(id));
      
      if (!deleted) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
