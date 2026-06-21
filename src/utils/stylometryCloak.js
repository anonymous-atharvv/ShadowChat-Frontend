/**
 * Stylometry Cloaker Utility
 * Modifies writing styles to anonymize syntactic fingerprints.
 */

export function cloakText(text, style) {
  if (!text || !text.trim()) return '';

  if (style === 'leetspeak') {
    return text
      .replace(/[aA]/g, '4')
      .replace(/[eE]/g, '3')
      .replace(/[gG]/g, '6')
      .replace(/[iI]/g, '1')
      .replace(/[oO]/g, '0')
      .replace(/[sS]/g, '5')
      .replace(/[tT]/g, '7');
  }

  if (style === 'cyberpunk') {
    const slang = [
      { r: /\b(friend|bro|dude|buddy|guy)\b/gi, w: 'choomba' },
      { r: /\b(money|cash|dollars)\b/gi, w: 'eddies' },
      { r: /\b(computer|laptop|phone|mobile)\b/gi, w: 'deck' },
      { r: /\b(cool|awesome|great|nice)\b/gi, w: 'preem' },
      { r: /\b(bad|terrible|dead|killed)\b/gi, w: 'flatlined' },
      { r: /\b(police|cop|cops)\b/gi, w: 'NCPD' },
      { r: /\b(hacker|hack|hacking)\b/gi, w: 'netrunner' }
    ];
    let res = text;
    slang.forEach(s => {
      res = res.replace(s.r, s.w);
    });
    return `[DECK_LINK] ${res} // SECURE_LINE`;
  }

  if (style === 'diplomatic') {
    const formalMap = [
      { r: /\b(hey|hi|hello|yo)\b/gi, w: 'Salutations and greetings' },
      { r: /\b(what's up|how's it going|how are you)\b/gi, w: 'I hope this correspondence finds you in optimal standing' },
      { r: /\b(yes|yeah|yup|ok|okay)\b/gi, w: 'Affirmative, this is fully aligned with my parameters' },
      { r: /\b(no|nope|nah)\b/gi, w: 'Regrettably, I must decline this proposition' },
      { r: /\b(thanks|thank you)\b/gi, w: 'I express my utmost gratitude for your assistance' },
      { r: /\b(sorry|my bad)\b/gi, w: 'Please accept my humblest apologies for this oversight' },
      { r: /\b(bye|goodbye|see ya)\b/gi, w: 'I bid you farewell until our next scheduled interaction' }
    ];
    let res = text;
    formalMap.forEach(f => {
      res = res.replace(f.r, f.w);
    });
    
    // Capitalize first letter and append formal ending if not present
    res = res.trim();
    const finalStr = res.charAt(0).toUpperCase() + res.slice(1);
    return `${finalStr}. Respectfully submitted.`;
  }

  return text;
}
