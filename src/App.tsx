import React, { useState, useMemo } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext.tsx';
import { Product } from './types/inventory.ts';
import { Navbar } from './components/Navbar.tsx';
import { StatsCards } from './components/StatsCards.tsx';
import { ProductCard } from './components/ProductCard.tsx';
import { ProductTableView } from './components/ProductTableView.tsx';
import { StockAdjustModal } from './components/StockAdjustModal.tsx';
import { ProductFormModal } from './components/ProductFormModal.tsx';
import { DeviceManagerModal } from './components/DeviceManagerModal.tsx';
import { AuditLogDrawer } from './components/AuditLogDrawer.tsx';
import { StockOpnameModal } from './components/StockOpnameModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { PinLockScreen } from './components/PinLockScreen.tsx';
import { RealtimeNotificationToasts } from './components/RealtimeNotificationToasts.tsx';
import { 
  Search, 
  LayoutGrid, 
  Table, 
  ArrowUpDown,
  Sliders,
  Lock,
  Store,
  Phone,
  MapPin,
  PackageOpen,
  Plus,
  QrCode
} from 'lucide-react';

function MainDashboard() {
  const { 
    products, 
    isAuthenticated, 
    settings,
    lockApp
  } = useInventory();

  // Dynamic category list based on existing products with manual entry support
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return ['Semua', ...Array.from(set)];
  }, [products]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'safe' | 'low' | 'out'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'stockAsc' | 'stockDesc' | 'updated'>('updated');

  // Modal states
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [adjustModalVariantId, setAdjustModalVariantId] = useState<string | undefined>(undefined);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // If PIN authentication is required and user has not authenticated, show PIN Lock Screen
  if (settings.pinRequired && !isAuthenticated) {
    return <PinLockScreen />;
  }

  // Filter products
  const filteredProducts = products.filter((product) => {
    // Search query matches
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      product.name.toLowerCase().includes(q) ||
      product.sku.toLowerCase().includes(q) ||
      product.location.toLowerCase().includes(q) ||
      product.variants.some((v) => 
        v.size.toLowerCase().includes(q) || 
        v.color.toLowerCase().includes(q) || 
        (v.barcode && v.barcode.includes(q))
      );

    // Category matches
    const matchesCategory =
      selectedCategory === 'Semua' || product.category.toLowerCase().includes(selectedCategory.toLowerCase());

    // Stock Status matches
    let matchesStatus = true;
    if (stockStatusFilter === 'out') {
      matchesStatus = product.totalStock === 0;
    } else if (stockStatusFilter === 'low') {
      matchesStatus = product.totalStock > 0 && product.variants.some((v) => v.stock <= v.minStock);
    } else if (stockStatusFilter === 'safe') {
      matchesStatus = product.totalStock > 0 && product.variants.every((v) => v.stock > v.minStock);
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'stockAsc') {
      return a.totalStock - b.totalStock;
    }
    if (sortBy === 'stockDesc') {
      return b.totalStock - a.totalStock;
    }
    // updated
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleOpenAdjust = (product: Product, variantId?: string) => {
    setAdjustModalProduct(product);
    setAdjustModalVariantId(variantId);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsFormModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FEFCE8] text-slate-800 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navigation & Mobile Bottom Bar */}
      <Navbar
        onOpenDeviceManager={() => setIsDeviceModalOpen(true)}
        onOpenAuditLog={() => setIsAuditLogOpen(true)}
        onOpenOpname={() => setIsOpnameModalOpen(true)}
        onOpenAddProduct={handleOpenAdd}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Main Container (with pb-24 for mobile thumb bar spacing) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 sm:pb-8">
        {/* Boutique Profile Info Sub-banner */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 text-xs bg-white px-3.5 py-2.5 rounded-2xl border border-yellow-200/90 text-slate-600 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Store className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{settings.profile.storeName || 'STZ Fashion'}</span>
              {settings.profile.storeBranch && (
                <span className="text-slate-400 font-normal">({settings.profile.storeBranch})</span>
              )}
            </div>
            {settings.profile.tagline ? (
              <span className="hidden md:inline text-amber-800/70 italic text-[11px]">
                "{settings.profile.tagline}"
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5 text-[11px] text-slate-500">
            {settings.profile.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{settings.profile.phone}</span>
              </span>
            )}
            {settings.profile.address && (
              <span className="hidden sm:flex items-center gap-1 truncate max-w-xs">
                <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="truncate">{settings.profile.address}</span>
              </span>
            )}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-amber-700 hover:text-amber-900 font-bold ml-1 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200 transition-colors"
            >
              {settings.profile.storeName ? 'Edit Profil' : '+ Atur Profil'}
            </button>
          </div>
        </div>

        {/* Analytics Stats Cards */}
        <StatsCards
          onFilterLowStock={() => setStockStatusFilter('low')}
          onFilterOutOfStock={() => setStockStatusFilter('out')}
          onResetFilter={() => setStockStatusFilter('all')}
          activeFilter={stockStatusFilter}
        />

        {/* Filter & Control Bar */}
        <div className="bg-white rounded-2xl border border-yellow-200/90 p-3 sm:p-4 shadow-sm mb-5 space-y-3">
          {/* Search, Sort, and View Mode */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari busana, kode SKU, warna, varian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-12 py-2 sm:py-2.5 text-xs sm:text-sm bg-yellow-50/50 border border-yellow-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-amber-700 hover:text-amber-900"
                >
                  Batal
                </button>
              )}
            </div>

            {/* Sort & View Mode Controls */}
            <div className="flex items-center gap-2 justify-between sm:justify-end">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-yellow-50/50 border border-yellow-200/80 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-800"
                >
                  <option value="updated">Terakhir Diubah</option>
                  <option value="name">Nama Busana (A-Z)</option>
                  <option value="stockAsc">Stok Terendah</option>
                  <option value="stockDesc">Stok Terbanyak</option>
                </select>
              </div>

              {/* Grid / Table Toggle */}
              <div className="flex items-center bg-yellow-50/80 p-0.5 rounded-xl border border-yellow-200/80">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tampilan Kartu Foto"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'table'
                      ? 'bg-amber-400 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tampilan Tabel Rinci"
                >
                  <Table className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Category & Status Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-yellow-100">
            {/* Category Pills (Touch scroll friendly on HP) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-slate-400 font-semibold text-[11px] whitespace-nowrap mr-0.5">
                Kategori:
              </span>
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all text-xs ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-yellow-50 hover:bg-yellow-100 text-slate-700 border border-yellow-200/60'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Stock Status Pills */}
            <div className="flex items-center gap-1.5 shrink-0 text-xs overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setStockStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all whitespace-nowrap ${
                  stockStatusFilter === 'all'
                    ? 'bg-amber-200 text-amber-950 border border-amber-300 font-bold'
                    : 'bg-yellow-50 text-slate-600 hover:bg-yellow-100 border border-yellow-200/60'
                }`}
              >
                Semua Status
              </button>
              <button
                onClick={() => setStockStatusFilter('low')}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all whitespace-nowrap ${
                  stockStatusFilter === 'low'
                    ? 'bg-amber-400 text-amber-950 border border-amber-500 font-bold'
                    : 'bg-yellow-50 text-amber-800 hover:bg-yellow-100 border border-yellow-200/60'
                }`}
              >
                ⚠️ Menipis
              </button>
              <button
                onClick={() => setStockStatusFilter('out')}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all whitespace-nowrap ${
                  stockStatusFilter === 'out'
                    ? 'bg-rose-500 text-white border border-rose-600 font-bold'
                    : 'bg-yellow-50 text-rose-700 hover:bg-yellow-100 border border-yellow-200/60'
                }`}
              >
                ⛔ Habis
              </button>
            </div>
          </div>
        </div>

        {/* Catalog Items Display */}
        {sortedProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-yellow-200 p-8 sm:p-12 text-center shadow-sm">
            <PackageOpen className="w-12 h-12 text-amber-400/80 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Tidak ada produk barang yang sesuai</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Coba sesuaikan kata kunci pencarian atau reset filter status stok.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Semua');
                  setStockStatusFilter('all');
                }}
                className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
              >
                Reset Semua Filter
              </button>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl transition-colors shadow-sm"
              >
                + Tambak Barang Baru
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenAdjust={handleOpenAdjust}
                onOpenEdit={handleOpenEdit}
              />
            ))}
          </div>
        ) : (
          <ProductTableView
            products={sortedProducts}
            onOpenAdjust={handleOpenAdjust}
            onOpenEdit={handleOpenEdit}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-white/90 border-t border-yellow-200 py-5 text-xs text-slate-500 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">{settings.profile.storeName || 'STZ Fashion'}</span>
            <span>•</span>
            <span className="text-amber-800/80">Rekap Barang Keluar / Masuk</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-slate-600 hover:text-amber-700 font-semibold flex items-center gap-1 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Pengaturan & Profil</span>
            </button>
            <button
              onClick={lockApp}
              className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
              title="Kunci layar"
            >
              <Lock className="w-3 h-3" />
              <span>Kunci Aplikasi</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Real-time Notifications */}
      <RealtimeNotificationToasts />

      {/* Modals */}
      {adjustModalProduct && (
        <StockAdjustModal
          product={adjustModalProduct}
          initialVariantId={adjustModalVariantId}
          isOpen={Boolean(adjustModalProduct)}
          onClose={() => {
            setAdjustModalProduct(null);
            setAdjustModalVariantId(undefined);
          }}
        />
      )}

      {isFormModalOpen && (
        <ProductFormModal
          product={editingProduct}
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingProduct(null);
          }}
        />
      )}

      <DeviceManagerModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />

      <AuditLogDrawer
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
      />

      {isOpnameModalOpen && (
        <StockOpnameModal
          isOpen={isOpnameModalOpen}
          onClose={() => setIsOpnameModalOpen(false)}
        />
      )}

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <InventoryProvider>
      <MainDashboard />
    </InventoryProvider>
  );
}
