import React from 'react';
import { Monitor, Smartphone, Download, CheckCircle2, Globe, ArrowRight } from 'lucide-react';

export default function InstallInstructions() {
  const appUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 md:p-8">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
            <Download className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
            Instalar o SoftPremier no seu computador
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Siga os passos abaixo para instalar o sistema como um aplicativo nativo.
            Funciona em Windows, Mac e Linux — sem necessidade de arquivo .exe.
          </p>
        </div>

        {/* Desktop Instructions */}
        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-heading font-semibold">Computador (Windows / Mac / Linux)</h2>
          </div>

          <div className="space-y-4">
            <Step
              num={1}
              title="Abra o navegador"
              desc={
                <>
                  Acesse o endereço do sistema no <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>:
                  <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <code className="text-sm text-primary font-mono break-all">{appUrl}</code>
                  </div>
                </>
              }
            />
            <Step
              num={2}
              title="Clique no ícone de instalação"
              desc={
                <>
                  No canto superior direito da barra de endereços (ao lado do favorito ★), aparecerá um ícone de <strong>instalação</strong> (um monitor com seta para baixo). Clique nele.
                  <p className="mt-2 text-xs text-muted-foreground">
                    Se não aparecer, clique no menu <strong>⋮</strong> (Chrome) ou <strong>⋯</strong> (Edge) e selecione <strong>"Instalar esta página como aplicativo"</strong> ou <strong>"Instalar o site como aplicativo"</strong>.
                  </p>
                </>
              }
            />
            <Step
              num={3}
              title="Confirme a instalação"
              desc={<>Na janela que aparecer, clique em <strong>Instalar</strong>. O sistema será adicionado à sua área de trabalho e ao menu Iniciar.</>}
            />
            <Step
              num={4}
              title="Pronto!"
              desc={
                <>
                  O SoftPremier agora aparece como um ícone na sua área de trabalho/barra de tarefas. Clique para abrir como um programa normal — em tela cheia, sem barra de endereço do navegador.
                  <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Atualizações automáticas — você sempre usa a versão mais recente.
                  </div>
                </>
              }
              isLast
            />
          </div>
        </div>

        {/* Mobile Instructions */}
        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-heading font-semibold">Celular (Android e iPhone)</h2>
          </div>

          <div className="space-y-4">
            <Step
              num={1}
              title="Abra o link no navegador do celular"
              desc="Acesse o endereço do sistema no Chrome (Android) ou Safari (iPhone)."
            />
            <Step
              num={2}
              title="Adicione à tela inicial"
              desc={
                <>
                  <strong>Android (Chrome):</strong> Toque no menu <strong>⋮</strong> → <strong>"Adicionar à tela inicial"</strong>.
                  <br />
                  <strong>iPhone (Safari):</strong> Toque no botão <strong>Compartilhar</strong> → <strong>"Adicionar à Tela de Início"</strong>.
                </>
              }
            />
            <Step
              num={3}
              title="Pronto!"
              desc="O ícone aparecerá junto aos seus outros aplicativos. Toque para abrir."
              isLast
            />
          </div>
        </div>

        {/* Footer note */}
        <div className="bg-muted/30 rounded-xl border p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Dúvidas? Entre em contato com o suporte pelo WhatsApp ou e-mail.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center mt-6">
          <a
            href={appUrl}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
          >
            Abrir o Sistema <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Step({ num, title, desc, isLast }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
          {num}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />}
      </div>
      <div className="pb-1">
        <p className="text-sm font-medium text-foreground mb-1">{title}</p>
        <div className="text-sm text-muted-foreground leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}