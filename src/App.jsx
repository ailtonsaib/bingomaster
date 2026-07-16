import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import HideBase44Widget from './components/HideBase44Widget';
import Home from '@/pages/Home';
import CategorySelect from '@/pages/CategorySelect';
import Landing from '@/pages/Landing';
import Portal from '@/pages/Portal';
import BingoLogin from '@/pages/BingoLogin';
import ValidadorLogin from '@/pages/ValidadorLogin';
import NewGame from '@/pages/NewGame';
import GamePlay from '@/pages/GamePlay';
import GameCards from '@/pages/GameCards';
import GameDisplay from '@/pages/GameDisplay';
import Telao from '@/pages/Telao';
import PrintCards from '@/pages/PrintCards';
import Sellers from '@/pages/Sellers';
import SellApp from '@/pages/SellApp';
import ValidateCards from '@/pages/ValidateCards';
import PastGames from '@/pages/PastGames';
import GameAnalytics from '@/pages/GameAnalytics';
import WinnerSummary from '@/pages/WinnerSummary';
import InfoPlanos from '@/pages/InfoPlanos';
import AdminPlanos from '@/pages/AdminPlanos';
import AdminSolicitacoes from '@/pages/AdminSolicitacoes';
import AdminFinancialPanel from '@/pages/AdminFinancialPanel';
import ValidadorSped from '@/pages/ValidadorSped';
import SpedValidations from '@/pages/SpedValidations';
import Rifas from '@/pages/Rifas';
import RifaDetail from '@/pages/RifaDetail';
import PrintRifa from '@/pages/PrintRifa';
import BuyerApp from '@/pages/BuyerApp';
import SellerReport from '@/pages/SellerReport';
import FinalReport from '@/pages/FinalReport';
import FinancialReport from '@/pages/FinancialReport';
import SalesDashboard from '@/pages/SalesDashboard';
import GameMonitor from '@/pages/GameMonitor';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ProtectedRoute from '@/components/ProtectedRoute';
import PortalLogin from '@/pages/PortalLogin';
import PortalAdmin from '@/pages/PortalAdmin';
import PortalGuard from '@/components/PortalGuard';
import TicketLogin from '@/pages/TicketLogin';
import TicketKanban from '@/pages/TicketKanban';
import TicketAdmin from '@/pages/TicketAdmin';
import PDVLogin from '@/pages/PDVLogin';
import PDV from '@/pages/PDV';
import SpaceShooter from '@/pages/SpaceShooter';
import MineSweeper from '@/pages/MineSweeper';
import InstallInstructions from '@/pages/InstallInstructions';
import DiagnosticLogin from '@/pages/DiagnosticLogin';
import DiagnosticAuto from '@/pages/DiagnosticAuto';
import Workshop from '@/pages/Workshop';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Telão é uma tela pública de exibição — não exige login */}
      <Route path="/telao/:gameId" element={<Telao />} />
      {/* App do Comprador é público — acesso apenas com o celular da cartela */}
      <Route path="/buyer" element={<BuyerApp />} />
      {/* App do Vendedor é público — acesso apenas com o celular cadastrado */}
      <Route path="/sell" element={<SellApp />} />
      {/* Galaxy Blaster — jogo de ação público */}
      <Route path="/galaxy-blaster" element={<SpaceShooter />} />
      {/* Campo Minado — jogo de estratégia público */}
      <Route path="/campo-minado" element={<MineSweeper />} />
      <Route path="/portal-login" element={<PortalLogin />} />
      {/* Portal principal (admin) — exige login do portal */}
      <Route path="/portal" element={<Portal />} />
      {/* Menu inicial de categorias — separa Jogos de Empresas */}
      <Route path="/" element={<CategorySelect />} />
      {/* Landing filtrada por categoria */}
      <Route path="/jogos" element={<Landing category="jogos" />} />
      <Route path="/empresas" element={<Landing category="empresas" />} />
      <Route path="/servicos" element={<Landing category="servicos" />} />
      {/* Entrada de cada app — login específico por aplicativo */}
      <Route path="/bingo" element={<BingoLogin />} />
      <Route path="/financ" element={<Navigate to="/pdv" replace />} />
      <Route path="/validador" element={<ValidadorLogin />} />
      {/* Painel admin — exige login + admin */}
      <Route element={<PortalGuard requireAdmin />}>
        <Route path="/portal-admin" element={<PortalAdmin />} />
      </Route>
      {/* Finance integrado ao PDV — redireciona */}
      <Route path="/finance" element={<Navigate to="/pdv-caixa" replace />} />
      {/* Validador SPED — exige login + permissão SPED + auth Base44 */}
      <Route element={<PortalGuard permission="can_access_sped" />}>
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/validador-sped" element={<ValidadorSped />} />
          <Route path="/sped-validations" element={<SpedValidations />} />
        </Route>
      </Route>
      {/* BingoPremier — exige login + permissão bingo + auth Base44 */}
      <Route element={<PortalGuard permission="can_access_bingo" />}>
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/app" element={<Home />} />
          <Route path="/new-game" element={<NewGame />} />
          <Route path="/game/:gameId" element={<GamePlay />} />
          <Route path="/cards/:gameId" element={<GameCards />} />
          <Route path="/display/:gameId" element={<GameDisplay />} />
          <Route path="/print/:gameId" element={<PrintCards />} />
          <Route path="/sellers" element={<Sellers />} />
          <Route path="/validate" element={<ValidateCards />} />
          <Route path="/past-games" element={<PastGames />} />
          <Route path="/game-analytics" element={<GameAnalytics />} />
          <Route path="/winners" element={<WinnerSummary />} />
          <Route path="/info-planos" element={<InfoPlanos />} />
          <Route path="/admin-planos" element={<AdminPlanos />} />
          <Route path="/admin-solicitacoes" element={<AdminSolicitacoes />} />
          <Route path="/rifas" element={<Rifas />} />
          <Route path="/rifas/:rifaId" element={<RifaDetail />} />
          <Route path="/rifas/print/:rifaId" element={<PrintRifa />} />
          <Route path="/seller-report" element={<SellerReport />} />
          <Route path="/final-report" element={<FinalReport />} />
          <Route path="/financial-report" element={<FinancialReport />} />
          <Route path="/sales-dashboard" element={<SalesDashboard />} />
          <Route path="/monitor" element={<GameMonitor />} />
          <Route path="/admin-financial" element={<AdminFinancialPanel />} />
        </Route>
      </Route>
      {/* Diagnóstico Automotivo */}
      <Route path="/diagnostico" element={<DiagnosticLogin />} />
      <Route element={<PortalGuard permission="can_access_diagnostic" />}>
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/diagnostico-auto" element={<DiagnosticAuto />} />
          <Route path="/diagnostico-oficina" element={<Workshop />} />
        </Route>
      </Route>
      {/* PDV — Frente de Caixa */}
      <Route path="/pdv" element={<PDVLogin />} />
      <Route element={<PortalGuard permission="can_access_pdv" />}>
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/pdv-caixa" element={<PDV />} />
        </Route>
      </Route>
      {/* Sistema de Chamados — login próprio por CNPJ + senha */}
      <Route path="/instalar" element={<InstallInstructions />} />
      <Route path="/chamados" element={<TicketLogin />} />
      <Route path="/chamados/kanban" element={<TicketKanban />} />
      <Route path="/chamados/admin" element={<TicketAdmin />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <HideBase44Widget />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App