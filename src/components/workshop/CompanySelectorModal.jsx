import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CompanySelectorModal({ companies, onSelect, open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <Building2 className="w-5 h-5" /> Selecione a Empresa
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 mb-4">
          Você possui mais de uma empresa vinculada ao seu email. Selecione qual deseja gerenciar:
        </p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full text-left p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-3 group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {c.logo_url ? (
                  <img src={c.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 truncate">{c.razao_social}</p>
                {c.nome_fantasia && <p className="text-xs text-gray-500 truncate">{c.nome_fantasia}</p>}
                {c.city && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {c.city}/{c.uf}
                  </p>
                )}
              </div>
              <Check className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={onClose} className="w-full mt-2">Cancelar</Button>
      </DialogContent>
    </Dialog>
  );
}