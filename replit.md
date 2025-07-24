# Driver Recruiting Agent System

## Overview

This is a full-stack driver recruiting application that processes inbound calls through ElevenLabs Voice Agent and provides a dashboard for reviewing candidate information. The system captures call data, evaluates driver qualifications, and provides an administrative interface for recruitment teams to manage prospects.

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

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL using Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **API Pattern**: RESTful endpoints for candidate management

### Data Storage Solutions
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema Management**: Shared schema definitions between frontend and backend
- **Database Driver**: Neon serverless driver with WebSocket support
- **Connection Pooling**: Built-in connection pool management

## Key Components

### Database Schema
- **Candidates Table**: Stores candidate information including call data, qualification status, and driver credentials
- **Users Table**: Basic user management for admin access
- **Call Data**: JSON storage for flexible call transcript and answer data

### API Endpoints
- **POST /api/inbound**: Webhook receiver for ElevenLabs call data
- **GET /api/candidates**: Retrieves candidates with search and filtering
- **POST /api/candidates/:id/qualify**: Updates candidate qualification status
- **GET /api/stats**: Dashboard statistics and metrics

### Frontend Components
- **Dashboard**: Main application view with stats overview, recent calls, and candidate management
- **CandidateTable**: Searchable, filterable table for candidate review
- **TranscriptModal**: Detailed call transcript viewer with qualification controls
- **StatsOverview**: Real-time dashboard metrics
- **Recent Calls Section**: Live ElevenLabs conversation history with mobile-responsive design

### Qualification Logic
- **CDL Validation**: Checks for valid CDL license (specifically CDL-A)
- **Experience Requirements**: Validates minimum 2 years driving experience
- **Automatic Scoring**: Basic qualification scoring based on call responses

## Data Flow

1. **Inbound Call Processing**:
   - ElevenLabs Voice Agent processes driver calls
   - Call data sent to `/api/inbound` webhook
   - System parses transcript and qualification answers
   - Candidate record created with preliminary qualification score

2. **Admin Review Process**:
   - Dashboard displays recent calls and qualification statistics
   - Recruiters can search and filter candidates
   - Manual qualification override available through UI
   - Real-time updates using TanStack Query

3. **Data Persistence**:
   - All call data stored in PostgreSQL
   - Flexible JSON storage for call answers and transcripts
   - Audit trail for qualification status changes

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