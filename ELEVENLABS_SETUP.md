# ElevenLabs Integration Setup

## Overview
This application receives webhook calls from ElevenLabs Voice Agents when truck driver recruitment calls are completed. No API keys are needed in this application - ElevenLabs sends the data to your webhook endpoint.

## ElevenLabs Configuration

### 1. Get Your Webhook URL
Your webhook endpoint is: `https://your-replit-app-url.replit.app/api/inbound`

To find your exact URL:
1. Go to your Replit project
2. Click "Deploy" in the top right
3. Your URL will be shown there
4. Add `/api/inbound` to the end

### 2. Configure ElevenLabs Webhook
In your ElevenLabs account:
1. Go to your Voice Agent settings
2. Find the "Webhooks" or "Integration" section
3. Set the webhook URL to: `https://your-replit-app-url.replit.app/api/inbound`
4. Set the webhook secret to: `wsec_adbb48427559a6a30d6834a92ea98f7cc15883f6c584f136923bcab9dc9f08f4`
5. Make sure to send call completion data including:
   - `call_id`: Unique identifier for the call
   - `transcript`: Full conversation transcript
   - `phone`: Caller's phone number
   - `answers`: Structured data from the conversation

### 3. Required Data Format
Your ElevenLabs agent should structure the answers object like this:
```json
{
  "call_id": "unique-call-id",
  "transcript": "Full conversation text...",
  "phone": "+15551234567",
  "answers": {
    "cdl": true,
    "cdl_type": "CDL-A",
    "experience": "5"
  }
}
```

## Testing the Integration

### Test with Sample Data
You can test the webhook by making a POST request to:
`https://your-app-url.replit.app/api/test-webhook`

This will create a sample qualified candidate and trigger an email notification.

### Using curl to test:
```bash
curl -X POST https://your-app-url.replit.app/api/test-webhook
```

### Verify Integration
1. Watch the server logs for webhook requests
2. Check the dashboard for new candidates
3. Verify emails are sent to qualified candidates

## Qualification Logic
Candidates are automatically qualified if:
- They have a valid CDL-A license (`cdl: true` or `cdl_type: "CDL-A"`)
- They have 2+ years of driving experience (`experience >= 2`)

## Troubleshooting
- Check server logs for incoming webhook data
- Verify the webhook URL is correct in ElevenLabs
- Make sure Postmark credentials are configured for email notifications
- Test with the `/api/test-webhook` endpoint first