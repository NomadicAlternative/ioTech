'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, SlidersHorizontal, Cpu, Cable, Monitor,
  CheckCircle2, AlertTriangle, Rocket, Zap,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Datastream {
  key: string;
  name: string;
  type: string;
  direction: string;
  unit?: string;
  min?: number;
  max?: number;
}

interface CatalogEntry {
  id: string;
  model: string;
  name: string;
  category: 'sensor' | 'actuator' | 'display';
  firmware_status: 'available' | 'untested' | 'planned' | 'deprecated';
  description: string;
  datastreams: Datastream[];
  config_schema: Record<string, unknown> | null;
  icon: string;
  sort_order: number;
}

// ─── Icon mapping ──────────────────────────────────────────────────────────

const categoryIcons: Record<string, typeof Cpu> = {
  sensor: Cpu,
  actuator: Cable,
  display: Monitor,
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; labelKey: string; className: string }> = {
  available: { icon: CheckCircle2, labelKey: 'catalog.status.available', className: 'bg-green-100 text-green-800 border-green-300' },
  untested: { icon: AlertTriangle, labelKey: 'catalog.status.untested', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  planned: { icon: Rocket, labelKey: 'catalog.status.planned', className: 'bg-blue-100 text-blue-800 border-blue-300' },
};

// ─── Component ─────────────────────────────────────────────────────────────

export function CatalogPage() {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/drivers/catalog')
      .then((r) => r.json())
      .then((d) => {
        setCatalog(d.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = catalog
    .filter((d) => !categoryFilter || d.category === categoryFilter)
    .filter((d) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        d.model.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      );
    });

  const categories = ['sensor', 'actuator', 'display'] as const;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('catalog.title', 'Sensor & Driver Catalog')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('catalog.subtitle', 'Browse available sensors, actuators, and displays for your ESP32 devices.')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('catalog.search', 'Search sensors...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <button
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
              !categoryFilter ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'
            }`}
            onClick={() => setCategoryFilter(null)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {t('catalog.all', 'All')}
          </button>
          {categories.map((cat) => {
            const CatIcon = categoryIcons[cat] || Cpu;
            return (
              <button
                key={cat}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                  categoryFilter === cat ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'
                }`}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              >
                <CatIcon className="w-4 h-4" />
                {t(`catalog.category.${cat}`, cat)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-3 text-sm">
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <span key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.className}`}>
              <Icon className="w-3.5 h-3.5" />
              {t(cfg.labelKey, key)}
            </span>
          );
        })}
      </div>

      {/* Catalog grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 space-y-3">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Cpu className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t('catalog.empty', 'No sensors match your search.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((driver) => {
            const status = statusConfig[driver.firmware_status] || statusConfig.planned;
            const StatusIcon = status.icon;
            const CatIcon = categoryIcons[driver.category] || Cpu;
            const isExpanded = expandedId === driver.id;

            return (
              <Card
                key={driver.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  driver.firmware_status === 'planned' ? 'opacity-75' : ''
                }`}
                onClick={() => setExpandedId(isExpanded ? null : driver.id)}
              >
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CatIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                      <h3 className="font-semibold text-sm truncate">{driver.name}</h3>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${status.className}`}>
                      <StatusIcon className="w-3 h-3" />
                      {t(status.labelKey, driver.firmware_status)}
                    </span>
                  </div>

                  {/* Model & description */}
                  <p className="text-xs text-muted-foreground mb-1 font-mono">{driver.model}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{driver.description}</p>

                  {/* OTA message for planned drivers */}
                  {driver.firmware_status === 'planned' && (
                    <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <Zap className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {t('catalog.ota_required', 'This sensor requires a firmware update (OTA, ~30 seconds). Available soon.')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Expanded: datastreams */}
                  {isExpanded && driver.datastreams && driver.datastreams.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                        {t('catalog.datastreams', 'Datastreams')}
                      </p>
                      <div className="space-y-1.5">
                        {driver.datastreams.map((ds) => (
                          <div key={ds.key} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <code className="bg-muted px-1 py-0.5 rounded font-mono text-[11px]">{ds.key}</code>
                              <span className="text-muted-foreground">{ds.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                {ds.type}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 h-5 ${
                                  ds.direction === 'input' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {ds.direction}
                              </Badge>
                              {ds.unit && (
                                <span className="text-muted-foreground font-mono">{ds.unit}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
