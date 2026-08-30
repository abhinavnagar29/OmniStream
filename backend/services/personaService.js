const PERSONAS = [
  {
    id: 'tech_learner',
    name: 'Tech Learner',
    description: 'AI + startups + long-form learning',
    preferences: {
      video: { interested: true, categories: 'ai,ml,technology,startups' },
      podcast: { interested: true, categories: 'ai,engineering,startups' },
      news: { neutral: true, categories: 'technology,ai,finance' },
      music: { neutral: true, categories: 'lo-fi,focus' },
      movie: { neutral: true, categories: 'sci-fi,space' },
    },
  },
  {
    id: 'sports_fan',
    name: 'Sports Fan',
    description: 'Cricket highlights + sports news + hype music',
    preferences: {
      video: { interested: true, categories: 'sports,cricket,highlights' },
      news: { interested: true, categories: 'sports,cricket' },
      podcast: { neutral: true, categories: 'sports' },
      music: { interested: true, categories: 'anthem,hype,workout' },
    },
  },
  {
    id: 'wellness',
    name: 'Wellness',
    description: 'Relaxing content + mindfulness + calm music',
    preferences: {
      music: { interested: true, categories: 'wellness,meditation,relaxing,sleep' },
      podcast: { interested: true, categories: 'wellness,mindfulness' },
      news: { neutral: true, categories: 'wellness' },
      video: { neutral: true, categories: 'meditation' },
    },
  },
  {
    id: 'finance_news',
    name: 'Finance & News',
    description: 'Markets + economy + staying updated',
    preferences: {
      news: { interested: true, categories: 'finance,economy,markets' },
      podcast: { interested: true, categories: 'finance,markets' },
      video: { neutral: true, categories: 'economy' },
    },
  },
  {
    id: 'sci_fi',
    name: 'Sci-Fi & Space',
    description: 'Space + science + sci-fi across domains',
    preferences: {
      movie: { interested: true, categories: 'space,sci-fi' },
      video: { interested: true, categories: 'space,science' },
      podcast: { neutral: true, categories: 'space,science' },
      news: { neutral: true, categories: 'space,science' },
    },
  },
];

function listPersonas() {
  return PERSONAS.map(({ preferences, ...rest }) => rest);
}

function getPersona(id) {
  return PERSONAS.find((p) => p.id === id);
}

async function seedPersonaIfEmpty(store, userId, personaId) {
  const existing = await store.getPreferences(userId);
  if (existing && Object.keys(existing).length > 0) return false;

  const persona = getPersona(personaId);
  if (!persona) return false;

  for (const [domain, prefs] of Object.entries(persona.preferences)) {
    await store.setDomainPreferences(domain, prefs, userId);
  }

  return true;
}

module.exports = { listPersonas, getPersona, seedPersonaIfEmpty };
