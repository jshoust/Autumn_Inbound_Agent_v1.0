import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, MessageCircle, Clock } from "lucide-react";



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
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/elevenlabs/conversations'],
    queryFn: () => fetch('/api/elevenlabs/conversations?limit=20').then(res => res.json()),
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

    </div>
  );
}