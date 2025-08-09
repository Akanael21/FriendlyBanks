// src/components/EmailVerificationPage.tsx

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

interface LocationState {
    email: string;
    message: string;
}

const EmailVerificationPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState;
    
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [email, setEmail] = useState(state?.email || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(900); // 15 minutes
    const [attemptsLeft, setAttemptsLeft] = useState(5);

    // Rediriger si pas d'email
    useEffect(() => {
        if (!email) {
            navigate('/signup');
        }
    }, [email, navigate]);

    // Timer pour l'expiration du code
    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [timeLeft]);

    // Formatter le temps restant
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Gérer la saisie des codes
    const handleCodeChange = (index: number, value: string) => {
        if (value.length > 1) return; // Empêcher plus d'un caractère
        if (!/^\d*$/.test(value)) return; // Seuls les chiffres

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Auto-focus sur le champ suivant
        if (value && index < 5) {
            const nextInput = document.getElementById(`code-${index + 1}`);
            nextInput?.focus();
        }
    };

    // Gérer la suppression (backspace)
    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            const prevInput = document.getElementById(`code-${index - 1}`);
            prevInput?.focus();
        }
    };

    // Soumettre le code de vérification
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullCode = code.join('');
        
        if (fullCode.length !== 6) {
            setError('Veuillez saisir le code complet à 6 chiffres.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE_URL}/verify-email/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    code: fullCode
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(data.message);
                setTimeout(() => {
                    navigate('/login', { 
                        state: { 
                            message: 'Compte vérifié avec succès ! Vous pouvez maintenant vous connecter.',
                            email: email 
                        } 
                    });
                }, 2000);
            } else {
                setError(data.error || 'Erreur lors de la vérification.');
                if (data.error && data.error.includes('tentatives')) {
                    setAttemptsLeft(prev => Math.max(0, prev - 1));
                }
                // Effacer le code en cas d'erreur
                setCode(['', '', '', '', '', '']);
                document.getElementById('code-0')?.focus();
            }
        } catch (error) {
            console.error('Erreur lors de la vérification:', error);
            setError('Erreur de connexion. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    // Renvoyer un nouveau code
    const handleResendCode = async () => {
        setResendLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/resend-verification/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess('Un nouveau code a été envoyé à votre email.');
                setTimeLeft(900); // Reset timer
                setAttemptsLeft(5); // Reset attempts
                setCode(['', '', '', '', '', '']); // Clear code
                document.getElementById('code-0')?.focus();
            } else {
                setError(data.error || 'Erreur lors du renvoi du code.');
            }
        } catch (error) {
            console.error('Erreur lors du renvoi:', error);
            setError('Erreur de connexion. Veuillez réessayer.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* Section de gauche - Branding */}
            <div style={styles.brandingSection}>
                <div style={styles.brandingOverlay}></div>
                <div style={styles.brandingContent}>
                    <h1 style={styles.brandingTitle}>Vérification Email</h1>
                    <p style={styles.brandingSubtitle}>
                        Nous avons envoyé un code de vérification à 6 chiffres à votre adresse email.
                    </p>
                    <div style={styles.features}>
                        <div style={styles.feature}>📧 Vérifiez votre boîte de réception</div>
                        <div style={styles.feature}>⏱️ Code valide pendant 15 minutes</div>
                        <div style={styles.feature}>🔢 6 chiffres uniques</div>
                        <div style={styles.feature}>🔄 Renouvelable si expiré</div>
                    </div>
                </div>
            </div>

            {/* Section de droite - Formulaire */}
            <div style={styles.formSection}>
                <div style={styles.formWrapper}>
                    <form onSubmit={handleSubmit} style={styles.form}>
                        <div style={styles.formHeader}>
                            <h2 style={styles.formTitle}>Saisir le Code de Vérification</h2>
                            <p style={styles.formSubtitle}>
                                Code envoyé à : <strong>{email}</strong>
                            </p>
                        </div>

                        {error && (
                            <div style={styles.errorAlert}>
                                {error}
                            </div>
                        )}

                        {success && (
                            <div style={styles.successAlert}>
                                {success}
                            </div>
                        )}

                        {/* Informations sur le timer et tentatives */}
                        <div style={styles.infoBox}>
                            <div style={styles.timer}>
                                ⏱️ Temps restant : <strong>{formatTime(timeLeft)}</strong>
                            </div>
                            <div style={styles.attempts}>
                                🎯 Tentatives restantes : <strong>{attemptsLeft}</strong>
                            </div>
                        </div>

                        {/* Champs de saisie du code */}
                        <div style={styles.codeInputContainer}>
                            <label style={styles.codeLabel}>Code de vérification :</label>
                            <div style={styles.codeInputs}>
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        id={`code-${index}`}
                                        type="text"
                                        value={digit}
                                        onChange={(e) => handleCodeChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        style={styles.codeInput}
                                        maxLength={1}
                                        autoComplete="off"
                                        disabled={loading || Boolean(success)}
                                    />
                                ))}
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            style={{
                                ...styles.submitButton,
                                ...(loading || success ? styles.buttonDisabled : {})
                            }} 
                            disabled={loading || Boolean(success) || timeLeft === 0}
                        >
                            {loading ? 'Vérification...' : 'Vérifier le Code'}
                        </button>

                        {/* Bouton pour renvoyer le code */}
                        {timeLeft === 0 || attemptsLeft === 0 ? (
                            <button 
                                type="button"
                                onClick={handleResendCode}
                                style={{
                                    ...styles.resendButton,
                                    ...(resendLoading ? styles.buttonDisabled : {})
                                }}
                                disabled={resendLoading}
                            >
                                {resendLoading ? 'Envoi...' : 'Renvoyer un nouveau code'}
                            </button>
                        ) : (
                            <button 
                                type="button"
                                onClick={handleResendCode}
                                style={styles.resendButtonSecondary}
                                disabled={resendLoading}
                            >
                                {resendLoading ? 'Envoi...' : 'Renvoyer le code'}
                            </button>
                        )}

                        <div style={styles.footerLinks}>
                            <Link to="/signup" style={styles.link}>
                                ← Retour à l'inscription
                            </Link>
                            <Link to="/login" style={styles.link}>
                                Déjà vérifié ? Se connecter →
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Styles
const styles: { [key: string]: React.CSSProperties } = {
    container: { 
        minHeight: '100vh', 
        display: 'flex', 
        fontFamily: 'system-ui, -apple-system, sans-serif' 
    },
    brandingSection: { 
        flex: 1, 
        background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: '48px', 
        color: 'white', 
        position: 'relative' 
    },
    brandingOverlay: { 
        position: 'absolute', 
        inset: 0, 
        opacity: 0.1, 
        background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' 
    },
    brandingContent: { 
        position: 'relative', 
        zIndex: 10 
    },
    brandingTitle: { 
        fontSize: '36px', 
        fontWeight: 'bold', 
        marginBottom: '16px' 
    },
    brandingSubtitle: { 
        fontSize: '18px', 
        lineHeight: '1.6', 
        color: 'rgba(209, 250, 229, 1)',
        marginBottom: '32px'
    },
    features: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    feature: {
        fontSize: '16px',
        color: 'rgba(209, 250, 229, 0.9)'
    },
    formSection: { 
        flex: 1, 
        background: '#f9fafb', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '32px' 
    },
    formWrapper: { 
        width: '100%', 
        maxWidth: '500px' 
    },
    form: { 
        background: 'white', 
        borderRadius: '16px', 
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
        padding: '40px' 
    },
    formHeader: { 
        textAlign: 'center', 
        marginBottom: '32px' 
    },
    formTitle: { 
        fontSize: '24px', 
        fontWeight: 'bold', 
        color: '#1f2937', 
        marginBottom: '8px' 
    },
    formSubtitle: { 
        color: '#6b7280',
        fontSize: '14px'
    },
    infoBox: {
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
    },
    timer: {
        color: '#166534',
        fontSize: '14px'
    },
    attempts: {
        color: '#166534',
        fontSize: '14px'
    },
    codeInputContainer: {
        marginBottom: '24px'
    },
    codeLabel: {
        display: 'block',
        marginBottom: '12px',
        fontWeight: '600',
        color: '#374151'
    },
    codeInputs: {
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '8px'
    },
    codeInput: {
        width: '50px',
        height: '60px',
        textAlign: 'center',
        fontSize: '24px',
        fontWeight: 'bold',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: '#f9fafb',
        transition: 'border-color 0.2s, background-color 0.2s',
        outline: 'none'
    },
    submitButton: { 
        width: '100%', 
        background: '#10b981', 
        color: 'white', 
        fontWeight: '600', 
        padding: '16px', 
        borderRadius: '12px', 
        border: 'none', 
        cursor: 'pointer', 
        fontSize: '16px', 
        marginBottom: '16px',
        transition: 'background-color 0.2s'
    },
    resendButton: {
        width: '100%',
        background: '#f59e0b',
        color: 'white',
        fontWeight: '600',
        padding: '14px',
        borderRadius: '12px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        marginBottom: '16px',
        transition: 'background-color 0.2s'
    },
    resendButtonSecondary: {
        width: '100%',
        background: 'transparent',
        color: '#6b7280',
        fontWeight: '500',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        cursor: 'pointer',
        fontSize: '14px',
        marginBottom: '16px',
        transition: 'all 0.2s'
    },
    buttonDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed'
    },
    footerLinks: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '24px',
        flexWrap: 'wrap',
        gap: '16px'
    },
    link: { 
        color: '#10b981', 
        textDecoration: 'none', 
        fontWeight: '500',
        fontSize: '14px'
    },
    errorAlert: {
        backgroundColor: '#fee2e2',
        color: '#dc2626',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '16px',
        border: '1px solid #fecaca'
    },
    successAlert: {
        backgroundColor: '#dcfce7',
        color: '#166534',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '16px',
        border: '1px solid #bbf7d0'
    }
};

export default EmailVerificationPage;