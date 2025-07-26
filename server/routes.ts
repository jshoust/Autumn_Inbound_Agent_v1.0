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
import { postmarkService } from "./postmark";
import { reportGenerator } from "./report-generator";
import { reportScheduler } from "./scheduler";
import { insertReportsConfigSchema, updateReportsConfigSchema } from "@shared/schema";

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

      // STEP 4: Send automatic email notification for every completed call
      if (process.env.FROM_EMAIL) {
        console.log('=== SENDING AUTOMATIC EMAIL NOTIFICATION ===');
        try {
          const emailResult = await postmarkService.sendCallCompletionNotification(
            process.env.FROM_EMAIL,
            callRecord
          );
          
          if (emailResult.success) {
            console.log(`✅ Automatic email sent successfully - MessageID: ${emailResult.messageId}`);
          } else {
            console.error(`❌ Failed to send automatic email: ${emailResult.error}`);
          }
        } catch (emailError) {
          console.error('❌ Email notification error:', emailError);
        }
        console.log('=== EMAIL NOTIFICATION COMPLETE ===');
      } else {
        console.log('⚠️ Skipping email notification - FROM_EMAIL not configured');
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

  // Get candidates with optional search and filter (migrated to call_records)
  app.get('/api/candidates', requireAuth, async (req, res) => {
    try {
      const { search, status, agentId, qualified, limit = 50 } = req.query;
      const callRecords = await storage.getCallRecords(
        agentId as string,
        parseInt(limit as string) || 50,
        search as string
      );
      
      // Transform call records to match expected candidate format
      const candidates = callRecords.map(record => ({
        id: record.id,
        conversationId: record.conversationId,
        firstName: record.firstName,
        lastName: record.lastName,
        phone: record.phone,
        qualified: record.qualified,
        agentId: record.agentId,
        createdAt: record.createdAt,
        // Extract additional data from JSONB fields
        transcript: record.rawData?.transcript || [],
        dataCollection: record.extractedData || {},
        rawConversationData: record.rawData || {}
      }));
      
      // Apply qualified filter if specified
      const filteredCandidates = qualified !== undefined 
        ? candidates.filter(c => c.qualified === (qualified === 'true'))
        : candidates;
        
      res.json(filteredCandidates);
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

  // Update candidate qualification status (migrated to call_records)
  app.post('/api/candidates/:id/qualify', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { qualified } = req.body;
      
      // Update call record qualification status
      const callRecord = await storage.updateCallRecordQualification(
        parseInt(id), 
        qualified
      );
      
      if (!callRecord) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      
      // Send email notification if candidate was manually qualified
      if (qualified === true) {
        try {
          // Transform call record to candidate format for email
          const candidateForEmail = {
            firstName: callRecord.firstName,
            lastName: callRecord.lastName,
            phone: callRecord.phone,
            qualified: callRecord.qualified
          };
          await emailService.sendRecruiterNotification(candidateForEmail);
        } catch (error) {
          console.error('Failed to send recruiter notification:', error);
          // Don't fail the whole request if email fails
        }
      }
      
      res.json({ success: true, candidate: callRecord });
    } catch (error) {
      console.error('Error updating candidate:', error);
      res.status(500).json({ error: 'Failed to update candidate' });
    }
  });

  // Get dashboard stats - Protected (migrated to call_records)
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const stats = await storage.getCallRecordStats();
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

  // Get specific agent details endpoint
  app.get('/api/elevenlabs/agents/:agentId', requireAuth, async (req, res) => {
    try {
      const { agentId } = req.params;
      const agentDetails = await elevenLabsService.getAgentDetails(agentId);
      res.json(agentDetails);
    } catch (error) {
      console.error('Error fetching agent details:', error);
      res.status(500).json({ error: 'Failed to fetch agent details' });
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

  app.post('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

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

  app.patch('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

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

  app.delete('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

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

  // === POSTMARK EMAIL REPORTS API ENDPOINTS ===

  // Get all report configurations (Admin only)
  app.get('/api/reports/configs', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const configs = await storage.getReportConfigs();
      res.json(configs);
    } catch (error) {
      console.error('Error fetching report configs:', error);
      res.status(500).json({ error: 'Failed to fetch report configurations' });
    }
  });

  // Create new report configuration (Admin only)
  app.post('/api/reports/configs', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        console.log('Non-admin user attempting to create report config:', req.user);
        return res.status(403).json({ error: 'Admin access required' });
      }

      console.log('Creating report config with data:', req.body);
      const configData = insertReportsConfigSchema.parse(req.body);
      console.log('Parsed config data:', configData);
      const config = await storage.createReportConfig(configData);
      console.log('Created report config:', config);
      res.status(201).json(config);
    } catch (error) {
      console.error('Error creating report config:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
        res.status(400).json({ error: 'Validation failed', validation: error.errors });
      } else {
        res.status(400).json({ error: 'Failed to create report configuration' });
      }
    }
  });

  // Update report configuration (Admin only)
  app.patch('/api/reports/configs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        console.log('Non-admin user attempting to update report config:', req.user);
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      console.log('Updating report config ID:', id, 'with data:', req.body);
      const updateData = updateReportsConfigSchema.parse(req.body);
      console.log('Parsed update data:', updateData);
      const config = await storage.updateReportConfig(parseInt(id), updateData);

      if (!config) {
        console.log('Report config not found for ID:', id);
        return res.status(404).json({ error: 'Report configuration not found' });
      }

      console.log('Updated report config:', config);
      res.json(config);
    } catch (error) {
      console.error('Error updating report config:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
        res.status(400).json({ error: 'Validation failed', validation: error.errors });
      } else {
        res.status(400).json({ error: 'Failed to update report configuration' });
      }
    }
  });

  // Delete report configuration (Admin only)
  app.delete('/api/reports/configs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const success = await storage.deleteReportConfig(parseInt(id));

      if (!success) {
        return res.status(404).json({ error: 'Report configuration not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting report config:', error);
      res.status(500).json({ error: 'Failed to delete report configuration' });
    }
  });

  // Send test report (Admin only)
  app.post('/api/reports/test', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { recipientEmail, reportConfigId } = req.body;

      if (!recipientEmail) {
        return res.status(400).json({ error: 'Recipient email is required' });
      }

      const result = await reportGenerator.sendTestReport(recipientEmail, reportConfigId);

      if (result.success) {
        res.json({ success: true, message: 'Test report sent successfully' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Error sending test report:', error);
      res.status(500).json({ error: 'Failed to send test report' });
    }
  });

  // Test Postmark connection (Admin only)
  app.get('/api/reports/test-connection', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await postmarkService.testConnection();

      if (result.success) {
        res.json({ success: true, message: 'Postmark connection successful' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Error testing Postmark connection:', error);
      res.status(500).json({ error: 'Failed to test Postmark connection' });
    }
  });

  // Get email logs (Admin only)
  app.get('/api/reports/logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { limit, reportConfigId } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 100;

      let logs;
      if (reportConfigId) {
        logs = await storage.getEmailLogsByReportConfig(parseInt(reportConfigId as string));
      } else {
        logs = await storage.getEmailLogs(limitNum);
      }

      res.json(logs);
    } catch (error) {
      console.error('Error fetching email logs:', error);
      res.status(500).json({ error: 'Failed to fetch email logs' });
    }
  });

  // Send manual report now (Admin only)
  app.post('/api/reports/send/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const reportConfig = await storage.getReportConfig(parseInt(id));

      if (!reportConfig) {
        return res.status(404).json({ error: 'Report configuration not found' });
      }

      const result = await reportGenerator.sendScheduledReport(reportConfig);

      res.json({
        success: true,
        message: `Report sent to ${result.sent} recipients`,
        details: {
          sent: result.sent,
          failed: result.failed,
          errors: result.errors
        }
      });
    } catch (error) {
      console.error('Error sending manual report:', error);
      res.status(500).json({ error: 'Failed to send report' });
    }
  });

  // Update user email preferences (Users can update their own preferences)
  app.patch('/api/users/:id/email-preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      // Users can only update their own preferences, or admins can update anyone's
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Can only update your own email preferences' });
      }

      const { emailNotifications, reportFrequency } = req.body;

      const updateData: { emailNotifications?: boolean; reportFrequency?: string } = {};
      if (typeof emailNotifications === 'boolean') {
        updateData.emailNotifications = emailNotifications;
      }
      if (reportFrequency && ['daily', 'weekly', 'monthly', 'disabled'].includes(reportFrequency)) {
        updateData.reportFrequency = reportFrequency;
      }

      const user = await storage.updateUser(userId, updateData);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return user without password
      const { password, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error('Error updating email preferences:', error);
      res.status(400).json({ error: 'Failed to update email preferences' });
         }
   });

  // === SCHEDULER CONTROL ENDPOINTS ===

  // Get scheduler status (Admin only)
  app.get('/api/reports/scheduler/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const status = reportScheduler.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      res.status(500).json({ error: 'Failed to get scheduler status' });
    }
  });

  // Start scheduler (Admin only)
  app.post('/api/reports/scheduler/start', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      reportScheduler.start();
      res.json({ success: true, message: 'Scheduler started' });
    } catch (error) {
      console.error('Error starting scheduler:', error);
      res.status(500).json({ error: 'Failed to start scheduler' });
    }
  });

  // Stop scheduler (Admin only)
  app.post('/api/reports/scheduler/stop', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      reportScheduler.stop();
      res.json({ success: true, message: 'Scheduler stopped' });
    } catch (error) {
      console.error('Error stopping scheduler:', error);
      res.status(500).json({ error: 'Failed to stop scheduler' });
    }
  });

  // Refresh scheduler (reload configs from database) (Admin only)
  app.post('/api/reports/scheduler/refresh', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      await reportScheduler.refreshSchedule();
      res.json({ success: true, message: 'Scheduler refreshed' });
    } catch (error) {
      console.error('Error refreshing scheduler:', error);
      res.status(500).json({ error: 'Failed to refresh scheduler' });
    }
  });

  // Force process all scheduled reports now (Admin only)
  app.post('/api/reports/scheduler/force-run', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      await reportScheduler.forceProcessReports();
      res.json({ success: true, message: 'All scheduled reports processed' });
    } catch (error) {
      console.error('Error force running reports:', error);
      res.status(500).json({ error: 'Failed to force run reports' });
    }
  });

  // Test email endpoint
  app.post('/api/test-email', requireAuth, async (req, res) => {
    try {
      const { to, subject, message } = req.body;
      
      if (!to || !subject || !message) {
        return res.status(400).json({ error: 'Missing required fields: to, subject, message' });
      }

      const result = await postmarkService.sendTestEmail(to, subject, message);
      
      if (result.success) {
        res.json({ 
          success: true, 
          messageId: result.messageId,
          message: 'Test email sent successfully'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error || 'Failed to send email'
        });
      }
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({ error: 'Failed to send test email' });
    }
  });

  // Test automatic call completion notification
  app.post('/api/test-call-completion', requireAuth, async (req, res) => {
    try {
      const { to } = req.body;
      
      if (!to) {
        return res.status(400).json({ error: 'Missing required field: to (email address)' });
      }

      // Get the latest call record for testing
      const callRecords = await storage.getCallRecords(undefined, 1);
      if (callRecords.length === 0) {
        return res.status(404).json({ error: 'No call records found for testing' });
      }

      const callRecord = callRecords[0];
      
      const result = await postmarkService.sendCallCompletionNotification(to, callRecord);
      
      if (result.success) {
        res.json({ 
          success: true, 
          messageId: result.messageId,
          message: `Call completion notification sent successfully`,
          candidateName: `${callRecord.firstName || 'Unknown'} ${callRecord.lastName || ''}`.trim(),
          note: "Automatic notification sent with call details and Excel attachment."
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error || 'Failed to send notification'
        });
      }
    } catch (error) {
      console.error('Test call completion notification error:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });

  // Test candidate notification endpoint - simplified approach with working email
  app.post('/api/test-candidate-notification', requireAuth, async (req, res) => {
    try {
      const { to, approved } = req.body;
      
      if (!to) {
        return res.status(400).json({ error: 'Missing required field: to' });
      }

      // Get the latest call record for testing
      const callRecords = await storage.getCallRecords(undefined, 1);
      if (callRecords.length === 0) {
        return res.status(404).json({ error: 'No call records found for testing' });
      }

      const callRecord = callRecords[0];
      const isApproved = approved === true; // Only approve if explicitly true
      const status = isApproved ? 'APPROVED' : 'DENIED';
      const candidateName = `${callRecord.firstName || 'Unknown'} ${callRecord.lastName || ''}`.trim();
      const subject = isApproved ? `New Candidate Application Approved - ${candidateName}` : `New Candidate Application Denied - ${candidateName}`;

      // Create detailed message with call information for the working test email
      const detailedMessage = `
        <h3>Candidate Application ${status}</h3>
        
        <h4>Candidate Information:</h4>
        <table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
          <tr><td><strong>Name:</strong></td><td>${candidateName}</td></tr>
          <tr><td><strong>Phone:</strong></td><td>${callRecord.phone || 'Not provided'}</td></tr>
          <tr><td><strong>Application Date:</strong></td><td>${new Date(callRecord.createdAt).toLocaleDateString()}</td></tr>
        </table>

        <h4>Qualification Details:</h4>
        <table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
          <tr><td><strong>CDL Class A:</strong></td><td>${(callRecord.extractedData as any)?.cdlA ? 'Yes' : 'No'}</td></tr>
          <tr><td><strong>24+ Months Experience:</strong></td><td>${(callRecord.extractedData as any)?.experience24Months ? 'Yes' : 'No'}</td></tr>
          <tr><td><strong>Work Eligible:</strong></td><td>${(callRecord.extractedData as any)?.workEligible ? 'Yes' : 'No'}</td></tr>
          <tr><td><strong>Has Violations:</strong></td><td>${(callRecord.extractedData as any)?.hasViolations ? 'Yes' : 'No'}</td></tr>
          <tr><td><strong>Call Duration:</strong></td><td>${(callRecord.extractedData as any)?.callDuration || 'Unknown'} seconds</td></tr>
          <tr><td><strong>Call Successful:</strong></td><td>${(callRecord.extractedData as any)?.callSuccessful ? 'Yes' : 'No'}</td></tr>
        </table>

        <p><strong>Note:</strong> This email contains all the call details. An Excel file with this information has been generated and is available for download through the dashboard.</p>
      `;

      // Use the working test email function instead
      const result = await postmarkService.sendTestEmail(to, subject, detailedMessage);
      
      if (result.success) {
        res.json({ 
          success: true, 
          messageId: result.messageId,
          message: `Candidate notification (${status}) sent successfully with call details`,
          candidateName: candidateName,
          note: 'Email sent with embedded call details. Excel generation is available through the dashboard.'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error || 'Failed to send candidate notification'
        });
      }
    } catch (error) {
      console.error('Test candidate notification error:', error);
      res.status(500).json({ error: 'Failed to send test candidate notification' });
    }
  });

  // Generate and download Excel report endpoint
  app.get('/api/excel-report/:conversationId', requireAuth, async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      // Find the call record
      const callRecords = await storage.getCallRecords(undefined, 100);
      const callRecord = callRecords.find(record => record.conversationId === conversationId);
      
      if (!callRecord) {
        return res.status(404).json({ error: 'Call record not found' });
      }

      // Generate Excel file using the same function
      const postmark = new PostmarkService();
      const excelBase64 = postmark.generateExcelAttachment(callRecord);
      const excelBuffer = Buffer.from(excelBase64, 'base64');
      
      // Set headers for file download
      const fileName = `candidate_${conversationId}_${callRecord.qualified ? 'approved' : 'denied'}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      
      res.send(excelBuffer);
    } catch (error) {
      console.error('Excel report generation error:', error);
      res.status(500).json({ error: 'Failed to generate Excel report' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
