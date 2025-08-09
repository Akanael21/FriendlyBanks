// src/components/SignUpPage.tsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

interface FormErrors {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
}

const SignUpPage: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ 
        firstName: '', 
        lastName: '', 
        email: '', 
        phone: '', 
        password: '', 
        confirmPassword: '' 
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [apiError, setApiError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        // Effacer l'erreur du champ quand l'utilisateur tape
        if (errors[e.target.name as keyof FormErrors]) {
            setErrors((prev: FormErrors) => ({ ...prev, [e.target.name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors: FormErrors = {};
        if (!formData.firstName.trim()) newErrors.firstName = "Le prénom est requis.";
        if (!formData.lastName.trim()) newErrors.lastName = "Le nom est requis.";
        if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "L'email est invalide.";
        if (formData.password.length < 8) newErrors.password = "Le mot de passe doit faire au moins 8 caractères.";
        if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Les mots de passe ne correspondent pas.";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setApiError('');

        try {
           const response = await fetch(`${API_BASE_URL}/signup/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                // Rediriger vers la page de vérification avec l'email
                navigate('/verify-email', { 
                    state: { 
                        email: formData.email,
                        message: data.message 
                    } 
                });
            } else {
                // Afficher les erreurs de l'API
                if (data.email) {
                    setErrors((prev: FormErrors) => ({ ...prev, email: data.email[0] }));
                } else if (data.password) {
                    setErrors((prev: FormErrors) => ({ ...prev, password: data.password[0] }));
                } else if (data.error) {
                    setApiError(data.error);
                } else if (data.non_field_errors) {
                    setApiError(data.non_field_errors[0]);
                } else {
                    setApiError('Erreur lors de la création du compte.');
                }
            }
        } catch (error) {
            console.error('Erreur lors de l\'inscription:', error);
            setApiError('Erreur de connexion. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* Section de gauche - Branding */}
            <div style={styles.brandingSection}>
                <div style={styles.brandingOverlay}></div>
                <div style={styles.brandingContent}>
                    <h1 style={styles.brandingTitle}>Rejoignez la Communauté</h1>
                    <p style={styles.brandingSubtitle}>
                        Créez votre compte pour commencer à gérer vos contributions, demander des prêts et participer à la croissance du fonds.
                    </p>
                    <div style={styles.features}>
                        <div style={styles.feature}>✓ Vérification par email sécurisée</div>
                        <div style={styles.feature}>✓ Gestion de vos contributions</div>
                        <div style={styles.feature}>✓ Demandes de prêts simplifiées</div>
                    </div>
                </div>
            </div>

            {/* Section de droite - Formulaire */}
            <div style={styles.formSection}>
                <div style={styles.formWrapper}>
                    <form onSubmit={handleSubmit} style={styles.form}>
                        <div style={styles.formHeader}>
                            <h2 style={styles.formTitle}>Créer un Compte</h2>
                            <p style={styles.formSubtitle}>Remplissez les informations ci-dessous.</p>
                        </div>
                        
                        {apiError && (
                            <div style={styles.errorAlert}>
                                {apiError}
                            </div>
                        )}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <InputField 
                                    name="firstName" 
                                    placeholder="Prénom" 
                                    value={formData.firstName} 
                                    onChange={handleChange} 
                                    error={errors.firstName}
                                    required 
                                />
                                <InputField 
                                    name="lastName" 
                                    placeholder="Nom" 
                                    value={formData.lastName} 
                                    onChange={handleChange} 
                                    error={errors.lastName}
                                    required 
                                />
                            </div>
                            <InputField 
                                name="email" 
                                type="email" 
                                placeholder="Adresse email" 
                                value={formData.email} 
                                onChange={handleChange} 
                                error={errors.email}
                                required 
                            />
                            <InputField 
                                name="phone" 
                                type="tel" 
                                placeholder="Téléphone (optionnel)" 
                                value={formData.phone} 
                                onChange={handleChange} 
                                error={errors.phone} 
                            />
                            <InputField 
                                name="password" 
                                type="password" 
                                placeholder="Mot de passe (min. 8 caractères)" 
                                value={formData.password} 
                                onChange={handleChange} 
                                error={errors.password}
                                required 
                            />
                            <InputField 
                                name="confirmPassword" 
                                type="password" 
                                placeholder="Confirmer le mot de passe" 
                                value={formData.confirmPassword} 
                                onChange={handleChange} 
                                error={errors.confirmPassword}
                                required 
                            />
                            
                            <button type="submit" style={styles.submitButton} disabled={loading}>
                                {loading ? 'Création...' : 'Créer le Compte'}
                            </button>
                        </div>
                        
                        <p style={styles.footerText}>
                            Vous avez déjà un compte ? <Link to="/login" style={styles.link}>Connectez-vous</Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Sous-composant pour les champs avec gestion d'erreur
interface InputFieldProps {
    name: string;
    error?: string;
    type?: string;
    placeholder?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({ name, error, ...props }) => (
    <div style={{flex: 1}}>
        <input 
            name={name} 
            style={{
                ...styles.input, 
                ...(error && {borderColor: '#ef4444', backgroundColor: '#fef2f2'})
            }} 
            {...props} 
        />
        {error && <p style={styles.errorText}>{error}</p>}
    </div>
);

// Styles mis à jour
const styles: { [key: string]: React.CSSProperties } = {
    container: { 
        minHeight: '100vh', 
        display: 'flex', 
        fontFamily: 'system-ui, -apple-system, sans-serif' 
    },
    brandingSection: { 
        flex: 1, 
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)', 
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
        color: 'rgba(219, 234, 254, 1)',
        marginBottom: '32px'
    },
    features: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    feature: {
        fontSize: '16px',
        color: 'rgba(219, 234, 254, 0.9)'
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
        maxWidth: '448px' 
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
        color: '#6b7280' 
    },
    input: { 
        width: '100%', 
        padding: '16px', 
        background: '#f9fafb', 
        border: '1px solid #e5e7eb', 
        borderRadius: '12px', 
        fontSize: '16px', 
        boxSizing: 'border-box',
        transition: 'border-color 0.2s, background-color 0.2s'
    },
    submitButton: { 
        width: '100%', 
        background: '#3b82f6', 
        color: 'white', 
        fontWeight: '500', 
        padding: '16px', 
        borderRadius: '12px', 
        border: 'none', 
        cursor: 'pointer', 
        fontSize: '16px', 
        marginTop: '16px',
        transition: 'background-color 0.2s'
    },
    footerText: { 
        textAlign: 'center', 
        marginTop: '24px', 
        color: '#6b7280' 
    },
    link: { 
        color: '#3b82f6', 
        textDecoration: 'none', 
        fontWeight: '600' 
    },
    errorAlert: {
        backgroundColor: '#fee2e2',
        color: '#dc2626',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '16px',
        border: '1px solid #fecaca'
    },
    errorText: {
        color: '#ef4444', 
        fontSize: '12px', 
        margin: '4px 0 0 0'
    }
};

export default SignUpPage;