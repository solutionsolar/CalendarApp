import { parseISO, addDays } from 'date-fns';

const DOW_ALIASES = {
  mon: 0,
  monday: 0,
  tue: 1,
  tues: 1,
  tuesday: 1,
  wed: 2,
  weds: 2,
  wednesday: 2,
  thu: 3,
  thur: 3,
  thurs: 3,
  thursday: 3,
  fri: 4,
  friday: 4,
  sat: 5,
  saturday: 5,
  sun: 6,
  sunday: 6
};

const TIME_RANGE_RE = /(?<!\d)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—to]{1,3}\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?!\d)/gi;
const SINGLE_TIME_RE = /(?<!\d)(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?!\d)/i;

function to24(h, m, meridiem) {
  let hours = parseInt(h, 10);
  const minutes = m ? parseInt(m, 10) : 0;
  const md = meridiem ? meridiem.toLowerCase() : undefined;
  if (md === 'pm' && hours < 12) hours += 12;
  if (md === 'am' && hours === 12) hours = 0;
  return { hours, minutes };
}

function toggleMeridiem(md) {
  if (!md) return undefined;
  return md.toLowerCase() === 'am' ? 'pm' : 'am';
}

function inferRange(dayDate, sh, sm, smd, eh, em, emd) {
  // Normalize inputs
  let startMer = smd ? smd.toLowerCase() : undefined;
  let endMer = emd ? emd.toLowerCase() : undefined;

  // If one side is missing, inherit from the other
  if (!startMer && endMer) startMer = endMer;
  if (!endMer && startMer) endMer = startMer;

  // If both missing, favor typical work hours heuristic: 1-11 => pm, 12 => pm
  if (!startMer && !endMer) {
    const shNum = parseInt(sh, 10);
    const ehNum = parseInt(eh, 10);
    // Favor typical work hours: 12 => pm, 1..11 => pm
    startMer = (shNum === 12 || (shNum >= 1 && shNum <= 11)) ? 'pm' : 'am';
    endMer = (ehNum === 12 || (ehNum >= 1 && ehNum <= 11)) ? 'pm' : 'am';
  }

  // Convert using current meridiems
  let s = to24(sh, sm, startMer);
  let e = to24(eh, em, endMer);
  let start = new Date(dayDate);
  start.setHours(s.hours, s.minutes, 0, 0);
  let end = new Date(dayDate);
  end.setHours(e.hours, e.minutes, 0, 0);

  // If only one side originally had meridiem, we may need to adjust
  const startHad = !!smd;
  const endHad = !!emd;

  if (endHad && !startHad) {
    // If start >= end, flip start meridiem
    if (start >= end) {
      startMer = toggleMeridiem(endMer);
      s = to24(sh, sm, startMer);
      start = new Date(dayDate);
      start.setHours(s.hours, s.minutes, 0, 0);
    }
  } else if (startHad && !endHad) {
    if (end <= start) {
      endMer = toggleMeridiem(startMer);
      e = to24(eh, em, endMer);
      end = new Date(dayDate);
      end.setHours(e.hours, e.minutes, 0, 0);
    }
  }

  // Final cross-midnight correction
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function toISOWithTime(baseDate, hours, minutes) {
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export function parseWeeklySchedule(text, weekStartISO, timezone) {
  const warnings = [];
  const weekStart = parseISO(weekStartISO);
  if (Number.isNaN(weekStart.getTime())) {
    return { blocks: [], warnings: ['Invalid weekStartISO'] };
  }

  // Split into lines, attempt to associate day headers with time ranges following them.
  const lines = text
    .split(/\r?\n/)
    .map(l => l.replace(/[|]/g, ' ').trim())
    .filter(Boolean);

  // Build a list of { dayOffset, text }
  const dayBuckets = [];
  let currentDayOffset = null;
  for (const line of lines) {
    const lower = line.toLowerCase();
    const dayKey = Object.keys(DOW_ALIASES).find(k => new RegExp(`(^|\b)${k}(\b|\W)`, 'i').test(lower));
    if (dayKey !== undefined && dayKey !== null) {
      currentDayOffset = DOW_ALIASES[dayKey];
      dayBuckets.push({ dayOffset: currentDayOffset, text: '' });
      continue;
    }
    if (currentDayOffset === null) {
      // If first lines include a time without day, assume starting day 0
      if (TIME_RANGE_RE.test(lower) || SINGLE_TIME_RE.test(lower)) {
        currentDayOffset = 0;
        dayBuckets.push({ dayOffset: 0, text: line });
      }
      continue;
    }
    const last = dayBuckets[dayBuckets.length - 1];
    if (last) last.text += (last.text ? ' ' : '') + line;
  }

  const blocks = [];
  for (const bucket of dayBuckets) {
    const dayDate = addDays(weekStart, bucket.dayOffset);
    const t = bucket.text || '';

    // Find all time ranges in text
    const matches = [...t.matchAll(TIME_RANGE_RE)];
    if (!matches.length) {
      // Try to interpret single time + duration like "9am-5pm" is preferred, but if only one time found, skip.
      const single = t.match(SINGLE_TIME_RE);
      if (single) warnings.push(`Only single time found for day offset ${bucket.dayOffset}: "${t}"`);
      continue;
    }
    for (const m of matches) {
      const [_, sh, sm, smd, eh, em, emd] = m;
      const { startISO, endISO } = inferRange(dayDate, sh, sm, smd, eh, em, emd);
      blocks.push({ start: startISO, end: endISO, timezone });
    }
  }

  return { blocks, warnings };
}

// Spatial parser: map words to weekday columns using header positions (e.g., SUN MON TUE ...)
export function parseWeeklyScheduleSpatial(ocrDocs, weekStartISO, timezone) {
  const warnings = [];
  const weekStart = parseISO(weekStartISO);
  if (Number.isNaN(weekStart.getTime())) return { blocks: [], warnings: ['Invalid weekStartISO'] };

  const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];

  const blocks = [];
  let usedSpatial = false;

  for (const doc of ocrDocs) {
    const words = (doc.words || []).filter(w => w.text);
    if (!words.length) continue;

    // Detect headers by exact match to day keys (case-insensitive)
    const headers = words
      .filter(w => dayKeys.includes(w.text.toLowerCase()))
      .map(w => ({
        key: w.text.toLowerCase(),
        x: (w.bbox.x0 + w.bbox.x1) / 2,
        y: (w.bbox.y0 + w.bbox.y1) / 2
      }));

    // If not enough headers, skip this doc
    const uniqueHeaderKeys = [...new Set(headers.map(h => h.key))];
    if (uniqueHeaderKeys.length < 3) {
      warnings.push('Spatial parse: insufficient weekday headers detected; falling back for this image.');
      continue;
    }

    // Choose one header per weekday: pick the highest (smallest y) occurrence as the column anchor
    const headerByDay = {};
    for (const key of dayKeys) {
      const candidates = headers.filter(h => h.key === key);
      if (candidates.length) {
        headerByDay[key] = candidates.sort((a,b) => a.y - b.y)[0];
      }
    }

    // Build column anchors (x positions) for days we found
    const anchors = Object.entries(headerByDay).map(([key, h]) => ({ key, x: h.x, y: h.y }));
    if (!anchors.length) continue;

    // Assign words to nearest day column by x, but only words below row of headers
    const minHeaderY = Math.min(...anchors.map(a => a.y));
    const columns = {};
    for (const a of anchors) columns[a.key] = [];

    for (const w of words) {
      const wy = (w.bbox.y0 + w.bbox.y1) / 2;
      if (wy <= minHeaderY + 10) continue; // skip header row and titles
      // skip words that themselves are day names
      if (dayKeys.includes(w.text.toLowerCase())) continue;
      const wx = (w.bbox.x0 + w.bbox.x1) / 2;
      let best = null;
      let bestDist = Infinity;
      for (const a of anchors) {
        const dx = Math.abs(wx - a.x);
        if (dx < bestDist) { bestDist = dx; best = a; }
      }
      if (best) columns[best.key].push(w);
    }

    // For each column, sort words by y then x and join to a text blob, then extract time ranges
    for (const key of Object.keys(columns)) {
      const colWords = columns[key].sort((a,b) => {
        const ay = (a.bbox.y0 + a.bbox.y1) / 2;
        const by = (b.bbox.y0 + b.bbox.y1) / 2;
        if (ay !== by) return ay - by;
        const ax = (a.bbox.x0 + a.bbox.x1) / 2;
        const bx = (b.bbox.x0 + b.bbox.x1) / 2;
        return ax - bx;
      });
      const text = colWords.map(w => w.text).join(' ');
      // Extract time ranges
      const matches = [...text.matchAll(TIME_RANGE_RE)];
      if (!matches.length) continue;
      const dayOffset = DOW_ALIASES[key];
      const dayDate = addDays(weekStart, dayOffset);
      for (const m of matches) {
        const [_, sh, sm, smd, eh, em, emd] = m;
        const { startISO, endISO } = inferRange(dayDate, sh, sm, smd, eh, em, emd);
        blocks.push({ start: startISO, end: endISO, timezone });
      }
    }
    usedSpatial = true;
  }

  if (!usedSpatial && blocks.length === 0) {
    return { blocks: [], warnings: warnings.concat(['Spatial parse did not apply; ensure day headers are visible in the screenshot.']) };
  }
  return { blocks, warnings };
}
