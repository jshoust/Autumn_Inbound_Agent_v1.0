import { Link, useLocation } from "wouter";
import { Building2, Users, Settings } from "lucide-react";
import logoPath from "@assets/boon_technologies_inc_logo_1753523763574.jpg";

export default function Header() {
  const [location] = useLocation();

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

          {/* Navigation */}
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
        </div>
      </div>
    </header>
  );
}