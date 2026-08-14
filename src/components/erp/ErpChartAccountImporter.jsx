import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";

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

// Parser da linha do PDF (texto bruto)
// Formato: [Ref] [Grau] [Conta] [Descrição...] [ContaRef] [DescRef...] [Sim/Não] [Função?]
function parsePdfLine(line) {
  line = line.trim();
  if (!line) return null;

  // Detecta linhas de conta: começam com número e têm um código de conta no formato x.x.xx
  // Padrão: opcionalmente ref numérico, grau (1-5), código conta, descrição, código ref, descrição ref, Sim/Não
  const re = /^(\d+)?\s*(\d)\s+([\d.]+)\s+(.+?)\s+([\d.]+)\s+(.+?)\s+(Sim|Não)\s*(.*)$/i;
  const m = line.match(re);
  if (m) {
    const code = m[3];
    const name = m[4].trim();
    const referential_code = m[5];
    const referential_name = m[6].trim();
    const is_sintetica = m[7].toLowerCase() === "sim";
    const account_type = inferAccountType(code);
    return {
      code, name, referential_code, referential_name,
      account_type, nature: inferNature(account_type),
      accepts_entries: !is_sintetica, is_active: true,
    };
  }

  // Linha sintética sem ref (grau 1-4): " 2 1.1 ATIVO CIRCULANTE 1.01 ATIVO CIRCULANTE Sim"
  const re2 = /^(\d)\s+([\d.]+)\s+(.+?)\s+([\d.]+)\s+(.+?)\s+(Sim|Não)\s*$/i;
  const m2 = line.match(re2);
  if (m2) {
    const code = m2[2];
    const name = m2[3].trim();
    const referential_code = m2[4];
    const referential_name = m2[5].trim();
    const is_sintetica = m2[6].toLowerCase() === "sim";
    const account_type = inferAccountType(code);
    return {
      code, name, referential_code, referential_name,
      account_type, nature: inferNature(account_type),
      accepts_entries: !is_sintetica, is_active: true,
    };
  }
  return null;
}

// Processa texto bruto linha a linha
function parseRawText(text) {
  const lines = text.split("\n");
  const accounts = [];
  for (const line of lines) {
    const acc = parsePdfLine(line);
    if (acc && acc.code && acc.name) {
      accounts.push(acc);
    }
  }
  return accounts;
}

export default function ErpChartAccountImporter({ user, onDone }) {
  const [step, setStep] = useState("upload"); // upload | preview | importing | done
  const [rawText, setRawText] = useState("");
  const [parsedAccounts, setParsedAccounts] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [fileUploading, setFileUploading] = useState(false);
  const [llmProcessing, setLlmProcessing] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileUploading(true);
    setLlmProcessing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Extrator nativo de PDF com schema estruturado
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
                  code: { type: "string", description: "Código da conta interna (ex: 1.1.01.01.0001)" },
                  name: { type: "string", description: "Descrição da conta interna" },
                  referential_code: { type: "string", description: "Código da conta referencial (ex: 1.01.01.01.01)" },
                  referential_name: { type: "string", description: "Descrição da conta referencial" },
                  is_sintetica: { type: "boolean", description: "true se for conta sintética (agrupadora), false se analítica" },
                },
              },
            },
          },
        },
      });
      const raw = (res && res.output && res.output.accounts) ? res.output.accounts : [];
      const allAccounts = raw.map(a => ({
        code: a.code,
        name: a.name,
        referential_code: a.referential_code || "",
        referential_name: a.referential_name || "",
        accepts_entries: a.is_sintetica === false || a.is_sintetica === undefined ? true : false,
      }));
      const enriched = allAccounts.filter(a => a.code && a.name).map(a => ({
        ...a,
        account_type: inferAccountType(a.code),
        nature: inferNature(inferAccountType(a.code)),
        is_active: true,
        user_email: user.email,
      }));
      if (enriched.length === 0) {
        alert("Não foi possível extrair contas do PDF. Tente colar o texto bruto manualmente.");
      } else {
        setParsedAccounts(enriched);
        setStep("preview");
      }
    } catch (err) {
      alert("Erro ao processar o PDF: " + (err.message || "tente colar o texto bruto"));
    }
    setLlmProcessing(false);
    setFileUploading(false);
  };

  const handlePasteText = () => {
    const accounts = parseRawText(rawText).map(a => ({ ...a, user_email: user.email }));
    if (accounts.length === 0) { alert("Nenhuma conta encontrada. Verifique o formato do texto."); return; }
    setParsedAccounts(accounts);
    setStep("preview");
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
      <h2 className="font-semibold flex items-center gap-2 text-indigo-700"><FileText className="w-5 h-5" /> Importar Plano de Contas</h2>

      {step === "upload" && (
        <div className="space-y-4">
          {/* Opção 1: PDF */}
          <div className="border-2 border-dashed border-indigo-200 rounded-lg p-6 text-center">
            <Upload className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
            <p className="font-medium text-sm mb-1">Fazer upload do PDF</p>
            <p className="text-xs text-gray-500 mb-3">O sistema extrai automaticamente via IA (gemini)</p>
            <label className="cursor-pointer">
              <span className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700">
                {fileUploading || llmProcessing ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {llmProcessing ? "Processando IA..." : "Enviando..."}</span> : "Selecionar PDF"}
              </span>
              <input type="file" accept=".pdf" className="hidden" onChange={handleFile} disabled={fileUploading || llmProcessing} />
            </label>
          </div>

          <div className="flex items-center gap-2 text-gray-400 text-xs"><div className="flex-1 border-t" />ou cole o texto bruto<div className="flex-1 border-t" /></div>

          {/* Opção 2: Texto bruto */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Cole o conteúdo do PDF (Ctrl+A / Ctrl+C no leitor de PDF)</p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={"1 1 ATIVO 1 ATIVO Sim\n2 1.1 ATIVO CIRCULANTE 1.01 ATIVO CIRCULANTE Sim\n1000 5 1.1.01.01.0001 CAIXA GERAL 1.01.01.01.01 CAIXA MATRIZ Não ..."}
              rows={8}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono"
            />
            <Button onClick={handlePasteText} disabled={!rawText.trim() || fileUploading || llmProcessing} size="sm" variant="outline" className="mt-2">
              Processar Texto Colado
            </Button>
            {(fileUploading || llmProcessing) && (
              <p className="text-xs text-indigo-600 mt-2 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {fileUploading ? "Enviando PDF..." : "Extraindo contas..."}
              </p>
            )}
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
            Confira os tipos e vinculos antes de importar. Contas já existentes com o mesmo código serão duplicadas.
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