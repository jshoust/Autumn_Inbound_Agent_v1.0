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
  
  // Define proper question mapping with descriptions
  const questionMapping: Record<string, { question: string; type: string }> = {
    'First_Name': { question: 'What is your first name?', type: 'text' },
    'Last_Name': { question: 'What is your last name?', type: 'text' },
    'Phone_number': { question: 'What is your phone number?', type: 'text' },
    'question_one': { question: 'Do you currently have a valid Class A commercial driver\'s license?', type: 'boolean' },
    'question_one_response': { question: 'CDL Response Details', type: 'text' },
    'Question_two': { question: 'Do you have at least 24 months of experience driving a tractor-trailer?', type: 'boolean' },
    'question_two_response': { question: 'Experience Response Details', type: 'text' },
    'Question_three': { question: 'Do you have verifiable experience with hoppers?', type: 'boolean' },
    'question_three_response': { question: 'Hopper Experience Details', type: 'text' },
    'question_four': { question: 'Are you able to be over the road for 3 weeks at a time?', type: 'boolean' },
    'Question_four_response': { question: 'OTR Availability Details', type: 'text' },
    'question_five': { question: 'Have you had any serious traffic violations in the last 3 years?', type: 'boolean' },
    'question_five_reponse': { question: 'Traffic Violations Details', type: 'text' },
    'question_six': { question: 'Are you legally eligible to work in the United States?', type: 'boolean' },
    'schedule': { question: 'Interview Schedule Preference', type: 'text' }
  };

  // Extract and format the questions and responses
  const getFormattedResponses = () => {
    if (!allData || Object.keys(allData).length === 0) {
      return [];
    }
    
    const responses: Array<{ question: string; answer: any; type: string }> = [];
    
    // Process all available data
    Object.entries(allData).forEach(([key, value]: [string, any]) => {
      if (value && typeof value === 'object' && value.value !== null && value.value !== undefined && value.value !== '') {
        let displayValue = value.value;
        let questionText = questionMapping[key]?.question || key.replace(/_/g, ' ');
        let type = questionMapping[key]?.type || 'text';
        
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
          type: type
        });
      }
    });

    return responses;
  };

  const formattedResponses = getFormattedResponses();
  
  return (
    <div className="w-full bg-white border-t border-slate-200 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call History Questions & Responses */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-semibold text-slate-800 text-sm">📞 Call History Details</h4>
            <div className="text-xs text-slate-500">
              {new Date(candidate.createdAt).toLocaleString()}
            </div>
          </div>
          
                     {formattedResponses.length > 0 ? (
             <div className="space-y-3 max-h-56 overflow-y-auto">
              {formattedResponses.map((item, index) => (
                <div key={index} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs font-medium text-slate-600 mb-1">
                    Q{index + 1}: {item.question}
                  </div>
                  <div className={`text-sm font-medium ${
                    item.type === 'boolean' 
                      ? item.answer.includes('✅') ? 'text-green-700' : 'text-red-700'
                      : 'text-slate-800'
                  }`}>
                    {item.answer}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
              <div className="text-sm">No detailed call responses available</div>
              <div className="text-xs mt-1">The call data may not have been fully processed</div>
            </div>
          )}
        </div>
        
        {/* Actions & Summary */}
        <div className="lg:col-span-1">
          <div className="bg-slate-50 rounded-lg p-3 space-y-3">
            <div>
              <h5 className="font-semibold text-slate-700 text-sm mb-2">📋 Summary</h5>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Name:</span>
                  <span className="font-medium">{candidate.firstName} {candidate.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Phone:</span>
                  <span className="font-medium">{candidate.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Status:</span>
                  <span className={`font-medium ${
                    candidate.qualified === true ? 'text-green-600' : 
                    candidate.qualified === false ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {candidate.qualified === true ? '✅ Qualified' : 
                     candidate.qualified === false ? '❌ Not Qualified' : '⏳ Pending'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="border-t border-slate-200 pt-3">
              <h5 className="font-semibold text-slate-700 text-sm mb-2">🔧 Actions</h5>
              <div className="space-y-2">
                {candidate.transcript && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => onViewTranscript(candidate)}
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    View Full Transcript
                  </Button>
                )}
                
                {candidate.qualified === null ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                      onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: true })}
                      disabled={qualifyMutation.isPending}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Qualify
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 text-xs"
                      onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: false })}
                      disabled={qualifyMutation.isPending}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => qualifyMutation.mutate({ 
                      id: candidate.id, 
                      qualified: !candidate.qualified 
                    })}
                    disabled={qualifyMutation.isPending}
                  >
                    {candidate.qualified ? 'Mark as Unqualified' : 'Mark as Qualified'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Status Badge Cell Renderer
function StatusBadgeRenderer({ value }: any) {
  const qualified = value;
  if (qualified === true) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <Check className="w-3 h-3 mr-1" />
        Qualified
      </Badge>
    );
  } else if (qualified === false) {
    return (
      <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
        <X className="w-3 h-3 mr-1" />
        Not Qualified
      </Badge>
    );
  } else {
    return (
      <Badge variant="secondary" className="bg-slate-100 text-slate-800">
        <Clock className="w-3 h-3 mr-1" />
        Pending Review
      </Badge>
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
          className="p-1 h-auto"
          onClick={() => toggleRowExpansion(data.id)}
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${expandedRows.has(data.id) ? 'rotate-180' : ''}`} />
        </Button>
      );
    }
    
    if (colDef.field === 'callTime' && data._meta) {
      const date = new Date(data._meta.createdAt);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    if (questionMeta.some(q => q.label === colDef.field)) {
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
      headerName: '', 
      field: 'expand',
      width: 40,
      cellRenderer: CellRenderer,
      sortable: false,
      filter: false,
      resizable: false
    },
    { 
      headerName: 'Name', 
      field: 'name', 
      width: 120,
      minWidth: 100,
      cellRenderer: CellRenderer
    },
    { 
      headerName: 'Phone', 
      field: 'phone', 
      width: 120,
      minWidth: 110,
      cellRenderer: CellRenderer
    },
    { 
      headerName: 'Call Time', 
      field: 'callTime', 
      width: 130,
      minWidth: 120,
      cellRenderer: CellRenderer
    },
    ...questionMeta.map(q => ({
      headerName: q.label,
      field: q.label,
      width: 70,
      minWidth: 60,
      maxWidth: 80,
      cellRenderer: CellRenderer,
      cellStyle: { textAlign: 'center' }
    })),
    {
      headerName: 'Status',
      field: 'qualified',
      width: 100,
      minWidth: 90,
      cellRenderer: CellRenderer
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
      {/* Questions Reference Card */}
      <QuestionsReferenceCard questionMeta={questionMeta} candidateList={candidateList} />
      
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={exportCSV}>
            Export CSV
          </Button>
        </div>
        
        {selectedRows.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">
              {selectedRows.length} selected
            </span>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleBulkQualify(true)}
            >
              Qualify Selected
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkQualify(false)}
            >
              Reject Selected
            </Button>
          </div>
        )}
      </div>

      {/* AG Grid */}
      <div className="ag-theme-alpine" style={{ height: '500px', width: '100%' }}>
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
            return params.data._rowType === 'expanded' ? 300 : 45;
          }}
          headerHeight={40}
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