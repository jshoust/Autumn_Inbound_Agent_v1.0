import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronDown,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CallRecord {
  id: number;
  conversationId: string;
  agentId: string;
  status: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  qualified?: boolean;
  rawData: any;
  extractedData: any;
  createdAt: string;
}

interface QuestionColumn {
  key: string;
  label: string;
  valueKey: string;
  responseKey?: string;
}

function getQuestionColumns(records: CallRecord[]): QuestionColumn[] {
  const columns: QuestionColumn[] = [];
  const seenKeys = new Set<string>();
  
  // Ensure records is an array before processing
  if (!Array.isArray(records)) {
    return columns;
  }
  
  // Extract all unique question keys from the data
  records.forEach(record => {
    const dataCollection = record.rawData?.analysis?.data_collection_results || {};
    
    Object.keys(dataCollection).forEach(key => {
      // Skip basic info fields
      if (['First_Name', 'Last_Name', 'Phone_number'].includes(key)) return;
      
      const baseKey = key.replace('_response', '').replace('_reponse', ''); // Handle typo
      
      if (!seenKeys.has(baseKey)) {
        seenKeys.add(baseKey);
        
        // Find corresponding response key
        const responseKey = Object.keys(dataCollection).find(k => 
          (k === `${baseKey}_response` || k === `${baseKey}_reponse`) && k !== key
        );
        
        columns.push({
          key: baseKey,
          label: formatQuestionLabel(baseKey),
          valueKey: key,
          responseKey: responseKey
        });
      }
    });
  });
  
  return columns.sort((a, b) => a.label.localeCompare(b.label));
}

function formatQuestionLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace('Question ', 'Q')
    .trim();
}

function BooleanCell({ value }: { value: any }) {
  if (value === true) {
    return <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />;
  } else if (value === false) {
    return <XCircle className="w-4 h-4 text-red-600 mx-auto" />;
  }
  return <Clock className="w-4 h-4 text-gray-400 mx-auto" />;
}

function PassFailBadge({ record }: { record: CallRecord }) {
  const dataCollection = record.rawData?.analysis?.data_collection_results || {};
  
  // Agent determination logic based on key qualifications
  const hasCDL = dataCollection.question_one?.value === true;
  const hasExperience = dataCollection.Question_two?.value === true;
  const cleanRecord = dataCollection.question_five?.value === true; // No violations = true
  const workEligible = dataCollection.question_six?.value === true;
  
  const passed = hasCDL && hasExperience && cleanRecord && workEligible;
  
  return (
    <Badge variant={passed ? "default" : "destructive"} className="text-xs">
      {passed ? "PASS" : "FAIL"}
    </Badge>
  );
}

