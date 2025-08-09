// src/components/Layout.tsx

import React, { useState, ReactNode } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTachometerAlt, faUsers, faMoneyBillWave, faFileInvoiceDollar, faChartBar,
  faLandmark, faCog, faBars, faGavel
} from '@fortawesome/free-solid-svg-icons';

// Le composant Sidebar est à l'intérieur du Layout
const SidebarButton: React.FC<{ icon: ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
    <button onClick={onClick} style={styles.sidebarButton}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#2563eb')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
      <span style={styles.sidebarButtonIcon}>{icon}</span>
      {label}
    </button>
);

const Sidebar: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
    const navigate = useNavigate();

    return (
        <aside style={{ ...styles.sidebar, width: isOpen ? '260px' : '0px' }}>
            <div style={{ ...styles.sidebarContent, opacity: isOpen ? 1 : 0 }}>
                <div style={styles.sidebarHeader}>
                    <span style={styles.logo}>🏦</span>
                    <h1 style={styles.appName}>Friendly Banks</h1>
                    <p style={styles.appSubtitle}>Fonds d'Urgence & Investissement</p>
                </div>
                <nav style={styles.nav}>
                    <SidebarButton icon={<FontAwesomeIcon icon={faTachometerAlt} />} label="Tableau de bord" onClick={() => navigate('/')} />
                    <SidebarButton icon={<FontAwesomeIcon icon={faUsers} />} label="Membres" onClick={() => navigate('/members')} />
                    <SidebarButton icon={<FontAwesomeIcon icon={faMoneyBillWave} />} label="Cotisations" onClick={() => navigate('/contributions')} />
                    <SidebarButton icon={<FontAwesomeIcon icon={faFileInvoiceDollar}/>} label="Prêts" onClick={() => navigate('/loans')} />
                    <SidebarButton icon={<FontAwesomeIcon icon={faGavel}/>} label="Sanctions" onClick={() => navigate('/sanctions')} />
                    <SidebarButton icon={<FontAwesomeIcon icon={faLandmark}/>} label="Gouvernance" onClick={() => navigate('/governance')} />
                    <SidebarButton icon={<FontAwesomeIcon icon={faCog} />} label="Paramètres" onClick={() => navigate('/settings')} />
                </nav>
            </div>
        </aside>
    );
};

// Le composant Layout principal gère le bouton de bascule
const Layout: React.FC = () => {
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    return (
        <div style={styles.container}>
            <button 
                onClick={toggleSidebar} 
                style={{ ...styles.toggleButton, left: isSidebarOpen ? '276px' : '16px' }}
                aria-label="Toggle sidebar"
            >
                <FontAwesomeIcon icon={faBars} />
            </button>

            <Sidebar isOpen={isSidebarOpen} />
            
            <main style={{ ...styles.mainContent, paddingLeft: isSidebarOpen ? '284px' : '72px' }}>
                {/* Outlet est l'endroit où le contenu de la page active sera rendu */}
                <Outlet />
            </main>
        </div>
    );
};
  
const styles: { [key: string]: React.CSSProperties } = {
    container: { display: 'flex', minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
    sidebar: { backgroundColor: '#1e3a8a', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', transition: 'width 0.3s ease-in-out', overflowX: 'hidden', zIndex: 10 },
    sidebarContent: { padding: '24px 16px', flexGrow: 1, minWidth: '260px', transition: 'opacity 0.2s ease-in-out' },
    sidebarHeader: { textAlign: 'center', marginBottom: '32px' },
    logo: { fontSize: '32px' },
    appName: { fontSize: '24px', fontWeight: 'bold', margin: '8px 0 4px 0' },
    appSubtitle: { fontSize: '14px', color: '#93c5fd', margin: 0 },
    nav: { display: 'flex', flexDirection: 'column', gap: '8px' },
    sidebarButton: { background: 'none', border: 'none', color: 'white', fontSize: '16px', fontWeight: 500, textAlign: 'left', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '8px', transition: 'background-color 0.2s' },
    sidebarButtonIcon: { fontSize: '20px', width: '24px', textAlign: 'center' },
    mainContent: { flex: 1, padding: '24px', boxSizing: 'border-box', transition: 'padding-left 0.3s ease-in-out' },
    toggleButton: {
        position: 'fixed',
        top: '16px',
        backgroundColor: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        cursor: 'pointer',
        zIndex: 20,
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        transition: 'left 0.3s ease-in-out, transform 0.2s',
    },
};

export default Layout;