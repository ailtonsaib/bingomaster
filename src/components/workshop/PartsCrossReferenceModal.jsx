import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, X, Globe, Building2, Tag, ExternalLink } from "lucide-react";

const VEHICLE_BRANDS = [
  "Fiat", "Volkswagen", "Chevrolet", "Hyundai", "Toyota", "Honda", "Renault",
  "Ford", "Nissan", "Jeep", "Citroën", "Peugeot", "Audi", "BMW", "Mercedes-Benz",
  "Kia", "Mitsubishi", "Jac", "Chery", "Lifan"
];

export default function PartsCrossReferenceModal({ open, onClose, parts = [] }) {
  const [partName, setPartName] = useState("");
  const [selPart, setSelPart] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleEngine, setVehicleEngine] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  if (!open) return null;

  const partNames = [...new Set(parts.map(p => p.name).filter(Boolean))].sort();

  const handleSearch = async () => {
    setError("");
    setResults(null);

    const finalPartName = selPart || partName.trim();
    if (!finalPartName) {
      setError("Selecione ou digite o nome da peça.");
      return;
    }
    if (!vehicleBrand) {
      setError("Selecione a montadora do veículo.");
      return;
    }
    if (!vehicleModel.trim()) {
      setError("Informe o modelo do veículo.");
      return;
    }

    setLoading(true);
    try {
      const prompt = `Você é um especialista em peças automotivas. Liste TODOS os fabricantes conhecidos que produzem a peça "${finalPartName}" para o veículo ${vehicleBrand} ${vehicleModel} ${vehicleEngine ? `motorização ${vehicleEngine}` : ""} ${vehicleYear ? `ano ${vehicleYear}` : "(todos os anos)"}.

Para cada fabricante, forneça:
- Nome do fabricante
- Código/Número da peça original (se conhecido)
- Faixa de preço aproximada em reais (se disponível)
- Categoria da peça

Inclua fabricantes originais (OEM) e paralelos (aftermarket). Seja específico e liste no máximo 15 fabricantes relevantes.

Retorne em formato JSON com esta estrutura exata:
{
  "fabricantes": [
    {
      "nome": "Nome do Fabricante",
      "codigo_original": "Código ou 'N/D'",
      "preco_min": 0,
      "preco_max": 0,
      "categoria": "Categoria da peça",
      "tipo": "OEM" ou "Aftermarket"
    }
  ],
  "observacoes": "Observações gerais sobre compatibilidade"
}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: "gemini_3_flash",
        response_json_schema: {
          type: "object",
          properties: {
            fabricantes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  codigo_original: { type: "string" },
                  preco_min: { type: "number" },
                  preco_max: { type: "number" },
                  categoria: { type: "string" },
                  tipo: { type: "string" }
                }
              }
            },
            observacoes: { type: "string" }
          }
        }
      });

      setResults(res);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Erro ao buscar fabricantes.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v) => v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Buscar Fabricantes da Peça</h3>
              <p className="text-xs text-gray-500">Cruzamento de peças por veículo (online)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Seleção da peça */}
          <div>
            <Label className="text-sm font-medium">Peça</Label>
            <p className="text-xs text-gray-400 mb-2">Selecione do catálogo ou digite o nome da peça</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={selPart}
                onChange={e => { setSelPart(e.target.value); setPartName(""); }}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Selecionar do catálogo...</option>
                {partNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <Input
                value={partName}
                onChange={e => { setPartName(e.target.value); setSelPart(""); }}
                placeholder="Ou digite (ex: Pastilha de freio, Filtro de óleo...)"
                className="flex-1"
              />
            </div>
          </div>

          {/* Seleção do veículo */}
          <div>
            <Label className="text-sm font-medium">Veículo</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
              <div>
                <select
                  value={vehicleBrand}
                  onChange={e => { setVehicleBrand(e.target.value); setVehicleModel(""); }}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Montadora</option>
                  {VEHICLE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <Input
                value={vehicleModel}
                onChange={e => setVehicleModel(e.target.value)}
                placeholder="Modelo * (ex: Palio)"
                className="flex-1"
              />
              <Input
                value={vehicleYear}
                onChange={e => setVehicleYear(e.target.value)}
                placeholder="Ano (ex: 2015)"
                className="flex-1"
              />
              <Input
                value={vehicleEngine}
                onChange={e => setVehicleEngine(e.target.value)}
                placeholder="Motorização (ex: 1.0, 1.6)"
                className="flex-1"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleSearch}
            disabled={loading}
            className="w-full h-11 rounded-xl text-white font-medium gap-2"
            style={{ backgroundColor: "#2563EB" }}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Buscando fabricantes...</>
            ) : (
              <><Search className="w-4 h-4" /> Buscar Fabricantes Online</>
            )}
          </Button>

          {/* Resultados */}
          {results && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold text-gray-900">
                  {results.fabricantes?.length || 0} Fabricante(s) encontrado(s)
                </h4>
              </div>

              {results.fabricantes?.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {results.fabricantes.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{f.nome}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${f.tipo === "OEM" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                              {f.tipo || "—"}
                            </span>
                          </div>
                          {f.categoria && (
                            <p className="text-xs text-gray-500 mt-0.5">{f.categoria}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-500">Código:</span>
                          <span className="font-mono text-xs text-gray-700">{f.codigo_original || "N/D"}</span>
                        </div>
                        {(f.preco_min > 0 || f.preco_max > 0) && (
                          <div className="text-right">
                            <span className="text-green-600 font-medium">
                              {formatCurrency(f.preco_min)} {f.preco_max > f.preco_min ? `– ${formatCurrency(f.preco_max)}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-6">Nenhum fabricante encontrado.</p>
              )}

              {results.observacoes && (
                <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-sm text-blue-900">
                  <span className="font-semibold">Obs: </span>{results.observacoes}
                </div>
              )}

              <p className="text-xs text-gray-400 italic text-center pt-2">
                * Os preços e códigos são aproximados e podem variar. Confirme com o fornecedor antes da compra.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}