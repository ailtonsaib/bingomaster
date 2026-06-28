import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, ArrowLeft, Zap, Star, Crown, Rocket, Shield, Trophy, Settings, ChevronDown, AlertTriangle, RefreshCw, Lock, Ban, Smartphone, HelpCircle, Phone, Mail, MessageCircle, Send, Loader2, CheckCircle } from "lucide-react";
import { useLicense } from "@/hooks/useLicense";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";

// alias for inner components
const useAccordionState = useState;
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const SYSTEM_LINKS = [
  {
    label: "Acompanhamento do Comprador",
    description: "Página para o comprador acompanhar e acessar suas cartelas",
    path: "/minhas-cartelas",
    color: "bg-purple-50 border-purple-200",
    icon: "🧑‍💼",
  },
  {
    label: "App do Vendedor",
    description: "Interface para os vendedores registrarem vendas",
    path: "/sell",
    color: "bg-green-50 border-green-200",
    icon: "🛒",
  },
  {
    label: "Rifas / Telão",
    description: "Tela de exibição do sorteio ao vivo (projetor)",
    path: "/telao/:gameId",
    color: "bg-amber-50 border-amber-200",
    icon: "📺",
  },
];

const PLANS = [
  {
    key: "free",
    name: "FREE",
    subtitle: "Gratuito",
    desc: "Para conhecer o sistema",
    price: null,
    cards: "50 cartelas",
    color: "border-slate-200",
    badgeClass: "bg-slate-100 text-slate-700",
    icon: Shield,
    features: [
      "Até 50 cartelas no total",
      "1 evento ativo",
      "Geração automática de cartelas",
      "Sorteio eletrônico",
      "Validação de cartelas",
    ],
  },
  {
    key: "basic",
    name: "BASIC",
    subtitle: "R$ 400,00",
    desc: "Para pequenos eventos",
    price: "R$ 400,00",
    cards: "2.000 cartelas",
    color: "border-blue-300",
    badgeClass: "bg-blue-100 text-blue-700",
    icon: Zap,
    features: [
      "Até 2.000 cartelas no total",
      "Eventos ilimitados",
      "Geração automática de cartelas",
      "Sorteio eletrônico completo",
      "Validação de cartelas",
      "App do vendedor (links por código)",
      "Exportação PDF e CSV",
      "Suporte por WhatsApp",
    ],
  },
  {
    key: "pro",
    name: "PRO",
    subtitle: "R$ 700,00",
    desc: "Para eventos frequentes",
    price: "R$ 700,00",
    cards: "4.000 cartelas",
    color: "border-violet-400",
    badgeClass: "bg-violet-100 text-violet-700",
    icon: Star,
    popular: true,
    features: [
      "Até 4.000 cartelas no total",
      "Eventos ilimitados",
      "Todas as funções do BASIC",
      "Telão do sorteio (projetor)",
      "Dashboard completo com estatísticas",
      "Relatório em PDF do evento",
      "Ranking por vendedor",
      "Criação de rifas",
      "Suporte prioritário",
    ],
  },
  {
    key: "max",
    name: "MAX",
    subtitle: "R$ 900,00",
    desc: "Para grandes eventos",
    price: "R$ 900,00",
    cards: "8.000 cartelas",
    color: "border-emerald-400",
    badgeClass: "bg-emerald-100 text-emerald-700",
    icon: Crown,
    features: [
      "Até 8.000 cartelas no total",
      "Eventos ilimitados",
      "Todas as funções do PRO",
      "Acompanhamento de cartelas via aplicativo",
      "Exportação em lote (PDF)",
      "Acesso válido por 6 meses",
      "Suporte VIP com atendimento rápido",
    ],
  },
  {
    key: "ultra",
    name: "ULTRA",
    subtitle: "R$ 1.100,00",
    desc: "Para eventos de grande porte",
    price: "R$ 1.100,00",
    cards: "12.000 cartelas",
    color: "border-pink-400",
    badgeClass: "bg-pink-100 text-pink-700",
    icon: Rocket,
    features: [
      "Até 12.000 cartelas no total",
      "Eventos ilimitados",
      "Todas as funções do MAX",
      "Múltiplos vendedores com lotes",
    ],
  },
  {
    key: "enterprise",
    name: "ENTERPRISE",
    subtitle: "R$ 1.500,00",
    desc: "Para empresas e operações maiores",
    price: "R$ 1.500,00",
    cards: "15.000 cartelas",
    color: "border-orange-400",
    badgeClass: "bg-orange-100 text-orange-700",
    icon: Trophy,
    features: [
      "Até 15.000 cartelas no total",
      "Eventos ilimitados",
      "Todas as funções do ULTRA",
    ],
  },
  {
    key: "mega",
    name: "MEGA",
    subtitle: "R$ 2.500,00",
    desc: "Para operações de larga escala",
    price: "R$ 2.500,00",
    cards: "50.000 cartelas",
    color: "border-violet-500",
    badgeClass: "bg-violet-100 text-violet-800",
    icon: Crown,
    current: true,
    features: [
      "Até 50.000 cartelas no total",
      "Eventos ilimitados",
      "Todas as funções do ENTERPRISE",
    ],
  },
];

