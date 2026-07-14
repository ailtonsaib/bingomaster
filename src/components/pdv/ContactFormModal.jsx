import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Search, User, Building2, Briefcase } from "lucide-react";
import { lookupCnpj } from "@/lib/cnpjLookup";
import { maskCpfCnpj, maskPhone, maskCep } from "@/lib/brMasks";
import CitySelect from "@/components/pdv/CitySelect";

const EMPTY = {
  name: "", cpf_cnpj: "", ie: "", email: "", phone: "",
  cep: "", address: "", number: "", complement: "", district: "",
  city: "", uf: "", ibge_code: "",
  is_cliente: true, is_fornecedor: false, is_funcionario: false,
  buyer_type: "consumidor_final", is_active: true,
};

const UF_OPTIONS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function ContactFormModal({ user, contact, title, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...contact });
  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const isEditing = !!contact?.id;

  const handleCnpjLookup = async (cnpjValue) => {
    const clean = (cnpjValue || "").replace(/\D/g, "");
    if (clean.length !== 14) return;
    setCnpjLoading(true);
    const data = await lookupCnpj(clean);
    if (data?.error) {
      alert(data.error);
    } else if (data) {
      setForm(prev => ({
        ...prev,
        name: data.razao_social || prev.name,
        cep: data.cep || prev.cep,
        address: data.address || prev.address,
        number: data.number || prev.number,
        complement: data.complement || prev.complement,
        district: data.district || prev.district,
        city: data.city || prev.city,
        uf: data.uf || prev.uf,
        ibge_code: data.ibge_code || prev.ibge_code,
        phone: data.phone || prev.phone,
        email: data.email || prev.email,
      }));
    }
    setCnpjLoading(false);
  };

  const toggleType = (field) => {
    setForm(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const save = async () => {
    if (!form.name) { alert("Informe o nome / razão social!"); return; }
    if (!form.is_cliente && !form.is_fornecedor && !form.is_funcionario) {
      alert("Marque pelo menos um tipo: Cliente, Fornecedor ou Funcionário!");
 return;
    }
    setSaving(true);
    try {
      const data = { ...form, user_email: user.email };
      let result;
      if (isEditing) {
        result = await base44.entities.PDVContact.update(contact.id, data);
      } else {
        result = await base44.entities.PDVContact.create(data);
      }
      onSaved?.(result);
      onClose();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-bold">{title || (isEditing ? "Editar Contato" : "Novo Contato")}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {/* Tipo de Contato */}
          <div>
            <Label>Tipo de Contato *</Label>
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => toggleType("is_cliente")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  form.is_cliente
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                <User className="w-4 h-4" /> Cliente
              </button>
              <button
                type="button"
                onClick={() => toggleType("is_fornecedor")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  form.is_fornecedor
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"
                }`}
              >
                <Building2 className="w-4 h-4" /> Fornecedor
              </button>
              <button
                type="button"
                onClick={() => toggleType("is_funcionario")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  form.is_funcionario
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-purple-400"
                }`}
              >
                <Briefcase className="w-4 h-4" /> Funcionário
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Um contato pode ser de mais de um tipo simultaneamente.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Nome / Razão Social *</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-9" />
            </div>
            <div>
              <Label>CPF / CNPJ</Label>
              <div className="flex gap-1">
                <Input value={maskCpfCnpj(form.cpf_cnpj)} onChange={e => setForm({...form, cpf_cnpj: e.target.value.replace(/\D/g, '').slice(0,14)})} onBlur={e => handleCnpjLookup(e.target.value)} className="h-9 font-mono" placeholder="000.000.000-00 ou 00.000.000/0000-00" />
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" disabled={form.cpf_cnpj?.length !== 14 || cnpjLoading} onClick={() => handleCnpjLookup(form.cpf_cnpj)} title="Buscar dados na Receita">
                  {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input value={form.ie} onChange={e => setForm({...form, ie: e.target.value})} className="h-9" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-9" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={maskPhone(form.phone)} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g, '').slice(0,11)})} className="h-9" placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={maskCep(form.cep)} onChange={e => setForm({...form, cep: e.target.value.replace(/\D/g, '').slice(0,8)})} className="h-9" placeholder="00000-000" />
            </div>
            <div>
              <Label>UF</Label>
              <select value={form.uf} onChange={e => setForm({...form, uf: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Selecione</option>
                {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Endereço</Label>
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
              <CitySelect form={form} setForm={setForm} />
            </div>
            <div>
              <Label>Código IBGE (7 dígitos)</Label>
              <Input value={form.ibge_code} onChange={e => setForm({...form, ibge_code: e.target.value.replace(/\D/g, '').slice(0,7)})} className="h-9 font-mono" placeholder="4205407" />
            </div>
          </div>

          {/* Tipo de Comprador — só para clientes */}
          {form.is_cliente && (
            <div>
              <Label>Tipo de Comprador *</Label>
              <select value={form.buyer_type} onChange={e => setForm({...form, buyer_type: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="consumidor_final">Consumidor Final</option>
                <option value="revendedor">Revendedor / Varejista</option>
                <option value="distribuidor">Distribuidor / Atacadista</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Determina a regra de PIS/COFINS em produtos monofásicos bifásicos (Lei 13.097/2015).
                Venda a distribuidor aplica alíquota reduzida; demais = 0%.
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}