import React, { useState, useEffect, ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCalendarAlt, faBook, faLandmark, faGavel, faHandshake, faUsers, faVoteYea } from '@fortawesome/free-solid-svg-icons';

// --- CONSTANTES & HOOKS ---
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

// --- INTERFACES API ---
interface ApiMeeting {
  id: number;
  title: string;
  date: string;
  time: string;
  status: 'À venir' | 'Passée' | 'En cours';
  type: 'Ouverture' | 'Clôture' | 'Extraordinaire' | 'Comité';
  attendees?: number;
  decisions?: string[];
}

interface ApiVote {
  id: number;
  title: string;
  description: string;
  type: 'Modification Charte' | 'Sanction' | 'Prêt Important' | 'Règle';
  status: 'En cours' | 'Approuvé' | 'Rejeté';
  votes_for: number;
  votes_against: number;
  total_voters: number;
  required_majority: 'Simple' | 'Qualifiée' | 'Unanimité';
  end_date: string;
  has_voted: boolean;
}

interface MeetingFormData {
    title: string;
    date: string;
    time: string;
    type: 'Ouverture' | 'Clôture' | 'Extraordinaire' | 'Comité';
}

// --- RÈGLES DE LA CHARTE (DONNÉES STATIQUES ACCEPTABLES) ---
interface Rule { title: string; content: string; }
interface RuleCategory { category: string; icon: any; rules: Rule[]; requiredPermission: string; }

const governanceRules: RuleCategory[] = [
  {
    category: "Cotisations & Fonds", icon: faLandmark, requiredPermission: "view_governance",
    rules: [
      { title: "Montant Minimal (Article 3.1)", content: "La contribution mensuelle minimale est de 4 000 XAF, à déposer entre le 24 et le 25 du mois." },
      { title: "Gestion du Fonds (Article 3.2-3.3)", content: "Les cotisations sont versées sur un compte commun géré par le Trésorier et supervisé par le Comité de Gestion (3-6 membres)." },
      { title: "Rapports Mensuels (Article 3.4)", content: "Un rapport financier détaillé est présenté mensuellement à l'ensemble des membres." },
    ]
  },
  {
    category: "Système de Points Berry", icon: faBook, requiredPermission: "view_berry_calculations",
    rules: [
      { title: "Attribution de base", content: "Chaque contribution assidue ajoute 5 points. Un retard entraîne une pénalité de 15 points." },
      { title: "Bonus Contributions", content: "Des bonus sont accordés : >6800 XAF (+5pts), >20% du fonds (+10pts), >50000 XAF (+20pts)." },
      { title: "Pénalités (Article 6.5)", content: "Une absence de contribution pendant un mois entraîne une perte de 50% des points Berry acquis." },
      { title: "Échelle de Prêt", content: "10-100pts = 60k XAF, 100-199pts = 120k XAF, 200-499pts = 300k XAF, 500+pts = selon fonds disponibles." },
    ]
  },
  {
    category: "Prêts aux Membres", icon: faHandshake, requiredPermission: "view_loans",
    rules: [
      { title: "Conditions d'Accès (Article 4.1)", content: "L'accès au fonds est réservé aux urgences avérées (maladie, accident, etc.)." },
      { title: "Procédure (Article 4.2-4.3)", content: "Toute demande doit être formulée par écrit et examinée par le Comité de Gestion." },
      { title: "Garanties (Article 4.7)", content: "Chaque prêt individuel doit être soutenu par au moins deux avaliseurs membres du groupe." },
      { title: "Gros Prêts (Article 4.5)", content: "L'approbation d'un retrait de plus de 35% du fonds doit être validée par l'ensemble des membres." },
    ]
  },
  {
    category: "Sanctions & Exclusions", icon: faGavel, requiredPermission: "view_sanctions",
    rules: [
      { title: "Retard de Cotisation (Article 6.3)", content: "Sanctionné par une amende de 200 XAF par jour de retard." },
      { title: "Processus Décisionnel (Article 6.2)", content: "Toutes les décisions disciplinaires sont prises par un vote majoritaire des membres." },
      { title: "Non-Remboursement (Article 6.4)", content: "En cas de défaut, saisie des fonds du membre puis de ses avaliseurs." },
    ]
  },
];

