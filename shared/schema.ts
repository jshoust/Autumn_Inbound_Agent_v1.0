import { pgTable, text, serial, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
