// Montagem de Carga — paletização, saldo WMS por endereço/lote e alocação de separação
export const r2 = v => Math.round((Number(v) || 0) * 100) / 100;

// Paletização: volumes, pallets completos e volumes avulsos.
// Ex: 500 volumes, fator pallet 150, 30 por camada, 5 camadas → 3 pallets + 50 volumes.
export function palletize(qty, product) {
  const q = r2(qty);
  const fator = Number(product?.fator_pallet) || 0;
  const porCamada = Number(product?.volumes_por_camada) || 0;
  if (fator <= 0) return { volumes: q, pallets: 0, loose: q, layers: 0 };
  const pallets = Math.floor(q / fator);
  const loose = r2(q - pallets * fator);
  const layers = porCamada > 0 ? Math.ceil(loose / porCamada) : 0;
  return { volumes: q, pallets, loose, layers };
}

// Saldo WMS por produto + endereço + lote, calculado a partir das movimentações
// (entrada soma, saída subtrai, transferência move entre endereços)
export function computeWmsBalances(moves) {
  const map = new Map();
  const apply = (m, locId, locCode, sign) => {
    if (!m.product_id || !locId) return;
    const lot = m.lot || "";
    const expiry = m.expiry_date || "";
    const key = `${m.product_id}|${lot}|${expiry}|${m.warehouse_id || ""}|${locId}`;
    const cur = map.get(key) || {
      product_id: m.product_id, lot, expiry_date: expiry,
      warehouse_id: m.warehouse_id || "", warehouse_name: m.warehouse_name || "",
      location_id: locId, location_code: locCode || "", qty: 0,
    };
    cur.qty = r2(cur.qty + sign * (Number(m.quantity) || 0));
    map.set(key, cur);
  };
  for (const m of moves || []) {
    if (m.move_type === "entrada") apply(m, m.location_id, m.location_code, 1);
    else if (m.move_type === "saida") apply(m, m.location_id, m.location_code, -1);
    else if (m.move_type === "transferencia") {
      apply(m, m.location_id, m.location_code, -1);
      apply(m, m.target_location_id, m.target_location_code, 1);
    }
  }
  return [...map.values()].filter(b => b.qty > 0.0001);
}

// Aloca a quantidade a separar nos endereços/lotes com saldo — FEFO (validade mais
// próxima primeiro); o que não tem saldo endereçado fica marcado como pendente
export function allocatePick(balances, product, qty) {
  let remaining = r2(qty);
  const sorted = (balances || [])
    .filter(b => b.product_id === product.id)
    .sort((a, b) => (a.expiry_date || "9999-12-31").localeCompare(b.expiry_date || "9999-12-31"));
  const out = [];
  for (const b of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.qty);
    out.push({
      warehouse_name: b.warehouse_name || "",
      location_code: b.location_code || "",
      lot: b.lot || "",
      expiry_date: b.expiry_date || "",
      quantity: r2(take),
      pending: false,
    });
    remaining = r2(remaining - take);
  }
  if (remaining > 0) {
    out.push({ warehouse_name: "", location_code: "", lot: "", expiry_date: "", quantity: remaining, pending: true });
  }
  return out;
}