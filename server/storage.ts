import { candidates, type Candidate, type InsertCandidate, users, type User, type InsertUser, type UpdateUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc, like, or, and, isNull } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUser(id: number, updateUser: UpdateUser): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Candidate methods
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  getCandidates(search?: string, status?: string): Promise<Candidate[]>;
  updateCandidateQualification(id: number, qualified: boolean): Promise<Candidate | undefined>;
  getCandidateByConversationId(conversationId: string): Promise<Candidate | undefined>;
  storeConversationData(conversationData: any): Promise<Candidate>;
  getCandidateStats(): Promise<{
    todayCalls: number;
    qualified: number;
    pending: number;
    qualificationRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: number, updateUser: UpdateUser): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updateUser)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const [candidate] = await db
      .insert(candidates)
      .values(insertCandidate)
      .returning();
    return candidate;
  }

  async getCandidates(search?: string, status?: string): Promise<Candidate[]> {
    const conditions = [];
    
    if (search) {
      conditions.push(or(
        like(candidates.phone, `%${search}%`),
        like(candidates.callId, `%${search}%`)
      ));
    }
    
    if (status) {
      if (status === 'qualified') {
        conditions.push(eq(candidates.qualified, true));
      } else if (status === 'not_qualified') {
        conditions.push(eq(candidates.qualified, false));
      } else if (status === 'pending') {
        conditions.push(isNull(candidates.qualified));
      }
    }
    
    let query = db.select().from(candidates);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions) as any);
    }
    
    return await query.orderBy(desc(candidates.createdAt)).limit(100);
  }

  async updateCandidateQualification(id: number, qualified: boolean): Promise<Candidate | undefined> {
    const [candidate] = await db
      .update(candidates)
      .set({ qualified })
      .where(eq(candidates.id, id))
      .returning();
    return candidate || undefined;
  }

  async getCandidateByConversationId(conversationId: string): Promise<Candidate | undefined> {
    const [candidate] = await db.select().from(candidates).where(eq(candidates.conversationId, conversationId));
    return candidate || undefined;
  }

  async storeConversationData(conversationData: any): Promise<Candidate> {
    const dataCollection = conversationData.data_collection || {};
    const dynamicVars = conversationData.conversation_initiation_client_data?.dynamic_variables || {};
    
    // Extract structured data from ElevenLabs format
    const candidateData: InsertCandidate = {
      conversationId: conversationData.conversation_id,
      callId: dynamicVars.system__call_sid,
      
      // Candidate Information
      firstName: dataCollection.First_Name?.value,
      lastName: dataCollection.Last_Name?.value,
      phone: dataCollection.Phone_number?.value,
      
      // Qualification Questions
      hasCdlA: dataCollection.question_one?.value || false,
      hasExperience: dataCollection.Question_two?.value || false,
      hasViolations: dataCollection.Question_three?.value || false,
      hasWorkAuth: dataCollection.question_four?.value || false,
      
      // Interview Scheduling
      interviewSchedule: dataCollection.schedule?.value,
      
      // Call Details
      agentId: dynamicVars.system__agent_id,
      callDuration: dynamicVars.system__call_duration_secs,
      callStatus: conversationData.call_successful,
      messageCount: conversationData.transcript?.length || 0,
      
      // Raw Data Storage
      transcript: conversationData.transcript,
      dataCollection: dataCollection,
      rawConversationData: conversationData,
      
      // Auto-qualify based on basic criteria
      qualified: this.autoQualifyCandidate(dataCollection),
      notificationSent: false,
    };
    
    // Check if candidate already exists
    const existing = await this.getCandidateByConversationId(conversationData.conversation_id);
    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(candidates)
        .set({
          ...candidateData,
          updatedAt: new Date(),
        })
        .where(eq(candidates.conversationId, conversationData.conversation_id))
        .returning();
      return updated;
    } else {
      // Create new record
      const [candidate] = await db
        .insert(candidates)
        .values(candidateData)
        .returning();
      return candidate;
    }
  }

  private autoQualifyCandidate(dataCollection: any): boolean | null {
    // Auto-qualify if they have CDL-A, experience, no violations, and work authorization
    const hasCdl = dataCollection.question_one?.value === true;
    const hasExp = dataCollection.Question_two?.value === true;
    const noViolations = dataCollection.Question_three?.value === false;
    const hasAuth = dataCollection.question_four?.value === true;
    
    if (hasCdl && hasExp && noViolations && hasAuth) {
      return true;
    } else if (dataCollection.question_one?.value === false) {
      // Definitely not qualified without CDL
      return false;
    }
    
    // Leave as pending for manual review
    return null;
  }

  async getCandidateStats(): Promise<{
    todayCalls: number;
    qualified: number;
    pending: number;
    qualificationRate: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const allCandidates = await db.select().from(candidates);
    const todayCandidates = allCandidates.filter(c => 
      c.createdAt && c.createdAt >= today
    );
    
    const qualified = allCandidates.filter(c => c.qualified === true).length;
    const pending = allCandidates.filter(c => c.qualified === null).length;
    const totalProcessed = allCandidates.filter(c => c.qualified !== null).length;
    const qualificationRate = totalProcessed > 0 ? Math.round((qualified / totalProcessed) * 100) : 0;
    
    return {
      todayCalls: todayCandidates.length,
      qualified,
      pending,
      qualificationRate
    };
  }
}

export const storage = new DatabaseStorage();
