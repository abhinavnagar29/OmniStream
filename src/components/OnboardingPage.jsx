import React, { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { submitOnboarding } from '../services/api';
import { toast } from './AppToaster';

const TOPICS = [
  { id: 'ai', label: 'AI / Tech' },
  { id: 'startups', label: 'Startups / Business' },
  { id: 'sports', label: 'Sports / Cricket' },
  { id: 'wellness', label: 'Wellness / Meditation' },
  { id: 'space', label: 'Space / Science' },
  { id: 'finance', label: 'Finance / Markets' },
];

const DOMAINS = [
  { id: 'video', label: 'Videos' },
  { id: 'music', label: 'Music' },
  { id: 'podcast', label: 'Podcasts' },
  { id: 'movie', label: 'Movies' },
  { id: 'news', label: 'News' },
];

const GOALS = [
  { id: 'learn', label: 'Learn' },
  { id: 'relax', label: 'Relax' },
  { id: 'stay_updated', label: 'Stay updated' },
  { id: 'entertain', label: 'Be entertained' },
];

function ToggleChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-2 rounded-full border text-sm transition',
        active ? 'bg-signal/10 border-signal/40 text-paper' : 'bg-ink-900 border-ink-700 text-paper-dim hover:bg-ink-800',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function OnboardingPage({ onDone }) {
  const [topics, setTopics] = useState(['ai']);
  const [domains, setDomains] = useState(['video', 'podcast', 'news']);
  const [goals, setGoals] = useState(['learn']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => topics.length > 0 && domains.length > 0 && goals.length > 0, [topics, domains, goals]);

  const toggle = (arr, setArr, id) => {
    setArr((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSaving(true);
      setError('');
      await submitOnboarding({ topics, domains, goals });
      toast.success('Your signal is tuned — welcome in!');
      onDone?.();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 lg:px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-ink-900 border border-ink-700 grid place-items-center">
            <Sparkles className="h-5 w-5 text-signal" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-paper">Welcome</div>
            <div className="text-paper-dim text-sm">Pick what you like to personalize cross-domain recommendations</div>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl bg-domain-video/10 border border-domain-video/30 text-domain-video p-3 text-sm">
            {error}
          </div>
        ) : null}

        <div className="space-y-6">
          <div className="rounded-2xl bg-ink-900 border border-ink-700 p-5">
            <div className="text-paper font-semibold">Topics</div>
            <div className="text-paper-dim text-sm mt-1">Choose 1-6</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <ToggleChip key={t.id} active={topics.includes(t.id)} onClick={() => toggle(topics, setTopics, t.id)}>
                  {t.label}
                </ToggleChip>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-ink-900 border border-ink-700 p-5">
            <div className="text-paper font-semibold">Preferred formats</div>
            <div className="text-paper-dim text-sm mt-1">Choose 1-5</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DOMAINS.map((d) => (
                <ToggleChip key={d.id} active={domains.includes(d.id)} onClick={() => toggle(domains, setDomains, d.id)}>
                  {d.label}
                </ToggleChip>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-ink-900 border border-ink-700 p-5">
            <div className="text-paper font-semibold">Goals</div>
            <div className="text-paper-dim text-sm mt-1">Choose 1-4</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <ToggleChip key={g.id} active={goals.includes(g.id)} onClick={() => toggle(goals, setGoals, g.id)}>
                  {g.label}
                </ToggleChip>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              disabled={!canSubmit || saving}
              onClick={onSubmit}
              className="h-11 px-5 rounded-full bg-ink-800 border border-ink-700 text-paper hover:bg-ink-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Finish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingPage;
