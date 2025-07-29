import { candidates, type Candidate, type InsertCandidate, users, type User, type InsertUser, type UpdateUser, callRecords, type CallRecord, type InsertCallRecord, reportsConfig, type ReportsConfig, type InsertReportsConfig, type UpdateReportsConfig, emailLogs, type EmailLog, type InsertEmailLog, calendarConfig, type CalendarConfig, scheduledInterviews, type ScheduledInterview, type InsertScheduledInterview, type UpdateScheduledInterview } from "@shared/schema";
import { db } from "./db";
import { eq, desc, like, or, and, isNull, gte, lte } from "drizzle-orm";

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
  
  // Call Record methods (new JSONB-based storage)
  storeCallRecord(callData: {
    conversationId: string;
    agentId: string; 
    status: string;
    rawData: any;
    extractedData?: any;
  }): Promise<CallRecord>;
  getCallRecords(agentId?: string, limit?: number, search?: string): Promise<CallRecord[]>;
  getCallRecordByConversationId(conversationId: string): Promise<CallRecord | undefined>;
  getCallRecordsByDateRange(startDate: Date, endDate: Date): Promise<CallRecord[]>;
  storeCandidateFromCall(conversationId: string, agentId: string, fullConversationData: any): Promise<Candidate>;
  updateCallRecordQualification(id: number, qualified: boolean): Promise<CallRecord | undefined>;
  getCallRecordStats(): Promise<{
    todayCalls: number;
    qualified: number;
    pending: number;
    qualificationRate: number;
  }>;
  
  // Report Configuration methods
  getReportConfigs(): Promise<ReportsConfig[]>;
  getReportConfig(id: number): Promise<ReportsConfig | undefined>;
  createReportConfig(config: InsertReportsConfig): Promise<ReportsConfig>;
  updateReportConfig(id: number, config: UpdateReportsConfig): Promise<ReportsConfig | undefined>;
  deleteReportConfig(id: number): Promise<boolean>;
  getScheduledReports(): Promise<ReportsConfig[]>;
  
  // Email Log methods
  logEmailSent(emailData: InsertEmailLog): Promise<EmailLog>;
  getEmailLogs(limit?: number): Promise<EmailLog[]>;
  getEmailLogsByReportConfig(reportConfigId: number): Promise<EmailLog[]>;

  // Calendar configuration methods
  getCalendarConfig(): Promise<CalendarConfig | null>;
  updateCalendarConfig(data: Partial<CalendarConfig>): Promise<CalendarConfig>;

  // Scheduled interviews methods
  createScheduledInterview(data: {
    candidateId: number;
    candidateName: string;
    candidatePhone: string;
    candidateEmail?: string;
    subject: string;
    startTime: Date;
    endTime: Date;
    calendarEventId?: string;
    recruiterEmail: string;
  }): Promise<ScheduledInterview>;

  getScheduledInterviews(): Promise<ScheduledInterview[]>;
  getScheduledInterview(id: number): Promise<ScheduledInterview | null>;
  updateScheduledInterview(id: number, data: Partial<ScheduledInterview>): Promise<ScheduledInterview>;
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

  async createCandidate(candidateData: {
    conversationId: string;
    callId: string;
    firstName?: string | null;
    lastName?: string | null;
    phone: string;
    hasCdlA?: boolean | null;
    hasExperience?: boolean | null;
    hasViolations?: boolean | null;
    hasWorkAuth?: boolean | null;
    agentId?: string | null;
    callDurationSecs?: number | null;
    transcript?: string | null;
    dataCollection?: any;
    qualified?: boolean | null;
    rawConversationData?: any;
  }): Promise<Candidate> {
    
    const insertData: InsertCandidate = {
      conversationId: candidateData.conversationId,
      callId: candidateData.callId,
      firstName: candidateData.firstName,
      lastName: candidateData.lastName,
      phone: candidateData.phone,
      hasCdlA: candidateData.hasCdlA,
      hasExperience: candidateData.hasExperience,
      hasViolations: candidateData.hasViolations,
      hasWorkAuth: candidateData.hasWorkAuth,
      agentId: candidateData.agentId,
      callDuration: candidateData.callDurationSecs,
      transcript: candidateData.transcript || null,
      dataCollection: candidateData.dataCollection || null,
      qualified: candidateData.qualified || null,
      rawConversationData: candidateData.rawConversationData || null,
    };

    console.log('Inserting candidate with extracted data:', JSON.stringify(insertData, null, 2));

    const [candidate] = await db
      .insert(candidates)
      .values(insertData)
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

  // Call Record methods (new JSONB-based storage)
  async storeCallRecord(callData: {
    conversationId: string;
    agentId: string; 
    status: string;
    rawData: any;
    extractedData?: any;
  }): Promise<CallRecord> {
    
    const extractedData = callData.extractedData || extractKeyData(callData.rawData);
    
    const insertData: InsertCallRecord = {
      conversationId: callData.conversationId,
      agentId: callData.agentId,
      status: callData.status,
      // Populate direct columns from extracted data
      firstName: extractedData.firstName || null,
      lastName: extractedData.lastName || null,
      phone: extractedData.phoneNumber || null,
      qualified: extractedData.qualified || null,
      // Store complete data in JSONB
      rawData: callData.rawData,
      extractedData: extractedData
    };

    console.log('Storing call record:', JSON.stringify({
      conversationId: callData.conversationId,
      agentId: callData.agentId,
      extractedName: `${extractedData.firstName} ${extractedData.lastName}`,
      qualified: extractedData.qualified
    }, null, 2));

    // Check if record already exists
    const existing = await this.getCallRecordByConversationId(callData.conversationId);
    if (existing) {
      // Update existing record
      const [updated] = await db
        .update(callRecords)
        .set({
          ...insertData,
          updatedAt: new Date(),
        })
        .where(eq(callRecords.conversationId, callData.conversationId))
        .returning();
      return updated;
    } else {
      // Create new record
      const [callRecord] = await db
        .insert(callRecords)
        .values(insertData)
        .returning();
      return callRecord;
    }
  }

  async getCallRecords(agentId?: string, limit: number = 50, search?: string): Promise<CallRecord[]> {
    let query = db.select().from(callRecords);
    
    const conditions = [];
    
    if (agentId && agentId.trim() !== '') {
      conditions.push(eq(callRecords.agentId, agentId));
    }
    
    if (search && search.trim() !== '') {
      conditions.push(or(
        like(callRecords.firstName, `%${search}%`),
        like(callRecords.lastName, `%${search}%`),
        like(callRecords.phone, `%${search}%`),
        like(callRecords.conversationId, `%${search}%`)
      ));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions) as any);
    }
    
    return await query.orderBy(desc(callRecords.createdAt)).limit(limit);
  }

  async getCallRecordByConversationId(conversationId: string): Promise<CallRecord | undefined> {
    const [callRecord] = await db.select().from(callRecords).where(eq(callRecords.conversationId, conversationId));
    return callRecord || undefined;
  }

  async storeCandidateFromCall(conversationId: string, agentId: string, apiResponse: any): Promise<Candidate> {
    const extractedData = extractKeyData(apiResponse);
    
    console.log('Creating candidate from call:', {
      conversationId,
      agentId,
      extractedName: `${extractedData.firstName} ${extractedData.lastName}`,
      qualified: extractedData.qualified
    });
    
    const [candidate] = await db
      .insert(candidates)
      .values({
        conversationId,
        callId: conversationId,
        agentId,
        firstName: extractedData.firstName,
        lastName: extractedData.lastName,
        phone: extractedData.phoneNumber,
        hasCdlA: extractedData.cdlA,
        hasExperience: extractedData.experience24Months,
        hasViolations: false,
        hasWorkAuth: extractedData.workEligible,
        callDuration: extractedData.callDuration,
        callStatus: extractedData.callSuccessful ? 'success' : 'failed',
        transcript: apiResponse.transcript,
        rawConversationData: apiResponse,
        qualified: extractedData.qualified,
        messageCount: apiResponse.transcript?.length || 0
      })
      .onConflictDoUpdate({
        target: candidates.conversationId,
        set: {
          firstName: extractedData.firstName,
          lastName: extractedData.lastName,
          phone: extractedData.phoneNumber,
          hasCdlA: extractedData.cdlA,
          hasExperience: extractedData.experience24Months,
          hasViolations: false,
          hasWorkAuth: extractedData.workEligible,
          callDuration: extractedData.callDuration,
          callStatus: extractedData.callSuccessful ? 'success' : 'failed',
          transcript: apiResponse.transcript,
          rawConversationData: apiResponse,
          qualified: extractedData.qualified,
          messageCount: apiResponse.transcript?.length || 0,
          updatedAt: new Date()
        }
      })
      .returning();

    console.log('=== CANDIDATE CREATED ===');
    console.log('Candidate ID:', candidate.id);
    console.log('Name:', `${candidate.firstName} ${candidate.lastName}`);
    console.log('Phone:', candidate.phone);
    console.log('CDL:', candidate.hasCdlA);
    console.log('Experience:', candidate.hasExperience);
    console.log('Qualified:', candidate.qualified);
    console.log('=== END CANDIDATE CREATION ===');

    return candidate;
  }

  // Get call records by date range
  async getCallRecordsByDateRange(startDate: Date, endDate: Date): Promise<CallRecord[]> {
    return await db
      .select()
      .from(callRecords)
      .where(and(
        gte(callRecords.createdAt, startDate),
        lte(callRecords.createdAt, endDate)
      ))
      .orderBy(desc(callRecords.createdAt));
  }

  async getEmailLogsByReportConfig(reportConfigId: number): Promise<EmailLog[]> {
    return await db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.reportConfigId, reportConfigId))
      .orderBy(desc(emailLogs.sentAt));
  }

  // Report Configuration methods
  async getReportConfigs(): Promise<ReportsConfig[]> {
    return await db.select().from(reportsConfig).orderBy(desc(reportsConfig.createdAt));
  }

  async getReportConfig(id: number): Promise<ReportsConfig | undefined> {
    const [config] = await db.select().from(reportsConfig).where(eq(reportsConfig.id, id));
    return config || undefined;
  }

  async createReportConfig(insertConfig: InsertReportsConfig): Promise<ReportsConfig> {
    const [config] = await db
      .insert(reportsConfig)
      .values(insertConfig)
      .returning();
    return config;
  }

  async updateReportConfig(id: number, updateConfig: UpdateReportsConfig): Promise<ReportsConfig | undefined> {
    const [config] = await db
      .update(reportsConfig)
      .set({ ...updateConfig, updatedAt: new Date() })
      .where(eq(reportsConfig.id, id))
      .returning();
    return config || undefined;
  }

  // New method to update call record qualification status
  async updateCallRecordQualification(id: number, qualified: boolean): Promise<CallRecord | undefined> {
    const [callRecord] = await db
      .update(callRecords)
      .set({ 
        qualified,
        updatedAt: new Date()
      })
      .where(eq(callRecords.id, id))
      .returning();
    return callRecord || undefined;
  }

  // New method to get stats from call records
  async getCallRecordStats(): Promise<{
    todayCalls: number;
    qualified: number;
    pending: number;
    qualificationRate: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const allCallRecords = await db.select().from(callRecords);
    const todayCallRecords = allCallRecords.filter(c => 
      c.createdAt && c.createdAt >= today
    );
    
    const qualified = allCallRecords.filter(c => c.qualified === true).length;
    const pending = allCallRecords.filter(c => c.qualified === null).length;
    const totalProcessed = allCallRecords.filter(c => c.qualified !== null).length;
    const qualificationRate = totalProcessed > 0 ? Math.round((qualified / totalProcessed) * 100) : 0;
    
    return {
      todayCalls: todayCallRecords.length,
      qualified,
      pending,
      qualificationRate
    };
  }

  async deleteReportConfig(id: number): Promise<boolean> {
    const result = await db.delete(reportsConfig).where(eq(reportsConfig.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getScheduledReports(): Promise<ReportsConfig[]> {
    const now = new Date();
    return await db
      .select()
      .from(reportsConfig)
      .where(and(
        eq(reportsConfig.enabled, true),
        or(
          isNull(reportsConfig.nextSendAt),
          lte(reportsConfig.nextSendAt, now)
        )
      ))
      .orderBy(reportsConfig.nextSendAt);
  }

  // Email Log methods
  async logEmailSent(emailData: InsertEmailLog): Promise<EmailLog> {
    const [log] = await db
      .insert(emailLogs)
      .values(emailData)
      .returning();
    return log;
  }

  async getEmailLogs(limit: number = 100): Promise<EmailLog[]> {
    return await db
      .select()
      .from(emailLogs)
      .orderBy(desc(emailLogs.sentAt))
      .limit(limit);
  }

  // Calendar configuration methods
  async getCalendarConfig(): Promise<CalendarConfig | null> {
    const results = await db.select().from(calendarConfig).limit(1);
    return results[0] || null;
  }

  async updateCalendarConfig(data: Partial<CalendarConfig>): Promise<CalendarConfig> {
    const existing = await this.getCalendarConfig();
    
    if (existing) {
      const results = await db.update(calendarConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(calendarConfig.id, existing.id))
        .returning();
      return results[0];
    } else {
      const results = await db.insert(calendarConfig).values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      return results[0];
    }
  }

  // Scheduled interviews methods
  async createScheduledInterview(data: {
    candidateId: number;
    candidateName: string;
    candidatePhone: string;
    candidateEmail?: string;
    subject: string;
    startTime: Date;
    endTime: Date;
    calendarEventId?: string;
    recruiterEmail: string;
  }): Promise<ScheduledInterview> {
    const results = await db.insert(scheduledInterviews).values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return results[0];
  }

  async getScheduledInterviews(): Promise<ScheduledInterview[]> {
    const results = await db.select().from(scheduledInterviews).orderBy(desc(scheduledInterviews.startTime));
    return results;
  }

  async getScheduledInterview(id: number): Promise<ScheduledInterview | null> {
    const results = await db.select().from(scheduledInterviews).where(eq(scheduledInterviews.id, id));
    return results[0] || null;
  }

  async updateScheduledInterview(id: number, data: Partial<ScheduledInterview>): Promise<ScheduledInterview> {
    const results = await db.update(scheduledInterviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scheduledInterviews.id, id))
      .returning();
    return results[0];
  }
}

// Helper function to extract key data from ElevenLabs API response
function extractKeyData(apiResponse: any) {
  const dataCollection = apiResponse.analysis?.data_collection_results || {};
  const transcript = apiResponse.transcript || [];
  
  console.log('=== DATA COLLECTION RESULTS ===');
  console.log('Available fields:', Object.keys(dataCollection));
  Object.keys(dataCollection).forEach(key => {
    const field = dataCollection[key];
    console.log(`${key}: ${field?.value} (${typeof field?.value})`);
  });
  console.log('=== END DATA COLLECTION ===');
  
  // Extract basic info for direct columns
  const firstName = dataCollection.First_Name?.value || '';
  const lastName = dataCollection.Last_Name?.value || '';
  const phoneNumber = dataCollection.Phone_number?.value || '';
  
  // Calculate qualification status - must have CDL AND experience AND no violations AND work eligible
  const hasCDL = dataCollection.question_one?.value === true;
  const hasExperience = dataCollection.Question_two?.value === true;
  const hasViolations = dataCollection.question_five?.value === true;
  const workEligible = dataCollection.question_six?.value === true;
  const qualified = hasCDL && hasExperience && !hasViolations && (workEligible !== false);
  
  console.log('=== EXTRACTED DATA ===');
  console.log('First Name:', firstName);
  console.log('Last Name:', lastName);
  console.log('Phone:', phoneNumber);
  console.log('Qualified:', qualified);
  console.log('=== END EXTRACTION ===');
  
  return {
    // Basic info for direct columns
    firstName,
    lastName,
    phoneNumber,
    qualified,
    
    // Store the COMPLETE data_collection_results for frontend processing
    dataCollectionResults: dataCollection,
    
    // Additional metadata
    callDuration: transcript.length > 0 ? transcript[transcript.length - 1]?.time_in_call_secs || 0 : 0,
    callSuccessful: apiResponse.analysis?.call_successful === 'success',
    transcript: transcript
  };
}

export const storage = new DatabaseStorage();
