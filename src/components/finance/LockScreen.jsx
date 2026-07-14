import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Clock, LogOut, ArrowLeft, Mail, MessageCircle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LockScreen({ user, onRefresh, onLogout, transactions, embedded }) {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(user.finance_release_requested);
  const navigate = useNavigate();

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await base44.functions.invoke('portalAuth', {
        operation: 'requestRelease',
        email: user.email,
      });
      setRequested(true);
      await onRefresh();
    } catch (e) {
      alert("Erro ao solicitar liberação");
    }
    setRequesting(false);
  };

  return (
    <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-background flex flex-col items-center justify-center p-6`}>
      <div className="max-w-md w-full">
        {/* Back button */}
        {!embedded && (
          <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" /> Voltar ao Portal
          </Button>
        )}

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold font-heading mb-2">Seu teste foi finalizado</h1>
          <p className="text-sm text-muted-foreground">
            Você utilizou todas as {user.finance_transaction_limit} movimentações disponíveis no período de teste.
            Para continuar usando o aplicativo com acesso completo, entre em contato e faça seu registro.
          </p>
        </div>

        {/* Contact options */}
        <Card className="mb-4">
          <CardContent className="p-6 space-y-3">
            <p className="text-sm font-semibold text-center text-foreground mb-2">
              Entre em contato para se registrar:
            </p>
            <a
              href="https://wa.me/5592999999999?text=Ol%C3%A1!%20Gostaria%20de%20registrar%20meu%20acesso%20ao%20Controle%20de%20Finan%C3%A7as."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700">WhatsApp</p>
                <p className="text-xs text-emerald-600">Clique para conversar agora</p>
              </div>
            </a>
            <a
              href="mailto:contato@softpremier.com.br?subject=Registro%20-%20Controle%20de%20Finan%C3%A7as"
              className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">E-mail</p>
                <p className="text-xs text-muted-foreground">contato@softpremier.com.br</p>
              </div>
            </a>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="mb-4">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Como funciona o registro
            </p>
            <div className="space-y-3">
              {[
                "Entre em contato via WhatsApp ou e-mail informando o plano desejado.",
                "O administrador criará seu usuário com uma senha de primeiro acesso.",
                "O aplicativo será liberado de acordo com o plano contratado.",
                "Você fará login com a nova senha e terá acesso completo.",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <p className="text-sm text-foreground">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {requested && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700">
              Sua solicitação foi enviada ao administrador. Aguarde o contato.
            </p>
          </div>
        )}

        {!requested && (
          <Button variant="outline" className="w-full mb-3 gap-2" onClick={handleRequest} disabled={requesting}>
            <Clock className="w-4 h-4" />
            {requesting ? "Enviando..." : "Avisar o administrador que quero registrar"}
          </Button>
        )}

        {!embedded && (
          <Button variant="ghost" className="w-full gap-2" onClick={onLogout}>
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        )}
      </div>
    </div>
  );
}