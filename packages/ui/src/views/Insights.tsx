import { useState, useEffect, useMemo } from 'react';
import { api, InsightsSummary, TechnologyUsageRecord, AchievementProgress } from '../api/client';

// Achievement icon mapping
const ACHIEVEMENT_ICONS: Record<string, string> = {
  'brain': 'ph--brain',
  'database': 'ph--database',
  'trophy': 'ph--trophy',
  'crown': 'ph--crown',
  'git-branch': 'ph--git-branch',
  'bug': 'ph--bug',
  'shield': 'ph--shield-check',
  'globe': 'ph--globe',
  'star': 'ph--star',
  'folder': 'ph--folder',
  'briefcase': 'ph--briefcase',
  'target': 'ph--target',
  'flame': 'ph--flame',
  'fire': 'ph--fire',
  'rocket': 'ph--rocket',
};

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  activity: 'primary',
  learning: 'success',
  milestone: 'warning',
  streak: 'error',
};

// Technology category colors
const TECH_CATEGORY_COLORS: Record<string, string> = {
  language: 'primary',
  framework: 'secondary',
  library: 'accent',
  database: 'info',
  tool: 'warning',
  platform: 'success',
  other: 'neutral',
};

export function InsightsView() {
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [technologies, setTechnologies] = useState<TechnologyUsageRecord[]>([]);
  const [achievements, setAchievements] = useState<AchievementProgress[]>([]);
  const [heatmap, setHeatmap] = useState<Array<{ date: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkingAchievements, setCheckingAchievements] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [summaryRes, techRes, achievementsRes, heatmapRes] = await Promise.all([
        api.getInsightsSummary(30),
        api.getInsightsTechnologies({ limit: 15 }),
        api.getInsightsAchievements(),
        api.getInsightsHeatmap(),
      ]);
      setSummary(summaryRes);
      setTechnologies(techRes);
      setAchievements(achievementsRes);
      setHeatmap(heatmapRes);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckAchievements = async () => {
    setCheckingAchievements(true);
    try {
      const result = await api.checkAchievements();
      if (result.updated > 0) {
        // Reload achievements after check
        const achievementsRes = await api.getInsightsAchievements();
        setAchievements(achievementsRes);
      }
    } catch (error) {
      console.error('Failed to check achievements:', error);
    } finally {
      setCheckingAchievements(false);
    }
  };

  const unlockedAchievements = useMemo(() =>
    achievements.filter(a => a.unlocked), [achievements]);

  const inProgressAchievements = useMemo(() =>
    achievements.filter(a => !a.unlocked && a.progress > 0), [achievements]);

  const lockedAchievements = useMemo(() =>
    achievements.filter(a => !a.unlocked && a.progress === 0), [achievements]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Learning Insights</h1>
          <p className="text-base-content/60">Track your progress and achievements</p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleCheckAchievements}
          disabled={checkingAchievements}
        >
          {checkingAchievements ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <span className="iconify ph--check-circle size-4" />
          )}
          Check Achievements
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon="ph--brain"
            label="Total Memories"
            value={summary.totalObservations}
            color="primary"
          />
          <StatCard
            icon="ph--clock-counter-clockwise"
            label="Sessions"
            value={summary.totalSessions}
            color="success"
          />
          <StatCard
            icon="ph--folder"
            label="Projects"
            value={summary.totalProjects}
            color="warning"
          />
          <StatCard
            icon="ph--flame"
            label="Current Streak"
            value={summary.currentStreak}
            suffix=" days"
            color="error"
          />
        </div>
      )}

      {/* Streak and Activity Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-base">
                <span className="iconify ph--calendar-dots size-5" />
                Activity Summary
              </h2>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <p className="text-3xl font-bold text-primary">{summary.activeDays}</p>
                  <p className="text-sm text-base-content/60">Active Days (30d)</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-success">{summary.longestStreak}</p>
                  <p className="text-sm text-base-content/60">Longest Streak</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-warning">{summary.totalDecisions}</p>
                  <p className="text-sm text-base-content/60">Decisions Made</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-info">{summary.totalTokens.toLocaleString()}</p>
                  <p className="text-sm text-base-content/60">Tokens Used</p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-base">
                <span className="iconify ph--chart-bar size-5" />
                Activity (Last 30 Days)
              </h2>
              <div className="flex flex-wrap gap-1 mt-2">
                {heatmap.slice(-30).map((day) => (
                  <div
                    key={day.date}
                    className={`w-4 h-4 rounded-sm tooltip ${getHeatmapColor(day.count)}`}
                    data-tip={`${day.date}: ${day.count} observations`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-base-content/60">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-base-300" />
                <div className="w-3 h-3 rounded-sm bg-primary/30" />
                <div className="w-3 h-3 rounded-sm bg-primary/50" />
                <div className="w-3 h-3 rounded-sm bg-primary/70" />
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span>More</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Technologies */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">
            <span className="iconify ph--code size-5" />
            Technologies Used
          </h2>
          {technologies.length === 0 ? (
            <p className="text-base-content/60">No technologies tracked yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              {technologies.map((tech) => (
                <div
                  key={tech.id}
                  className={`badge badge-${TECH_CATEGORY_COLORS[tech.category || 'other'] || 'neutral'} badge-lg gap-1`}
                >
                  {tech.name}
                  <span className="badge badge-sm badge-ghost">{tech.observation_count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Achievements (Issue #282: Add filter tabs) */}
      <AchievementsSection
        unlocked={unlockedAchievements}
        inProgress={inProgressAchievements}
        locked={lockedAchievements}
        total={achievements.length}
      />
    </div>
  );
}

// Achievement filter tabs (Issue #282)
type AchievementTab = 'unlocked' | 'progress' | 'locked' | 'all';

function AchievementsSection({
  unlocked,
  inProgress,
  locked,
  total,
}: {
  unlocked: AchievementProgress[];
  inProgress: AchievementProgress[];
  locked: AchievementProgress[];
  total: number;
}) {
  const [activeTab, setActiveTab] = useState<AchievementTab>('unlocked');

  const tabs: { id: AchievementTab; label: string; count: number; icon: string }[] = [
    { id: 'unlocked', label: 'Unlocked', count: unlocked.length, icon: 'ph--check-circle' },
    { id: 'progress', label: 'In Progress', count: inProgress.length, icon: 'ph--hourglass' },
    { id: 'locked', label: 'Locked', count: locked.length, icon: 'ph--lock-simple' },
    { id: 'all', label: 'All', count: total, icon: 'ph--list' },
  ];

  const getVisibleAchievements = (): AchievementProgress[] => {
    switch (activeTab) {
      case 'unlocked':
        return unlocked;
      case 'progress':
        return inProgress;
      case 'locked':
        return locked;
      case 'all':
        return [...unlocked, ...inProgress, ...locked];
    }
  };

  const visibleAchievements = getVisibleAchievements();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="iconify ph--trophy size-6 text-warning" />
          Achievements
          <span className="badge badge-warning">{unlocked.length} / {total}</span>
        </h2>

        {/* Filter Tabs (Issue #282) */}
        <div className="join">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`join-item btn btn-sm gap-1 ${
                activeTab === tab.id
                  ? 'btn-primary'
                  : tab.count > 0
                  ? 'btn-outline btn-primary'
                  : 'btn-ghost'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={`iconify ${tab.icon} size-4`} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`badge badge-xs ${activeTab === tab.id ? 'badge-ghost' : 'badge-primary'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Achievements Grid */}
      {visibleAchievements.length === 0 ? (
        <div className="card bg-base-200">
          <div className="card-body items-center justify-center py-12 text-base-content/60">
            <span className="iconify ph--trophy size-12 mb-2" />
            <span>No achievements in this category</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleAchievements.map((a) => (
            <AchievementCard key={a.definition.id} achievement={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  suffix = '',
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="card bg-base-200">
      <div className="card-body p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${color}/10`}>
            <span className={`iconify ${icon} size-5 text-${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {value.toLocaleString()}{suffix}
            </p>
            <p className="text-xs text-base-content/60">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: AchievementProgress }) {
  const { definition, progress, unlocked, unlockedAt } = achievement;
  const iconClass = ACHIEVEMENT_ICONS[definition.icon] || 'ph--star';
  const colorClass = CATEGORY_COLORS[definition.category] || 'neutral';

  return (
    <div className={`card bg-base-200 ${unlocked ? 'border border-warning/30' : 'opacity-60'}`}>
      <div className="card-body p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${unlocked ? `bg-${colorClass}/20` : 'bg-base-300'}`}>
            <span className={`iconify ${iconClass} size-6 ${unlocked ? `text-${colorClass}` : 'text-base-content/40'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{definition.name}</h3>
            <p className="text-xs text-base-content/60 truncate">{definition.description}</p>

            {/* Improved progress bar (Issue #282) */}
            {!unlocked && definition.threshold && (
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{Math.round(progress * 100)}%</span>
                  <span className="text-base-content/50">
                    {Math.round(progress * definition.threshold)} / {definition.threshold}
                  </span>
                </div>
                <progress
                  className={`progress progress-${colorClass} h-2`}
                  value={progress * 100}
                  max={100}
                />
                {progress > 0 && progress < 1 && (
                  <p className="text-xs text-base-content/50 mt-1">
                    {definition.threshold - Math.round(progress * definition.threshold)} more to unlock!
                  </p>
                )}
              </div>
            )}

            {unlocked && unlockedAt && (
              <p className="text-xs text-success mt-1">
                Unlocked {new Date(unlockedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getHeatmapColor(count: number): string {
  if (count === 0) return 'bg-base-300';
  if (count < 3) return 'bg-primary/30';
  if (count < 6) return 'bg-primary/50';
  if (count < 10) return 'bg-primary/70';
  return 'bg-primary';
}
