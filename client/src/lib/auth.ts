import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  username: string;
  email?: string;
  role?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  const token = localStorage.getItem("auth_token");
  if (!token) return false;
  
  // Basic JWT expiry check (optional - the server will also validate)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp > currentTime;
  } catch {
    return false;
  }
}

// Get current user from localStorage
export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// Get auth token
export function getAuthToken(): string | null {
  return localStorage.getItem("auth_token");
}

// Login function
export async function login(username: string, password: string): Promise<AuthResponse> {
  const response = await apiRequest("POST", "/api/auth/login", { username, password });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Login failed");
  }

  const data = await response.json();
  
  // Store auth data
  localStorage.setItem("auth_token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  
  return data;
}

// Logout function
export function logout(): void {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

// Add auth header to requests
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}