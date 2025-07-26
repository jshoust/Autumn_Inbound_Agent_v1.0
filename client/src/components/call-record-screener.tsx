import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Phone, 
  Calendar,
  User,
  Truck,
  FileText,
  DollarSign,
  Timer
} from "lucide-react";

interface CallRecord {
  id: number;
  conversationId: string;
  agentId: string;
  status: string;
  rawData: any;
  extractedData: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    cdlA?: boolean;
    experience24Months?: boolean;
    hopperExperience?: boolean;
    otrAvailable?: boolean;
    cleanRecord?: boolean;
    workEligible?: boolean;
    interviewSchedule?: string;
    callDuration?: number;
    callCost?: number;
    callSuccessful?: boolean;
    qualified?: boolean;
  };
  createdAt: string;
}

interface QualificationBadgeProps {
  label: string;
  value?: boolean;
  variant?: 'positive' | 'negative' | 'neutral';
}

function QualificationBadge({ label, value, variant = 'neutral' }: QualificationBadgeProps) {
  const getVariant = () => {
    if (variant === 'positive') return value ? 'default' : 'secondary';
    if (variant === 'negative') return value ? 'destructive' : 'default';
    return value ? 'default' : 'secondary';
  };

  const getIcon = () => {
    if (value === true) return <CheckCircle className="w-3 h-3" />;
    if (value === false) return <XCircle className="w-3 h-3" />;
    return <Clock className="w-3 h-3" />;
  };

  return (
    <Badge variant={getVariant()} className="flex items-center gap-1 text-xs">
      {getIcon()}
      {label}
    </Badge>
  );
}

function CallRecordCard({ record }: { record: CallRecord }) {
  const data = record.extractedData;
  const [expanded, setExpanded] = useState(false);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCost = (cents?: number) => {
    if (!cents) return '$0.00';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">
                {data.firstName || 'Unknown'} {data.lastName || ''}
              </CardTitle>
            </div>
            <Badge 
              variant={data.qualified ? "default" : data.callSuccessful ? "secondary" : "destructive"}
              className="ml-2"
            >
              {data.qualified ? 'QUALIFIED' : data.callSuccessful ? 'COMPLETED' : 'INCOMPLETE'}
            </Badge>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {new Date(record.createdAt).toLocaleString()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium">{data.phoneNumber || 'Not provided'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" />
            <div>
              <p className="text-xs text-muted-foreground">Interview Scheduled</p>
              <p className="font-medium">{data.interviewSchedule || 'Not scheduled'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-orange-600" />
            <div>
              <p className="text-xs text-muted-foreground">Call Duration</p>
              <p className="font-medium">{formatDuration(data.callDuration)}</p>
            </div>
          </div>
        </div>

        {/* Qualifications Grid */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Driver Qualifications
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <QualificationBadge 
              label="CDL-A License" 
              value={data.cdlA}
              variant="positive"
            />
            <QualificationBadge 
              label="24+ Months Exp" 
              value={data.experience24Months}
              variant="positive"
            />
            <QualificationBadge 
              label="Hopper Experience" 
              value={data.hopperExperience}
              variant="positive"
            />
            <QualificationBadge 
              label="OTR Available" 
              value={data.otrAvailable}
              variant="positive"
            />
            <QualificationBadge 
              label="Clean Record" 
              value={data.cleanRecord}
              variant="negative"
            />
            <QualificationBadge 
              label="Work Eligible" 
              value={data.workEligible}
              variant="positive"
            />
          </div>
        </div>

        {/* Call Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 border rounded-lg">
          <div className="text-center">
            <DollarSign className="w-4 h-4 mx-auto text-green-600 mb-1" />
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="font-medium text-sm">{formatCost(data.callCost)}</p>
          </div>
          <div className="text-center">
            <Timer className="w-4 h-4 mx-auto text-blue-600 mb-1" />
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="font-medium text-sm">{formatDuration(data.callDuration)}</p>
          </div>
          <div className="text-center">
            <FileText className="w-4 h-4 mx-auto text-purple-600 mb-1" />
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-medium text-sm capitalize">{record.status}</p>
          </div>
          <div className="text-center">
            <Clock className="w-4 h-4 mx-auto text-orange-600 mb-1" />
            <p className="text-xs text-muted-foreground">Time</p>
            <p className="font-medium text-sm">{new Date(record.createdAt).toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Expand/Collapse for Raw Data */}
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide Details' : 'Show Raw Data'}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h5 className="font-semibold mb-2">Raw API Response</h5>
            <pre className="text-xs overflow-auto max-h-96 bg-white p-3 rounded border">
              {JSON.stringify(record.rawData, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CallRecordScreener() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: callRecords = [], isLoading, refetch } = useQuery<CallRecord[]>({
    queryKey: ['/api/call-records'],
    refetchInterval: 5000, // Poll every 5 seconds for new calls
  });

  const filteredRecords = callRecords.filter(record => {
    if (!searchTerm) return true;
    const data = record.extractedData;
    const searchLower = searchTerm.toLowerCase();
    
    return (
      data.firstName?.toLowerCase().includes(searchLower) ||
      data.lastName?.toLowerCase().includes(searchLower) ||
      data.phoneNumber?.includes(searchTerm) ||
      record.conversationId.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading call records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Call Records Screener</h1>
          <p className="text-muted-foreground">
            Live call screening dashboard for agent: agent_01k076swcgekzt88m03gegfgsr
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          Refresh
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <Input
          placeholder="Search by name, phone, or conversation ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <div className="text-sm text-muted-foreground">
          {filteredRecords.length} record(s) found
        </div>
      </div>

      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                No call records found. Records will appear here automatically when calls are completed.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRecords.map((record) => (
            <CallRecordCard key={record.id} record={record} />
          ))
        )}
      </div>
    </div>
  );
} 