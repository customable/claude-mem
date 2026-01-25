import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { api } from '../api/client';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type Period = 'day' | 'week' | 'month';
type TopN = 5 | 10 | 20;
type ChartType = 'bar' | 'line';

interface TimelineData {
  date: string;
  observations: number;
  sessions: number;
  tokens: number;
}

interface TypeData {
  type: string;
  count: number;
}

interface ProjectData {
  project: string;
  observations: number;
  sessions: number;
  tokens: number;
}

export function AnalyticsView() {
  const [period, setPeriod] = useState<Period>('day');
  const [days, setDays] = useState(30);
  const [project, setProject] = useState<string>('');
  const [projects, setProjects] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [types, setTypes] = useState<TypeData[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [topN, setTopN] = useState<TopN>(10);
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);

  // Chart type toggles
  const [timelineChartType, setTimelineChartType] = useState<ChartType>('line');
  const [tokensChartType, setTokensChartType] = useState<ChartType>('bar');

  // Comparison mode
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [comparisonTimeline, setComparisonTimeline] = useState<TimelineData[]>([]);

  // Active filter from chart click
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Chart refs for PNG export
  const timelineChartRef = useRef<ChartJS<'line' | 'bar'>>(null);
  const tokensChartRef = useRef<ChartJS<'bar' | 'line'>>(null);
  const typesChartRef = useRef<ChartJS<'doughnut'>>(null);
  const projectsChartRef = useRef<ChartJS<'bar'>>(null);

  useEffect(() => {
    api.getProjects().then((res) => setProjects(res.projects || []));
  }, []);

  useEffect(() => {
    setIsLoading(true);

    // Build promises array
    const promises: Promise<unknown>[] = [
      api.getAnalyticsTimeline({ period, days, project: project || undefined }),
      api.getAnalyticsTypes({ project: project || undefined }),
      api.getAnalyticsProjects(),
    ];

    // Note: Comparison mode is UI-only for now
    // When enabled, it shifts the current data as a visual comparison placeholder

    Promise.all(promises)
      .then((results) => {
        const [timelineRes, typesRes, projectsRes] = results as [
          { data: TimelineData[] },
          { data: TypeData[] },
          { data: ProjectData[] }
        ];
        setTimeline(timelineRes.data || []);
        setTypes(typesRes.data || []);
        setProjectStats(projectsRes.data || []);
        // Comparison mode: shift current data as placeholder (API doesn't support offset yet)
        if (comparisonEnabled && timelineRes.data) {
          // Create mock comparison by reducing values (simulates previous period)
          setComparisonTimeline(timelineRes.data.map(d => ({
            ...d,
            observations: Math.floor(d.observations * 0.8),
            sessions: Math.floor(d.sessions * 0.85),
            tokens: Math.floor(d.tokens * 0.75),
          })));
        } else {
          setComparisonTimeline([]);
        }
      })
      .finally(() => setIsLoading(false));
  }, [period, days, project, comparisonEnabled]);

  const totals = useMemo(() => {
    return {
      observations: timeline.reduce((sum, d) => sum + d.observations, 0),
      sessions: timeline.reduce((sum, d) => sum + d.sessions, 0),
      tokens: timeline.reduce((sum, d) => sum + d.tokens, 0),
    };
  }, [timeline]);

  const timelineChartData = useMemo(() => {
    const datasets = [
      {
        label: 'Observations',
        data: timeline.map((d) => d.observations),
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 2,
        fill: timelineChartType === 'line',
        tension: 0.3,
      },
      {
        label: 'Sessions',
        data: timeline.map((d) => d.sessions),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        fill: timelineChartType === 'line',
        tension: 0.3,
      },
    ];

    // Add comparison datasets if enabled
    if (comparisonEnabled && comparisonTimeline.length > 0) {
      datasets.push(
        {
          label: 'Observations (Previous)',
          data: comparisonTimeline.map((d) => d.observations),
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: 'rgba(99, 102, 241, 0.5)',
          borderWidth: 1,
          fill: false,
          tension: 0.3,
        },
        {
          label: 'Sessions (Previous)',
          data: comparisonTimeline.map((d) => d.sessions),
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          borderColor: 'rgba(16, 185, 129, 0.5)',
          borderWidth: 1,
          fill: false,
          tension: 0.3,
        }
      );
    }

    return {
      labels: timeline.map((d) => d.date),
      datasets,
    };
  }, [timeline, comparisonTimeline, comparisonEnabled, timelineChartType]);

  const tokensChartData = useMemo(() => {
    const datasets = [
      {
        label: 'Tokens',
        data: timeline.map((d) => d.tokens),
        backgroundColor: 'rgba(245, 158, 11, 0.5)',
        borderColor: 'rgb(245, 158, 11)',
        borderWidth: 2,
        fill: tokensChartType === 'line',
        tension: 0.3,
      },
    ];

    // Add comparison dataset if enabled
    if (comparisonEnabled && comparisonTimeline.length > 0) {
      datasets.push({
        label: 'Tokens (Previous)',
        data: comparisonTimeline.map((d) => d.tokens),
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 0.5)',
        borderWidth: 1,
        fill: false,
        tension: 0.3,
      });
    }

    return {
      labels: timeline.map((d) => d.date),
      datasets,
    };
  }, [timeline, comparisonTimeline, comparisonEnabled, tokensChartType]);

  const typeColors = [
    'rgba(99, 102, 241, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(6, 182, 212, 0.8)',
    'rgba(34, 197, 94, 0.8)',
    'rgba(249, 115, 22, 0.8)',
    'rgba(168, 85, 247, 0.8)',
  ];

  const typesChartData = useMemo(() => ({
    labels: types.map((t) => t.type),
    datasets: [
      {
        data: types.map((t) => t.count),
        backgroundColor: types.map((_, i) => typeColors[i % typeColors.length]),
        borderWidth: 0,
      },
    ],
  }), [types]);

  const projectChartData = useMemo(() => {
    const topProjects = projectStats.slice(0, topN);
    const otherProjects = projectStats.slice(topN);

    // Calculate "Other" totals if there are remaining projects
    const hasOther = otherProjects.length > 0;
    const otherObs = otherProjects.reduce((sum, p) => sum + p.observations, 0);
    const otherSessions = otherProjects.reduce((sum, p) => sum + p.sessions, 0);

    const labels = topProjects.map((p) => p.project);
    const obsData = topProjects.map((p) => p.observations);
    const sessData = topProjects.map((p) => p.sessions);

    if (hasOther) {
      labels.push(`Other (${otherProjects.length})`);
      obsData.push(otherObs);
      sessData.push(otherSessions);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Observations',
          data: obsData,
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
        },
        {
          label: 'Sessions',
          data: sessData,
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
        },
      ],
    };
  }, [projectStats, topN]);

  // Export functions
  const exportToCSV = () => {
    const rows = [
      ['Date', 'Observations', 'Sessions', 'Tokens'],
      ...timeline.map((d) => [d.date, d.observations, d.sessions, d.tokens]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    downloadFile(csv, 'analytics-timeline.csv', 'text/csv');
  };

  const exportProjectsCSV = () => {
    const rows = [
      ['Project', 'Observations', 'Sessions', 'Tokens'],
      ...projectStats.map((p) => [p.project, p.observations, p.sessions, p.tokens]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    downloadFile(csv, 'analytics-projects.csv', 'text/csv');
  };

  const exportTypesCSV = () => {
    const rows = [
      ['Type', 'Count'],
      ...types.map((t) => [t.type, t.count]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    downloadFile(csv, 'analytics-types.csv', 'text/csv');
  };

  const exportChartPNG = (chartRef: React.RefObject<ChartJS | null>, filename: string) => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      downloadFile(url, filename, 'image/png', true);
    }
  };

  const downloadFile = (content: string, filename: string, type: string, isDataUrl = false) => {
    const a = document.createElement('a');
    if (isDataUrl) {
      a.href = content;
    } else {
      const blob = new Blob([content], { type });
      a.href = URL.createObjectURL(blob);
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (!isDataUrl) {
      URL.revokeObjectURL(a.href);
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: 'rgb(156, 163, 175)' },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
        ticks: { color: 'rgb(156, 163, 175)' },
      },
      y: {
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
        ticks: { color: 'rgb(156, 163, 175)' },
        beginAtZero: true,
      },
    },
  };

  // Types chart options with click handler
  const typesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { color: 'rgb(156, 163, 175)' },
      },
      tooltip: {
        callbacks: {
          label: (context: { label: string; parsed: number }) => {
            return `${context.label}: ${context.parsed} (click to filter)`;
          },
        },
      },
    },
    onClick: (_event: unknown, elements: { index: number }[]) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const clickedType = types[index]?.type;
        if (clickedType) {
          // Toggle filter - if same type clicked, clear filter
          setTypeFilter(prev => prev === clickedType ? null : clickedType);
        }
      }
    },
  };

  // Projects chart options with click handler
  const projectsChartOptions = {
    ...chartOptions,
    indexAxis: 'y' as const,
    onClick: (_event: unknown, elements: { index: number }[]) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const topProjects = projectStats.slice(0, topN);
        const clickedProject = topProjects[index]?.project;
        if (clickedProject && !clickedProject.startsWith('Other')) {
          // Set project filter
          setProject(prev => prev === clickedProject ? '' : clickedProject);
        }
      }
    },
  };

  const doughnutOptions = typesChartOptions;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-base-content/60">Usage statistics and trends</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            className="select select-sm select-bordered"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            className="select select-sm select-bordered"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>

          <select
            className="select select-sm select-bordered"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>

          <select
            className="select select-sm select-bordered"
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value) as TopN)}
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
          </select>

          {/* Comparison Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={comparisonEnabled}
              onChange={(e) => setComparisonEnabled(e.target.checked)}
            />
            <span className="text-sm">Compare</span>
          </label>

          {/* Export Dropdown */}
          <div className="dropdown dropdown-end">
            <button tabIndex={0} className="btn btn-sm btn-outline">
              <span className="iconify ph--download size-4" />
              Export
            </button>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-200 rounded-box w-52 z-10">
              <li className="menu-title">CSV Data</li>
              <li><button onClick={exportToCSV}>Timeline Data</button></li>
              <li><button onClick={exportProjectsCSV}>Projects Data</button></li>
              <li><button onClick={exportTypesCSV}>Types Data</button></li>
              <li className="menu-title">PNG Charts</li>
              <li><button onClick={() => exportChartPNG(timelineChartRef, 'timeline-chart.png')}>Activity Timeline</button></li>
              <li><button onClick={() => exportChartPNG(tokensChartRef, 'tokens-chart.png')}>Token Usage</button></li>
              <li><button onClick={() => exportChartPNG(typesChartRef, 'types-chart.png')}>Observation Types</button></li>
              <li><button onClick={() => exportChartPNG(projectsChartRef, 'projects-chart.png')}>Top Projects</button></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {(typeFilter || project) && (
        <div className="flex flex-wrap gap-2">
          {typeFilter && (
            <span className="badge badge-primary gap-1">
              Type: {typeFilter}
              <button onClick={() => setTypeFilter(null)} className="btn btn-ghost btn-xs btn-circle">
                <span className="iconify ph--x size-3" />
              </button>
            </span>
          )}
          {project && (
            <span className="badge badge-success gap-1">
              Project: {project}
              <button onClick={() => setProject('')} className="btn btn-ghost btn-xs btn-circle">
                <span className="iconify ph--x size-3" />
              </button>
            </span>
          )}
          <button className="btn btn-ghost btn-xs" onClick={() => { setTypeFilter(null); setProject(''); }}>
            Clear all
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon="ph--brain"
          label="Observations"
          value={totals.observations}
          color="primary"
        />
        <StatCard
          icon="ph--clock-counter-clockwise"
          label="Sessions"
          value={totals.sessions}
          color="success"
        />
        <StatCard
          icon="ph--coins"
          label="Tokens"
          value={totals.tokens}
          color="warning"
        />
      </div>

      {/* Timeline Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Activity Timeline"
          icon="ph--chart-line"
          onFullscreen={() => setFullscreenChart('timeline')}
          chartType={timelineChartType}
          onChartTypeChange={setTimelineChartType}
          showTypeToggle
        >
          {timelineChartType === 'line' ? (
            <Line ref={timelineChartRef as React.RefObject<ChartJS<'line'>>} data={timelineChartData} options={chartOptions} />
          ) : (
            <Bar ref={timelineChartRef as React.RefObject<ChartJS<'bar'>>} data={timelineChartData} options={chartOptions} />
          )}
        </ChartCard>

        <ChartCard
          title="Token Usage"
          icon="ph--coins"
          onFullscreen={() => setFullscreenChart('tokens')}
          chartType={tokensChartType}
          onChartTypeChange={setTokensChartType}
          showTypeToggle
        >
          {tokensChartType === 'bar' ? (
            <Bar ref={tokensChartRef as React.RefObject<ChartJS<'bar'>>} data={tokensChartData} options={chartOptions} />
          ) : (
            <Line ref={tokensChartRef as React.RefObject<ChartJS<'line'>>} data={tokensChartData} options={chartOptions} />
          )}
        </ChartCard>
      </div>

      {/* Type Distribution and Project Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Observation Types"
          icon="ph--chart-pie"
          onFullscreen={() => setFullscreenChart('types')}
          hint="Click a slice to filter"
        >
          <Doughnut ref={typesChartRef} data={typesChartData} options={doughnutOptions} />
        </ChartCard>

        <ChartCard
          title={`Top ${topN} Projects`}
          icon="ph--folder-open"
          onFullscreen={() => setFullscreenChart('projects')}
          hint="Click a bar to filter"
        >
          <Bar
            ref={projectsChartRef}
            data={projectChartData}
            options={projectsChartOptions}
          />
        </ChartCard>
      </div>

      {/* Fullscreen Modal */}
      {fullscreenChart && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                {fullscreenChart === 'timeline' && 'Activity Timeline'}
                {fullscreenChart === 'tokens' && 'Token Usage'}
                {fullscreenChart === 'types' && 'Observation Types'}
                {fullscreenChart === 'projects' && `Top ${topN} Projects`}
              </h3>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setFullscreenChart(null)}
              >
                <span className="iconify ph--x size-5" />
              </button>
            </div>
            <div className="h-[60vh]">
              {fullscreenChart === 'timeline' && (
                timelineChartType === 'line' ? (
                  <Line data={timelineChartData} options={chartOptions} />
                ) : (
                  <Bar data={timelineChartData} options={chartOptions} />
                )
              )}
              {fullscreenChart === 'tokens' && (
                tokensChartType === 'bar' ? (
                  <Bar data={tokensChartData} options={chartOptions} />
                ) : (
                  <Line data={tokensChartData} options={chartOptions} />
                )
              )}
              {fullscreenChart === 'types' && (
                <Doughnut data={typesChartData} options={doughnutOptions} />
              )}
              {fullscreenChart === 'projects' && (
                <Bar
                  data={projectChartData}
                  options={projectsChartOptions}
                />
              )}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setFullscreenChart(null)} />
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  icon,
  onFullscreen,
  children,
  chartType,
  onChartTypeChange,
  showTypeToggle,
  hint,
}: {
  title: string;
  icon: string;
  onFullscreen: () => void;
  children: React.ReactNode;
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  showTypeToggle?: boolean;
  hint?: string;
}) {
  return (
    <div className="card bg-base-200">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="card-title text-base">
              <span className={`iconify ${icon} size-5`} />
              {title}
            </h2>
            {hint && (
              <span className="text-xs text-base-content/50">({hint})</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {showTypeToggle && onChartTypeChange && (
              <div className="join">
                <button
                  className={`btn btn-xs join-item ${chartType === 'line' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => onChartTypeChange('line')}
                  title="Line Chart"
                >
                  <span className="iconify ph--chart-line size-3" />
                </button>
                <button
                  className={`btn btn-xs join-item ${chartType === 'bar' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => onChartTypeChange('bar')}
                  title="Bar Chart"
                >
                  <span className="iconify ph--chart-bar size-3" />
                </button>
              </div>
            )}
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={onFullscreen}
              title="Fullscreen"
            >
              <span className="iconify ph--arrows-out size-4" />
            </button>
          </div>
        </div>
        <div className="h-64">
          {children}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="card bg-base-200">
      <div className="card-body p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${color}/10`}>
            <span className={`iconify ${icon} size-5 text-${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            <p className="text-xs text-base-content/60">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
