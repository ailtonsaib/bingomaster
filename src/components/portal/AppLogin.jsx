import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { APPS, CONTACT } from "@/lib/appRegistry";
import { setPortalUser } from "@/lib/portalSession";
import ChangePasswordModal from "@/components/portal/ChangePasswordModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, AlertCircle, ArrowLeft, Phone, MessageCircle, ShieldCheck } from "lucide-react";

const iconMap = {
  Grid3x3: (props) => <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>,
  Wallet: (props) => <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>,
  FileText: (props) => <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/></svg>,
  ShoppingCart: (props) => <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>,
};

export default function AppLogin({ appId }) {
  const navigate = useNavigate();
  const app = APPS.find((a) => a.id === appId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState("");

  if (!app) return null;
  const Icon = iconMap[app.icon];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Preencha email e senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "login",
        email,
        password,
      });
      if (res.data.user) {
        const user = res.data.user;
        if (!user[app.permission]) {
          setError(`Sua licença não inclui acesso ao ${app.name}. Contate o suporte para adquirir.`);
          setLoading(false);
          return;
        }
        setPortalUser(user);
        if (user.must_change_password) {
          setLoggedInEmail(user.email);
          setMustChangePassword(true);
          setLoading(false);
          return;
        }
        // Track app usage
        try {
          await base44.functions.invoke("portalAuth", {
            operation: "trackApp",
            email: user.email,
            app: app.id,
          });
        } catch (_) {}
        window.location.href = app.url;
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Email ou senha inválidos";
      if (msg.includes("inválido")) {
        setError("Usuário não cadastrado. Entre em contato com o suporte para adquirir sua licença.");
      } else {
        setError(msg);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,#FFFFFF_0%,#F5F5F5_70%)] pointer-events-none" />

      {/* Back to landing */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-[#71717A] hover:text-[#1B1C21] transition-colors z-10"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="max-w-sm w-full relative z-10">
        {/* App icon + title */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${app.iconBg}`}>
            {Icon && <Icon width={32} height={32} className={app.iconColor} />}
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-[#1B1C21]">{app.name}</h1>
          <p className="mt-1 text-sm text-[#71717A]">{app.tagline}</p>
        </div>

        {/* Login Card */}
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100">
          <div className="mb-5">
            <Label className="text-sm font-medium text-[#333333] mb-1.5 block">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E57C2]" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 border-[#7E57C2] focus:border-[#6200EA] focus:ring-[#6200EA]/20 rounded-lg"
                placeholder="seu@email.com"
                autoFocus
              />
            </div>
          </div>

          <div className="mb-6">
            <Label className="text-sm font-medium text-[#333333] mb-1.5 block">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7E57C2]" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 border-[#7E57C2] focus:border-[#6200EA] focus:ring-[#6200EA]/20 rounded-lg"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full h-11 rounded-lg text-white font-medium" style={{ backgroundColor: app.accent }} disabled={loading}>
            {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...</>) : "Entrar"}
          </Button>
        </form>

        {/* Contact support */}
        <div className="mt-4 p-4 rounded-xl bg-white/80 border border-gray-200 backdrop-blur-sm">
          <p className="text-xs text-[#71717A] mb-3 text-center">Ainda não tem uma licença? Entre em contato:</p>
          <div className="flex flex-col gap-2">
            <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] text-sm font-medium transition-colors">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#7E57C2]/10 hover:bg-[#7E57C2]/20 text-[#6200EA] text-sm font-medium transition-colors">
              <Mail className="w-4 h-4" /> {CONTACT.email}
            </a>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-[#6B7280] text-sm">
              <Phone className="w-4 h-4" /> {CONTACT.phone}
            </div>
          </div>
        </div>
      </div>

      {mustChangePassword && (
        <ChangePasswordModal
          userEmail={loggedInEmail}
          onClose={() => setMustChangePassword(false)}
          onPasswordChanged={() => {
            setMustChangePassword(false);
            window.location.href = app.url;
          }}
        />
      )}
    </div>
  );
}