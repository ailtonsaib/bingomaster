import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Search, Info, Car, X } from "lucide-react";

const BRANDS_VW_GROUP = [
  { label: "Volkswagen", url: "https://ifinterface.com/page/page3.php?langid=1" },
  { label: "Audi", url: "https://ifinterface.com/page/page3.php?langid=1" },
  { label: "Seat", url: "https://ifinterface.com/page/page3.php?langid=1" },
  { label: "Skoda", url: "https://ifinterface.com/page/page3.php?langid=1" },
  { label: "Porsche", url: "https://ifinterface.com/page/page3.php?langid=1" },
];

const OTHER_CATALOGS = [
  { label: "Fiat | Catalogo Oficial", url: "https://catalogo.fiat.com.br/" },
  { label: "Chevrolet (GM) | AC Delco", url: "https://www.acdelco.com.br/" },
  { label: "Hyundai | Peças Genuínas", url: "https://www.hyundai.com.br/pecas-genuinas" },
  { label: "Toyota | Peças Genuínas", url: "https://www.toyota.com.br/pecas-acessorios" },
  { label: "Honda | Peças Genuínas", url: "https://www.honda.com.br/pecas-e-acessorios" },
  { label: "Renault | Peças de Reposição", url: "https://www.renault.com.br/pos-venda/pecas-de-reposicao.html" },
  { label: "Ford | Catálogo de Peças", url: "https://www.ford.com.br/pecas-acessorios" },
  { label: "Nissan | Peças Genuínas", url: "https://www.nissan.com.br/pecas-acessorios" },
  { label: "Jeep | Peças Genuínas", url: "https://www.jeep.com.br/pecas-acessorios" },
  { label: "Citroën | Peças Genuínas", url: "https://www.citroen.com.br/pos-venda/pecas-de-reposicao.html" },
  { label: "Peugeot | Peças Genuínas", url: "https://www.peugeot.com.br/pos-venda/pecas-de-reposicao.html" },
];

export default function PartsOnlineSearchModal({ open, onClose }) {
  const [vin, setVin] = useState("");
  const [partNumber, setPartNumber] = useState("");

  if (!open) return null;

  const openIFInterface = () => {
    window.open("https://ifinterface.com/page/page3.php?langid=1", "_blank", "noopener,noreferrer");
  };

  const searchByVIN = () => {
    if (!vin.trim()) return;
    // IFInterface não expõe URL de busca direta por VIN; abre o catálogo
    openIFInterface();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Buscar Peças Online</h3>
              <p className="text-xs text-gray-500">Catálogos oficiais por montadora</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Aviso sobre IFInterface */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 space-y-1">
                <p className="font-semibold">IFInterface (ETKA Online)</p>
                <p>
                  Catálogo completo de peças originais do <strong>Grupo VW</strong> (Volkswagen, Audi, Seat, Skoda, Porsche).
                  Permite buscar por número da peça, VIN/chassi e modelo. É necessário criar login gratuito no site.
                </p>
              </div>
            </div>
          </div>

          {/* Busca por VIN / Número de peça */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Buscar por VIN / Chassi</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={vin}
                  onChange={e => setVin(e.target.value)}
                  placeholder="Ex: 9BWZZZ377VT004251"
                  className="flex-1"
                  maxLength={17}
                />
                <Button onClick={searchByVIN} disabled={!vin.trim()} className="gap-1 text-white" style={{ backgroundColor: "#2563EB" }}>
                  <ExternalLink className="w-4 h-4" /> Abrir
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">O catálogo abre em nova aba. Cole o VIN na busca do site.</p>
            </div>

            <div>
              <Label className="text-sm font-medium">Buscar por número da peça</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={partNumber}
                  onChange={e => setPartNumber(e.target.value)}
                  placeholder="Ex: 6Q0807371A"
                  className="flex-1"
                />
                <Button
                  onClick={() => { if (partNumber.trim()) openIFInterface(); }}
                  disabled={!partNumber.trim()}
                  className="gap-1 text-white"
                  style={{ backgroundColor: "#2563EB" }}
                >
                  <ExternalLink className="w-4 h-4" /> Abrir
                </Button>
              </div>
            </div>
          </div>

          {/* Grupo VW - IFInterface */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" /> Grupo VW (IFInterface ETKA)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BRANDS_VW_GROUP.map(b => (
                <button
                  key={b.label}
                  onClick={() => window.open(b.url, "_blank", "noopener,noreferrer")}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-700"
                >
                  {b.label}
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Outras montadoras */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Car className="w-4 h-4 text-gray-500" /> Outras Montadoras
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OTHER_CATALOGS.map(c => (
                <button
                  key={c.label}
                  onClick={() => window.open(c.url, "_blank", "noopener,noreferrer")}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-700"
                >
                  {c.label}
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 italic text-center">
            Os catálogos abrem em nova aba. Após encontrar o número da peça original, você pode cadastrá-la no sistema.
          </p>
        </div>
      </div>
    </div>
  );
}