function ExpandableRow({ record, columns, isExpanded, onToggle }: {
  record: CallRecord;
  columns: QuestionColumn[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const dataCollection = record.rawData?.analysis?.data_collection_results || {};
  
  return (
    <>
      <TableRow className="hover:bg-gray-50">
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-1 h-6 w-6"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">#{record.id}</TableCell>
        <TableCell>{record.firstName || '-'}</TableCell>
        <TableCell>{record.lastName || '-'}</TableCell>
        <TableCell className="font-mono text-sm">{record.phone || '-'}</TableCell>
        
        {/* Question columns - compact view shows just boolean values */}
        {columns.map(col => (
          <TableCell key={col.key} className="text-center">
            <BooleanCell value={dataCollection[col.valueKey]?.value} />
          </TableCell>
        ))}
        
        <TableCell>
          <PassFailBadge record={record} />
        </TableCell>
        <TableCell className="text-xs text-gray-500">
          {new Date(record.createdAt).toLocaleString()}
        </TableCell>
      </TableRow>
      
      {/* Expanded row with detailed responses */}
      {isExpanded && (
        <TableRow className="bg-gray-50">
          <TableCell colSpan={columns.length + 6}>
            <div className="p-4 space-y-4">
              {/* Contact Details */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Contact Info</h4>
                  <p><strong>Name:</strong> {record.firstName} {record.lastName}</p>
                  <p><strong>Phone:</strong> {record.phone}</p>
                  <p><strong>Conversation ID:</strong> {record.conversationId}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">Call Details</h4>
                  <p><strong>Duration:</strong> {record.rawData?.metadata?.call_duration_secs}s</p>
                  <p><strong>Cost:</strong> ${(record.rawData?.metadata?.cost / 100).toFixed(2)}</p>
                  <p><strong>Status:</strong> {record.status}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">Schedule</h4>
                  <p><strong>Interview:</strong> {dataCollection.schedule?.value || 'Not scheduled'}</p>
                </div>
              </div>
              
              {/* Detailed Question Responses */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Question Responses</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {columns.map(col => {
                    const question = dataCollection[col.valueKey];
                    const response = col.responseKey ? dataCollection[col.responseKey] : null;
                    
                    return (
                      <div key={col.key} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <BooleanCell value={question?.value} />
                          <span className="font-medium text-sm">{col.label}</span>
                        </div>
                        {question?.json_schema?.description && (
                          <p className="text-xs text-gray-600 mb-2">
                            {question.json_schema.description}
                          </p>
                        )}
                        {response && (
                          <p className="text-sm bg-white p-2 rounded border">
                            <strong>Response:</strong> "{response.value}"
                          </p>
                        )}
                        {question?.rationale && (
                          <p className="text-xs text-gray-500 mt-1">
                            <strong>Analysis:</strong> {question.rationale}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Raw Data Toggle */}
              <details className="mt-4">
                <summary className="cursor-pointer font-semibold text-sm">Raw API Data</summary>
                <pre className="mt-2 p-3 bg-white border rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(record.rawData, null, 2)}
                </pre>
              </details>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const { data: callRecords = [], isLoading, error, refetch } = useQuery<CallRecord[]>({
    queryKey: ['/api/candidates', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      const response = await fetch(`/api/candidates?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch candidates: ${response.status}`);
      }
      const data = await response.json();
      
      // Convert candidates data to CallRecord format
      return Array.isArray(data) ? data.map((candidate: any) => ({
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

  // Ensure callRecords is always an array before processing
  const safeCallRecords = Array.isArray(callRecords) ? callRecords : [];
  const questionColumns = getQuestionColumns(safeCallRecords);

  const toggleRow = (recordId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRows(newExpanded);
  };

  const toggleAllRows = () => {
    if (expandedRows.size === safeCallRecords.length) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(new Set(safeCallRecords.map(r => r.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading call records...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-red-600">Error loading data: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Call Records Data Table</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Agent: agent_01k076swcgekzt88m03gegfgsr | {safeCallRecords.length} records (from candidates table)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={toggleAllRows} variant="outline" size="sm">
                    {expandedRows.size === safeCallRecords.length ? 'Collapse All' : 'Expand All'}
                  </Button>
                  <Button onClick={() => refetch()} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="flex gap-4 items-center mb-4">
                <Input
                  placeholder="Search by name, phone, or conversation ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />
                <div className="text-sm text-muted-foreground">
                  {safeCallRecords.length} record(s) found
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-100">
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="w-20">Caller ID</TableHead>
                        <TableHead>First Name</TableHead>
                        <TableHead>Last Name</TableHead>
                        <TableHead>Phone Number</TableHead>
                        
                        {questionColumns.map(col => (
                          <TableHead key={col.key} className="text-center min-w-20">
                            {col.label}
                          </TableHead>
                        ))}
                        
                        <TableHead className="text-center">Agent Result</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {safeCallRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={questionColumns.length + 6} className="text-center py-8">
                            <p className="text-muted-foreground">
                              No call records found. Records will appear here automatically when calls are completed.
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        safeCallRecords.map((record) => (
                          <ExpandableRow
                            key={record.id}
                            record={record}
                            columns={questionColumns}
                            isExpanded={expandedRows.has(record.id)}
                            onToggle={() => toggleRow(record.id)}
                          />
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}