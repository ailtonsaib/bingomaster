import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Loader2, Lock, Building2, ArrowLeft, AlertCircle } from "lucide-react";
import { setMechanicSession } from "@/lib/mechanicSession";

export default function MechanicLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // email → companies → password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Informe seu email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("mechanicAuth", { operation: "getCompanies", email: email.trim() });
      const list = res?.data?.companies || [];
      if (list.length === 0) {
        setError("Email não encontrado. Verifique com o administrador da oficina.");
        setLoading(false);
        return;
      }
      setCompanies(list);
      if (list.length === 1) {
        setSelectedCompany(list[0]);
        setStep("password");
      } else {
        setStep("companies");
      }
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Informe sua senha.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("mechanicAuth", {
        operation: "login",
        email: email.trim(),
        password: password.trim(),
        user_email: selectedCompany.user_email,
      });
      const mech = res?.data;
      if (!mech || res?.data?.error) {
        setError(res?.data?.error || "Email ou senha incorretos.");
        setLoading(false);
        return;
      }
      setMechanicSession(mech);
      window.location.href = "/mecanico-painel";
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    }
    setLoading(false);
  };

  const handleBack = () => {
    if (step === "companies") {
      setStep("email");
      setSelectedCompany(null);
    } else if (step === "password") {
      if (companies.length > 1) {
        setStep("companies");
      } else {
        setStep("email");
      }
      setSelectedCompany(null);
      setPassword("");
    }
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Painel do Mecânico</h1>
          <p className="text-sm text-gray-500 mt-1">Acesse suas Ordens de Serviço</p>
        </div>

        <form onSubmit={step === "email" ? handleEmailSubmit : handleLogin} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          {/* Step 1: Email */}
          {step === "email" && (
            <>
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="mt-1"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full text-white" style={{ backgroundColor: "#2563EB" }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuar"}
              </Button>
            </>
          )}

          {/* Step 2: Seleção de empresa */}
          {step === "companies" && (
            <>
              <div>
                <Label className="text-sm font-medium">Selecione a empresa</Label>
                <p className="text-xs text-gray-400 mt-0.5">Seu email está vinculado a {companies.length} empresas</p>
              </div>
              <div className="space-y-2">
                {companies.map(c => (
                  <button
                    key={c.user_email}
                    type="button"
                    onClick={() => {
                      setSelectedCompany(c);
                      setStep("password");
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${c.has_password ? "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30" : "border-gray-100 opacity-60 cursor-not-allowed"}`}
                    disabled={!c.has_password}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.nome_fantasia || c.razao_social}</p>
                        {!c.has_password && <p className="text-xs text-amber-600">Senha não cadastrada</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button type="button" onClick={handleBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
            </>
          )}

          {/* Step 3: Senha */}
          {step === "password" && (
            <>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{selectedCompany?.nome_fantasia || selectedCompany?.razao_social}</span>
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="mt-1"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full text-white" style={{ backgroundColor: "#2563EB" }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
              </Button>
              <button type="button" onClick={handleBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mx-auto">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Solicite seu acesso com o administrador da oficina.
        </p>
      </div>
    </div>
  );
}