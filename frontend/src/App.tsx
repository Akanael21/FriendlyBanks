// Mise à jour de votre src/App.tsx existant

import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Importez tous les composants/pages nécessaires
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import EmailVerificationPage from './components/EmailVerificationPage'; // NOUVEAU
import Dashboard from './components/Dashboard';
import Members from './components/Members';
import Contributions from './components/Contributions';
import Loans from './components/Loans';
import Sanctions from './components/Sanctions';
import Governance from './components/Governance';
import Profile from './components/Profile'; // Renommé de Settings à Profile

// Ce composant protège les routes qui nécessitent une authentification
const PrivateRoute = ({ children }: { children: React.ReactElement }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Routes publiques (accessibles sans connexion) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/verify-email" element={<EmailVerificationPage />} /> {/* NOUVEAU */}

          {/* Route parente pour toutes les pages privées qui utiliseront le Layout */}
          <Route 
            path="/" 
            element={ <PrivateRoute><Layout /></PrivateRoute> }
          >
            {/* La page par défaut (quand l'URL est "/") est le Dashboard */}
            <Route index element={<Dashboard />} />
            
            {/* Toutes les autres pages s'affichent à l'intérieur du Layout */}
            <Route path="members" element={<Members />} />
            <Route path="contributions" element={<Contributions />} />
            <Route path="loans" element={<Loans />} />
            <Route path="sanctions" element={<Sanctions />} />
            <Route path="governance" element={<Governance />} />
            <Route path="settings" element={<Profile />} />
            
            {/* Ajoutez ici d'autres routes futures si nécessaire, par exemple : */}
            {/* <Route path="statistics" element={<Statistics />} /> */}
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;