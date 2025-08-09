// src/components/LoginPage.tsx

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Affiche un message si l'utilisateur vient de s'inscrire
  const successMessage = location.state?.message;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      setError('');
      navigate('/');
    } else {
      setError('Nom d\'utilisateur ou mot de passe incorrect.');
    }
  };

  return (
    <div style={styles.container}>
      {/* Section de gauche - Branding */}
      <div style={styles.brandingSection}>
        <div style={styles.brandingOverlay}></div>
        <div style={styles.brandingContent}>
          <h1 style={styles.brandingTitle}>Friendly Banks</h1>
          <p style={styles.brandingSubtitle}>
            Gestion Intelligente du Fonds d'Urgence : plateforme sécurisée pour 
            la gestion collaborative des ressources financières.
          </p>
        </div>
      </div>

      {/* Section de droite - Formulaire */}
      <div style={styles.formSection}>
        <div style={styles.formWrapper}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formHeader}>
              <h2 style={styles.formTitle}>Bienvenue !</h2>
              <p style={styles.formSubtitle}>Accédez à votre compte Friendly Banks.</p>
            </div>

            {successMessage && <div style={styles.successMessage}>{successMessage}</div>}
            {error && <div style={styles.errorMessage}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Nom d'utilisateur" style={styles.input} />
              <div style={{ position: 'relative' }}>
                <input value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mot de passe" type={showPassword ? 'text' : 'password'} style={styles.input} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.togglePasswordButton}>{showPassword ? 'Cacher' : 'Afficher'}</button>
              </div>
              <div style={{ textAlign: 'right' }}><a href="#" style={styles.link}>Mot de passe oublié ?</a></div>
              <button type="submit" style={styles.submitButton}>Se Connecter</button>
            </div>

            <p style={styles.footerText}>
                Vous n'avez pas de compte ? <Link to="/signup" style={styles.link}>Inscrivez-vous</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- STYLES CENTRALISÉS ---
const styles: { [key: string]: React.CSSProperties } = {
    container: { minHeight: '100vh', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif' },
    brandingSection: { flex: 1, background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px', color: 'white', position: 'relative' },
    brandingOverlay: { position: 'absolute', inset: 0, opacity: 0.1, background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' },
    brandingContent: { position: 'relative', zIndex: 10 },
    brandingTitle: { fontSize: '36px', fontWeight: 'bold', marginBottom: '16px' },
    brandingSubtitle: { fontSize: '18px', lineHeight: '1.6', color: 'rgba(219, 234, 254, 1)' },
    formSection: { flex: 1, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' },
    formWrapper: { width: '100%', maxWidth: '448px' },
    form: { background: 'white', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '40px' },
    formHeader: { textAlign: 'center', marginBottom: '32px' },
    formTitle: { fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' },
    formSubtitle: { color: '#6b7280' },
    input: { width: '100%', padding: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '16px', boxSizing: 'border-box' },
    togglePasswordButton: { position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontWeight: '500' },
    errorMessage: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', textAlign: 'center' },
    successMessage: { background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', textAlign: 'center' },
    link: { color: '#3b82f6', cursor: 'pointer', fontSize: '14px', fontWeight: '500', textDecoration: 'none' },
    submitButton: { width: '100%', background: '#3b82f6', color: 'white', fontWeight: '500', padding: '16px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '16px', marginTop: '16px' },
    footerText: { textAlign: 'center', marginTop: '24px', color: '#6b7280' }
};

export default LoginPage;