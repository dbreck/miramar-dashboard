'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Filter, Check, ChevronDown, Save, Trash2, RotateCcw, Search, Users, Ban } from 'lucide-react';
import { useFilters } from '@/lib/filter-context';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FilterPanel({ isOpen, onClose }: FilterPanelProps) {
  const {
    excludedSources,
    excludeAgents,
    excludeNoSource,
    availableSources,
    presets,
    activePresetId,
    toggleSourceExclusion,
    setExcludedSources,
    clearAllSourceExclusions,
    setExcludeAgents,
    setExcludeNoSource,
    savePreset,
    loadPreset,
    deletePreset,
    getActiveFilterCount,
    isSourceExcluded,
  } = useFilters();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close panel on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Filter sources by search query
  const filteredSources = availableSources.filter(source =>
    source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort sources: excluded first, then alphabetically
  const sortedSources = [...filteredSources].sort((a, b) => {
    const aExcluded = isSourceExcluded(a);
    const bExcluded = isSourceExcluded(b);
    if (aExcluded && !bExcluded) return -1;
    if (!aExcluded && bExcluded) return 1;
    return a.localeCompare(b);
  });

  const handleSavePreset = () => {
    if (newPresetName.trim()) {
      savePreset(newPresetName.trim());
      setNewPresetName('');
      setShowSavePreset(false);
    }
  };

  const handleQuickExclude = (patterns: string[]) => {
    const sourcesToExclude = availableSources.filter(source =>
      patterns.some(pattern => source.toLowerCase().includes(pattern.toLowerCase()))
    );
    setExcludedSources([...new Set([...excludedSources, ...sourcesToExclude])]);
  };

  const activeFilterCount = getActiveFilterCount();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-out overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Filter Data
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeFilterCount > 0
                  ? `${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`
                  : 'No filters active'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Quick Filters
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickExclude(['agent import', 'import'])}
                className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                Exclude Agent Imports
              </button>
              <button
                onClick={() => handleQuickExclude(['no value', 'unknown', 'none', 'n/a'])}
                className="px-3 py-1.5 text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
              >
                Exclude No Value
              </button>
              <button
                onClick={() => handleQuickExclude(['test', 'demo'])}
                className="px-3 py-1.5 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
              >
                Exclude Test Data
              </button>
            </div>
          </div>

          {/* Toggle Filters */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Contact Filters
            </h3>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Exclude contacts marked as &quot;Agent&quot;
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={excludeAgents}
                  onChange={(e) => setExcludeAgents(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  <Ban className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Exclude contacts with no registration source
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={excludeNoSource}
                  onChange={(e) => setExcludeNoSource(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>

          {/* Registration Sources */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Exclude Registration Sources
              </h3>
              <span className="text-xs text-gray-500">
                {excludedSources.length} of {availableSources.length} excluded
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search sources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Source List */}
            <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {sortedSources.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {searchQuery ? 'No sources match your search' : 'No sources available'}
                </div>
              ) : (
                sortedSources.map((source) => {
                  const excluded = isSourceExcluded(source);
                  return (
                    <button
                      key={source}
                      onClick={() => toggleSourceExclusion(source)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                        excluded
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-sm font-medium truncate pr-2">{source}</span>
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          excluded
                            ? 'bg-red-500 border-red-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {excluded && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Presets */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Filter Presets
            </h3>

            {/* Preset Dropdown */}
            {presets.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <span>
                    {activePresetId
                      ? presets.find(p => p.id === activePresetId)?.name || 'Select preset'
                      : 'Select a saved preset'}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showPresetDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showPresetDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg divide-y divide-gray-100 dark:divide-gray-700">
                    {presets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <button
                          onClick={() => {
                            loadPreset(preset.id);
                            setShowPresetDropdown(false);
                          }}
                          className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300"
                        >
                          <span className="font-medium">{preset.name}</span>
                          <span className="text-gray-500 ml-2">
                            ({preset.excludedSources.length} sources excluded)
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePreset(preset.id);
                          }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save Preset */}
            {showSavePreset ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Preset name..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                  autoFocus
                  className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!newPresetName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowSavePreset(false);
                    setNewPresetName('');
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSavePreset(true)}
                disabled={activeFilterCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Current Filters as Preset
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex gap-3">
            <button
              onClick={clearAllSourceExclusions}
              disabled={activeFilterCount === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Clear All Filters
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
