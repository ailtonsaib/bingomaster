import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X, Send } from "lucide-react";

export default function EmitNfseModal({ userEmail, orders, onClose, onSaved }) {
  const [orderId, setOrderId] = useState(orders[0]?.id || "");
  const [form, setForm] = useState({
    item_lista_servico: "14.01",
    aliquota: "",
    valor_deducoes: "0",
    iss_retido: false,
    discriminacao: "",
    codigo_tributacao: "",
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const selected = orders.find((o) => o.id === orderId);

  const generate = async () => {
    if (!orderId) return alert("Selecione uma ordem de serviço.");
    if (!form.item_lista_servico) return alert("Informe o código do item da lista de serviço.");
    setGenerating(true);
    try {
      const res = await base44.functions.invoke("gerarNfse", {
        operation: "generate",
        email: userEmail,
        service_order_id: orderId,
        item_lista_servico: form.item_lista_servico,
        aliquota: Number(form.aliquota) || 0,
        valor_deducoes: Number(form.valor_deducoes) || 0,
        iss_retido: form.iss_retido,
        discriminacao: form.discriminacao,
        codigo_tributacao: form.codigo_tributacao,
      });
      if (res?.data?.success) {
        setResult(res.data);
      } else {
        alert(res?.data?.error || "Erro ao gerar NFS-e.");
      }
    } catch (e) { alert(e?.message || "Erro"); }
    setGenerating(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold">Emitir NFS-e</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          {!result ? (
            <>
              <div>
                <Label>Ordem de Serviço</Label>
                <select className="w-full h-9 rounded-md border px-2 text-sm" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>{o.order_number} — {o.client_name} (R$ {(o.total || 0).toFixed(2)})</option>
                  ))}
                </select>
              </div>
              {selected && (
                <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600">
                  Tomador: {selected.client_name} — {selected.client_cpf_cnpj || "sem doc"}<br />
                  Valor: R$ {(selected.total || 0).toFixed(2)} (Mão de obra: R$ {(selected.labor_total || 0).toFixed(2)})
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Item Lista Serviço (código)</Label>
                  <Input value={form.item_lista_servico} onChange={(e) => setForm({ ...form, item_lista_servico: e.target.value })} placeholder="Ex: 14.01" />
                </div>
                <div>
                  <Label>Código Tributação Município</Label>
                  <Input value={form.codigo_tributacao} onChange={(e) => setForm({ ...form, codigo_tributacao: e.target.value })} placeholder="(opcional)" />
                </div>
                <div>
                  <Label>Alíquota ISS (%)</Label>
                  <Input type="number" step="0.01" value={form.aliquota} onChange={(e) => setForm({ ...form, aliquota: e.target.value })} placeholder="Ex: 2" />
                </div>
                <div>
                  <Label>Valor Deduções (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_deducoes} onChange={(e) => setForm({ ...form, valor_deducoes: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Discriminação do serviço</Label>
                <textarea
                  className="w-full rounded-md border p-2 text-sm min-h-[70px]"
                  value={form.discriminacao}
                  onChange={(e) => setForm({ ...form, discriminacao: e.target.value })}
                  placeholder={selected ? `${selected.service_type_name || "Serviço"} — OS ${selected.order_number}` : ""}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.iss_retido} onChange={(e) => setForm({ ...form, iss_retido: e.target.checked })} />
                ISS retido pelo tomador
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={generate} disabled={generating} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Gerar RPS</Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
                RPS gerado com sucesso!<br />
                Número RPS: <b>{result.rps_number}</b><br />
                Status: {result.nfse?.status} — transmita à prefeitura (botão "Transmitir" na lista) para obter o número da NFS-e.
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { onSaved(); onClose(); }}>Concluir</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}