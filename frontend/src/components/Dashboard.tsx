import React, { useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faFileInvoiceDollar, faCalendarAlt, faClock,
  faSignOutAlt, faPlus, faArrowRight, faSpinner
} from '@fortawesome/free-solid-svg-icons';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

// --- INTERFACES POUR LES DONNÉES DE L'API ---
interface FundStatusData {
    total_fund: number;
    monthly_contributions: number;
    active_members: number;
    loans_in_repayment: number;
    liquidity_rate: string;
}

interface DashboardData {
    berry_points: number;
    fund_status: FundStatusData;
}

// --- COMPOSANT PRINCIPAL: Dashboard ---
const Dashboard: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mettre à jour l'heure
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Récupérer les données du tableau de bord
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.token) return;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/dashboard-stats/`, {
          headers: {
            'Authorization': `Bearer ${user.token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Impossible de charger les données du tableau de bord.');
        }

        const data: DashboardData = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  return (
    <>
      <header style={styles.header}>
        <div>
          <h2 style={styles.headerTitle}>Tableau de bord</h2>
          <p style={styles.headerSubtitle}>Bienvenue, {user?.username || 'Membre'}. Voici votre résumé.</p>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.timeDisplay}>
            <FontAwesomeIcon icon={faCalendarAlt} style={{ color: '#6b7280' }} />
            <span>{currentTime.toLocaleDateString('fr-FR', { dateStyle: 'full' })}</span>
            <FontAwesomeIcon icon={faClock} style={{ color: '#6b7280', marginLeft: '10px' }}/>
            <span>{currentTime.toLocaleTimeString('fr-FR', { timeStyle: 'short' })}</span>
          </div>
          <button onClick={logout} style={styles.logoutButton}>
            <FontAwesomeIcon icon={faSignOutAlt} style={{ marginRight: '8px' }} />
            Déconnexion
          </button>
        </div>
      </header>

      <section style={styles.quickActions}>
        <ActionCard icon={<FontAwesomeIcon icon={faPlus} />} title="Nouvelle Cotisation" onClick={() => navigate('/contributions')} />
        <ActionCard icon={<FontAwesomeIcon icon={faFileInvoiceDollar} />} title="Demande de Prêt" onClick={() => navigate('/loans')} />
        {hasPermission('add_member') && (
          <ActionCard icon={<FontAwesomeIcon icon={faUsers} />} title="Ajouter un Membre" onClick={() => navigate('/members')} />
        )}
      </section>

      {loading ? (
        <div style={styles.loadingContainer}>
          <FontAwesomeIcon icon={faSpinner} spin size="2x" color="#1e3a8a" />
          <p>Chargement des données...</p>
        </div>
      ) : error ? (
        <div style={styles.errorContainer}>
          <h3>Erreur de chargement</h3>
          <p>{error}</p>
        </div>
      ) : dashboardData && (
        <section style={styles.dataGrid}>
          <InfoCard title="Points Berry - Système de Crédit">
            <div style={styles.berryPointsContainer}>
              <div style={styles.berryGauge}>
                <div style={styles.berryGaugeInner}>
                  <span style={styles.berryPointsValue}>{dashboardData.berry_points}</span>
                  <span style={styles.berryPointsLabel}>points</span>
                </div>
              </div>
              <p style={styles.berryInfo}>Votre pouvoir d’emprunt est calculé sur la base de votre score.</p>
              <Link to="/governance" style={styles.learnMoreLink}>En savoir plus <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: '4px' }} /></Link>
            </div>
          </InfoCard>

          <InfoCard title="État du Fonds">
            <ul style={styles.fundStatusList}>
              <FundStatusItem label="Total du fonds collecté" value={`${(dashboardData.fund_status.total_fund ?? 0).toLocaleString()} XAF`} />
              <FundStatusItem label="Cotisations du mois" value={`${(dashboardData.fund_status.monthly_contributions ?? 0).toLocaleString()} XAF`} />
              <FundStatusItem label="Membres actifs" value={dashboardData.fund_status.active_members} />
              <FundStatusItem label="Prêts en cours" value={dashboardData.fund_status.loans_in_repayment} />
              <FundStatusItem label="Prochaine échéance" value="24-25 du mois" />
              <FundStatusItem label="Liquidité disponible">
                <StatusChip text={dashboardData.fund_status.liquidity_rate} type={dashboardData.fund_status.liquidity_rate === 'Élevé' ? 'success' : 'warning'} />
              </FundStatusItem>
            </ul>
          </InfoCard>
        </section>
      )}
    </>
  );
};

