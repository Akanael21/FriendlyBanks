import React, { useState, useEffect, useMemo, ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCheck, faTimes, faMoneyBillWave, faHistory, faCalculator } from '@fortawesome/free-solid-svg-icons';

// Ajoutez après les imports FontAwesome, avant le hook useWindowSize
const safeFormatNumber = (value: number | undefined | null): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return value.toLocaleString();
};

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

// --- INTERFACES ADAPTÉES À L'API DJANGO ---
interface ApiLoanRequest {
  id: number;
  member: number;
  member_name: string;
  amount: number;
  justification: string;
  date_requested: string;
  status: 'pending' | 'approved' | 'rejected' | 'repaid';
  interest_rate: number;
  repayment_due_date: string | null;
  guarantors: number[];
  guarantor_names: string[];
  
  // Champs calculés pour le remboursement
  total_amount_with_interest: number;
  total_repaid: number;
  remaining_balance: number;
  capital_repaid: number;
  interest_repaid: number;
  remaining_capital: number;
  remaining_interest: number;
  is_fully_repaid: boolean;
  minimum_monthly_payment: number;
  repayments: ApiLoanRepayment[];
}

interface ApiLoanRepayment {
  id: number;
  loan_request: number;
  amount: number;
  capital_amount: number;
  interest_amount: number;
  payment_type: 'partial' | 'interest_only' | 'full';
  date: string;
  notes: string;
  processed_by_name: string;
  loan_member_name: string;
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

interface LoanFormData {
  member: number;
  amount: number;
  justification: string;
  guarantors: number[];
}

interface RepaymentFormData {
  loan_request: number;
  amount: number;
  payment_type: 'partial' | 'interest_only' | 'full';
  notes: string;
}

// --- CONSTANTES ---
const MOBILE_BREAKPOINT = 768;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

// --- SERVICE DE LOGIQUE MÉTIER SELON LA CHARTE FRIENDLY BANKS ---
const LoanService = {
  getMaxLoanAmount: (berryPoints: number) => {
    if (berryPoints >= 10 && berryPoints <= 100) return 60000;
    if (berryPoints > 100 && berryPoints <= 199) return 120000;
    if (berryPoints >= 200 && berryPoints <= 499) return 300000;
    if (berryPoints >= 500) return 500000;
    return 0;
  },
  
  getInterestRate: (amount: number) => {
    if (amount > 0 && amount < 40000) return 10;
    if (amount >= 40000 && amount < 100000) return 8;
    if (amount >= 100000) return 6;
    return 0;
  },

  calculateTotalToRepay: (amount: number, interestRate: number) => {
    return amount * (1 + interestRate / 100);
  },

  getStatusDisplayName: (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'En attente',
      'approved': 'Approuvé',
      'rejected': 'Rejeté',
      'repaid': 'Remboursé'
    };
    return statusMap[status] || status;
  },

  getPaymentTypeDisplayName: (type: string) => {
    const typeMap: { [key: string]: string } = {
      'partial': 'Remboursement partiel',
      'interest_only': 'Intérêts uniquement',
      'full': 'Remboursement complet'
    };
    return typeMap[type] || type;
  }
};

