import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCandidateSchema, insertUserSchema, updateUserSchema } from "@shared/schema";
import { emailService } from "./email";
import { elevenLabsService } from "./elevenlabs";
import { z } from "zod";
import crypto from "crypto";

// Webhook signature verification
function verifyElevenLabsWebhook(payload: string, signature: string, secret: string): boolean {
  if (!secret) return true; // Skip verification if no secret configured
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return `sha256=${expectedSignature}` === signature;
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
  // Webhook endpoint to receive call data from ElevenLabs
  app.post('/api/inbound', async (req, res) => {
    try {
      // Verify webhook signature if secret is configured
      const signature = req.headers['x-elevenlabs-signature'] as string;
      const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
      
      if (webhookSecret && signature) {
        const payload = JSON.stringify(req.body);
        const isValid = verifyElevenLabsWebhook(payload, signature, webhookSecret);
        
        if (!isValid) {
          console.error('Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
        console.log('Webhook signature verified successfully');
      }
      
      console.log('Received ElevenLabs webhook:', JSON.stringify(req.body, null, 2));
      
      // Extract conversation ID and basic data from webhook
      const { 
        call_id, 
        conversation_id, 
        transcript, 
        phone, 
        answers,
        caller_number,
        agent_id 
      } = req.body;
      
      let conversationData = null;
      let processedTransript = transcript;
      let processedAnswers = answers;
      
      // If we have a conversation_id, fetch full conversation details
      if (conversation_id && process.env.ELEVENLABS_API_KEY) {
        try {
          conversationData = await elevenLabsService.getConversation(conversation_id);
          if (conversationData && conversationData.transcript) {
            console.log(`Retrieved full conversation with ${conversationData.transcript.length} messages`);
            
            // Build transcript text from ElevenLabs format
            processedTransript = conversationData.transcript
              .map(t => `${t.speaker.toUpperCase()}: ${t.text}`)
              .join('\n');
            
            // Extract candidate data from transcript using the ElevenLabs conversation format
            const candidateInfo = extractCandidateFromTranscript(
              conversationData.transcript.map(t => ({ role: t.speaker, message: t.text }))
            );
            console.log('Extracted candidate info:', candidateInfo);
            
            // Analyze conversation for qualification data
            const analysis = await elevenLabsService.analyzeConversation(conversationData.transcript);
            processedAnswers = {
              ...answers,
              ...candidateInfo,
              cdl: analysis.cdl,
              cdl_type: analysis.cdlType,
              experience: analysis.experience,
              qualified: analysis.qualified
            };
            
            console.log('Conversation analysis:', analysis);
          }
        } catch (error) {
          console.error('Failed to fetch conversation details:', error);
          // Continue with webhook data if API fetch fails
        }
      }
      
      // Extract phone from data collection if available
      const extractedPhone = processedAnswers?.phone_number || processedAnswers?.Phone_number;
      const finalPhone = extractedPhone || phone || caller_number || 'unknown';
      const finalCallId = call_id || conversation_id || `conv-${Date.now()}`;

      console.log('DEBUGGING CANDIDATE DATA:');
      console.log('finalCallId:', finalCallId);
      console.log('finalPhone:', finalPhone);
      console.log('processedAnswers:', processedAnswers);

      // Basic qualification scoring logic using processed answers
      let qualified = null;
      if (processedAnswers) {
        const hasValidCDL = processedAnswers.cdl === true || processedAnswers.cdl_type === 'CDL-A';
        const hasExperience = processedAnswers.experience && parseInt(processedAnswers.experience) >= 2;
        qualified = hasValidCDL && hasExperience;
      }

      // Ensure required fields are not null
      if (!finalPhone) {
        console.error('Missing required phone number');
        return res.status(400).json({ error: 'Phone number is required' });
      }

      if (!finalCallId) {
        console.error('Missing required conversation ID');
        return res.status(400).json({ error: 'Conversation ID is required' });
      }

      const candidateData = {
        conversationId: finalCallId,  // This maps to conversation_id in DB 
        callId: finalCallId,          // This maps to call_id in DB
        phone: finalPhone,
        transcript: processedTransript || null,
        dataCollection: processedAnswers || null,
        qualified: qualified || false,
        rawConversationData: req.body || null
      };

      console.log('Final candidateData:', JSON.stringify(candidateData, null, 2));

      const candidate = await storage.createCandidate(candidateData);
      
      // Send recruiter notification for qualified candidates
      if (qualified === true) {
        try {
          await emailService.sendRecruiterNotification(candidate);
        } catch (error) {
          console.error('Failed to send recruiter notification:', error);
          // Don't fail the whole request if email fails
        }
      }
      
      res.status(200).json({ status: 'ok', candidate });
    } catch (error) {
      console.error('Error processing inbound call:', error);
      res.status(500).json({ error: 'Failed to process call data' });
    }
  });

  // Get candidates with optional search and filter
  app.get('/api/candidates', async (req, res) => {
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

  // Get dashboard stats
  app.get('/api/stats', async (req, res) => {
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



  // User management routes
  app.get('/api/users', async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(400).json({ error: 'Failed to create user' });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = updateUserSchema.parse(req.body);
      const user = await storage.updateUser(parseInt(id), updateData);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(400).json({ error: 'Failed to update user' });
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
