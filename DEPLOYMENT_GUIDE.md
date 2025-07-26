# Driver Recruiting Agent - Deployment Guide

## Quick Start

This application is a complete driver recruitment system with ElevenLabs voice integration, candidate management, and automated email notifications.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Neon serverless recommended)
- Postmark account for email services
- ElevenLabs account for voice agent integration

## Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://[username]:[password]@[host]/[database]

# Email Service (Postmark)
POSTMARK_SERVER_TOKEN=your_postmark_server_token
FROM_EMAIL=your_sender_email@domain.com

# Voice Agent (ElevenLabs)
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret

# Authentication
JWT_SECRET=your_jwt_secret_key
```

## Installation Steps

1. **Clone the repository**
   ```bash
   git clone [your-repo-url]
   cd driver-recruiting-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up database**
   ```bash
   npm run db:push
   ```

4. **Create admin user**
   - Use the registration endpoint or database seeding
   - Default test user: Username "Autumn", Password "Boon2Moon"

5. **Start development server**
   ```bash
   npm run dev
   ```

## Production Deployment

### Using Replit (Recommended)
1. Import repository to Replit
2. Set environment variables in Replit Secrets
3. Deploy using Replit's deployment feature

### Manual Deployment
1. Build the application:
   ```bash
   npm run build
   ```
2. Start production server:
   ```bash
   npm start
   ```

## Key Features

- **Voice Agent Integration**: ElevenLabs webhook processing
- **Candidate Dashboard**: Real-time candidate management with AG Grid
- **Email Notifications**: Automated approval/denial emails with Excel attachments
- **User Authentication**: JWT-based secure login system
- **Excel Reports**: Detailed candidate data export functionality
- **Mobile Responsive**: Complete mobile-first design

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Candidates
- `GET /api/candidates` - List all candidates with filtering
- `POST /api/candidates/:id/qualify` - Update qualification status
- `GET /api/stats` - Dashboard statistics

### Voice Agent
- `POST /api/inbound` - ElevenLabs webhook endpoint (public)

### Email & Reports
- `POST /api/test-candidate-notification` - Test email notifications
- `GET /api/excel-report/:conversationId` - Download Excel report

## Database Schema

The application uses PostgreSQL with Drizzle ORM. Key tables:
- `call_records` - Primary storage for all call data with JSONB flexibility
- `users` - Admin user management
- `reports_config` - Email scheduling configuration
- `email_logs` - Email audit trail

## Troubleshooting

### Common Issues
1. **Email not sending**: Verify POSTMARK_SERVER_TOKEN and FROM_EMAIL
2. **Database connection**: Check DATABASE_URL format and credentials
3. **Voice agent webhook**: Ensure ELEVENLABS_WEBHOOK_SECRET is correct
4. **Authentication issues**: Verify JWT_SECRET is set

### Support
For technical support, check the logs in the development console or contact the development team.

## Security Notes

- All API endpoints (except webhook) require JWT authentication
- Passwords are hashed using bcryptjs
- Environment variables should never be committed to version control
- Use HTTPS in production for secure token transmission