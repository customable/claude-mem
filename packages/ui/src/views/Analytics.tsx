import { useState, useEffect, useMemo } from 'react';
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

  useEffect(() => {
    api.getProjects().then((res) => setProjects(res.projects || []));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      api.getAnalyticsTimeline({ period, days, project: project || undefined }),
      api.getAnalyticsTypes({ project: project || undefined }),
      api.getAnalyticsProjects(),
    ])
      .then(([timelineRes, typesRes, projectsRes]) => {
        setTimeline(timelineRes.data || []);
        setTypes(typesRes.data || []);
        setProjectStats(projectsRes.data || []);
      })
      .finally(() => setIsLoading(false));
  }, [period, days, project]);

  const totals = useMemo(() => {
    return {
      observations: timeline.reduce((sum, d) => sum + d.observations, 0),
      sessions: timeline.reduce((sum, d) => sum + d.sessions, 0),
      tokens: timeline.reduce((sum, d) => sum + d.tokens, 0),
    };
  }, [timeline]);

  const timelineChartData = useMemo(() => ({
    labels: timeline.map((d) => d.date),
    datasets: [
      {
        label: 'Observations',
        data: timeline.map((d) => d.observations),
        backgroundColor: 'rgba(99, 102, 241, 0.5)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Sessions',
        data: timeline.map((d) => d.sessions),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  }), [timeline]);

  const tokensChartData = useMemo(() => ({
    labels: timeline.map((d) => d.date),
    datasets: [
      {
        label: 'Tokens',
        data: timeline.map((d) => d.tokens),
        backgroundColor: 'rgba(245, 158, 11, 0.5)',
        borderColor: 'rgb(245, 158, 11)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  }), [timeline]);

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

  const projectChartData = useMemo(() => ({
    labels: projectStats.slice(0, 10).map((p) => p.project),
    datasets: [
      {
        label: 'Observations',
        data: projectStats.slice(0, 10).map((p) => p.observations),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
      },
      {
        label: 'Sessions',
        data: projectStats.slice(0, 10).map((p) => p.sessions),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
      },
    ],
  }), [projectStats]);

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

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: { color: 'rgb(156, 163, 175)' },
      },
    },
  };

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
        </div>
      </div>

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
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-base">
              <span className="iconify ph--chart-line size-5" />
              Activity Timeline
            </h2>
            <div className="h-64">
              <Line data={timelineChartData} options={chartOptions} />
            </div>
          </div>
        </div>

        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-base">
              <span className="iconify ph--coins size-5" />
              Token Usage
            </h2>
            <div className="h-64">
              <Bar data={tokensChartData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Type Distribution and Project Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-base">
              <span className="iconify ph--chart-pie size-5" />
              Observation Types
            </h2>
            <div className="h-64">
              <Doughnut data={typesChartData} options={doughnutOptions} />
            </div>
          </div>
        </div>

        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-base">
              <span className="iconify ph--folder-open size-5" />
              Top Projects
            </h2>
            <div className="h-64">
              <Bar
                data={projectChartData}
                options={{
                  ...chartOptions,
                  indexAxis: 'y' as const,
                }}
              />
            </div>
          </div>
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
