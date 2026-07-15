import { CloudOff } from 'lucide-react';

export default function OfflineBanner({ hasPendingSync }) {
  return (
    <div className="bg-amber-500/90 backdrop-blur text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium animate-pulse">
      <CloudOff className="w-4 h-4" />
      <span>
        {hasPendingSync
          ? 'Você está offline — sorteios salvos localmente e serão sincronizados quando a conexão voltar.'
          : 'Você está offline — modo de sorteio local ativado.'}
      </span>
    </div>
  );
}