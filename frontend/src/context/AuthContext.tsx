import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// --- INTERFACES PARTAGÉES ---
export type Role = 'president' | 'treasurer' | 'secrecom' | 'censeur' | 'accountant' | 'member' | 'guest' | 'admin';

export interface ApiMember {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  berry_score: number;
  shares: number;
}

interface User {
  id: string;
  username: string;
  role: Role;
  token: string;
}

interface AuthContextType {
  user: User | null;
  members: ApiMember[];
  fetchMembers: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  getRoleDisplayName: (role: Role) => string;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

const rolePermissions: Record<Role, string[]> = {
  president: [ 'view_members', 'create_members', 'edit_members', 'delete_members', 'view_contributions', 'add_contributions', 'edit_contributions', 'manage_contributions', 'view_loans', 'approve_loans', 'reject_loans', 'manage_loans', 'view_sanctions', 'manage_sanctions', 'view_governance', 'manage_governance', 'organize_sessions', 'view_reports' ],
  censeur: [ 'view_members', 'edit_members', 'view_contributions', 'add_contributions', 'view_loans', 'approve_loans', 'reject_loans', 'view_sanctions', 'participate_in_votes', 'view_governance', 'organize_sessions', 'view_reports' ],
  treasurer: [ 'view_members', 'view_contributions', 'add_contributions', 'edit_contributions', 'manage_contributions', 'view_loans', 'add_repayments', 'view_reports' ],
  secrecom: [ 'view_members', 'create_members', 'edit_members', 'view_contributions', 'view_loans', 'view_sanctions', 'view_governance', 'organize_sessions' ],
  accountant: [ 'view_members', 'view_contributions', 'add_contributions', 'view_loans', 'view_reports' ],
  member: [ 'view_members', 'view_contributions', 'view_loans', 'add_loan_requests', 'view_sanctions', 'participate_in_votes', 'view_governance', 'view_reports' ],
  guest: [ 'view_basic_info' ],
  admin: [ 'manage_all', 'system_admin' ]
};

const roleDisplayNames: Record<Role, string> = {
  president: 'Président', treasurer: 'Trésorier', secrecom: 'Sécrécom', censeur: 'Censeur',
  accountant: 'Comptable', member: 'Membre', guest: 'Invité', admin: 'Administrateur'
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const navigate = useNavigate();

  const fetchMembers = useCallback(async (token: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/members/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      } else {
        throw new Error('Failed to fetch members');
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
      // Si le token est invalide, déconnecter l'utilisateur
      if (error instanceof Error && error.message.includes('401')) {
        logout();
      }
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('friendlybanks_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.token) {
        fetchMembers(parsedUser.token);
      }
    }
  }, [fetchMembers]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/token/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      const accessToken = data.access;
      const refreshToken = data.refresh;

      const userResponse = await fetch(`${API_BASE_URL}/users/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (!userResponse.ok) return false;
      
      const users = await userResponse.json();
      const userInfo = users.find((u: any) => u.username === username);
      if (!userInfo) return false;

      const loggedInUser: User = {
        id: userInfo.id, username: userInfo.username,
        role: userInfo.role as Role, token: accessToken,
      };

      localStorage.setItem('friendlybanks_user', JSON.stringify(loggedInUser));
      localStorage.setItem('friendlybanks_refresh', refreshToken);
      setUser(loggedInUser);
      
      await fetchMembers(accessToken);

      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setMembers([]);
    localStorage.removeItem('friendlybanks_user');
    localStorage.removeItem('friendlybanks_refresh');
    navigate('/login');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    const permissions = rolePermissions[user.role] || [];
    return permissions.includes(permission);
  };

  const getRoleDisplayName = (role: Role): string => {
    return roleDisplayNames[role] || role;
  };

  // Ajout de la fonction pour rafraîchir les membres manuellement
  const refreshMembers = useCallback(async () => {
    if (user?.token) {
        await fetchMembers(user.token);
    }
  }, [user, fetchMembers]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      members, 
      fetchMembers: refreshMembers, 
      login, 
      logout, 
      isAuthenticated: !!user, 
      hasPermission,
      getRoleDisplayName 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};