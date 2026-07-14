import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "lucide-react";

export default function CitySelect({ form, setForm }) {
  const [query, setQuery] = useState(form.city || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setQuery(form.city || "");
  }, [form.city]);

  const search = async (term) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      let cities;
      if (form.uf) {
        cities = await base44.entities.PDVCity.filter({
          uf: form.uf,
        });
        cities = cities.filter((c) =>
          c.name.toLowerCase().includes(term.toLowerCase())
        );
      } else {
        cities = await base44.entities.PDVCity.filter({});
        cities = cities.filter((c) =>
          c.name.toLowerCase().includes(term.toLowerCase())
        );
      }
      setResults(cities.slice(0, 50));
    } catch (e) {
      setResults([]);
    }
    setLoading(false);
  };

  const handleChange = (value) => {
    setQuery(value);
    setForm({ ...form, city: value, ibge_code: "" });
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const selectCity = (city) => {
    setQuery(city.name);
    setForm({
      ...form,
      city: city.name,
      uf: city.uf,
      ibge_code: city.ibge_code,
    });
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <Label>Município</Label>
      <div className="relative">
        <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="h-9 pl-8"
          placeholder="Digite o nome da cidade..."
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((city) => (
            <button
              key={city.id}
              type="button"
              onMouseDown={() => selectCity(city)}
              className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{city.name}</span>
                <span className="text-xs text-gray-400 font-mono">{city.uf}</span>
              </div>
              <span className="text-xs text-gray-400 font-mono">IBGE: {city.ibge_code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}