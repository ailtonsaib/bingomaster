import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2, Info, Wrench, CheckCircle2 } from "lucide-react";

const DIAGNOSTIC_PLANS = [
  { key: "free", label: "FREE", desc: "5 diagnósticos, 5 clientes, 5 veículos" },
  { key: "teste", label: "TESTE", desc: "10 ordens de serviço, sem exclusão" },
  { key: "bronze", label: "BRONZE", desc: "OS ilimitadas + exclusão" },
  { key: "master", label: "MASTER", desc: "Ilimitado + exclusão" },
];

const maskCNPJ = (v) =>
  v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

export default function GestorFormModal({ adminEmail, onClose, onSaved }) {
  const [gestorName, setGestorName] = useState("");
  const [gestorEmail, setGestorEmail] = useState("");
  const [diagnosticPlan, setDiagnosticPlan] = useState("free");
  const [cnpj, setCnpj] = useState("");
  const [company, setCompany] = useState({
    razao_social: "", nome_fantasia: "", cnpj: "",
    cep: "", address: "", number: "", district: "", city: "", uf: "",
    phone: "", email: "",
  });
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchCnpjData = async (cnpjValue) => {
    const cnpjClean = cnpjValue.replace(/\D/g, "");
    if (cnpjClean.length !== 14) return;
    setCnpjLoading(true);
    setCnpjError("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) {
        setCnpjError("CNPJ não encontrado na Receita.");
        setCnpjLoading(false);
        return;
      }
      const dados = await res.json();
      setCompany({
        razao_social: dados.razao_social || "",
        nome_fantasia: dados.nome_fantasia || "",
        cnpj: cnpjClean,
        cep: dados.cep || "",
        address: dados.logradouro || "",
        number: dados.numero || "",
        district: dados.bairro || "",
        city: dados.municipio || "",
        uf: dados.uf || "",
        phone: dados.telefone || "",
        email: dados.email || "",
      });
      setCnpj(cnpjClean);
    } catch {
      setCnpjError("Erro ao consultar CNPJ.");
    }
    setCnpjLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company.razao_social) {
      alert("Informe e consulte o CNPJ da empresa antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke("portalAuth", {
        operation: "createGestor",
        admin_email: adminEmail,
        gestor_name: gestorName,
        gestor_email: gestorEmail,
        diagnostic_plan: diagnosticPlan,
        company,
      });
      setSuccess(true);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao criar gestor");
    }
    setSaving(false);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-background rounded-2xl w-full max-w-md shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold mb-2">Gestor Cadastrado!</h2>
          <p className="text-sm text-muted-foreground mb-4">
            O gestor <strong>{gestorName}</strong> foi criado com acesso à Oficina Premium
            ({DIAGNOSTIC_PLANS.find(p => p.key === diagnosticPlan)?.label}).
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-left">
            <p className="text-xs font-semibold text-amber-800 mb-1">Credenciais de acesso:</p>
            <p className="text-sm text-amber-700">Email: <span className="font-mono">{gestorEmail}</span></p>
            <p className="text-sm text-amber-700">Senha: <span className="font-mono">gestor123</span></p>
            <p className="text-xs text-amber-600 mt-1">Será solicitada a troca de senha no primeiro acesso.</p>
          </div>
          <Button onClick={onClose} className="w-full">Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-cyan-600" /> Cadastrar Gestor — Oficina Premium
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          O gestor terá acesso somente à empresa cadastrada e poderá criar seus próprios usuários.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Dados do gestor */}
          <div className="pt-2">
            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-cyan-600" /> Dados do Gestor
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome do gestor</Label>
                <Input value={gestorName} onChange={(e) => setGestorName(e.target.value)} required placeholder="Nome completo" />
              </div>
              <div>
                <Label>Email do gestor</Label>
                <Input type="email" value={gestorEmail} onChange={(e) => setGestorEmail(e.target.value)} required placeholder="gestor@email.com" />
              </div>
            </div>
          </div>

          {/* CNPJ da empresa */}
          <div className="pt-2 border-t">
            <p className="text-sm font-semibold mb-2">Dados da Empresa</p>
            <div>
              <Label>CNPJ</Label>
              <div className="flex gap-2">
                <Input
                  value={cnpj}
                  onChange={(e) => {
                    const v = maskCNPJ(e.target.value);
                    setCnpj(v);
                    setCnpjError("");
                    if (v.replace(/\D/g, "").length === 14) fetchCnpjData(v);
                    else setCompany(prev => ({ ...prev, razao_social: "", cnpj: "" }));
                  }}
                  placeholder="00.000.000/0000-00"
                  required
                />
                {cnpjLoading && <Loader2 className="w-4 h-4 animate-spin mt-3 text-muted-foreground" />}
              </div>
              {cnpjError && <p className="text-xs text-destructive mt-1">{cnpjError}</p>}
              {company.razao_social && !cnpjError && (
                <p className="text-xs text-emerald-600 mt-1">✓ {company.razao_social}</p>
              )}
            </div>
          </div>

          {/* Campos da empresa (auto-preenchidos, editáveis) */}
          {company.razao_social && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 rounded-lg p-3">
              <div className="sm:col-span-2">
                <Label>Razão Social</Label>
                <Input value={company.razao_social} onChange={(e) => setCompany({ ...company, razao_social: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Nome Fantasia</Label>
                <Input value={company.nome_fantasia} onChange={(e) => setCompany({ ...company, nome_fantasia: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Endereço</Label>
                <Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={company.number} onChange={(e) => setCompany({ ...company, number: e.target.value })} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={company.district} onChange={(e) => setCompany({ ...company, district: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
              </div>
              <div>
                <Label>UF</Label>
                <Input value={company.uf} maxLength={2} onChange={(e) => setCompany({ ...company, uf: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={company.cep} onChange={(e) => setCompany({ ...company, cep: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Email da empresa</Label>
                <Input value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
              </div>
            </div>
          )}

          {/* Plano */}
          <div className="pt-2 border-t">
            <Label>Plano da Oficina Premium</Label>
            <select
              value={diagnosticPlan}
              onChange={(e) => setDiagnosticPlan(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm mt-1"
            >
              {DIAGNOSTIC_PLANS.map((p) => (
                <option key={p.key} value={p.key}>{p.label} — {p.desc}</option>
              ))}
            </select>
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-cyan-50 border border-cyan-200">
            <Info className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-cyan-800">
              A senha padrão será <span className="font-mono font-semibold">gestor123</span>. No primeiro
              acesso, o gestor será solicitado a trocar a senha. Ele terá acesso apenas à empresa
              cadastrada e poderá criar seus próprios usuários dentro da oficina.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving || !company.razao_social} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              {saving ? "Criando..." : "Cadastrar Gestor"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}