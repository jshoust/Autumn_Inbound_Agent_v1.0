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
    return <span style={{ color: '#168821', fontSize: 22 }}>✔️</span>;
  }
  if (value === false || value === 'false') {
    return <span style={{ color: '#c00', fontSize: 22 }}>❌</span>;
  }
  return <span style={{ color: '#aaa', fontSize: 18 }}>—</span>;
}

// Extract question order and metadata from one candidate
function getQuestionsMeta(candidate: any) {
  const results = candidate?.rawConversationData?.analysis?.data_collection_results || {};
  
  // Filter for question keys that contain boolean values or null (indicating questions not yet answered)
  const questionKeys = Object.keys(results).filter(key => {
    const item = results[key];
    return item?.json_schema?.type === 'boolean' && 
           (key.startsWith('question') || key.startsWith('Question'));
  });
  
  // Sort question keys to ensure consistent order (question_one, Question_two, etc.)
  const sortedKeys = questionKeys.sort((a, b) => {
    const aNum = a.toLowerCase().match(/question[_\s]*(\w+)/)?.[1];
    const bNum = b.toLowerCase().match(/question[_\s]*(\w+)/)?.[1];
    
    // Convert word numbers to numeric for proper sorting
    const numberMap: Record<string, number> = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    const aOrder = numberMap[aNum || ''] || parseInt(aNum || '0') || 999;
    const bOrder = numberMap[bNum || ''] || parseInt(bNum || '0') || 999;
    
    return aOrder - bOrder;
  });
  
  const boolQuestions = sortedKeys.map((key, idx) => {
    const item = results[key];
    return {
      key: key,
      label: `Q${idx + 1}`,
      questionText: item.json_schema?.description?.split('\n').pop()?.trim() || key
    };
  });
  
  return boolQuestions;
}

