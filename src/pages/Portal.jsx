import { motion } from "framer-motion";
import { Grid3x3, Wallet, ExternalLink } from "lucide-react";
import { APPS } from "@/lib/appRegistry";

const iconMap = { Grid3x3, Wallet };

export default function Portal() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,hsl(var(--primary)/0.1),transparent_60%)] pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 relative"
      >
        <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-foreground">
          SoftPremier
        </h1>
        <p className="mt-3 text-muted-foreground">Selecione um aplicativo para começar</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-2xl w-full relative">
        {APPS.map((app, idx) => {
          const Icon = iconMap[app.icon] || Grid3x3;
          return (
            <motion.a
              key={app.id}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group"
            >
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors ${app.iconBg}`}>
                <Icon className={`w-10 h-10 ${app.iconColor}`} />
              </div>
              <span className="font-semibold text-sm text-center text-foreground">{app.name}</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}