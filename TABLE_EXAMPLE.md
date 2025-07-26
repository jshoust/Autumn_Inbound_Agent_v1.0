# Call Records Table - Visual Example

## 📊 **TABLE PREVIEW**

Based on your API response data, here's what the table will look like:

### **Compact View (Default)**

| 🔽 | Caller ID | First Name | Last Name | Phone Number | Q One | Q Two | Q Three | Q Four | Q Five | Q Six | Agent Result | Timestamp |
|----|-----------|------------|-----------|--------------|-------|-------|---------|--------|--------|-------|--------------|-----------|
| ▶️ | #47 | John | Shoust | 416-356-7310 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** | 1/25 6:49 PM |
| ▶️ | #48 | Sarah | Johnson | 555-123-4567 | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | **FAIL** | 1/25 7:15 PM |
| ▶️ | #49 | Mike | Davis | 888-999-0000 | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | **FAIL** | 1/25 7:32 PM |

### **Expanded View Example (Click ▶️ to expand)**

When you click the expand arrow for John Shoust (#47):

```
┌─ EXPANDED ROW ─────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  📞 Contact Info          🕐 Call Details           📅 Schedule                   │
│  Name: John Shoust        Duration: 148s            Interview: July 28, 4PM       │
│  Phone: 416-356-7310     Cost: $5.22                                             │
│  Conversation ID: conv_7801k11zpsp8f2yr903tqchvahv1  Status: done                │
│                                                                                    │
│  📋 Question Responses                                                            │
│  ┌─ Question One ──────────────────────────────────────────────────────────────┐  │
│  │ ✅ Q One                                                                    │  │
│  │ "Do you currently have a valid Class A commercial driver's license?"       │  │
│  │ Response: "Yes"                                                             │  │
│  │ Analysis: The user was asked 'Do you currently have a valid Class A        │  │
│  │ commercial driver's license?' and the user responded with 'Yes'.           │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                    │
│  ┌─ Question Two ──────────────────────────────────────────────────────────────┐  │
│  │ ✅ Q Two                                                                    │  │  
│  │ "Do you have at least 24 months of experience driving a tractor-trailer?" │  │
│  │ Response: "Yes"                                                             │  │
│  │ Analysis: The agent asks "do you have at least twenty-four months of       │  │
│  │ experience driving a tractor-trailer?" and the user responds with "Yes".   │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                    │
│  [Show more questions...]                                                         │
│                                                                                    │
│  ▼ Raw API Data                                                                   │
│  {                                                                                │
│    "agent_id": "agent_01k076swcgekzt88m03gegfgsr",                               │
│    "conversation_id": "conv_7801k11zpsp8f2yr903tqchvahv1",                       │
│    "analysis": {                                                                  │
│      "data_collection_results": { ... }                                          │
│    }                                                                              │
│  }                                                                                │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## 🎯 **DYNAMIC COLUMN DETECTION**

The table automatically detects these columns from your API response:

```json
// From your API response data_collection_results:
{
  "question_one": { "value": true },           // → "Q One" column
  "question_one_response": { "value": "Yes" }, // → Used in expanded view
  "Question_two": { "value": true },           // → "Q Two" column  
  "question_two_response": { "value": "Yes" }, // → Used in expanded view
  "Question_three": { "value": true },         // → "Q Three" column
  "question_three_response": { "value": "Yep" }, // → Used in expanded view
  "question_four": { "value": true },          // → "Q Four" column
  "Question_four_response": { "value": "Yes" }, // → Used in expanded view
  "question_five": { "value": true },          // → "Q Five" column
  "question_five_reponse": { "value": "No" },  // → Used in expanded view (typo handled)
  "question_six": { "value": true },           // → "Q Six" column
  "schedule": { "value": "July 28, 4PM" },     // → Used in expanded view
  "First_Name": { "value": "John" },           // → First Name column
  "Last_Name": { "value": "Shoust" },          // → Last Name column
  "Phone_number": { "value": "416-356-7310" } // → Phone Number column
}
```

## 🔍 **VISUAL INDICATORS**

- ✅ **Green Check** = `true` / Positive answer
- ❌ **Red X** = `false` / Negative answer  
- ⏱️ **Clock** = `null` / No answer recorded
- 🟢 **PASS Badge** = Meets all key qualifications
- 🔴 **FAIL Badge** = Missing key qualifications

## 🎮 **INTERACTIVE FEATURES**

1. **Search Bar**: Type "John" or "416" to filter
2. **Expand Buttons**: Click ▶️ to see full details
3. **Expand All/Collapse All**: Bulk expand/collapse
4. **Auto-refresh**: Updates every 5 seconds
5. **Horizontal Scroll**: Handle many questions gracefully

## 🎯 **PASS/FAIL LOGIC**

```typescript
// Agent determination
const passed = 
  question_one === true &&      // Has CDL-A
  Question_two === true &&      // 24+ months experience  
  question_five === true &&     // Clean driving record
  question_six === true;        // Work eligible
  
// Result: PASS ✅ or FAIL ❌
```

This gives you a **complete data overview** that's both compact and detailed, exactly as requested! 