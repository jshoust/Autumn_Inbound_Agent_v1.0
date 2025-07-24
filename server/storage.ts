import { candidates, type Candidate, type InsertCandidate, users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc, like, or, and, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Candidate methods
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  getCandidates(search?: string, status?: string): Promise<Candidate[]>;
  updateCandidateQualification(id: number, qualified: boolean): Promise<Candidate | undefined>;
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
      query = query.where(and(...conditions));
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
