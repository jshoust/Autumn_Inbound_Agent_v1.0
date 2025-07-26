import Header from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Settings() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="bg-muted/30 min-h-[calc(100vh-4rem)]">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">Configure your driver recruiting system</p>
          </div>

          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle className="text-foreground">System Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Settings panel coming soon...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}