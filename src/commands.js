// Alias de los comandos en los diez idiomas de la web (es, en, ca, fr, pt, de,
// it, ru, ar y zh).
//
// El router sigue comparando con los nombres de siempre en castellano; lo único
// que hace esto es traducir lo que escribe la gente a ese nombre canónico antes
// de mirar nada. Así `!claw homework` y `!claw deberes` acaban en el mismo sitio.
//
// Todo se compara normalizado (minúsculas y sin acentos), igual que en router.js.

const ALIAS = {
  ayuda: ['help', 'ajuda', 'aide', 'hilfe', 'aiuto', 'помощь', 'مساعدة', '帮助'],
  estado: ['status', 'estat', 'statut', 'zustand', 'stato', 'состояние', 'الحالة', '状态'],
  ia: ['ai', 'ki', 'model', 'modello', 'ии', 'модель', 'نموذج', 'ذكاء', '模型', '人工智能'],
  aqui: ['here', 'join', 'aquí', 'aci', 'ici', 'aqui', 'hier', 'qui', 'здесь', 'هنا', '这里'],
  fuera: ['leave', 'quit', 'fora', 'quitter', 'sortir', 'sair', 'verlassen', 'esci', 'выйти', 'خروج', '离开'],
  ajustes: [
    'settings', 'config', 'ajustos', 'reglages', 'réglages', 'einstellungen', 'impostazioni',
    'настройки', 'إعدادات', '设置'
  ],
  admins: ['админы', 'مشرفون', '管理员'],
  prohibir: ['block', 'ban', 'bloquear', 'bloquer', 'sperren', 'blocca', 'запретить', 'حظر', '屏蔽'],
  permitir: [
    'unblock', 'allow', 'desbloquear', 'debloquer', 'débloquer', 'permetre', 'entsperren', 'sblocca',
    'разрешить', 'إلغاء', '取消屏蔽'
  ],
  vetados: [
    'blocked', 'banned', 'bloqueados', 'bloques', 'bloqués', 'vetats', 'gesperrt', 'bloccati',
    'заблокированы', 'محظورون', '已屏蔽'
  ],
  mantenimiento: [
    'maintenance', 'manteniment', 'manutencao', 'manutenção', 'wartung', 'manutenzione',
    'обслуживание', 'صيانة', '维护'
  ],
  apuntes: ['notes', 'apunts', 'notas', 'notizen', 'appunti', 'записи', 'ملاحظات', '笔记'],
  palabrotas: ['swears', 'swear', 'insults', 'fluchtworte', 'tacchi', 'ругательства', 'شتائم', '脏话'],
  apunta: ['add', 'apuntar', 'ajoute', 'adiciona', 'hinzufügen', 'aggiungi', 'добавь', 'أضف', '添加'],
  deberes: [
    'homework', 'hw', 'deures', 'devoirs', 'deveres', 'hausaufgaben', 'compiti', 'домашние', 'واجبات', '作业'
  ],
  examenes: [
    'exams', 'exam', 'examens', 'controles', 'provas', 'klausuren', 'prüfungen', 'verifiche', 'экзамены',
    'امتحانات', '考试'
  ],
  proximo: [
    'next', 'proper', 'prochain', 'próximo', 'nächste', 'nächster', 'prossimo', 'следующее',
    'ближайшее', 'التالي', '下一个'
  ],
  calendario: ['calendar', 'calendari', 'calendrier', 'kalender', 'календарь', 'تقويم', '日历'],
  olvida: ['forget', 'oblida', 'oublie', 'esquece', 'vergiss', 'dimentica', 'забудь', 'انس', '忘记'],
  hecho: ['done', 'fet', 'fait', 'feito', 'erledigt', 'fatto', 'готово', 'تم', '完成'],
  resumen: [
    'summary', 'resum', 'résumé', 'resume', 'resumo', 'zusammenfassung', 'riassunto', 'сводка', 'ملخص',
    '摘要'
  ],
  novedades: ['news', 'changelog', 'neuigkeiten', 'nouveautés', 'novità', 'новости', 'جديد', '更新'],
  busca: ['search', 'cerca', 'cherche', 'suche', 'поиск', 'ابحث', '搜索'],
  ajedrez: ['chess', 'escacs', 'echecs', 'échecs', 'xadrez', 'schach', 'scacchi', 'шахматы', 'شطرنج', '国际象棋'],
  analiza: ['analyze', 'analyse', 'analitza', 'analisa', 'analysiere', 'analizza', 'анализ', 'تحليل', '分析'],
  personalidad: [
    'personality', 'personalitat', 'personnalite', 'personalidade', 'persoenlichkeit',
    'personalita', 'личность', 'شخصية', '个性'
  ]
};

/** Minúsculas y sin acentos, igual que `sinAcentos` del router. */
function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const INDICE = new Map();
for (const [canonico, alias] of Object.entries(ALIAS)) {
  INDICE.set(norm(canonico), canonico);
  for (const palabra of alias) INDICE.set(norm(palabra), canonico);
}

/**
 * Devuelve el nombre canónico del comando (el que entiende el router) o el
 * mismo texto si no es un alias conocido.
 */
export function resolverComando(token) {
  const t = norm(token);
  return INDICE.get(t) || t;
}

// Palabras de "sí" y "no" en los diez idiomas, para los ajustes y el modo
// mantenimiento (`!claw maintenance ja/nein`, `!claw ajustes fotos yes`...).
const SI = ['si', 'sí', 'yes', 'true', 'on', 'sip', 'ja', 'oui', 'sim', 'sì', 'да', 'نعم', '是', '开'];
const NO = ['no', 'false', 'off', 'nein', 'nei', 'non', 'нет', 'لا', '否', '关'];
const SI_NORM = new Set(SI.map(norm));
const NO_NORM = new Set(NO.map(norm));

/** true/false si el texto es un "sí" o un "no" en cualquiera de los idiomas. */
export function valorSiNo(texto) {
  const t = norm(texto).trim();
  if (SI_NORM.has(t)) return true;
  if (NO_NORM.has(t)) return false;
  return null;
}

// "hoy" y "semana" para `!claw resumen ...`.
const HOY = ['hoy', 'today', 'avui', 'hoje', 'heute', 'oggi', 'сегодня', 'اليوم', '今天', '今日'];
const SEMANA = [
  'semana', 'week', 'setmana', 'semaine', 'woche', 'settimana', 'неделя', 'الأسبوع', 'اسبوع', '本周', '一周'
];

/** Días del resumen: 1 si es de hoy, 7 si es de la semana, 3 por defecto. */
export function diasDeResumen(texto) {
  const t = norm(texto);
  const palabras = t.split(/\s+/).filter(Boolean);
  if (HOY.some((w) => palabras.includes(w) || t.includes(w))) return 1;
  if (SEMANA.some((w) => palabras.includes(w) || t.includes(w)) || /(^|\s)7(\s|$)/.test(t)) return 7;
  return 3;
}