// --- COMPOSANT PRINCIPAL ---
const Loans: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();

  // --- ÉTATS PRÊTS ---
  const [loans, setLoans] = useState<ApiLoanRequest[]>([]);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  
  // --- ÉTATS REMBOURSEMENTS ---
  const [repayments, setRepayments] = useState<ApiLoanRepayment[]>([]);
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [selectedLoanForRepayment, setSelectedLoanForRepayment] = useState<ApiLoanRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'loans' | 'repayments'>('loans');
  
  const initialLoanFormState: LoanFormData = {
    member: 0,
    amount: 5000,
    justification: '',
    guarantors: []
  };
  
  const initialRepaymentFormState: RepaymentFormData = {
    loan_request: 0,
    amount: 0,
    payment_type: 'partial',
    notes: ''
  };
  
  const [newLoanRequest, setNewLoanRequest] = useState(initialLoanFormState);
  const [newRepayment, setNewRepayment] = useState(initialRepaymentFormState);
  const [guarantor1Id, setGuarantor1Id] = useState<number>(0);
  const [guarantor2Id, setGuarantor2Id] = useState<number>(0);

  // --- CALCULS MEMOIZÉS ---
  const selectedMember = useMemo(() => {
    return members.find(m => m.id === newLoanRequest.member);
  }, [newLoanRequest.member, members]);
  
  const loanDetails = useMemo(() => {
    if (!selectedMember) return null;
    
    const maxAmount = LoanService.getMaxLoanAmount(selectedMember.berry_score);
    const interestRate = LoanService.getInterestRate(newLoanRequest.amount);
    const totalToRepay = LoanService.calculateTotalToRepay(newLoanRequest.amount, interestRate);
    
    let error = '';
    if (newLoanRequest.amount > maxAmount) {
      error = `Le montant dépasse votre plafond de prêt de ${safeFormatNumber(maxAmount)} XAF.`;
    }
    
    return { maxAmount, interestRate, totalToRepay, error };
  }, [newLoanRequest.amount, selectedMember]);

  const repaymentCalculations = useMemo(() => {
    if (!selectedLoanForRepayment) return null;
    
    const loan = selectedLoanForRepayment;
    const amount = newRepayment.amount;
    
    if (amount <= 0) return null;
    
    let capitalAmount = 0;
    let interestAmount = 0;
    let error = '';
    
    if (amount > loan.remaining_balance) {
      error = `Le montant dépasse le solde restant (${safeFormatNumber(loan.remaining_balance)} XAF)`;
    } else if (newRepayment.payment_type === 'interest_only') {
      if (amount > loan.remaining_interest) {
        error = `Le montant dépasse les intérêts restants (${safeFormatNumber(loan.remaining_interest)} XAF)`;
      } else {
        interestAmount = amount;
        capitalAmount = 0;
      }
    } else {
      // Remboursement partiel ou complet
      if (amount <= loan.remaining_interest) {
        interestAmount = amount;
        capitalAmount = 0;
      } else {
        interestAmount = loan.remaining_interest;
        capitalAmount = amount - loan.remaining_interest;
        
        // Vérifier le minimum de 10% du capital pour les remboursements de capital
        if (capitalAmount > 0 && capitalAmount < loan.minimum_monthly_payment && loan.remaining_capital > loan.minimum_monthly_payment) {
          error = `Le remboursement de capital doit être d'au moins ${safeFormatNumber(loan.minimum_monthly_payment)} XAF (10% du capital restant)`;
        }
      }
    }
    
    return { capitalAmount, interestAmount, error };
  }, [newRepayment.amount, newRepayment.payment_type, selectedLoanForRepayment]);

  const loanStats = useMemo(() => ({
    pendingCount: loans.filter(l => l.status === 'pending').length,
    activeLoanAmount: loans.filter(l => l.status === 'approved').reduce((sum, l) => sum + (l.remaining_balance ?? 0), 0),
    repaidAmount: loans.reduce((sum, l) => sum + (l.total_repaid ?? 0), 0),
  }), [loans]);
  
  // --- FONCTIONS API ---
  const fetchLoans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/loan-requests/`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      setLoans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des prêts');
      console.error('Erreur lors du chargement des prêts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRepayments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/loan-repayments/`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();
      setRepayments(data);
    } catch (err) {
      console.error('Erreur lors du chargement des remboursements:', err);
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
      fetchLoans();
      fetchRepayments();
      fetchMembers();
    }
  }, [user?.token]);

  const { width } = useWindowSize();
  const isMobile = width < MOBILE_BREAKPOINT;

  // --- VÉRIFICATION DES PERMISSIONS ---
  if (!hasPermission('view_loans')) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h3>Accès refusé</h3>
          <p>Vous n'avez pas la permission de consulter les prêts.</p>
        </div>
      </div>
    );
  }

  // --- GESTIONNAIRES D'ÉVÉNEMENTS PRÊTS ---
  const handleOpenLoanModal = () => {
    if (!hasPermission('add_loan_requests')) {
      alert("Vous n'avez pas la permission de faire une demande de prêt.");
      return;
    }

    const currentMember = members.find(m => m.user.id === parseInt(user?.id || '0'));
    setNewLoanRequest({
      ...initialLoanFormState,
      member: currentMember?.id || 0
    });
    setGuarantor1Id(0);
    setGuarantor2Id(0);
    setFormError('');
    setIsLoanModalOpen(true);
  };

  const handleStatusUpdate = async (id: number, status: 'approved' | 'rejected') => {
    if (!hasPermission('approve_loans')) {
      alert("Vous n'avez pas la permission d'approuver des prêts.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/loan-requests/${id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour du statut');
      }

      await fetchLoans();
      alert(`Prêt ${status === 'approved' ? 'approuvé' : 'rejeté'} avec succès`);
      
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const handleSaveLoanRequest = async () => {
    if (!selectedMember || !loanDetails || !newLoanRequest.justification || !guarantor1Id || !guarantor2Id) {
      setFormError("Veuillez remplir tous les champs.");
      return;
    }
    
    if (loanDetails.error) {
      setFormError(loanDetails.error);
      return;
    }
    
    if (guarantor1Id === guarantor2Id || guarantor1Id === selectedMember.id || guarantor2Id === selectedMember.id) {
      setFormError("Veuillez choisir deux avaliseurs distincts et différents de vous-même.");
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const loanData = {
        member: newLoanRequest.member,
        amount: newLoanRequest.amount,
        justification: newLoanRequest.justification,
        guarantors: [guarantor1Id, guarantor2Id],
        interest_rate: loanDetails.interestRate
      };

      const response = await fetch(`${API_BASE_URL}/loan-requests/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loanData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création de la demande');
      }

      await fetchLoans();
      setIsLoanModalOpen(false);
      alert('Demande de prêt soumise avec succès !');
      
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la création');
      console.error('Erreur lors de la création:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- GESTIONNAIRES D'ÉVÉNEMENTS REMBOURSEMENTS ---
  const handleOpenRepaymentModal = (loan: ApiLoanRequest) => {
    if (!hasPermission('add_repayments') && !hasPermission('manage_loans')) {
      alert("Vous n'avez pas la permission d'effectuer des remboursements.");
      return;
    }

    if (loan.status !== 'approved') {
      alert("Seuls les prêts approuvés peuvent faire l'objet de remboursements.");
      return;
    }

    setSelectedLoanForRepayment(loan);
    setNewRepayment({
      ...initialRepaymentFormState,
      loan_request: loan.id,
      amount: loan.minimum_monthly_payment ?? 0
    });
    setFormError('');
    setIsRepaymentModalOpen(true);
  };

  const handleSaveRepayment = async () => {
    if (!selectedLoanForRepayment || !repaymentCalculations || repaymentCalculations.error) {
      setFormError(repaymentCalculations?.error || "Veuillez vérifier les données saisies.");
      return;
    }

    if (newRepayment.amount <= 0) {
      setFormError("Le montant doit être positif.");
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const repaymentData = {
        loan_request: newRepayment.loan_request,
        amount: newRepayment.amount,
        payment_type: newRepayment.payment_type,
        notes: newRepayment.notes,
        capital_amount: repaymentCalculations.capitalAmount,
        interest_amount: repaymentCalculations.interestAmount
      };

      const response = await fetch(`${API_BASE_URL}/loan-repayments/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(repaymentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création du remboursement');
      }

      await fetchLoans();
      await fetchRepayments();
      setIsRepaymentModalOpen(false);
      alert('Remboursement effectué avec succès !');
      
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors du remboursement');
      console.error('Erreur lors du remboursement:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMemberName = (memberId: number) => {
    const member = members.find(m => m.id === memberId);
    return member ? `${member.user.first_name} ${member.user.last_name}` : 'Membre inconnu';
  };

  const getGuarantorNames = (guarantorIds: number[]) => {
    return guarantorIds.map(id => getMemberName(id)).join(', ');
  };

  // --- PERMISSIONS D'AFFICHAGE ---
  const canViewStats = hasPermission('view_reports') || hasPermission('approve_loans');
  const canAddLoans = hasPermission('add_loan_requests');
  const canApproveLoans = hasPermission('approve_loans');
  const canAddRepayments = hasPermission('add_repayments') || hasPermission('manage_loans');

  // --- AFFICHAGE DE L'ERREUR ---
  if (error && !loading) {
    return (
      <div style={styles.page}>
        <div style={styles.errorContainer}>
          <h3>Erreur de chargement</h3>
          <p>{error}</p>
          <button onClick={fetchLoans} style={styles.button}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // --- RENDU PRINCIPAL ---
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h2 style={styles.headerTitle}>
          Gestion des Prêts & Remboursements
          {loading && <span style={styles.loadingText}> (Chargement...)</span>}
        </h2>
        <button onClick={() => navigate('/')} style={{...styles.button, backgroundColor: '#6b7280'}}>
          ← Retour
        </button>
      </header>
      
      {canViewStats && (
        <section style={styles.statSection}>
          <StatCard title="Solde des Prêts Actifs" value={`${(loanStats.activeLoanAmount ?? 0).toLocaleString()} XAF`} />
          <StatCard title="Demandes en Attente" value={loanStats.pendingCount} />
          <StatCard title="Total Remboursé" value={`${(loanStats.repaidAmount ?? 0).toLocaleString()} XAF`} />
        </section>
      )}

      {/* Onglets */}
      <section style={styles.tabSection}>
        <button 
          onClick={() => setActiveTab('loans')} 
          style={{
            ...styles.tabButton, 
            ...(activeTab === 'loans' ? styles.activeTab : styles.inactiveTab)
          }}
        >
          <FontAwesomeIcon icon={faMoneyBillWave} style={{ marginRight: '8px' }} />
          Prêts
        </button>
        <button 
          onClick={() => setActiveTab('repayments')} 
          style={{
            ...styles.tabButton, 
            ...(activeTab === 'repayments' ? styles.activeTab : styles.inactiveTab)
          }}
        >
          <FontAwesomeIcon icon={faHistory} style={{ marginRight: '8px' }} />
          Remboursements
        </button>
      </section>

      {/* Contenu des onglets */}
      {activeTab === 'loans' ? (
        <>
          <section style={styles.controlsSection}>
            {canAddLoans && (
              <button onClick={handleOpenLoanModal} style={styles.button}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                Faire une Demande de Prêt
              </button>
            )}
          </section>

          {loading ? (
            <div style={styles.loadingContainer}>
              <p>Chargement des prêts...</p>
            </div>
          ) : loans.length === 0 ? (
            <div style={styles.emptyState}>
              <p>Aucune demande de prêt trouvée.</p>
              {canAddLoans && <p>Commencez par faire votre première demande !</p>}
            </div>
          ) : (
            isMobile ? (
              <MobileLoanList 
                loans={loans} 
                members={members}
                hasPermission={hasPermission} 
                onStatusUpdate={handleStatusUpdate} 
                onRepayment={handleOpenRepaymentModal}
                getMemberName={getMemberName}
                getGuarantorNames={getGuarantorNames}
                canAddRepayments={canAddRepayments}
              />
            ) : (
              <DesktopLoanTable 
                loans={loans} 
                members={members}
                hasPermission={hasPermission} 
                onStatusUpdate={handleStatusUpdate} 
                onRepayment={handleOpenRepaymentModal}
                getMemberName={getMemberName}
                getGuarantorNames={getGuarantorNames}
                canAddRepayments={canAddRepayments}
              />
            )
          )}
        </>
      ) : (
        <RepaymentSection 
          repayments={repayments}
          loading={loading}
          isMobile={isMobile}
        />
      )}

      {/* Informations sur les permissions */}
      {!canAddLoans && !canAddRepayments && (
        <div style={styles.permissionInfo}>
          <p>
            <strong>Information :</strong> Vous pouvez consulter les prêts et remboursements mais pas en effectuer. 
            Contactez le Comité de Gestion pour plus d'informations.
          </p>
        </div>
      )}

      {/* Modal Demande de Prêt */}
      {isLoanModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Nouvelle Demande de Prêt</h3>
            {formError && <p style={styles.formError}>{formError}</p>}
            
            <div style={styles.modalForm}>
              {hasPermission('create_loan_for_others') ? (
                <ModalSelect 
                  label="Membre demandeur" 
                  value={newLoanRequest.member} 
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewLoanRequest({
                    ...newLoanRequest, 
                    member: parseInt(e.target.value)
                  })}
                  disabled={isSubmitting}
                >
                  <option value={0} disabled>Sélectionner un membre...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.user.first_name} {m.user.last_name} ({m.berry_score} pts Berry)
                    </option>
                  ))}
                </ModalSelect>
              ) : (
                <div>
                  <label style={styles.modalLabel}>Membre demandeur</label>
                  <div style={styles.disabledInput}>
                    {selectedMember ? `${selectedMember.user.first_name} ${selectedMember.user.last_name}` : 'Membre Actuel'}
                  </div>
                </div>
              )}

              {selectedMember && (
                <>
                  <ModalInput 
                    label="Montant souhaité (XAF)" 
                    type="number" 
                    step="1000" 
                    value={newLoanRequest.amount} 
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewLoanRequest({
                      ...newLoanRequest, 
                      amount: parseFloat(e.target.value) || 0
                    })}
                    disabled={isSubmitting}
                  />
                  
                  {loanDetails && (
                    <div style={styles.loanDetailsBox}>
                      <p>Plafond de prêt: <strong>{(loanDetails.maxAmount ?? 0).toLocaleString()} XAF</strong></p>
                      <p>Taux d'intérêt: <strong>{loanDetails.interestRate}%</strong></p>
                      <p>Total à rembourser: <strong>{(loanDetails.totalToRepay ?? 0).toLocaleString()} XAF</strong></p>
                      {loanDetails.error && <p style={{color: '#ef4444'}}>{loanDetails.error}</p>}
                    </div>
                  )}
                  
                  <ModalTextarea 
                    label="Motif de la demande (urgence avérée)" 
                    value={newLoanRequest.justification} 
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewLoanRequest({
                      ...newLoanRequest, 
                      justification: e.target.value
                    })}
                    placeholder="Décrivez précisément la nature de votre urgence..."
                    disabled={isSubmitting}
                  />
                  
                  <ModalSelect 
                    label="Avaliseur / Garant 1" 
                    value={guarantor1Id} 
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setGuarantor1Id(parseInt(e.target.value))}
                    disabled={isSubmitting}
                  >
                    <option value={0} disabled>Sélectionner...</option>
                    {members.filter(m => m.id !== newLoanRequest.member).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.user.first_name} {m.user.last_name}
                      </option>
                    ))}
                  </ModalSelect>
                  
                  <ModalSelect 
                    label="Avaliseur / Garant 2" 
                    value={guarantor2Id} 
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setGuarantor2Id(parseInt(e.target.value))}
                    disabled={isSubmitting}
                  >
                    <option value={0} disabled>Sélectionner...</option>
                    {members.filter(m => m.id !== newLoanRequest.member).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.user.first_name} {m.user.last_name}
                      </option>
                    ))}
                  </ModalSelect>
                </>
              )}
            </div>

            <div style={styles.modalActions}>
              <button 
                onClick={() => setIsLoanModalOpen(false)} 
                style={{...styles.button, backgroundColor: '#6b7280'}}
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button 
                onClick={handleSaveLoanRequest} 
                style={styles.button}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Soumission...' : 'Soumettre la Demande'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Remboursement */}
      {isRepaymentModalOpen && selectedLoanForRepayment && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Effectuer un Remboursement</h3>
            {formError && <p style={styles.formError}>{formError}</p>}
            
            <div style={styles.modalForm}>
              <div style={styles.loanInfoBox}>
                <h4>Informations du Prêt #{selectedLoanForRepayment.id}</h4>
                <p><strong>Emprunteur :</strong> {selectedLoanForRepayment.member_name}</p>
                <p><strong>Montant initial :</strong> {(selectedLoanForRepayment.amount ?? 0).toLocaleString()} XAF</p>
                <p><strong>Solde restant :</strong> {(selectedLoanForRepayment.remaining_balance ?? 0).toLocaleString()} XAF</p>
                <p><strong>Capital restant :</strong> {(selectedLoanForRepayment.remaining_capital ?? 0).toLocaleString()} XAF</p>
                <p><strong>Intérêts restants :</strong> {(selectedLoanForRepayment.remaining_interest ?? 0).toLocaleString()} XAF</p>
                <p><strong>Paiement minimum :</strong> {(selectedLoanForRepayment.minimum_monthly_payment ?? 0).toLocaleString()} XAF</p>
              </div>

              <ModalSelect 
                label="Type de remboursement" 
                value={newRepayment.payment_type} 
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setNewRepayment({
                  ...newRepayment, 
                  payment_type: e.target.value as 'partial' | 'interest_only' | 'full'
                })}
                disabled={isSubmitting}
              >
                <option value="partial">Remboursement partiel</option>
                <option value="interest_only">Intérêts uniquement</option>
                <option value="full">Remboursement complet</option>
              </ModalSelect>

              <ModalInput 
                label="Montant à rembourser (XAF)" 
                type="number" 
                step="100" 
                value={newRepayment.amount} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewRepayment({
                  ...newRepayment, 
                  amount: parseFloat(e.target.value) || 0
                })}
                disabled={isSubmitting}
              />

              {repaymentCalculations && (
                <div style={styles.calculationBox}>
                  <h4><FontAwesomeIcon icon={faCalculator} /> Répartition du remboursement :</h4>
                  <p><strong>Capital :</strong> {(repaymentCalculations.capitalAmount ?? 0).toLocaleString()} XAF</p>
                  <p><strong>Intérêts :</strong> {(repaymentCalculations.interestAmount ?? 0).toLocaleString()} XAF</p>
                  {repaymentCalculations.error && (
                    <p style={{color: '#ef4444'}}>{repaymentCalculations.error}</p>
                  )}
                </div>
              )}

              <ModalTextarea 
                label="Notes (optionnel)" 
                value={newRepayment.notes} 
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewRepayment({
                  ...newRepayment, 
                  notes: e.target.value
                })}
                placeholder="Notes sur ce remboursement..."
                disabled={isSubmitting}
              />
            </div>

            <div style={styles.modalActions}>
              <button 
                onClick={() => setIsRepaymentModalOpen(false)} 
                style={{...styles.button, backgroundColor: '#6b7280'}}
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button 
                onClick={handleSaveRepayment} 
                style={styles.button}
                disabled={isSubmitting || (repaymentCalculations?.error ? true : false)}
              >
                {isSubmitting ? 'Traitement...' : 'Effectuer le Remboursement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPOSANTS SPÉCIALISÉS ---

// Section Remboursements
const RepaymentSection: React.FC<{
  repayments: ApiLoanRepayment[];
  loading: boolean;
  isMobile: boolean;
}> = ({ repayments, loading, isMobile }) => (
  <div>
    <h3 style={{marginBottom: '16px', color: '#1f2937'}}>Historique des Remboursements</h3>
    
    {loading ? (
      <div style={styles.loadingContainer}>
        <p>Chargement des remboursements...</p>
      </div>
    ) : repayments.length === 0 ? (
      <div style={styles.emptyState}>
        <p>Aucun remboursement enregistré.</p>
      </div>
    ) : isMobile ? (
      <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
        {repayments.map(repayment => (
          <div key={repayment.id} style={styles.mobileCard}>
            <div style={styles.mobileCardHeader}>
              <span style={{fontWeight: 'bold'}}>
                Prêt #{repayment.loan_request} - {repayment.loan_member_name}
              </span>
              <span style={{...styles.chip, backgroundColor: '#dcfce7', color: '#166534'}}>
                {LoanService.getPaymentTypeDisplayName(repayment.payment_type)}
              </span>
            </div>
            <div style={styles.mobileCardBody}>
              <div style={styles.mobileCardRow}>
                <span>Montant:</span> 
                <strong>{(repayment.amount ?? 0).toLocaleString()} XAF</strong>
              </div>
              <div style={styles.mobileCardRow}>
                <span>Capital:</span> 
                <span>{(repayment.capital_amount ?? 0).toLocaleString()} XAF</span>
              </div>
              <div style={styles.mobileCardRow}>
                <span>Intérêts:</span> 
                <span>{(repayment.interest_amount ?? 0).toLocaleString()} XAF</span>
              </div>
              <div style={styles.mobileCardRow}>
                <span>Date:</span> 
                <span>{new Date(repayment.date).toLocaleDateString('fr-FR')}</span>
              </div>
              {repayment.processed_by_name && (
                <div style={styles.mobileCardRow}>
                  <span>Traité par:</span> 
                  <span>{repayment.processed_by_name}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Prêt</th>
              <th style={styles.th}>Emprunteur</th>
              <th style={styles.th}>Montant</th>
              <th style={styles.th}>Capital</th>
              <th style={styles.th}>Intérêts</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Traité par</th>
            </tr>
          </thead>
          <tbody>
            {repayments.map(repayment => (
              <tr key={repayment.id}>
                <td style={styles.td}>#{repayment.loan_request}</td>
                <td style={styles.td}>{repayment.loan_member_name}</td>
                <td style={styles.td}>{(repayment.amount ?? 0).toLocaleString()} XAF</td>
                <td style={styles.td}>{(repayment.capital_amount ?? 0).toLocaleString()} XAF</td>
                <td style={styles.td}>{(repayment.interest_amount ?? 0).toLocaleString()} XAF</td>
                <td style={styles.td}>
                  <span style={{...styles.chip, backgroundColor: '#dcfce7', color: '#166534'}}>
                    {LoanService.getPaymentTypeDisplayName(repayment.payment_type)}
                  </span>
                </td>
                <td style={styles.td}>{new Date(repayment.date).toLocaleDateString('fr-FR')}</td>
                <td style={styles.td}>{repayment.processed_by_name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// --- VUES DESKTOP & MOBILE POUR LES PRÊTS ---
interface TableProps {
  loans: ApiLoanRequest[];
  members: ApiMember[];
  hasPermission: any;
  onStatusUpdate: (id: number, status: 'approved' | 'rejected') => void;
  onRepayment: (loan: ApiLoanRequest) => void;
  getMemberName: (id: number) => string;
  getGuarantorNames: (ids: number[]) => string;
  canAddRepayments: boolean;
}

const DesktopLoanTable: React.FC<TableProps> = ({ 
  loans, 
  members, 
  hasPermission, 
  onStatusUpdate, 
  onRepayment,
  getMemberName, 
  getGuarantorNames,
  canAddRepayments
}) => (
  <div style={styles.tableContainer}>
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>Membre</th>
          <th style={styles.th}>Montant</th>
          <th style={styles.th}>Solde</th>
          <th style={styles.th}>Progression</th>
          <th style={styles.th}>Statut</th>
          <th style={styles.th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {loans.map(loan => {
          const totalToRepay = loan.total_amount_with_interest ?? 0;
          const totalRepaid = loan.total_repaid ?? 0;
          const progressPercentage = totalToRepay > 0 ? ((totalRepaid / totalToRepay) * 100).toFixed(1) : "0.0";
          
          return (
            <tr key={loan.id}>
              <td style={styles.td}>{loan.member_name}</td>
              <td style={styles.td}>{(loan.amount ?? 0).toLocaleString()} XAF</td>
              <td style={styles.td}>
                {loan.status === 'approved' ? (
                  <div>
                    <div>{(loan.remaining_balance ?? 0).toLocaleString()} XAF</div>
                    <div style={{fontSize: '12px', color: '#6b7280'}}>
                      sur {(totalToRepay).toLocaleString()} XAF
                    </div>
                  </div>
                ) : (
                  loan.status === 'repaid' ? '0 XAF' : '-'
                )}
              </td>
              <td style={styles.td}>
                {(loan.status === 'approved' || loan.status === 'repaid') && (
                  <div style={{width: '100px'}}>
                    <div style={{
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      height: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        backgroundColor: loan.is_fully_repaid ? '#22c55e' : '#3b82f6',
                        height: '100%',
                        width: `${progressPercentage}%`,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{fontSize: '12px', marginTop: '2px', textAlign: 'center'}}>
                      {progressPercentage}%
                    </div>
                  </div>
                )}
              </td>
              <td style={styles.td}>
                <StatusChip status={LoanService.getStatusDisplayName(loan.status)} />
              </td>
              <td style={styles.td}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {loan.status === 'pending' && hasPermission('approve_loans') && (
                    <>
                      <button 
                        onClick={() => onStatusUpdate(loan.id, 'approved')} 
                        style={{...styles.actionButton, backgroundColor: '#22c55e'}} 
                        title="Approuver"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                      <button 
                        onClick={() => onStatusUpdate(loan.id, 'rejected')} 
                        style={{...styles.actionButton, backgroundColor: '#ef4444'}} 
                        title="Rejeter"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </>
                  )}
                  {loan.status === 'approved' && !loan.is_fully_repaid && canAddRepayments && (
                    <button 
                      onClick={() => onRepayment(loan)} 
                      style={{...styles.actionButton, backgroundColor: '#3b82f6'}} 
                      title="Rembourser"
                    >
                      <FontAwesomeIcon icon={faMoneyBillWave} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const MobileLoanList: React.FC<TableProps> = ({ 
  loans, 
  members, 
  hasPermission, 
  onStatusUpdate, 
  onRepayment,
  getMemberName, 
  getGuarantorNames,
  canAddRepayments
}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
    {loans.map(loan => {
      const totalToRepay = loan.total_amount_with_interest ?? 0;
      const totalRepaid = loan.total_repaid ?? 0;
      const progressPercentage = totalToRepay > 0 ? ((totalRepaid / totalToRepay) * 100).toFixed(1) : "0.0";
      
      return (
        <div key={loan.id} style={styles.mobileCard}>
          <div style={styles.mobileCardHeader}>
            <span style={{fontWeight: 'bold', color: '#1f2937'}}>
              {loan.member_name}
            </span>
            <StatusChip status={LoanService.getStatusDisplayName(loan.status)} />
          </div>
          <div style={styles.mobileCardBody}>
            <div style={styles.mobileCardRow}>
              <span>Montant initial:</span> 
              <strong>{(loan.amount ?? 0).toLocaleString()} XAF</strong>
            </div>
            {(loan.status === 'approved' || loan.status === 'repaid') && (
              <>
                <div style={styles.mobileCardRow}>
                  <span>Solde restant:</span> 
                  <strong style={{color: loan.is_fully_repaid ? '#22c55e' : '#ef4444'}}>
                    {(loan.remaining_balance ?? 0).toLocaleString()} XAF
                  </strong>
                </div>
                <div style={styles.mobileCardRow}>
                  <span>Progression:</span> 
                  <span>{progressPercentage}% remboursé</span>
                </div>
              </>
            )}
          </div>
          
          <div style={styles.mobileCardFooter}>
            {loan.status === 'pending' && hasPermission('approve_loans') && (
              <>
                <button 
                  onClick={() => onStatusUpdate(loan.id, 'approved')} 
                  style={{...styles.button, flex: 1, backgroundColor: '#22c55e'}}
                >
                  <FontAwesomeIcon icon={faCheck} style={{marginRight: '8px'}}/> 
                  Approuver
                </button>
                <button 
                  onClick={() => onStatusUpdate(loan.id, 'rejected')} 
                  style={{...styles.button, flex: 1, backgroundColor: '#ef4444'}}
                >
                  <FontAwesomeIcon icon={faTimes} style={{marginRight: '8px'}}/> 
                  Rejeter
                </button>
              </>
            )}
            {loan.status === 'approved' && !loan.is_fully_repaid && canAddRepayments && (
              <button 
                onClick={() => onRepayment(loan)} 
                style={{...styles.button, flex: 1, backgroundColor: '#3b82f6'}}
              >
                <FontAwesomeIcon icon={faMoneyBillWave} style={{marginRight: '8px'}}/> 
                Rembourser
              </button>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

// --- SOUS-COMPOSANTS & STYLES ---
const StatCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
  <div style={{...styles.card, flex: '1 1 250px', textAlign: 'center' }}>
    <h4 style={styles.statTitle}>{title}</h4>
    <p style={styles.statValue}>{value}</p>
  </div>
);

const StatusChip: React.FC<{ status: string }> = ({ status }) => { 
  const statusColors: { [key: string]: { backgroundColor: string; color: string } } = {
    'En attente': { backgroundColor: '#fef3c7', color: '#92400e' },
    'Approuvé': { backgroundColor: '#dcfce7', color: '#166534' },
    'Rejeté': { backgroundColor: '#fee2e2', color: '#991b1b' },
    'Remboursé': { backgroundColor: '#e0e7ff', color: '#3730a3' }
  };
  
  return (
    <span style={{ ...styles.chip, ...statusColors[status] }}>
      {status}
    </span>
  ); 
};

interface ModalInputProps extends InputHTMLAttributes<HTMLInputElement> { 
  label: string; 
}
const ModalInput: React.FC<ModalInputProps> = ({ label, ...props }) => (
  <div>
    <label style={styles.modalLabel}>{label}</label>
    <input style={styles.modalInput} {...props} />
  </div>
);

interface ModalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> { 
  label: string; 
  children: ReactNode; 
}
const ModalSelect: React.FC<ModalSelectProps> = ({ label, children, ...props }) => (
  <div>
    <label style={styles.modalLabel}>{label}</label>
    <select style={styles.modalInput} {...props}>{children}</select>
  </div>
);

interface ModalTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { 
  label: string; 
}
const ModalTextarea: React.FC<ModalTextareaProps> = ({ label, ...props }) => (
  <div>
    <label style={styles.modalLabel}>{label}</label>
    <textarea style={{...styles.modalInput, height: '80px'}} {...props} />
  </div>
);

const styles: { [key: string]: React.CSSProperties } = {
  page: { fontFamily: 'Arial, sans-serif', padding: '16px', backgroundColor: '#f3f4f6', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
  headerTitle: { fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 },
  loadingText: { fontSize: '16px', fontWeight: 'normal', color: '#6b7280' },
  errorContainer: { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  loadingContainer: { textAlign: 'center', padding: '40px' },
  emptyState: { textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  statSection: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' },
  card: { backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  statTitle: { margin: 0, color: '#4b5563', fontSize: '14px', fontWeight: '600' },
  statValue: { margin: '8px 0 0 0', color: '#1e3a8a', fontSize: '22px', fontWeight: 'bold' },
  
  // Styles des onglets
  tabSection: { display: 'flex', marginBottom: '24px', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)' },
  tabButton: { flex: 1, padding: '12px 24px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  activeTab: { backgroundColor: '#3b82f6', color: 'white' },
  inactiveTab: { backgroundColor: 'white', color: '#6b7280' },
  
  controlsSection: { marginBottom: '24px' },
  button: { padding: '10px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s', fontSize: '14px' },
  permissionInfo: { backgroundColor: '#e0f2fe', padding: '12px', borderRadius: '8px', marginTop: '16px', border: '1px solid #0891b2' },
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#4b5563', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: '600' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #e5e7eb', verticalAlign: 'middle' },
  chip: { padding: '4px 12px', borderRadius: '9999px', fontWeight: '600', fontSize: '12px' },
  actionButton: { padding: '8px 12px', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' },
  
  // Styles des modals
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' },
  modalContent: { backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '600px', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalTitle: { fontSize: '22px', fontWeight: 'bold', marginBottom: '24px', color: '#1f2937', flexShrink: 0, textAlign: 'center' },
  modalForm: { flexGrow: 1, overflowY: 'auto', paddingRight: '12px', marginRight: '-12px', display: 'flex', flexDirection: 'column', gap: '16px' },
  modalLabel: { display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151', fontSize: '14px' },
  modalInput: { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box', fontSize: '16px' },
  disabledInput: { width: '100%', padding: '10px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', color: '#6b7280', borderRadius: '8px', boxSizing: 'border-box', fontSize: '16px' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', flexShrink: 0 },
  formError: { color: '#ef4444', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' },
  
  // Styles spécifiques aux remboursements
  loanDetailsBox: { backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '8px', fontSize: '14px', lineHeight: 1.6, borderLeft: '4px solid #3b82f6'},
  loanInfoBox: { backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px', fontSize: '14px', lineHeight: 1.6, borderLeft: '4px solid #0ea5e9' },
  calculationBox: { backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '8px', fontSize: '14px', lineHeight: 1.6, borderLeft: '4px solid #22c55e' },
  
  // Styles mobile
  mobileCard: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', overflow: 'hidden'},
  mobileCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb'},
  mobileCardBody: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  mobileCardRow: { display: 'flex', justifyContent: 'space-between', fontSize: '14px' },
  mobileCardFooter: { padding: '12px 16px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px' },
};

export default Loans;