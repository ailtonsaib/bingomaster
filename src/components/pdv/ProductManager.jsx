import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, Package, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProductForm from "./ProductForm";

export default function ProductManager({ user }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        base44.entities.PDVProduct.filter({ user_email: user.email }, "-created_date", 500),
        base44.entities.PDVCategory.filter({ user_email: user.email, is_active: true }, "name", 100),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (id) => {
    if (!confirm("Excluir este produto?")) return;
    await base44.entities.PDVProduct.delete(id);
    loadData();
  };

  const handleAddCategory = async () => {
    const name = prompt("Nome da nova categoria:");
    if (!name) return;
    await base44.entities.PDVCategory.create({ name, user_email: user.email, is_active: true });
    loadData();
  };

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || "").includes(search)
  );

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-10 w-64" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAddCategory}>+ Categoria</Button>
          <Button onClick={() => { setEditProduct(null); setShowForm(true); }} style={{ backgroundColor: "#EA580C" }}>
            <Plus className="w-4 h-4 mr-1" /> Novo Produto
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2" />
          <p>Nenhum produto cadastrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 bg-gray-50">
                <th className="p-3">Produto</th>
                <th className="p-3">Código</th>
                <th className="p-3 text-right">Preço</th>
                <th className="p-3 text-right">Estoque</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-gray-500">{p.barcode || "-"}</td>
                  <td className="p-3 text-right font-medium">R$ {p.price.toFixed(2).replace(".", ",")}</td>
                  <td className={`p-3 text-right ${p.stock <= (p.min_stock || 0) ? "text-red-600 font-bold" : ""}`}>
                    {p.stock <= (p.min_stock || 0) && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                    {p.stock}
                  </td>
                  <td className="p-3 text-gray-500">{p.category_name || "-"}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => { setEditProduct(p); setShowForm(true); }} className="p-1 hover:bg-gray-200 rounded">
                      <Pencil className="w-4 h-4 text-blue-500" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-gray-200 rounded ml-1">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <ProductForm
          user={user}
          categories={categories}
          product={editProduct}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData(); }}
        />
      )}
    </div>
  );
}