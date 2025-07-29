import { Link, useLocation } from "wouter";
import { Building2, Users, Settings, LogOut, Phone, User } from "lucide-react";
import { Button } from "./ui/button";
import { logout, getCurrentUser } from "@/lib/auth";
import logoPath from "@assets/boon_technologies_inc_logo_1753523763574.jpg";
import { useQuery } from "@tanstack/react-query";

export default function Header() {
  const [location] = useLocation();
  
  // Fetch agent details
  const { data: agentData } = useQuery<{
    name: string;
    phone_number?: string;
  }>({
    queryKey: ['/api/elevenlabs/agents/agent_01k076swcgekzt88m03gegfgsr'],
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  return (
    <header className="bg-white shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <img 
              src={logoPath} 
              alt="Boon Technologies" 
              className="h-10 w-10 rounded-md flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                Driver Recruiting System
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                Boon Technologies
              </p>
            </div>
          </div>

          {/* Agent Information - Hidden on small screens, shown on medium+ */}
          {agentData && (
            <div className="hidden lg:flex items-center space-x-4 flex-shrink-0">
              <div className="flex items-center space-x-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground truncate max-w-48">
                  {agentData.name}
                </span>
              </div>
              {agentData.phone_number && (
                <div className="flex items-center space-x-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground font-mono">
                    {agentData.phone_number}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Navigation and User Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            <nav className="flex items-center space-x-1 sm:space-x-2">
              <Link href="/" className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                location === "/" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link href="/settings" className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                location === "/settings" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
                <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </nav>
            
            {/* User Actions */}
            <div className="flex items-center space-x-2">
              <span className="hidden sm:block text-xs sm:text-sm text-muted-foreground truncate max-w-24">
                {getCurrentUser()?.username}
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={logout}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}