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
          <div className="flex items-center space-x-4">
            <img 
              src={logoPath} 
              alt="Boon Technologies" 
              className="h-10 w-10 rounded-md"
            />
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Driver Recruiting System
              </h1>
              <p className="text-sm text-muted-foreground">
                Boon Technologies
              </p>
            </div>
          </div>

          {/* Agent Information */}
          {agentData && (
            <div className="hidden md:flex items-center space-x-3">
              <div className="flex items-center space-x-1 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">
                  {agentData.name}
                </span>
              </div>
              {agentData.phone_number && (
                <div className="flex items-center space-x-1 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {agentData.phone_number}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center space-x-4">
            <nav className="flex items-center space-x-1">
              <Link href="/" className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location === "/" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
                <Users className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link href="/settings" className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location === "/settings" 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}>
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </nav>
            
            {/* User Actions */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {getCurrentUser()?.username}
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={logout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}