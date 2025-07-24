import { useMutation } from "@tanstack/react-query";
import { X, Check, FileText, Phone, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { Candidate } from "@shared/schema";

interface TranscriptModalProps {
  candidate: Candidate;
  onClose: () => void;
  onRefetch: () => void;
}

export default function TranscriptModal({ candidate, onClose, onRefetch }: TranscriptModalProps) {
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
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update candidate status",
        variant: "destructive",
      });
    }
  });

  const formatCallDuration = (createdAt: Date | null) => {
    if (!createdAt) return 'Unknown';
    // Mock duration calculation - in real app this would come from call data
    return `${Math.floor(Math.random() * 8) + 2}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
  };

  const parseTranscript = (transcript: string | null) => {
    if (!transcript) return [];
    
    // Simple transcript parsing - in real app this would be more sophisticated
    const lines = transcript.split('\n').filter(line => line.trim());
    return lines.map((line, index) => ({
      speaker: index % 2 === 0 ? 'AGENT' : 'CALLER',
      text: line.trim()
    }));
  };

  const transcriptLines = parseTranscript(candidate.transcript);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Call Transcript - #{candidate.callId || candidate.id}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Call Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <label className="text-sm font-medium text-slate-600 flex items-center">
                <Phone className="w-4 h-4 mr-1" />
                Phone Number
              </label>
              <p className="text-sm text-slate-900">{candidate.phone}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <label className="text-sm font-medium text-slate-600 flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                Call Duration
              </label>
              <p className="text-sm text-slate-900">{formatCallDuration(candidate.createdAt)}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <label className="text-sm font-medium text-slate-600 flex items-center">
                <CreditCard className="w-4 h-4 mr-1" />
                CDL Status
              </label>
              <p className="text-sm text-slate-900">{candidate.cdlType || 'Not specified'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <label className="text-sm font-medium text-slate-600">Experience</label>
              <p className="text-sm text-slate-900">{candidate.experience || 'Not specified'}</p>
            </div>
          </div>

          {/* Transcript */}
          <div>
            <h4 className="text-md font-medium text-slate-900 mb-3 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Full Transcript
            </h4>
            <div className="bg-slate-50 p-4 rounded-lg max-h-64 overflow-y-auto">
              {transcriptLines.length > 0 ? (
                <div className="space-y-3">
                  {transcriptLines.map((line, index) => (
                    <div key={index} className="flex">
                      <div className="flex-shrink-0 w-16">
                        <span className={`text-xs font-medium ${
                          line.speaker === 'AGENT' ? 'text-slate-600' : 'text-primary'
                        }`}>
                          {line.speaker}:
                        </span>
                      </div>
                      <p className="text-sm text-slate-800">{line.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-500">No transcript available for this call</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              className="bg-success hover:bg-green-700 text-white"
              onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: true })}
              disabled={qualifyMutation.isPending}
            >
              <Check className="w-4 h-4 mr-2" />
              Qualify Candidate
            </Button>
            <Button
              variant="destructive"
              className="bg-danger hover:bg-red-700"
              onClick={() => qualifyMutation.mutate({ id: candidate.id, qualified: false })}
              disabled={qualifyMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" />
              Reject Candidate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
