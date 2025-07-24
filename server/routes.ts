import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCandidateSchema } from "@shared/schema";
import { emailService } from "./email";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Webhook endpoint to receive call data from ElevenLabs
  app.post('/api/inbound', async (req, res) => {
    try {
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

  const httpServer = createServer(app);
  return httpServer;
}
