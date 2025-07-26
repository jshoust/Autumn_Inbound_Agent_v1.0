# Inbound Voice Agent Analyzer - Setup Guide

## 🎯 Overview

The updated inbound voice agent analyzer now provides:
- **Agent-specific filtering** for calls from `agent_01k076swcgekzt88m03gegfgsr`
- **Automatic API integration** that fetches full conversation details
- **JSONB-based storage** for flexible data handling
- **Professional screener interface** for real-time call monitoring

## 🔄 New Workflow

1. **Webhook receives** ElevenLabs call completion event
2. **Filter by Agent ID** - only processes calls from target agent
3. **API call triggered** to fetch full conversation details from ElevenLabs
4. **Store in JSONB** format with extracted key data
5. **Display in screener** interface with real-time updates

## 🛠️ Setup Instructions

### 1. Environment Configuration

Create a `.env` file with the following variables:

```bash
# ElevenLabs Configuration
ELEVENLABS_API_KEY=sk_a8bce414645f45ebfe8da832e0efdfb511e468e9cd64b150
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_here

# Target Agent Configuration
TARGET_AGENT_ID=agent_01k076swcgekzt88m03gegfgsr

# Database Configuration
DATABASE_URL=your_database_url_here
```

### 2. Database Migration

Run the SQL migration to add the new call_records table:

```bash
# For new installations
psql $DATABASE_URL -f database-migration.sql

# If you already have a call_records table, run the update migration:
psql $DATABASE_URL -f database-migration-update.sql
```

### 3. ElevenLabs Webhook Configuration

In your ElevenLabs dashboard:

1. Go to your agent settings (`agent_01k076swcgekzt88m03gegfgsr`)
2. Set webhook URL to: `https://your-domain.com/api/inbound`
3. Configure webhook to trigger on **call completion**
4. Add webhook signature secret (optional but recommended)

## 📊 Data Structure

### Database Table Structure

The `call_records` table uses a hybrid approach with both direct columns and JSONB storage:

**Direct Columns (for fast queries):**
- `first_name` TEXT - Caller's first name
- `last_name` TEXT - Caller's last name  
- `phone` TEXT - Phone number
- `qualified` BOOLEAN - Qualification status

**JSONB Storage:**
- `raw_data` - Complete ElevenLabs API response
- `extracted_data` - Processed qualification data

This design provides both query performance and flexibility for future changes.

### Extracted Data Fields

The system automatically extracts and stores:

```json
{
  "firstName": "John",
  "lastName": "Shoust", 
  "phoneNumber": "416-356-7310",
  "cdlA": true,
  "experience24Months": true,
  "hopperExperience": true,
  "otrAvailable": true,
  "cleanRecord": true,
  "workEligible": true,
  "interviewSchedule": "July 28, 4PM",
  "callDuration": 148,
  "callCost": 522,
  "callSuccessful": true,
  "qualified": true
}
```

### Raw Data Storage

Complete ElevenLabs API response stored in `raw_data` JSONB field includes:
- Full transcript with timestamps
- Complete data collection results
- Call metadata and metrics
- LLM usage statistics

## 🖥️ User Interface

### Call Records Data Table

Access the data table at: `http://your-domain.com/screener`

**Features:**
- **Dynamic table structure** that adapts to your questions
- **Compact view** (default): Shows caller ID, name, phone, question results, pass/fail
- **Expanded view**: Detailed responses, analysis, call metrics, and raw data
- **Real-time updates** every 5 seconds
- **Server-side search** by name, phone, or conversation ID
- **Pass/Fail determination** based on key qualifications
- **Question auto-detection** from API response structure

### Data Table Structure

