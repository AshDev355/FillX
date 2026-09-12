function cleanKeywords(keywords) {
  return String(keywords || '')
    .split(',')
    .map((item) => item.trim().replace(/crochete/gi, 'crochet'))
    .filter(Boolean);
}

export function classifyQuestion(question) {
  const text = String(question || '').toLowerCase();
  if (/hobby|hobbies|favorite hobby|favourite hobby|free time|weekend/.test(text)) return 'personal-interest';
  if (/tell us about yourself|personal bio|about you|introduce yourself/.test(text)) return 'personal-bio';
  if (/why (do you want|are you interested)|motivat|why should we hire|why this (role|company)/.test(text)) return 'professional-motivation';
  if (/experience|responsibilit|achievement|strength|skill|project/.test(text)) return 'professional-experience';
  return 'general';
}

export function generateLocalAnswer(question, keywords, profile = {}) {
  const topic = classifyQuestion(question);
  const items = cleanKeywords(keywords);
  const list = items.length > 1
    ? `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
    : items[0] || 'learning new things';
  const personal = profile.personal || {};
  const experience = Array.isArray(profile.experience) ? profile.experience[0] || {} : {};
  const role = experience.title ? `${experience.title}${experience.company ? ` at ${experience.company}` : ''}` : 'my current role';

  switch (topic) {
    case 'personal-interest':
      return `In my free time, I enjoy ${list}. These hobbies give me a creative way to relax, stay curious, and keep learning outside of work.`;
    case 'personal-bio':
      return `I am ${personal.fullName || [personal.firstName, personal.lastName].filter(Boolean).join(' ') || 'a curious and motivated person'}. I enjoy ${list} and bring that same curiosity and care to the things I do.`;
    case 'professional-motivation':
      return `I am interested in this opportunity because it would let me build on my experience as ${role} while contributing through ${list}. I am excited to learn, collaborate, and make a meaningful contribution to the team.`;
    case 'professional-experience':
      return `My experience as ${role} has helped me develop practical strengths in ${list}. I approach new challenges thoughtfully, communicate clearly, and focus on delivering dependable results.`;
    default:
      return `I would describe myself as thoughtful, curious, and eager to grow. My main areas of interest include ${list}, and I enjoy applying what I learn in practical ways.`;
  }
}
