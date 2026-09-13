import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Search, Loader2, AlertTriangle, ArrowDownCircle, CheckCircle2, FileUp } from "lucide-react";
import ErpWmsReceivingItemCard from "./ErpWmsReceivingItemCard";
import ErpProductFormModal from "./ErpProductFormModal";
import { fmtMoney, fmtDate, UNITS } from "@/lib/erpUtils";
import { parseFiscalXml } from "@/lib/erpXmlParse";

const onlyDigits = (v) => String(v || "").replace(/\D/g, "");
const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

// Recebimento de NF no WMS: busca-se a nota pela chave de acesso (consulta
// direta na SEFAZ via certificado A1) OU importando o XML da NF-e enviado
// pelo fornecedor — fornecedor e produtos vêm da nota autorizada.
// Permite registrar N lotes por produto (fabricação/validade/quantidade),
// sugere o endereço disponível para produtos endereçados e confere a ordem
// de compra do fornecedor — alertando divergências de quantidade e valor.
// Obs.: o saldo do produto é atualizado pelo lançamento da nota no módulo
// Fiscal (com o fator de conversão); aqui são registradas as movimentações
// físicas de entrada com lote e endereçamento.
export default function ErpWmsReceivingPanel({ user }) {
  const [chave, setChave] = useState("");
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState("");
  const [entry, setEntry] = useState(null);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [moves, setMoves] = useState([]);
  const [links, setLinks] = useState([]);
  const [pos, setPos] = useState([]);
  const [state, setState] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [registering, setRegistering] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ErpProduct.filter({ user_email: user.email }, "code", 500),
      base44.entities.ErpWmsLocation.filter({ user_email: user.email, is_active: true }, "code", 500),
      base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500),
      base44.entities.ErpProductSupplier.filter({ user_email: user.email }, "-created_date", 500),
    ]).then(([p, l, m, lk]) => { setProducts(p); setLocations(l); setMoves(m); setLinks(lk); }).catch(() => {});
  }, [user.email]);

  // Ocupação por endereço — saldo das movimentações (entrada/saída/transferência)
  const occupancy = (() => {
    const occ = new Map();
    const add = (id, q) => { if (id) occ.set(id, (occ.get(id) || 0) + q); };
    moves.forEach(m => {
      const q = Number(m.quantity) || 0;
      if (m.move_type === "entrada") add(m.location_id, q);
      else if (m.move_type === "saida") add(m.location_id, -q);
      else { add(m.location_id, -q); add(m.target_location_id, q); }
    });
    return occ;
  })();

  // Fator de conversão do fornecedor da nota (unidade NF → unidade de consumo)
  const factorOf = (productId) => {
    const doc = onlyDigits(entry?.supplier_cnpj);
    const f = Number(links.find(l => l.product_id === productId && (!doc || onlyDigits(l.supplier_document) === doc))?.conversion_factor) || 0;
    return f > 0 ? f : 1;
  };

  // Etapa comum ao obter a nota (consulta SEFAZ ou XML importado): localiza
  // as ordens de compra do fornecedor, vincula os produtos e monta o estado
  // inicial de lotes/endereçamento por item
  const applyNota = async (nota, chaveFallback) => {
    // Ordens de compra do fornecedor (mesmo CNPJ ou mesma razão social)
    const poList = await base44.entities.ErpPurchaseOrder.filter({ user_email: user.email }, "-emission_date", 500);
    const supPos = poList.filter(po => po.status !== "cancelada" &&
      (onlyDigits(po.supplier_cnpj) === onlyDigits(nota.supplier_cnpj) ||
        (po.supplier_name || "").trim().toLowerCase() === (nota.supplier_name || "").trim().toLowerCase()));
    setPos(supPos);
    // Vínculo dos produtos: código do produto no fornecedor (vínculo de
    // fornecedor) → código de barras → código interno do produto
    const items = (nota.items || []).map(it => {
      const link = links.find(l => l.supplier_product_code && l.supplier_product_code === it.product_code &&
        onlyDigits(l.supplier_document) === onlyDigits(nota.supplier_cnpj));
      const prod = (link && products.find(p => p.id === link.product_id)) ||
        (it.barcode && it.barcode !== "SEM GTIN" && products.find(p => p.barcode === it.barcode)) ||
        products.find(p => p.code === it.product_code);
      return { ...it, product_id: prod?.id || "" };
    });
    setEntry({ ...nota, chave_acesso: nota.chave_acesso || chaveFallback || "", items });
    // Estado inicial por item: 1 lote com a quantidade total, endereço
    // disponível sugerido (produto endereçado) e OC do produto selecionada
    setState(items.map(it => {
      const prod = products.find(p => p.id === it.product_id);
      const cands = supPos.filter(po => (po.items || []).some(pit => pit.product_id === it.product_id));
      const autoPo = cands.find(po => po.status === "enviada" || po.status === "recebida_parcial") || cands[0];
      const freeLoc = locations.find(l => !l.capacity || (occupancy.get(l.id) || 0) < l.capacity);
      return {
        lots: [{ lot: "", fabricacao: "", validade: "", quantity: Number(it.quantity) || 0 }],
        location_id: prod?.enderecado ? (freeLoc?.id || "") : "",
        po_id: autoPo?.id || "",
      };
    }));
  };

  const handleSearch = async () => {
    const key = onlyDigits(chave);
    if (key.length !== 44) { setNotFound("Informe a chave de acesso da NF-e (44 dígitos)."); return; }
    setSearching(true); setNotFound(""); setEntry(null); setState([]); setDone(false);
    try {
      // Consulta a nota diretamente na SEFAZ (Distribuição de Documentos Fiscais)
      const resp = await base44.functions.invoke("consultarNfeSefaz", { chave: key });
      const data = resp.data || {};
      if (!data.success || !data.nota) {
        setNotFound(data.xMotivo || data.error || "Nota não localizada na SEFAZ.");
        setSearching(false);
        return;
      }
      await applyNota(data.nota, key);
    } catch (e) {
      setNotFound("Erro na consulta à SEFAZ: " + (e?.response?.data?.error || e?.message || e));
    }
    setSearching(false);
  };

  // Importação do XML da NF-e (procNFe) — alternativa à consulta SEFAZ quando
  // o fornecedor envia o arquivo; traz fornecedor, produtos e totais do XML
  const handleXmlImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSearching(true); setNotFound(""); setEntry(null); setState([]); setDone(false);
    try {
      const parsed = parseFiscalXml(await file.text());
      if ((parsed.model !== "55" && parsed.model !== "65") || !parsed.items?.length) {
        throw new Error("importe um XML de NF-e (procNFe) com itens de produto.");
      }
      const nota = {
        from_xml: true,
        chave_acesso: parsed.nota.chave_acesso,
        nota_number: parsed.nota.number,
        nota_series: parsed.nota.series,
        issue_date: parsed.nota.issue_date,
        supplier_name: parsed.supplier.name,
        supplier_cnpj: parsed.supplier.cpf_cnpj,
        total_nota: parsed.totals.total_nota,
        items: parsed.items,
      };
      if (nota.chave_acesso) setChave(nota.chave_acesso);
      await applyNota(nota, "");
    } catch (err) {
      setNotFound("Erro ao importar o XML: " + err.message);
    }
    setSearching(false);
  };

  // Item sem produto cadastrado: abre o cadastro do produto já preenchido com
  // os dados da nota (nome, NCM, código de barras, unidade)
  const handleRegisterProduct = (i) => {
    const it = (entry.items || [])[i];
    if (!it) return;
    setRegistering({
      index: i,
      prefill: {
        name: it.product_name || "",
        code: it.product_code || "",
        barcode: it.barcode && it.barcode !== "SEM GTIN" ? it.barcode : "",
        ncm: it.ncm || "",
        unit: UNITS.includes(it.unit) ? it.unit : "UN",
      },
    });
  };

  // Produto cadastrado: vincula automaticamente ao item da nota
  const handleProductSaved = (saved) => {
    setProducts(p => [...p, saved]);
    setEntry(e => e ? { ...e, items: e.items.map((it, idx) => idx === registering.index ? { ...it, product_id: saved.id } : it) } : e);
    setRegistering(null);
  };

  // Divergência quantidade/valor do item em relação à OC selecionada
  const divergenceOf = (i) => {
    const it = (entry.items || [])[i];
    const st = state[i];
    if (!it?.product_id || !st?.po_id) return null;
    const po = pos.find(p => p.id === st.po_id);
    const poItem = (po?.items || []).find(x => x.product_id === it.product_id);
    if (!poItem) return null;
    const factor = factorOf(it.product_id);
    const nfQtyConv = (Number(it.quantity) || 0) * factor;
    const nfUnitConv = factor > 0 ? (Number(it.unit_price) || 0) / factor : 0;
    const qtyOk = Math.abs(nfQtyConv - (Number(poItem.quantity) || 0)) < 0.001;
    const valOk = Math.abs(nfUnitConv - (Number(poItem.unit_cost) || 0)) < 0.01;
    return { po, poItem, nfQtyConv, nfUnitConv, qtyOk, valOk, ok: qtyOk && valOk };
  };
  const divergences = entry ? (entry.items || []).map((_, i) => divergenceOf(i)).filter(d => d && !d.ok) : [];

  const handleSave = async () => {
    const items = entry.items || [];
    const errors = [];
    const toCreate = [];
    items.forEach((it, i) => {
      const st = state[i];
      const prod = products.find(p => p.id === it.product_id);
      if (!prod) { errors.push(`Item "${it.product_name}" sem produto cadastrado — vincule o produto na entrada fiscal.`); return; }
      if (prod.controla_estoque === false) return;
      const factor = factorOf(prod.id);
      const lotSum = (st?.lots || []).reduce((s, l) => s + (Number(l.quantity) || 0), 0);
      if (Math.abs(lotSum - (Number(it.quantity) || 0)) > 0.001) errors.push(`"${prod.name}": a soma dos lotes (${lotSum}) deve ser igual à quantidade da NF (${it.quantity}).`);
      if (prod.controla_lote && (st?.lots || []).some(l => !String(l.lot || "").trim())) errors.push(`"${prod.name}": informe o número do lote (produto com controle de lote).`);
      if (prod.enderecado && !st?.location_id) errors.push(`"${prod.name}": selecione o endereço de armazenagem (produto endereçado).`);
      (st?.lots || []).forEach(l => {
        if ((Number(l.quantity) || 0) > 0) toCreate.push({ it, prod, factor, lot: l, st });
      });
    });
    if (errors.length) { alert("Corrija antes de confirmar o recebimento:\n\n" + errors.map(e => "• " + e).join("\n")); return; }
    // Divergências: alerta e confirmação — o recebimento não é bloqueado
    if (divergences.length) {
      const msg = divergences.map(d => `• ${d.poItem.product_name}: quantidade NF ${r3(d.nfQtyConv)} x OC ${d.poItem.quantity} • valor NF ${fmtMoney(d.nfUnitConv)} x OC ${fmtMoney(d.poItem.unit_cost)}`).join("\n");
      if (!confirm(`⚠ Existem ${divergences.length} item(ns) com DIVERGÊNCIA em relação à ordem de compra:\n\n${msg}\n\nDeseja confirmar o recebimento mesmo assim?`)) return;
    }
    const docTag = `NF ${entry.nota_number}`;
    if (moves.some(m => (m.document || "").includes(docTag))) {
      if (!confirm(`Já existem movimentações de recebimento para a ${docTag}. Confirmar novamente pode duplicar os registros. Prosseguir?`)) return;
    }
    setSaving(true);
    try {
      const locById = new Map(locations.map(l => [l.id, l]));
      await base44.entities.ErpWmsMove.bulkCreate(toCreate.map(({ it, prod, factor, lot, st }) => {
        const loc = locById.get(st.location_id);
        return {
          user_email: user.email,
          move_type: "entrada",
          product_id: prod.id,
          product_code: prod.code || it.product_code || "",
          product_name: prod.name,
          unit: prod.unit || "",
          quantity: r3((Number(lot.quantity) || 0) * factor),
          warehouse_id: loc?.warehouse_id || "",
          warehouse_name: loc?.warehouse_name || "",
          location_id: loc?.id || "",
          location_code: loc?.code || "",
          lot: lot.lot || "",
          fabricacao_date: lot.fabricacao || "",
          expiry_date: lot.validade || "",
          document: docTag,
          move_date: new Date().toISOString(),
          notes: `Recebimento WMS — ${entry.supplier_name || ""} (chave ${onlyDigits(entry.chave_acesso)})`,
        };
      }));
      const fresh = await base44.entities.ErpWmsMove.filter({ user_email: user.email }, "-created_date", 500);
      setMoves(fresh);
      // Pré-cadastra a nota no módulo Fiscal (Entrada de NF): a entrada fica
      // aberta aguardando o usuário informar a operação e os demais dados —
      // somente após concluída alimenta estoque, contábil e financeiro
      let draftMsg = "a nota foi pré-cadastrada no módulo Fiscal (Entrada de NF), aguardando a operação de entrada e os demais dados";
      try {
        const key = onlyDigits(entry.chave_acesso);
        const existing = await base44.entities.ErpFiscalEntry.filter({ user_email: user.email }, "-created_date", 500);
        const dup = existing.find(e => (key && onlyDigits(e.chave_acesso) === key) ||
          (String(e.nota_number) === String(entry.nota_number) && onlyDigits(e.supplier_cnpj) === onlyDigits(entry.supplier_cnpj) && onlyDigits(entry.supplier_cnpj).length >= 11));
        if (dup) {
          draftMsg = "já existe entrada registrada para esta nota no módulo Fiscal — nada foi duplicado";
        } else {
          const r2v = (v) => Math.round((Number(v) || 0) * 100) / 100;
          await base44.entities.ErpFiscalEntry.create({
            user_email: user.email,
            nota_model: entry.nota_model || "55",
            nota_number: String(entry.nota_number || ""),
            nota_series: entry.nota_series || "",
            chave_acesso: key,
            issue_date: entry.issue_date ? new Date(entry.issue_date).toISOString() : new Date().toISOString(),
            entry_date: new Date().toISOString(),
            supplier_name: entry.supplier_name || "",
            supplier_cnpj: entry.supplier_cnpj || "",
            supplier_uf: entry.supplier_uf || "",
            nature_operation: entry.nature_operation || "",
            cfop: entry.cfop || "",
            total_products: r2v(items.reduce((s, it) => s + (Number(it.total) || 0), 0)),
            total_nota: r2v(entry.total_nota),
            items: items.map(it => ({
              product_id: it.product_id || undefined,
              product_code: it.product_code || "",
              barcode: it.barcode || "",
              product_name: it.product_name || "",
              ncm: it.ncm || "",
              cfop: it.cfop || "",
              unit: it.unit || "",
              quantity: Number(it.quantity) || 0,
              unit_price: Number(it.unit_price) || 0,
              total: Number(it.total) || 0,
            })),
            status: "pendente",
            approval_status: "nao_aplica",
            awaiting_completion: true,
            notes: "Pré-cadastro gerado pelo Recebimento WMS — informe a operação de entrada e os demais dados no módulo Fiscal (Entrada de NF).",
          });
        }
      } catch (e) {
        draftMsg = `não foi possível pré-cadastrar a nota no módulo Fiscal (${e.message})`;
      }
      setDone(true);
      alert(`Recebimento confirmado: ${toCreate.length} movimentação(ões) de entrada registradas com lote e endereçamento.\n\nPré-cadastro Fiscal: ${draftMsg}.`);
    } catch (e) { alert("Erro ao confirmar recebimento: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base flex items-center gap-2"><ArrowDownCircle className="w-5 h-5 text-emerald-600" /> Recebimento de Nota Fiscal (WMS)</h2>
      <p className="text-xs text-gray-500 -mt-1">Busque a nota pela chave de acesso (consulta direta na SEFAZ via certificado A1) ou importe o XML da NF-e enviado pelo fornecedor — o sistema traz o fornecedor e os produtos da nota. Registre os lotes (fabricação/validade), enderece os produtos e confira a ordem de compra. Ao confirmar, a nota é pré-cadastrada no módulo Fiscal (Entrada de NF), aberta para você informar a operação e os demais dados — somente após concluída ela alimenta os módulos (estoque, contábil e financeiro).</p>

      <div className="flex gap-2">
        <input
          value={chave}
          onChange={e => setChave(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="Chave de acesso da NF-e (44 dígitos)"
          className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm font-mono"
        />
        <Button size="sm" onClick={handleSearch} disabled={searching} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
        </Button>
        <input ref={fileRef} type="file" accept=".xml,text/xml" className="hidden" onChange={handleXmlImport} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={searching} className="gap-1.5 whitespace-nowrap">
          <FileUp className="w-4 h-4" /> Importar XML
        </Button>
      </div>

      {notFound && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3"><AlertTriangle className="w-4 h-4" /> {notFound}</div>
      )}

      {entry && (
        <>
          <div className="bg-white rounded-xl border p-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            <div className="col-span-2"><p className="text-xs text-gray-500">Fornecedor</p><p className="font-medium">{entry.supplier_name}</p></div>
            <div><p className="text-xs text-gray-500">CNPJ</p><p>{entry.supplier_cnpj || "—"}</p></div>
            <div><p className="text-xs text-gray-500">Emissão</p><p>{fmtDate(entry.issue_date)}</p></div>
            <div><p className="text-xs text-gray-500">Total NF</p><p className="font-bold text-indigo-700">{fmtMoney(entry.total_nota)}</p></div>
            <div className="col-span-2 md:col-span-5"><p className="text-xs text-gray-500">Documento</p><p className="text-xs font-mono">NF {entry.nota_number}{entry.nota_series ? ` (série ${entry.nota_series})` : ""} — chave {onlyDigits(entry.chave_acesso)}{entry.from_xml ? " (dados importados do XML do fornecedor)" : " (dados consultados na SEFAZ)"}</p></div>
          </div>

          {divergences.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><b>{divergences.length} item(ns) com divergência</b> de quantidade/valor em relação à ordem de compra — confira o detalhe em cada item antes de confirmar.</span>
            </div>
          )}

          <div className="space-y-2">
            {(entry.items || []).map((it, i) => {
              const prod = products.find(p => p.id === it.product_id);
              const factor = prod ? factorOf(prod.id) : 1;
              const poOptions = pos.filter(po => (po.items || []).some(pit => pit.product_id === it.product_id));
              const st = state[i] || { lots: [], location_id: "", po_id: "" };
              return (
                <ErpWmsReceivingItemCard
                  key={i}
                  item={it}
                  product={prod}
                  factor={factor}
                  poOptions={poOptions}
                  poId={st.po_id}
                  onPoChange={v => setState(p => p.map((s, idx) => idx === i ? { ...s, po_id: v } : s))}
                  divergence={divergenceOf(i)}
                  lots={st.lots}
                  onLotsChange={lots => setState(p => p.map((s, idx) => idx === i ? { ...s, lots } : s))}
                  locationId={st.location_id}
                  onLocationChange={v => setState(p => p.map((s, idx) => idx === i ? { ...s, location_id: v } : s))}
                  locations={locations}
                  occupancy={occupancy}
                  onRegisterProduct={() => handleRegisterProduct(i)}
                />
              );
            })}
          </div>

          {done ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3"><CheckCircle2 className="w-4 h-4" /> Recebimento confirmado — movimentações de entrada registradas na aba Movimentações. A nota está aberta no módulo Fiscal (Entrada de NF) aguardando a operação de entrada e os demais dados.</div>
          ) : (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownCircle className="w-4 h-4" />} Confirmar Recebimento
              </Button>
            </div>
          )}
        </>
      )}

      {registering && (
        <ErpProductFormModal
          user={user}
          product={registering.prefill}
          onClose={() => setRegistering(null)}
          onSaved={handleProductSaved}
        />
      )}
    </div>
  );
}