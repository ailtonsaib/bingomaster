import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, AlertTriangle, Download } from "lucide-react";
import { buildXlsxBlob, downloadBlob } from "@/lib/excelTemplate";
import { parseXlsxRows } from "@/lib/excelParser";

// ---- Mapeamento de tipos de conta ----
const TYPE_MAP = {
  ativo: "ativo", at: "ativo", a: "ativo",
  passivo: "passivo", pass: "passivo", p: "passivo",
  patrimonio_liquido: "patrimonio_liquido", patrimonio: "patrimonio_liquido", pl: "patrimonio_liquido",
  receita: "receita", rec: "receita", r: "receita",
  despesa: "despesa", desp: "despesa", d: "despesa", despesas: "despesa",
  compensacao: "compensacao", comp: "compensacao", c: "compensacao",
};
function mapAccountType(raw, code) {
  const t = String(raw || "").trim().toLowerCase();
  if (TYPE_MAP[t]) return TYPE_MAP[t];
  // fallback por prefixo do código
  if (!code) return "ativo";
  if (code.startsWith("2.3")) return "patrimonio_liquido";
  if (code.startsWith("2.1") || code.startsWith("2.2")) return "passivo";
  if (code.startsWith("1")) return "ativo";
  if (code.startsWith("3.1.01")) return "receita";
  if (code.startsWith("3")) return "despesa";
  if (code.startsWith("4")) return "despesa";
  return "ativo";
}
function inferNature(account_type) {
  return (account_type === "passivo" || account_type === "patrimonio_liquido" || account_type === "receita") ? "credora" : "devedora";
}
function toBoolSN(v) {
  const s = String(v || "").trim().toLowerCase();
  return s.startsWith("s") || s === "true" || s === "sim" || s === "1";
}
function mapClassInd(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s.includes("insumo")) return "insumos";
  if (s.includes("mao") || s.includes("mão") || s.includes("obra")) return "mao_de_obra";
  if (s === "ggf" || s.includes("geral") || s.includes("indireto")) return "ggf";
  return "nao_aplica";
}
function mapEncerramento(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s.startsWith("s") || s === "sim" || s === "true") return "sim";
  if (s.startsWith("n") && s !== "nao_aplica") return "nao";
  return "nao_aplica";
}

// ---- Cabeçalhos do modelo (igual à planilha do usuário) ----
const HEADERS = [
  "referencia",
  "mascara",
  "Descrição",
  "Nivel Cta Superior",
  "identificacao do nivel",
  "grau",
  "Tipo de Conta",
  "Conta Orçamentária",
  "Usa Centro de Custo",
  "Estrutura de custo",
  "Plano de Contas Referencial",
];

const SAMPLE_ROWS = [
  ["", "1.1", "ATIVO CIRCULANTE", "", "ativo", 2, "Sintética", "N", "N", "nao_aplica", ""],
  ["", "1.1.01", "DISPONIVEL", "1.1", "ativo", 3, "Sintética", "N", "N", "nao_aplica", ""],
  ["1000", "1.1.01.01.0001", "CAIXA", "1.1.01.01", "ativo", 5, "Analítica", "S", "N", "direto", "1.01.01.01.01"],
  ["", "2.3.01.0001", "CAPITAL SOCIAL", "2.3.01", "patrimonio_liquido", 5, "Analítica", "N", "N", "nao_aplica", "2.01.01.01.01"],
  ["", "3.1.01.0001", "RECEITA DE VENDAS", "3.1.01", "receita", 5, "Analítica", "N", "N", "nao_aplica", "3.01.01.01.01"],
];

function mapEstruturaCusto(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s.startsWith("dir")) return "direto";
  if (s.startsWith("ind")) return "indireto";
  return "nao_aplica";
}

const FIELD_ALIASES = {
  code: ["conta", "mascara", "codigo", "codigo_conta"],
  name: ["descricao", "nome", "descricao_conta"],
  referencia: ["referencia", "ref"],
  parent_code: ["nivel_superior", "nivel_cta_superior", "nivel_superior_conta", "conta_pai"],
  identificacao_nivel: ["identificacao_nivel", "identificacao_niveis", "identificacao_do_nivel", "identificacao", "ident_niveis"],
  tipo_conta: ["tipo_conta", "tipo_de_conta", "tipo"],
  grau: ["grau", "nivel"],
  conta_orcamentaria: ["conta_orcamentaria", "orcamentaria"],
  usa_centro_custo: ["usa_centro_custo", "usa_centro_de_custo", "centro_custo"],
  estrutura_custo: ["estrutura_custo", "estrutura_de_custo"],
  referential_code: ["plano_referencial", "plano_de_contas_referencial", "conta_referencia", "conta_ref", "referencia_conta"],
};

function pickField(row, canonical, fallbackKeys = []) {
  for (const a of FIELD_ALIASES[canonical]) {
    if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== "") return String(row[a]).trim();
  }
  for (const k of fallbackKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return "";
}

