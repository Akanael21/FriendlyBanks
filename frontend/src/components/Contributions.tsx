// src/components/Contributions.tsx - VERSION CONNECTÉE À L'API DJANGO

import React, { useState, useEffect, useMemo, ChangeEvent, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// --- INTERFACES ADAPTÉES À L'API DJANGO ---
interface ApiContribution {
  id: number;
  member: number; // ID du membre
  amount: number;
  date: string;
  is_late: boolean;
  points_berry: number;
}

interface ApiMember {
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

// Interface pour le formulaire
interface ContributionFormData {
  member: number;
  amount: number;
  date: string;
}

const MINIMUM_CONTRIBUTION = 4000;
const CONTRIBUTION_DUE_DAY = 25;
const LATE_FEE_PER_DAY = 200;
const BONUS_THRESHOLD = 6800; // 4000 + 70% de 4000
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

// --- COMPOSANT PRINCIPAL ---
const Contributions: React.FC = () => {
  const { user, hasPermission, getRoleDisplayName } = useAuth();
  const navigate = useNavigate();

  // --- ÉTATS ---
  const [contributions, setContributions] = useState<ApiContribution[]>([]);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredContributions, setFilteredContributions] = useState<ApiContribution[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const initialFormState: ContributionFormData = {
    member: 0,
    amount: MINIMUM_CONTRIBUTION,
    date: new Date().toISOString().split('T')[0],
  };
  
  const [currentContribution, setCurrentContribution] = useState(initialFormState);
  const [editingContribution, setEditingContribution] = useState<ApiContribution | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // --- FONCTIONS API ---
  const fetchContributions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/contributions/`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      setContributions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des contributions');
      console.error('Erreur lors du chargement des contributions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
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
      console.error('Erreur lors du chargement des membres:', err);
    }
  };

  // Charger les données au montage du composant
  useEffect(() => {
    if (user?.token) {
      fetchContributions();
      fetchMembers();
    }
  }, [user?.token]);

  // --- FILTRAGE DES CONTRIBUTIONS ---
  useEffect(() => {
    let currentData = contributions;
    
    if (searchTerm) {
      currentData = currentData.filter(c => {
        const member = members.find(m => m.id === c.member);
        const memberName = member ? `${member.user.first_name} ${member.user.last_name}` : '';
        return memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               c.id.toString().includes(searchTerm.toLowerCase());
      });
    }
    
    if (filterStatus !== 'All') {
      currentData = currentData.filter(c => {
        if (filterStatus === 'En retard') return c.is_late;
        if (filterStatus === 'À temps') return !c.is_late;
        return true;
      });
    }
    
    setFilteredContributions(currentData);
  }, [searchTerm, filterStatus, contributions, members]);

  // --- CALCULS MEMOIZÉS ---
  const stats = useMemo(() => ({
    totalContributions: contributions.length,
    totalLate: contributions.filter(c => c.is_late).length,
    currentMonthTotal: contributions.filter(c => {
      const cDate = new Date(c.date);
      const today = new Date();
      return cDate.getMonth() === today.getMonth() && cDate.getFullYear() === today.getFullYear();
    }).reduce((sum, c) => sum + c.amount, 0),
    totalAmount: contributions.reduce((sum, c) => sum + c.amount, 0),
  }), [contributions]);

  const selectedMemberInModal = useMemo(() => {
    return members.find(m => m.id === currentContribution.member);
  }, [currentContribution.member, members]);

  // --- FONCTIONS UTILITAIRES ---
  const calculateContributionImpact = (amount: number, date: string) => {
    const contributionDate = new Date(date);
    const dayOfMonth = contributionDate.getDate();
    const isLate = dayOfMonth > CONTRIBUTION_DUE_DAY;
    const hasBonus70 = amount >= BONUS_THRESHOLD;
    
    let pointsChange = 0;
    let penalties = 0;
    
    if (isLate) {
      pointsChange -= 15; // Pénalité retard selon la charte
      const daysLate = dayOfMonth - CONTRIBUTION_DUE_DAY;
      penalties = daysLate * LATE_FEE_PER_DAY;
    } else {
      pointsChange += 5; // Points base pour contribution à temps
    }
    
    if (hasBonus70) {
      pointsChange += 5; // Bonus 70%
    }
    
    return { pointsChange, penalties, isLate, hasBonus70 };
  };

  // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
  const handleOpenModalForAdd = () => {
    if (!hasPermission('add_contributions') && !hasPermission('manage_contributions')) {
      alert("Vous n'avez pas la permission d'ajouter des contributions.");
      return;
    }

    setEditingContribution(null);
    setCurrentContribution(initialFormState);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenModalForEdit = (contribution: ApiContribution) => {
    if (!hasPermission('edit_contributions') && !hasPermission('manage_contributions')) {
      alert("Vous n'avez pas la permission de modifier les contributions.");
      return;
    }

    setEditingContribution(contribution);
    setCurrentContribution({
      member: contribution.member,
      amount: contribution.amount,
      date: contribution.date,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };
  
  const handleDelete = async (id: number) => {
    if (!hasPermission('manage_contributions')) {
      alert("Vous n'avez pas la permission de supprimer des contributions.");
      return;
    }

    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette contribution ?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/contributions/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        throw new Error('Contribution non trouvée. Elle a peut-être déjà été supprimée.');
      }
      
      if (response.status === 403) {
        throw new Error('Accès refusé. Vérifiez vos permissions.');
      }
      
      if (response.status === 405) {
        throw new Error('Méthode DELETE non autorisée sur cet endpoint.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || errorData?.error || `Erreur HTTP ${response.status}: ${response.statusText}`);
      }

      await fetchContributions();
      alert('Contribution supprimée avec succès');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      setError(errorMessage);
      alert(`Erreur: ${errorMessage}`);
      console.error('Erreur lors de la suppression:', err);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!currentContribution.member || !currentContribution.amount) {
      setFormErrors({ general: 'Veuillez sélectionner un membre et saisir un montant valide.' });
      return;
    }

    if (currentContribution.amount < MINIMUM_CONTRIBUTION) {
      setFormErrors({ amount: `Le montant minimal est de ${MINIMUM_CONTRIBUTION.toLocaleString()} XAF.` });
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const method = editingContribution ? 'PUT' : 'POST';
      const url = editingContribution 
        ? `${API_BASE_URL}/contributions/${editingContribution.id}/`
        : `${API_BASE_URL}/contributions/`;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentContribution),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur lors de ${editingContribution ? 'la modification' : 'la création'}`);
      }

      await fetchContributions();
      setIsModalOpen(false);
      
      if (editingContribution) {
        alert('Contribution modifiée avec succès !');
      } else {
        alert('Contribution ajoutée avec succès !');
      }
      
    } catch (err) {
      setFormErrors({ 
        general: err instanceof Error ? err.message : 'Erreur lors de la sauvegarde' 
      });
      console.error('Erreur lors de la sauvegarde:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingContribution(null);
    setFormErrors({});
    setIsSubmitting(false);
  };

  // --- PERMISSIONS D'AFFICHAGE ---
  const canViewStats = hasPermission('view_reports') || hasPermission('manage_contributions');
  const canAddContributions = hasPermission('add_contributions') || hasPermission('manage_contributions');
  const canEditContributions = hasPermission('edit_contributions') || hasPermission('manage_contributions');
  const canDeleteContributions = hasPermission('manage_contributions');

  // --- VÉRIFICATION DES PERMISSIONS ---
  if (!hasPermission('view_contributions')) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h3>Accès refusé</h3>
          <p>Vous n'avez pas la permission de consulter les contributions.</p>
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
          <button onClick={fetchContributions} style={styles.button}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Calcul de l'impact pour l'aperçu
  const impact = currentContribution.amount >= MINIMUM_CONTRIBUTION && currentContribution.date 
    ? calculateContributionImpact(currentContribution.amount, currentContribution.date)
    : null;

  // --- RENDU PRINCIPAL ---
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.headerTitle}>
          Gestion des Contributions
          {loading && <span style={styles.loadingText}> (Chargement...)</span>}
        </h2>
        <button onClick={() => navigate('/')} style={styles.backButton}>
          ← Retour au Tableau de bord
        </button>
      </header>

      {canViewStats && (
        <section style={styles.statSection}>
          <StatCard title="Total ce mois" value={`${stats.currentMonthTotal.toLocaleString()} XAF`} />
          <StatCard title="Total contributions" value={stats.totalContributions.toString()} />
          <StatCard title="Contributions en retard" value={stats.totalLate.toString()} />
          <StatCard title="Montant total" value={`${stats.totalAmount.toLocaleString()} XAF`} />
        </section>
      )}

      <section style={styles.controlsSection}>
        <input 
          type="text" 
          placeholder="Rechercher par nom, ID..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          style={styles.searchInput} 
        />
        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)} 
          style={styles.filterSelect}
        >
          <option value="All">Tous les statuts</option>
          <option value="À temps">À temps</option>
          <option value="En retard">En retard</option>
        </select>
        
        {canAddContributions && (
          <button onClick={handleOpenModalForAdd} style={styles.addButton}>
            + Ajouter une Cotisation
          </button>
        )}
      </section>

      {loading ? (
        <div style={styles.loadingContainer}>
          <p>Chargement des contributions...</p>
        </div>
      ) : filteredContributions.length === 0 ? (
        <div style={styles.emptyState}>
          <p>Aucune contribution trouvée.</p>
          {contributions.length === 0 && (
            <p>Commencez par ajouter votre première contribution !</p>
          )}
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Membre</th>
                <th style={styles.th}>Montant</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Statut</th>
                {canViewStats && <th style={styles.th}>Points Berry</th>}
                {(canEditContributions || canDeleteContributions) && <th style={styles.th}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredContributions.map((c) => {
                const member = members.find(m => m.id === c.member);
                const memberName = member ? `${member.user.first_name} ${member.user.last_name}` : 'Membre inconnu';
                
                return (
                  <tr key={c.id}>
                    <td style={styles.td}>{c.id}</td>
                    <td style={styles.td}>{memberName}</td>
                    <td style={styles.td}>{c.amount.toLocaleString()} XAF</td>
                    <td style={styles.td}>{new Date(c.date).toLocaleDateString('fr-FR')}</td>
                    <td style={styles.td}>
                      <StatusChip status={c.is_late ? 'En retard' : 'À temps'} />
                    </td>
                    {canViewStats && (
                      <td style={styles.td}>
                        <span style={{ 
                          color: c.points_berry > 0 ? '#22c55e' : '#ef4444', 
                          fontWeight: 'bold' 
                        }}>
                          {c.points_berry > 0 ? `+${c.points_berry}` : c.points_berry} pts
                        </span>
                      </td>
                    )}
                    {(canEditContributions || canDeleteContributions) && (
                      <td style={{...styles.td, display: 'flex', gap: '8px' }}>
                        {canEditContributions && (
                          <button 
                            onClick={() => handleOpenModalForEdit(c)} 
                            style={styles.actionButtonEdit}
                          >
                            Modifier
                          </button>
                        )}
                        {canDeleteContributions && (
                          <button 
                            onClick={() => handleDelete(c.id)} 
                            style={styles.actionButtonDelete}
                          >
                            Supprimer
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Informations sur les permissions pour les membres */}
      {!canAddContributions && !canEditContributions && (
        <div style={styles.permissionInfo}>
          <p>
            <strong>Information :</strong> En tant que {user?.role ? getRoleDisplayName(user.role as any) : 'membre'}, 
            vous pouvez consulter les contributions mais pas les modifier. 
            Contactez le Trésorier pour toute modification.
          </p>
        </div>
      )}

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>
              {editingContribution ? 'Modifier la Contribution' : 'Ajouter une Contribution'}
            </h3>
            {formErrors.general && <p style={styles.formError}>{formErrors.general}</p>}
            
            <div style={styles.modalForm}>
              <div>
                <label style={styles.modalLabel}>Membre</label>
                <select
                  style={styles.modalInput}
                  value={currentContribution.member}
                  onChange={e => setCurrentContribution({
                    ...currentContribution, 
                    member: parseInt(e.target.value)
                  })}
                  disabled={isSubmitting}
                >
                  <option value={0} disabled>Sélectionner un membre...</option>
                  {members.map(m => 
                    <option key={m.id} value={m.id}>
                      {m.user.first_name} {m.user.last_name}
                    </option>
                  )}
                </select>
                {selectedMemberInModal && (
                  <p style={{fontSize: '12px', color: '#1e3a8a', marginTop: '4px'}}>
                    Solde actuel: {selectedMemberInModal.berry_score} points Berry
                  </p>
                )}
                {formErrors.member && <p style={styles.errorMessage}>{formErrors.member}</p>}
              </div>
              
              <ModalInput 
                label={`Montant (XAF) - Minimum: ${MINIMUM_CONTRIBUTION.toLocaleString()}`}
                type="number" 
                value={currentContribution.amount} 
                onChange={e => setCurrentContribution({
                  ...currentContribution, 
                  amount: parseFloat(e.target.value) || 0
                })}
                error={formErrors.amount}
                disabled={isSubmitting}
              />
              
              <ModalInput 
                label="Date" 
                type="date" 
                value={currentContribution.date} 
                onChange={e => setCurrentContribution({
                  ...currentContribution, 
                  date: e.target.value
                })}
                error={formErrors.date}
                disabled={isSubmitting}
              />

              {/* Aperçu de l'impact selon la charte */}
              {impact && (
                <div style={styles.impactPreview}>
                  <h4>Aperçu de l'impact (selon la charte) :</h4>
                  <ul>
                    {!impact.isLate && (
                      <li style={{color: '#22c55e'}}>Points Berry de base : +5 points (contribution à temps)</li>
                    )}
                    {impact.hasBonus70 && (
                      <li style={{color: '#22c55e'}}>Bonus 70% : +5 points (montant {'>'}= {BONUS_THRESHOLD.toLocaleString()} XAF)</li>
                    )}
                    {impact.isLate && (
                      <li style={{color: '#ef4444'}}>
                        Retard : -15 points Berry
                        {impact.penalties > 0 && ` + ${impact.penalties.toLocaleString()} XAF d'amende`}
                      </li>
                    )}
                    <li style={{color: impact.pointsChange > 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold'}}>
                      Total impact : {impact.pointsChange > 0 ? '+' : ''}{impact.pointsChange} points Berry
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button 
                onClick={closeModal} 
                style={styles.modalButtonCancel}
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button 
                onClick={handleSave} 
                style={styles.modalButtonSave}
                disabled={isSubmitting}
              >
                {isSubmitting ? 
                  (editingContribution ? 'Modification...' : 'Ajout...') : 
                  (editingContribution ? 'Enregistrer' : 'Ajouter')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPOSANTS D'ASSISTANCE ---
interface ModalInputProps extends InputHTMLAttributes<HTMLInputElement> { 
  label: string; 
  error?: string;
}
const ModalInput: React.FC<ModalInputProps> = ({ label, error, ...props }) => (
  <div>
    <label style={styles.modalLabel}>{label}</label>
    <input style={{...styles.modalInput, ...(error && styles.inputError)}} {...props} />
    {error && <p style={styles.errorMessage}>{error}</p>}
  </div>
);

const StatCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div style={{ 
    backgroundColor: 'white', 
    padding: '20px', 
    borderRadius: '8px', 
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
    flex: '1 1 250px', 
    textAlign: 'center' 
  }}>
    <h4 style={{ margin: 0, color: '#4b5563', fontSize: '16px', fontWeight: '600' }}>
      {title}
    </h4>
    <p style={{ margin: '8px 0 0 0', color: '#1e3a8a', fontSize: '28px', fontWeight: 'bold' }}>
      {value}
    </p>
  </div>
);

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const chipStyle: React.CSSProperties = {
    padding: '4px 12px', 
    borderRadius: '9999px', 
    fontWeight: '600', 
    fontSize: '12px', 
    color: 'white',
    backgroundColor: status === 'À temps' ? '#22c55e' : '#ef4444'
  };
  return <span style={chipStyle}>{status}</span>;
};

// --- STYLES ---
const styles: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: 'Arial, sans-serif', padding: '24px', backgroundColor: '#f3f4f6', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' },
  headerTitle: { fontSize: '28px', fontWeight: 'bold', color: '#1f2937', margin: 0 },
  loadingText: { fontSize: '16px', fontWeight: 'normal', color: '#6b7280' },
  backButton: { padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
  errorContainer: { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  loadingContainer: { textAlign: 'center', padding: '40px' },
  emptyState: { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  statSection: { display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' },
  controlsSection: { marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' },
  searchInput: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', flexGrow: 1, minWidth: '300px' },
  filterSelect: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: 'white' },
  addButton: { padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
  button: { padding: '10px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
  permissionInfo: { backgroundColor: '#e0f2fe', padding: '12px', borderRadius: '8px', marginTop: '16px', border: '1px solid #0891b2' },
  tableContainer: { backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#4b5563', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: '600' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #e5e7eb' },
  actionButtonEdit: { padding: '4px 8px', fontSize: '12px', fontWeight: '600', color: 'white', backgroundColor: '#f59e0b', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  actionButtonDelete: { padding: '4px 8px', fontSize: '12px', fontWeight: '600', color: 'white', backgroundColor: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)' },
  modalTitle: { fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937' },
  modalForm: { display: 'flex', flexDirection: 'column', gap: '16px' },
  modalLabel: { display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' },
  modalInput: { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' },
  inputError: { borderColor: '#ef4444' },
  errorMessage: { color: '#ef4444', fontSize: '12px', marginTop: '4px' },
  formError: { color: '#ef4444', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' },
  impactPreview: { backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '8px', fontSize: '14px' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' },
  modalButtonCancel: { padding: '10px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
  modalButtonSave: { padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
};

export default Contributions;