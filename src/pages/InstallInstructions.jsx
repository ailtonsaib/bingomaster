import React, { useState } from 'react';
import { Monitor, Smartphone, Download, CheckCircle2, Globe, ArrowRight, Chrome, Apple, MousePointerClick, Shield, Zap, RefreshCw } from 'lucide-react';

function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Edg/.test(ua)) return 'edge';
  if (/Chrome/.test(ua)) return 'chrome';
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari';
  if (/Firefox/.test(ua)) return 'firefox';
  return 'other';
}

function detectOS() {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'windows';
  if (/Mac/.test(ua)) return 'mac';
  if (/Linux/.test(ua)) return 'linux';
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  return 'other';
}

export default function InstallInstructions() {
  const appUrl = window.location.origin;
  const [copied, setCopied] = useState(false);
  const [browser] = useState(detectBrowser());
  const [os] = useState(detectOS());
  const [isMobile] = useState(() => /Android|iPhone|iPad|iPod/.test(navigator.userAgent));

  const copyUrl = () => {
    navigator.clipboard?.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const browserName = {
    chrome: 'Google Chrome',
    edge: 'Microsoft Edge',
    safari: 'Safari',
    firefox: 'Mozilla Firefox',
    other: 'seu navegador',
  }[browser];

  const browserSupported = browser === 'chrome' || browser === 'edge';

  const BrowserIcon = browser === 'edge' ? Chrome : Chrome; // Chrome icon works for both Chromium-based

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Download className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-display text-[#1B1C21]">SoftPremier</span>
          </div>
          <a
            href={appUrl}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Abrir Sistema <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground mb-5 shadow-xl shadow-primary/20">
          <Download className="w-10 h-10" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-display text-[#1B1C21]">
          Instalar o SoftPremier
        </h1>
        <p className="text-muted-foreground mt-3 text-base max-w-xl mx-auto">
          Transforme o sistema em um aplicativo nativo no seu computador ou celular.
          Sem arquivo .exe, sem complicação — funciona em Windows, Mac, Linux e celulares.
        </p>

        {/* Benefits */}
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            Abre como programa nativo
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            </div>
            Atualizações automáticas
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-purple-600" />
            </div>
            Sempre seguro e atualizado
          </div>
        </div>
      </section>

      {/* Link card */}
      <section className="max-w-4xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Endereço do sistema</p>
            <p className="text-sm font-mono text-primary truncate">{appUrl}</p>
          </div>
          <button
            onClick={copyUrl}
            className="shrink-0 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>

        {/* Browser detection */}
        <div className={`mt-3 flex items-center gap-2 text-sm rounded-lg p-3 ${
          browserSupported
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {browserSupported ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <MousePointerClick className="w-4 h-4 shrink-0" />
          )}
          <span>
            {browserSupported
              ? `Detectamos ${browserName} — você já pode instalar seguindo as instruções abaixo.`
              : `Detectamos ${browserName}. Para melhor experiência, use Google Chrome ou Microsoft Edge.`}
          </span>
        </div>
      </section>

      {/* Desktop Instructions */}
      {!isMobile && (
        <section className="max-w-4xl mx-auto px-6 pb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary/5 to-transparent p-6 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1B1C21]">Computador</h2>
                  <p className="text-xs text-muted-foreground">
                    {os === 'mac' ? 'macOS' : os === 'linux' ? 'Linux' : 'Windows'} · {browserName}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-5">
                <Step
                  num={1}
                  title="Abra o sistema no navegador"
                  icon={Globe}
                  desc={
                    <>
                      Abra o endereço abaixo no <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>:
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
                  icon={MousePointerClick}
                  desc={
                    <>
                      No canto direito da barra de endereços (ao lado do ★), aparecerá um ícone de <strong>instalação</strong> (monitor com seta ↓). Clique nele.
                      <p className="mt-2 text-xs text-muted-foreground">
                        Não apareceu? Clique no menu <strong className="text-foreground">⋮</strong> (Chrome) ou <strong className="text-foreground">⋯</strong> (Edge) e selecione <strong className="text-foreground">"Instalar esta página como aplicativo"</strong>.
                      </p>
                    </>
                  }
                />
                <Step
                  num={3}
                  title="Confirme a instalação"
                  icon={Download}
                  desc="Na janela que aparecer, clique em **Instalar**. O sistema será adicionado à sua área de trabalho e ao menu Iniciar."
                />
                <Step
                  num={4}
                  title="Pronto!"
                  icon={CheckCircle2}
                  desc={
                    <>
                      O SoftPremier agora aparece como um ícone na sua área de trabalho e barra de tarefas. Clique para abrir em tela cheia, sem barra de endereço — como um programa normal.
                    </>
                  }
                  isLast
                  highlight
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Mobile Instructions */}
      {isMobile && (
        <section className="max-w-4xl mx-auto px-6 pb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary/5 to-transparent p-6 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1B1C21]">Celular</h2>
                  <p className="text-xs text-muted-foreground">
                    {os === 'ios' ? 'iPhone (Safari)' : 'Android (Chrome)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-5">
                {os === 'ios' ? (
                  <>
                    <Step
                      num={1}
                      title="Abra no Safari"
                      icon={Apple}
                      desc="Abra o endereço do sistema no navegador Safari do iPhone."
                    />
                    <Step
                      num={2}
                      title="Toque em Compartilhar"
                      icon={MousePointerClick}
                      desc="Toque no botão de Compartilhar (quadrado com seta para cima) na barra inferior do Safari."
                    />
                    <Step
                      num={3}
                      title="Adicione à Tela de Início"
                      icon={Download}
                      desc={<>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>. Confirme tocando em <strong>Adicionar</strong>.</>}
                    />
                    <Step
                      num={4}
                      title="Pronto!"
                      icon={CheckCircle2}
                      desc="O ícone aparecerá junto aos seus outros aplicativos. Toque para abrir em tela cheia."
                      isLast
                      highlight
                    />
                  </>
                ) : (
                  <>
                    <Step
                      num={1}
                      title="Abra no Chrome"
                      icon={Chrome}
                      desc="Abra o endereço do sistema no Google Chrome do seu Android."
                    />
                    <Step
                      num={2}
                      title="Toque no menu"
                      icon={MousePointerClick}
                      desc="Toque nos três pontos **⋮** no canto superior direito do Chrome."
                    />
                    <Step
                      num={3}
                      title="Adicione à tela inicial"
                      icon={Download}
                      desc="Toque em **"Adicionar à tela inicial"** e confirme."
                    />
                    <Step
                      num={4}
                      title="Pronto!"
                      icon={CheckCircle2}
                      desc="O ícone aparecerá na sua tela inicial. Toque para abrir como um app."
                      isLast
                      highlight
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Both platforms link */}
      <section className="max-w-4xl mx-auto px-6 pb-8">
        <div className="flex flex-wrap gap-3 justify-center">
          {!isMobile && (
            <a
              href={appUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Monitor className="w-4 h-4" /> Abrir no Computador
            </a>
          )}
          {isMobile && (
            <a
              href={appUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Smartphone className="w-4 h-4" /> Abrir no Celular
            </a>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
          Perguntas Frequentes
        </h3>
        <div className="space-y-2">
          <FAQ
            q="Preciso de internet para usar?"
            a="Sim. O aplicativo abre a partir do link online, então precisa de conexão com internet para funcionar."
          />
          <FAQ
            q="Vou receber atualizações?"
            a="Sim! As atualizações são automáticas — você sempre usa a versão mais recente sem precisar reinstalar nada."
          />
          <FAQ
            q="Funciona em qualquer computador?"
            a="Funciona em Windows, macOS e Linux. Basta ter o Google Chrome ou Microsoft Edge instalado."
          />
          <FAQ
            q="É seguro?"
            a="Sim. A instalação pelo navegador cria um atalho para o sistema web, sem baixar nenhum arquivo executável externo."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs text-muted-foreground">
            Dúvidas? Entre em contato pelo WhatsApp: (62) 99609-9697
          </p>
        </div>
      </footer>
    </div>
  );
}

function Step({ num, title, desc, icon: Icon, isLast, highlight }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
            highlight
              ? 'bg-emerald-500 text-white'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          {highlight ? <CheckCircle2 className="w-5 h-5" /> : num}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1 min-h-[24px]" />}
      </div>
      <div className="pb-1 flex-1">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
          <p className="text-sm font-semibold text-[#1B1C21]">{title}</p>
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-medium text-[#1B1C21]">{q}</span>
        <span className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}