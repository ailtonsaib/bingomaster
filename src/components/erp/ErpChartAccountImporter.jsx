import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, AlertTriangle, Download } from "lucide-react";
import { buildXlsxBlob, downloadBlob } from "@/lib/excelTemplate";

// Mapeamento de tipo de conta pelo prefixo do código
function inferAccountType(code) {
  if (!code) return "ativo";
  if (code.startsWith("2.3")) return "patrimonio_liquido";
  if (code.startsWith("2.1") || code.startsWith("2.2")) return "passivo";
  if (code.startsWith("1")) return "ativo";
  if (code.startsWith("3.1.01")) return "receita";
  if (code.startsWith("3.1.02")) return "despesa"; // deduções
  if (code.startsWith("3")) return "despesa";
  if (code.startsWith("4")) return "despesa";
  return "ativo";
}

function inferNature(account_type) {
  return (account_type === "passivo" || account_type === "patrimonio_liquido" || account_type === "receita") ? "credora" : "devedora";
}

const TYPE_OPTS = [
  { value: "ativo", label: "Ativo" },
  { value: "passivo", label: "Passivo" },
  { value: "patrimonio_liquido", label: "Patrimônio Líquido" },
  { value: "receita", label: "Receita" },
  { value: "despesa", label: "Despesa" },
  { value: "compensacao", label: "Compensação" },
];

const HEADERS = [
  "Codigo",
  "Nome",
  "Codigo_Referencial",
  "Nome_Referencial",
  "Analitica (Sim/Nao)",
  "Tipo (ativo/passivo/patrimonio_liquido/receita/despesa/compensacao)",
  "Natureza (devedora/credora)",
];

const SAMPLE_ROWS = [
  ["1", "ATIVO", "", "", "Nao", "ativo", "devedora"],
  ["1.1", "ATIVO CIRCULANTE", "", "", "Nao", "ativo", "devedora"],
  ["1.1.01.01.0001", "CAIXA GERAL", "1.01.01.01.01", "Caixa Matriz", "Sim", "ativo", "devedora"],
  ["2.3.01.0001", "CAPITAL SOCIAL", "2.01.01.01.01", "Capital Social", "Sim", "patrimonio_liquido", "credora"],
  ["3.1.01.0001", "RECEITA DE VENDAS", "3.01.01.01.01", "Receita de Vendas", "Sim", "receita", "credora"],
];

function normalizeKey(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[()]/g, "");
}

