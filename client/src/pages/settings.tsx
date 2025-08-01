import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, UserPlus, Edit, Mail, Clock, Settings as SettingsIcon, Play, Pause, RefreshCw, Send, TestTube, Plus, Loader2, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth";
import Header from "@/components/header";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  receiveNotifications: boolean;
  emailNotifications?: boolean;
  reportFrequency?: string;
  createdAt: string;
}

interface ReportConfig {
  id: number;
  name: string;
  enabled: boolean;
  frequency: string;
  frequencyValue: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hourOfDay: number;
  reportType: string;
  includeMetrics: any;
  includeCallDetails: boolean;
  includeCharts: boolean;
  subjectTemplate: string;
  lastSentAt?: string;
  nextSendAt?: string;
  createdAt: string;
}

interface EmailLog {
  id: number;
  recipientEmail: string;
  subject: string;
  status: string;
  sentAt: string;
  errorMessage?: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const isAdmin = currentUser?.role === 'admin';
  
  // User management state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    username: "",
    password: "",
    email: "",
    role: "recruiter",
    receiveNotifications: true,
    emailNotifications: true,
    reportFrequency: "weekly"
  });

  // Report configuration state
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportConfig | null>(null);
  const [reportFormData, setReportFormData] = useState({
    name: "",
    enabled: true,
    frequency: "weekly",
    frequencyValue: 1,
    dayOfWeek: 1,
    dayOfMonth: 1,
    hourOfDay: 9,
    reportType: "summary",
    includeCallDetails: true,
    includeCharts: false,
    subjectTemplate: "TruckRecruit Pro - {period} Report"
  });

  const [testEmail, setTestEmail] = useState("");

  // API Queries
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: reportConfigs, isLoading: reportsLoading } = useQuery({
    queryKey: ["/api/reports/configs"],
    enabled: isAdmin,
  });

  const { data: emailLogs, isLoading: emailLogsLoading } = useQuery({
    queryKey: ["/api/reports/logs"],
    enabled: isAdmin,
  });

  const { data: schedulerStatus } = useQuery({
    queryKey: ["/api/reports/scheduler/status"],
    enabled: isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calendar Configuration State
  const [calendarConfig, setCalendarConfig] = useState<any>(null);
  const [calendarConfigMutation, setCalendarConfigMutation] = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/calendar/config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/config"] });
      toast({ title: "Calendar configuration saved" });
    },
    onError: () => {
      toast({ title: "Failed to save calendar configuration", variant: "destructive" });
    },
  });

  const [calendarTestMutation, setCalendarTestMutation] = useMutation({
    mutationFn: () => apiRequest("POST", "/api/calendar/test-connection"),
    onSuccess: () => {
      toast({ title: "Calendar connection test successful" });
    },
    onError: () => {
      toast({ title: "Calendar connection test failed", variant: "destructive" });
    },
  });

  // User Mutations
  const createUserMutation = useMutation({
    mutationFn: (userData: any) => apiRequest("POST", "/api/users", userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      resetUserForm();
      toast({ title: "User created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create user", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PATCH", `/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      setIsCreateDialogOpen(false);
      resetUserForm();
      toast({ title: "User updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  });

  // Report Configuration Mutations
  const createReportMutation = useMutation({
    mutationFn: (reportData: any) => apiRequest("POST", "/api/reports/configs", reportData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/configs"] });
      setIsReportDialogOpen(false);
      resetReportForm();
      toast({ title: "Report configuration created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create report configuration", variant: "destructive" });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PATCH", `/api/reports/configs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/configs"] });
      setEditingReport(null);
      resetReportForm();
      toast({ title: "Report configuration updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update report configuration", variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/reports/configs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/configs"] });
      toast({ title: "Report configuration deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete report configuration", variant: "destructive" });
    },
  });

  // Test and Control Mutations
  const testReportMutation = useMutation({
    mutationFn: ({ recipientEmail, reportConfigId }: { recipientEmail: string; reportConfigId?: number }) => 
      apiRequest("POST", "/api/reports/test", { recipientEmail, reportConfigId }),
    onSuccess: () => {
      toast({ title: "Test report sent successfully" });
      setTestEmail("");
    },
    onError: () => {
      toast({ title: "Failed to send test report", variant: "destructive" });
    },
  });

  const schedulerControlMutation = useMutation({
    mutationFn: (action: string) => apiRequest("POST", `/api/reports/scheduler/${action}`),
    onSuccess: (data, action) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/scheduler/status"] });
      toast({ title: `Scheduler ${action} successfully` });
    },
    onError: () => {
      toast({ title: "Scheduler operation failed", variant: "destructive" });
    },
  });

  // Email preferences mutation
  const updateEmailPreferencesMutation = useMutation({
    mutationFn: ({ field, value }: { field: string; value: any }) => {
      const updateData = { [field]: value };
      return apiRequest("PATCH", `/api/users/${currentUser?.id}/email-preferences`, updateData);
    },
    onSuccess: (_, { field, value }) => {
      // Update localStorage user data
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          user[field] = value;
          localStorage.setItem("user", JSON.stringify(user));
          
          // Update the state to reflect the change immediately
          setCurrentUser({ ...user });
        } catch (e) {
          console.error("Failed to update localStorage user data:", e);
        }
      }
      
      // Invalidate users query if it exists
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      toast({ 
        title: field === 'emailNotifications' 
          ? (value ? "Email notifications enabled" : "Email notifications disabled")
          : `Report frequency set to ${value}` 
      });
    },
    onError: () => {
      toast({ title: "Failed to update preferences", variant: "destructive" });
    },
  });

  // Helper functions
  const resetUserForm = () => {
    setUserFormData({
      username: "", password: "", email: "", role: "recruiter", 
      receiveNotifications: true, emailNotifications: true, reportFrequency: "weekly"
    });
  };

  const resetReportForm = () => {
    setReportFormData({
      name: "", enabled: true, frequency: "weekly", frequencyValue: 1,
      dayOfWeek: 1, dayOfMonth: 1, hourOfDay: 9, reportType: "summary",
      includeCallDetails: true, includeCharts: false,
      subjectTemplate: "TruckRecruit Pro - {period} Report"
    });
  };

  const handleUserEdit = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      password: "",
      email: user.email,
      role: user.role,
      receiveNotifications: user.receiveNotifications,
      emailNotifications: user.emailNotifications ?? true,
      reportFrequency: user.reportFrequency ?? "weekly"
    });
    setIsCreateDialogOpen(true);
  };

  const handleReportEdit = (report: ReportConfig) => {
    setEditingReport(report);
    setReportFormData({
      name: report.name,
      enabled: report.enabled,
      frequency: report.frequency,
      frequencyValue: report.frequencyValue,
      dayOfWeek: report.dayOfWeek ?? 1,
      dayOfMonth: report.dayOfMonth ?? 1,
      hourOfDay: report.hourOfDay,
      reportType: report.reportType,
      includeCallDetails: report.includeCallDetails,
      includeCharts: report.includeCharts,
      subjectTemplate: report.subjectTemplate
    });
    setIsReportDialogOpen(true);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data: userFormData });
    } else {
      createUserMutation.mutate(userFormData);
    }
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, data: reportFormData });
    } else {
      createReportMutation.mutate(reportFormData);
    }
  };

  const handleCalendarConfigSave = () => {
    calendarConfigMutation.mutate(calendarConfig);
  };

  const handleCalendarTest = () => {
    calendarTestMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-6">
              <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage system settings and configurations</p>
              </div>

          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-1'}`}>
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <SettingsIcon className="w-4 h-4" />
                Profile
              </TabsTrigger>
              {isAdmin && (
                <>
                  <TabsTrigger value="users" className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Users
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Reports
                  </TabsTrigger>
                  <TabsTrigger value="scheduler" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Scheduler
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profile & Email Preferences</CardTitle>
                  <CardDescription>Manage your profile and email notification settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* User Info */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">User Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Username</Label>
                        <p className="text-sm text-muted-foreground mt-1">{currentUser?.username}</p>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <p className="text-sm text-muted-foreground mt-1">{currentUser?.email || 'Not set'}</p>
                      </div>
                      <div>
                        <Label>Role</Label>
                        <p className="text-sm text-muted-foreground mt-1 capitalize">{currentUser?.role}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-lg font-medium mb-4">Email Preferences</h3>
                    <div className="space-y-4">
                      {/* Email Reports Checkbox */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <Label className="text-base font-medium">Email Reports</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive scheduled summary reports with call analytics and insights based on configured frequency
                          </p>
                        </div>
                        <Switch 
                          checked={currentUser?.emailNotifications ?? true}
                          onCheckedChange={(checked) => {
                            updateEmailPreferencesMutation.mutate({ field: "emailNotifications", value: checked });
                          }}
                        />
                      </div>

                      {/* Report Frequency (only show if email reports enabled) */}
                      {currentUser?.emailNotifications && (
                        <div className="ml-4 space-y-2">
                          <Label>Report Frequency</Label>
                          <Select 
                            value={currentUser?.reportFrequency ?? "weekly"}
                            onValueChange={(value) => {
                              updateEmailPreferencesMutation.mutate({ field: "reportFrequency", value });
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Email after every call checkbox */}
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <Label className="text-base font-medium">Email after every call</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive immediate email notifications with candidate details after each qualifying call
                          </p>
                        </div>
                        <Switch 
                          checked={currentUser?.receiveNotifications ?? true}
                          onCheckedChange={(checked) => {
                            updateEmailPreferencesMutation.mutate({ field: "receiveNotifications", value: checked });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users Tab */}
            {isAdmin && (
              <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>User Management</CardTitle>
                      <CardDescription>Manage system users and their permissions</CardDescription>
                    </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                        <Button onClick={() => { setEditingUser(null); resetUserForm(); }}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                          <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
                    <DialogDescription>
                            {editingUser ? 'Update user information and permissions' : 'Add a new user to the system'}
                    </DialogDescription>
                  </DialogHeader>
                        <form onSubmit={handleUserSubmit} className="space-y-4">
                          <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                              value={userFormData.username}
                              onChange={(e) => setUserFormData(prev => ({ ...prev, username: e.target.value }))}
                        required
                      />
                    </div>
                          <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                              value={userFormData.email}
                              onChange={(e) => setUserFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                          <div className="space-y-2">
                            <Label htmlFor="password">Password {editingUser && "(leave blank to keep current)"}</Label>
                            <Input
                              id="password"
                              type="password"
                              value={userFormData.password}
                              onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                              required={!editingUser}
                            />
                          </div>
                          <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                            <Select 
                              value={userFormData.role} 
                              onValueChange={(value) => setUserFormData(prev => ({ ...prev, role: value }))}
                            >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="recruiter">Recruiter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label>Email Notifications</Label>
                              <p className="text-sm text-muted-foreground">Receive report emails</p>
                            </div>
                            <Switch
                              checked={userFormData.emailNotifications}
                              onCheckedChange={(checked) => setUserFormData(prev => ({ ...prev, emailNotifications: checked }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Report Frequency</Label>
                            <Select 
                              value={userFormData.reportFrequency} 
                              onValueChange={(value) => setUserFormData(prev => ({ ...prev, reportFrequency: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="disabled">Disabled</SelectItem>
                              </SelectContent>
                            </Select>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                              onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createUserMutation.isPending || updateUserMutation.isPending}
                      >
                              {editingUser ? 'Update' : 'Create'} User
                      </Button>
                    </div>
                  </form>
                </DialogContent>
                </Dialog>
                  </div>
            </CardHeader>
            <CardContent>
                  {usersLoading ? (
                <div className="text-center py-4">Loading users...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                          <TableHead>Email Reports</TableHead>
                          <TableHead>Frequency</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(users) && users.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                              <Badge variant={
                                user.role === 'admin' ? 'destructive' :
                                user.role === 'manager' ? 'default' : 'secondary'
                              }>
                            {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.emailNotifications ? "✅" : "❌"}
                        </TableCell>
                        <TableCell>
                              <Badge variant="outline">{user.reportFrequency || 'weekly'}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                  onClick={() => handleUserEdit(user)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteUserMutation.mutate(user.id)}
                                disabled={deleteUserMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            )}

            {/* Reports Tab */}
            {isAdmin && (
            <TabsContent value="reports" className="space-y-6">
              <div className="grid gap-6">
                {/* Reports Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Email Reports</CardTitle>
                    <CardDescription>Configure automated email reports and scheduling</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Scheduler Status</p>
                        <p className="text-sm text-muted-foreground">
                          {schedulerStatus?.running ? "Running - Reports will be sent automatically" : "Stopped - No reports will be sent"}
                        </p>
                      </div>
                      <Badge variant={schedulerStatus?.running ? "default" : "secondary"}>
                        {schedulerStatus?.running ? "Running" : "Stopped"}
                      </Badge>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => schedulerControlMutation.mutate("start")}
                        disabled={schedulerStatus?.running || schedulerControlMutation.isPending}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => schedulerControlMutation.mutate("stop")}
                        disabled={!schedulerStatus?.running || schedulerControlMutation.isPending}
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Stop
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => schedulerControlMutation.mutate("refresh")}
                        disabled={schedulerControlMutation.isPending}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => schedulerControlMutation.mutate("force-run")}
                        disabled={schedulerControlMutation.isPending}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Force Run All
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Calendar Integration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Calendar Integration</CardTitle>
                    <CardDescription>Configure Microsoft 365 calendar auto-booking for qualified candidates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Auto-Booking Status</p>
                        <p className="text-sm text-muted-foreground">
                          {calendarConfig?.enabled ? "Enabled - Interviews will be auto-scheduled" : "Disabled - Manual scheduling only"}
                        </p>
                      </div>
                      <Badge variant={calendarConfig?.enabled ? "default" : "secondary"}>
                        {calendarConfig?.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="recruiterEmail">Recruiter Email</Label>
                        <Input
                          id="recruiterEmail"
                          value={calendarConfig?.recruiterEmail || "info@neurovista.ai"}
                          onChange={(e) => setCalendarConfig(prev => ({ ...prev, recruiterEmail: e.target.value }))}
                          placeholder="info@neurovista.ai"
                        />
                      </div>
                      <div>
                        <Label htmlFor="duration">Interview Duration (minutes)</Label>
                        <Input
                          id="duration"
                          type="number"
                          value={calendarConfig?.defaultDurationMinutes || 30}
                          onChange={(e) => setCalendarConfig(prev => ({ ...prev, defaultDurationMinutes: parseInt(e.target.value) }))}
                          min="15"
                          max="120"
                          step="15"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="businessHoursStart">Business Hours Start</Label>
                        <Input
                          id="businessHoursStart"
                          type="number"
                          value={calendarConfig?.businessHoursStart || 9}
                          onChange={(e) => setCalendarConfig(prev => ({ ...prev, businessHoursStart: parseInt(e.target.value) }))}
                          min="0"
                          max="23"
                        />
                      </div>
                      <div>
                        <Label htmlFor="businessHoursEnd">Business Hours End</Label>
                        <Input
                          id="businessHoursEnd"
                          type="number"
                          value={calendarConfig?.businessHoursEnd || 17}
                          onChange={(e) => setCalendarConfig(prev => ({ ...prev, businessHoursEnd: parseInt(e.target.value) }))}
                          min="0"
                          max="23"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="autoBook"
                          checked={calendarConfig?.autoBookInterviews || false}
                          onCheckedChange={(checked) => setCalendarConfig(prev => ({ ...prev, autoBookInterviews: checked }))}
                        />
                        <Label htmlFor="autoBook">Auto-book interviews for qualified candidates</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="sendSMS"
                          checked={calendarConfig?.sendCandidateSMS || false}
                          onCheckedChange={(checked) => setCalendarConfig(prev => ({ ...prev, sendCandidateSMS: checked }))}
                        />
                        <Label htmlFor="sendSMS">Send SMS confirmation to candidates</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="sendNotification"
                          checked={calendarConfig?.sendRecruiterNotification || false}
                          onCheckedChange={(checked) => setCalendarConfig(prev => ({ ...prev, sendRecruiterNotification: checked }))}
                        />
                        <Label htmlFor="sendNotification">Send notification to recruiter</Label>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        onClick={handleCalendarConfigSave}
                        disabled={calendarConfigMutation.isPending}
                      >
                        {calendarConfigMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Configuration
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCalendarTest}
                        disabled={calendarTestMutation.isPending}
                      >
                        {calendarTestMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <TestTube className="w-4 h-4 mr-2" />
                            Test Connection
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Email Logs</CardTitle>
                    <CardDescription>Recent email delivery history</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {emailLogsLoading ? (
                      <div className="text-center py-4">Loading email logs...</div>
                    ) : Array.isArray(emailLogs) && emailLogs.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sent At</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emailLogs.slice(0, 10).map((log: EmailLog) => (
                            <TableRow key={log.id}>
                              <TableCell>{log.recipientEmail}</TableCell>
                              <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                              <TableCell>
                                <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                                  {log.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(log.sentAt).toLocaleString()}</TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                {log.errorMessage || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">No email logs available</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            )}

            {/* Scheduler Tab */}
            {isAdmin && (
            <TabsContent value="scheduler" className="space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Scheduler Status</CardTitle>
                    <CardDescription>Monitor and control the email report scheduler</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Scheduler Status</p>
                        <p className="text-sm text-muted-foreground">
                          {schedulerStatus?.running ? "Running - Reports will be sent automatically" : "Stopped - No reports will be sent"}
                        </p>
                      </div>
                      <Badge variant={schedulerStatus?.running ? "default" : "secondary"}>
                        {schedulerStatus?.running ? "Running" : "Stopped"}
                      </Badge>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => schedulerControlMutation.mutate("start")}
                        disabled={schedulerStatus?.running || schedulerControlMutation.isPending}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => schedulerControlMutation.mutate("stop")}
                        disabled={!schedulerStatus?.running || schedulerControlMutation.isPending}
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Stop
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => schedulerControlMutation.mutate("refresh")}
                        disabled={schedulerControlMutation.isPending}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => schedulerControlMutation.mutate("force-run")}
                        disabled={schedulerControlMutation.isPending}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Force Run All
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Email Logs</CardTitle>
                    <CardDescription>Recent email delivery history</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {emailLogsLoading ? (
                      <div className="text-center py-4">Loading email logs...</div>
                    ) : Array.isArray(emailLogs) && emailLogs.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Sent At</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emailLogs.slice(0, 10).map((log: EmailLog) => (
                            <TableRow key={log.id}>
                              <TableCell>{log.recipientEmail}</TableCell>
                              <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                              <TableCell>
                                <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>
                                  {log.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{new Date(log.sentAt).toLocaleString()}</TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                {log.errorMessage || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">No email logs available</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}