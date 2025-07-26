# Automatic Email Notifications Feature

## Overview

The Driver Recruiting Agent System now includes automatic email notifications that are sent immediately after every call is completed. This ensures recruiters are instantly notified when new candidates apply, allowing for faster response times and improved candidate experience.

## How It Works

### 1. Automatic Trigger
- When ElevenLabs completes a voice call with a candidate
- The webhook endpoint `/api/inbound` receives the call completion data
- After storing the call record, an automatic email is sent to the configured email address

### 2. Email Content
The automatic notification includes:
- **Subject**: "New Driver Call Completed - [Candidate Name]"
- **Status**: "CALL COMPLETED - PENDING REVIEW" 
- **Candidate Information**: Name, phone, call date
- **Call Details**: Qualification status, CDL info, experience, etc.
- **Excel Attachment**: Complete call transcript and Q&A responses
- **Action Required**: Clear notification that manual review is needed

### 3. Email Recipients
- Emails are sent to the address configured in `FROM_EMAIL` environment variable
- This is typically the recruiter or HR team's email address

## Configuration

### Environment Variables
```env
FROM_EMAIL=recruiter@yourcompany.com
POSTMARK_SERVER_TOKEN=your_postmark_token
```

### Email Template Features
- **Professional HTML Format**: Clean, branded email design
- **Mobile Responsive**: Optimized for all devices  
- **Action Alerts**: Clear visual indicators for required actions
- **Complete Data**: All call information included in both email and Excel attachment

## Benefits

### For Recruiters
- **Instant Notifications**: Know immediately when calls are completed
- **Complete Information**: All candidate data in one email
- **Excel Reports**: Detailed call transcripts for thorough review
- **Dashboard Integration**: Links to review candidates in the dashboard

### For Candidates  
- **Faster Response**: Recruiters can act on applications immediately
- **Professional Process**: Automated system ensures no applications are missed
- **Consistent Experience**: Every candidate gets the same prompt attention

## Technical Implementation

### Webhook Integration
```javascript
// Automatic email after call storage
if (process.env.FROM_EMAIL) {
  const emailResult = await postmarkService.sendCallCompletionNotification(
    process.env.FROM_EMAIL,
    callRecord
  );
}
```

### Email Service
- Uses Postmark for reliable email delivery
- Includes Excel attachment generation
- Error handling ensures webhook processing continues even if email fails
- Comprehensive logging for troubleshooting

## Testing

### Test Endpoint
- `POST /api/test-call-completion` - Test the automatic notification system
- Requires authentication
- Uses latest call record for testing

### Example Test
```bash
curl -X POST http://localhost:5000/api/test-call-completion \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"to": "test@example.com"}'
```

## Monitoring

### Logs
- All email sends are logged with MessageID for tracking
- Failed sends are logged with error details
- Webhook processing continues even if email fails

### Success Indicators
- ✅ Email sent successfully with MessageID
- 📧 Excel attachment included
- ⚠️ Action required notification visible

## Customization

### Email Content
- Modify `sendCallCompletionNotification` in `server/postmark.ts`
- Update HTML template for branding
- Adjust notification frequency if needed

### Recipients
- Configure multiple recipients by modifying the email logic
- Add CC/BCC recipients as needed
- Set up distribution lists

## Troubleshooting

### Common Issues
1. **No emails received**: Check FROM_EMAIL and POSTMARK_SERVER_TOKEN
2. **Excel attachment missing**: Verify call record contains transcript data
3. **Webhook not triggering**: Check ElevenLabs webhook configuration

### Debug Logs
- Look for "SENDING AUTOMATIC EMAIL NOTIFICATION" in server logs
- Check for MessageID confirmation or error messages
- Verify webhook processing completes successfully

## Security

- All emails use secure Postmark delivery
- No sensitive data in email logs
- Excel attachments contain complete call data for authorized recipients only
- Environment variables protect API keys and configuration