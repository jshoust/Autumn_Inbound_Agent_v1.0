import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/header";
import CandidatesAgGrid from "@/components/candidates-ag-grid";
import type { Candidate } from "@shared/schema";

interface TranscriptModalData {
  transcript: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export default function Dashboard() {
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptModalData | null>(null);

  // Fetch candidates data
  const { data: candidates = [], isLoading, error, refetch } = useQuery<Candidate[]>({
    queryKey: ['/api/candidates'],
    queryFn: async () => {
      const response = await fetch('/api/candidates');
      if (!response.ok) {
        throw new Error(`Failed to fetch candidates: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Fetch stats data
  const { data: stats } = useQuery({
    queryKey: ['/api/stats'],
    queryFn: async () => {
      const response = await fetch('/api/stats');
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 5000,
  });

  const handleViewTranscript = (candidate: Candidate) => {
    // Handle transcript data - it could be a string or an array of conversation objects
    let transcriptText = 'No transcript available';
    
    if (candidate.transcript) {
      if (typeof candidate.transcript === 'string') {
        transcriptText = candidate.transcript;
      } else if (Array.isArray(candidate.transcript)) {
        // Convert conversation array to readable transcript
        transcriptText = candidate.transcript
          .map((turn: any) => `${turn.role}: ${turn.message}`)
          .join('\n\n');
      } else if (typeof candidate.transcript === 'object') {
        transcriptText = JSON.stringify(candidate.transcript, null, 2);
      }
    }
    
    setSelectedTranscript({
      transcript: transcriptText,
      firstName: candidate.firstName || undefined,
      lastName: candidate.lastName || undefined,  
      phone: candidate.phone || undefined
    });
  };

  const handleRefetch = () => {
    refetch();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="bg-muted/30 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Driver Recruiting Dashboard</h1>
              <p className="text-muted-foreground mt-1">Monitor inbound calls and manage candidate qualifications</p>
            </div>
            <Button
              variant="outline"
              onClick={handleRefetch}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="shadow-sm border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Today's Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats.todayCalls}</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Qualified</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.qualified}</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Qualification Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.qualificationRate}%</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AG Grid Table */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Candidate Management</CardTitle>
          </CardHeader>
          <CardContent>
            <CandidatesAgGrid
              candidates={candidates}
              isLoading={isLoading}
              onViewTranscript={handleViewTranscript}
              onRefetch={handleRefetch}
            />
          </CardContent>
        </Card>

        {/* Transcript Modal */}
        {selectedTranscript && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-lg border border-border">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Call Transcript</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedTranscript.firstName} {selectedTranscript.lastName} - {selectedTranscript.phone}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedTranscript(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </Button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <pre className="whitespace-pre-wrap text-sm text-foreground">
                  {selectedTranscript.transcript}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}