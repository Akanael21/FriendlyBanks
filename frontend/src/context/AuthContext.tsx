import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// Rôles basés sur la charte Friendly Banks
export type Role = 'president' | 'treasurer' | 'secrecom' | 'censeur' | 'accountant' | 'member' | 'guest' | 'admin';

interface User {
  id: string;
  username: string;
  role: Role;
  token: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  getRoleDisplayName: (role: Role) => string;
}

// Configuration de l'URL de base de l'API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

// === SYSTÈME DE PERMISSIONS BASÉ SUR LA CHARTE FRIENDLY BANKS ===
const rolePermissions: Record<Role, string[]> = {
  // PRÉSIDENT - Coordonne tout le projet (Article 3.5)
  president: [
    // Gestion complète des membres
    'view_members', 'manage_members', 'create_members', 'edit_members', 'delete_members',
    // Gestion complète des contributions 
    'view_contributions', 'manage_contributions', 'add_contributions', 'edit_contributions',
    // Gestion complète des prêts (Comité de Gestion - Article 4)
    'view_loans', 'manage_loans', 'approve_loans', 'reject_loans', 'edit_loans',
    // Sanctions et exclusions (Article 6)
    'view_sanctions', 'manage_sanctions', 'apply_sanctions', 'exclude_members',
    // Gouvernance complète (Article 5.4)
    'view_governance', 'manage_governance', 'organize_sessions', 'modify_charter',
    // Rapports et transparence (Article 3.4)
    'view_reports', 'generate_reports', 'view_all_transactions',
    // Administration système
    'manage_system', 'export_data', 'view_logs',
    // Berry points et calculs
    'manage_berry_points', 'view_berry_calculations'
  ],

  // CENSEUR - Co-préside + Audit (Article 3.5 + Article 5.4)
  censeur: [
    // Gestion des membres (consultation et modification limitée)
    'view_members', 'manage_members', 'edit_members',
    // Gestion des contributions (consultation et audit)
    'view_contributions', 'manage_contributions', 'add_contributions',
    // Gestion des prêts (approbation dans le comité)
    'view_loans', 'manage_loans', 'approve_loans', 'reject_loans',
    // Sanctions (participe aux décisions disciplinaires)
    'view_sanctions', 'manage_sanctions', 'apply_sanctions',
    // Gouvernance (co-préside le comité exécutif)
    'view_governance', 'manage_governance', 'organize_sessions',
    // Audit et transparence
    'view_reports', 'generate_reports', 'view_all_transactions',
    // Berry points
    'view_berry_calculations',
    // Export pour audit
    'export_data'
  ],

  // TRÉSORIER - Gère le compte commun (Article 3.2)
  treasurer: [
    // Consultation des membres
    'view_members',
    // Gestion complète des contributions (responsabilité principale)
    'view_contributions', 'manage_contributions', 'add_contributions', 'edit_contributions',
    // Consultation des prêts (suivi financier)
    'view_loans', 'track_loan_repayments',
    // Pas de sanctions directes
    'view_sanctions',
    // Transparence financière (Article 3.4)
    'view_governance', 'generate_financial_reports',
    // Rapports financiers mensuels
    'view_reports', 'generate_reports', 'view_financial_transactions',
    // Berry points (calculs financiers)
    'view_berry_calculations',
    // Export financier
    'export_financial_data'
  ],

  // SÉCRÉCOM - Secrétariat et communications
  secrecom: [
    // Gestion administrative des membres
    'view_members', 'manage_members', 'edit_members',
    // Consultation des contributions
    'view_contributions', 'add_contributions',
    // Consultation des prêts
    'view_loans',
    // Gestion des sanctions (secrétariat)
    'view_sanctions',
    // Gouvernance (organisation des réunions - Article 3.6-3.7)
    'view_governance', 'manage_governance', 'organize_meetings',
    // Rapports (secrétariat)
    'view_reports', 'generate_meeting_reports',
    // Communications
    'manage_communications', 'send_notifications'
  ],

  // COMPTABLE - Aide à la comptabilité
  accountant: [
    // Consultation des membres
    'view_members',
    // Gestion des contributions (aide comptable)
    'view_contributions', 'manage_contributions', 'add_contributions',
    // Consultation des prêts (analyse financière)
    'view_loans', 'view_loan_details',
    // Consultation des sanctions
    'view_sanctions',
    // Consultation de la gouvernance
    'view_governance',
    // Rapports comptables
    'view_reports', 'generate_accounting_reports',
    // Berry points (calculs)
    'view_berry_calculations',
    // Export comptable
    'export_accounting_data'
  ],

  // MEMBRE - Participe aux décisions + Cotisations + Emprunts
  member: [
    // Consultation des membres (transparence)
    'view_members',
    // Ses propres contributions
    'view_contributions', 'add_own_contributions', 'view_own_contributions',
    // Demandes de prêts (Article 4)
    'view_loans', 'request_loans', 'view_own_loans',
    // Consultation des sanctions
    'view_sanctions',
    // Participation à la gouvernance (Article 5.5-5.6)
    'view_governance', 'participate_in_votes',
    // Consultation des rapports mensuels
    'view_reports', 'view_monthly_reports',
    // Ses propres Berry points
    'view_own_berry_points',
    // Profil personnel
    'manage_own_profile'
  ],

  // INVITÉ - Accès très limité
  guest: [
    // Consultation limitée
    'view_basic_info',
    // Profil personnel seulement
    'manage_own_profile'
  ],

  // ADMIN - Accès technique complet (séparé de la gouvernance métier)
  admin: [
    'manage_all', 'system_admin', 'technical_maintenance'
  ]
};

// Noms d'affichage des rôles en français
const roleDisplayNames: Record<Role, string> = {
  president: 'Président',
  treasurer: 'Trésorier', 
  secrecom: 'Sécrécom',
  censeur: 'Censeur',
  accountant: 'Comptable',
  member: 'Membre',
  guest: 'Invité',
  admin: 'Administrateur'
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Load user from localStorage if exists
    const storedUser = localStorage.getItem('friendlybanks_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Call backend token endpoint
      const response = await fetch(`${API_BASE_URL}/token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      const accessToken = data.access;
      const refreshToken = data.refresh;

      // Fetch user info using access token
      const userResponse = await fetch(`${API_BASE_URL}/users/`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!userResponse.ok) {
        return false;
      }
      
      const users = await userResponse.json();
      // Find user info by username
      const userInfo = users.find((u: any) => u.username === username);
      if (!userInfo) {
        return false;
      }

      const loggedInUser: User = {
        id: userInfo.id || userInfo.username,
        username: userInfo.username,
        role: userInfo.role as Role, // Utiliser le rôle directement du backend
        token: accessToken,
      };

      localStorage.setItem('friendlybanks_user', JSON.stringify(loggedInUser));
      localStorage.setItem('friendlybanks_refresh', refreshToken);
      setUser(loggedInUser);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('friendlybanks_user');
    localStorage.removeItem('friendlybanks_refresh');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // L'admin technique a tous les droits
    if (user.role === 'admin') return true;
    
    // Le président a tous les droits métier
    if (user.role === 'president') {
      return rolePermissions.president.includes(permission) || permission !== 'system_admin';
    }
    
    // Vérifier les permissions spécifiques du rôle
    const permissions = rolePermissions[user.role] || [];
    return permissions.includes(permission);
  };

  const getRoleDisplayName = (role: Role): string => {
    return roleDisplayNames[role] || role;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
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