import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, ArrowLeft, Zap, Star, Crown, Rocket, Shield, Trophy } from "lucide-react";
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

  const getFullUrl = (path) => {
    return `${window.location.origin}${path}`;
  };

  const handleCopy = (path, key) => {
    navigator.clipboard.writeText(getFullUrl(path));
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const currentPlan = PLANS.find(p => p.current) || PLANS.find(p => p.key === "mega");

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
              <p className="text-sm font-semibold text-violet-900">
                Seu plano atual: <span className="text-violet-700">MEGA — 50.000 cartelas</span>
              </p>
              <p className="text-xs text-violet-600">Para fazer upgrade, entre em contato com o administrador do sistema.</p>
            </div>
          </div>
          <Badge className="bg-violet-600 text-white border-0 text-sm px-4 py-1">MEGA</Badge>
        </div>

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
        <div className="mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold font-heading">Planos e Preços</h2>
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

                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Para contratar ou fazer upgrade de plano, entre em contato com o suporte do sistema.
        </p>
      </div>
    </div>
  );
}