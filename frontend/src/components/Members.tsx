import React, { useState, useEffect, useMemo, ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { useAuth, ApiMember, Role } from '../context/AuthContext';
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

// --- INTERFACES & CONSTANTES ---
interface MemberFormData {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
}
const MOBILE_BREAKPOINT = 1024;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

const roleDisplayNames: Record<string, string> = {
    admin: 'Administrateur', president: 'Président', treasurer: 'Trésorier',
    secrecom: 'Sécrécom', censeur: 'Censeur', accountant: 'Comptable',
    member: 'Membre', guest: 'Invité'
};

// --- COMPOSANT PRINCIPAL ---
const Members: React.FC = () => {
  const { user, members, fetchMembers, hasPermission, getRoleDisplayName } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberFormData | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width < MOBILE_BREAKPOINT;

  const handleRefresh = async () => {
      setLoading(true);
      await fetchMembers();
      setLoading(false);
  };

  const filteredMembers = useMemo(() => {
    return members
      .filter(m => {
        const fullName = `${m.user.first_name} ${m.user.last_name}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase()) || m.user.email.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .filter(m => (roleFilter ? m.user.role === roleFilter : true));
  }, [members, searchTerm, roleFilter]);

  const openModal = (member: ApiMember | null = null) => {
    if (member) {
      if (!hasPermission('edit_members')) return alert("Permission refusée.");
      setEditingMember({
        id: member.id, firstName: member.user.first_name, lastName: member.user.last_name,
        email: member.user.email, phone: '', role: member.user.role,
      });
    } else {
      if (!hasPermission('create_members')) return alert("Permission refusée.");
      setEditingMember({ id: undefined, firstName: '', lastName: '', email: '', phone: '', role: 'member' });
    }
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingMember(null);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMember) return;
    setIsSubmitting(true);
    setFormErrors({});

    try {
      const errors: { [key: string]: string } = {};
      if (!editingMember.firstName.trim()) errors.firstName = 'Prénom requis';
      if (!editingMember.lastName.trim()) errors.lastName = 'Nom requis';
      if (!editingMember.email.trim()) errors.email = 'Email requis';
      if (!editingMember.role) errors.role = 'Rôle requis';
      if (!editingMember.id && members.some(m => m.user.email.toLowerCase() === editingMember.email.toLowerCase())) {
        errors.email = 'Cet email est déjà utilisé.';
      }
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setIsSubmitting(false);
        return;
      }

      const url = editingMember.id
        ? `${API_BASE_URL}/members/${editingMember.id}/update-role/`
        : `${API_BASE_URL}/members/create-with-credentials/`;
      const method = editingMember.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method, headers: { 'Authorization': `Bearer ${user?.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMember),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur lors de la sauvegarde`);
      }

      await fetchMembers();
      
      if (editingMember.id) {
        alert('Membre modifié avec succès !');
      } else {
        const result = await response.json();
        alert(`Membre créé avec succès ! Mot de passe généré: ${result.generated_password}`);
      }
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (memberId: number) => {
    if (!hasPermission('delete_members')) return alert("Permission refusée.");
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce membre ? Cette action est irréversible.')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/members/${memberId}/`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${user?.token}` },
      });
      if (!response.ok) throw new Error('Erreur lors de la suppression');
      await fetchMembers();
      alert('Membre supprimé avec succès');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const handleInputChange = (field: keyof MemberFormData, value: string) => {
    if (editingMember) setEditingMember(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (!hasPermission('view_members')) {
    return <div style={styles.page}><div style={styles.errorContainer}><h3>Accès refusé</h3><p>Vous n'avez pas la permission de consulter cette page.</p></div></div>;
  }

  if (error) {
    return <div style={styles.page}><div style={styles.errorContainer}><h3>Erreur</h3><p>{error}</p><button onClick={handleRefresh} style={styles.button}>Réessayer</button></div></div>;
  }
  
  return (
    <>
      <header style={styles.header}>
        <h2 style={styles.headerTitle}>Gestion des Membres {loading && <span style={styles.loadingText}>(Chargement...)</span>}</h2>
        {hasPermission('create_members') && (
          <div style={styles.headerActions}>
            <button onClick={handleRefresh} style={{...styles.button, backgroundColor: '#6b7280'}}><FontAwesomeIcon icon={faRefresh} style={{ marginRight: '8px' }}/>Actualiser</button>
            <button onClick={() => openModal()} style={styles.button}><FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }}/>Ajouter un Membre</button>
          </div>
        )}
      </header>
      
      <div style={styles.controlsSection}>
        <input type="text" placeholder="Rechercher par nom ou email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={styles.searchInput}/>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={styles.filterSelect}>
            <option value="">Tous les rôles</option>
            {Object.keys(roleDisplayNames).map(role => <option key={role} value={role}>{roleDisplayNames[role as Role]}</option>)}
        </select>
      </div>

      {loading && members.length === 0 ? (
        <div style={styles.loadingContainer}><p>Chargement des membres...</p></div>
      ) : filteredMembers.length === 0 ? (
        <div style={styles.emptyState}><p>Aucun membre trouvé correspondant à vos critères.</p></div>
      ) : (
        isMobile ? 
          <MobileMemberList members={filteredMembers} onEdit={openModal} onDelete={handleDelete} hasPermission={hasPermission} /> : 
          <DesktopMemberTable members={filteredMembers} onEdit={openModal} onDelete={handleDelete} hasPermission={hasPermission} />
      )}

      {isModalOpen && editingMember && (
          <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                  <h3 style={styles.modalTitle}>{editingMember.id ? 'Modifier le Membre' : 'Ajouter un Nouveau Membre'}</h3>
                  <form onSubmit={handleSave} style={styles.modalForm}>
                      <ModalInput label="Prénom" value={editingMember.firstName} onChange={e => handleInputChange('firstName', e.target.value)} error={formErrors.firstName} disabled={isSubmitting}/>
                      <ModalInput label="Nom" value={editingMember.lastName} onChange={e => handleInputChange('lastName', e.target.value)} error={formErrors.lastName} disabled={isSubmitting}/>
                      <ModalInput label="Email" type="email" value={editingMember.email} onChange={e => handleInputChange('email', e.target.value)} error={formErrors.email} disabled={isSubmitting || !!editingMember.id}/>
                      <ModalSelect label="Rôle" value={editingMember.role} onChange={e => handleInputChange('role', e.target.value)} error={formErrors.role} disabled={isSubmitting}>
                          {Object.keys(roleDisplayNames).filter(r => r !== 'admin').map(role => <option key={role} value={role}>{roleDisplayNames[role as Role]}</option>)}
                      </ModalSelect>
                      <div style={styles.modalActions}>
                          <button type="button" onClick={closeModal} style={{...styles.button, backgroundColor: '#6b7280'}} disabled={isSubmitting}>Annuler</button>
                          <button type="submit" style={styles.button} disabled={isSubmitting}>{isSubmitting ? 'Sauvegarde...' : 'Enregistrer'}</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </>
  );
};

// --- COMPOSANTS D'AFFICHAGE ---
const DesktopMemberTable: React.FC<{ members: ApiMember[]; onEdit: (m: ApiMember) => void; onDelete: (id: number) => void; hasPermission: (p: string) => boolean; }> = ({ members, onEdit, onDelete, hasPermission }) => (
  <div style={styles.tableContainer}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Nom</th><th style={styles.th}>Email</th><th style={styles.th}>Rôle</th>
          <th style={styles.th}>Points Berry</th><th style={styles.th}>Parts</th>
          {(hasPermission('edit_members') || hasPermission('delete_members')) && <th style={styles.th}>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {members.map(member => (
          <tr key={member.id}>
            <td style={styles.td}><div style={{fontWeight: 'bold'}}>{member.user.first_name} {member.user.last_name}</div><div style={{fontSize: '12px', color: '#6b7280'}}>ID: {member.id}</div></td>
            <td style={styles.td}>{member.user.email}</td><td style={styles.td}><RoleChip role={member.user.role} /></td>
            <td style={styles.td}><div style={{fontWeight: 'bold', fontSize: '16px'}}>{member.berry_score}</div><LevelChip score={member.berry_score} /></td>
            <td style={styles.td}>{member.shares}</td>
            {(hasPermission('edit_members') || hasPermission('delete_members')) && (
              <td style={styles.td}><div style={{display: 'flex', gap: '8px'}}>
                  {hasPermission('edit_members') && (<button onClick={() => onEdit(member)} style={{...styles.actionButton, backgroundColor: '#3b82f6'}} title="Modifier"><FontAwesomeIcon icon={faPen}/></button>)}
                  {hasPermission('delete_members') && (<button onClick={() => onDelete(member.id)} style={{...styles.actionButton, backgroundColor: '#ef4444'}} title="Supprimer"><FontAwesomeIcon icon={faTrash}/></button>)}
              </div></td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MobileMemberList: React.FC<{ members: ApiMember[]; onEdit: (m: ApiMember) => void; onDelete: (id: number) => void; hasPermission: (p: string) => boolean; }> = ({ members, onEdit, onDelete, hasPermission }) => (
  <div style={styles.mobileList}>
    {members.map(member => (
      <div key={member.id} style={styles.mobileCard}>
        <div style={styles.mobileCardHeader}>
          <div><span style={styles.mobileCardTitle}>{member.user.first_name} {member.user.last_name}</span><RoleChip role={member.user.role} /></div>
        </div>
        <div style={styles.mobileCardBody}>
          <div style={styles.mobileCardRow}><span>Points Berry:</span> <strong>{member.berry_score}</strong></div>
          <div style={styles.mobileCardRow}><span>Niveau:</span> <LevelChip score={member.berry_score} /></div>
          <div style={styles.mobileCardRow}><span>Parts:</span> <span>{member.shares}</span></div>
          <div style={styles.mobileCardRow}><span>Email:</span> <span>{member.user.email}</span></div>
        </div>
        {(hasPermission('edit_members') || hasPermission('delete_members')) && (
          <div style={styles.mobileCardFooter}>
            {hasPermission('edit_members') && (<button onClick={() => onEdit(member)} style={{...styles.button, flex: 1}}><FontAwesomeIcon icon={faPen} style={{marginRight: '8px'}}/>Modifier</button>)}
            {hasPermission('delete_members') && (<button onClick={() => onDelete(member.id)} style={{...styles.button, flex: 1, backgroundColor: '#ef4444'}}><FontAwesomeIcon icon={faTrash} style={{marginRight: '8px'}}/>Supprimer</button>)}
          </div>
        )}
      </div>
    ))}
  </div>
);

// --- SOUS-COMPOSANTS ---
const RoleChip: React.FC<{ role: string }> = ({ role }) => { /* ... (code inchangé) ... */ };
const LevelChip: React.FC<{ score: number }> = ({ score }) => { /* ... (code inchangé) ... */ };
interface ModalInputProps extends InputHTMLAttributes<HTMLInputElement> { label: string; error?: string; }
const ModalInput: React.FC<ModalInputProps> = ({ label, error, ...props }) => (<div><label style={styles.modalLabel}>{label}</label><input style={{...styles.modalInput, ...(error && styles.inputError)}} {...props} />{error && <p style={styles.errorMessage}>{error}</p>}</div>);
interface ModalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label: string; error?: string; children: ReactNode; }
const ModalSelect: React.FC<ModalSelectProps> = ({ label, error, children, ...props }) => (<div><label style={styles.modalLabel}>{label}</label><select style={{...styles.modalInput, ...(error && styles.inputError)}} {...props}>{children}</select>{error && <p style={styles.errorMessage}>{error}</p>}</div>);

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
  modalForm: { flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' },
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