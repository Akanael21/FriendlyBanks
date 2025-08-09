// src/components/Profile.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faPhone, faLock, faSave } from '@fortawesome/free-solid-svg-icons';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

interface ProfileData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
}

interface PasswordData {
    current: string;
    new: string;
    confirm: string;
}

const Profile: React.FC = () => {
    const { user } = useAuth();

    const [profile, setProfile] = useState<ProfileData>({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
    });

    const [password, setPassword] = useState<PasswordData>({
        current: '',
        new: '',
        confirm: '',
    });

    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingPassword, setLoadingPassword] = useState(false);

    // Fonction pour récupérer le token depuis le AuthContext
    const getAuthToken = () => {
        // D'abord essayer depuis le contexte user
        if (user?.token) {
            return user.token;
        }
        
        // Sinon essayer depuis localStorage
        const storedUser = localStorage.getItem('friendlybanks_user');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                return userData.token;
            } catch (error) {
                console.error('Erreur lors de la lecture du token:', error);
            }
        }
        
        console.log('Aucun token trouvé');
        return null;
    };

    // Fonction pour rafraîchir le token
    const refreshToken = async () => {
        try {
            const refreshToken = localStorage.getItem('friendlybanks_refresh');
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh: refreshToken }),
            });

            if (response.ok) {
                const data = await response.json();
                const newAccessToken = data.access;
                
                // Mettre à jour le token dans localStorage
                const storedUser = localStorage.getItem('friendlybanks_user');
                if (storedUser) {
                    const userData = JSON.parse(storedUser);
                    userData.token = newAccessToken;
                    localStorage.setItem('friendlybanks_user', JSON.stringify(userData));
                }
                
                return newAccessToken;
            } else {
                throw new Error('Failed to refresh token');
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            // Rediriger vers la page de connexion ou logout
            setMessage('Session expirée. Veuillez vous reconnecter.');
            return null;
        }
    };

    // Fonction pour faire une requête avec gestion automatique du token
    const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
        let token = getAuthToken();
        
        if (!token) {
            throw new Error('No token available');
        }

        // Première tentative avec le token actuel
        let response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        // Si 401, essayer de rafraîchir le token et refaire la requête
        if (response.status === 401) {
            console.log('Token expired, trying to refresh...');
            const newToken = await refreshToken();
            
            if (newToken) {
                response = await fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Authorization': `Bearer ${newToken}`,
                        'Content-Type': 'application/json',
                    },
                });
            }
        }

        return response;
    };

    // Charger les données du profil au montage du composant
    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/user/profile/`);

            if (response.ok) {
                const userData = await response.json();
                setProfile({
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    email: userData.email || '',
                    phone: userData.phone || '',
                });
            } else {
                // Fallback avec les données de l'utilisateur connecté
                setProfile({
                    firstName: user?.username?.split(' ')[0] || '',
                    lastName: user?.username?.split(' ')[1] || '',
                    email: '', // Sera rempli depuis l'API
                    phone: '',
                });
            }
        } catch (error) {
            console.error('Erreur lors du chargement du profil:', error);
            setMessage('Erreur lors du chargement du profil');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword({ ...password, [e.target.name]: e.target.value });
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/user/profile/`, {
                method: 'PUT',
                body: JSON.stringify(profile),
            });

            if (response.ok) {
                const responseData = await response.json();
                console.log('Success response:', responseData);
                setMessage('Profil mis à jour avec succès !');
                // Optionnel: recharger les données du profil
                await fetchProfile();
            } else {
                const errorData = await response.json();
                console.log('Error response:', errorData);
                setMessage(errorData.message || 'Erreur lors de la mise à jour du profil');
            }
        } catch (error) {
            console.error('Network or parsing error:', error);
            setMessage('Erreur lors de la mise à jour du profil');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password.new !== password.confirm) {
            setMessage('Les nouveaux mots de passe ne correspondent pas.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        
        if (password.new.length < 8) {
            setMessage('Le nouveau mot de passe doit faire au moins 8 caractères.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        setLoadingPassword(true);

        try {
            const response = await authenticatedFetch(`${API_BASE_URL}/user/change-password/`, {
                method: 'PUT',
                body: JSON.stringify({
                    currentPassword: password.current,
                    newPassword: password.new,
                }),
            });

            if (response.ok) {
                setMessage('Mot de passe mis à jour avec succès !');
                setPassword({ current: '', new: '', confirm: '' });
            } else {
                const errorData = await response.json();
                setMessage(errorData.message || 'Erreur lors du changement de mot de passe');
            }
        } catch (error) {
            console.error('Erreur lors du changement de mot de passe:', error);
            setMessage('Erreur lors du changement de mot de passe');
        } finally {
            setLoadingPassword(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <>
            <header style={styles.header}>
                <h2 style={styles.headerTitle}>Paramètres du Compte</h2>
            </header>

            {message && (
                <div style={{
                    ...styles.message,
                    ...(message.includes('succès') ? styles.successMessage : styles.errorMessage)
                }}>
                    {message}
                </div>
            )}

            <div style={styles.grid}>
                {/* Section Informations Personnelles */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Informations Personnelles</h3>
                    <form onSubmit={handleProfileSubmit} style={styles.form}>
                        <InputField 
                            label="Prénom" 
                            name="firstName" 
                            value={profile.firstName} 
                            onChange={handleProfileChange} 
                            icon={faUser}
                            required 
                        />
                        <InputField 
                            label="Nom" 
                            name="lastName" 
                            value={profile.lastName} 
                            onChange={handleProfileChange} 
                            icon={faUser}
                            required 
                        />
                        <InputField 
                            label="Email" 
                            name="email" 
                            type="email" 
                            value={profile.email} 
                            onChange={handleProfileChange} 
                            icon={faEnvelope}
                            required 
                        />
                        <InputField 
                            label="Téléphone" 
                            name="phone" 
                            type="tel" 
                            value={profile.phone} 
                            onChange={handleProfileChange} 
                            icon={faPhone} 
                        />
                        <button type="submit" style={styles.button} disabled={loading}>
                            <FontAwesomeIcon icon={faSave} style={{ marginRight: '8px' }} />
                            {loading ? 'Enregistrement...' : 'Enregistrer les Modifications'}
                        </button>
                    </form>
                </div>

                {/* Section Mot de Passe */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Changer le Mot de Passe</h3>
                    <form onSubmit={handlePasswordSubmit} style={styles.form}>
                        <InputField 
                            label="Mot de passe actuel" 
                            name="current" 
                            type="password" 
                            value={password.current} 
                            onChange={handlePasswordChange} 
                            icon={faLock}
                            required 
                        />
                        <InputField 
                            label="Nouveau mot de passe" 
                            name="new" 
                            type="password" 
                            value={password.new} 
                            onChange={handlePasswordChange} 
                            icon={faLock}
                            required
                            minLength={8} 
                        />
                        <InputField 
                            label="Confirmer le nouveau mot de passe" 
                            name="confirm" 
                            type="password" 
                            value={password.confirm} 
                            onChange={handlePasswordChange} 
                            icon={faLock}
                            required 
                        />
                        <button type="submit" style={styles.button} disabled={loadingPassword}>
                            {loadingPassword ? 'Changement...' : 'Changer le Mot de Passe'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
};

// Sous-composant pour les champs avec typage approprié
interface InputFieldProps {
    label: string;
    name: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    icon: any;
    required?: boolean;
    minLength?: number;
}

const InputField: React.FC<InputFieldProps> = ({ 
    label, 
    icon, 
    type = 'text',
    required = false,
    minLength,
    ...props 
}) => (
    <div style={{ marginBottom: '16px' }}>
        <label style={styles.label}>
            {label}
            {required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
        <div style={{ position: 'relative' }}>
            <FontAwesomeIcon icon={icon} style={styles.inputIcon} />
            <input 
                style={styles.input} 
                type={type}
                required={required}
                minLength={minLength}
                {...props} 
            />
        </div>
    </div>
);

const styles: { [key: string]: React.CSSProperties } = {
    header: { 
        marginBottom: '32px' 
    },
    headerTitle: { 
        fontSize: '28px', 
        fontWeight: 'bold', 
        color: '#1f2937', 
        margin: 0 
    },
    grid: { 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
        gap: '24px' 
    },
    card: { 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '12px', 
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' 
    },
    cardTitle: { 
        fontSize: '20px', 
        fontWeight: 'bold', 
        color: '#1f2937', 
        margin: '0 0 24px 0', 
        borderBottom: '1px solid #e5e7eb', 
        paddingBottom: '12px' 
    },
    form: { 
        display: 'flex', 
        flexDirection: 'column' 
    },
    label: { 
        display: 'block', 
        marginBottom: '8px', 
        fontWeight: '600', 
        color: '#374151', 
        fontSize: '14px' 
    },
    input: { 
        width: '100%', 
        padding: '10px 10px 10px 40px', 
        border: '1px solid #d1d5db', 
        borderRadius: '8px', 
        boxSizing: 'border-box', 
        fontSize: '16px',
        transition: 'border-color 0.2s ease',
    },
    inputIcon: { 
        position: 'absolute', 
        top: '13px', 
        left: '12px', 
        color: '#9ca3af' 
    },
    button: { 
        padding: '10px 16px', 
        backgroundColor: '#2563eb', 
        color: 'white', 
        border: 'none', 
        borderRadius: '8px', 
        cursor: 'pointer', 
        fontWeight: '600', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        fontSize: '14px', 
        marginTop: '8px',
        transition: 'background-color 0.2s ease',
    },
    message: {
        padding: '12px',
        borderRadius: '8px',
        textAlign: 'center',
        marginBottom: '24px',
        fontWeight: 500,
    },
    successMessage: {
        color: '#166534',
        backgroundColor: '#dcfce7',
        border: '1px solid #bbf7d0',
    },
    errorMessage: {
        color: '#dc2626',
        backgroundColor: '#fee2e2',
        border: '1px solid #fecaca',
    },
};

export default Profile;