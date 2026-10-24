import React, { useState } from 'react';
import { Product, ProductVariant } from '../types/inventory.ts';
import { useInventory } from '../context/InventoryContext.tsx';
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  Layers
} from 'lucide-react';

interface ProductFormModalProps {
  product?: Product | null; // if null, mode: ADD; if provided, mode: EDIT
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_IMAGE = '/assets/aistudio/WhatsApp_Image_2026-10-20_at_14.00.08_44e1b065.jpeg';

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const { createProduct, updateProduct, deleteProduct } = useInventory();
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name || '');
  // Kategori dikosongkan secara default agar pengguna bisa input manual
  const [category, setCategory] = useState(product?.category || '');
  // SKU, lokasi, imageUrl, dan deskripsi di-generate di latar belakang atau memakai data tersimpan
  const [sku] = useState(product?.sku || `BRG-${Date.now().toString().slice(-6)}`);
  const [location] = useState(product?.location || 'Gudang Utama');
  const [imageUrl] = useState(product?.imageUrl || DEFAULT_IMAGE);
  const [description] = useState(product?.description || '');

  const [variants, setVariants] = useState<ProductVariant[]>(
    product?.variants || [
      {
        id: `var-new-1`,
        sku: `${sku}-S`,
        size: 'S',
        color: 'Hitam',
        colorHex: '#1E293B',
        stock: 5,
        minStock: 2,
        price: 250000,
        costPrice: 150000,
        barcode: `${Date.now()}1`,
      },
      {
        id: `var-new-2`,
        sku: `${sku}-M`,
        size: 'M',
        color: 'Hitam',
        colorHex: '#1E293B',
        stock: 10,
        minStock: 2,
        price: 250000,
        costPrice: 150000,
        barcode: `${Date.now()}2`,
      },
    ]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddVariant = () => {
    const newIndex = variants.length + 1;
    const newVariant: ProductVariant = {
      id: `var-new-${Date.now()}-${newIndex}`,
      sku: `${sku}-${newIndex}`,
      size: 'L',
      color: 'Putih',
      colorHex: '#F8FAFC',
      stock: 5,
      minStock: 2,
      price: variants[0]?.price || 200000,
      costPrice: variants[0]?.costPrice || 120000,
      barcode: `${Date.now()}${newIndex}`,
    };
    setVariants([...variants, newVariant]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      alert('Produk harus memiliki minimal 1 varian');
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index: number, field: keyof ProductVariant, value: any) => {
    setVariants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nama barang wajib diisi');
      return;
    }

    setIsSubmitting(true);
    const productPayload = {
      name: name.trim(),
      sku: sku.trim(),
      category: category.trim() || 'Umum',
      location: location.trim(),
      imageUrl: imageUrl.trim() || DEFAULT_IMAGE,
      description: description.trim(),
      variants,
    };

    let success = false;
    if (isEdit && product) {
      success = await updateProduct(product.id, productPayload);
    } else {
      success = await createProduct(productPayload);
    }

    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (window.confirm(`Yakin ingin menghapus produk "${product.name}"? Data stok akan dihapus di semua perangkat.`)) {
      setIsSubmitting(true);
      const success = await deleteProduct(product.id);
      setIsSubmitting(false);
      if (success) {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-yellow-200 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-yellow-200/80 flex items-center justify-between bg-slate-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                {isEdit ? 'Edit Data Barang' : 'Tambak Barang'}
              </h2>
              <p className="text-xs text-slate-400">
                Data tersinkron otomatis ke semua perangkat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Basic Details: Nama Barang & Kategori Input Manual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nama Barang *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Kemeja Polos Premium"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Kategori Barang
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ketik kategori manual (opsional)..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
          </div>

          {/* Variants Management */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Varian Ukuran & Warna</h3>
                <p className="text-xs text-slate-500">
                  Tentukan ukuran, warna, jumlah stok fisik, dan batas alarm stok.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddVariant}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Varian</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {variants.map((v, idx) => (
                <div
                  key={v.id || idx}
                  className="p-3 rounded-xl border border-yellow-200/90 bg-yellow-50/40 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end"
                >
                  {/* Size */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Ukuran</label>
                    <input
                      type="text"
                      value={v.size}
                      onChange={(e) => handleVariantChange(idx, 'size', e.target.value)}
                      placeholder="S, M, L, XL"
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Warna</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        value={v.colorHex || '#CBD5E1'}
                        onChange={(e) => handleVariantChange(idx, 'colorHex', e.target.value)}
                        className="w-6 h-7 p-0.5 rounded border border-slate-300 cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={v.color}
                        onChange={(e) => handleVariantChange(idx, 'color', e.target.value)}
                        placeholder="Warna"
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Stock */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Stok (Pcs)</label>
                    <input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) => handleVariantChange(idx, 'stock', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-black text-amber-900"
                    />
                  </div>

                  {/* Min Stock */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Batas Min.</label>
                    <input
                      type="number"
                      min="0"
                      value={v.minStock}
                      onChange={(e) => handleVariantChange(idx, 'minStock', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      title="Batas minimum stok untuk alarm peringatan"
                    />
                  </div>

                  {/* Delete button */}
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      disabled={variants.length <= 1}
                      onClick={() => handleRemoveVariant(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title="Hapus Varian Ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-yellow-200/80 bg-yellow-50/50 flex items-center justify-between">
          <div>
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Produk</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-extrabold transition-all shadow-md shadow-amber-500/25 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambak Barang'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