// Questions Reference Card Component
function QuestionsReferenceCard({ questionMeta, candidateList }: { questionMeta: any[], candidateList: any[] }) {
  if (questionMeta.length === 0) return null;

  // Get questions with descriptions from the first candidate with data
  const questionsWithDescriptions = useMemo(() => {
    for (const candidate of candidateList) {
      const results = candidate?.rawConversationData?.analysis?.data_collection_results || {};
      
      const questionsData = questionMeta.map(q => {
        const item = results[q.key];
        if (item?.json_schema?.description) {
          // Extract the actual question from the description (usually in quotes)
          const description = item.json_schema.description;
          
          // Extract question text and remove quotes for consistency
          let question = '';
          
          // Pattern 1: Text in double quotes (remove the quotes)
          const doubleQuoteMatch = description.match(/"([^"]+)"/);
          if (doubleQuoteMatch) {
            question = doubleQuoteMatch[1];
          }
          // Pattern 2: Text after "question:" or similar
          else if (description.includes('question')) {
            const lines = description.split('\n');
            const questionLine = lines.find(line => 
              line.toLowerCase().includes('question') && line.includes('?')
            );
            if (questionLine) {
              question = questionLine.replace(/.*question[:\s]*/i, '').trim();
            }
          }
          // Pattern 3: Any line ending with question mark
          else {
            const lines = description.split('\n');
            const questionLine = lines.find(line => line.trim().endsWith('?'));
            if (questionLine) {
              question = questionLine.trim();
            }
          }
          
          // Fallback to last non-empty line
          if (!question) {
            const lines = description.split('\n').filter(line => line.trim());
            question = lines[lines.length - 1]?.trim() || q.key;
          }
          
          // Comprehensive quote stripping function
          function stripOuterQuotes(str: string) {
            let cleaned = str.trim();
            while (
              (
                (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
                (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
                (cleaned.startsWith('\u201C') && cleaned.endsWith('\u201D')) ||
                (cleaned.startsWith('\u2018') && cleaned.endsWith('\u2019')) ||
                (cleaned.startsWith('`') && cleaned.endsWith('`'))
              ) && cleaned.length > 1
            ) {
              cleaned = cleaned.substring(1, cleaned.length - 1).trim();
            }
            return cleaned;
          }
          
          question = stripOuterQuotes(question);
          
          return {
            label: q.label,
            question: question,
            key: q.key
          };
        }
        return {
          label: q.label,
          question: `Question data not available for ${q.key}`,
          key: q.key
        };
      });
      
      if (questionsData.some(q => q.question)) {
        return questionsData;
      }
    }
    return [];
  }, [questionMeta, candidateList]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5" />
          Screening Questions Reference
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {questionsWithDescriptions.map((q, idx) => (
            <div key={q.key} className="p-3 border rounded-lg bg-slate-50">
              <div className="font-semibold text-sm text-blue-600 mb-1">
                {q.label}
              </div>
              <div className="text-sm text-gray-700">
                {q.question}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Detail Cell Renderer for expanded rows
function DetailCellRenderer({ data, onViewTranscript, qualifyMutation }: any) {
  const candidate = data._meta;
  const allData = data._all;
  
  // Extract and format the questions and responses dynamically
  const getFormattedResponses = () => {
    if (!allData || Object.keys(allData).length === 0) {
      return [];
    }
    
    const responses: Array<{ question: string; answer: any; type: string; key: string; rationale?: string }> = [];
    
    // Process all available data
    Object.entries(allData).forEach(([key, value]: [string, any]) => {
      if (value && typeof value === 'object' && value.value !== null && value.value !== undefined && value.value !== '') {
        let displayValue = value.value;
        let questionText = '';
        let type = 'text';
        let rationale = value.rationale || '';
        
        // Extract question text from json_schema.description
        if (value.json_schema?.description) {
          const description = value.json_schema.description;
          
          // Extract the actual question from the description
          let question = '';
          
          // Pattern 1: Text in double quotes (remove the quotes)
          const doubleQuoteMatch = description.match(/"([^"]+)"/);
          if (doubleQuoteMatch) {
            question = doubleQuoteMatch[1];
          }
          // Pattern 2: Text after "question:" or similar
          else if (description.includes('question')) {
            const lines = description.split('\n');
            const questionLine = lines.find(line => 
              line.toLowerCase().includes('question') && line.includes('?')
            );
            if (questionLine) {
              question = questionLine.replace(/.*question[:\s]*/i, '').trim();
            }
          }
          // Pattern 3: Any line ending with question mark
          else {
            const lines = description.split('\n');
            const questionLine = lines.find(line => line.trim().endsWith('?'));
            if (questionLine) {
              question = questionLine.trim();
            }
          }
          
          // Fallback to last non-empty line
          if (!question) {
            const lines = description.split('\n').filter(line => line.trim());
            question = lines[lines.length - 1]?.trim() || key;
          }
          
          // Strip outer quotes
          function stripOuterQuotes(str: string) {
            let cleaned = str.trim();
            while (
              (
                (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
                (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
                (cleaned.startsWith('\u201C') && cleaned.endsWith('\u201D')) ||
                (cleaned.startsWith('\u2018') && cleaned.endsWith('\u2019')) ||
                (cleaned.startsWith('`') && cleaned.endsWith('`'))
              ) && cleaned.length > 1
            ) {
              cleaned = cleaned.substring(1, cleaned.length - 1).trim();
            }
            return cleaned;
          }
          
          questionText = stripOuterQuotes(question);
        } else {
          questionText = key.replace(/_/g, ' ');
        }
        
        // Determine type from json_schema
        type = value.json_schema?.type || 'text';
        
        // Format boolean responses
        if (type === 'boolean') {
          displayValue = value.value === true ? '✅ Yes' : value.value === false ? '❌ No' : displayValue;
        }
        
        // Truncate long text responses
        if (typeof displayValue === 'string' && displayValue.length > 100) {
          displayValue = displayValue.substring(0, 100) + '...';
        }
        
        responses.push({
          question: questionText,
          answer: displayValue,
          type: type,
          key: key,
          rationale: rationale
        });
      }
    });

    // Sort responses to put basic info first, then questions
    const basicInfo = ['First_Name', 'Last_Name', 'Phone_number'];
    const questionKeys = Object.keys(allData).filter(key => 
      key.toLowerCase().includes('question') || key.toLowerCase().includes('schedule')
    );
    
    return responses.sort((a, b) => {
      const aBasic = basicInfo.includes(a.key);
      const bBasic = basicInfo.includes(b.key);
      if (aBasic && !bBasic) return -1;
      if (!aBasic && bBasic) return 1;
      return a.key.localeCompare(b.key);
    });
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
                      {item.key.includes('question') ? `Question ${index + 1}` : item.key.replace(/_/g, ' ')}:
                    </div>
                    <div className={`text-sm font-medium px-2 py-1 rounded ${
                      item.type === 'boolean' 
                        ? item.answer.includes('✅') 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.answer}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    <strong>Question:</strong> {item.question}
                  </div>
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

  // Figure out all unique question fields & order (from first candidate with any)
  const questionMeta = useMemo(() => {
    for (const cand of candidateList) {
      const meta = getQuestionsMeta(cand);
      if (meta.length > 0) return meta;
    }
    return [];
  }, [candidateList]);

  // Build rows: one per candidate with expansion rows
  const rowData = useMemo(() => {
    const rows: any[] = [];
    
    candidateList.forEach((cand, idx) => {
      const results = cand?.rawConversationData?.analysis?.data_collection_results || {};
      const getField = (field: string) => {
        const entry = results[field];
        return entry ? entry.value : null;
      };
      
      // Create question columns dynamically
      const questionColumns = Object.fromEntries(
        questionMeta.map(q => [q.label, getField(q.key)])
      );
      
      // Main row
      const mainRow = {
        id: idx,
        name: `${cand.firstName || ''} ${cand.lastName || ''}`.trim() || 'Unknown',
        phone: cand.phone || getField('Phone_number'),
        callTime: new Date(cand.createdAt).toLocaleString(),
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
          qualified: null,
          ...Object.fromEntries(questionMeta.map(q => [q.label, ''])),
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
  }, [candidateList, questionMeta, expandedRows]);

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
    
    // Handle question columns
    if (questionMeta.some(q => q.label === colDef.field)) {
      const questionInfo = questionMeta.find(q => q.label === colDef.field);
      if (questionInfo?.type === 'boolean') {
        return <StatusIcon value={params.value} />;
      } else {
        // For non-boolean questions, show a text indicator
        return (
          <div className="text-center">
            {params.value ? (
              <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                {typeof params.value === 'string' && params.value.length > 10 
                  ? params.value.substring(0, 10) + '...' 
                  : params.value}
              </span>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </div>
        );
      }
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
    // Only show question columns (not basic info)
    ...questionMeta
      .filter(q => q.isQuestion)
      .map(q => ({
        headerName: q.label,
        field: q.label,
        width: 80,
        minWidth: 70,
        maxWidth: 90,
        cellRenderer: CellRenderer,
        cellStyle: { textAlign: 'center' },
        headerTooltip: q.questionText || `Question ${q.label}`
      })),
    {
      headerName: 'Status',
      field: 'qualified',
      width: 100,
      minWidth: 90,
      cellRenderer: CellRenderer,
      headerTooltip: 'Qualification status (PASS/FAIL)'
    }
  ], [questionMeta, expandedRows]);

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
      {/* Table Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Call Records</h2>
            <p className="text-sm text-slate-600">
              {candidateList.length} total records • Auto-refresh every 5 seconds
            </p>
          </div>
          
          {/* Questions Reference */}
          <QuestionsReferenceCard questionMeta={questionMeta} candidateList={candidateList} />
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