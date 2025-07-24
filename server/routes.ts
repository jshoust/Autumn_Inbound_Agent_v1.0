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
          if (conversationData) {
            console.log(`Retrieved full conversation with ${conversationData.transcript.length} messages`);
            
            // Use the fetched transcript and analyze it
            processedTransript = conversationData.transcript
              .map(t => `${t.speaker}: ${t.text}`)
              .join('\n');
              
            // Analyze conversation for qualification data
            const analysis = await elevenLabsService.analyzeConversation(conversationData.transcript);
            processedAnswers = {
              ...answers,
              cdl: analysis.cdl,
              cdl_type: analysis.cdlType,
              experience: analysis.experience
            };
            
            console.log('Conversation analysis:', analysis);
          }
        } catch (error) {
          console.error('Failed to fetch conversation details:', error);
          // Continue with webhook data if API fetch fails
        }
      }
      
      const finalPhone = phone || caller_number || 'unknown';
      const finalCallId = call_id || conversation_id || `conv-${Date.now()}`;

      // Basic qualification scoring logic using processed answers
      let qualified = null;
      if (processedAnswers) {
        const hasValidCDL = processedAnswers.cdl === true || processedAnswers.cdl_type === 'CDL-A';
        const hasExperience = processedAnswers.experience && parseInt(processedAnswers.experience) >= 2;
        qualified = hasValidCDL && hasExperience;
      }

      // Extract experience and CDL type from processed answers
      const experience = processedAnswers?.experience ? `${processedAnswers.experience} years` : undefined;
      const cdlType = processedAnswers?.cdl_type || (processedAnswers?.cdl ? 'CDL-A' : undefined);

      // Ensure required fields are not null
      if (!finalPhone) {
        console.error('Missing required phone number');
        return res.status(400).json({ error: 'Phone number is required' });
      }

      const candidateData = {
        callId: finalCallId,
        phone: finalPhone,
        transcript: processedTransript || null,
        answers: processedAnswers || null,
        qualified,
        experience,
        cdlType
      };

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
