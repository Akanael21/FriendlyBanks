import React, { useState, useEffect, ChangeEvent, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGavel, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

// --- CONSTANTES & HOOKS ---
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';
const MOBILE_BREAKPOINT = 768;

const useWindowSize = () => {
  const [size, setSize] = useState([window.innerWidth]);
  useEffect(() => {
    const handleResize = () => setSize([window.innerWidth]);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return { width: size[0] };
};

// --- INTERFACES API ---
interface ApiSanction {
  id: number;
  member: number;
  member_name: string;
  type: 'Avertissement' | 'Amende' | 'Exclusion';
  reason: string;
  date: string;
  status: 'Vote en cours' | 'Appliquée' | 'Rejetée';
  votes_for: number;
  votes_against: number;
  has_voted: boolean; // Le backend indique si l'utilisateur actuel a déjà voté
}

interface ApiMember {
  id: number;
  user: {
    first_name: string;
    last_name: string;
  };
}

interface SanctionFormData {
  member: number;
  type: 'Avertissement' | 'Amende' | 'Exclusion';
  reason: string;
}

// --- COMPOSANT PRINCIPAL ---
const Sanctions: React.FC = () => {
  const { user, hasPermission, getRoleDisplayName } = useAuth();
  const navigate = useNavigate();
  const { width } = useWindowSize();
  const isMobile = width < MOBILE_BREAKPOINT;

  // --- ÉTATS ---
  const [sanctions, setSanctions] = useState<ApiSanction[]>([]);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const initialFormState: SanctionFormData = {
    member: 0,
    type: 'Avertissement',
    reason: ''
  };
  const [newSanction, setNewSanction] = useState<SanctionFormData>(initialFormState);

  // --- LOGIQUE API ---
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sanctionsRes, membersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/sanctions/`, {
          headers: { 'Authorization': `Bearer ${user?.token}` }
        }),
        fetch(`${API_BASE_URL}/members/`, {
          headers: { 'Authorization': `Bearer ${user?.token}` }
        })
      ]);

      if (!sanctionsRes.ok) throw new Error('Erreur de chargement des sanctions');
      if (!membersRes.ok) throw new Error('Erreur de chargement des membres');

      const sanctionsData = await sanctionsRes.json();
      const membersData = await membersRes.json();

      setSanctions(sanctionsData);
      setMembers(membersData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token && hasPermission('view_sanctions')) {
      fetchData();
    }
  }, [user?.token, hasPermission]);

  // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
  const handleVote = async (id: number, vote: 'for' | 'against') => {
    if (!hasPermission('participate_in_votes') && !hasPermission('manage_sanctions')) {
      alert("Vous n'avez pas la permission de voter.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/sanctions/${id}/vote/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vote }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur lors du vote');
      }

      // Recharger les données pour refléter le nouveau vote
      await fetchData();
      alert('Vote enregistré avec succès !');

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Une erreur de vote est survenue');
      console.error(err);
    }
  };

  const handleSaveSanction = async () => {
    if (!hasPermission('manage_sanctions')) {
      alert("Vous n'avez pas la permission de proposer des sanctions.");
      return;
    }

    if (!newSanction.member || !newSanction.reason) {
      setFormError("Veuillez sélectionner un membre et fournir une justification.");
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const response = await fetch(`${API_BASE_URL}/sanctions/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSanction),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur lors de la proposition de sanction');
      }

      await fetchData(); // Recharger les données
      setIsModalOpen(false);
      alert('La proposition de sanction a été soumise au vote.');

    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenModal = () => {
    if (!hasPermission('manage_sanctions')) {
      alert("Vous n'avez pas la permission de proposer des sanctions.");
      return;
    }
    setNewSanction(initialFormState);
    setFormError('');
    setIsModalOpen(true);
  };

  // --- GESTION DES PERMISSIONS & ERREURS ---
  if (!hasPermission('view_sanctions')) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h3>Accès refusé</h3>
          <p>Vous n'avez pas la permission de consulter cette page.</p>
          <p>Votre rôle actuel : <strong>{user?.role ? getRoleDisplayName(user.role as any) : 'Non défini'}</strong></p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={styles.page}><p style={{textAlign: 'center', padding: '40px'}}>Chargement des sanctions...</p></div>;
  }

  if (error) {
    return <div style={styles.page}><div style={styles.errorContainer}><h3>Erreur</h3><p>{error}</p><button onClick={fetchData} style={styles.button}>Réessayer</button></div></div>;
  }

  // --- STATISTIQUES POUR LES RÔLES AUTORISÉS ---
  const canViewStats = hasPermission('view_reports') || hasPermission('manage_sanctions');
  const stats = {
    inProgress: sanctions.filter(s => s.status === 'Vote en cours').length,
    applied: sanctions.filter(s => s.status === 'Appliquée').length,
    rejected: sanctions.filter(s => s.status === 'Rejetée').length,
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.headerTitle}>Sanctions & Exclusions</h2>
        <button onClick={() => navigate('/')} style={{...styles.button, backgroundColor: '#6b7280'}}>
          ← Retour
        </button>
      </header>

      {canViewStats && (
        <section style={styles.statsSection}>
          <StatCard title="Votes en cours" value={stats.inProgress} />
          <StatCard title="Sanctions appliquées" value={stats.applied} />
          <StatCard title="Propositions rejetées" value={stats.rejected} />
        </section>
      )}

      <section style={styles.controlsSection}>
        {hasPermission('manage_sanctions') && (
          <button onClick={handleOpenModal} style={styles.button}>
            <FontAwesomeIcon icon={faGavel} style={{ marginRight: '8px' }} />
            Proposer une Sanction
          </button>
        )}
        {!hasPermission('manage_sanctions') && hasPermission('participate_in_votes') && (
          <div style={styles.infoBox}>
            <p>Vous pouvez voter sur les sanctions proposées par le comité de gestion.</p>
          </div>
        )}
      </section>

      {sanctions.length === 0 ? (
          <div style={styles.emptyState}>
              <p>Aucune sanction n'a été enregistrée pour le moment.</p>
          </div>
      ) : isMobile ?
        <MobileSanctionList
          sanctions={sanctions}
          onVote={handleVote}
          hasPermission={hasPermission}
        /> :
        <DesktopSanctionTable
          sanctions={sanctions}
          onVote={handleVote}
          hasPermission={hasPermission}
        />
      }

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Proposer une Sanction</h3>
            {formError && <p style={styles.formError}>{formError}</p>}
            <div style={styles.modalForm}>
              <ModalSelect
                label="Membre concerné"
                value={newSanction.member}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setNewSanction({...newSanction, member: parseInt(e.target.value)})
                }
                disabled={isSubmitting}
              >
                <option value={0} disabled>Sélectionner un membre...</option>
                {members.map(m =>
                  <option key={m.id} value={m.id}>{m.user.first_name} {m.user.last_name}</option>
                )}
              </ModalSelect>

              <ModalSelect
                label="Type de sanction"
                value={newSanction.type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setNewSanction({...newSanction, type: e.target.value as ApiSanction['type']})
                }
                disabled={isSubmitting}
              >
                <option value="Avertissement">Avertissement</option>
                <option value="Amende">Amende (200 XAF/jour de retard)</option>
                <option value="Exclusion">Exclusion</option>
              </ModalSelect>

              <ModalTextarea
                label="Justification / Motif"
                value={newSanction.reason}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setNewSanction({...newSanction, reason: e.target.value})
                }
                placeholder="Décrivez clairement le manquement selon la charte..."
                disabled={isSubmitting}
              />

              <div style={styles.charterReminder}>
                <h4>Rappel de la charte (Art. 6) :</h4>
                <ul>
                  <li>Retard de contribution : amende de 200 XAF par jour.</li>
                  <li>Absence de contribution (1 mois) : perte de 50% des points Berry.</li>
                  <li>Les décisions sont prises par un vote majoritaire des membres.</li>
                </ul>
              </div>
            </div>
            <div style={styles.modalActions}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{...styles.button, backgroundColor: '#6b7280'}}
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button onClick={handleSaveSanction} style={styles.button} disabled={isSubmitting}>
                {isSubmitting ? 'Soumission...' : 'Soumettre au Vote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- VUES DESKTOP & MOBILE ---
const DesktopSanctionTable: React.FC<{
  sanctions: ApiSanction[],
  onVote: (id: number, vote: 'for' | 'against') => void,
  hasPermission: (permission: string) => boolean
}> = ({ sanctions, onVote, hasPermission }) => (
  <div style={styles.tableContainer}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Membre</th>
          <th style={styles.th}>Type</th>
          <th style={styles.th}>Motif</th>
          <th style={styles.th}>Date</th>
          <th style={styles.th}>Statut & Votes</th>
          {(hasPermission('participate_in_votes') || hasPermission('manage_sanctions')) &&
            <th style={styles.th}>Actions</th>
          }
        </tr>
      </thead>
      <tbody>
        {sanctions.map(s => (
          <tr key={s.id}>
            <td style={styles.td}>{s.member_name}</td>
            <td style={styles.td}><TypeChip type={s.type} /></td>
            <td style={styles.td}><p style={styles.reasonText}>{s.reason}</p></td>
            <td style={styles.td}>{new Date(s.date).toLocaleDateString('fr-FR')}</td>
            <td style={styles.td}>
              <div style={styles.voteInfo}>
                <StatusChip status={s.status}/>
                <span style={{fontSize: '12px', color: '#4b5563'}}>
                  Pour: <strong style={{color: '#166534'}}>{s.votes_for}</strong> /
                  Contre: <strong style={{color: '#991b1b'}}>{s.votes_against}</strong>
                </span>
              </div>
            </td>
            {(hasPermission('participate_in_votes') || hasPermission('manage_sanctions')) && (
              <td style={styles.td}>
                {s.status === 'Vote en cours' && (
                  <div style={styles.actionGroup}>
                    <button onClick={() => onVote(s.id, 'for')} disabled={s.has_voted} style={{...styles.actionButton, backgroundColor: '#22c55e'}} title="Voter Pour">
                      <FontAwesomeIcon icon={faCheck}/>
                    </button>
                    <button onClick={() => onVote(s.id, 'against')} disabled={s.has_voted} style={{...styles.actionButton, backgroundColor: '#ef4444'}} title="Voter Contre">
                      <FontAwesomeIcon icon={faTimes}/>
                    </button>
                  </div>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MobileSanctionList: React.FC<{
  sanctions: ApiSanction[],
  onVote: (id: number, vote: 'for' | 'against') => void,
  hasPermission: (permission: string) => boolean
}> = ({ sanctions, onVote, hasPermission }) => (
  <div style={styles.mobileList}>
    {sanctions.map(s => (
      <div key={s.id} style={styles.mobileCard}>
        <div style={styles.mobileCardHeader}>
          <div>
            <span style={styles.mobileCardTitle}>{s.member_name}</span>
            <TypeChip type={s.type} />
          </div>
          <StatusChip status={s.status}/>
        </div>
        <div style={styles.mobileCardBody}>
          <p style={styles.reasonTextMobile}>{s.reason}</p>
          <div style={styles.mobileCardRow}>
            <span>Votes:</span>
            <span style={{fontSize: '14px', color: '#4b5563'}}>
              Pour: <strong style={{color: '#166534'}}>{s.votes_for}</strong> /
              Contre: <strong style={{color: '#991b1b'}}>{s.votes_against}</strong>
            </span>
          </div>
        </div>
        {s.status === 'Vote en cours' && (hasPermission('participate_in_votes') || hasPermission('manage_sanctions')) && (
          <div style={styles.mobileCardFooter}>
            <button disabled={s.has_voted} onClick={() => onVote(s.id, 'for')} style={{...styles.button, flex: 1, backgroundColor: '#22c55e'}}>
              <FontAwesomeIcon icon={faCheck} style={{marginRight: '8px'}}/> Pour
            </button>
            <button disabled={s.has_voted} onClick={() => onVote(s.id, 'against')} style={{...styles.button, flex: 1, backgroundColor: '#ef4444'}}>
              <FontAwesomeIcon icon={faTimes} style={{marginRight: '8px'}}/> Contre
            </button>
          </div>
        )}
      </div>
    ))}
  </div>
);


// --- SOUS-COMPOSANTS & STYLES ---
const StatCard: React.FC<{ title: string, value: number }> = ({ title, value }) => (
    <div style={styles.statCard}>
        <h4 style={styles.statTitle}>{title}</h4>
        <p style={styles.statValue}>{value}</p>
    </div>
);
const StatusChip: React.FC<{ status: ApiSanction['status'] }> = ({ status }) => {
  const sC = {
    'Vote en cours': { backgroundColor: '#fef3c7', color: '#92400e' },
    'Appliquée': { backgroundColor: '#dcfce7', color: '#166534' },
    'Rejetée': { backgroundColor: '#fee2e2', color: '#991b1b' }
  };
  return <span style={{ ...styles.chip, ...sC[status] }}>{status}</span>;
};
const TypeChip: React.FC<{ type: ApiSanction['type'] }> = ({ type }) => {
  const tC = {
    'Avertissement': { backgroundColor: '#fef9c3', color: '#854d0e' },
    'Amende': { backgroundColor: '#fed7aa', color: '#9a3412' },
    'Exclusion': { backgroundColor: '#fecaca', color: '#991b1b' }
  };
  return <span style={{ ...styles.chip, ...tC[type] }}>{type}</span>;
};
interface ModalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label: string; children: ReactNode; }
const ModalSelect: React.FC<ModalSelectProps> = ({ label, children, ...props }) => (
  <div>
    <label style={styles.modalLabel}>{label}</label>
    <select style={styles.modalInput} {...props}>{children}</select>
  </div>
);
interface ModalTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label: string; }
const ModalTextarea: React.FC<ModalTextareaProps> = ({ label, ...props }) => (
  <div>
    <label style={styles.modalLabel}>{label}</label>
    <textarea style={{...styles.modalInput, height: '100px'}} {...props} />
  </div>
);

const styles: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: 'Arial, sans-serif', padding: '16px', backgroundColor: '#f3f4f6', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
  headerTitle: { fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 },
  errorContainer: { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  emptyState: { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', marginTop: '24px' },
  statsSection: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  statCard: { backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', flex: '1 1 150px', textAlign: 'center' },
  statTitle: { margin: 0, color: '#4b5563', fontSize: '14px', fontWeight: '600' },
  statValue: { margin: '8px 0 0 0', color: '#1e3a8a', fontSize: '22px', fontWeight: 'bold' },
  controlsSection: { marginBottom: '24px' },
  infoBox: { backgroundColor: '#e0f2fe', padding: '12px', borderRadius: '8px', border: '1px solid #0891b2' },
  button: { padding: '10px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s', fontSize: '14px' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#4b5563', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: '600' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' },
  chip: { padding: '4px 12px', borderRadius: '9999px', fontWeight: '600', fontSize: '12px', marginBottom: '4px', display: 'inline-block' },
  reasonText: { maxWidth: '300px', whiteSpace: 'normal', margin: 0 },
  reasonTextMobile: { fontSize: '14px', margin: '0 0 12px 0', color: '#4b5563' },
  voteInfo: { display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' },
  actionGroup: { display: 'flex', gap: '8px' },
  actionButton: { width: '36px', height: '36px', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: 'opacity 0.2s' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' },
  modalContent: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalTitle: { fontSize: '22px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937', flexShrink: 0, textAlign: 'center' },
  modalForm: { flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalLabel: { display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151', fontSize: '14px' },
  modalInput: { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box', fontSize: '16px' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', flexShrink: 0 },
  formError: { color: '#ef4444', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' },
  charterReminder: { backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '8px', fontSize: '14px', borderLeft: '4px solid #0ea5e9' },
  mobileList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  mobileCard: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', overflow: 'hidden'},
  mobileCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb'},
  mobileCardTitle: { fontWeight: 'bold', color: '#1f2937', marginRight: '8px' },
  mobileCardBody: { padding: '16px' },
  mobileCardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' },
  mobileCardFooter: { padding: '12px 16px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px' },
};

export default Sanctions;