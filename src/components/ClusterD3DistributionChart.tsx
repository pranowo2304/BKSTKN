import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { formatIDR } from '../lib/storage';
import { BarChart3, Grid, ArrowUpDown, Users, Building2, ArrowRight } from 'lucide-react';

export interface ClusterDistributionStat {
  id: string;
  cluster: string;
  code: string;
  rtNumber: string;
  leaderName: string;
  leaderPhone: string;
  leaderEmail: string;
  addressCoverage: string;
  activeCount: number;
  pendingCount: number;
  inProcessCount: number;
  totalCount: number;
  activeDependents: number;
  activeSouls: number;
  totalDependents: number;
  totalSouls: number;
  totalCollected: number;
  percentage: number;
  registeredPercentage: number;
  rank: number;
}

interface ClusterD3DistributionChartProps {
  clusterStats: ClusterDistributionStat[];
  activeMembersCount: number;
  totalMembersCount: number;
  onNavigateToMembers?: () => void;
}

type VisualizationMode = 'heatmap' | 'barchart';
type MetricKey = 'activeCount' | 'totalCount' | 'souls' | 'totalCollected';
type SortOrder = 'master' | 'active-desc' | 'total-desc';

export const ClusterD3DistributionChart: React.FC<ClusterD3DistributionChartProps> = ({
  clusterStats,
  activeMembersCount,
  totalMembersCount,
  onNavigateToMembers,
}) => {
  const [vizMode, setVizMode] = useState<VisualizationMode>('heatmap');
  const [metricKey, setMetricKey] = useState<MetricKey>('activeCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('master');
  const [selectedClusterName, setSelectedClusterName] = useState<string | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    subtitle: string;
    valueText: string;
    extraText?: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(860);

  // Observe container width for responsive D3 SVG rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };
    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sorted dataset based on user control
  const sortedStats = useMemo(() => {
    const list = [...clusterStats];
    if (sortOrder === 'active-desc') {
      return list.sort((a, b) => b.activeCount - a.activeCount || b.totalCount - a.totalCount);
    }
    if (sortOrder === 'total-desc') {
      return list.sort((a, b) => b.totalCount - a.totalCount || b.activeCount - a.activeCount);
    }
    return list;
  }, [clusterStats, sortOrder]);

  const selectedStat = useMemo(() => {
    if (!selectedClusterName) return sortedStats[0] || null;
    return sortedStats.find((s) => s.cluster === selectedClusterName) || sortedStats[0] || null;
  }, [sortedStats, selectedClusterName]);

  const getMetricValue = (stat: ClusterDistributionStat, key: MetricKey): number => {
    if (key === 'activeCount') return stat.activeCount;
    if (key === 'totalCount') return stat.totalCount;
    if (key === 'souls') return stat.activeCount > 0 ? stat.activeSouls : stat.totalSouls;
    return stat.totalCollected;
  };

  const formatMetricValue = (val: number, key: MetricKey): string => {
    if (key === 'totalCollected') return formatIDR(val);
    if (key === 'souls') return `${val} Jiwa`;
    if (key === 'totalCount') return `${val} KK`;
    return `${val} Aktif`;
  };

  // Render D3 Visualization whenever mode, data, metric, sort, or width changes
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || sortedStats.length === 0) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = Math.max(320, containerWidth);
    const isCompact = width < 640;

    if (vizMode === 'heatmap') {
      // =======================================================================
      // MODE 1: D3.js INTERACTIVE CLUSTER HEATMAP (TERRITORY + MATRIX)
      // =======================================================================
      const rows = [
        { id: 'active', label: 'Warga Aktif (KK)', getter: (d: ClusterDistributionStat) => d.activeCount, unit: 'Aktif' },
        { id: 'total', label: 'Total Database (KK)', getter: (d: ClusterDistributionStat) => d.totalCount, unit: 'KK' },
        {
          id: 'souls',
          label: 'Jiwa Tertanggung',
          getter: (d: ClusterDistributionStat) => (d.activeCount > 0 ? d.activeSouls : d.totalSouls),
          unit: 'Jiwa',
        },
        {
          id: 'process',
          label: 'Proses / Antrean',
          getter: (d: ClusterDistributionStat) => d.pendingCount + d.inProcessCount,
          unit: 'Warga',
        },
      ];

      const margin = {
        top: 44,
        right: 20,
        bottom: 36,
        left: isCompact ? 115 : 155,
      };
      const cellHeight = isCompact ? 46 : 52;
      const innerHeight = rows.length * cellHeight;
      const height = margin.top + innerHeight + margin.bottom;
      const innerWidth = Math.max(180, width - margin.left - margin.right);

      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('height', height);

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const clusterNames = sortedStats.map((d) => d.cluster);
      const xScale = d3.scaleBand<string>().domain(clusterNames).range([0, innerWidth]).padding(0.12);
      const yScale = d3
        .scaleBand<string>()
        .domain(rows.map((r) => r.id))
        .range([0, innerHeight])
        .padding(0.16);

      // Column headers (Cluster short names + RT numbers)
      const colHeaderGroup = g.append('g').attr('transform', 'translate(0, -12)');
      sortedStats.forEach((stat) => {
        const cx = (xScale(stat.cluster) || 0) + xScale.bandwidth() / 2;
        const shortName = stat.cluster.replace(/^Cluster\s+/i, '');
        const isSelected = selectedStat?.cluster === stat.cluster;

        const headerG = colHeaderGroup
          .append('g')
          .attr('transform', `translate(${cx}, 0)`)
          .style('cursor', 'pointer')
          .on('click', () => setSelectedClusterName(stat.cluster));

        headerG
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -12)
          .attr('fill', isSelected ? '#047857' : '#0f172a')
          .attr('font-size', isCompact ? '10px' : '11px')
          .attr('font-weight', isSelected ? '800' : '700')
          .text(isCompact && shortName.length > 10 ? `${shortName.slice(0, 9)}…` : shortName);

        headerG
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 2)
          .attr('fill', '#64748b')
          .attr('font-size', '9.5px')
          .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
          .text(stat.rtNumber || stat.code || '');
      });

      // Row labels
      rows.forEach((row) => {
        const cy = (yScale(row.id) || 0) + yScale.bandwidth() / 2;
        g.append('text')
          .attr('x', -12)
          .attr('y', cy)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .attr('fill', '#334155')
          .attr('font-size', isCompact ? '10.5px' : '11.5px')
          .attr('font-weight', row.id === 'active' ? '700' : '600')
          .text(row.label);
      });

      // Draw Heatmap Cells per Row using D3 sequential color scale normalized per metric row
      rows.forEach((row) => {
        const rowValues = sortedStats.map((s) => row.getter(s));
        const maxVal = Math.max(...rowValues, 1);

        // Custom color interpolator: soft slate for 0, warm amber for process row, emerald/teal for active/total/souls
        const colorScale =
          row.id === 'process'
            ? d3.scaleSequential<string>().domain([0, maxVal]).interpolator(d3.interpolateRgb('#fef3c7', '#d97706'))
            : d3.scaleSequential<string>().domain([0, maxVal]).interpolator(d3.interpolateRgb('#d1fae5', '#047857'));

        sortedStats.forEach((stat) => {
          const val = row.getter(stat);
          const x = xScale(stat.cluster) || 0;
          const y = yScale(row.id) || 0;
          const bw = xScale.bandwidth();
          const bh = yScale.bandwidth();
          const isZero = val === 0;
          const fillColor = isZero ? '#f8fafc' : colorScale(val);
          const isDarkCell = !isZero && val / maxVal >= 0.55;
          const isSelected = selectedStat?.cluster === stat.cluster;

          const cellGroup = g
            .append('g')
            .attr('transform', `translate(${x}, ${y})`)
            .style('cursor', 'pointer')
            .on('click', () => {
              setSelectedClusterName(stat.cluster);
            })
            .on('mouseenter', (event: MouseEvent) => {
              const rect = svgEl.getBoundingClientRect();
              setHoveredTooltip({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top - 12,
                title: `${stat.cluster} ${stat.rtNumber ? `(${stat.rtNumber})` : ''}`,
                subtitle: row.label,
                valueText: `${val} ${row.unit}`,
                extraText: `Aktif: ${stat.activeCount} KK (${stat.percentage}%) • Database: ${stat.totalCount} KK`,
              });
            })
            .on('mouseleave', () => {
              setHoveredTooltip(null);
            });

          cellGroup
            .append('rect')
            .attr('width', bw)
            .attr('height', bh)
            .attr('rx', 8)
            .attr('ry', 8)
            .attr('fill', fillColor)
            .attr('stroke', isSelected ? '#0f172a' : isZero ? '#e2e8f0' : '#a7f3d0')
            .attr('stroke-width', isSelected ? 2 : 1);

          cellGroup
            .append('text')
            .attr('x', bw / 2)
            .attr('y', bh / 2 - (row.id === 'active' && !isCompact ? 4 : 0))
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('fill', isZero ? '#94a3b8' : isDarkCell ? '#ffffff' : '#064e3b')
            .attr('font-size', isCompact ? '11px' : '13px')
            .attr('font-weight', '800')
            .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
            .text(String(val));

          if (row.id === 'active' && !isCompact) {
            cellGroup
              .append('text')
              .attr('x', bw / 2)
              .attr('y', bh / 2 + 11)
              .attr('dy', '0.35em')
              .attr('text-anchor', 'middle')
              .attr('fill', isZero ? '#cbd5e1' : isDarkCell ? '#d1fae5' : '#047857')
              .attr('font-size', '9.5px')
              .attr('font-weight', '600')
              .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
              .text(`${stat.percentage}%`);
          }
        });
      });
    } else {
      // =======================================================================
      // MODE 2: D3.js DYNAMIC BAR CHART (GROUPED / METRIC COMPARISON)
      // =======================================================================
      const margin = {
        top: 32,
        right: 24,
        bottom: isCompact ? 62 : 48,
        left: metricKey === 'totalCollected' ? 88 : 48,
      };
      const height = 290;
      const innerWidth = Math.max(200, width - margin.left - margin.right);
      const innerHeight = height - margin.top - margin.bottom;

      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('height', height);
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const clusterNames = sortedStats.map((d) => d.cluster);
      const xScale = d3.scaleBand<string>().domain(clusterNames).range([0, innerWidth]).padding(0.28);

      const values = sortedStats.map((d) => getMetricValue(d, metricKey));
      const maxVal = Math.max(
        ...values,
        metricKey === 'activeCount' ? Math.max(...sortedStats.map((d) => d.totalCount), 4) : 4
      );

      const yScale = d3.scaleLinear().domain([0, maxVal * 1.15]).nice().range([innerHeight, 0]);

      // Horizontal Grid Lines
      const yTicks = yScale.ticks(5);
      yTicks.forEach((tickVal) => {
        const yPos = yScale(tickVal);
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerWidth)
          .attr('y1', yPos)
          .attr('y2', yPos)
          .attr('stroke', '#f1f5f9')
          .attr('stroke-width', 1);

        g.append('text')
          .attr('x', -8)
          .attr('y', yPos)
          .attr('dy', '0.32em')
          .attr('text-anchor', 'end')
          .attr('fill', '#64748b')
          .attr('font-size', '10px')
          .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
          .text(
            metricKey === 'totalCollected'
              ? tickVal >= 1000000
                ? `${(tickVal / 1000000).toFixed(1)}Jt`
                : tickVal >= 1000
                ? `${Math.round(tickVal / 1000)}Rb`
                : String(tickVal)
              : String(Math.round(tickVal))
          );
      });

      // Baseline
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', innerHeight)
        .attr('y2', innerHeight)
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 1);

      // Color scale for bars
      const barColorScale = d3
        .scaleSequential<string>()
        .domain([0, Math.max(...values, 1)])
        .interpolator(d3.interpolateRgb('#10b981', '#047857'));

      sortedStats.forEach((stat) => {
        const x = xScale(stat.cluster) || 0;
        const bw = xScale.bandwidth();
        const primaryVal = getMetricValue(stat, metricKey);
        const barY = yScale(primaryVal);
        const barH = Math.max(4, innerHeight - barY);
        const isSelected = selectedStat?.cluster === stat.cluster;

        const barGroup = g
          .append('g')
          .style('cursor', 'pointer')
          .on('click', () => setSelectedClusterName(stat.cluster))
          .on('mouseenter', (event: MouseEvent) => {
            const rect = svgEl.getBoundingClientRect();
            setHoveredTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top - 12,
              title: `${stat.cluster} ${stat.rtNumber ? `(${stat.rtNumber})` : ''}`,
              subtitle:
                metricKey === 'activeCount'
                  ? 'Warga Aktif vs Total Database'
                  : metricKey === 'totalCount'
                  ? 'Total KK Terdaftar di Database'
                  : metricKey === 'souls'
                  ? 'Total Jiwa Tertanggung'
                  : 'Iuran Terkumpul (Verified)',
              valueText: formatMetricValue(primaryVal, metricKey),
              extraText: `Warga Aktif: ${stat.activeCount} KK (${stat.percentage}%) • Total DB: ${stat.totalCount} KK`,
            });
          })
          .on('mouseleave', () => setHoveredTooltip(null));

        // When viewing activeCount, also draw a subtle background bar for totalCount (Total Terdaftar di DB) so admin sees active vs registered
        if (metricKey === 'activeCount' && stat.totalCount > 0) {
          const totalY = yScale(stat.totalCount);
          const totalH = Math.max(4, innerHeight - totalY);
          barGroup
            .append('rect')
            .attr('x', x)
            .attr('y', totalY)
            .attr('width', bw)
            .attr('height', totalH)
            .attr('rx', 6)
            .attr('fill', '#e2e8f0')
            .attr('stroke', '#cbd5e1')
            .attr('stroke-dasharray', '3,2');
        }

        // Primary Metric Bar
        barGroup
          .append('rect')
          .attr('x', x)
          .attr('y', primaryVal === 0 ? innerHeight - 4 : barY)
          .attr('width', bw)
          .attr('height', primaryVal === 0 ? 4 : barH)
          .attr('rx', 6)
          .attr('fill', primaryVal === 0 ? '#cbd5e1' : barColorScale(primaryVal))
          .attr('stroke', isSelected ? '#0f172a' : 'none')
          .attr('stroke-width', isSelected ? 2 : 0);

        // Value label above bar
        barGroup
          .append('text')
          .attr('x', x + bw / 2)
          .attr('y', (primaryVal === 0 ? innerHeight - 4 : barY) - 8)
          .attr('text-anchor', 'middle')
          .attr('fill', isSelected ? '#047857' : '#0f172a')
          .attr('font-size', isCompact ? '10px' : '11px')
          .attr('font-weight', '800')
          .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
          .text(
            metricKey === 'totalCollected'
              ? primaryVal > 0
                ? `${Math.round(primaryVal / 1000)}Rb`
                : '0'
              : metricKey === 'activeCount' && stat.totalCount > stat.activeCount
              ? `${stat.activeCount}/${stat.totalCount}`
              : String(primaryVal)
          );

        // X-axis label
        const shortName = stat.cluster.replace(/^Cluster\s+/i, '');
        barGroup
          .append('text')
          .attr('x', x + bw / 2)
          .attr('y', innerHeight + 18)
          .attr('text-anchor', 'middle')
          .attr('fill', isSelected ? '#047857' : '#334155')
          .attr('font-size', isCompact ? '9.5px' : '11px')
          .attr('font-weight', isSelected ? '800' : '600')
          .text(isCompact && shortName.length > 9 ? `${shortName.slice(0, 8)}…` : shortName);

        barGroup
          .append('text')
          .attr('x', x + bw / 2)
          .attr('y', innerHeight + 32)
          .attr('text-anchor', 'middle')
          .attr('fill', '#64748b')
          .attr('font-size', '9px')
          .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
          .text(`${stat.percentage}%`);
      });
    }
  }, [vizMode, metricKey, sortedStats, containerWidth, selectedStat]);

  return (
    <div className="bg-slate-50/70 rounded-xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
      {/* Control Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Visualisasi D3.js Distribusi Keanggotaan per Cluster</span>
            <span className="text-xs font-normal text-slate-500">
              · {activeMembersCount} Aktif · {totalMembersCount} KK Database
            </span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Klik sel pada peta panas atau batang grafik untuk melihat rincian data warga per wilayah cluster.
          </p>
        </div>

        {/* Interactive Controls: Mode Toggle, Metric Selector, Sort Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher: Heatmap vs Bar Chart */}
          <div className="inline-flex p-1 bg-slate-200/80 rounded-lg">
            <button
              type="button"
              onClick={() => setVizMode('heatmap')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                vizMode === 'heatmap'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-emerald-600" />
              <span>Peta Panas (Heatmap)</span>
            </button>
            <button
              type="button"
              onClick={() => setVizMode('barchart')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                vizMode === 'barchart'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Grafik Batang Dinamis</span>
            </button>
          </div>

          {/* Metric Selector (when in Bar Chart mode) */}
          {vizMode === 'barchart' && (
            <div className="inline-flex p-1 bg-slate-200/80 rounded-lg">
              {(
                [
                  { key: 'activeCount', label: 'Warga Aktif' },
                  { key: 'totalCount', label: 'Total KK' },
                  { key: 'souls', label: 'Jiwa' },
                  { key: 'totalCollected', label: 'Iuran' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetricKey(m.key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    metricKey === m.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Sort Order Button */}
          <button
            type="button"
            onClick={() =>
              setSortOrder((prev) =>
                prev === 'master' ? 'active-desc' : prev === 'active-desc' ? 'total-desc' : 'master'
              )
            }
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Ubah urutan cluster"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {sortOrder === 'master'
                ? 'Urutan: Wilayah Master'
                : sortOrder === 'active-desc'
                ? 'Urutan: Aktif Terbanyak'
                : 'Urutan: Total KK Terbanyak'}
            </span>
          </button>
        </div>
      </div>

      {/* D3 SVG Canvas Container */}
      <div ref={containerRef} className="relative w-full bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 overflow-x-auto">
        <svg ref={svgRef} className="w-full block select-none overflow-visible" />

        {/* Floating Tooltip */}
        {hoveredTooltip && (
          <div
            style={{
              left: Math.min(Math.max(hoveredTooltip.x, 90), Math.max(containerWidth - 110, 120)),
              top: Math.max(hoveredTooltip.y, 8),
              transform: 'translate(-50%, -100%)',
            }}
            className="pointer-events-none absolute z-20 bg-slate-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs border border-slate-700 whitespace-nowrap"
          >
            <p className="font-bold text-white">{hoveredTooltip.title}</p>
            <p className="text-[11px] text-slate-300">
              {hoveredTooltip.subtitle}:{' '}
              <strong className="font-mono text-emerald-400 tabular-nums">{hoveredTooltip.valueText}</strong>
            </p>
            {hoveredTooltip.extraText && (
              <p className="text-[10px] text-slate-400 font-mono mt-0.5 tabular-nums">{hoveredTooltip.extraText}</p>
            )}
          </div>
        )}

        {/* Legend Footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
          {vizMode === 'heatmap' ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span>Intensitas Keanggotaan:</span>
                <span className="w-4 h-2.5 rounded-xs bg-slate-100 border border-slate-300 inline-block" title="0 (Kosong)" />
                <span className="w-4 h-2.5 rounded-xs bg-emerald-100 inline-block" />
                <span className="w-4 h-2.5 rounded-xs bg-emerald-400 inline-block" />
                <span className="w-4 h-2.5 rounded-xs bg-emerald-700 inline-block" />
                <span className="text-slate-600 font-medium">Rendah → Tinggi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-xs bg-amber-300 border border-amber-500 inline-block" />
                <span>Baris Proses / Antrean Verifikasi</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                <span>
                  {metricKey === 'activeCount'
                    ? 'Warga Aktif (Status Aktif)'
                    : metricKey === 'totalCount'
                    ? 'Total KK Terdaftar di Database'
                    : metricKey === 'souls'
                    ? 'Jiwa Tertanggung'
                    : 'Iuran Terverifikasi'}
                </span>
              </div>
              {metricKey === 'activeCount' && (
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-2.5 rounded-xs bg-slate-200 border border-dashed border-slate-400 inline-block" />
                  <span>Total KK Terdaftar (Termasuk Proses Aktivasi)</span>
                </div>
              )}
            </div>
          )}

          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
            Sumber: Koleksi Firestore members & clusters
          </span>
        </div>
      </div>

      {/* Selected Cluster Inspector Bar */}
      {selectedStat && (
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold text-slate-900 inline-flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{selectedStat.cluster}</span>
            </span>
            {selectedStat.rtNumber && (
              <>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="font-mono text-slate-600">{selectedStat.rtNumber}</span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-600 font-mono tabular-nums">
              Aktif: <strong className="text-emerald-700">{selectedStat.activeCount} KK ({selectedStat.percentage}%)</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-600 font-mono tabular-nums">
              Total DB: <strong className="text-slate-900">{selectedStat.totalCount} KK</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-600 font-mono tabular-nums">
              Cakupan:{' '}
              <strong className="text-slate-900">
                {selectedStat.activeCount > 0 ? selectedStat.activeSouls : selectedStat.totalSouls} Jiwa
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-600 font-mono tabular-nums">
              Iuran: <strong className="text-emerald-700">{formatIDR(selectedStat.totalCollected)}</strong>
            </span>
            {selectedStat.leaderName && (
              <>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-500">
                  Ketua RT: <strong className="text-slate-700">{selectedStat.leaderName}</strong>
                </span>
              </>
            )}
          </div>

          {onNavigateToMembers && (
            <button
              type="button"
              onClick={onNavigateToMembers}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Buka Daftar Warga</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
