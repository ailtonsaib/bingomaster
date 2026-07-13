import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Lock, ArrowLeft, UserPlus, Loader2, Mail, UserCircle } from "lucide-react";
import { setTicketUser } from "@/lib/ticketSession";

export default function TicketLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("empresa"); // "empresa" | "cliente"
  const [step, setStep] = useState(1);
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [directLogin, setDirectLogin] = useState(false);
  const [regData, setRegData] = useState({ razao_social: "", cnpj: "", endereco: "", name: "", email: "", password: "" });

  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState("");

  const maskCNPJ = (v) => v.replace(/\D/g, "").slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");

  const fetchCnpjData = async (cnpjValue) => {
    const cnpjClean = cnpjValue.replace(/\D/g, "");
    if (cnpjClean.length !== 14) { setRegData((prev) => ({ ...prev, razao_social: "", endereco: "" })); return; }
    setCnpjLoading(true);
    setCnpjError("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) { setCnpjError("CNPJ não encontrado na Receita."); setCnpjLoading(false); return; }
      const dados = await res.json();
      const endereco = [
        dados.logradouro, dados.numero, dados.complemento, dados.bairro,
        dados.municipio, dados.uf
      ].filter(Boolean).join(", ");
      setRegData((prev) => ({ ...prev, razao_social: dados.razao_social || prev.razao_social, endereco: endereco || prev.endereco }));
    } catch { setCnpjError("Erro ao consultar CNPJ."); }
    setCnpjLoading(false);
  };

  // ─── Empresa: CNPJ → login ───
  const handleCnpj = async () => {
    setError("");
    const cnpjClean = cnpj.replace(/\D/g, "");
    if (cnpjClean.length !== 14) { setError("CNPJ inválido"); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('ticketSystem', { operation: 'getCompanies' });
      const company = res.data.companies?.find((c) => c.cnpj === cnpjClean && c.is_active);
      if (!company) { setError("Empresa não encontrada"); setLoading(false); return; }
      setCompanyName({ name: company.razao_social, _companyId: company.id });
      setStep(2);
    } catch { setError("Erro ao buscar empresa"); }
    setLoading(false);
  };

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Preencha email e senha"); return; }
    setLoading(true);
    try {
      const op = directLogin ? 'loginByEmail' : 'login';
      const payload = directLogin ? { operation: op, email, password } : { operation: op, cnpj, email, password };
      const res = await base44.functions.invoke('ticketSystem', payload);
      setTicketUser(res.data.user);
      navigate('/chamados/kanban');
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao fazer login");
    }
    setLoading(false);
  };

  // ─── Cliente: email → encontrar empresa → senha ───
  const handleClientEmail = async () => {
    setError("");
    if (!email) { setError("Informe seu email"); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('ticketSystem', { operation: 'findUserByEmail', email });
      setCompanyName({ name: res.data.company.razao_social });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || "Email não encontrado");
    }
    setLoading(false);
  };

  const handleClientLogin = async () => {
    setError("");
    if (!password) { setError("Informe sua senha"); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('ticketSystem', { operation: 'loginByEmail', email, password });
      setTicketUser(res.data.user);
      navigate('/chamados/kanban');
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao fazer login");
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    setError("");
    const { razao_social, cnpj: regCnpj, endereco, name, email: regEmail, password: regPassword } = regData;
    if (!razao_social || !regCnpj || !name || !regEmail || !regPassword) { setError("Preencha todos os campos"); return; }
    setLoading(true);
    try {
      const companyRes = await base44.functions.invoke('ticketSystem', { operation: 'createCompany', razao_social, cnpj: regCnpj, endereco });
      const company = companyRes.data.company;
      const userRes = await base44.functions.invoke('ticketSystem', { operation: 'createUser', name, email: regEmail, password: regPassword, company_id: company.id, role: 'company_admin' });
      setTicketUser(userRes.data.user);
      navigate('/chamados/kanban');
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao cadastrar");
    }
    setLoading(false);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setStep(1);
    setDirectLogin(false);
    setError("");
    setEmail("");
    setPassword("");
    setCnpj("");
    setCompanyName("");
  };

  if (showRegister) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Button variant="ghost" size="sm" onClick={() => setShowRegister(false)} className="gap-2 mb-2 w-fit">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> Cadastro de Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Razão Social *</Label>
              <Input value={regData.razao_social} onChange={(e) => setRegData({ ...regData, razao_social: e.target.value })} />
            </div>
            <div>
              <Label>CNPJ *</Label>
              <div className="flex gap-2">
                <Input value={regData.cnpj} onChange={(e) => { const v = maskCNPJ(e.target.value); setRegData({ ...regData, cnpj: v }); setCnpjError(""); if (v.replace(/\D/g, "").length === 14) fetchCnpjData(v); }} placeholder="00.000.000/0000-00" />
                {cnpjLoading && <Loader2 className="w-4 h-4 animate-spin mt-2 text-muted-foreground" />}
              </div>
              {cnpjError && <p className="text-xs text-destructive mt-1">{cnpjError}</p>}
              {regData.razao_social && !cnpjError && <p className="text-xs text-emerald-600 mt-1">✓ Empresa encontrada: {regData.razao_social}</p>}
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={regData.endereco} onChange={(e) => setRegData({ ...regData, endereco: e.target.value })} placeholder="Preenchido automaticamente pela Receita" />
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Dados do Administrador</p>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={regData.name} onChange={(e) => setRegData({ ...regData, name: e.target.value })} /></div>
                <div><Label>Email *</Label><Input type="email" value={regData.email} onChange={(e) => setRegData({ ...regData, email: e.target.value })} /></div>
                <div><Label>Senha *</Label><Input type="password" value={regData.password} onChange={(e) => setRegData({ ...regData, password: e.target.value })} /></div>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleRegister} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Cadastrar e Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
            {mode === "empresa"
              ? (step === 1 ? <Building2 className="w-7 h-7 text-primary" /> : <Lock className="w-7 h-7 text-primary" />)
              : (step === 1 ? <Mail className="w-7 h-7 text-primary" /> : <Lock className="w-7 h-7 text-primary" />)}
          </div>
          <CardTitle>
            {mode === "empresa"
              ? (step === 1 ? "Acesso da Empresa" : directLogin ? "Login direto" : `Bem-vindo à ${companyName.name || companyName}`)
              : (step === 1 ? "Acesso do Cliente" : `Bem-vindo, ${companyName.name || ""}`)}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "empresa"
              ? (step === 1 ? "Informe o CNPJ ou entre com seu email" : "Faça login para continuar")
              : (step === 1 ? "Informe seu email de acesso" : "Digite sua senha para entrar")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          {step === 1 && (
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => switchMode("empresa")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${mode === "empresa" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
              >
                <Building2 className="w-4 h-4" /> Empresa
              </button>
              <button
                onClick={() => switchMode("cliente")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${mode === "cliente" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
              >
                <UserCircle className="w-4 h-4" /> Cliente
              </button>
            </div>
          )}

          {mode === "empresa" && step === 1 && (
            <>
              <div>
                <Label>CNPJ</Label>
                <Input value={cnpj} onChange={(e) => setCnpj(maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" onKeyDown={(e) => e.key === 'Enter' && handleCnpj()} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleCnpj} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />} Continuar
              </Button>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setDirectLogin(true); setStep(2); setError(""); }}>
                <Mail className="w-4 h-4" /> Entrar com email e senha
              </Button>
              <Button variant="link" className="w-full" onClick={() => setShowRegister(true)}>
                Cadastrar nova empresa
              </Button>
            </>
          )}

          {mode === "empresa" && step === 2 && (
            <>
              {!directLogin && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                  <p className="text-sm font-medium">{companyName.name}</p>
                </div>
              )}
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoFocus={directLogin} />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleLogin} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Entrar
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setStep(1); setDirectLogin(false); setError(""); }}>
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
            </>
          )}

          {mode === "cliente" && step === 1 && (
            <>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" onKeyDown={(e) => e.key === 'Enter' && handleClientEmail()} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleClientEmail} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Continuar
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                O sistema identificará automaticamente a empresa vinculada ao seu email.
              </p>
            </>
          )}

          {mode === "cliente" && step === 2 && (
            <>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                <p className="text-sm font-medium">{companyName.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleClientLogin()} autoFocus />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleClientLogin} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Entrar
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setStep(1); setError(""); setPassword(""); }}>
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}