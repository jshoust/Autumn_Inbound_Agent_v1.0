# Driver Recruiting Agent System

A comprehensive AI-powered recruitment platform for commercial trucking companies, featuring intelligent candidate screening through ElevenLabs voice integration and automated workflow management.

## 🚀 Features

- **Voice Agent Integration** - ElevenLabs AI processes inbound driver calls
- **Real-time Dashboard** - Live candidate management with advanced filtering
- **Automatic Call Notifications** - Instant email alerts after every call completion
- **Automated Decision Emails** - Email alerts for approved/denied candidates with Excel reports
- **Advanced Data Grid** - AG Grid with inline editing, export, and multi-select
- **Mobile Responsive** - Complete mobile-first design for on-the-go management
- **Secure Authentication** - JWT-based user management system

## 🛠 Tech Stack

### Frontend
- **React** with TypeScript and Vite
- **Tailwind CSS** with shadcn/ui components
- **AG Grid** for advanced data tables
- **TanStack Query** for state management
- **Wouter** for lightweight routing

### Backend
- **Node.js** with Express and TypeScript
- **PostgreSQL** with Drizzle ORM
- **Postmark** for email services
- **ElevenLabs** voice agent integration
- **JWT** authentication with bcryptjs

## 📦 Quick Start

1. **Clone and install**
   ```bash
   git clone [your-repo-url]
   cd driver-recruiting-agent
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Database setup**
   ```bash
   npm run db:push
   ```

4. **Start development**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open http://localhost:5000
   - Login: Username "Autumn", Password "Boon2Moon"

## 🔧 Configuration

### Required Environment Variables
```env
DATABASE_URL=postgresql://user:pass@host/db
POSTMARK_SERVER_TOKEN=your_postmark_token
FROM_EMAIL=sender@yourdomain.com
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret
JWT_SECRET=your_jwt_secret
```

## 📊 How It Works

1. **Call Processing** - ElevenLabs processes driver calls and sends data via webhook
2. **Instant Notification** - Automatic email sent immediately after each call completion
3. **Data Storage** - Complete call records stored with JSONB flexibility
4. **Admin Review** - Recruiters review candidates through the dashboard
5. **Decision Emails** - Approval/denial notifications sent with Excel attachments
6. **Reporting** - Comprehensive analytics and export capabilities

## 🎯 Key Components

- **Dashboard** - Main recruitment interface with stats and candidate grid
- **Voice Integration** - ElevenLabs webhook processing for call data
- **Email System** - Postmark integration with HTML emails and Excel attachments
- **Data Management** - PostgreSQL with Drizzle ORM for type-safe queries
- **Authentication** - Secure JWT-based user system

## 📱 Mobile Support

Fully responsive design with:
- Card-based layouts for small screens
- Touch-friendly interactions
- Optimized data grids
- Mobile navigation

## 🚀 Deployment

### Replit (Recommended)
1. Import to Replit
2. Set environment variables in Secrets
3. Deploy using Replit Deployments

### Manual Deployment
1. Build: `npm run build`
2. Start: `npm start`
3. Configure reverse proxy (nginx/Apache)

## 📝 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User authentication
- `GET /api/auth/me` - Current user info

### Candidate Management
- `GET /api/candidates` - List candidates with filtering
- `POST /api/candidates/:id/qualify` - Update qualification
- `GET /api/stats` - Dashboard metrics

### Voice Agent
- `POST /api/inbound` - ElevenLabs webhook (public)

## 🛡 Security

- JWT token authentication
- Password hashing with bcryptjs
- Protected API endpoints
- Webhook signature verification
- Environment variable protection

## 📈 Analytics

Built-in dashboard metrics:
- Daily call volume
- Qualification rates
- Candidate pipeline status
- Performance trends

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📄 License

[Your License Here]

## 🆘 Support

For issues or questions:
- Check the [Deployment Guide](DEPLOYMENT_GUIDE.md)
- Review console logs for errors
- Contact development team

---

Built with ❤️ for modern recruitment teams