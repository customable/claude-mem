import React, { useState, useEffect } from 'react';
import { Card, CardBody, Badge, Icon, Spinner } from '../../components/ui';

interface TimelineItem {
  type: 'prompt' | 'observation';
  id: number;
  timestamp: number;
  data: any;
}

interface SessionSummary {
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  created_at: string;
}

interface TimelineData {
  session: any;
  timeline: TimelineItem[];
  summary: SessionSummary | null;
  stats: {
    observations: number;
    prompts: number;
  };
}

interface SessionTimelineProps {
  sessionId: number;
}

const typeConfig: Record<string, { icon: string; color: string }> = {
  prompt: { icon: 'lucide:message-square', color: 'text-primary' },
  observation: { icon: 'lucide:brain', color: 'text-info' },
  bugfix: { icon: 'lucide:bug', color: 'text-error' },
  feature: { icon: 'lucide:sparkles', color: 'text-success' },
  refactor: { icon: 'lucide:refresh-cw', color: 'text-accent' },
  discovery: { icon: 'lucide:search', color: 'text-info' },
  decision: { icon: 'lucide:git-branch', color: 'text-warning' },
  change: { icon: 'lucide:pencil', color: 'text-secondary' },
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SessionTimeline({ sessionId }: SessionTimelineProps) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchTimeline() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/sessions/${sessionId}/timeline`);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch timeline:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTimeline();
  }, [sessionId]);

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-base-content/50">
        Failed to load timeline
      </div>
    );
  }

  return (
    <div className="mt-4 ml-8 border-l-2 border-base-300 pl-6 space-y-4">
      {/* Summary at top if exists */}
      {data.summary && (
        <div className="relative">
          <div className="absolute -left-9 top-3 w-4 h-4 rounded-full bg-warning border-2 border-base-100" />
          <Card className="bg-warning/10 border-warning/30">
            <CardBody className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="lucide:file-text" size={16} className="text-warning" />
                <span className="font-medium text-sm">Session Summary</span>
              </div>
              <div className="space-y-2 text-sm">
                {data.summary.request && (
                  <div>
                    <span className="font-medium">Request:</span> {data.summary.request}
                  </div>
                )}
                {data.summary.learned && (
                  <div>
                    <span className="font-medium">Learned:</span> {data.summary.learned}
                  </div>
                )}
                {data.summary.completed && (
                  <div>
                    <span className="font-medium">Completed:</span> {data.summary.completed}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Timeline items */}
      {data.timeline.map((item, index) => {
        const key = `${item.type}-${item.id}`;
        const isExpanded = expandedItems.has(key);
        const config = item.type === 'prompt'
          ? typeConfig.prompt
          : typeConfig[item.data.type] || typeConfig.observation;

        return (
          <div key={key} className="relative">
            {/* Timeline dot */}
            <div className={`absolute -left-9 top-3 w-4 h-4 rounded-full border-2 border-base-100 ${
              item.type === 'prompt' ? 'bg-primary' : 'bg-info'
            }`} />

            <Card
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => toggleExpand(key)}
            >
              <CardBody className="py-3">
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded bg-base-200 ${config.color}`}>
                    <Icon icon={config.icon} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={item.type === 'prompt' ? 'primary' : 'info'}
                        size="xs"
                      >
                        {item.type === 'prompt' ? 'prompt' : item.data.type || 'observation'}
                      </Badge>
                      <span className="text-xs text-base-content/50">
                        {formatTime(item.timestamp)}
                      </span>
                      <span className="text-xs text-base-content/40">#{item.id}</span>
                    </div>
                    <p className={`text-sm ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {item.type === 'prompt'
                        ? item.data.prompt_text
                        : item.data.title || item.data.narrative}
                    </p>

                    {/* Expanded content */}
                    {isExpanded && item.type === 'observation' && item.data.text && (
                      <div className="mt-3 pt-3 border-t border-base-200">
                        <p className="text-sm text-base-content/70 whitespace-pre-wrap">
                          {item.data.text}
                        </p>
                        {item.data.files_read && (
                          <div className="mt-2">
                            <span className="text-xs font-medium">Files:</span>
                            <span className="text-xs text-base-content/50 ml-1">
                              {(() => {
                                try {
                                  const files = JSON.parse(item.data.files_read);
                                  return files.slice(0, 3).join(', ') + (files.length > 3 ? ` +${files.length - 3} more` : '');
                                } catch {
                                  return item.data.files_read;
                                }
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Icon
                    icon={isExpanded ? 'lucide:chevron-up' : 'lucide:chevron-down'}
                    size={16}
                    className="text-base-content/30"
                  />
                </div>
              </CardBody>
            </Card>
          </div>
        );
      })}

      {data.timeline.length === 0 && (
        <div className="text-center py-8 text-base-content/50">
          No activity in this session
        </div>
      )}
    </div>
  );
}
