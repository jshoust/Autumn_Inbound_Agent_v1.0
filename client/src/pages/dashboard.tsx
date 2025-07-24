import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Truck, Bell } from "lucide-react";
import StatsOverview from "@/components/stats-overview";
import CandidateTable from "@/components/candidate-table";
import TranscriptModal from "@/components/transcript-modal";
import type { Candidate } from "@shared/schema";

export default function Dashboard() {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: candidates = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/candidates', searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter && statusFilter !== "all") params.append('status', statusFilter);
      
      const response = await fetch(`/api/candidates?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch candidates');
      return response.json();
    }
  });

  const handleViewTranscript = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
  };

  const handleCloseModal = () => {
    setSelectedCandidate(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Truck className="text-primary text-2xl mr-3" />
                <h1 className="text-xl font-bold text-slate-800">TruckRecruit Pro</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-slate-600 hover:text-slate-800 transition-colors">
                <Bell className="text-lg" />
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">JD</span>
                </div>
                <span className="text-sm text-slate-700">John Doe</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <StatsOverview />
        
        <CandidateTable
          candidates={candidates}
          isLoading={isLoading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onViewTranscript={handleViewTranscript}
          onRefetch={refetch}
        />
      </div>

      {selectedCandidate && (
        <TranscriptModal
          candidate={selectedCandidate}
          onClose={handleCloseModal}
          onRefetch={refetch}
        />
      )}
    </div>
  );
}
