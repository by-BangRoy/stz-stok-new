import React, { useState } from 'react';
import { Product, ProductVariant } from '../types/inventory.ts';
import { useInventory } from '../context/InventoryContext.tsx';
import { formatLusin } from '../utils/formatters.ts';
import { 
  SlidersHorizontal, 
  Edit3, 
  AlertTriangle, 
  Plus, 
  Minus, 
  MapPin
} from 'lucide-react';

interface ProductTableViewProps {
  products: Product[];
  onOpenAdjust: (product: Product, variantId?: string) => void;
  onOpenEdit: (product: Product) => void;
}

export const ProductTableView: React.FC<ProductTableViewProps> = ({
  products,
  onOpenAdjust,
  onOpenEdit,
}) => {
  const { adjustStock } = useInventory();
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const handleQuickAdjust = async (product: Product, variant: ProductVariant, delta: number) => {
    if (variant.stock + delta < 0) return;
    setAdjustingId(variant.id);
    const changeType = delta < 0 ? 'sale' : 'restock';
    const reason = delta < 0 ? 'Barang Keluar (Tabel Kasir)' : 'Barang Masuk (Tabel Restock)';
    await adjustStock(product.id, variant.id, delta, changeType, reason);
    setAdjustingId(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-yellow-200/90 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-yellow-50/80 border-b border-yellow-200 text-slate-700 uppercase tracking-wider font-bold text-[11px]">
            <tr>
              <th className="py-3 px-4">Barang</th>
              <th className="py-3 px-4">SKU / Kategori</th>
              <th className="py-3 px-4">Lokasi Rak</th>
              <th className="py-3 px-4">Varian & Stok Fisik</th>
              <th className="py-3 px-4">Total Stok</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-yellow-100/70">
            {products.map((product) => {
              const isOut = product.totalStock === 0;
              const isLow = product.variants.some((v) => v.stock <= v.minStock && v.stock > 0);

              return (
                <tr key={product.id} className="hover:bg-yellow-50/40 transition-colors">
                  {/* Photo & Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-11 h-11 rounded-lg object-cover border border-yellow-200 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{product.name}</div>
                        {product.description && (
                          <div className="text-[11px] text-slate-400 line-clamp-1">{product.description}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* SKU & Category */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-mono font-bold text-slate-900">{product.sku}</div>
                    <span className="inline-block mt-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                      {product.category}
                    </span>
                  </td>

                  {/* Location */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{product.location}</span>
                    </div>
                  </td>

                  {/* Variants */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {product.variants.map((variant) => {
                        const vLow = variant.stock <= variant.minStock && variant.stock > 0;
                        const vOut = variant.stock === 0;

                        return (
                          <div
                            key={variant.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] ${
                              vOut
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : vLow
                                ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                                : 'bg-yellow-50/50 border-yellow-200 text-slate-800'
                            }`}
                          >
                            <span className="font-bold">{variant.size}</span>
                            <span className="text-slate-400">({variant.color})</span>
                            <span className="font-black px-1 rounded bg-white/80">
                              {variant.stock}
                            </span>

                            {/* Mini +/- */}
                            <div className="flex items-center gap-0.5 ml-1">
                              <button
                                disabled={variant.stock <= 0 || adjustingId === variant.id}
                                onClick={() => handleQuickAdjust(product, variant, -1)}
                                className="w-4 h-4 rounded bg-white hover:bg-rose-100 text-slate-600 hover:text-rose-600 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                title="Kurang 1 (Barang Keluar)"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <button
                                disabled={adjustingId === variant.id}
                                onClick={() => handleQuickAdjust(product, variant, 1)}
                                className="w-4 h-4 rounded bg-white hover:bg-emerald-100 text-slate-600 hover:text-emerald-600 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                title="Tambah 1 (Barang Masuk)"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>

                  {/* Total Stock */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {isOut ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-xs font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                          0 pcs (Habis)
                        </span>
                        <span className="text-[11px] font-semibold text-rose-600/80 pl-1">
                          0 lusin
                        </span>
                      </div>
                    ) : isLow ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-xs font-black text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          {product.totalStock} pcs (Menipis)
                        </span>
                        <span className="text-[11px] font-black text-amber-900 pl-1">
                          {formatLusin(product.totalStock)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          {product.totalStock} pcs
                        </span>
                        <span className="text-[11px] font-black text-emerald-700 pl-1">
                          {formatLusin(product.totalStock)}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenAdjust(product)}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                        title="Ubah Stok"
                      >
                        <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                        <span>Stok</span>
                      </button>

                      <button
                        onClick={() => onOpenEdit(product)}
                        className="p-1.5 bg-yellow-100/70 hover:bg-yellow-200 text-slate-700 rounded-lg transition-colors border border-yellow-200/80"
                        title="Edit Busana"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
