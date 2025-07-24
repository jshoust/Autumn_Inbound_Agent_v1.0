import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Settings as SettingsIcon } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-6">
              <h1 className="text-lg sm:text-xl font-semibold truncate">TruckRecruit Pro</h1>
              <div className="flex space-x-1">
                <Link href="/">
                  <Button 
                    variant={location === "/" ? "default" : "ghost"} 
                    size="sm"
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button 
                    variant={location === "/settings" ? "default" : "ghost"} 
                    size="sm"
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3"
                  >
                    <SettingsIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="container mx-auto px-4 py-4 sm:py-6">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
