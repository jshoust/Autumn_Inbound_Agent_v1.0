import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, FileText, Check, X, User, ChevronLeft, ChevronRight, CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { Candidate } from "@shared/schema";

interface CandidateTableProps {
  candidates: Candidate[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  onViewTranscript: (candidate: Candidate) => void;
  onRefetch: () => void;
}

export default function CandidateTable({
  candidates,
  isLoading,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  onViewTranscript,
  onRefetch
}: CandidateTableProps) {
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
    }
  });

  const getStatusBadge = (qualified: boolean | null) => {
    if (qualified === true) {
      return (
        <Badge className="bg-success bg-opacity-10 text-success border-success">
          <Check className="w-3 h-3 mr-1" />
          Qualified
        </Badge>
      );
    } else if (qualified === false) {
      return (
        <Badge className="bg-danger bg-opacity-10 text-danger border-danger">
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

  const getCDLBadge = (cdlType: string | null) => {
    if (!cdlType) return null;
    
    const isValidCDL = cdlType === 'CDL-A';
    return (
      <Badge className={isValidCDL ? "bg-success bg-opacity-10 text-success" : "bg-warning bg-opacity-10 text-warning"}>
        <CreditCard className="w-3 h-3 mr-1" />
        {cdlType}
      </Badge>
    );
  };

  const formatCallTime = (createdAt: Date | null) => {
    if (!createdAt) return 'Unknown';
    const date = new Date(createdAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    return isToday 
      ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <Card className="bg-white border border-slate-200">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900 mb-3 sm:mb-0">Recent Candidates</h2>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search candidates..."
                className="pl-10 pr-4 py-2 w-full sm:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="not_qualified">Not Qualified</SelectItem>
                <SelectItem value="pending">Pending Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        {candidates.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No candidates found. Waiting for incoming calls...
          </div>
        ) : (
          candidates.map((candidate) => {
            // Extract data collection results from stored API data
            const rawData = candidate.rawConversationData as any;
            const dataCollection = rawData?.analysis?.data_collection_results || {};
            
            return (
              <div key={candidate.id} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                {/* Contact Information */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {candidate.firstName} {candidate.lastName}
                    </h3>
                    <p className="text-slate-600">{candidate.phone}</p>
                    <p className="text-sm text-slate-500">{formatCallTime(candidate.createdAt)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(candidate.qualified)}
                    {candidate.transcript && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewTranscript(candidate)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    )}
                  </div>
                </div>

                {/* Question Responses */}
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-900">Question Responses:</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Q1: CDL */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <span className="text-sm font-medium">Q1: CDL License</span>
                      <div className="flex items-center space-x-2">
                        {dataCollection.question_one?.value === true ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : dataCollection.question_one?.value === false ? (
                          <X className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm text-slate-600">
                          {dataCollection.question_one_response?.value ? `"${dataCollection.question_one_response.value}"` : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Q2: Experience */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <span className="text-sm font-medium">Q2: 24+ Months Experience</span>
                      <div className="flex items-center space-x-2">
                        {dataCollection.Question_two?.value === true ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : dataCollection.Question_two?.value === false ? (
                          <X className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm text-slate-600">
                          {dataCollection.question_two_response?.value ? `"${dataCollection.question_two_response.value}"` : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Q3: Hopper */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <span className="text-sm font-medium">Q3: Hopper Experience</span>
                      <div className="flex items-center space-x-2">
                        {dataCollection.Question_three?.value === true ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : dataCollection.Question_three?.value === false ? (
                          <X className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm text-slate-600">
                          {dataCollection.question_three_response?.value ? `"${dataCollection.question_three_response.value}"` : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Q4: OTR */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <span className="text-sm font-medium">Q4: OTR Available</span>
                      <div className="flex items-center space-x-2">
                        {dataCollection.question_four?.value === true ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : dataCollection.question_four?.value === false ? (
                          <X className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm text-slate-600">
                          {dataCollection.Question_four_response?.value ? `"${dataCollection.Question_four_response.value}"` : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Q5: Violations */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <span className="text-sm font-medium">Q5: Clean Record</span>
                      <div className="flex items-center space-x-2">
                        {dataCollection.question_five?.value === false ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : dataCollection.question_five?.value === true ? (
                          <X className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm text-slate-600">
                          {dataCollection.question_five_reponse?.value ? `"${dataCollection.question_five_reponse.value}"` : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Q6: Work Auth */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
                      <span className="text-sm font-medium">Q6: Work Eligible</span>
                      <div className="flex items-center space-x-2">
                        {dataCollection.question_six?.value === true ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : dataCollection.question_six?.value === false ? (
                          <X className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm text-slate-600">
                          {dataCollection.question_six?.value !== null ? (dataCollection.question_six?.value ? 'Yes' : 'No') : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {candidate.qualified === null && (
                  <div className="flex space-x-2 mt-4 pt-4 border-t border-slate-200">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: true })}
                      disabled={qualifyMutation.isPending}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Qualify
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: false })}
                      disabled={qualifyMutation.isPending}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Pagination */}
      {candidates.length > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-slate-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button variant="outline" disabled>
              Previous
            </Button>
            <Button variant="outline" disabled>
              Next
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{Math.min(10, candidates.length)}</span> of <span className="font-medium">{candidates.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="bg-primary border-primary text-white">
                  1
                </Button>
                <Button variant="outline" size="sm" disabled>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
