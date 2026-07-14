import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Building, Save, AlertTriangle, User, Calculator } from "lucide-react";

const UF_OPTIONS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const EMPTY = {
  razao_social: "", nome_fantasia: "", cnpj: "", ie: "", im: "",
  crt: 1, regime_caixa: false, lucro_type: "nao_se_aplica",
  cep: "", address: "", number: "", complement: "",
  district: "", city: "", uf: "", ibge_code: "", phone: "",
  responsible_name: "", responsible_cpf: "", responsible_phone: "", responsible_email: "",
  accountant_name: "", accountant_company_name: "", accountant_crc_number: "", accountant_crc_uf: "",
  accountant_cpf: "", accountant_cnpj: "", accountant_address: "", accountant_phone: "", accountant_email: "",
  nfe_series: 1, nfe_number_next: 1, nfe_environment: "2",
};

export default function CompanyConfigModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.PDVCompanyConfig.filter({ user_email: user.email });
        if (list.length > 0) {
          setForm({ ...EMPTY, ...list[0] });
          setConfigId(list[0].id);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user.email]);

  const save = async () => {
    if (!form.razao_social || !form.cnpj) { alert("Preencha razão social e CNPJ!"); return; }
    setSaving(true);
    try {
      const data = { ...form, user_email: user.email };
      if (configId) {
        await base44.entities.PDVCompanyConfig.update(configId, data);
      } else {
        const created = await base44.entities.PDVCompanyConfig.create(data);
        setConfigId(created.id);
      }
      onSaved?.();
      onClose();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold flex items-center gap-2">
            <Building className="w-5 h-5 text-orange-600" /> Dados da Empresa Emitente
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Estes dados são usados na geração do XML da NF-e. O <b>código IBGE do município</b> (7 dígitos) é obrigatório.
              Para emissão em produção é necessário um <b>certificado digital A1/A3</b> junto à SEFAZ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Razão Social *</Label>
              <Input value={form.razao_social} onChange={e => setForm({...form, razao_social: e.target.value})} className="h-9" />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia} onChange={e => setForm({...form, nome_fantasia: e.target.value})} className="h-9" />
            </div>
            <div>
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value.replace(/\D/g, '').slice(0,14)})} className="h-9 font-mono" />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input value={form.ie} onChange={e => setForm({...form, ie: e.target.value})} className="h-9" />
            </div>
            <div>
              <Label>Inscrição Municipal</Label>
              <Input value={form.im} onChange={e => setForm({...form, im: e.target.value})} className="h-9" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="h-9" />
            </div>
            <div>
              <Label>CRT (Regime Tributário) *</Label>
              <select value={form.crt} onChange={e => {
                const crt = Number(e.target.value);
                setForm({...form, crt, lucro_type: crt === 3 ? form.lucro_type !== "nao_se_aplica" ? form.lucro_type : "presumido" : "nao_se_aplica", regime_caixa: crt === 3 ? form.regime_caixa : false});
              }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value={1}>1 - Simples Nacional</option>
                <option value={2}>2 - Simples Nacional (excesso sublimite)</option>
                <option value={3}>3 - Regime Normal</option>
              </select>
            </div>
            {form.crt === 3 && (
              <>
                <div>
                  <Label>Tipo de Lucro *</Label>
                  <select value={form.lucro_type} onChange={e => setForm({...form, lucro_type: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="presumido">Lucro Presumido</option>
                    <option value="real">Lucro Real</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Presumido: PIS 0,65% / COFINS 3,00%. Real: PIS 1,65% / COFINS 7,60%.
                  </p>
                </div>
                <div>
                  <Label>Regime PIS/COFINS *</Label>
                  <select value={form.regime_caixa ? "caixa" : "competencia"} onChange={e => setForm({...form, regime_caixa: e.target.value === "caixa"})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    <option value="competencia">Competência</option>
                    <option value="caixa">Caixa</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Caixa: tributa na entrada do pagamento (CST 98). Competência: tributa na emissão da nota (CST 01/02).
                  </p>
                </div>
              </>
            )}
          </div>

          {form.crt === 3 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                <b>Regime Normal ({form.lucro_type === "real" ? "Lucro Real" : "Lucro Presumido"}):</b> PIS/COFINS calculados por operação.
                {form.regime_caixa && " Regime de Caixa ativo — CST 98 aplicado aos produtos tributados."}
              </p>
            </div>
          )}
          {form.crt !== 3 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <b>Simples Nacional:</b> PIS/COFINS recolhidos via DAS (alíquota única sobre receita).
                Na NF-e usa-se CST 49 (Outras Operações) com valor zero.
                Produtos monofásicos (Lei 13.097) mantêm CST 04/06/07 (alíquota zero na revenda).
              </p>
            </div>
          )}

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2 text-gray-700">Endereço</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label>CEP</Label>
                <Input value={form.cep} onChange={e => setForm({...form, cep: e.target.value})} className="h-9" />
              </div>
              <div className="md:col-span-2">
                <Label>Logradouro</Label>
                <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="h-9" />
              </div>
              <div>
                <Label>Número</Label>
                <Input value={form.number} onChange={e => setForm({...form, number: e.target.value})} className="h-9" />
              </div>
              <div>
                <Label>Complemento</Label>
                <Input value={form.complement} onChange={e => setForm({...form, complement: e.target.value})} className="h-9" />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={form.district} onChange={e => setForm({...form, district: e.target.value})} className="h-9" />
              </div>
              <div>
                <Label>Município</Label>
                <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="h-9" />
              </div>
              <div>
                <Label>UF</Label>
                <select value={form.uf} onChange={e => setForm({...form, uf: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="">Selecione</option>
                  {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div>
                <Label>Código IBGE (7 dígitos)</Label>
                <Input value={form.ibge_code} onChange={e => setForm({...form, ibge_code: e.target.value.replace(/\D/g, '').slice(0,7)})} className="h-9 font-mono" placeholder="4205407" />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2 text-gray-700 flex items-center gap-1"><User className="w-4 h-4 text-orange-600" /> Responsável pela Empresa</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome do Responsável</Label>
                <Input value={form.responsible_name} onChange={e => setForm({...form, responsible_name: e.target.value})} className="h-9" placeholder="Nome completo" />
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={form.responsible_cpf} onChange={e => setForm({...form, responsible_cpf: e.target.value.replace(/\D/g, '').slice(0,11)})} className="h-9 font-mono" placeholder="00000000000" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.responsible_phone} onChange={e => setForm({...form, responsible_phone: e.target.value})} className="h-9" placeholder="(00) 0000-0000" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.responsible_email} onChange={e => setForm({...form, responsible_email: e.target.value})} className="h-9" placeholder="responsavel@email.com" />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2 text-gray-700 flex items-center gap-1"><Calculator className="w-4 h-4 text-orange-600" /> Contador</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome do Contador</Label>
                <Input value={form.accountant_name} onChange={e => setForm({...form, accountant_name: e.target.value})} className="h-9" placeholder="Nome completo" />
              </div>
              <div>
                <Label>Empresa de Contabilidade</Label>
                <Input value={form.accountant_company_name} onChange={e => setForm({...form, accountant_company_name: e.target.value})} className="h-9" placeholder="Nome do escritório" />
              </div>
              <div>
                <Label>Número do CRC</Label>
                <Input value={form.accountant_crc_number} onChange={e => setForm({...form, accountant_crc_number: e.target.value})} className="h-9 font-mono" placeholder="000000/O" />
              </div>
              <div>
                <Label>UF do CRC</Label>
                <select value={form.accountant_crc_uf} onChange={e => setForm({...form, accountant_crc_uf: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="">Selecione</option>
                  {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div>
                <Label>CPF do Contador</Label>
                <Input value={form.accountant_cpf} onChange={e => setForm({...form, accountant_cpf: e.target.value.replace(/\D/g, '').slice(0,11)})} className="h-9 font-mono" placeholder="00000000000" />
              </div>
              <div>
                <Label>CNPJ do Escritório</Label>
                <Input value={form.accountant_cnpj} onChange={e => setForm({...form, accountant_cnpj: e.target.value.replace(/\D/g, '').slice(0,14)})} className="h-9 font-mono" placeholder="00000000000000" />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço do Escritório</Label>
                <Input value={form.accountant_address} onChange={e => setForm({...form, accountant_address: e.target.value})} className="h-9" placeholder="Logradouro, número, bairro, cidade/UF" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.accountant_phone} onChange={e => setForm({...form, accountant_phone: e.target.value})} className="h-9" placeholder="(00) 0000-0000" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.accountant_email} onChange={e => setForm({...form, accountant_email: e.target.value})} className="h-9" placeholder="contador@email.com" />
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-semibold mb-2 text-gray-700">Configuração NF-e</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Série</Label>
                <Input type="number" value={form.nfe_series} onChange={e => setForm({...form, nfe_series: Number(e.target.value)})} className="h-9" />
              </div>
              <div>
                <Label>Próximo Número</Label>
                <Input type="number" value={form.nfe_number_next} onChange={e => setForm({...form, nfe_number_next: Number(e.target.value)})} className="h-9" />
              </div>
              <div>
                <Label>Ambiente</Label>
                <select value={form.nfe_environment} onChange={e => setForm({...form, nfe_environment: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="2">2 - Homologação</option>
                  <option value="1">1 - Produção</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}