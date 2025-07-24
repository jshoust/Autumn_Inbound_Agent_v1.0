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
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recent Calls</h1>
        <p className="text-muted-foreground">
          Latest calls processed by your ElevenLabs agents
        </p>
      </div>

      <Card>
            <CardHeader>
              <CardTitle>Recent Conversations</CardTitle>
              <CardDescription>
                Latest calls processed by your ElevenLabs agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conversationsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No recent conversations found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conversation ID</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations.map((conversation) => (
                      <TableRow key={conversation.conversation_id}>
                        <TableCell className="font-mono text-sm">
                          {conversation.conversation_id.slice(0, 20)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                            <span className="max-w-32 truncate">
                              {conversation.agent_name}
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
                        <TableCell>
                          {new Date(conversation.start_time_unix_secs * 1000).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedConversation(conversation.conversation_id)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

      <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
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
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                {/* Call Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <h4 className="font-semibold mb-2">Call Information</h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>Agent:</strong> {conversationDetails.agent_name || 'Unknown'}</p>
                      <p><strong>Duration:</strong> {Math.floor(conversationDetails.call_duration_secs / 60)}:{String(conversationDetails.call_duration_secs % 60).padStart(2, '0')}</p>
                      <p><strong>Messages:</strong> {conversationDetails.message_count}</p>
                      <p><strong>Status:</strong></p>
                      <Badge className="mt-1" variant={conversationDetails.call_successful === 'success' ? 'default' : 'destructive'}>
                        {conversationDetails.call_successful}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Candidate Information</h4>
                    <div className="space-y-2 text-sm">
                      {conversationDetails.analysis ? (
                        <div className="grid grid-cols-1 gap-3">
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">First Name:</span>
                            <span>{conversationDetails.analysis.First_Name || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Last Name:</span>
                            <span>{conversationDetails.analysis.Last_Name || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Phone Number:</span>
                            <span>{conversationDetails.analysis.Phone_number || 'Not provided'}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Valid CDL Class A:</span>
                            <Badge variant={conversationDetails.analysis.question_one ? 'default' : 'destructive'}>
                              {conversationDetails.analysis.question_one ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">18+ Months Experience:</span>
                            <Badge variant={conversationDetails.analysis.Question_two ? 'default' : 'destructive'}>
                              {conversationDetails.analysis.Question_two ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Clean Record (No Violations):</span>
                            <Badge variant={conversationDetails.analysis.Question_three === false ? 'default' : 'destructive'}>
                              {conversationDetails.analysis.Question_three === false ? 'Clean' : 'Has Violations'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-background rounded border">
                            <span className="font-medium">Work Authorization:</span>
                            <Badge variant={conversationDetails.analysis.question_four ? 'default' : 'destructive'}>
                              {conversationDetails.analysis.question_four ? 'Authorized' : 'Not Authorized'}
                            </Badge>
                          </div>
                          {conversationDetails.analysis.schedule && (
                            <div className="flex justify-between items-start p-2 bg-background rounded border">
                              <span className="font-medium">Schedule:</span>
                              <span className="text-right">{conversationDetails.analysis.schedule}</span>
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