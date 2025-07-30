import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, FileText, Calendar, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Candidate {
  id: number;
  conversationId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  qualified: boolean | null;
  agentId: string;
  createdAt: string;
  transcript: any[];
  dataCollection: any;
  rawConversationData: {
    analysis: {
      data_collection_results: any;
    };
    transcript: any[];
  };
}

interface CandidatesAgGridProps {
  candidates: Candidate[];
  isLoading: boolean;
  onViewTranscript: (candidate: Candidate) => void;
  onRefetch: () => void;
}

// Helper: render check, x, or dash for Q columns
const StatusIcon = ({ value }: { value: boolean | string | null }) => {
  if (value === true || value === "TRUE" || value === "true") {
    return <span className="text-green-600 font-medium">Pass</span>;
  } else if (value === false || value === "FALSE" || value === "false") {
    return <span className="text-red-600 font-medium">Fail</span>;
  } else if (value === "Not Asked") {
    return <span className="text-gray-500 font-medium">Not Asked</span>;
  } else {
    return <span className="text-gray-400">-</span>;
  }
};

// Status badge renderer
function StatusBadgeRenderer({ value }: { value: any }) {
  if (value === true) {
    return (
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
        PASS
      </div>
    );
  } else if (value === false) {
  return (
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
        <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
        FAIL
              </div>
    );
  } else {
    return (
      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
        PENDING
        </div>
    );
  }
}

