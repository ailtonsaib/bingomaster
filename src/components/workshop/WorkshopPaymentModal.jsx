import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, CreditCard, QrCode, Receipt, Banknote, Landmark, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import BoletoGenerator from "./BoletoGenerator";

const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro", icon: Banknote, color: "text-green-600 bg-green-100" },
  { value: "pix", label: "PIX", icon: QrCode, color: "text-blue-600 bg-blue-100" },
  { value: "boleto", label: "Boleto", icon: Receipt, color: "text-amber-600 bg-amber-100" },
  { value: "cartao_credito", label: "Cartão de Crédito", icon: CreditCard, color: "text-purple-600 bg-purple-100" },
  { value: "cartao_debito", label: "Cartão de Débito", icon: CreditCard, color: "text-indigo-600 bg-indigo-100" },
];

const CARD_BRANDS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
  { value: "outros", label: "Outros" },
];

function isCaixa(bank) {
  const code = String(bank.bank_code || "").replace(/\D/g, "");
  const name = (bank.bank_name || "").toLowerCase();
  return code === "104" || name.includes("caixa");
}

export default function WorkshopPaymentModal({ order, userEmail, onClose, onConfirmed }) {
  const { toast } = useToast();
  const [banks, setBanks] = useState([]);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [boletoDueDate, setBoletoDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [generatedBoleto, setGeneratedBoleto] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [bankData, companyList] = await Promise.all([
          base44.entities.WorkshopBankAccount.filter({ user_email: userEmail, is_active: true }),
          base44.entities.DiagnosticCompanyConfig.filter({ user_email: userEmail }),
        ]);
        let banksList = bankData;

        // Se não existe conta Caixa, cria automaticamente
        let caixa = banksList.find(isCaixa);
        if (!caixa) {
          caixa = await base44.entities.WorkshopBankAccount.create({
            user_email: userEmail,
            bank_name: "Caixa Econômica Federal",
            bank_code: "104",
            agency: "0001",
            account: "000001",
            account_type: "conta_corrente",
            is_default: true,
            is_active: true,
          });
          banksList = [caixa, ...banksList];
        }

        setBanks(banksList);
        setCompanyConfig(companyList[0] || {});

        const def = banksList.find(b => b.is_default) || caixa;
        if (def) {
          setBankAccountId(def.id);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    loadData();
  }, [userEmail]);

  const isCard = paymentMethod === "cartao_credito" || paymentMethod === "cartao_debito";
  const isBoleto = paymentMethod === "boleto";
  const isDinheiro = paymentMethod === "dinheiro";

  // Quando muda a forma de pagamento, ajusta o banco
  const handleMethodChange = (method) => {
    setPaymentMethod(method);
    if (!isCard) setCardBrand("");

    if (method === "dinheiro") {
      // Cai direto na Caixa
      const caixa = banks.find(isCaixa);
      if (caixa) setBankAccountId(caixa.id);
    }
  };

  const selectedBank = banks.find(b => b.id === bankAccountId);

  const handleConfirm = async () => {
    if (!paymentMethod) {
      toast({ title: "Atenção", description: "Selecione a forma de pagamento.", variant: "destructive" });
      return;
    }
    if (isCard && !cardBrand) {
      toast({ title: "Atenção", description: "Selecione a bandeira do cartão.", variant: "destructive" });
      return;
    }
    if (isBoleto && !bankAccountId) {
      toast({ title: "Atenção", description: "Selecione o banco emissor do boleto.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // 1. Atualiza apenas o pagamento da OS (status já é "concluida")
      await base44.entities.ServiceOrder.update(order.id, {
        payment_method: paymentMethod,
        payment_status: isBoleto ? "pendente" : "pago",
      });

      // 2. Busca o título financeiro já criado quando a OS foi concluída
      const allTx = await base44.entities.PortalFinanceTransaction.filter({
        user_email: userEmail,
        source_module: "workshop",
      });
      const tx = allTx.find(t => t.description && t.description.includes(order.order_number));

      if (tx) {
        // 3. Atualiza o título com a forma de pagamento e baixa
        const updateData = {
          payment_method: paymentMethod,
        };
        if (selectedBank) {
          updateData.bank_account_id = selectedBank.id;
          updateData.bank_name = `${selectedBank.bank_code} — ${selectedBank.bank_name}`;
        }
        if (isCard) updateData.card_brand = cardBrand;
        if (isBoleto) {
          updateData.due_date = new Date(boletoDueDate + "T00:00:00").toISOString();
          updateData.status = "pending";
        } else {
          // Dinheiro, PIX e Cartão = baixados imediatamente
          updateData.status = "settled";
          updateData.settled_date = new Date().toISOString();
          updateData.settled_amount = tx.amount;
        }
        await base44.entities.PortalFinanceTransaction.update(tx.id, updateData);
      }

      // 4. Se for boleto, gera e exibe o boleto
      if (isBoleto && selectedBank) {
        setGeneratedBoleto({
          bank: selectedBank,
          dueDate: new Date(boletoDueDate + "T00:00:00").toISOString(),
        });
        toast({ title: "Boleto gerado", description: `Pagamento de ${fmtMoney(order.total)} registrado via boleto.` });
      } else {
        toast({ title: "Pagamento registrado", description: `OS baixada no caixa — ${fmtMoney(order.total)} via ${paymentMethod}.` });
        onConfirmed?.();
      }
    } catch {
      toast({ title: "Erro", description: "Não foi possível registrar o pagamento.", variant: "destructive" });
    }
    setSaving(false);
  };

  // Exibe o boleto gerado
  if (generatedBoleto) {
    return (
      <BoletoGenerator
        bank={generatedBoleto.bank}
        order={order}
        companyConfig={companyConfig || {}}
        dueDate={generatedBoleto.dueDate}
        onClose={() => { onConfirmed?.(); }}
      />
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Loader2 className="w-6 h-6 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Caixa — Informar Pagamento</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/30 space-y-1">
            <p className="text-sm font-medium">{order.order_number}</p>
            <p className="text-xs text-muted-foreground">{order.client_name} • {order.vehicle_brand} {order.vehicle_model}</p>
            <p className="text-lg font-bold text-blue-600">{fmtMoney(order.total)}</p>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Forma de Pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(method => {
                const Icon = method.icon;
                const selected = paymentMethod === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => handleMethodChange(method.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${method.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>

          {isCard && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Bandeira do Cartão</Label>
              <div className="grid grid-cols-3 gap-2">
                {CARD_BRANDS.map(brand => (
                  <button
                    key={brand.value}
                    type="button"
                    onClick={() => setCardBrand(brand.value)}
                    className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      cardBrand === brand.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    {brand.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isBoleto && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Data de Vencimento do Boleto</Label>
              <Input
                type="date"
                value={boletoDueDate}
                onChange={(e) => setBoletoDueDate(e.target.value)}
              />
            </div>
          )}

          {/* Banco: oculto para dinheiro (sempre Caixa); visível para demais métodos */}
          {!isDinheiro && (
            <div>
              <Label className="text-sm font-medium mb-2 block flex items-center gap-1">
                <Landmark className="w-4 h-4" />
                {isBoleto ? "Banco Emissor do Boleto" : "Conta Bancária"}
              </Label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bank_code} — {b.bank_name} {b.agency ? `(Ag: ${b.agency})` : ""} {b.is_default ? "★" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Indicador da Caixa para dinheiro */}
          {isDinheiro && selectedBank && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
              <Landmark className="w-4 h-4" />
              <span>Entrada automática na conta: <strong>{selectedBank.bank_code} — {selectedBank.bank_name}</strong></span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleConfirm} disabled={saving} className="flex-1">
              {saving ? "Registrando..." : isBoleto ? "Registrar Pagamento e Gerar Boleto" : "Registrar Pagamento"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}