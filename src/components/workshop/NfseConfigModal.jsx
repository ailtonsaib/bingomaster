import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X, Save, Globe } from "lucide-react";

export default function NfseConfigModal({ userEmail, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    inscricao_municipal: "",
    ibge_code: "",
    nfse_environment: "2",
    nfse_token: "",
    nfse_serie: "1",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await base44.functions.invoke("gerarNfse", { operation: "getConfig", email: userEmail });
        const c = res?.data?.config || {};
        setForm({
          inscricao_municipal: c.inscricao_municipal || "",
          ibge_code: c.ibge_code || "",
          nfse_environment: c.nfse_environment || "2",
          nfse_token: c.nfse_token || "",
          nfse_serie: c.nfse_serie || "1",
        });
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [userEmail]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("gerarNfse", { operation: "updateConfig", email: userEmail, config: form });
      if (res?.data?.success) { onSaved(); onClose(); }
      else { alert(res?.data?.error || "Erro ao salvar."); }
    } catch (e) { alert(e?.message || "Erro"); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold flex items-center gap-2"><Globe className="w-5 h-5 text-indigo-600" /> Configurar NFS-e — Portal Nacional</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500">
              Emissão pelo <b>Portal Nacional da NFS-e</b> (Sefin Nacional). O token de acesso é obtido no portal <b>nfs-e.gov.br</b> (Emissor Público gov.br). O endpoint é definido automaticamente pelo ambiente.
            </p>
            <div>
              <Label>Inscrição Municipal</Label>
              <Input value={form.inscricao_municipal} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })} placeholder="Número da Inscrição Municipal" />
            </div>
            <div>
              <Label>Código IBGE do Município</Label>
              <Input value={form.ibge_code} onChange={(e) => setForm({ ...form, ibge_code: e.target.value })} placeholder="Ex: 3550308 (São Paulo)" />
            </div>
            <div>
              <Label>Token de acesso (Bearer) — Portal Nacional</Label>
              <Input value={form.nfse_token} onChange={(e) => setForm({ ...form, nfse_token: e.target.value })} placeholder="Token obtido no nfs-e.gov.br" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ambiente</Label>
                <select className="w-full h-9 rounded-md border px-2 text-sm" value={form.nfse_environment} onChange={(e) => setForm({ ...form, nfse_environment: e.target.value })}>
                  <option value="2">Homologação (Produção Restrita)</option>
                  <option value="1">Produção</option>
                </select>
              </div>
              <div>
                <Label>Série do DPS</Label>
                <Input value={form.nfse_serie} onChange={(e) => setForm({ ...form, nfse_serie: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}