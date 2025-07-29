import { pgTable, text, serial, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// New simplified table for call records with JSONB storage
export const callRecords = pgTable("call_records", {
  id: serial("id").primaryKey(),
  conversationId: text("conversation_id").unique().notNull(),
  agentId: text("agent_id").notNull(),
  status: text("status").notNull(), // done, failed, etc.
  
  // Direct columns for quick access
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  qualified: boolean("qualified"),
  
  // Store everything in JSONB for flexibility
  rawData: jsonb("raw_data").notNull(), // Complete ElevenLabs API response
  extractedData: jsonb("extracted_data"), // Processed/extracted key fields
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCallRecordSchema = createInsertSchema(callRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCallRecord = z.infer<typeof insertCallRecordSchema>;
export type CallRecord = typeof callRecords.$inferSelect;

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  conversationId: text("conversation_id").unique().notNull(),
  callId: text("call_id"),
  
  // Candidate Information
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  
  // Qualification Questions
  hasCdlA: boolean("has_cdl_a"),
  hasExperience: boolean("has_experience"),
  hasViolations: boolean("has_violations"),
  hasWorkAuth: boolean("has_work_auth"),
  
  // Interview Scheduling
  interviewSchedule: text("interview_schedule"),
  
  // Call Details
  agentId: text("agent_id"),
  callDuration: integer("call_duration_secs"),
  callStatus: text("call_status"), // success/failure
  messageCount: integer("message_count"),
  
  // Raw Data Storage
  transcript: jsonb("transcript"), // Full conversation transcript
  dataCollection: jsonb("data_collection"), // ElevenLabs extraction data
  rawConversationData: jsonb("raw_conversation_data"), // Complete ElevenLabs response
  
  // Processing Status
  qualified: boolean("qualified"),
  notificationSent: boolean("notification_sent").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
});

export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("recruiter"), // recruiter, admin, manager
  receiveNotifications: boolean("receive_notifications").notNull().default(true),
  // New email report preferences
  emailNotifications: boolean("email_notifications").default(true),
  reportFrequency: text("report_frequency").default("weekly"), // daily, weekly, monthly, disabled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).partial();

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;

// Reports configuration table for email scheduling
export const reportsConfig = pgTable("reports_config", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 'weekly_summary', 'daily_stats', etc.
  enabled: boolean("enabled").default(true),
  frequency: text("frequency").notNull(), // daily, weekly, monthly
  frequencyValue: integer("frequency_value").default(1), // e.g., every 2 weeks
  dayOfWeek: integer("day_of_week"), // 0-6 for weekly reports (0=Sunday)
  dayOfMonth: integer("day_of_month"), // 1-31 for monthly reports
  hourOfDay: integer("hour_of_day").default(9), // 24-hour format
  
  // Report content configuration
  reportType: text("report_type").notNull().default("summary"), // summary, detailed, custom
  includeMetrics: jsonb("include_metrics").default({"total_calls": true, "qualified_leads": true, "conversion_rate": true}),
  includeCallDetails: boolean("include_call_details").default(true),
  includeCharts: boolean("include_charts").default(false),
  
  // Email template settings
  subjectTemplate: text("subject_template").default("TruckRecruit Pro - {period} Report"),
  templateData: jsonb("template_data").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSentAt: timestamp("last_sent_at"),
  nextSendAt: timestamp("next_send_at"),
});

// Calendar configuration table for Microsoft Graph integration
export const calendarConfig = pgTable("calendar_config", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  
  // Microsoft Graph API credentials
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  tenantId: text("tenant_id"),
  
  // Calendar settings
  recruiterEmail: text("recruiter_email").default("info@neurovista.ai"),
  defaultDurationMinutes: integer("default_duration_minutes").default(30),
  timezone: text("timezone").default("America/Chicago"),
  
  // Auto-booking settings
  autoBookInterviews: boolean("auto_book_interviews").default(true),
  businessHoursStart: integer("business_hours_start").default(9), // 9 AM
  businessHoursEnd: integer("business_hours_end").default(17), // 5 PM
  
  // Notification settings
  sendCandidateSMS: boolean("send_candidate_sms").default(true),
  sendRecruiterNotification: boolean("send_recruiter_notification").default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Scheduled interviews table
export const scheduledInterviews = pgTable("scheduled_interviews", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").references(() => callRecords.id),
  candidateName: text("candidate_name").notNull(),
  candidatePhone: text("candidate_phone").notNull(),
  candidateEmail: text("candidate_email"),
  
  // Interview details
  subject: text("subject").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  durationMinutes: integer("duration_minutes").default(30),
  
  // Calendar integration
  calendarEventId: text("calendar_event_id"),
  recruiterEmail: text("recruiter_email").notNull(),
  
  // Status
  status: text("status").default("scheduled"), // scheduled, completed, cancelled, no-show
  confirmedByCandidate: boolean("confirmed_by_candidate").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReportsConfigSchema = createInsertSchema(reportsConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateReportsConfigSchema = createInsertSchema(reportsConfig).omit({
  id: true,
  createdAt: true,
}).partial();

export type InsertReportsConfig = z.infer<typeof insertReportsConfigSchema>;
export type UpdateReportsConfig = z.infer<typeof updateReportsConfigSchema>;
export type ReportsConfig = typeof reportsConfig.$inferSelect;

// Email logs table to track sent emails
export const emailLogs = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  reportConfigId: integer("report_config_id").references(() => reportsConfig.id),
  recipientEmail: text("recipient_email").notNull(),
  recipientUserId: integer("recipient_user_id").references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").notNull(), // sent, failed, pending
  postmarkMessageId: text("postmark_message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  
  // Report data snapshot
  reportPeriodStart: timestamp("report_period_start"),
  reportPeriodEnd: timestamp("report_period_end"),
  reportData: jsonb("report_data"),
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  sentAt: true,
});

export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;
