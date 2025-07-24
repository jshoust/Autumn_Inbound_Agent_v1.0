import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Truck, Bell, Bot, MessageCircle, Clock, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatsOverview from "@/components/stats-overview";
import CandidateTable from "@/components/candidate-table";
import TranscriptModal from "@/components/transcript-modal";
import type { Candidate } from "@shared/schema";

interface Conversation {
  conversation_id: string;
  agent_id: string;
  agent_name: string;
  status: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  call_successful: string;
}

export default function Dashboard() {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

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

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/elevenlabs/conversations'],
    queryFn: () => fetch('/api/elevenlabs/conversations?limit=10').then(res => res.json()),
  });

  const { data: conversationDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['/api/elevenlabs/conversations', selectedConversation],
    queryFn: () => fetch(`/api/elevenlabs/conversations/${selectedConversation}`).then(res => res.json()),
    enabled: !!selectedConversation,
  });

  const handleViewTranscript = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
  };

  const handleCloseModal = () => {
    setSelectedCandidate(null);
  };

  const toggleCallExpansion = (conversationId: string) => {
    const newExpanded = new Set(expandedCalls);
    if (newExpanded.has(conversationId)) {
      newExpanded.delete(conversationId);
    } else {
      newExpanded.add(conversationId);
    }
    setExpandedCalls(newExpanded);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center min-w-0 flex-1">
              <div className="flex-shrink-0 flex items-center">
                <Truck className="text-primary text-xl sm:text-2xl mr-2 sm:mr-3" />
                <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate">TruckRecruit Pro</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button className="text-slate-600 hover:text-slate-800 transition-colors p-2">
                <Bell className="text-base sm:text-lg" />
              </button>
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-xs sm:text-sm font-medium">JD</span>
                </div>
                <span className="text-xs sm:text-sm text-slate-700 hidden sm:inline">John Doe</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        <StatsOverview />
        
        {/* Recent Calls Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Recent Calls</CardTitle>
            <CardDescription className="text-sm">
              Latest calls processed by your ElevenLabs agents
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {conversationsLoading ? (
              <div className="space-y-4 p-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground px-4">
                <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No recent conversations found. Waiting for incoming calls...</p>
              </div>
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="block sm:hidden">
                  <div className="space-y-2 p-3">
                    {conversations.slice(0, 5).map((conversation) => {
                      const isExpanded = expandedCalls.has(conversation.conversation_id);
                      return (
                        <div key={conversation.conversation_id} className="border rounded-lg bg-white">
                          {/* Compact header - always visible */}
                          <div 
                            className="p-3 cursor-pointer"
                            onClick={() => toggleCallExpansion(conversation.conversation_id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Bot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium truncate">
                                    {conversation.agent_name || 'Autumn Agent'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(conversation.start_time_unix_secs * 1000).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={
                                    conversation.call_successful === 'success' 
                                      ? 'default' 
                                      : conversation.call_successful === 'failure' 
                                        ? 'destructive' 
                                        : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {conversation.call_successful}
                                </Badge>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-3 border-t bg-slate-50">
                              <div className="pt-3">
                                <div className="text-xs text-muted-foreground mb-2">Conversation ID</div>
                                <div className="font-mono text-xs bg-white px-2 py-1 rounded border break-all">
                                  {conversation.conversation_id}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Messages</div>
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3 text-muted-foreground" />
                                    <span>{conversation.message_count}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">Duration</div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span>
                                      {conversation.call_duration_secs
                                        ? `${Math.floor(conversation.call_duration_secs / 60)}:${String(conversation.call_duration_secs % 60).padStart(2, '0')}`
                                        : 'N/A'
                                      }
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">Full Date</div>
                                <div className="text-sm">
                                  {new Date(conversation.start_time_unix_secs * 1000).toLocaleDateString()} {new Date(conversation.start_time_unix_secs * 1000).toLocaleTimeString()}
                                </div>
                              </div>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedConversation(conversation.conversation_id);
                                }}
                                className="w-full flex items-center justify-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View Full Transcript
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Desktop table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Conversation ID</TableHead>
                        <TableHead className="min-w-[120px]">Agent</TableHead>
                        <TableHead className="min-w-[80px]">Messages</TableHead>
                        <TableHead className="min-w-[80px]">Result</TableHead>
                        <TableHead className="min-w-[80px]">Duration</TableHead>
                        <TableHead className="min-w-[150px]">Started</TableHead>
                        <TableHead className="min-w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conversations.slice(0, 5).map((conversation) => (
                        <TableRow key={conversation.conversation_id}>
                          <TableCell className="font-mono text-sm">
                            <div className="max-w-[200px] truncate">
                              {conversation.conversation_id}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 max-w-[120px]">
                              <Bot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="truncate text-sm">
                                {conversation.agent_name || 'Autumn Agent'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MessageCircle className="h-4 w-4 text-muted-foreground" />
                              <span>{conversation.message_count}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                conversation.call_successful === 'success' 
                                  ? 'default' 
                                  : conversation.call_successful === 'failure' 
                                    ? 'destructive' 
                                    : 'secondary'
                              }
                              className="capitalize"
                            >
                              {conversation.call_successful}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {conversation.call_duration_secs
                                  ? `${Math.floor(conversation.call_duration_secs / 60)}:${String(conversation.call_duration_secs % 60).padStart(2, '0')}`
                                  : 'N/A'
                                }
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="max-w-[150px]">
                              {new Date(conversation.start_time_unix_secs * 1000).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedConversation(conversation.conversation_id)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden lg:inline">View Details</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
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

      {/* Conversation Details Dialog */}
      <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] sm:max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Call Details</DialogTitle>
            <DialogDescription className="text-sm">
              Conversation transcript and extraction data
            </DialogDescription>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="space-y-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ) : conversationDetails ? (
            <ScrollArea className="max-h-[70vh] sm:max-h-[60vh]">
              <div className="space-y-4 sm:space-y-6">

                {/* Call Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <h4 className="font-semibold mb-2 text-sm sm:text-base">Call Information</h4>
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p><strong>Agent:</strong> <span className="break-words">Autumn Transport Inbound Recruiting Agent</span></p>
                      <p><strong>Duration:</strong> {
                        conversationDetails.conversation_initiation_client_data?.dynamic_variables?.system__call_duration_secs 
                          ? `${Math.floor(conversationDetails.conversation_initiation_client_data.dynamic_variables.system__call_duration_secs / 60)}:${String(conversationDetails.conversation_initiation_client_data.dynamic_variables.system__call_duration_secs % 60).padStart(2, '0')}`
                          : 'N/A'
                      }</p>
                      <p><strong>Messages:</strong> {conversationDetails.transcript?.length || 0}</p>
                      <div className="flex items-center gap-2">
                        <strong>Status:</strong>
                        <Badge className="text-xs" variant={conversationDetails.call_successful === 'success' ? 'default' : 'destructive'}>
                          {conversationDetails.call_successful || 'unknown'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-sm sm:text-base">Candidate Information</h4>
                    <div className="space-y-2 text-xs sm:text-sm">
                      {conversationDetails.data_collection ? (
                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">First Name:</span>
                            <span>{conversationDetails.data_collection.First_Name?.value || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Last Name:</span>
                            <span>{conversationDetails.data_collection.Last_Name?.value || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Phone Number:</span>
                            <span>{conversationDetails.data_collection.Phone_number?.value || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Valid CDL Class A:</span>
                            <Badge variant={conversationDetails.data_collection.question_one?.value ? 'default' : 'destructive'}>
                              {conversationDetails.data_collection.question_one?.value ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">18+ Months Experience:</span>
                            <Badge variant={conversationDetails.data_collection.Question_two?.value ? 'default' : 'destructive'}>
                              {conversationDetails.data_collection.Question_two?.value ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Clean Record (No Violations):</span>
                            <Badge variant={conversationDetails.data_collection.Question_three?.value === false ? 'default' : 'destructive'}>
                              {conversationDetails.data_collection.Question_three?.value === false ? 'Clean' : 'Has Violations'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Work Authorization:</span>
                            <Badge variant={conversationDetails.data_collection.question_four?.value ? 'default' : 'destructive'}>
                              {conversationDetails.data_collection.question_four?.value ? 'Authorized' : 'Not Authorized'}
                            </Badge>
                          </div>
                          {conversationDetails.data_collection.schedule?.value && (
                            <div className="flex justify-between items-start p-2 bg-background rounded border">
                              <span className="font-medium">Interview Schedule:</span>
                              <span className="text-right">{conversationDetails.data_collection.schedule.value}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground bg-orange-50 rounded border">
                          <p className="font-medium">No automatic data extraction available</p>
                          <p className="text-xs mt-1">This conversation may need manual review to extract candidate information from the transcript below.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transcript */}
                <div>
                  <h4 className="font-semibold mb-3 text-sm sm:text-base">Conversation Transcript</h4>
                  {conversationDetails.transcript && conversationDetails.transcript.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {conversationDetails.transcript.map((message: any, index: number) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg text-xs sm:text-sm ${
                            message.role === 'agent' || message.speaker === 'agent'
                              ? 'bg-blue-50 ml-4'
                              : 'bg-gray-50 mr-4'
                          }`}
                        >
                          <div className="font-medium mb-1 capitalize">
                            {(message.role === 'agent' || message.speaker === 'agent') ? 'Agent' : 'Caller'}
                          </div>
                          <div className="whitespace-pre-wrap">
                            {message.message || message.original_message || message.text || message.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No transcript available for this conversation</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Failed to load conversation details</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
