'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface FilterPreset {
  id: string;
  name: string;
  excludedSources: string[];
  excludeAgents: boolean;
  excludeNoSource: boolean;
  createdAt: number;
}

export interface FilterState {
  // Source filtering
  excludedSources: string[];
  excludeAgents: boolean;
  excludeNoSource: boolean;

  // Available sources (populated from API)
  availableSources: string[];

  // Presets
  presets: FilterPreset[];
  activePresetId: string | null;

  // UI state
  isFilterPanelOpen: boolean;
}

export interface FilterContextType extends FilterState {
  // Source actions
  toggleSourceExclusion: (source: string) => void;
  setExcludedSources: (sources: string[]) => void;
  clearAllSourceExclusions: () => void;
  excludeAllSources: () => void;

  // Agent filtering
  setExcludeAgents: (exclude: boolean) => void;
  setExcludeNoSource: (exclude: boolean) => void;

  // Available sources (from API)
  setAvailableSources: (sources: string[]) => void;

  // Preset management
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  clearActivePreset: () => void;

  // UI actions
  setFilterPanelOpen: (open: boolean) => void;
  toggleFilterPanel: () => void;

  // Utility
  getActiveFilterCount: () => number;
  isSourceExcluded: (source: string) => boolean;
  getFilterParams: () => URLSearchParams;
}

const STORAGE_KEY = 'miramar-dashboard-filters';

const defaultState: FilterState = {
  excludedSources: [],
  excludeAgents: false,
  excludeNoSource: false,
  availableSources: [],
  presets: [],
  activePresetId: null,
  isFilterPanelOpen: false,
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilterState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState(prev => ({
          ...prev,
          excludedSources: parsed.excludedSources || [],
          excludeAgents: parsed.excludeAgents || false,
          excludeNoSource: parsed.excludeNoSource || false,
          presets: parsed.presets || [],
          activePresetId: parsed.activePresetId || null,
        }));
      }
    } catch (e) {
      console.error('Failed to load filter state from localStorage:', e);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage when state changes (after hydration)
  useEffect(() => {
    if (!isHydrated) return;

    try {
      const toStore = {
        excludedSources: state.excludedSources,
        excludeAgents: state.excludeAgents,
        excludeNoSource: state.excludeNoSource,
        presets: state.presets,
        activePresetId: state.activePresetId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
      console.error('Failed to save filter state to localStorage:', e);
    }
  }, [state.excludedSources, state.excludeAgents, state.excludeNoSource, state.presets, state.activePresetId, isHydrated]);

  // Source filtering actions
  const toggleSourceExclusion = useCallback((source: string) => {
    setState(prev => {
      const isExcluded = prev.excludedSources.includes(source);
      return {
        ...prev,
        excludedSources: isExcluded
          ? prev.excludedSources.filter(s => s !== source)
          : [...prev.excludedSources, source],
        activePresetId: null, // Clear active preset when manually changing
      };
    });
  }, []);

  const setExcludedSources = useCallback((sources: string[]) => {
    setState(prev => ({
      ...prev,
      excludedSources: sources,
      activePresetId: null,
    }));
  }, []);

  const clearAllSourceExclusions = useCallback(() => {
    setState(prev => ({
      ...prev,
      excludedSources: [],
      excludeAgents: false,
      excludeNoSource: false,
      activePresetId: null,
    }));
  }, []);

  const excludeAllSources = useCallback(() => {
    setState(prev => ({
      ...prev,
      excludedSources: [...prev.availableSources],
      activePresetId: null,
    }));
  }, []);

  // Agent filtering
  const setExcludeAgents = useCallback((exclude: boolean) => {
    setState(prev => ({
      ...prev,
      excludeAgents: exclude,
      activePresetId: null,
    }));
  }, []);

  const setExcludeNoSource = useCallback((exclude: boolean) => {
    setState(prev => ({
      ...prev,
      excludeNoSource: exclude,
      activePresetId: null,
    }));
  }, []);

  // Available sources
  const setAvailableSources = useCallback((sources: string[]) => {
    setState(prev => ({
      ...prev,
      availableSources: sources,
    }));
  }, []);

  // Preset management
  const savePreset = useCallback((name: string) => {
    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name,
      excludedSources: state.excludedSources,
      excludeAgents: state.excludeAgents,
      excludeNoSource: state.excludeNoSource,
      createdAt: Date.now(),
    };

    setState(prev => ({
      ...prev,
      presets: [...prev.presets, newPreset],
      activePresetId: newPreset.id,
    }));
  }, [state.excludedSources, state.excludeAgents, state.excludeNoSource]);

  const loadPreset = useCallback((presetId: string) => {
    setState(prev => {
      const preset = prev.presets.find(p => p.id === presetId);
      if (!preset) return prev;

      return {
        ...prev,
        excludedSources: preset.excludedSources,
        excludeAgents: preset.excludeAgents,
        excludeNoSource: preset.excludeNoSource,
        activePresetId: presetId,
      };
    });
  }, []);

  const deletePreset = useCallback((presetId: string) => {
    setState(prev => ({
      ...prev,
      presets: prev.presets.filter(p => p.id !== presetId),
      activePresetId: prev.activePresetId === presetId ? null : prev.activePresetId,
    }));
  }, []);

  const clearActivePreset = useCallback(() => {
    setState(prev => ({
      ...prev,
      activePresetId: null,
    }));
  }, []);

  // UI actions
  const setFilterPanelOpen = useCallback((open: boolean) => {
    setState(prev => ({
      ...prev,
      isFilterPanelOpen: open,
    }));
  }, []);

  const toggleFilterPanel = useCallback(() => {
    setState(prev => ({
      ...prev,
      isFilterPanelOpen: !prev.isFilterPanelOpen,
    }));
  }, []);

  // Utility functions
  const getActiveFilterCount = useCallback(() => {
    let count = state.excludedSources.length;
    if (state.excludeAgents) count++;
    if (state.excludeNoSource) count++;
    return count;
  }, [state.excludedSources.length, state.excludeAgents, state.excludeNoSource]);

  const isSourceExcluded = useCallback((source: string) => {
    return state.excludedSources.includes(source);
  }, [state.excludedSources]);

  const getFilterParams = useCallback(() => {
    const params = new URLSearchParams();

    if (state.excludedSources.length > 0) {
      params.set('excludeSources', state.excludedSources.join(','));
    }
    if (state.excludeAgents) {
      params.set('excludeAgents', 'true');
    }
    if (state.excludeNoSource) {
      params.set('excludeNoSource', 'true');
    }

    return params;
  }, [state.excludedSources, state.excludeAgents, state.excludeNoSource]);

  const value: FilterContextType = {
    ...state,
    toggleSourceExclusion,
    setExcludedSources,
    clearAllSourceExclusions,
    excludeAllSources,
    setExcludeAgents,
    setExcludeNoSource,
    setAvailableSources,
    savePreset,
    loadPreset,
    deletePreset,
    clearActivePreset,
    setFilterPanelOpen,
    toggleFilterPanel,
    getActiveFilterCount,
    isSourceExcluded,
    getFilterParams,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
