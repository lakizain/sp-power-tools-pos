import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../context/SupabaseAppContext';
import { DEFAULT_PRICE_RANGES, PriceRange } from '../../types';
import { settingsService } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';

const createRange = (): PriceRange => ({
  id: crypto.randomUUID(),
  minCost: 0,
  maxCost: undefined,
  markupPercentage: 0,
  discountPercentage: 0,
});

export function PriceRanges() {
  const { state, dispatch } = useApp();
  const [ranges, setRanges] = useState<PriceRange[]>(state.settings.priceRanges || DEFAULT_PRICE_RANGES);
  const [isSaving, setIsSaving] = useState(false);

  const updateRange = (id: string, field: keyof PriceRange, value: string) => {
    setRanges(current => current.map(range => range.id === id
      ? { ...range, [field]: value === '' ? (field === 'minCost' ? 0 : undefined) : Number(value) }
      : range));
  };

  const saveRanges = async () => {
    const sortedRanges = [...ranges].sort((a, b) => a.minCost - b.minCost);
    const invalid = sortedRanges.some((range, index) =>
      !Number.isFinite(range.minCost) || !Number.isFinite(range.markupPercentage) || !Number.isFinite(range.discountPercentage) ||
      range.minCost < 0 || range.markupPercentage < 0 || range.discountPercentage < 0 || range.discountPercentage > 100 ||
      (range.maxCost !== undefined && range.maxCost <= range.minCost) ||
      (index > 0 && sortedRanges[index - 1].maxCost !== undefined && range.minCost < sortedRanges[index - 1].maxCost!)
    );
    if (invalid) {
      swalConfig.error('Check the minimum, maximum, and markup values. Ranges must be ordered and must not overlap.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedSettings = await settingsService.update({ priceRanges: sortedRanges });
      dispatch({ type: 'SET_SETTINGS', payload: updatedSettings });
      setRanges(sortedRanges);
      swalConfig.success('Price ranges saved successfully!');
    } catch (error) {
      console.error('Error saving price ranges:', error);
      swalConfig.error('Failed to save price ranges. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Price Ranges</h1>
          <p className="text-gray-600 mt-2">Configure the markup used to suggest sale prices from cost prices.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRanges(current => [...current, createRange()])} className="btn btn-secondary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add range
          </button>
          <button type="button" onClick={saveRanges} disabled={isSaving} className="btn btn-primary flex items-center gap-2">
            <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save ranges'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 bg-gray-50 border-b text-sm font-semibold text-gray-700">
          <span>Minimum cost</span><span>Maximum cost</span><span>Markup percentage</span><span>Discount percentage</span><span />
        </div>
        {ranges.map(range => (
          <div key={range.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 border-b last:border-b-0">
            <input className="input" type="number" min="0" step="0.01" value={range.minCost} onChange={event => updateRange(range.id, 'minCost', event.target.value)} />
            <input className="input" type="number" min="0" step="0.01" placeholder="No limit" value={range.maxCost ?? ''} onChange={event => updateRange(range.id, 'maxCost', event.target.value)} />
            <div className="relative"><input className="input pr-8" type="number" min="0" step="0.01" value={range.markupPercentage} onChange={event => updateRange(range.id, 'markupPercentage', event.target.value)} /><span className="absolute right-3 top-2.5 text-gray-500">%</span></div>
            <div className="relative"><input className="input pr-8" type="number" min="0" step="0.01" value={range.discountPercentage} onChange={event => updateRange(range.id, 'discountPercentage', event.target.value)} /><span className="absolute right-3 top-2.5 text-gray-500">%</span></div>
            <button type="button" onClick={() => setRanges(current => current.filter(item => item.id !== range.id))} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete range"><Trash2 className="h-5 w-5" /></button>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500">A blank maximum means the range continues indefinitely. The first matching range is used when a product cost changes.</p>
    </div>
  );
}