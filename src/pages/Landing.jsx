import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { APPS, CONTACT } from "@/lib/appRegistry";
import { getPortalUser } from "@/lib/portalSession";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Mail, Phone, X, Check, Sparkles } from "lucide-react";

const iconMap = {
  Grid3x3: (props) => <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>,
  Wallet: (props) => <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>,
  FileText: (props) => <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/></svg>,
};

function currency(v) {
  return v === 0 ? "Grátis" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function AppCard({ app, onOpenPlans }) {
  const navigate = useNavigate();
  const Icon = iconMap[app.icon];
  const user = getPortalUser();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-8 pb-4">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${app.iconBg}`}>
            {Icon && <Icon width={28} height={28} className={app.iconColor} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[#1B1C21]">{app.name}</h3>
            <p className="text-sm text-[#71717A]">{app.tagline}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-[#52525B] leading-relaxed">{app.description}</p>
      </div>

      {/* Features */}
      <div className="px-8 pb-4 flex-1">
        <ul className="space-y-1.5">
          {app.features?.map((feat, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[#52525B]">
              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
              {feat}
            </li>
          ))}
        </ul>
      </div>

      {/* Plans preview */}
      <div className="px-8 pb-4">
        <div className="flex flex-wrap gap-1.5">
          {app.plans?.map((plan, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: `${app.accent}15`, color: app.accent }}>
              {plan.name}: {currency(plan.price)}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 pt-2 flex gap-2">
        <Button
          onClick={() => navigate(app.entryRoute)}
          className="flex-1 h-10 rounded-xl text-white font-medium"
          style={{ backgroundColor: app.accent }}
        >
          {user && user[app.permission] ? "Acessar" : "Experimentar"}
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
        <Button
          onClick={() => onOpenPlans(app)}
          variant="outline"
          className="h-10 rounded-xl border-gray-200 text-[#52525B] hover:bg-gray-50"
        >
          Ver Planos
        </Button>
      </div>
    </motion.div>
  );
}

function PlansModal({ app, onClose }) {
  if (!app) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${app.iconBg}`}>
                {iconMap[app.icon] && <span className={app.iconColor}>{iconMap[app.icon]({ width: 20, height: 20 })}</span>}
              </div>
              <div>
                <h3 className="font-bold text-[#1B1C21]">{app.name} — Planos</h3>
                <p className="text-xs text-[#71717A]">Escolha o plano ideal para você</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-[#71717A]" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {app.plans?.map((plan, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-5 ${plan.price === 0 ? "border-gray-200 bg-gray-50" : "border-2 bg-white"}`}
                  style={plan.price !== 0 ? { borderColor: app.accent } : {}}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-[#1B1C21]">{plan.name}</h4>
                    {plan.price === 0 && <Sparkles className="w-4 h-4 text-[#71717A]" />}
                  </div>
                  <p className="text-2xl font-bold mb-3" style={{ color: app.accent }}>
                    {currency(plan.price)}
                    {plan.price !== 0 && <span className="text-xs font-normal text-[#71717A]">/mês</span>}
                  </p>
                  <ul className="space-y-1.5">
                    {plan.max_cards && <li className="text-xs text-[#52525B] flex items-start gap-1.5"><Check className="w-3 h-3 text-green-500 mt-0.5" />{plan.max_cards} cartelas</li>}
                    {plan.limit && <li className="text-xs text-[#52525B] flex items-start gap-1.5"><Check className="w-3 h-3 text-green-500 mt-0.5" />{plan.limit}</li>}
                    {plan.downloads !== undefined && <li className="text-xs text-[#52525B] flex items-start gap-1.5"><Check className="w-3 h-3 text-green-500 mt-0.5" />{plan.downloads ? `${plan.downloads} downloads` : "Downloads ilimitados"}</li>}
                    {plan.apps?.map((a, j) => <li key={j} className="text-xs text-[#52525B] flex items-start gap-1.5"><Check className="w-3 h-3 text-green-500 mt-0.5" />{a}</li>)}
                    {plan.types?.map((t, j) => <li key={j} className="text-xs text-[#52525B] flex items-start gap-1.5"><Check className="w-3 h-3 text-green-500 mt-0.5" />SPED {t}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-[#F5F5F5] border border-gray-100">
              <p className="text-sm font-medium text-[#1B1C21] mb-2">Interessado? Entre em contato:</p>
              <div className="flex flex-wrap gap-2">
                <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#25D366]/90 text-white text-sm font-medium transition-colors">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6200EA] hover:bg-[#6200EA]/90 text-white text-sm font-medium transition-colors">
                  <Mail className="w-4 h-4" /> Email
                </a>
                <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-[#52525B] text-sm">
                  <Phone className="w-4 h-4" /> {CONTACT.phone}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [plansApp, setPlansApp] = useState(null);
  const publicApps = APPS.filter((a) => !a.adminOnly);

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold font-display tracking-tight text-[#1B1C21]">SoftPremier</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-2 text-sm text-[#52525B] hover:text-[#25D366] transition-colors">
              <MessageCircle className="w-4 h-4" /> Contato
            </a>
            <Button onClick={() => navigate("/portal-login")} variant="outline" size="sm" className="rounded-lg border-gray-200">
              Área do Admin
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-12 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-[#1B1C21]">
              Soluções digitais para sua empresa
            </h1>
            <p className="mt-4 text-lg text-[#71717A] max-w-2xl mx-auto">
              Aplicativos profissionais para bingo, controle financeiro e validação fiscal.
              Comece grátis e faça upgrade quando precisar.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer">
                <Button className="rounded-xl bg-[#25D366] hover:bg-[#25D366]/90 text-white h-11 px-6">
                  <MessageCircle className="w-5 h-5 mr-2" /> Falar no WhatsApp
                </Button>
              </a>
              <Button onClick={() => document.getElementById("apps").scrollIntoView({ behavior: "smooth" })} variant="outline" className="rounded-xl border-gray-200 h-11 px-6">
                Ver Aplicativos
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Apps grid */}
      <section id="apps" className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {publicApps.map((app) => (
            <AppCard key={app.id} app={app} onOpenPlans={setPlansApp} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold font-display text-center text-[#1B1C21] mb-8">Como funciona</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {[
            { num: "1", title: "Escolha o app", desc: "Selecione o aplicativo que atende sua necessidade" },
            { num: "2", title: "Veja os planos", desc: "Avalie os planos disponíveis sem precisar cadastrar" },
            { num: "3", title: "Entre em contato", desc: "Fale pelo WhatsApp, email ou telefone para adquirir" },
            { num: "4", title: "Receba seu acesso", desc: "Recebemos seu login e comece a usar com banco limpo" },
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[#6200EA] text-white font-bold text-lg flex items-center justify-center mx-auto mb-3">
                {step.num}
              </div>
              <h3 className="font-semibold text-sm text-[#1B1C21] mb-1">{step.title}</h3>
              <p className="text-xs text-[#71717A]">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-gradient-to-r from-[#6200EA] to-[#7C3AED] rounded-3xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">Pronto para começar?</h2>
          <p className="text-white/80 mb-6">Entre em contato e receba seu acesso em minutos.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer">
              <Button className="bg-white text-[#6200EA] hover:bg-white/90 rounded-xl h-11 px-6">
                <MessageCircle className="w-5 h-5 mr-2" /> WhatsApp
              </Button>
            </a>
            <a href={`mailto:${CONTACT.email}`}>
              <Button className="bg-white/10 text-white hover:bg-white/20 border border-white/30 rounded-xl h-11 px-6">
                <Mail className="w-5 h-5 mr-2" /> {CONTACT.email}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm text-[#71717A]">© {new Date().getFullYear()} SoftPremier — {CONTACT.domain}</p>
          <div className="mt-3 flex justify-center gap-4">
            <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" className="text-xs text-[#71717A] hover:text-[#25D366]">WhatsApp</a>
            <a href={`mailto:${CONTACT.email}`} className="text-xs text-[#71717A] hover:text-[#6200EA]">Email</a>
            <span className="text-xs text-[#71717A]">{CONTACT.phone}</span>
          </div>
        </div>
      </footer>

      {/* Plans modal */}
      {plansApp && <PlansModal app={plansApp} onClose={() => setPlansApp(null)} />}
    </div>
  );
}