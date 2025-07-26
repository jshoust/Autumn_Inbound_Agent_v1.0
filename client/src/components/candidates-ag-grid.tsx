import React, { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, FileText, ChevronDown } from "lucide-react";
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
  // Filter for keys that are booleans (i.e. pass/fail questions)
  const boolQuestions = Object.values(results)
    .filter((item: any) => typeof item.value === 'boolean' || item.value === 'true' || item.value === 'false')
    .map((item: any, idx: number) => ({
      key: item.data_collection_id,
      label: `Q${idx + 1}`,
      questionText: item.json_schema?.description?.split('\n').pop()?.trim() || item.data_collection_id
    }));
  return boolQuestions;
}

// Actions Cell Renderer
function ActionsCellRenderer({ data, onViewTranscript, qualifyMutation }: any) {
  const candidate = data._meta;
  
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

// Row detail renderer for expanded view
function DetailCellRenderer(props: any) {
  const { data } = props;
  const allResults = data._all;
  const candidate = data._meta;
  
  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Candidate Details</h3>
      <div className="mb-4">
        <strong>Name:</strong> {data.name} | <strong>Phone:</strong> {data.phone}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(allResults || {}).map(([key, item]: [string, any]) => (
          <div key={key} className="p-3 border rounded-lg bg-white">
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon value={item.value} />
              <span className="font-medium text-sm">{key}</span>
            </div>
            {item.json_schema?.description && (
              <p className="text-xs text-gray-600 mb-2">
                {item.json_schema.description}
              </p>
            )}
            {item.rationale && (
              <p className="text-xs text-gray-500">
                <strong>Analysis:</strong> {item.rationale}
              </p>
            )}
          </div>
        ))}
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

  // Build rows: one per candidate
  const rowData = useMemo(() => {
    return candidateList.map((cand, idx) => {
      const results = cand?.rawConversationData?.analysis?.data_collection_results || {};
      const getField = (field: string) => {
        const entry = results[field];
        return entry ? entry.value : null;
      };
      
      return {
        id: idx,
        name: `${cand.firstName || ''} ${cand.lastName || ''}`.trim() || 'Unknown',
        phone: cand.phone || getField('Phone_number'),
        callTime: new Date(cand.createdAt).toLocaleString(),
        qualified: cand.qualified,
        ...Object.fromEntries(
          questionMeta.map(q => [q.label, getField(q.key)])
        ),
        _all: results, // For expansion panel
        _meta: cand // Original candidate data
      };
    });
  }, [candidateList, questionMeta]);

  // Build AG Grid columns
  const columnDefs = useMemo(() => [
    { 
      headerName: 'Name', 
      field: 'name', 
      minWidth: 160, 
      pinned: 'left',
      checkboxSelection: true,
      headerCheckboxSelection: true
    },
    { headerName: 'Phone', field: 'phone', minWidth: 140 },
    { headerName: 'Call Time', field: 'callTime', minWidth: 150 },
    ...questionMeta.map(q => ({
      headerName: q.label,
      field: q.label,
      minWidth: 90,
      maxWidth: 110,
      cellRenderer: (p: any) => <StatusIcon value={p.value} />,
      cellStyle: { textAlign: 'center' }
    })),
    {
      headerName: 'Status',
      field: 'qualified',
      minWidth: 130,
      cellRenderer: StatusBadgeRenderer
    },
    {
      headerName: 'Actions',
      field: 'actions',
      minWidth: 150,
      cellRenderer: (params: any) => (
        <ActionsCellRenderer 
          data={params.data} 
          onViewTranscript={onViewTranscript}
          qualifyMutation={qualifyMutation}
        />
      ),
      sortable: false,
      filter: false,
      pinned: 'right'
    }
  ], [questionMeta, qualifyMutation.isPending, onViewTranscript]);

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
      <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          theme="legacy"
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
          suppressRowClickSelection={true}
          onSelectionChanged={handleSelectionChanged}
          rowHeight={60}
          headerHeight={50}
          masterDetail={true}
          detailCellRenderer={DetailCellRenderer}
          detailRowHeight={400}
        />
      </div>
    </div>
  );
}