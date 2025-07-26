import { useEffect } from "react";
import { useLocation } from "wouter";
import { isAuthenticated } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
    }
  }, [navigate]);

  if (!isAuthenticated()) {
    return null; // or a loading spinner
  }

  return <>{children}</>;
}