**Compact View Columns:**
- **Caller ID** - Sequential database number (#1, #2, etc.)
- **First Name** - Direct from database  
- **Last Name** - Direct from database
- **Phone Number** - Direct from database
- **Question Columns** - Dynamic based on your API response (✅/❌ icons)
- **Agent Result** - PASS/FAIL based on qualification logic
- **Timestamp** - Call completion time

**Expanded View Details:**
- **Contact Info** - Name, phone, conversation ID
- **Call Details** - Duration, cost, status  
- **Schedule** - Interview scheduling information
- **Question Responses** - Full text responses with AI analysis
- **Raw API Data** - Complete ElevenLabs response (collapsible)

## 🔍 API Endpoints

### New Endpoints

```bash
# Get call records (filtered by agent)
GET /api/call-records?agent_id=agent_01k076swcgekzt88m03gegfgsr&limit=50

# Get specific call record
GET /api/call-records/{conversationId}

# Webhook endpoint (processes inbound calls)
POST /api/inbound
```

### Legacy Endpoints (still available)

```bash
# Legacy candidates endpoint
GET /api/candidates

# ElevenLabs integration
GET /api/elevenlabs/conversations
GET /api/elevenlabs/conversations/{id}
```

## 🚨 Key Improvements

### 1. Agent Filtering
- Only processes calls from `agent_01k076swcgekzt88m03gegfgsr`
- Ignores calls from other agents
- Logs filtering decisions for debugging

### 2. Automatic API Integration
- Webhook triggers immediate API call to ElevenLabs
- Fetches complete conversation details
- Stores full API response for later analysis

### 3. JSONB Storage
- Flexible schema - no database migrations needed for new fields
- Stores complete raw API response
- Extracted data for quick queries
- Indexed for performance

### 4. Professional UI
- Call center style interface
- Real-time updates
- Color-coded qualification status
- Expandable detail views

## 🔧 Troubleshooting

### Webhook Not Triggering

1. Check ElevenLabs webhook configuration
2. Verify webhook URL is accessible
3. Check server logs for webhook signature errors

### No Data Extracted

1. Verify agent ID matches exactly: `agent_01k076swcgekzt88m03gegfgsr`
2. Check ElevenLabs API key permissions
3. Review extraction logic in `server/storage.ts`

### Database Issues

1. Ensure `call_records` table exists
2. Check database connection string
3. Verify JSONB support in PostgreSQL

## 📈 Monitoring

### Webhook Logs

Monitor webhook processing:

```bash
# Server logs show:
# - Agent filtering decisions
# - API call success/failure
# - Data extraction results
# - Storage confirmation
```

### Call Record Statistics

Query call statistics:

```sql
-- Qualified calls today
SELECT COUNT(*) FROM call_records 
WHERE extracted_data->>'qualified' = 'true' 
AND created_at >= CURRENT_DATE;

-- Average call duration
SELECT AVG((extracted_data->>'callDuration')::integer) 
FROM call_records;

-- Top phone numbers
SELECT extracted_data->>'phoneNumber', COUNT(*) 
FROM call_records 
GROUP BY extracted_data->>'phoneNumber';
```

## ✅ Testing

### Test Webhook Manually

```bash
curl -X POST http://localhost:5000/api/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "conversation_id": "test_conv_123",
      "agent_id": "agent_01k076swcgekzt88m03gegfgsr"
    }
  }'
```

Expected response:
```json
{
  "status": "processed",
  "callRecord": {
    "id": 1,
    "conversationId": "test_conv_123",
    "agentId": "agent_01k076swcgekzt88m03gegfgsr",
    "extractedData": { ... }
  }
}
```

## 🎉 Success Criteria

The system is working correctly when:

1. ✅ Webhooks only process calls from target agent
2. ✅ API calls fetch complete conversation details
3. ✅ Data is stored in JSONB format with extracted fields
4. ✅ Screener UI shows real-time call records
5. ✅ Qualified candidates trigger email notifications
6. ✅ Search and filtering work properly

The system now provides a complete, automated pipeline for monitoring and screening inbound calls from your specific ElevenLabs agent! 