// --- SOUS-COMPOSANTS & STYLES ---
const ActionCard: React.FC<{ icon: ReactNode; title: string; onClick: () => void }> = ({ icon, title, onClick }) => ( <div onClick={onClick} style={styles.actionCard} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0px)')}> <span style={styles.actionCardIcon}>{icon}</span> <span style={styles.actionCardTitle}>{title}</span> </div>);
const InfoCard: React.FC<{ title: string; children: ReactNode }> = ({ title, children }) => ( <div style={styles.infoCard}> <h3 style={styles.infoCardTitle}>{title}</h3> <div>{children}</div> </div>);
const FundStatusItem: React.FC<{ label: string; value?: string | number; children?: ReactNode }> = ({ label, value, children }) => ( <li style={styles.fundStatusItem}> <span style={styles.fundStatusLabel}>{label}</span> {value && <span style={styles.fundStatusValue}>{value}</span>} {children} </li>);
const StatusChip: React.FC<{ text: string; type: 'success' | 'warning' | 'danger' }> = ({ text, type }) => { const c = { success: { backgroundColor: '#dcfce7', color: '#166534' }, warning: { backgroundColor: '#fef3c7', color: '#92400e' }, danger: { backgroundColor: '#fee2e2', color: '#991b1b' }, }; return <span style={{ ...styles.statusChip, ...c[type] }}>{text}</span>;};

const styles: { [key: string]: React.CSSProperties } = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' },
  headerTitle: { fontSize: '28px', fontWeight: 'bold', color: '#1f2937', margin: 0 },
  headerSubtitle: { fontSize: '16px', color: '#6b7280', margin: '4px 0 0 0' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' },
  timeDisplay: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4b5563', backgroundColor: '#e5e7eb', padding: '8px 12px', borderRadius: '8px' },
  logoutButton: { padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', transition: 'background-color 0.2s' },
  quickActions: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '32px' },
  actionCard: { backgroundColor: '#2563eb', color: 'white', borderRadius: '12px', padding: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', userSelect: 'none', transition: 'all 0.2s ease', boxShadow: '0 4px 6px rgba(30, 64, 175, 0.2)' },
  actionCardIcon: { fontSize: '28px' },
  actionCardTitle: { fontWeight: 600, fontSize: '18px' },
  dataGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' },
  infoCard: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  infoCardTitle: { fontSize: '20px', fontWeight: 'bold', color: '#1f2937', margin: '0 0 16px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' },
  berryPointsContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  berryGauge: { width: '150px', height: '150px', backgroundColor: '#e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  berryGaugeInner: { width: '120px', height: '120px', backgroundColor: '#1e3a8a', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' },
  berryPointsValue: { fontSize: '40px', fontWeight: 'bold', lineHeight: 1 },
  berryPointsLabel: { fontSize: '14px', color: '#93c5fd' },
  berryInfo: { fontSize: '14px', color: '#4b5563', marginTop: '16px', maxWidth: '300px' },
  learnMoreLink: { color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: '14px', marginTop: '8px', display: 'flex', alignItems: 'center' },
  fundStatusList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' },
  fundStatusItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' },
  fundStatusLabel: { color: '#374151', fontWeight: 500 },
  fundStatusValue: { color: '#1f2937', fontWeight: 'bold' },
  statusChip: { padding: '4px 12px', borderRadius: '9999px', fontWeight: 600, fontSize: '12px' },
  loadingContainer: { textAlign: 'center', padding: '40px', color: '#4b5563' },
  errorContainer: { textAlign: 'center', padding: '40px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '12px' },
};

export default Dashboard;