import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, Calendar, Phone, MessageCircle, Clock, User } from "lucide-react";

interface Agent {
  agent_id: string;
  name: string;
  system_prompt: string;
  language: string;
  conversation_config: {
    agent_id: string;
    phone_number?: string;
    webhook_url?: string;
  };
  created_at: string;
  updated_at: string;
}

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
  const { data: agents = [], isLoading, error } = useQuery<Agent[]>({
    queryKey: ['/api/elevenlabs/agents'],
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/elevenlabs/conversations'],
    queryFn: () => fetch('/api/elevenlabs/conversations?limit=20').then(res => res.json()),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Failed to Load Agents</h2>
          <p className="text-muted-foreground">
            Could not connect to ElevenLabs API. Please check your API key configuration.
          </p>
        </div>
      </div>
    );
  }

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.agent_id === agentId);
    return agent?.name || agentId;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ElevenLabs Integration</h1>
        <p className="text-muted-foreground">
          Your voice agents and recent call activity
        </p>
      </div>

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agents ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Recent Calls ({conversations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-6">
          {agents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Agents Found</h3>
                <p className="text-muted-foreground">
                  No voice agents are configured in your ElevenLabs account.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <Card key={agent.agent_id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Bot className="h-5 w-5" />
                          {agent.name}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {agent.agent_id}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">
                        {agent.language || 'en'}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {agent.conversation_config?.phone_number && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{agent.conversation_config.phone_number}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Created {new Date(agent.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    {agent.system_prompt && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">System Prompt</h4>
                        <p className="text-xs text-muted-foreground bg-muted p-2 rounded max-h-20 overflow-y-auto">
                          {agent.system_prompt}
                        </p>
                      </div>
                    )}
                    
                    {agent.conversation_config?.webhook_url && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Webhook</h4>
                        <p className="text-xs text-muted-foreground bg-muted p-2 rounded truncate">
                          {agent.conversation_config.webhook_url}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="conversations" className="space-y-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}