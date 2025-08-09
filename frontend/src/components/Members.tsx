// src/components/Members.tsx - VERSION CONNECTÉE À L'API DJANGO

import React, { useState, useEffect, useMemo, ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPen, faTrash, faRefresh } from '@fortawesome/free-solid-svg-icons';

// --- HOOK POUR LA RESPONSIVITÉ ---
const useWindowSize = () => {
    const [size, setSize] = useState([window.innerWidth]);
    useEffect(() => {
        const handleResize = () => setSize([window.innerWidth]);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return { width: size[0] };
};

// --- INTERFACES ADAPTÉES À VOTRE API DJANGO ---
interface ApiUser {
  id: number;
  username: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
}

interface ApiMember {
  id: number;
  user: ApiUser;
  berry_score: number;
  shares: number;
}

// Interface pour le formulaire (création/modification)
interface MemberFormData {
  id?: number; // Optionnel, présent seulement lors de l'édition
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
}

type MemberStatus = 'Actif' | 'Suspendu' | 'Exclu';
const MOBILE_BREAKPOINT = 1024;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

// --- COMPOSANT PRINCIPAL ---
const Members: React.FC = () => {
  const { user, hasPermission, getRoleDisplayName } = useAuth();
  const { width } = useWindowSize();
  const isMobile = width < MOBILE_BREAKPOINT;

  // États
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberFormData | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FONCTIONS API ---
  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/members/`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des membres');
      console.error('Erreur lors du chargement des membres:', err);
    } finally {
      setLoading(false);
    }
  };

  // Charger les membres au montage du composant
  useEffect(() => {
    if (user?.token) {
      fetchMembers();
    }
  }, [user?.token]);

  // --- FILTRAGE DES MEMBRES ---
  const filteredMembers = useMemo(() => {
    return members
      .filter(m => {
        const fullName = `${m.user.first_name} ${m.user.last_name}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
      })
      .filter(m => (roleFilter ? m.user.role === roleFilter.toLowerCase() : true))
      // Note: Le statut n'est pas encore dans votre modèle Django, donc on l'ignore pour l'instant
  }, [members, searchTerm, roleFilter]);

  // --- GESTION DU MODAL ---
  const openModal = (member: ApiMember | null = null) => {
    if (!hasPermission('manage_members') && !hasPermission('create_members')) {
      alert("Action non autorisée. Vous n'avez pas les permissions pour gérer les membres.");
      return;
    }
    
    if (member) {
      // Vérification pour la modification
      if (!hasPermission('edit_members')) {
        alert("Vous n'avez pas la permission de modifier les membres.");
        return;
      }
      
      setEditingMember({
        id: member.id, // Ajouter l'ID pour l'édition
        firstName: member.user.first_name,
        lastName: member.user.last_name,
        email: member.user.email,
        phone: '', // Pas encore dans votre modèle
        role: member.user.role,
      });
    } else {
      // Vérification pour la création
      if (!hasPermission('create_members')) {
        alert("Vous n'avez pas la permission de créer de nouveaux membres.");
        return;
      }
      
      setEditingMember({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'member',
      });
    }
    
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingMember(null);
    setFormErrors({});
    setIsSubmitting(false);
  };

  // --- CRÉATION/MODIFICATION D'UN MEMBRE ---
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMember) return;

    setIsSubmitting(true);
    setFormErrors({});

    try {
      // Validation côté client
      const errors: { [key: string]: string } = {};
      if (!editingMember.firstName.trim()) errors.firstName = 'Prénom requis';
      if (!editingMember.lastName.trim()) errors.lastName = 'Nom requis';
      if (!editingMember.email.trim()) errors.email = 'Email requis';
      if (!editingMember.role) errors.role = 'Rôle requis';

      // Vérifier l'unicité de l'email côté client (seulement pour création)
      if (!editingMember.id) {
        const emailExists = members.some(m => 
          m.user.email.toLowerCase() === editingMember.email.toLowerCase()
        );
        if (emailExists) {
          errors.email = 'Cet email est déjà utilisé par un autre membre';
        }
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      let response;
      
      if (editingMember.id) {
        // MODIFICATION D'UN MEMBRE EXISTANT
        response = await fetch(`${API_BASE_URL}/members/${editingMember.id}/update-role/`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${user?.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: editingMember.firstName,
            lastName: editingMember.lastName,
            role: editingMember.role,
          }),
        });
      } else {
        // CRÉATION D'UN NOUVEAU MEMBRE
        response = await fetch(`${API_BASE_URL}/members/create-with-credentials/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user?.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editingMember),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur lors de ${editingMember.id ? 'la modification' : 'la création'} du membre`);
      }

      const result = await response.json();
      
      // Actualiser la liste des membres
      await fetchMembers();
      
      if (editingMember.id) {
        alert('Membre modifié avec succès !');
      } else {
        alert(`Membre créé avec succès ! Mot de passe généré: ${result.generated_password}`);
      }
      
      closeModal();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
      console.error('Erreur lors de la sauvegarde:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SUPPRESSION D'UN MEMBRE ---
  const handleDelete = async (memberId: number) => {
    if (!hasPermission('delete_members')) {
      alert("Vous n'avez pas la permission de supprimer des membres.");
      return;
    }

    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/members/${memberId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la suppression');
      }

      // Actualiser la liste
      await fetchMembers();
      alert('Membre supprimé avec succès');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      console.error('Erreur lors de la suppression:', err);
    }
  };

  // --- GESTION DES CHAMPS DU FORMULAIRE ---
  const handleInputChange = (field: keyof MemberFormData, value: string) => {
    if (editingMember) {
      setEditingMember(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  // --- VÉRIFICATION DES PERMISSIONS ---
  if (!hasPermission('view_members')) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h3>Accès refusé</h3>
          <p>Vous n'avez pas la permission de consulter la liste des membres.</p>
          <p>Votre rôle actuel : <strong>{user?.role ? getRoleDisplayName(user.role as any) : 'Non défini'}</strong></p>
        </div>
      </div>
    );
  }

  // --- AFFICHAGE DE L'ERREUR ---
  if (error && !loading) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h3>Erreur de chargement</h3>
          <p>{error}</p>
          <button onClick={fetchMembers} style={styles.button}>
            <FontAwesomeIcon icon={faRefresh} style={{ marginRight: '8px' }} />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header style={styles.header}>
        <h2 style={styles.headerTitle}>
          Gestion des Membres
          {loading && <span style={styles.loadingText}> (Chargement...)</span>}
        </h2>
        {hasPermission('create_members') && (
          <div style={styles.headerActions}>
            <button onClick={fetchMembers} style={{...styles.button, backgroundColor: '#6b7280'}}>
              <FontAwesomeIcon icon={faRefresh} style={{ marginRight: '8px' }} />
              Actualiser
            </button>
            <button onClick={() => openModal()} style={styles.button}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
              Ajouter un Membre
            </button>
          </div>
        )}
      </header>
      
      <div style={styles.controlsSection}>
        <input 
          type="text" 
          placeholder="Rechercher par nom..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          style={styles.searchInput} 
        />
        <select 
          value={roleFilter} 
          onChange={e => setRoleFilter(e.target.value)} 
          style={styles.filterSelect}
        >
          <option value="">Tous les rôles</option>
          <option value="admin">Administrateur</option>
          <option value="president">Président</option>
          <option value="treasurer">Trésorier</option>
          <option value="secrecom">Sécrécom</option>
          <option value="censeur">Censeur</option>
          <option value="accountant">Comptable</option>
          <option value="member">Membre</option>
          <option value="guest">Invité</option>
        </select>
      </div>

      {loading ? (
        <div style={styles.loadingContainer}>
          <p>Chargement des membres...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div style={styles.emptyState}>
          <p>Aucun membre trouvé.</p>
          {members.length === 0 && (
            <p>Commencez par ajouter votre premier membre !</p>
          )}
        </div>
      ) : (
        isMobile ? 
          <MobileMemberList members={filteredMembers} onEdit={openModal} onDelete={handleDelete} hasPermission={hasPermission} /> : 
          <DesktopMemberTable members={filteredMembers} onEdit={openModal} onDelete={handleDelete} hasPermission={hasPermission} />
      )}

      {isModalOpen && editingMember && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>
              {editingMember.id ? 'Modifier le Membre' : 'Ajouter un Nouveau Membre'}
            </h3>
            <form onSubmit={handleSave} style={styles.modalForm}>
              <ModalInput 
                label="Prénom" 
                value={editingMember.firstName} 
                onChange={(e) => handleInputChange('firstName', e.target.value)} 
                error={formErrors.firstName}
                disabled={isSubmitting}
              />
              <ModalInput 
                label="Nom" 
                value={editingMember.lastName} 
                onChange={(e) => handleInputChange('lastName', e.target.value)} 
                error={formErrors.lastName}
                disabled={isSubmitting}
              />
              <ModalInput 
                label="Email" 
                type="email" 
                value={editingMember.email} 
                onChange={(e) => handleInputChange('email', e.target.value)} 
                error={formErrors.email}
                disabled={isSubmitting || !!editingMember.id} // Désactiver email en modification
              />
              <ModalSelect 
                label="Rôle" 
                value={editingMember.role} 
                onChange={(e) => handleInputChange('role', e.target.value)} 
                error={formErrors.role}
                disabled={isSubmitting}
              >
                <option value="member">Membre</option>
                <option value="president">Président</option>
                <option value="treasurer">Trésorier</option>
                <option value="secrecom">Sécrécom</option>
                <option value="censeur">Censeur</option>
                <option value="accountant">Comptable</option>
                <option value="guest">Invité</option>
              </ModalSelect>
              
              <div style={styles.modalActions}>
                <button 
                  type="button" 
                  onClick={closeModal} 
                  style={{...styles.button, backgroundColor: '#6b7280'}}
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  style={styles.button}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 
                    (editingMember.id ? 'Modification...' : 'Création...') : 
                    (editingMember.id ? 'Modifier le Membre' : 'Créer le Membre')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// --- COMPOSANTS D'AFFICHAGE ---
const DesktopMemberTable: React.FC<{
  members: ApiMember[], 
  onEdit: (m: ApiMember) => void, 
  onDelete: (id: number) => void, 
  hasPermission: any
}> = ({ members, onEdit, onDelete, hasPermission }) => (
  <div style={styles.tableContainer}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Nom</th>
          <th style={styles.th}>Email</th>
          <th style={styles.th}>Rôle</th>
          <th style={styles.th}>Points Berry</th>
          <th style={styles.th}>Parts</th>
          {(hasPermission('edit_members') || hasPermission('delete_members')) && <th style={styles.th}>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {members.map(member => (
          <tr key={member.id}>
            <td style={styles.td}>
              <div style={{fontWeight: 'bold'}}>
                {member.user.first_name} {member.user.last_name}
              </div>
              <div style={{fontSize: '12px', color: '#6b7280'}}>
                ID: {member.id}
              </div>
            </td>
            <td style={styles.td}>{member.user.email}</td>
            <td style={styles.td}>
              <RoleChip role={member.user.role} />
            </td>
            <td style={styles.td}>
              <div style={{fontWeight: 'bold', fontSize: '16px'}}>
                {member.berry_score}
              </div>
              <LevelChip score={member.berry_score} />
            </td>
            <td style={styles.td}>{member.shares}</td>
            {(hasPermission('edit_members') || hasPermission('delete_members')) && (
              <td style={styles.td}>
                <div style={{display: 'flex', gap: '8px'}}>
                  {hasPermission('edit_members') && (
                    <button 
                      onClick={() => onEdit(member)} 
                      style={{...styles.actionButton, backgroundColor: '#3b82f6'}} 
                      title="Modifier"
                    >
                      <FontAwesomeIcon icon={faPen}/>
                    </button>
                  )}
                  {hasPermission('delete_members') && (
                    <button 
                      onClick={() => onDelete(member.id)} 
                      style={{...styles.actionButton, backgroundColor: '#ef4444'}} 
                      title="Supprimer"
                    >
                      <FontAwesomeIcon icon={faTrash}/>
                    </button>
                  )}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MobileMemberList: React.FC<{
  members: ApiMember[], 
  onEdit: (m: ApiMember) => void, 
  onDelete: (id: number) => void, 
  hasPermission: any
}> = ({ members, onEdit, onDelete, hasPermission }) => (
  <div style={styles.mobileList}>
    {members.map(member => (
      <div key={member.id} style={styles.mobileCard}>
        <div style={styles.mobileCardHeader}>
          <div>
            <span style={styles.mobileCardTitle}>
              {member.user.first_name} {member.user.last_name}
            </span>
            <RoleChip role={member.user.role} />
          </div>
        </div>
        <div style={styles.mobileCardBody}>
          <div style={styles.mobileCardRow}>
            <span>Points Berry:</span> 
            <strong>{member.berry_score}</strong>
          </div>
          <div style={styles.mobileCardRow}>
            <span>Niveau:</span> 
            <LevelChip score={member.berry_score} />
          </div>
          <div style={styles.mobileCardRow}>
            <span>Parts:</span> 
            <span>{member.shares}</span>
          </div>
          <div style={styles.mobileCardRow}>
            <span>Email:</span> 
            <span>{member.user.email}</span>
          </div>
        </div>
        {(hasPermission('edit_members') || hasPermission('delete_members')) && (
          <div style={styles.mobileCardFooter}>
            {hasPermission('edit_members') && (
              <button 
                onClick={() => onEdit(member)} 
                style={{...styles.button, flex: 1}}
              >
                <FontAwesomeIcon icon={faPen} style={{marginRight: '8px'}}/> 
                Modifier
              </button>
            )}
            {hasPermission('delete_members') && (
              <button 
                onClick={() => onDelete(member.id)} 
                style={{...styles.button, flex: 1, backgroundColor: '#ef4444'}}
              >
                <FontAwesomeIcon icon={faTrash} style={{marginRight: '8px'}}/> 
                Supprimer
              </button>
            )}
          </div>
        )}
      </div>
    ))}
  </div>
);

// --- SOUS-COMPOSANTS ---
const RoleChip: React.FC<{ role: string }> = ({ role }) => {
  const roleColors: Record<string, string> = {
    'admin': '#dbeafe',
    'president': '#dcfce7',
    'treasurer': '#fef3c7',
    'secrecom': '#e5e7eb',
    'censeur': '#f3e8ff',
    'accountant': '#d1fae5',
    'member': '#f3f4f6',
    'guest': '#e5e7eb'
  };
  
  const roleLabels: Record<string, string> = {
    'admin': 'Admin',
    'president': 'Président',
    'treasurer': 'Trésorier',
    'secrecom': 'Sécrécom',
    'censeur': 'Censeur',
    'accountant': 'Comptable',
    'member': 'Membre',
    'guest': 'Invité'
  };
  
  return (
    <span style={{ 
      ...styles.chip, 
      backgroundColor: roleColors[role] || '#e5e7eb', 
      color: '#374151' 
    }}>
      {roleLabels[role] || role}
    </span>
  );
};

const LevelChip: React.FC<{ score: number }> = ({ score }) => {
  const getLevel = (score: number) => {
    if (score >= 400) return { level: 'Platinum', color: '#f3e8ff' };
    if (score >= 200) return { level: 'Gold', color: '#fef3c7' };
    if (score >= 100) return { level: 'Silver', color: '#f1f5f9' };
    return { level: 'Bronze', color: '#fef2f2' };
  };
  
  const { level, color } = getLevel(score);
  
  return (
    <span style={{ 
      ...styles.chip, 
      backgroundColor: color, 
      color: '#374151' 
    }}>
      {level}
    </span>
  );
};

// --- COMPOSANTS DE FORMULAIRE ---
interface ModalInputProps extends InputHTMLAttributes<HTMLInputElement> { 
  label: string; 
  error?: string; 
}

const ModalInput: React.FC<ModalInputProps> = ({ label, error, ...props }) => (
  <div>
    <label style={styles.modalLabel}>{label}</label>
    <input 
      style={{
        ...styles.modalInput, 
        ...(error && styles.inputError)
      }} 
      {...props} 
    />
    {error && <p style={styles.errorMessage}>{error}</p>}
  </div>
);

interface ModalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> { 
  label: string; 
  error?: string; 
  children: ReactNode; 
}

const ModalSelect: React.FC<ModalSelectProps> = ({ label, error, children, ...props }) => (
  <div>
    <label style={styles.modalLabel}>{label}</label>
    <select 
      style={{
        ...styles.modalInput, 
        ...(error && styles.inputError)
      }} 
      {...props}
    >
      {children}
    </select>
    {error && <p style={styles.errorMessage}>{error}</p>}
  </div>
);

// --- STYLES ---
const styles: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: 'Arial, sans-serif', padding: '16px', backgroundColor: '#f3f4f6', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
  headerTitle: { fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 },
  headerActions: { display: 'flex', gap: '12px' },
  loadingText: { fontSize: '16px', fontWeight: 'normal', color: '#6b7280' },
  controlsSection: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  searchInput: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', flexGrow: 1, minWidth: '200px' },
  filterSelect: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white' },
  button: { padding: '10px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s', fontSize: '14px' },
  errorContainer: { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  loadingContainer: { textAlign: 'center', padding: '40px' },
  emptyState: { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#4b5563', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: '600' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' },
  chip: { padding: '4px 10px', borderRadius: '9999px', fontWeight: '600', fontSize: '12px', display: 'inline-block' },
  actionButton: { width: '32px', height: '32px', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' },
  modalContent: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalTitle: { fontSize: '22px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937', flexShrink: 0, textAlign: 'center' },
  modalForm: { flexGrow: 1, overflowY: 'auto', paddingRight: '12px', marginRight: '-12px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalLabel: { display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151', fontSize: '14px' },
  modalInput: { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box', fontSize: '16px' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', flexShrink: 0, borderTop: '1px solid #e5e7eb', paddingTop: '16px' },
  inputError: { borderColor: '#ef4444' },
  errorMessage: { color: '#ef4444', fontSize: '12px', marginTop: '4px' },
  mobileList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  mobileCard: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', overflow: 'hidden'},
  mobileCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb'},
  mobileCardTitle: { fontWeight: 'bold', color: '#1f2937' },
  mobileCardBody: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  mobileCardRow: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', alignItems: 'center' },
  mobileCardFooter: { padding: '12px 16px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px' },
};

export default Members;