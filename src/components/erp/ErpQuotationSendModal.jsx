import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Mail, Link2, Copy, Check, Loader2, Send, AlertTriangle } from "lucide-react";

function randomHex(len = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function ErpQuotationSendModal({ quotation, suppliers, onClose, onSaved }) {
  const [quotes, setQuotes] = useState(() => (quotation.supplier_quotes || []).map(sq => {
    const sup = suppliers.find(s => s.id === sq.supplier_id);
    return { ...sq, supplier_email: sq.supplier_email || sup?.email || "" };
  }));
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(null); // supplier_id being emailed
  const [copied, setCopied] = useState(null);

  const linkFor = (token) => `${window.location.origin}/cotacao/${token}`;

  const persist = async (newQuotes) => {
    setSaving(true);
    try {
      await base44.entities.ErpQuotation.update(quotation.id, {
        supplier_quotes: newQuotes.map(({ supplier_id, supplier_name, supplier_email, quoted_value, notes, quote_token, quote_status, responded_at, items }) => ({
          supplier_id, supplier_name, supplier_email, quoted_value: Number(quoted_value) || 0,
          notes: notes || "", quote_token: quote_token || "", quote_status: quote_status || "pendente",
          responded_at: responded_at || undefined, items: items || [],
        })),
      });
      setQuotes(newQuotes);
      onSaved();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const generateToken = (i) => {
    const newQuotes = [...quotes];
    newQuotes[i] = { ...newQuotes[i], quote_token: `${quotation.id}__${randomHex()}`, quote_status: "pendente" };
    persist(newQuotes);
  };

  const copyLink = async (token, supplierId) => {
    try { await navigator.clipboard.writeText(linkFor(token)); setCopied(supplierId); setTimeout(() => setCopied(null), 1500); }
    catch { alert("Não foi possível copiar."); }
  };

  const sendEmail = async (i) => {
    const sq = quotes[i];
    if (!sq.supplier_email) { alert("Este fornecedor não possui email cadastrado. Use o link manualmente."); return; }
    if (!sq.quote_token) { alert("Gere o link antes de enviar."); return; }
    setSending(sq.supplier_id || i);
    try {
      const link = linkFor(sq.quote_token);
      const body = `Prezado(a) ${sq.supplier_name},\n\nVocê foi convidado a participar da Tomada de Preço ${quotation.number}.\nObjeto: ${quotation.description || "—"}\n\nAcesse o link abaixo para preencher os valores dos itens e enviar sua cotação:\n${link}\n\nO link é pessoal e intransferível.\n\nAtenciosamente,\nDepartamento de Compras`;
      const res = await base44.integrations.Core.SendEmail({
        to: sq.supplier_email,
        subject: `Tomada de Preço ${quotation.number} — Cotação solicitada`,
        body,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      alert("Email enviado para " + sq.supplier_email);
    } catch (e) {
      alert("Falha ao enviar email: " + (e.message || "verifique se o domínio do destinatário está habilitado. Você pode copiar o link e enviar manualmente."));
    }
    setSending(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-bold flex items-center gap-1.5"><Send className="w-5 h-5 text-indigo-600" /> Enviar Tomada ao Fornecedor</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <span className="text-gray-500">Tomada:</span> <b>{quotation.number}</b>
            {quotation.description && <p className="text-xs text-gray-500 mt-0.5">{quotation.description}</p>}
          </div>

          {quotes.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Nenhum fornecedor nesta tomada. Adicione fornecedores antes de enviar.</p>
          ) : quotes.map((sq, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{sq.supplier_name || "—"}</p>
                  <p className="text-xs text-gray-500">{sq.supplier_email || "Sem email cadastrado"}</p>
                </div>
                {sq.quote_status === "respondida" ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Respondida</span>
                ) : sq.quote_token ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Aguardando</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Não enviado</span>
                )}
              </div>

              {sq.quote_token ? (
                <div className="flex gap-1.5 items-center">
                  <input readOnly value={linkFor(sq.quote_token)} className="flex-1 h-8 rounded border border-input bg-gray-50 px-2 text-xs font-mono" />
                  <button onClick={() => copyLink(sq.quote_token, sq.supplier_id)} title="Copiar link" className="p-1.5 hover:bg-gray-100 rounded border">
                    {copied === sq.supplier_id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <Button size="sm" variant="outline" onClick={() => sendEmail(i)} disabled={sending === (sq.supplier_id || i)} className="h-8 gap-1">
                    {sending === (sq.supplier_id || i) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    Enviar
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => generateToken(i)} disabled={saving} className="h-8 gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Gerar link
                </Button>
              )}
            </div>
          ))}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>O envio por email funciona para endereços habilitados no plano. Se falhar, copie o link e envie manualmente (WhatsApp/email). O link é individual por fornecedor.</p>
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}