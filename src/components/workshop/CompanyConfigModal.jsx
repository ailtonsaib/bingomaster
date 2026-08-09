import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Building2, ShieldCheck, UserCog, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const maskCNPJ = (s) => {
  const d = onlyDigits(s).slice(0, 14);
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};
const maskCPF = (s) => {
  const d = onlyDigits(s).slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};
const maskCEP = (s) => {
  const d = onlyDigits(s).slice(0, 8);
  return d.replace(/(\d{5})(\d{3})/, "$1-$2");
};
const maskPhone = (s) => {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
};

const empty = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  ie: "",
  logo_url: "",
  cep: "",
  address: "",
  number: "",
  district: "",
  city: "",
  uf: "",
  phone: "",
  email: "",
  admin_name: "",
  admin_email: "",
  access_granted: false,
  responsible_name: "",
  responsible_cpf: "",
};

export default function CompanyConfigModal({ userEmail, companyId, canCreateNew = true, open, onClose, onSaved }) {
  const { toast } = useToast();
  const [config, setConfig] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [configId, setConfigId] = useState(null);
  const [granting, setGranting] = useState(false);
  const [lookingUpCNPJ, setLookingUpCNPJ] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Se companyId foi fornecido, carrega por ID (admin de empresa editando sua própria empresa)
    if (!open || (!userEmail && !companyId)) return;
    setLoading(true);
    const load = async () => {
      try {
        let d = null;
        const res = await base44.functions.invoke("manageDiagnostic", {
          operation: "getCompanies",
          email: userEmail,
          company_id: companyId || undefined,
          filter_user_email: !companyId ? userEmail : undefined,
        });
        const list = res?.data?.companies || [];
        if (list.length > 0) d = list[0];
        if (d) {
          setConfig({
            ...empty,
            ...d,
            cnpj: d.cnpj ? maskCNPJ(d.cnpj) : "",
            cep: d.cep ? maskCEP(d.cep) : "",
            phone: d.phone ? maskPhone(d.phone) : "",
            responsible_cpf: d.responsible_cpf ? maskCPF(d.responsible_cpf) : "",
          });
          setConfigId(d.id);
        } else {
          setConfig(empty);
          setConfigId(null);
        }
      } catch {
        /* ignore */
      }
      setLoading(false);
    };
    load();
  }, [open, userEmail, companyId]);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      handleChange("logo_url", file_url);
      toast({ title: "Logo enviada", description: "A logo foi carregada com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível enviar a logo.", variant: "destructive" });
    }
    setUploadingLogo(false);
  };

  const handleCEPLookup = async (cep) => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setConfig(prev => ({
          ...prev,
          address: data.logradouro || prev.address,
          district: data.bairro || prev.district,
          city: data.localidade || prev.city,
          uf: data.uf || prev.uf,
        }));
      }
    } catch {
      /* ignore */
    }
  };

  const handleCNPJLookup = async (cnpjValue) => {
    const digits = onlyDigits(cnpjValue);
    if (digits.length !== 14) return;
    setLookingUpCNPJ(true);
    try {
      const res = await base44.functions.invoke("consultaCnpj", { cnpj: digits });
      const result = res?.data ?? res;
      if (result?.success && result?.dados) {
        const d = result.dados;
        const logradouro = d.descricao_tipo_de_logradouro
          ? `${d.descricao_tipo_de_logradouro} ${d.logradouro}`.trim()
          : d.logradouro;
        const telefoneLimpo = onlyDigits((d.telefone || "").split("/")[0].trim());
        setConfig(prev => ({
          ...prev,
          razao_social: d.razao_social || prev.razao_social,
          nome_fantasia: d.nome_fantasia || prev.nome_fantasia,
          cep: d.cep ? maskCEP(d.cep) : prev.cep,
          address: logradouro || prev.address,
          number: d.numero || prev.number,
          district: d.bairro || prev.district,
          city: d.municipio || prev.city,
          uf: d.uf || prev.uf,
          phone: telefoneLimpo ? maskPhone(telefoneLimpo) : prev.phone,
          email: d.email || prev.email,
        }));
        toast({ title: "Dados preenchidos", description: "Os dados foram obtidos da Receita Federal automaticamente." });
      } else {
        toast({ title: "CNPJ não encontrado", description: result?.error || "Não foi possível obter os dados.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro na consulta", description: "Não foi possível consultar o CNPJ.", variant: "destructive" });
    }
    setLookingUpCNPJ(false);
  };

  const handleSave = async () => {
    if (!config.razao_social.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe a razão social.", variant: "destructive" });
      return;
    }
    if (!canCreateNew && !configId) {
      toast({ title: "Sem permissão", description: "Você não pode cadastrar novas empresas. Apenas o administrador do sistema pode.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...config,
        cnpj: onlyDigits(config.cnpj),
        cep: onlyDigits(config.cep),
        responsible_cpf: onlyDigits(config.responsible_cpf),
        user_email: userEmail,
      };
      const res = await base44.functions.invoke("manageDiagnostic", {
        operation: "saveCompany",
        email: userEmail,
        company_id: configId || undefined,
        company_data: payload,
      });
      const result = res?.data ?? res;
      if (!configId && result?.company?.id) {
        setConfigId(result.company.id);
      }
      toast({ title: "Empresa salva", description: "Os dados da empresa foram salvos com sucesso." });
      if (onSaved) onSaved();
      onClose();
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar os dados.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleGrantAccess = async () => {
    if (!config.admin_email?.trim()) {
      toast({ title: "Email obrigatório", description: "Informe o email do administrador da empresa.", variant: "destructive" });
      return;
    }
    if (!config.admin_name?.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do administrador.", variant: "destructive" });
      return;
    }
    // Garante que os dados da empresa estão salvos antes de liberar
    if (!configId) {
      toast({ title: "Salve primeiro", description: "Salve os dados da empresa antes de liberar o acesso.", variant: "destructive" });
      return;
    }
    setGranting(true);
    try {
      const res = await base44.functions.invoke("portalAuth", {
        operation: "createCompanyAdmin",
        owner_email: userEmail,
        admin_email: config.admin_email,
        admin_name: config.admin_name,
      });
      const result = res?.data ?? res;
      // Marca o acesso como liberado na empresa
      await base44.entities.DiagnosticCompanyConfig.update(configId, { access_granted: true });
      setConfig(prev => ({ ...prev, access_granted: true }));
      toast({
        title: "Acesso liberado",
        description: `Senha inicial: ${result?.default_password || "Premier@123"} — o administrador deverá trocá-la no primeiro acesso.`,
      });
    } catch (e) {
      toast({ title: "Erro", description: e?.response?.data?.error || e?.message || "Não foi possível liberar o acesso.", variant: "destructive" });
    }
    setGranting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <Building2 className="w-5 h-5" /> {configId ? "Dados da Empresa" : "Cadastro da Empresa"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
                {config.logo_url ? (
                  <img src={config.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div>
                <Label className="text-sm font-medium">Logo da Empresa</Label>
                <p className="text-xs text-gray-400 mb-1">Será exibida nos recibos e documentos</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={uploadingLogo}
                  onClick={() => document.getElementById("logo-upload-input").click()}
                >
                  {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingLogo ? "Enviando..." : "Enviar Logo"}
                </Button>
                <input
                  id="logo-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>

            {/* Dados principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium">Razão Social *</Label>
                <Input
                  value={config.razao_social}
                  onChange={e => handleChange("razao_social", e.target.value)}
                  placeholder="Razão social da empresa"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium">Nome Fantasia</Label>
                <Input
                  value={config.nome_fantasia}
                  onChange={e => handleChange("nome_fantasia", e.target.value)}
                  placeholder="Nome fantasia"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">CNPJ</Label>
                <div className="flex gap-1 mt-1">
                  <Input
                    value={config.cnpj}
                    onChange={e => handleChange("cnpj", maskCNPJ(e.target.value))}
                    onBlur={e => {
                      const digits = onlyDigits(e.target.value);
                      if (digits.length === 14) handleCNPJLookup(e.target.value);
                    }}
                    placeholder="00.000.000/0000-00"
                    readOnly={!canCreateNew && !!configId}
                    disabled={!canCreateNew && !!configId}
                    title={!canCreateNew && !!configId ? "O CNPJ não pode ser alterado — somente o administrador do sistema pode modificar" : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={lookingUpCNPJ || onlyDigits(config.cnpj).length !== 14 || (!canCreateNew && !!configId)}
                    onClick={() => handleCNPJLookup(config.cnpj)}
                    title="Buscar dados na Receita"
                  >
                    {lookingUpCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                {!canCreateNew && !!configId && (
                  <p className="text-xs text-amber-600 mt-1">O CNPJ é fixo e não pode ser alterado.</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium">Inscrição Estadual</Label>
                <Input
                  value={config.ie}
                  onChange={e => handleChange("ie", e.target.value)}
                  placeholder="IE"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Telefone</Label>
                <Input
                  value={config.phone}
                  onChange={e => handleChange("phone", maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <Input
                  type="email"
                  value={config.email}
                  onChange={e => handleChange("email", e.target.value)}
                  placeholder="contato@empresa.com"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-sm font-medium">CEP</Label>
                <Input
                  value={config.cep}
                  onChange={e => {
                    const v = maskCEP(e.target.value);
                    handleChange("cep", v);
                    if (onlyDigits(v).length === 8) handleCEPLookup(v);
                  }}
                  placeholder="00000-000"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium">Endereço</Label>
                <Input
                  value={config.address}
                  onChange={e => handleChange("address", e.target.value)}
                  placeholder="Logradouro"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Número</Label>
                <Input
                  value={config.number}
                  onChange={e => handleChange("number", e.target.value)}
                  placeholder="Nº"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Bairro</Label>
                <Input
                  value={config.district}
                  onChange={e => handleChange("district", e.target.value)}
                  placeholder="Bairro"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Cidade</Label>
                <Input
                  value={config.city}
                  onChange={e => handleChange("city", e.target.value)}
                  placeholder="Município"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">UF</Label>
                <Input
                  value={config.uf}
                  onChange={e => handleChange("uf", e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="UF"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Responsável */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Nome do Responsável</Label>
                <Input
                  value={config.responsible_name}
                  onChange={e => handleChange("responsible_name", e.target.value)}
                  placeholder="Nome completo"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">CPF do Responsável</Label>
                <Input
                  value={config.responsible_cpf}
                  onChange={e => handleChange("responsible_cpf", maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Administrador da Empresa — Liberação de Acesso */}
            <div className="rounded-xl border-2 border-blue-100 bg-blue-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-800 text-sm">Administrador da Empresa</span>
                {config.access_granted && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 ml-auto">
                    <ShieldCheck className="w-3 h-3" /> Acesso liberado
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-600">
                Informe o nome e email da pessoa que administrará a empresa. Ao liberar o acesso, ela terá entrada no sistema como administrador.
              </p>
              {config.access_granted && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <strong>Senha inicial:</strong> Premier@123 — o administrador será obrigado a trocá-la no primeiro acesso.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Nome do Administrador</Label>
                  <Input
                    value={config.admin_name || ""}
                    onChange={e => handleChange("admin_name", e.target.value)}
                    placeholder="Nome do administrador"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Email do Administrador *</Label>
                  <Input
                    type="email"
                    value={config.admin_email || ""}
                    onChange={e => handleChange("admin_email", e.target.value)}
                    placeholder="admin@empresa.com"
                    className="mt-1"
                  />
                </div>
              </div>
              <Button
                onClick={handleGrantAccess}
                disabled={granting}
                className="w-full gap-1.5"
                variant={config.access_granted ? "outline" : "default"}
              >
                {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {config.access_granted ? "Acesso já liberado — Atualizar" : "Liberar Acesso ao Sistema"}
              </Button>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 gap-1.5 text-white"
                style={{ backgroundColor: "#2563EB" }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                Salvar Dados
              </Button>
              <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}