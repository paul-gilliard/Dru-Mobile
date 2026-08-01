/** Mêmes règles que Easy Bilan (_classify_exercise côté API). */

export type SeriesLike = {
  series_number: number | null;
  reps: number | null;
  load: number | null;
};

export type SeriesVerdict = 'regression' | 'same' | 'progress' | 'incomplete';
export type ExerciseVerdict = 'regression' | 'review' | 'stagnation' | 'progress';

export type ClassifyRow = {
  num: number;
  c_load: number | null;
  c_reps: number | null;
  p_load: number | null;
  p_reps: number | null;
  verdict: SeriesVerdict;
};

export type ClassifyResult = {
  verdict: ExerciseVerdict;
  cur_date: string;
  prev_date: string;
  rows: ClassifyRow[];
  stats: {
    count_progress: number;
    count_regression: number;
    count_same: number;
    cur_tonnage: number;
    prev_tonnage: number;
    tonnage_diff: number;
  };
};

export function classifyExercise(
  curSeries: SeriesLike[],
  prevSeries: SeriesLike[],
  curDate: string,
  prevDate: string,
): ClassifyResult {
  const curBy = new Map<number, SeriesLike>();
  const prevBy = new Map<number, SeriesLike>();
  for (const s of curSeries) {
    if (s.series_number != null) curBy.set(s.series_number, s);
  }
  for (const s of prevSeries) {
    if (s.series_number != null) prevBy.set(s.series_number, s);
  }

  const allNums = new Set([...curBy.keys(), ...prevBy.keys()]);
  const paired = [...allNums].filter((n) => curBy.has(n) && prevBy.has(n)).sort((a, b) => a - b);

  const rows: ClassifyRow[] = [];
  let count_progress = 0;
  let count_regression = 0;
  let count_same = 0;
  let cur_tonnage = 0;
  let prev_tonnage = 0;

  for (const num of paired) {
    const c = curBy.get(num)!;
    const p = prevBy.get(num)!;
    const c_load = c.load;
    const p_load = p.load;
    const c_reps = c.reps;
    const p_reps = p.reps;
    let verdict: SeriesVerdict = 'incomplete';
    if (c_load != null && p_load != null && c_reps != null && p_reps != null) {
      const same_load = c_load === p_load;
      const same_reps = c_reps === p_reps;
      cur_tonnage += c_load * c_reps;
      prev_tonnage += p_load * p_reps;
      if (c_load < p_load || (same_load && c_reps < p_reps)) {
        verdict = 'regression';
        count_regression += 1;
      } else if (same_load && same_reps) {
        verdict = 'same';
        count_same += 1;
      } else {
        verdict = 'progress';
        count_progress += 1;
      }
    }
    rows.push({ num, c_load, c_reps, p_load, p_reps, verdict });
  }

  const tonnage_diff = cur_tonnage - prev_tonnage;
  const total_counted = count_progress + count_regression + count_same;

  let verdict: ExerciseVerdict;
  if (total_counted === 0) verdict = 'progress';
  else if (count_progress === 0 && count_regression === 0) verdict = 'stagnation';
  else if (count_progress > count_regression) verdict = tonnage_diff < 0 ? 'review' : 'progress';
  else if (count_regression > count_progress) verdict = tonnage_diff > 0 ? 'review' : 'regression';
  else if (tonnage_diff > 0) verdict = 'progress';
  else if (tonnage_diff < 0) verdict = 'regression';
  else verdict = 'stagnation';

  return {
    verdict,
    cur_date: curDate,
    prev_date: prevDate,
    rows,
    stats: {
      count_progress,
      count_regression,
      count_same,
      cur_tonnage: Math.round(cur_tonnage * 10) / 10,
      prev_tonnage: Math.round(prev_tonnage * 10) / 10,
      tonnage_diff: Math.round(tonnage_diff * 10) / 10,
    },
  };
}

export function verdictLabel(v: ExerciseVerdict): string {
  switch (v) {
    case 'progress': return '↑ Progrès';
    case 'regression': return '↓ Régression';
    case 'stagnation': return '→ Stagnation';
    case 'review': return '👀 Vue coach';
  }
}

export function verdictColor(v: ExerciseVerdict, palette: {
  success: string; danger: string; warning: string; violet: string;
}): string {
  switch (v) {
    case 'progress': return palette.success;
    case 'regression': return palette.danger;
    case 'stagnation': return palette.warning;
    case 'review': return palette.violet;
  }
}
