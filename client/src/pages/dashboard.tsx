import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    setSelectedTranscript({
      transcript: candidate.transcript || 'No transcript available',
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      phone: candidate.phone
    });
  };

  const handleRefetch = () => {
    refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Driver Recruiting Dashboard</h1>
              <p className="text-gray-600 mt-1">Monitor inbound calls and manage candidate qualifications</p>
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayCalls}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Qualified</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.qualified}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Qualification Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.qualificationRate}%</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AG Grid Table */}
        <Card>
          <CardHeader>
            <CardTitle>Candidate Management</CardTitle>
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
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Call Transcript</h3>
                    <p className="text-sm text-gray-600">
                      {selectedTranscript.firstName} {selectedTranscript.lastName} - {selectedTranscript.phone}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedTranscript(null)}
                  >
                    ×
                  </Button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <pre className="whitespace-pre-wrap text-sm">
                  {selectedTranscript.transcript}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}