import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, MessageCircle, Clock, Eye, User, Mic } from "lucide-react";



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

export default function Agents() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/elevenlabs/conversations'],
    queryFn: () => fetch('/api/elevenlabs/conversations?limit=20').then(res => res.json()),
  });

  const { data: conversationDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['/api/elevenlabs/conversations', selectedConversation],
    queryFn: () => fetch(`/api/elevenlabs/conversations/${selectedConversation}`).then(res => res.json()),
    enabled: !!selectedConversation,
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Recent Calls</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Latest calls processed by your ElevenLabs agents
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Recent Conversations</CardTitle>
          <CardDescription className="text-sm">
            Latest calls processed by your ElevenLabs agents
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
              {conversationsLoading ? (
                <div className="space-y-4 p-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground px-4">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No recent conversations found</p>
                </div>
              ) : (
                <>
                  {/* Mobile card layout */}
                  <div className="block sm:hidden">
                    <div className="space-y-3 p-4">
                      {conversations.map((conversation) => (
                        <div key={conversation.conversation_id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="font-mono text-xs text-muted-foreground truncate">
                                {conversation.conversation_id}
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Bot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">
                                  {conversation.agent_name || 'Autumn Agent'}
                                </span>
                              </div>
                            </div>
                            <Badge 
                              variant={
                                conversation.call_successful === 'success' 
                                  ? 'default' 
                                  : conversation.call_successful === 'failure' 
                                    ? 'destructive' 
                                    : 'secondary'
                              }
                              className="capitalize text-xs"
                            >
                              {conversation.call_successful}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="h-3 w-3 text-muted-foreground" />
                              <span>{conversation.message_count} messages</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>
                                {conversation.call_duration_secs
                                  ? `${Math.floor(conversation.call_duration_secs / 60)}:${String(conversation.call_duration_secs % 60).padStart(2, '0')}`
                                  : 'N/A'
                                }
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            {new Date(conversation.start_time_unix_secs * 1000).toLocaleDateString()} {new Date(conversation.start_time_unix_secs * 1000).toLocaleTimeString()}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedConversation(conversation.conversation_id)}
                            className="w-full flex items-center justify-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </Button>
                        </div>
                      ))}
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
                        {conversations.map((conversation) => (
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
                        <div className="text-muted-foreground text-center py-4">
                          No candidate data extracted from this call
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transcript */}
                <div>
                  <h4 className="font-semibold mb-3">Conversation Transcript</h4>
                  <div className="space-y-3">
                    {conversationDetails.transcript && conversationDetails.transcript.length > 0 ? (
                      conversationDetails.transcript.map((entry: any, index: number) => (
                        <div
                          key={index}
                          className={`flex gap-3 p-3 rounded-lg ${
                            entry.role === 'user' ? 'bg-blue-50 dark:bg-blue-950' : 'bg-gray-50 dark:bg-gray-900'
                          }`}
                        >
                          <div className="flex-shrink-0 mt-1">
                            {entry.role === 'user' ? (
                              <User className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Mic className="h-4 w-4 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm capitalize">
                                {entry.role === 'user' ? 'Caller' : 'Agent'}
                              </span>
                              {entry.timestamp && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(entry.timestamp * 1000).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{entry.message || entry.content}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        No transcript available for this conversation
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}