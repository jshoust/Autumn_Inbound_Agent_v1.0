import React, { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Clock, FileText, ChevronDown, HelpCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Candidate } from "@shared/schema";
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface CandidatesAgGridProps {
  candidates: Candidate[];
  isLoading: boolean;
  onViewTranscript: (candidate: Candidate) => void;
  onRefetch: () => void;
}

// Helper: render check, x, or dash for Q columns
function StatusIcon({ value }: { value: any }) {
  if (value === true || value === 'true') {
    return <span style={{ color: '#168821', fontSize: 22 }}>✅</span>;
  }
  if (value === false || value === 'false') {
    return <span style={{ color: '#c00', fontSize: 22 }}>❌</span>;
  }
  if (value === 'Not Asked' || value === null || value === undefined) {
    return <span style={{ color: '#aaa', fontSize: 18 }}>⏳</span>;
  }
  return <span style={{ color: '#aaa', fontSize: 18 }}>—</span>;
}

// Detail Cell Renderer for expanded rows
function DetailCellRenderer({ data, onViewTranscript, qualifyMutation }: any) {
  const candidate = data._meta;
  const allData = data._all;
  
  // Extract and format the questions and responses dynamically
  const getFormattedResponses = () => {
    if (!allData || Object.keys(allData).length === 0) {
      console.log('=== EXPANDED VIEW DEBUG ===');
      console.log('allData is empty or null:', allData);
      return [];
    }
    
    console.log('=== EXPANDED VIEW DEBUG ===');
    console.log('allData keys:', Object.keys(allData));
    console.log('allData:', allData);
    
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
    
    const responses: Array<{ question: string; answer: any; type: string; key: string; rationale?: string; response?: string }> = [];
    
    // Process each question
    questions.forEach(q => {
      const questionData = allData[q.key];
      const responseData = q.responseKey ? allData[q.responseKey] : null;
      
      console.log(`Processing ${q.key}:`, { questionData, responseData });
      
      if (questionData) {
        let displayValue = questionData.value;
        let rationale = questionData.rationale || '';
        let response = responseData?.value || '';
        
        // Format boolean responses
        if (questionData.json_schema?.type === 'boolean') {
          displayValue = questionData.value === true ? '✅ Yes' : questionData.value === false ? '❌ No' : '⏳ Not Asked';
        }
        
        responses.push({
          question: q.questionText,
          answer: displayValue,
          type: questionData.json_schema?.type || 'text',
          key: q.key,
          rationale: rationale,
          response: response
        });
      } else {
        // Question wasn't asked/answered
        responses.push({
          question: q.questionText,
          answer: '⏳ Not Asked',
          type: 'boolean',
          key: q.key,
          rationale: 'This question was not asked during the call.',
          response: ''
        });
      }
    });
    
    // Add basic info if available
    const basicInfo = ['First_Name', 'Last_Name', 'Phone_number'];
    basicInfo.forEach(key => {
      const item = allData[key];
      if (item) {
        responses.unshift({
          question: key.replace('_', ' '),
          answer: item.value,
          type: item.json_schema?.type || 'text',
          key: key,
          rationale: item.rationale || '',
          response: ''
        });
      }
    });
    
    console.log('Final responses:', responses);
    return responses;
  };

  const formattedResponses = getFormattedResponses();
  
  return (
    <div className="w-full bg-white border-t border-slate-200 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call History Questions & Responses */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="font-semibold text-slate-800 text-lg">📞 Call Details & Responses</h4>
            <div className="text-sm text-slate-500">
              {new Date(candidate.createdAt).toLocaleString()}
            </div>
          </div>
          
          {formattedResponses.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {formattedResponses.map((item, index) => (
                <div key={item.key} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm font-semibold text-slate-700">
                      {item.key.includes('question') ? item.key.replace('_', ' ').replace(/([A-Z])/g, ' $1').trim() : item.key.replace('_', ' ')}:
                    </div>
                    <div className={`text-sm font-medium px-2 py-1 rounded ${
                      item.type === 'boolean' 
                        ? item.answer.includes('✅') 
                          ? 'bg-green-100 text-green-800' 
                          : item.answer.includes('❌')
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.answer}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    <strong>Question:</strong> {item.question}
                  </div>
                  {item.response && (
                    <div className="text-sm text-slate-700 mb-2 bg-white p-2 rounded border">
                      <strong>Response:</strong> "{item.response}"
                    </div>
                  )}
                  {item.rationale && (
                    <div className="text-xs text-slate-500 bg-white p-2 rounded border">
                      <strong>AI Analysis:</strong> {item.rationale}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
              <div className="text-lg mb-2">📋 No Call Data Available</div>
              <div className="text-sm">The call data may not have been fully processed or stored</div>
              <div className="text-xs mt-2 text-slate-400">
                Check the raw data below for more information
              </div>
            </div>
          )}
        </div>
        
        {/* Actions & Summary */}
        <div className="lg:col-span-1">
          <div className="bg-slate-50 rounded-lg p-4 space-y-4">
            <div>
              <h5 className="font-semibold text-slate-700 text-base mb-3">📋 Candidate Summary</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Name:</span>
                  <span className="font-medium text-slate-800">
                    {candidate.firstName} {candidate.lastName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Phone:</span>
                  <span className="font-medium text-slate-800">{candidate.phone}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Call ID:</span>
                  <span className="font-mono text-xs text-slate-600">
                    {candidate.conversationId}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Status:</span>
                  <span className={`font-medium px-2 py-1 rounded text-xs ${
                    candidate.qualified === true 
                      ? 'bg-green-100 text-green-800' 
                      : candidate.qualified === false 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {candidate.qualified === true ? '✅ Qualified' : 
                     candidate.qualified === false ? '❌ Not Qualified' : '⏳ Pending'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="border-t border-slate-200 pt-4">
              <h5 className="font-semibold text-slate-700 text-base mb-3">🔧 Actions</h5>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onViewTranscript(candidate)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Full Transcript
                </Button>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: true })}
                    disabled={candidate.qualified === true}
                  >
                    ✅ Qualify
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: false })}
                    disabled={candidate.qualified === false}
                  >
                    ❌ Reject
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Raw Data Toggle */}
            <div className="border-t border-slate-200 pt-4">
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                  🔍 Raw Data
                </summary>
                <div className="mt-2 p-2 bg-white rounded border text-xs font-mono overflow-auto max-h-32">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(allData, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Status Badge Cell Renderer
function StatusBadgeRenderer({ value }: any) {
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



export default function CandidatesAgGrid({
  candidates,
  isLoading,
  onViewTranscript,
  onRefetch
}: CandidatesAgGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const qualifyMutation = useMutation({
    mutationFn: async ({ id, qualified }: { id: number; qualified: boolean }) => {
      return await apiRequest('POST', `/api/candidates/${id}/qualify`, { qualified });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Success",
        description: "Candidate status updated successfully",
      });
      onRefetch();
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to update candidate status",
        variant: "destructive",
      });
    },
  });

  // Defensive: if a single object passed, wrap as array
  const candidateList = Array.isArray(candidates) ? candidates : [candidates];

  // Debug: Log the incoming data
  console.log('=== CANDIDATES DATA ===');
  console.log('Candidates count:', candidateList.length);
  if (candidateList.length > 0) {
    console.log('First candidate:', candidateList[0]);
    console.log('First candidate rawConversationData:', candidateList[0]?.rawConversationData);
    console.log('First candidate data_collection_results:', candidateList[0]?.rawConversationData?.analysis?.data_collection_results);
  }

  // Build rows: one per candidate with expansion rows
  const rowData = useMemo(() => {
    const rows: any[] = [];
    
    candidateList.forEach((cand, idx) => {
      // Get data from the correct location in the API response
      const results = cand?.rawConversationData?.analysis?.data_collection_results || {};
      
      // Debug: Log the data for each candidate
      console.log(`=== CANDIDATE ${idx} DATA ===`);
      console.log('Candidate:', cand.id);
      console.log('Raw conversation data:', cand?.rawConversationData);
      console.log('Analysis results:', results);
      console.log('Available keys:', Object.keys(results));
      
      const getField = (field: string) => {
        const entry = results[field];
        const value = entry ? entry.value : null;
        console.log(`Field ${field}:`, value);
        return value;
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
      
      console.log('Question columns:', questionColumns);
      
      // Main row
      const mainRow = {
        id: idx,
        name: `${cand.firstName || getField('First_Name') || ''} ${cand.lastName || getField('Last_Name') || ''}`.trim() || 'Unknown',
        phone: cand.phone || getField('Phone_number') || 'No phone',
        callTime: new Date(cand.createdAt).toLocaleString(),
        callStatus: callStatus,
        qualified: cand.qualified,
        ...questionColumns,
        _all: results,
        _meta: cand,
        _isExpanded: false,
        _rowType: 'main'
      };
      
      rows.push(mainRow);
      
      // Add expansion row if this row is expanded
      if (expandedRows.has(idx)) {
        const expandedRow = {
          id: `${idx}_expanded`,
          name: '',
          phone: '',
          callTime: '',
          callStatus: '',
          qualified: null,
          Q1: '',
          Q2: '',
          Q3: '',
          Q4: '',
          Q5: '',
          Q6: '',
          _all: results,
          _meta: cand,
          _isExpanded: true,
          _rowType: 'expanded',
          _parentId: idx
        };
        rows.push(expandedRow);
      }
    });
    
    return rows;
  }, [candidateList, expandedRows]);

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

  // Full-width cell renderer for expanded rows
  const FullWidthCellRenderer = (params: any) => {
    return (
      <DetailCellRenderer 
        data={params.data} 
        onViewTranscript={onViewTranscript} 
        qualifyMutation={qualifyMutation} 
      />
    );
  };

  // Check if a row should be full-width (expanded rows)
  const isFullWidthRow = (rowNode: any) => {
    return rowNode.data && rowNode.data._rowType === 'expanded';
  };

  // Custom cell renderer for regular rows
  const CellRenderer = (params: any) => {
    const { data, colDef } = params;
    
    // Regular row rendering (expanded rows are handled by FullWidthCellRenderer)
    if (colDef.field === 'expand') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-auto hover:bg-slate-100"
          onClick={() => toggleRowExpansion(data.id)}
          title={expandedRows.has(data.id) ? 'Collapse details' : 'Expand details'}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${expandedRows.has(data.id) ? 'rotate-180' : ''}`} />
        </Button>
      );
    }
    
    if (colDef.field === 'callTime' && data._meta) {
      const date = new Date(data._meta.createdAt);
      return (
        <div className="text-sm">
          <div>{date.toLocaleDateString()}</div>
          <div className="text-xs text-slate-500">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      );
    }
    
    // Handle question columns (Q1-Q6)
    if (['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'].includes(colDef.field)) {
      return <StatusIcon value={params.value} />;
    }
    
    if (colDef.field === 'qualified') {
      return <StatusBadgeRenderer value={params.value} />;
    }
    
    return params.value;
  };

  // Build AG Grid columns
  const columnDefs = useMemo(() => [
    { 
      headerName: '🔽', 
      field: 'expand',
      width: 50,
      cellRenderer: CellRenderer,
      sortable: false,
      filter: false,
      resizable: false,
      headerTooltip: 'Click to expand for detailed view'
    },
    { 
      headerName: 'ID', 
      field: 'id', 
      width: 60,
      minWidth: 50,
      cellRenderer: (params: any) => `#${params.value + 1}`,
      headerTooltip: 'Caller ID (sequential)'
    },
    { 
      headerName: 'Name', 
      field: 'name', 
      width: 150,
      minWidth: 120,
      cellRenderer: CellRenderer,
      headerTooltip: 'Candidate full name'
    },
    { 
      headerName: 'Phone', 
      field: 'phone', 
      width: 130,
      minWidth: 110,
      cellRenderer: CellRenderer,
      headerTooltip: 'Contact phone number'
    },
    { 
      headerName: 'Call Time', 
      field: 'callTime', 
      width: 140,
      minWidth: 120,
      cellRenderer: CellRenderer,
      headerTooltip: 'Call completion timestamp'
    },
    {
      headerName: 'Call Status',
      field: 'callStatus',
      width: 100,
      minWidth: 90,
      cellRenderer: (params: any) => {
        const status = params.value;
        if (status === 'COMPLETED') {
          return (
            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              COMPLETE
            </div>
          );
        } else if (status === 'INTERRUPTED') {
          return (
            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
              INTERRUPTED
            </div>
          );
        } else {
          return (
            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
              INCOMPLETE
            </div>
          );
        }
      },
      headerTooltip: 'Call completion status'
    },
    // Fixed question columns
    {
      headerName: 'Q1',
      field: 'Q1',
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      cellRenderer: CellRenderer,
      cellStyle: { textAlign: 'center' },
      headerTooltip: 'Do you currently have a valid Class A commercial driver\'s license?'
    },
    {
      headerName: 'Q2',
      field: 'Q2',
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      cellRenderer: CellRenderer,
      cellStyle: { textAlign: 'center' },
      headerTooltip: 'Do you have at least 24 months of experience driving a tractor-trailer?'
    },
    {
      headerName: 'Q3',
      field: 'Q3',
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      cellRenderer: CellRenderer,
      cellStyle: { textAlign: 'center' },
      headerTooltip: 'Do you have verifiable experience with hoppers?'
    },
    {
      headerName: 'Q4',
      field: 'Q4',
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      cellRenderer: CellRenderer,
      cellStyle: { textAlign: 'center' },
      headerTooltip: 'Are you able to be over the road for 3 weeks at a time?'
    },
    {
      headerName: 'Q5',
      field: 'Q5',
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      cellRenderer: CellRenderer,
      cellStyle: { textAlign: 'center' },
      headerTooltip: 'Have you had any serious traffic violations in the last 3 years?'
    },
    {
      headerName: 'Q6',
      field: 'Q6',
      width: 80,
      minWidth: 70,
      maxWidth: 90,
      cellRenderer: CellRenderer,
      cellStyle: { textAlign: 'center' },
      headerTooltip: 'Are you legally eligible to work in the United States?'
    },
    {
      headerName: 'Status',
      field: 'qualified',
      width: 100,
      minWidth: 90,
      cellRenderer: CellRenderer,
      headerTooltip: 'Qualification status (PASS/FAIL)'
    }
  ], [expandedRows]);

  // Export functions
  const exportCSV = () => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `candidates-${new Date().toISOString().split('T')[0]}.csv`
    });
  };

  // Multi-select functions
  const handleSelectionChanged = () => {
    const rows = gridRef.current?.api.getSelectedRows() || [];
    setSelectedRows(rows);
  };

  const handleBulkQualify = (qualified: boolean) => {
    selectedRows.forEach(row => {
      const candidate = row._meta;
      qualifyMutation.mutate({ id: candidate.id, qualified });
    });
    setSelectedRows([]);
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
      {/* Debug Info - Show raw data structure */}
      {candidateList.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">🔍 Debug: Data Structure</h3>
          <p className="text-sm text-blue-700 mb-3">
            Raw data structure for first candidate:
          </p>
          <div className="bg-white p-3 rounded border text-xs font-mono overflow-auto max-h-32">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify({
                id: candidateList[0].id,
                rawConversationData: candidateList[0].rawConversationData,
                dataCollection: candidateList[0].dataCollection,
                extractedData: candidateList[0].extractedData
              }, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      {/* Table Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Call Records</h2>
            <p className="text-sm text-slate-600">
              {candidateList.length} total records • Auto-refresh every 5 seconds
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Expand/Collapse Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (expandedRows.size === candidateList.length) {
                  setExpandedRows(new Set());
                } else {
                  setExpandedRows(new Set(candidateList.map((_, idx) => idx)));
                }
              }}
              className="text-xs"
            >
              {expandedRows.size === candidateList.length ? 'Collapse All' : 'Expand All'}
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

      {/* AG Grid */}
      <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          theme="legacy"
          defaultColDef={{
            resizable: true,
            sortable: true,
            filter: true,
            wrapText: false,
            autoHeight: false,
            flex: 0
          }}
          rowSelection={{ 
            mode: "multiRow", 
            checkboxes: true, 
            enableClickSelection: false, 
            headerCheckbox: true
          }}
          selectionOptions={{
            isRowSelectable: (params) => params.data._rowType !== 'expanded'
          }}
          onSelectionChanged={handleSelectionChanged}
          isFullWidthRow={isFullWidthRow}
          fullWidthCellRenderer={FullWidthCellRenderer}
          getRowHeight={(params) => {
            return params.data._rowType === 'expanded' ? 400 : 50;
          }}
          headerHeight={45}
          suppressHorizontalScroll={false}
          getRowStyle={(params) => {
            if (params.data._rowType === 'expanded') {
              return { backgroundColor: '#ffffff', border: 'none' };
            }
            return {};
          }}
          onFirstDataRendered={() => {
            gridRef.current?.api.sizeColumnsToFit();
          }}
        />
      </div>
    </div>
  );
}