# Alternative Solution - Dual Endpoint Support

If you want to support both old and new data sources, here's an alternative approach:

## 🔄 **DUAL ENDPOINT QUERY**

Replace the current query in `dashboard.tsx` with this version that checks both endpoints:

```typescript
const { data: callRecords = [], isLoading, error, refetch } = useQuery<CallRecord[]>({
  queryKey: ['/api/call-records', '/api/candidates', searchTerm],
  queryFn: async () => {
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    
    // Try new call_records endpoint first
    try {
      const callRecordsResponse = await fetch(`/api/call-records?${params.toString()}`);
      if (callRecordsResponse.ok) {
        const callRecordsData = await callRecordsResponse.json();
        if (Array.isArray(callRecordsData) && callRecordsData.length > 0) {
          console.log('Using new call_records data');
          return callRecordsData;
        }
      }
    } catch (error) {
      console.log('call_records endpoint failed, trying candidates');
    }
    
    // Fallback to old candidates endpoint
    const candidatesResponse = await fetch(`/api/candidates?${params.toString()}`);
    if (!candidatesResponse.ok) {
      throw new Error(`Failed to fetch data from both endpoints`);
    }
    
    const candidatesData = await candidatesResponse.json();
    console.log('Using legacy candidates data');
    
    // Convert candidates data to CallRecord format
    return Array.isArray(candidatesData) ? candidatesData.map((candidate: any) => ({
      id: candidate.id,
      conversationId: candidate.conversationId || candidate.callId,
      agentId: candidate.agentId,
      status: candidate.callStatus || 'completed',
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      phone: candidate.phone,
      qualified: candidate.qualified,
      rawData: candidate.rawConversationData || { 
        analysis: { 
          data_collection_results: candidate.dataCollection || {} 
        },
        metadata: {
          call_duration_secs: candidate.callDuration,
          cost: 0
        }
      },
      extractedData: candidate.dataCollection || {},
      createdAt: candidate.createdAt
    })) : [];
  },
  refetchInterval: 5000, // Poll every 5 seconds
});
```

## 🎯 **WEBHOOK UPDATE FOR DUAL STORAGE**

You can also update the webhook to store data in BOTH tables during the transition:

```typescript
// In server/routes.ts webhook handler
app.post('/api/inbound', async (req, res) => {
  try {
    // ... existing webhook logic ...
    
    // Store in new call_records table
    const callRecord = await storage.storeCallRecord({
      conversationId: conversation_id,
      agentId: agent_id,
      status: fullConversationData.status || 'completed',
      rawData: fullConversationData
    });
    
    // ALSO store in old candidates table for backward compatibility
    const legacyCandidate = await storage.createCandidate({
      conversationId: conversation_id,
      callId: conversation_id,
      firstName: extractedData.firstName,
      lastName: extractedData.lastName,
      phone: extractedData.phoneNumber,
      hasCdlA: extractedData.cdlA,
      hasExperience: extractedData.experience24Months,
      hasViolations: !extractedData.cleanRecord,
      hasWorkAuth: extractedData.workEligible,
      agentId: agent_id,
      callDurationSecs: extractedData.callDuration,
      transcript: JSON.stringify(fullConversationData.transcript || []),
      dataCollection: fullConversationData.analysis?.data_collection_results,
      qualified: extractedData.qualified,
      rawConversationData: fullConversationData
    });
    
    res.status(200).json({ 
      status: 'processed', 
      callRecord: callRecord,
      legacyCandidate: legacyCandidate
    });
  } catch (error) {
    // ... error handling ...
  }
});
```

This approach ensures:
- ✅ **Immediate data display** from existing candidates
- ✅ **Future compatibility** with new call_records structure  
- ✅ **Smooth transition** period
- ✅ **No data loss** during migration 