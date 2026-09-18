export interface NlTopicDef {
  topic: string;
  patterns: string[];
}

export interface NlPackConfig {
  entityWord: string;
  topics: NlTopicDef[];
}

export interface NlIntent {
  view: "lanes" | "lane" | "brief" | "upload" | "help";
  lane?: string;
  weekOffset?: number;
  topic?: string;
}

export function parseQueryGeneric(raw: string, config: NlPackConfig): NlIntent {
  const q = raw.toLowerCase().trim();
  const weekOffset = /last week/.test(q) ? -1 : 0;

  if (/\b(upload|import|connect|add (a )?file|new file)\b/.test(q)) return { view: "upload" };
  if (/\b(brief|monday|report|summary|digest)\b/.test(q)) return { view: "brief", weekOffset };

  const entityRe = new RegExp(`\\b${config.entityWord}\\s+(.+?)(?:\\s+(last|this)\\s+week)?$`);
  const entityMatch = q.match(entityRe);
  if (entityMatch) return { view: "lane", lane: entityMatch[1].trim(), weekOffset };

  for (const def of config.topics) {
    const re = new RegExp(`\\b(${def.patterns.join("|")})\\b`);
    if (re.test(q)) return { view: "lanes", topic: def.topic, weekOffset };
  }
  if (/\b help\b/.test(q) || q === "help" || /\bhow do i\b/.test(q)) return { view: "help" };

  return { view: "lanes", weekOffset };
}
