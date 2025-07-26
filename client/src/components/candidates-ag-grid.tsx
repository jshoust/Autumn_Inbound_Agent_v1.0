import React, { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, FileText } from "lucide-react";
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

export default function CandidatesAgGrid({
  candidates,
  isLoading,
  onViewTranscript,
  onRefetch
}: CandidatesAgGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
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

  // Status Badge Cell Renderer
  const StatusBadgeRenderer = (params: any) => {
    const qualified = params.value;
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
  };

  // Question Response Cell Renderer
  const QuestionResponseRenderer = (params: any) => {
    const { value, response } = params.value || { value: null, response: '' };
    
    return (
      <div className="flex items-center space-x-2">
        <div className="flex-shrink-0">
          {value === true ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : value === false ? (
            <X className="w-4 h-4 text-red-600" />
          ) : (
            <Clock className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <span className="text-sm text-slate-600 truncate">
          {response ? `"${response}"` : '-'}
        </span>
      </div>
    );
  };

  // Actions Cell Renderer
  const ActionsCellRenderer = (params: any) => {
    const candidate = params.data;
    
    return (
      <div className="flex items-center space-x-2 py-1">
        {candidate.transcript && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-blue-600 hover:text-blue-800"
            onClick={() => onViewTranscript(candidate)}
          >
            <FileText className="w-3 h-3 mr-1" />
            View Details
          </Button>
        )}
        {candidate.qualified === null ? (
          <div className="flex space-x-1">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white text-xs"
              onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: true })}
              disabled={qualifyMutation.isPending}
            >
              <Check className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: false })}
              disabled={qualifyMutation.isPending}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => qualifyMutation.mutate({ 
              id: candidate.id, 
              qualified: !candidate.qualified 
            })}
            disabled={qualifyMutation.isPending}
          >
            Override
          </Button>
        )}
      </div>
    );
  };

  // Map candidates data for AG Grid
  const rowData = useMemo(() => {
    return candidates.map((candidate) => {
      const rawData = candidate.rawConversationData as any;
      const dataCollection = rawData?.analysis?.data_collection_results || {};
      
      // Extract question responses
      const getQuestionData = (field: string, responseField: string) => {
        return {
          value: dataCollection[field]?.value,
          response: dataCollection[responseField]?.value || ''
        };
      };

      return {
        id: candidate.id,
        name: `${candidate.firstName} ${candidate.lastName}`,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        phone: candidate.phone,
        createdAt: new Date(candidate.createdAt).toLocaleString(),
        qualified: candidate.qualified,
        transcript: candidate.transcript,
        q1_cdl: getQuestionData('question_one', 'question_one_response'),
        q2_experience: getQuestionData('Question_two', 'question_two_response'),
        q3_hopper: getQuestionData('Question_three', 'question_three_response'),
        q4_otr: getQuestionData('question_four', 'Question_four_response'),
        q5_violations: {
          value: dataCollection.question_five?.value,
          response: dataCollection.question_five_reponse?.value || ''
        },
        q6_workAuth: getQuestionData('question_six', 'question_six_response'),
        rawConversationData: candidate.rawConversationData
      };
    });
  }, [candidates]);

  // Column definitions
  const columnDefs = useMemo(() => [
    {
      headerName: 'Contact Information',
      children: [
        {
          headerName: 'Name',
          field: 'name',
          minWidth: 150,
          flex: 0.3,
          pinned: 'left'
        },
        {
          headerName: 'Phone',
          field: 'phone',
          minWidth: 120,
          flex: 0.2
        },
        {
          headerName: 'Call Time',
          field: 'createdAt',
          minWidth: 130,
          flex: 0.2
        }
      ]
    },
    {
      headerName: 'Qualification Questions',
      children: [
        {
          headerName: 'Q1: CDL License',
          field: 'q1_cdl',
          minWidth: 120,
          flex: 0.2,
          cellRenderer: QuestionResponseRenderer
        },
        {
          headerName: 'Q2: 24+ Months Experience',
          field: 'q2_experience',
          minWidth: 150,
          flex: 0.2,
          cellRenderer: QuestionResponseRenderer
        },
        {
          headerName: 'Q3: Hopper Experience',
          field: 'q3_hopper',
          minWidth: 130,
          flex: 0.2,
          cellRenderer: QuestionResponseRenderer
        },
        {
          headerName: 'Q4: OTR Available',
          field: 'q4_otr',
          minWidth: 120,
          flex: 0.2,
          cellRenderer: QuestionResponseRenderer
        },
        {
          headerName: 'Q5: Clean Record',
          field: 'q5_violations',
          minWidth: 120,
          flex: 0.2,
          cellRenderer: (params: any) => {
            const { value, response } = params.value || { value: null, response: '' };
            // For violations, reverse the logic (false = good, true = bad)
            const showCheck = value === false;
            const showX = value === true;
            
            return (
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0">
                  {showCheck ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : showX ? (
                    <X className="w-4 h-4 text-red-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <span className="text-sm text-slate-600 truncate">
                  {response ? `"${response}"` : '-'}
                </span>
              </div>
            );
          }
        },
        {
          headerName: 'Q6: Work Eligible',
          field: 'q6_workAuth',
          minWidth: 120,
          flex: 0.2,
          cellRenderer: QuestionResponseRenderer
        }
      ]
    },
    {
      headerName: 'Status & Actions',
      children: [
        {
          headerName: 'Qualification Status',
          field: 'qualified',
          minWidth: 130,
          flex: 0.2,
          cellRenderer: StatusBadgeRenderer
        },
        {
          headerName: 'Actions',
          field: 'actions',
          minWidth: 150,
          flex: 0.3,
          cellRenderer: ActionsCellRenderer,
          sortable: false,
          filter: false,
          pinned: 'right'
        }
      ]
    }
  ], [qualifyMutation.isPending]);

  // Export functions
  const exportCSV = () => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `candidates-${new Date().toISOString().split('T')[0]}.csv`
    });
  };

  const exportExcel = () => {
    gridRef.current?.api.exportDataAsExcel({
      fileName: `candidates-${new Date().toISOString().split('T')[0]}.xlsx`
    });
  };

  // Multi-select functions
  const handleSelectionChanged = () => {
    const rows = gridRef.current?.api.getSelectedRows() || [];
    setSelectedRows(rows);
  };

  const handleBulkQualify = (qualified: boolean) => {
    selectedRows.forEach(row => {
      qualifyMutation.mutate({ id: row.id, qualified });
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
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={exportCSV}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={exportExcel}>
            Export Excel
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
      <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
            sortable: true,
            filter: true,
            wrapText: true,
            autoHeight: true
          }}
          rowSelection="multiple"
          onSelectionChanged={handleSelectionChanged}
          suppressRowClickSelection={true}
          rowHeight={60}
          headerHeight={60}
          groupHeaderHeight={40}
        />
      </div>
    </div>
  );
}