export default function ErpChartAccountImporter({ user, onDone }) {
  const [step, setStep] = useState("upload"); // upload | preview | importing | done
  const [parsedAccounts, setParsedAccounts] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [fileUploading, setFileUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  // Baixa o modelo .xlsx preenchível
  const handleDownloadTemplate = async () => {
    setGeneratingTemplate(true);
    try {
      const blob = await buildXlsxBlob(HEADERS, SAMPLE_ROWS);
      downloadBlob(blob, "modelo_plano_de_contas.xlsx");
    } catch (e) {
      alert("Erro ao gerar modelo: " + (e.message || "tente novamente"));
    }
    setGeneratingTemplate(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileUploading(true);
    setExtracting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            accounts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  codigo: { type: "string", description: "Código da conta interna (ex: 1.1.01.01.0001)" },
                  nome: { type: "string", description: "Descrição/nome da conta interna" },
                  codigo_referencial: { type: "string", description: "Código da conta referencial (ex: 1.01.01.01.01). Vazio para sintética." },
                  nome_referencial: { type: "string", description: "Descrição da conta referencial. Vazio para sintética." },
                  analitica: { type: "string", description: "Sim para analítica (aceita lançamentos), Nao para sintética (agrupadora)" },
                  tipo: { type: "string", description: "ativo, passivo, patrimonio_liquido, receita, despesa ou compensacao" },
                  natureza: { type: "string", description: "devedora ou credora" },
                },
              },
            },
          },
        },
      });

      const raw = (res && res.output && res.output.accounts) ? res.output.accounts : [];

      // Tenta normalizar chaves caso o extrator devolva nomes alternativos
      const allAccounts = raw.map(a => {
        const code = a.codigo || a.Codigo || a.code || "";
        const name = a.nome || a.Nome || a.name || "";
        const referential_code = a.codigo_referencial || a.referential_code || a.Codigo_Referencial || "";
        const referential_name = a.nome_referencial || a.referential_name || a.Nome_Referencial || "";
        const analiticaRaw = String(a.analitica || a.Analitica || "Sim").toLowerCase();
        const accepts_entries = !(analiticaRaw.startsWith("nao") || analiticaRaw === "false");
        const tipoRaw = String(a.tipo || a.Tipo || "").toLowerCase();
        let account_type = TYPE_OPTS.some(o => o.value === tipoRaw) ? tipoRaw : "";
        if (!account_type) account_type = inferAccountType(code);
        const naturezaRaw = String(a.natureza || a.Natureza || "").toLowerCase();
        const nature = (naturezaRaw === "credora" || naturezaRaw === "devedora") ? naturezaRaw : inferNature(account_type);
        return {
          code: String(code).trim(),
          name: String(name).trim(),
          referential_code: String(referential_code).trim(),
          referential_name: String(referential_name).trim(),
          account_type,
          nature,
          accepts_entries,
          is_active: true,
          user_email: user.email,
        };
      }).filter(a => a.code && a.name);

      if (allAccounts.length === 0) {
        alert("Não foi possível extrair contas do Excel. Verifique se o arquivo segue o modelo baixado.");
      } else {
        setParsedAccounts(allAccounts);
        setStep("preview");
      }
    } catch (err) {
      alert("Erro ao processar o Excel: " + (err.message || "tente novamente"));
    }
    setExtracting(false);
    setFileUploading(false);
  };

  const handleImport = async () => {
    if (parsedAccounts.length === 0) return;
    setStep("importing");
    const BATCH = 50;
    let done = 0, errors = 0;
    setProgress({ done: 0, total: parsedAccounts.length, errors: 0 });
    for (let i = 0; i < parsedAccounts.length; i += BATCH) {
      const batch = parsedAccounts.slice(i, i + BATCH);
      try {
        await base44.entities.ErpChartAccount.bulkCreate(batch);
        done += batch.length;
      } catch (e) {
        errors += batch.length;
      }
      setProgress({ done, total: parsedAccounts.length, errors });
    }
    setStep("done");
  };

  return (
    <div className="space-y-4 bg-white rounded-xl border p-4">
      <h2 className="font-semibold flex items-center gap-2 text-indigo-700"><FileSpreadsheet className="w-5 h-5" /> Importar Plano de Contas (Excel)</h2>

      {step === "upload" && (
        <div className="space-y-4">
          {/* Download do modelo */}
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 flex items-center gap-3">
            <Download className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-emerald-800">Baixar modelo padrão</p>
              <p className="text-xs text-emerald-700">Planilha .xlsx com cabeçalhos e exemplos para preencher</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleDownloadTemplate} disabled={generatingTemplate} className="border-emerald-400 text-emerald-700 hover:bg-emerald-100 gap-1.5">
              {generatingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generatingTemplate ? "Gerando..." : "Baixar Modelo"}
            </Button>
          </div>

          {/* Upload da planilha preenchida */}
          <div className="border-2 border-dashed border-indigo-200 rounded-lg p-6 text-center">
            <Upload className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
            <p className="font-medium text-sm mb-1">Enviar planilha preenchida</p>
            <p className="text-xs text-gray-500 mb-3">Selecione o arquivo .xlsx gerado a partir do modelo</p>
            <label className="cursor-pointer">
              <span className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 inline-flex items-center gap-2">
                {fileUploading || extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> {extracting ? "Extraindo contas..." : "Enviando..."}</> : "Selecionar Excel"}
              </span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={fileUploading || extracting} />
            </label>
            {(fileUploading || extracting) && (
              <p className="text-xs text-indigo-600 mt-2 flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {fileUploading ? "Enviando planilha..." : "Extraindo contas..."}
              </p>
            )}
          </div>

          {/* Instruções do modelo */}
          <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700 mb-1">Colunas do modelo:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><b>Codigo</b> — código da conta (ex: 1.1.01.01.0001). <b>Obrigatório.</b></li>
              <li><b>Nome</b> — descrição da conta. <b>Obrigatório.</b></li>
              <li><b>Codigo_Referencial</b> — conta do Plano Referencial (Receita/ECD). <b>Vazio para sintética.</b></li>
              <li><b>Nome_Referencial</b> — descrição da conta referencial.</li>
              <li><b>Analitica</b> — Sim (analítica/aceita lançamentos) ou Nao (sintética/agrupadora).</li>
              <li><b>Tipo</b> — ativo, passivo, patrimonio_liquido, receita, despesa ou compensacao.</li>
              <li><b>Natureza</b> — devedora ou credora.</li>
            </ul>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-700 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> {parsedAccounts.length} contas identificadas
            </span>
            <Button variant="outline" size="sm" onClick={() => setStep("upload")}>Voltar</Button>
          </div>
          <div className="rounded-lg border overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 sticky top-0"><tr>
                <th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Conta Ref.</th><th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-center">Analítica</th>
              </tr></thead>
              <tbody>
                {parsedAccounts.map((a, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1 font-mono">{a.code}</td>
                    <td className="p-1">{a.name}</td>
                    <td className="p-1 font-mono text-gray-500">{a.referential_code}</td>
                    <td className="p-1 text-gray-500">{a.account_type}</td>
                    <td className="p-1 text-center">{a.accepts_entries ? "✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Confira os tipos e vínculos antes de importar. Contas já existentes com o mesmo código serão duplicadas.
          </div>
          <Button onClick={handleImport} className="w-full bg-emerald-600 hover:bg-emerald-700">
            Importar {parsedAccounts.length} Contas
          </Button>
        </div>
      )}

      {step === "importing" && (
        <div className="text-center py-8 space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
          <p className="font-medium">Importando... {progress.done} / {progress.total}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-6 space-y-3">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="font-bold text-lg">{progress.done} contas importadas!</p>
          {progress.errors > 0 && <p className="text-sm text-red-500 flex items-center justify-center gap-1"><XCircle className="w-4 h-4" />{progress.errors} com erro</p>}
          <Button onClick={onDone} className="bg-emerald-600 hover:bg-emerald-700">Concluir</Button>
        </div>
      )}
    </div>
  );
}