// --- COMPOSANT PRINCIPAL ---
const Governance: React.FC = () => {
  const { user, hasPermission, getRoleDisplayName } = useAuth();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState<ApiMeeting[]>([]);
  const [votes, setVotes] = useState<ApiVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const initialMeetingFormState: MeetingFormData = {
    title: '',
    date: '',
    time: '',
    type: 'Comité'
  };
  const [newMeeting, setNewMeeting] = useState<MeetingFormData>(initialMeetingFormState);
  
  const fetchData = async () => {
    try {
        setLoading(true);
        setError(null);
        const [meetingsRes, votesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/meetings/`, { headers: { 'Authorization': `Bearer ${user?.token}` } }),
            fetch(`${API_BASE_URL}/votes/`, { headers: { 'Authorization': `Bearer ${user?.token}` } })
        ]);

        if (!meetingsRes.ok) throw new Error('Erreur de chargement des réunions');
        if (!votesRes.ok) throw new Error('Erreur de chargement des votes');

        const meetingsData = await meetingsRes.json();
        const votesData = await votesRes.json();

        setMeetings(meetingsData);
        setVotes(votesData);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if(user?.token && hasPermission('view_governance')){
        fetchData();
    }
  }, [user?.token, hasPermission]);


  // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
  const handleVote = async (voteId: number, choice: 'for' | 'against') => {
    if (!hasPermission('participate_in_votes')) {
      return alert("Vous n'avez pas la permission de voter.");
    }
    try {
        const response = await fetch(`${API_BASE_URL}/votes/${voteId}/vote/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user?.token}`
            },
            body: JSON.stringify({ vote: choice })
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Erreur lors du vote');
        }
        await fetchData(); // Recharger les données pour refléter le vote
        alert('Votre vote a été enregistré.');
    } catch (err) {
        alert(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  };

  const handleOpenMeetingModal = () => {
    if (!hasPermission('organize_sessions') && !hasPermission('manage_governance')) {
      return alert("Vous n'avez pas la permission d'organiser des réunions.");
    }
    setNewMeeting(initialMeetingFormState);
    setIsMeetingModalOpen(true);
  };
  
  const handleSaveMeeting = async () => {
    if (!newMeeting.title || !newMeeting.date || !newMeeting.time) {
        return alert("Veuillez remplir tous les champs pour la réunion.");
    }
    setIsSubmitting(true);
    try {
        const response = await fetch(`${API_BASE_URL}/meetings/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user?.token}`
            },
            body: JSON.stringify(newMeeting)
        });
        if (!response.ok) {
            throw new Error('Erreur lors de la planification de la réunion');
        }
        await fetchData(); // Recharger les données
        setIsMeetingModalOpen(false);
    } catch (err) {
        alert(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- VÉRIFICATION DES PERMISSIONS ---
  if (!hasPermission('view_governance')) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h3>Accès refusé</h3>
          <p>Vous n'avez pas la permission de consulter la gouvernance.</p>
          <p>Votre rôle actuel : <strong>{user?.role ? getRoleDisplayName(user.role as any) : 'Non défini'}</strong></p>
        </div>
      </div>
    );
  }

  // --- AFFICHAGE ---
  const visibleRules = governanceRules.filter(category => hasPermission(category.requiredPermission));
  const canOrganizeMeetings = hasPermission('organize_sessions') || hasPermission('manage_governance');
  const canParticipateInVotes = hasPermission('participate_in_votes') || hasPermission('manage_governance');

  if (loading) return <div style={styles.page}><p style={{textAlign: 'center', padding: '40px'}}>Chargement de la gouvernance...</p></div>;
  if (error) return <div style={styles.page}><div style={styles.errorContainer}><h3>Erreur</h3><p>{error}</p><button onClick={fetchData} style={styles.button}>Réessayer</button></div></div>;
  
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.headerTitle}>Gouvernance & Réunions</h2>
        <button onClick={() => navigate('/')} style={{...styles.button, backgroundColor: '#6b7280'}}>
          ← Retour
        </button>
      </header>

      {/* Section des règles */}
      <section>
          <h3 style={styles.sectionTitle}>Règles de la Charte (Version 5)</h3>
          <div style={styles.rulesGrid}>
            {visibleRules.map(category => (
              <div key={category.category} style={styles.card}>
                <h4 style={styles.cardTitle}>
                  <FontAwesomeIcon icon={category.icon} style={{marginRight: '10px', color: '#3b82f6'}}/>
                  {category.category}
                </h4>
                <ul style={styles.rulesList}>
                  {category.rules.map(rule => ( <li key={rule.title}><strong>{rule.title}:</strong> {rule.content}</li> ))}
                </ul>
              </div>
            ))}
          </div>
      </section>

      {/* Section des votes */}
      {canParticipateInVotes && votes.filter(v => v.status === 'En cours').length > 0 && (
        <section>
          <h3 style={styles.sectionTitle}>Votes en Cours</h3>
          <div style={styles.votesContainer}>
            {votes.filter(v => v.status === 'En cours').map(vote => (
              <div key={vote.id} style={styles.voteCard}>
                <div style={styles.voteHeader}>
                  <h4 style={styles.voteTitle}>{vote.title}</h4>
                  <TypeChip type={vote.type} />
                </div>
                <p style={styles.voteDescription}>{vote.description}</p>
                <div style={styles.voteStats}>
                  <span>Pour: <strong style={{color: '#22c55e'}}>{vote.votes_for}</strong></span>
                  <span>Contre: <strong style={{color: '#ef4444'}}>{vote.votes_against}</strong></span>
                  <span>Requis: {vote.required_majority}</span>
                </div>
                <div style={styles.voteActions}>
                  <span style={{fontSize: '12px', color: '#6b7280'}}>Fin: {new Date(vote.end_date).toLocaleDateString('fr-FR')}</span>
                  {!vote.has_voted ? (
                    <div style={styles.voteButtons}>
                      <button onClick={() => handleVote(vote.id, 'for')} style={{...styles.button, backgroundColor: '#22c55e', fontSize: '12px'}}><FontAwesomeIcon icon={faVoteYea} style={{marginRight: '4px'}} />Pour</button>
                      <button onClick={() => handleVote(vote.id, 'against')} style={{...styles.button, backgroundColor: '#ef4444', fontSize: '12px'}}>Contre</button>
                    </div>
                  ) : (<span style={{color: '#22c55e', fontSize: '12px', fontWeight: 'bold'}}>✓ Voté</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section des réunions */}
      <section>
          <div style={{...styles.header, marginTop: '40px', marginBottom: '24px'}}>
            <h3 style={styles.sectionTitle}>Calendrier des Réunions</h3>
            {canOrganizeMeetings && ( <button onClick={handleOpenMeetingModal} style={styles.button}><FontAwesomeIcon icon={faPlus} style={{marginRight: '8px'}} />Planifier</button> )}
          </div>
          {meetings.length > 0 ? (
            <div style={styles.meetingsList}>
                {meetings.map(meeting => (
                <div key={meeting.id} style={{...styles.card, ...styles.meetingCard}}>
                    <div style={styles.meetingInfo}>
                    <div style={styles.meetingHeader}>
                        <p style={styles.meetingTitle}>{meeting.title}</p>
                        <div style={styles.meetingBadges}><MeetingTypeChip type={meeting.type} /><StatusChip status={meeting.status} /></div>
                    </div>
                    <p style={styles.meetingDate}><FontAwesomeIcon icon={faCalendarAlt} style={{marginRight: '8px'}}/>{new Date(meeting.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} à {meeting.time}</p>
                    </div>
                </div>
                ))}
            </div>
          ) : (<p style={{textAlign: 'center', color: '#6b7280'}}>Aucune réunion planifiée pour le moment.</p>)}
      </section>

      {/* Modal pour planifier une réunion */}
      {isMeetingModalOpen && (
        <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
                <h3 style={styles.modalTitle}>Planifier une nouvelle réunion</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    <input type="text" placeholder="Titre de la réunion" value={newMeeting.title} onChange={e => setNewMeeting({...newMeeting, title: e.target.value})} style={styles.modalInput} />
                    <input type="date" value={newMeeting.date} onChange={e => setNewMeeting({...newMeeting, date: e.target.value})} style={styles.modalInput} />
                    <input type="time" value={newMeeting.time} onChange={e => setNewMeeting({...newMeeting, time: e.target.value})} style={styles.modalInput} />
                    <select value={newMeeting.type} onChange={e => setNewMeeting({...newMeeting, type: e.target.value as MeetingFormData['type']})} style={styles.modalInput}>
                        <option value="Comité">Comité de Gestion</option>
                        <option value="Ouverture">Ouverture du mois</option>
                        <option value="Clôture">Clôture du mois</option>
                        <option value="Extraordinaire">Extraordinaire</option>
                    </select>
                </div>
                <div style={styles.modalActions}>
                    <button onClick={() => setIsMeetingModalOpen(false)} style={{...styles.button, backgroundColor: '#6b7280'}} disabled={isSubmitting}>Annuler</button>
                    <button onClick={handleSaveMeeting} style={styles.button} disabled={isSubmitting}>{isSubmitting ? 'Planification...' : 'Planifier'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// --- SOUS-COMPOSANTS & STYLES ---
const StatusChip: React.FC<{ status: ApiMeeting['status'] }> = ({ status }) => { 
  const sC = { 'À venir': { backgroundColor: '#dcfce7', color: '#166534' }, 'En cours': { backgroundColor: '#fef3c7', color: '#92400e' }, 'Passée': { backgroundColor: '#e5e7eb', color: '#4b5563' } }; 
  return <span style={{ ...styles.chip, ...sC[status] }}>{status}</span>; 
};
const MeetingTypeChip: React.FC<{ type: ApiMeeting['type'] }> = ({ type }) => { 
  const tC = { 'Ouverture': { backgroundColor: '#dbeafe', color: '#1e40af' }, 'Clôture': { backgroundColor: '#fecaca', color: '#991b1b' }, 'Extraordinaire': { backgroundColor: '#f3e8ff', color: '#7c2d12' }, 'Comité': { backgroundColor: '#d1fae5', color: '#065f46' } }; 
  return <span style={{ ...styles.chip, ...tC[type] }}>{type}</span>; 
};
const TypeChip: React.FC<{ type: ApiVote['type'] }> = ({ type }) => { 
  const tC = { 'Modification Charte': { backgroundColor: '#fef3c7', color: '#92400e' }, 'Sanction': { backgroundColor: '#fee2e2', color: '#991b1b' }, 'Prêt Important': { backgroundColor: '#dbeafe', color: '#1e40af' }, 'Règle': { backgroundColor: '#e0e7ff', color: '#3730a3' } }; 
  return <span style={{ ...styles.chip, ...tC[type] }}>{type}</span>; 
};

const styles: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: 'Arial, sans-serif', padding: '16px', backgroundColor: '#f3f4f6', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
  headerTitle: { fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 },
  sectionTitle: { fontSize: '22px', fontWeight: 'bold', color: '#1f2937', margin: 0, borderBottom: '2px solid #3b82f6', paddingBottom: '8px' },
  errorContainer: { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  button: { padding: '10px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' },
  rulesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginTop: '24px', marginBottom: '40px' },
  card: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  cardTitle: { fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#1f2937', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', display: 'flex', alignItems: 'center' },
  rulesList: { margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#374151', lineHeight: 1.6 },
  votesContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginTop: '24px', marginBottom: '40px' },
  voteCard: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', borderLeft: '4px solid #3b82f6' },
  voteHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '8px' },
  voteTitle: { fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#1f2937' },
  voteDescription: { fontSize: '14px', color: '#4b5563', marginBottom: '16px', lineHeight: 1.5 },
  voteStats: { display: 'flex', gap: '16px', fontSize: '12px', marginBottom: '16px', flexWrap: 'wrap', color: '#374151' },
  voteActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', paddingTop: '12px' },
  voteButtons: { display: 'flex', gap: '8px' },
  meetingsList: { display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' },
  meetingCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' },
  meetingInfo: { flex: 1 },
  meetingHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' },
  meetingBadges: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' },
  meetingTitle: { fontWeight: 'bold', margin: 0, color: '#1f2937', fontSize: '16px' },
  meetingDate: { fontSize: '14px', margin: '4px 0', color: '#4b5563' },
  chip: { padding: '4px 12px', borderRadius: '9999px', fontWeight: '600', fontSize: '12px', flexShrink: 0 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' },
  modalContent: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '500px' },
  modalTitle: { fontSize: '20px', fontWeight: 'bold', marginBottom: '24px', textAlign: 'center' },
  modalInput: { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' },
};

export default Governance;