export default function InfoPlanos() {
  const [copied, setCopied] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState(null); // plan object
  const [upgradeMsg, setUpgradeMsg] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeDone, setUpgradeDone] = useState(null);
  const { license, loading: licenseLoading } = useLicense();
  const { toast } = useToast();

  const currentPlanKey = license?.plan_key || "free";
  const currentPlan = PLANS.find(p => p.key === currentPlanKey) || PLANS[0];

  const getFullUrl = (path) => `${window.location.origin}${path}`;

  const handleCopy = (path, key) => {
    navigator.clipboard.writeText(getFullUrl(path));
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRequestUpgrade = async (plan) => {
    setUpgrading(true);
    try {
      let device_ip = "desconhecido";
      try { const r = await fetch("https://api.ipify.org?format=json"); const d = await r.json(); device_ip = d.ip; } catch (_) {}

      const result = await base44.functions.invoke("requestPlanUpgrade", {
        requested_plan_key: plan.key,
        requested_plan_name: plan.name,
        requested_plan_price: plan.price ? parseFloat(plan.price.replace(/[^\d,]/g, "").replace(",", ".")) : 0,
        message: upgradeMsg,
        device_ip,
      });

      if (result.data?.success) {
        setUpgradeDone(plan);
        setUpgradeModal(null);
        setUpgradeMsg("");
        toast({ title: "✅ Solicitação enviada!", description: "Você receberá as instruções de pagamento em breve." });
      } else {
        toast({ title: "Erro", description: result.data?.error || "Erro ao enviar solicitação.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Início
        </Link>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-heading">Informações & Planos</h1>
          <p className="text-muted-foreground mt-1">
            Conheça os <span className="text-primary font-medium">planos disponíveis</span>, regras de uso e termos importantes do sistema
          </p>
        </div>

        {/* Current Plan Banner */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
              <Crown className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              {licenseLoading ? (
                <div className="h-4 w-48 bg-violet-200 animate-pulse rounded" />
              ) : (
                <p className="text-sm font-semibold text-violet-900">
                  Seu plano atual: <span className="text-violet-700">{currentPlan.name} — {license?.max_cards?.toLocaleString("pt-BR") || currentPlan.cards} cartelas</span>
                </p>
              )}
              <p className="text-xs text-violet-600">Para fazer upgrade, selecione um plano abaixo e envie a solicitação.</p>
            </div>
          </div>
          <Badge className="bg-violet-600 text-white border-0 text-sm px-4 py-1">{currentPlan.name}</Badge>
        </div>

        {/* Upgrade success message */}
        {upgradeDone && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Solicitação para o plano {upgradeDone.name} enviada!</p>
              <p className="text-xs text-emerald-700">Você receberá as instruções de pagamento por e-mail. Após a confirmação, o plano será ativado. A solicitação expira em 5 dias úteis.</p>
            </div>
          </div>
        )}

        {/* System Links */}
        <Card className="mb-10">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              🔗 Links de Acesso do Sistema
            </p>
            <div className="space-y-3">
              {SYSTEM_LINKS.map((link) => (
                <div
                  key={link.key || link.label}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${link.color}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base">{link.icon}</span>
                      <span className="font-semibold text-sm text-foreground">{link.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{getFullUrl(link.path)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0 text-xs"
                    onClick={() => handleCopy(link.path, link.label)}
                  >
                    {copied === link.label ? (
                      <><Check className="w-3.5 h-3.5 text-green-600" /> Copiado</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copiar</>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Plans */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold font-heading">Planos e Preços</h2>
          <Link to="/admin-planos">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Settings className="w-4 h-4" /> Administrar Planos
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border-2 ${plan.color} bg-card p-5 flex flex-col ${
                  plan.current ? "ring-2 ring-violet-400 ring-offset-2" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-violet-600 text-white border-0 text-xs px-3">Mais popular</Badge>
                  </div>
                )}
                {plan.current && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-violet-600 text-white border-0 text-xs px-3">Seu plano</Badge>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${plan.badgeClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <Badge variant="outline" className={`${plan.badgeClass} border-0 text-xs font-bold`}>
                    {plan.name}
                  </Badge>
                </div>

                {plan.price ? (
                  <p className="text-2xl font-bold font-heading text-foreground leading-tight">{plan.price}</p>
                ) : (
                  <p className="text-2xl font-bold font-heading text-foreground leading-tight">Gratuito</p>
                )}
                <p className="text-xs text-muted-foreground mb-1">{plan.desc}</p>
                <p className="text-sm font-bold text-primary mb-4">{plan.cards}</p>

                <ul className="space-y-1.5 flex-1 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.key === currentPlanKey ? (
                  <div className="mt-auto text-center text-xs font-semibold text-violet-600 bg-violet-50 rounded-lg py-2">✅ Plano atual</div>
                ) : plan.key !== "free" ? (
                  <button
                    onClick={() => { setUpgradeModal(plan); setUpgradeMsg(""); }}
                    className="mt-auto w-full text-xs font-semibold bg-primary text-primary-foreground rounded-lg py-2 hover:bg-primary/90 transition-colors"
                  >
                    Solicitar este plano
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* ── UPGRADE MODAL ── */}
        {upgradeModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setUpgradeModal(null)}>
            <div className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-1">Solicitar plano {upgradeModal.name}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Valor: <strong>{upgradeModal.price || "Gratuito"}</strong> — pagamento único.<br />
                Após enviar, você receberá as instruções de pagamento por e-mail. A solicitação expira em <strong>5 dias úteis</strong>.
              </p>
              <div className="mb-4">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Mensagem (opcional)</label>
                <Textarea
                  placeholder="Ex: Quero fazer upgrade para o plano PRO..."
                  value={upgradeMsg}
                  onChange={e => setUpgradeMsg(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setUpgradeModal(null)}>Cancelar</Button>
                <Button size="sm" onClick={() => handleRequestUpgrade(upgradeModal)} disabled={upgrading} className="gap-1.5">
                  {upgrading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Enviar Solicitação
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Pricing note */}
        <p className="text-center text-xs text-muted-foreground mt-6 mb-12">
          💳 Os valores são cobrados uma única vez. Entre em contato com o administrador para contratar ou fazer upgrade.
        </p>

        {/* ── REGRAS DE USO ── */}
        <TermsSection />

        {/* ── FAQ ── */}
        <FaqSection />

        {/* ── CONTATO ── */}
        <ContactSection />

        {/* ── COPYRIGHT ── */}
        <div className="mt-10 pt-6 border-t text-center text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">© 2026 AILTON AIRES — Todos os direitos reservados.</p>
          <p>Este sistema é de propriedade exclusiva de Ailton Aires. É proibida a reprodução,<br className="hidden sm:inline" /> distribuição ou uso não autorizado deste software.</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/*  SEÇÃO DE REGRAS                            */
/* ─────────────────────────────────────────── */
const RULES = [
  {
    icon: Smartphone,
    color: "text-blue-600 bg-blue-50",
    title: "Licença por Dispositivo Único",
    text: "Sua licença fica vinculada ao dispositivo utilizado no primeiro acesso (computador, tablet ou celular). O sistema registra o dispositivo automaticamente.",
  },
  {
    icon: RefreshCw,
    color: "text-amber-600 bg-amber-50",
    title: "Solicitação de Troca de Dispositivo",
    text: "Ao tentar acessar de um aparelho diferente, uma solicitação de troca é enviada ao administrador. O acesso só é liberado após aprovação manual.",
  },
  {
    icon: AlertTriangle,
    color: "text-orange-600 bg-orange-50",
    title: "Taxa de Reinstalação",
    text: "Em caso de formatação ou perda do dispositivo original, será cobrada uma taxa única de R$ 50,00 para reativar o acesso em um novo aparelho.",
  },
  {
    icon: Lock,
    color: "text-violet-600 bg-violet-50",
    title: "Conta Pessoal e Intransferível",
    text: "A licença é pessoal e não pode ser compartilhada com outras pessoas ou organizações. Cada usuário deve possuir sua própria conta.",
  },
  {
    icon: Ban,
    color: "text-red-600 bg-red-50",
    title: "Suspensão por Uso Indevido",
    text: "Tentativas de burlar limites de cartelas ou bloqueios de dispositivo podem resultar em suspensão imediata da conta, sem direito a reembolso.",
  },
];

function TermsSection() {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-5">
        <Lock className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold font-heading">Regras de Uso e Termos Importantes</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {RULES.map((rule, i) => {
          const Icon = rule.icon;
          return (
            <div key={i} className="flex gap-3 p-4 rounded-xl border bg-card">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${rule.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold mb-0.5">{rule.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{rule.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Taxa de reinstalação destaque */}
      <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-5 h-5 text-orange-600" />
          <p className="font-bold text-orange-800">Taxa de Reinstalação: R$ 50,00</p>
        </div>
        <p className="text-sm text-orange-700 mb-3">
          Ao formatar ou perder acesso ao dispositivo original, é necessário pagar uma taxa única de R$ 50,00 para liberar o acesso em um novo aparelho. Essa taxa cobre o processo de verificação e reativação da licença.
        </p>
        <div className="flex flex-wrap gap-2">
          {["Formatação do dispositivo", "Perda do dispositivo", "Reinstalação do sistema"].map(item => (
            <span key={item} className="text-xs bg-orange-100 border border-orange-300 text-orange-800 rounded-full px-3 py-1 font-medium">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/*  FAQ                                        */
/* ─────────────────────────────────────────── */
const FAQS = [
  {
    q: "Como solicito upgrade de plano?",
    a: "Entre em contato diretamente com o administrador via WhatsApp ou e-mail. Informe o plano desejado e o administrador liberará o acesso após a confirmação do pagamento.",
  },
  {
    q: "O que acontece com minhas cartelas ao trocar de plano?",
    a: "Todas as cartelas e dados gerados são mantidos. O upgrade apenas aumenta o limite disponível para criação de novas cartelas.",
  },
  {
    q: "Posso usar em celular e computador ao mesmo tempo?",
    a: "Não. A licença padrão permite apenas um dispositivo ativo por vez. Para trocar de dispositivo, é necessário solicitar aprovação ao administrador.",
  },
  {
    q: "O app do vendedor conta como dispositivo separado?",
    a: "O app do vendedor possui acesso restrito e não conta como dispositivo principal. Somente o acesso administrativo fica vinculado ao dispositivo.",
  },
  {
    q: "O limite de cartelas é por evento ou no total?",
    a: "O limite é acumulado no total da conta, independente de quantos eventos foram criados. Cartelas excluídas não são contabilizadas.",
  },
];

function FaqSection() {
  const [open, setOpen] = useAccordionState(null);
  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-5">
        <HelpCircle className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold font-heading">Perguntas Frequentes</h2>
      </div>
      <div className="space-y-2">
        {FAQS.map((faq, i) => (
          <div key={i} className="border rounded-xl overflow-hidden bg-card">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
              onClick={() => setOpen(open === i ? null : i)}
            >
              {faq.q}
              <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed border-t pt-3">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/*  CONTATO                                    */
/* ─────────────────────────────────────────── */
function ContactSection() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 p-6 text-white">
      <h2 className="text-lg font-bold mb-1">Precisa de ajuda ou quer fazer upgrade?</h2>
      <p className="text-violet-200 text-sm mb-5">
        Entre em contato com o administrador para contratar um plano, solicitar upgrade, pagar taxa de reinstalação ou tirar dúvidas.
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href="https://wa.me/5562996099697"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-4 py-3 text-sm font-medium"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp — (62) 99609-9697
        </a>
        <a
          href="tel:+5562996099697"
          className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-4 py-3 text-sm font-medium"
        >
          <Phone className="w-4 h-4" />
          (62) 99609-9697
        </a>
        <a
          href="mailto:ailtonsaib@gmail.com"
          className="flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-4 py-3 text-sm font-medium"
        >
          <Mail className="w-4 h-4" />
          ailtonsaib@gmail.com
        </a>
      </div>
      <p className="mt-4 text-violet-200 text-xs font-semibold">AILTON AIRES</p>
    </div>
  );
}