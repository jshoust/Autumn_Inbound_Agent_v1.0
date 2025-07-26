# Driver Recruiting Agent System

## Overview

This is a full-stack driver recruiting application that processes inbound calls through ElevenLabs Voice Agent and provides a dashboard for reviewing candidate information. The system captures call data, evaluates driver qualifications, and provides an administrative interface for recruitment teams to manage prospects.

**Current Status**: Production-ready with complete email notification system, Excel report generation, and candidate management dashboard. All major features implemented and tested.

## User Preferences

Preferred communication style: Simple, everyday language.
UI Structure: Simplified 2-tab interface (Dashboard + Settings) with call history integrated into main dashboard.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for development
- **Routing**: Wouter for client-side routing (Dashboard and Settings pages)
- **UI Framework**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state management
- **Design System**: Custom component library based on Radix primitives
- **Mobile Responsiveness**: Complete mobile-first design with card layouts for small screens
- **Authentication**: JWT-based authentication with protected routes and automatic token refresh

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL using Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **API Pattern**: RESTful endpoints for candidate management
- **Authentication**: JWT tokens with bcryptjs password hashing and middleware protection

### Data Storage Solutions
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema Management**: Shared schema definitions between frontend and backend
- **Database Driver**: Neon serverless driver with WebSocket support
- **Connection Pooling**: Built-in connection pool management

## Key Components

### Database Schema
- **Call Records Table**: Primary storage for all incoming calls with JSONB structure for flexibility
  - Direct columns: first_name, last_name, phone, qualified for quick queries
  - JSONB fields: raw_data (complete ElevenLabs response), extracted_data (processed information)
- **Candidates Table**: Legacy table (deprecated in favor of call_records)
- **Users Table**: Basic user management for admin access
- **Reports Config Table**: Email scheduling and report configuration
- **Email Logs Table**: Audit trail for sent email notifications

### API Endpoints
- **POST /api/auth/login**: User authentication endpoint
- **POST /api/auth/register**: User registration endpoint
- **GET /api/auth/me**: Get current authenticated user
- **POST /api/inbound**: Webhook receiver for ElevenLabs call data (unprotected)
- **GET /api/candidates**: Retrieves candidates with search and filtering (JWT protected)
- **POST /api/candidates/:id/qualify**: Updates candidate qualification status (JWT protected)
- **GET /api/stats**: Dashboard statistics and metrics (JWT protected)

### Frontend Components
- **LoginPage**: JWT authentication interface with Boon Technologies branding
- **ProtectedRoute**: Route wrapper that enforces authentication
- **Dashboard**: Main application view with stats overview, recent calls, and candidate management
- **CandidatesAgGrid**: Advanced AG Grid table component with dynamic columns, inline editing, CSV/Excel export, multi-row selection, and comprehensive candidate data display
- **TranscriptModal**: Detailed call transcript viewer with qualification controls
- **StatsOverview**: Real-time dashboard metrics
- **Recent Calls Section**: Live ElevenLabs conversation history with mobile-responsive design
- **Header**: Branded navigation with user authentication controls and logout functionality

### Qualification Logic
- **CDL Validation**: Checks for valid CDL license (specifically CDL-A)
- **Experience Requirements**: Validates minimum 2 years driving experience
- **Automatic Scoring**: Basic qualification scoring based on call responses

## Data Flow

1. **Inbound Call Processing**:
   - ElevenLabs Voice Agent processes driver calls
   - Call data sent to `/api/inbound` webhook
   - System stores complete API response in call_records table with JSONB structure
   - Extracted data populated for quick access and qualification scoring

2. **Admin Review Process**:  
   - Dashboard displays call records with candidate information
   - Recruiters can search and filter by name, phone, or conversation ID
   - Manual qualification override available through UI
   - Real-time updates using TanStack Query with call_records data

3. **Data Persistence**:
   - All call data stored in PostgreSQL call_records table
   - JSONB storage provides flexibility for varying ElevenLabs data structures
   - Complete API responses preserved for analysis and debugging
   - Extracted fields enable efficient querying and reporting

## External Dependencies

### Core Services
- **ElevenLabs Voice Agent**: Handles inbound calls and provides webhook integration
  - Webhook endpoint: `/api/inbound` with signature verification
  - Webhook secret configured: `ELEVENLABS_WEBHOOK_SECRET`
  - ElevenLabs sends call data via webhook after call completion
- **Postmark Email Service**: Sends qualification notifications to candidates
  - Requires POSTMARK_SERVER_TOKEN and FROM_EMAIL environment variables
  - Automatically sends emails when candidates are qualified
- **Neon PostgreSQL**: Serverless database hosting
- **Replit**: Development and hosting platform

### Frontend Libraries
- **Radix UI**: Accessible component primitives
- **TanStack Query**: Server state management
- **Wouter**: Lightweight routing
- **Tailwind CSS**: Utility-first styling
- **date-fns**: Date manipulation utilities

### Backend Libraries
- **Express**: Web application framework
- **Drizzle ORM**: Type-safe database access
- **Zod**: Runtime type validation
- **Connect-PG-Simple**: Session store for PostgreSQL

## Deployment Strategy

### Development Environment
- **Vite Development Server**: Hot module replacement for frontend
- **TSX**: TypeScript execution for backend development
- **Nodemon-style Watching**: Automatic server restart on changes

### Production Build
- **Frontend**: Vite build with optimized bundling
- **Backend**: ESBuild compilation to ESM format
- **Database**: Drizzle migrations with push strategy
- **Environment**: Node.js production server

### Configuration Management
- **Environment Variables**: Database connection strings and API keys
- **TypeScript Configuration**: Shared paths and module resolution
- **Build Scripts**: Separate development and production workflows

The system is designed for rapid development and easy scaling, with a focus on real-time candidate processing and efficient recruitment workflow management.

## Recent Changes (January 2025)

- **Automatic Email Notifications**: Added instant email alerts after every call completion (January 26, 2025)
- **Call Completion Workflow**: System now sends immediate notifications for all completed calls requiring review
- **Email Notification System**: Complete Postmark integration with candidate approval/denial notifications
- **Excel Report Generation**: Automated candidate data export with call transcripts and Q&A details
- **Subject Line Improvements**: Candidate names now included in email subjects for easy identification
- **Data Privacy Updates**: Removed Conversation ID and Agent ID from email content per privacy requirements
- **Bug Fixes**: Corrected subject line logic to properly distinguish approved vs denied candidates
- **Authentication System**: JWT-based login with user "Autumn" and secure password protection
- **Production Ready**: All features tested and operational, ready for deployment and GitHub duplication

### Latest Feature: Automatic Call Completion Emails
- **Trigger**: Every ElevenLabs call completion automatically sends notification email
- **Recipients**: Configured FROM_EMAIL address receives immediate alerts
- **Content**: "New Driver Call Completed - [Candidate Name]" with Excel attachment
- **Status**: "CALL COMPLETED - PENDING REVIEW" for all new applications
- **Integration**: Built into webhook endpoint `/api/inbound` for seamless operation

## Environment Setup

**Required Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string (Neon serverless)
- `POSTMARK_SERVER_TOKEN`: Email service API key (currently: 1f036240-dcfe-45c8-a77f-1b71717c1330)
- `FROM_EMAIL`: Sender email address (john@getboon.ai)
- `ELEVENLABS_WEBHOOK_SECRET`: Voice agent webhook verification
- `JWT_SECRET`: Token signing key for authentication

**Test Credentials:**
- Username: Autumn
- Password: Boon2Moon

The system is designed for rapid development and easy scaling, with a focus on real-time candidate processing and efficient recruitment workflow management.