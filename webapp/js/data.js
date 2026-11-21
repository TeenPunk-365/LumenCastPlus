export const TRACKS = Object.freeze([
  { id: "t1", title: "Утренний брифинг: технологии", artist: "Студия Lumen", duration: 214, color: ["#6b879f", "#b9c7d3"], cover: "🎙️" },
  { id: "t2", title: "Дизайн, который слышат", artist: "Анна Воронова", duration: 198, color: ["#8c8a84", "#d2cdc3"], cover: "🎧" },
  { id: "t3", title: "История одного стартапа", artist: "Бизнес по полочкам", duration: 176, color: ["#7b93b0", "#d8cfc0"], cover: "💡" },
  { id: "t4", title: "Как читать больше", artist: "Книжный разговор", duration: 223, color: ["#9a9083", "#ddd4c5"], cover: "📚" },
  { id: "t5", title: "Город и его ритм", artist: "Звуки города", duration: 205, color: ["#5f7f99", "#c9d6df"], cover: "🏙️" },
  { id: "t6", title: "Психология привычек", artist: "Простой смысл", duration: 242, color: ["#8a98a6", "#e0d8cb"], cover: "🧠" },
  { id: "t7", title: "Новости недели", artist: "Lumen Daily", duration: 189, color: ["#728da5", "#d4cbbb"], cover: "📰" },
  { id: "t8", title: "Интервью: путь автора", artist: "За микрофоном", duration: 231, color: ["#7f8790", "#d7d0c4"], cover: "🎤" },
]);

export const PLAYLISTS = Object.freeze([
  { id: "p1", title: "Ежедневный подкаст", subtitle: "Свежие выпуски каждый день", color: ["#6f8fa9", "#cfdbe4"], icon: "☕", trackIds: ["t1", "t7", "t8", "t5"] },
  { id: "p2", title: "Умные разговоры", subtitle: "Идеи, книги и саморазвитие", color: ["#8f8a82", "#ddd4c6"], icon: "💬", trackIds: ["t4", "t6", "t3"] },
  { id: "p3", title: "Вечерние истории", subtitle: "Спокойные истории для отдыха", color: ["#7a90a3", "#d8d0c3"], icon: "🌙", trackIds: ["t8", "t4", "t5"] },
  { id: "p4", title: "Топ выпусков", subtitle: "Самое популярное на этой неделе", color: ["#6482a0", "#d3dde5"], icon: "📈", trackIds: ["t5", "t1", "t6", "t7"] },
  { id: "p5", title: "Для фокуса", subtitle: "Спокойные подкасты для работы", color: ["#88949e", "#ddd5c8"], icon: "🎧", trackIds: ["t6", "t2", "t7"] },
  { id: "p6", title: "Новое в LumenCast", subtitle: "Недавние релизы и подборки", color: ["#7f96aa", "#d9d1c4"], icon: "✨", trackIds: ["t2", "t8", "t3"] },
]);

export const ARTISTS = Object.freeze([
  { id: "a1", title: "Студия Lumen", subtitle: "Автор", color: ["#6f8fa9", "#c8d8e3"], icon: "L", round: true },
  { id: "a2", title: "Анна Воронова", subtitle: "Автор", color: ["#8b877f", "#d9d1c3"], icon: "А", round: true },
  { id: "a3", title: "Lumen Daily", subtitle: "Автор", color: ["#728da5", "#d1dbe3"], icon: "D", round: true },
]);

export const CATEGORIES = Object.freeze([
  { name: "Новости", color: "#d8ccb9", icon: "📰" },
  { name: "Технологии", color: "#c8d8e3", icon: "💻" },
  { name: "Бизнес", color: "#ddd2c2", icon: "📊" },
  { name: "Культура", color: "#d2dde6", icon: "🎭" },
  { name: "Образование", color: "#ddd6ca", icon: "📚" },
  { name: "Истории", color: "#cfdbe4", icon: "🎙️" },
  { name: "Психология", color: "#d8d0c1", icon: "🧠" },
  { name: "Интервью", color: "#ccd7df", icon: "🎤" },
]);
