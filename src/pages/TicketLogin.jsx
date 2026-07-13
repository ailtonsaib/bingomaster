import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Lock, ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { setTicketUser } from "@/lib/ticketSession";

export default function TicketLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRegister, setShowRegister] = useState(false);
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
      const res = await base44.functions.invoke('ticketSystem', { operation: 'login', cnpj, email, password });
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
      const userRes = await base44.functions.invoke('ticketSystem', { operation: 'createUser', name, email: regEmail, password: regPassword, company_id: company.id, role: 'admin' });
      setTicketUser(userRes.data.user);
      navigate('/chamados/kanban');
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao cadastrar");
    }
    setLoading(false);
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
            {step === 1 ? <Building2 className="w-7 h-7 text-primary" /> : <Lock className="w-7 h-7 text-primary" />}
          </div>
          <CardTitle>{step === 1 ? "Acesso ao Sistema" : `Bem-vindo à ${companyName.name || companyName}`}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === 1 ? "Informe o CNPJ da sua empresa" : "Faça login para continuar"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <>
              <div>
                <Label>CNPJ</Label>
                <Input value={cnpj} onChange={(e) => setCnpj(maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" onKeyDown={(e) => e.key === 'Enter' && handleCnpj()} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleCnpj} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />} Continuar
              </Button>
              <Button variant="link" className="w-full" onClick={() => setShowRegister(true)}>
                Cadastrar nova empresa
              </Button>
            </>
          ) : (
            <>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleLogin} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Entrar
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => { setStep(1); setError(""); }}>
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}