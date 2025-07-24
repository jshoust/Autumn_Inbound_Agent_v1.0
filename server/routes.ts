import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCandidateSchema } from "@shared/schema";
import { emailService } from "./email";
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
      const { call_id, transcript, phone, answers } = req.body;

      // Basic qualification scoring logic
      let qualified = null;
      if (answers) {
        const hasValidCDL = answers.cdl === true || answers.cdl_type === 'CDL-A';
        const hasExperience = answers.experience && parseInt(answers.experience) >= 2;
        qualified = hasValidCDL && hasExperience;
      }

      // Extract experience and CDL type from answers
      const experience = answers?.experience ? `${answers.experience} years` : undefined;
      const cdlType = answers?.cdl_type || (answers?.cdl ? 'CDL-A' : undefined);

      const candidateData = {
        callId: call_id,
        phone,
        transcript,
        answers,
        qualified,
        experience,
        cdlType
      };

      const candidate = await storage.createCandidate(candidateData);
      
      // Send email notification if candidate is automatically qualified
      if (qualified === true) {
        try {
          await emailService.sendQualificationNotification(candidate);
        } catch (error) {
          console.error('Failed to send qualification email:', error);
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
          await emailService.sendQualificationNotification(candidate);
        } catch (error) {
          console.error('Failed to send qualification email:', error);
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

  // Test endpoint to simulate ElevenLabs webhook (for testing purposes)
  app.post('/api/test-webhook', async (req, res) => {
    const testData = {
      call_id: `test-${Date.now()}`,
      transcript: "AGENT: Hello, thank you for calling about truck driving opportunities. Do you have a valid CDL-A license?\nCALLER: Yes, I have my CDL-A license for the past 3 years.\nAGENT: Great! How many years of driving experience do you have?\nCALLER: I've been driving trucks for about 5 years now.\nAGENT: Excellent! We'll review your application and get back to you soon.",
      phone: "555-0123",
      answers: {
        cdl: true,
        cdl_type: "CDL-A",
        experience: "5"
      }
    };

    try {
      console.log('Test webhook triggered with data:', JSON.stringify(testData, null, 2));
      
      // Process the same way as real webhook
      const { call_id, transcript, phone, answers } = testData;
      
      let qualified = null;
      if (answers) {
        const hasValidCDL = answers.cdl === true || answers.cdl_type === 'CDL-A';
        const hasExperience = answers.experience && parseInt(answers.experience) >= 2;
        qualified = hasValidCDL && hasExperience;
      }

      const experience = answers?.experience ? `${answers.experience} years` : undefined;
      const cdlType = answers?.cdl_type || (answers?.cdl ? 'CDL-A' : undefined);

      const candidateData = {
        callId: call_id,
        phone,
        transcript,
        answers,
        qualified,
        experience,
        cdlType
      };

      const candidate = await storage.createCandidate(candidateData);
      
      if (qualified === true) {
        try {
          await emailService.sendQualificationNotification(candidate);
          console.log('Test qualification email sent successfully');
        } catch (error) {
          console.error('Failed to send test qualification email:', error);
        }
      }
      
      res.status(200).json({ 
        status: 'Test successful', 
        candidate,
        qualified,
        email_sent: qualified === true 
      });
    } catch (error) {
      console.error('Error in test webhook:', error);
      res.status(500).json({ error: 'Test failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
