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
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Contact Information</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-slate-700">
                <div className="flex flex-col items-center">
                  <span>CDL</span>
                  <span className="text-xs font-normal text-slate-500">Class A License</span>
                </div>
              </th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-slate-700">
                <div className="flex flex-col items-center">
                  <span>Experience</span>
                  <span className="text-xs font-normal text-slate-500">24+ Months</span>
                </div>
              </th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-slate-700">
                <div className="flex flex-col items-center">
                  <span>Hopper</span>
                  <span className="text-xs font-normal text-slate-500">Experience</span>
                </div>
              </th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-slate-700">
                <div className="flex flex-col items-center">
                  <span>OTR</span>
                  <span className="text-xs font-normal text-slate-500">Available</span>
                </div>
              </th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-slate-700">
                <div className="flex flex-col items-center">
                  <span>Clean Record</span>
                  <span className="text-xs font-normal text-slate-500">No Violations</span>
                </div>
              </th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-slate-700">
                <div className="flex flex-col items-center">
                  <span>Work Auth</span>
                  <span className="text-xs font-normal text-slate-500">Eligible</span>
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Qualification</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                  No candidates found. Waiting for incoming calls...
                </td>
              </tr>
            ) : (
              candidates.map((candidate) => {
                // Extract data collection results from stored API data
                const rawData = candidate.rawConversationData as any;
                const dataCollection = rawData?.analysis?.data_collection_results || {};
                
                // Define questions in correct order with proper field mapping
                const questions = [
                  { key: 'cdl', field: 'question_one', responseField: 'question_one_response' },
                  { key: 'experience', field: 'Question_two', responseField: 'question_two_response' },
                  { key: 'hopper', field: 'Question_three', responseField: 'question_three_response' },
                  { key: 'otr', field: 'question_four', responseField: 'Question_four_response' },
                  { key: 'violations', field: 'question_five', responseField: 'question_five_reponse' },
                  { key: 'workAuth', field: 'question_six', responseField: 'question_six_response' }
                ];
                
                const getQuestionData = (questionConfig: typeof questions[0]) => {
                  const value = dataCollection[questionConfig.field]?.value;
                  const response = dataCollection[questionConfig.responseField]?.value || '';
                  return { value, response };
                };
                
                return (
                  <tr key={candidate.id} className="hover:bg-slate-50/50 transition-all duration-200 border-b border-slate-100">
                    {/* Contact Information */}
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                            <User className="text-white w-6 h-6" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {candidate.firstName} {candidate.lastName}
                          </div>
                          <div className="text-sm text-slate-600 font-mono">{candidate.phone}</div>
                          <div className="text-xs text-slate-500">
                            {formatCallTime(candidate.createdAt)}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Dynamic Question Columns */}
                    {questions.map((q, index) => {
                      const { value, response } = getQuestionData(q);
                      const isViolationsQuestion = q.key === 'violations';
                      
                      // For violations question, reverse the logic (true = bad, false = good)
                      const showCheck = isViolationsQuestion ? value === false : value === true;
                      const showX = isViolationsQuestion ? value === true : value === false;
                      
                      return (
                        <td key={q.key} className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center space-y-2">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-slate-200">
                              {showCheck ? (
                                <Check className="w-5 h-5 text-green-600" />
                              ) : showX ? (
                                <X className="w-5 h-5 text-red-600" />
                              ) : (
                                <Clock className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            {response && (
                              <div className="max-w-24 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded border truncate" 
                                   title={`"${response}"`}>
                                "{response}"
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    
                    {/* Qualification Status */}
                    <td className="px-6 py-5">
                      <div className="flex flex-col space-y-2">
                        <div>{getStatusBadge(candidate.qualified)}</div>
                        {candidate.transcript && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors justify-start p-1 h-auto"
                            onClick={() => onViewTranscript(candidate)}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            View Details
                          </Button>
                        )}
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-6 py-5">
                      <div className="flex flex-col space-y-2">
                        {candidate.qualified === null ? (
                          <div className="flex space-x-2">
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
                        ) : (
                          <div className="flex flex-col space-y-1">
                            <div className="text-xs text-slate-500">
                              {candidate.qualified ? 'Auto-qualified' : 'Auto-rejected'}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => qualifyMutation.mutate({ 
                                id: candidate.id, 
                                qualified: !candidate.qualified 
                              })}
                              disabled={qualifyMutation.isPending}
                              className="text-xs"
                            >
                              Override
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
              ))
            )}
          </tbody>
        </table>
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
