import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Gamepad2, Building2, MessageCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { CONTACT } from "@/lib/appRegistry";

export default function CategorySelect() {
  const navigate = useNavigate();

  const categories = [
    {
      id: "jogos",
      title: "Jogos & Entretenimento",
      subtitle: "Bingo, rifas e muito mais",
      description: "Plataforma completa de bingo com geração de cartelas, vendas, telão e rifas.",
      icon: Gamepad2,
      accent: "#7C3AED",
      iconBg: "bg-[#E9E5FF]",
      iconColor: "text-[#7C3AED]",
      image: "https://media.base44.com/images/public/6a2055dca9eaba25f3a7de8f/635419225_generated_image.png",
      route: "/jogos",
      appCount: 1,
    },
    {
      id: "empresas",
      title: "Soluções Empresariais",
      subtitle: "ERP, fiscal e suporte",
      description: "Ponto de venda, validação fiscal SPED/DIME-SC e central de chamados.",
      icon: Building2,
      accent: "#EA580C",
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#EA580C]",
      image: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=800&auto=format&fit=crop&q=80",
      route: "/empresas",
      appCount: 3,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
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
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-[#1B1C21]">
              Escolha sua categoria
            </h1>
            <p className="mt-4 text-lg text-[#71717A] max-w-2xl mx-auto">
              Soluções digitais para entretenimento e gestão empresarial. Selecione a área que atende sua necessidade.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Category cards */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                onClick={() => navigate(cat.route)}
                className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden cursor-pointer group hover:shadow-[0_8px_36px_rgba(0,0,0,0.10)] transition-all duration-300 hover:-translate-y-1"
              >
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={cat.image}
                    alt={cat.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className={`absolute top-4 left-4 w-14 h-14 rounded-2xl flex items-center justify-center ${cat.iconBg} backdrop-blur-sm`}>
                    <Icon className={`w-7 h-7 ${cat.iconColor}`} />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/90 text-[#52525B] backdrop-blur-sm">
                      {cat.appCount} {cat.appCount === 1 ? "aplicativo" : "aplicativos"}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  <h3 className="text-xl font-bold text-[#1B1C21] mb-1">{cat.title}</h3>
                  <p className="text-sm font-medium mb-3" style={{ color: cat.accent }}>{cat.subtitle}</p>
                  <p className="text-sm text-[#52525B] leading-relaxed mb-6">{cat.description}</p>
                  <div className="flex items-center justify-between">
                    <Button
                      className="flex-1 h-11 rounded-xl text-white font-medium"
                      style={{ backgroundColor: cat.accent }}
                    >
                      Ver aplicativos
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Back to contact */}
        <div className="mt-10 text-center">
          <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer">
            <Button className="rounded-xl bg-[#25D366] hover:bg-[#25D366]/90 text-white h-11 px-6">
              <MessageCircle className="w-5 h-5 mr-2" /> Falar no WhatsApp
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-[#71717A]">© {new Date().getFullYear()} SoftPremier — {CONTACT.domain}. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}