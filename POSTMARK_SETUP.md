# Postmark Email Reports Setup

## 📦 **1. Install Dependencies**

```bash
# Install Postmark client library
npm install postmark

# Install node-cron for scheduled jobs
npm install node-cron
npm install @types/node-cron --save-dev
```

## 🔧 **2. Environment Variables**

Add these to your `.env` file:

```bash
# Postmark Configuration
POSTMARK_SERVER_TOKEN=your_postmark_server_token_here
POSTMARK_FROM_EMAIL=reports@yourcompany.com

# Optional: Override default settings
POSTMARK_REPORTS_STREAM=reports
```

## 🗄️ **3. Database Migration**

Run the database migration to add the new tables:

```bash
# Apply the Postmark database changes
psql $DATABASE_URL -f database-migration-postmark.sql
```

## 📧 **4. Postmark Account Setup**

1. **Create Postmark Account**: Go to https://postmarkapp.com/
2. **Create Server**: Create a new server for your application
3. **Get Server Token**: Copy the Server API Token
4. **Configure From Address**: Add and verify your sending domain/email
5. **Create Message Stream**: Create a "reports" stream for better organization

## 🎯 **5. Features**

### **Admin Features:**
- ✅ Configure report frequency (daily, weekly, monthly)
- ✅ Choose report content (metrics, call details, charts)
- ✅ Customize email templates
- ✅ Schedule specific days/times for delivery
- ✅ View email delivery logs

### **User Features:**
- ✅ Opt-in/out of email notifications
- ✅ Choose personal report frequency
- ✅ Receive formatted reports with call data and metrics

### **Report Types:**
- **Summary Reports**: Key metrics and conversion rates
- **Detailed Reports**: Individual call details and outcomes
- **Custom Reports**: Admin-configured content and metrics

## 🔄 **6. Testing**

Use the built-in test endpoint:
- `GET /api/reports/test` - Test Postmark connection
- `POST /api/reports/send-test` - Send test report to yourself

## 📊 **7. Report Content**

Reports can include:
- Total calls processed
- Qualified leads count
- Conversion rates
- Recent call details with outcomes
- Time period summaries
- Agent performance metrics (if configured)

## 🚀 **8. Next Steps**

After setup, users can:
1. Visit `/settings` to configure their email preferences
2. Admins can visit `/settings` → Reports tab to configure automatic reports
3. Test email sending with the manual send options 