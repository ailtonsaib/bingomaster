import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, CheckCircle2, X } from "lucide-react";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function WorkshopSettleModal({ tx, fmtMoney, fmtDate, onClose, onConfirm }) {
  const [settleMode, setSettleMode] = useState("total");
  const [interestAmount, setInterestAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [partialAmount, setPartialAmount] = useState(0);
  const [bankName, setBankName] = useState("");
  const [saving, setSaving] = useState(false);

  const originalAmount = parseFloat(tx.remaining_amount) > 0 ? parseFloat(tx.remaining_amount) : parseFloat(tx.amount) || 0;
  const interest = parseFloat(interestAmount) || 0;
  const discount = parseFloat(discountAmount) || 0;
  const adjustedTotal = originalAmount + interest - discount;
  const partial = parseFloat(partialAmount) || 0;
  const remaining = adjustedTotal - partial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (settleMode === "partial" && partial <= 0) {
      alert("Informe o valor a ser baixado");
      return;
    }
    if (settleMode === "partial" && partial > adjustedTotal) {
      alert("O valor parcial não pode ser maior que o total ajustado");
      return;
    }
    setSaving(true);
    await onConfirm(tx.id, {
      is_partial: settleMode === "partial",
      settled_amount: settleMode === "partial" ? partial : adjustedTotal,
      remaining_amount: settleMode === "partial" ? remaining : 0,
      interest_amount: interest,
      discount_amount: discount,
      bank_name: bankName || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Baixar Título</CardTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 rounded-lg bg-muted/30 space-y-1">
            <p className="text-sm font-medium">{tx.description}</p>
            <p className="text-xs text-muted-foreground">
              {tx.contact_name && `${tx.contact_name} · `}
              {tx.type === "income" ? "A Receber" : "A Pagar"}
            </p>
            <p className="text-xs text-muted-foreground">Vencimento: {fmtDate(tx.due_date)}</p>
            <p className={`text-lg font-bold ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
              {fmtMoney(originalAmount)}
            </p>
          </div>

          <div className="mb-3 flex gap-2">
            <Button type="button" size="sm" variant={settleMode === "total" ? "default" : "outline"} onClick={() => { setSettleMode("total"); setPartialAmount(0); }} className="flex-1">
              Baixa Total
            </Button>
            <Button type="button" size="sm" variant={settleMode === "partial" ? "default" : "outline"} onClick={() => setSettleMode("partial")} className="flex-1">
              Baixa Parcial
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Juros / Multa (R$)</label>
                <Input type="number" step="0.01" min="0" value={interestAmount || ""} onChange={(e) => setInterestAmount(parseFloat(e.target.value) || 0)} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descontos (R$)</label>
                <Input type="number" step="0.01" min="0" value={discountAmount || ""} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} placeholder="0,00" />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/20 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor original</span>
                <span>{fmtMoney(originalAmount)}</span>
              </div>
              {interest > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>+ Juros</span>
                  <span>{fmtMoney(interest)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>- Descontos</span>
                  <span>{fmtMoney(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1">
                <span>Total ajustado</span>
                <span className={tx.type === "income" ? "text-emerald-600" : "text-red-600"}>{fmtMoney(adjustedTotal)}</span>
              </div>
            </div>

            {settleMode === "partial" && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Valor a baixar agora (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" max={adjustedTotal} value={partialAmount || ""} onChange={(e) => setPartialAmount(parseFloat(e.target.value) || 0)} required />
                </div>
                <div className="flex justify-between text-sm p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-amber-700 font-medium">Restará após baixa</span>
                  <span className="font-bold text-amber-700">{fmtMoney(remaining)}</span>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Banco (opcional)</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ex: Banco do Brasil" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Baixando..." : settleMode === "partial" ? "Confirmar Baixa Parcial" : "Confirmar Baixa Total"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}