// Expanded row component
function ExpandedRow({ candidate }: { candidate: Candidate }) {
  const allData = candidate.rawConversationData?.analysis?.data_collection_results || {};
  
  // Define the 6 questions with their keys and descriptions
  const questions = [
    {
      key: 'question_one',
      label: 'Q1: CDL License',
      questionText: 'Do you currently have a valid Class A commercial driver\'s license?',
      responseKey: 'question_one_response'
    },
    {
      key: 'Question_two',
      label: 'Q2: Experience',
      questionText: 'Do you have at least 24 months of experience driving a tractor-trailer?',
      responseKey: 'question_two_response'
    },
    {
      key: 'Question_three',
      label: 'Q3: Hopper Experience',
      questionText: 'Do you have verifiable experience with hoppers?',
      responseKey: 'question_three_response'
    },
    {
      key: 'question_four',
      label: 'Q4: OTR Available',
      questionText: 'Are you able to be over the road for 3 weeks at a time?',
      responseKey: 'Question_four_response'
    },
    {
      key: 'question_five',
      label: 'Q5: Clean Record',
      questionText: 'Have you had any serious traffic violations in the last 3 years?',
      responseKey: 'question_five_response'
    },
    {
      key: 'question_six',
      label: 'Q6: Work Eligible',
      questionText: 'Are you legally eligible to work in the United States?',
      responseKey: null
    }
  ];

  const formattedResponses = questions.map(q => {
    const questionData = allData[q.key];
    const responseData = q.responseKey ? allData[q.responseKey] : null;
    
    if (questionData) {
      let displayValue = questionData.value;
      let response = responseData?.value || '';
        
        // Format boolean responses
      if (questionData.json_schema?.type === 'boolean') {
        displayValue = questionData.value === true ? '✅ Yes' : questionData.value === false ? '❌ No' : '⏳ Not Asked';
      }
      
      return {
        question: q.questionText,
          answer: displayValue,
        response: response,
        key: q.key
      };
    } else {
      return {
        question: q.questionText,
        answer: '⏳ Not Asked',
        response: '',
        key: q.key
      };
    }
  });
  
  return (
    <div className="w-full bg-white border-t border-slate-200 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <h4 className="font-semibold text-slate-800 text-xl">📞 Call Questions & Responses</h4>
          <div className="text-sm text-slate-500">
              {new Date(candidate.createdAt).toLocaleString()}
            </div>
          </div>
          
                     {formattedResponses.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
              {formattedResponses.map((item, index) => (
              <div key={item.key} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-lg font-semibold text-slate-700">
                    {item.label}
                  </div>
                  <div className={`text-sm font-medium px-3 py-1 rounded ${
                    item.answer.includes('✅') 
                      ? 'bg-green-100 text-green-800' 
                      : item.answer.includes('❌')
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.answer}
                  </div>
                </div>
                <div className="text-sm text-slate-600 mb-2">
                  <strong>Question:</strong> {item.question}
                </div>
                {item.response && (
                  <div className="text-sm text-slate-700 bg-white p-3 rounded border">
                    <strong>Caller's Response:</strong> "{item.response}"
                  </div>
                )}
              </div>
            ))}
            </div>
        ) : (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
            <div className="text-lg mb-2">📋 No Call Data Available</div>
            <div className="text-sm">The call data may not have been fully processed or stored</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CandidatesAgGrid({
  candidates,
  isLoading,
  onViewTranscript,
  onRefetch
}: CandidatesAgGridProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const queryClient = useQueryClient();

  // Qualification mutation
  const qualifyMutation = useMutation({
    mutationFn: async ({ id, qualified }: { id: number; qualified: boolean }) => {
      const response = await fetch(`/api/candidates/${id}/qualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualified })
      });
      if (!response.ok) throw new Error('Failed to update qualification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  // Auto-booking mutation
  const autoBookMutation = useMutation({
    mutationFn: async (candidate: Candidate) => {
      const response = await fetch(`/api/candidates/${candidate.id}/auto-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to auto-book candidate');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    }
  });

  // Process candidates data
  const processedCandidates = useMemo(() => {
    return candidates.map((cand, idx) => {
      const results = cand?.rawConversationData?.analysis?.data_collection_results || {};
      
      const getField = (field: string) => {
        const entry = results[field];
        return entry ? entry.value : null;
      };
      
      // Check if call was completed or interrupted
      const transcript = cand?.transcript || cand?.rawConversationData?.transcript || [];
      const isInterrupted = transcript.some((msg: any) => msg.interrupted === true);
      const hasData = Object.keys(results).length > 0;
      const callStatus = isInterrupted ? 'INTERRUPTED' : hasData ? 'COMPLETED' : 'INCOMPLETE';
      
      // Create question columns for all 6 questions - show "Not Asked" for null values
      const questionColumns = {
        Q1: getField('question_one') ?? 'Not Asked',
        Q2: getField('Question_two') ?? 'Not Asked',
        Q3: getField('Question_three') ?? 'Not Asked',
        Q4: getField('question_four') ?? 'Not Asked',
        Q5: getField('question_five') ?? 'Not Asked',
        Q6: getField('question_six') ?? 'Not Asked'
      };
      
      return {
        id: idx,
        name: `${cand.firstName || getField('First_Name') || ''} ${cand.lastName || getField('Last_Name') || ''}`.trim() || 'Unknown',
        phone: cand.phone || getField('Phone_number') || 'No phone',
        callTime: new Date(cand.createdAt).toLocaleString(),
        callStatus: callStatus,
        qualified: cand.qualified,
        ...questionColumns,
        _meta: cand
      };
    });
  }, [candidates]);

  const toggleRowExpansion = (rowId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const toggleAllExpanded = () => {
    if (expandedRows.size === processedCandidates.length) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(new Set(processedCandidates.map((_, idx) => idx)));
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Phone', 'Call Time', 'Call Status', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Status'];
    const csvContent = [
      headers.join(','),
      ...processedCandidates.map(cand => [
        cand.id + 1,
        cand.name,
        cand.phone,
        cand.callTime,
        cand.callStatus,
        cand.Q1,
        cand.Q2,
        cand.Q3,
        cand.Q4,
        cand.Q5,
        cand.Q6,
        cand.qualified
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleBulkQualify = (qualified: boolean) => {
    selectedRows.forEach(row => {
      const candidate = row._meta;
      qualifyMutation.mutate({ id: candidate.id, qualified });
    });
    setSelectedRows([]);
  };

  const handleAutoBook = (candidate: Candidate) => {
    autoBookMutation.mutate(candidate);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Call Records</h2>
            <p className="text-sm text-slate-600">
              {processedCandidates.length} total records • Auto-refresh every 5 seconds
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Expand/Collapse Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAllExpanded}
              className="text-xs"
            >
              {expandedRows.size === processedCandidates.length ? 'Collapse All' : 'Expand All'}
            </Button>
          </div>
          
          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="text-xs"
          >
            📊 Export CSV
          </Button>
          
          {/* Bulk Actions */}
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkQualify(true)}
                className="text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              >
                ✅ Qualify All ({selectedRows.length})
            </Button>
            <Button
                variant="outline"
              size="sm"
              onClick={() => handleBulkQualify(false)}
                className="text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
                ❌ Reject All ({selectedRows.length})
            </Button>
          </div>
        )}
          
          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefetch}
            className="text-xs"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Simple React Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">
                  🔽
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  ID
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-32">
                  Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-28">
                  Phone
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-32">
                  Call Time
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                  Call Status
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  Q1
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  Q2
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  Q3
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  Q4
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  Q5
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  Q6
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-20">
                  Status
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {processedCandidates.map((candidate, index) => (
                <React.Fragment key={candidate.id}>
                  <tr className="hover:bg-slate-50">
                      <td className="px-3 py-4 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1 h-auto hover:bg-slate-100"
                          onClick={() => toggleRowExpansion(candidate.id)}
                          title={expandedRows.has(candidate.id) ? 'Collapse details' : 'Expand details'}
                        >
                          {expandedRows.has(candidate.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-900">
                        #{candidate.id + 1}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-900">
                        {candidate.name}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-900">
                        {candidate.phone}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-900">
                        {candidate.callTime}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {candidate.callStatus === 'COMPLETED' ? (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                            COMPLETE
                          </div>
                        ) : candidate.callStatus === 'INTERRUPTED' ? (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                            INTERRUPTED
                          </div>
                        ) : (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                            INCOMPLETE
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <StatusIcon value={candidate.Q1} />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <StatusIcon value={candidate.Q2} />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <StatusIcon value={candidate.Q3} />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <StatusIcon value={candidate.Q4} />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <StatusIcon value={candidate.Q5} />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <StatusIcon value={candidate.Q6} />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <StatusBadgeRenderer value={candidate.qualified} />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {candidate.qualified === true && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAutoBook(candidate)}
                              disabled={autoBookMutation.isPending}
                              className="text-xs"
                              title="Auto-book interview"
                            >
                              {autoBookMutation.isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Calendar className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(candidate.id) && (
                      <tr>
                        <td colSpan={13} className="p-0">
                          <ExpandedRow candidate={candidate._meta} />
                        </td>
                      </tr>
                    )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}