export default function ErpChartAccountImporter({ user, onDone }) {
  const [step, setStep] = useState("upload");
  const [parsedAccounts, setParsedAccounts] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [fileUploading, setFileUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

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
    const isXls = file.name.toLowerCase().endsWith(".xls") && !file.name.toLowerCase().endsWith(".xlsx");
    if (isXls) {
      if (!confirm("Arquivos .xls (formato antigo) podem não ser lidos pelo extrator. Recomendado: abrir no Excel e 'Salvar Como → .xlsx'. Deseja tentar mesmo assim?")) return;
    }
    setFileUploading(true);
    setExtracting(true);
    try {
      const raw = await parseXlsxRows(file);
      const allAccounts = raw.map(r => {
        const code = pickField(r, "code");
        const name = pickField(r, "name");
        if (!code || !name) return null;
        const identificacaoNivel = pickField(r, "identificacao_nivel");
        const tipoContaRaw = String(pickField(r, "tipo_conta")).trim().toLowerCase();
        let isAnalitica;
        if (tipoContaRaw.startsWith("sint")) isAnalitica = false;
        else if (tipoContaRaw.startsWith("anal")) isAnalitica = true;
        else if (/\.\d{4}$/.test(code)) isAnalitica = true;
        else isAnalitica = false;
        const accepts_entries = isAnalitica;
        const account_type = mapAccountType(identificacaoNivel || "", code);
        const referential_code = isAnalitica ? pickField(r, "referential_code") : "";
        const grauRaw = Number(pickField(r, "grau"));
        const estruturaRaw = pickField(r, "estrutura_custo");
        return {
          code,
          name,
          referencia: pickField(r, "referencia"),
          parent_code: pickField(r, "parent_code"),
          account_type,
          nature: inferNature(account_type),
          grau: Number.isFinite(grauRaw) && grauRaw > 0 ? grauRaw : undefined,
          conta_encerramento: "nao_aplica",
          conta_orcamentaria: toBoolSN(pickField(r, "conta_orcamentaria")),
          usa_centro_custo: toBoolSN(pickField(r, "usa_centro_custo")),
          classificacao_industrial: "nao_aplica",
          estrutura_custo: mapEstruturaCusto(estruturaRaw),
          accepts_entries,
          referential_code,
          referential_name: "",
          is_active: true,
          user_email: user.email,
        };
      }).filter(Boolean);

      if (allAccounts.length === 0) {
        alert("Nenhuma conta válida encontrada. Verifique se o arquivo está no formato .xlsx e contém as colunas 'mascara' e 'Descrição' preenchidas.");
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
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 flex items-center gap-3">
            <Download className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-emerald-800">Baixar modelo padrão</p>
              <p className="text-xs text-emerald-700">Planilha .xlsx com 11 colunas (referencia, mascara, Descrição, Nivel Cta Superior, identificacao do nivel, grau, Tipo de Conta, Conta Orçamentária, Usa Centro de Custo, Estrutura de custo, Plano de Contas Referencial)</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleDownloadTemplate} disabled={generatingTemplate} className="border-emerald-400 text-emerald-700 hover:bg-emerald-100 gap-1.5">
              {generatingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generatingTemplate ? "Gerando..." : "Baixar Modelo"}
            </Button>
          </div>

          <div className="border-2 border-dashed border-indigo-200 rounded-lg p-6 text-center">
            <Upload className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
            <p className="font-medium text-sm mb-1">Enviar planilha preenchida</p>
            <p className="text-xs text-gray-500 mb-3">Formato <b>.xlsx</b> (não .xls). Cole apenas valores, sem fórmulas.</p>
            <label className="cursor-pointer">
              <span className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 inline-flex items-center gap-2">
                {fileUploading || extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> {extracting ? "Extraindo contas..." : "Enviando..."}</> : "Selecionar Excel"}
              </span>
              <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} disabled={fileUploading || extracting} />
            </label>
            {(fileUploading || extracting) && (
              <p className="text-xs text-indigo-600 mt-2 flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {fileUploading ? "Enviando planilha..." : "Extraindo contas..."}
              </p>
            )}
          </div>

          <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700 mb-1">Colunas do modelo:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><b>mascara</b> — código da conta (ex: 1.1.01.01.0001). <b>Obrigatório.</b></li>
              <li><b>Descrição</b> — nome da conta. <b>Obrigatório.</b></li>
              <li><b>identificacao do nivel</b> — grupo/tipo da conta: ativo, passivo, despesa, receita, patrimonio_liquido, compensacao.</li>
              <li><b>Tipo de Conta</b> — Sintética (agrupadora) ou Analítica (aceita lançamentos).</li>
              <li><b>Nivel Cta Superior</b> — código da conta pai.</li>
              <li><b>grau</b> — nível hierárquico (1-5).</li>
              <li><b>Conta Orçamentária / Usa Centro de Custo</b> — S ou N.</li>
              <li><b>Estrutura de custo</b> — direto, indireto ou nao_aplica.</li>
              <li><b>Plano de Contas Referencial</b> — código do Plano Referencial. <b>Vazio para sintética.</b></li>
              <li><b>referencia</b> — referência numérica da conta (ex: 1000). Opcional.</li>
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
                <th className="p-2 text-left">Conta</th><th className="p-2 text-left">Descrição</th>
                <th className="p-2 text-left">Pai</th><th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-center">Analítica</th><th className="p-2 text-left">Conta Ref.</th>
              </tr></thead>
              <tbody>
                {parsedAccounts.map((a, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1 font-mono">{a.code}</td>
                    <td className="p-1">{a.name}</td>
                    <td className="p-1 font-mono text-gray-500">{a.parent_code}</td>
                    <td className="p-1 text-gray-500">{a.account_type}</td>
                    <td className="p-1 text-center">{a.accepts_entries ? "✓" : ""}</td>
                    <td className="p-1 font-mono text-gray-500">{a.referential_code}</td>
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