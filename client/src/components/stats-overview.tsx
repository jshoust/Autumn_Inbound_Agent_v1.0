import { useQuery } from "@tanstack/react-query";
import { Phone, UserCheck, Clock, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function StatsOverview() {
  const { data: stats = {
    todayCalls: 0,
    qualified: 0,
    pending: 0,
    qualificationRate: 0
  } } = useQuery({
    queryKey: ['/api/stats'],
    refetchInterval: 3000, // Poll every 3 seconds for updated stats
    queryFn: async () => {
      const response = await fetch('/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card className="bg-white border border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Phone className="text-primary text-2xl" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Today's Calls</p>
              <p className="text-2xl font-bold text-slate-900">{stats.todayCalls}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white border border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserCheck className="text-success text-2xl" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Qualified</p>
              <p className="text-2xl font-bold text-slate-900">{stats.qualified}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white border border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="text-warning text-2xl" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Pending Review</p>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white border border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Percent className="text-primary text-2xl" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Qualification Rate</p>
              <p className="text-2xl font-bold text-slate-900">{stats.qualificationRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
