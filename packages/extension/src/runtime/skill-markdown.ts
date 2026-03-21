export type SkillMarkdownFrontmatter = {
  name: string;
  description: string;
};

export type ParsedSkillMarkdown = {
  frontmatter: SkillMarkdownFrontmatter;
  body: string;
  hasFrontmatter: boolean;
};

function stripYamlScalar(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSkillMarkdown(raw: string): ParsedSkillMarkdown {
  const trimmed = raw.trim();

  if (!trimmed.startsWith('---')) {
    return {
      frontmatter: { name: '', description: '' },
      body: trimmed,
      hasFrontmatter: false,
    };
  }

  const closingIndex = trimmed.indexOf('\n---', 3);
  if (closingIndex === -1) {
    return {
      frontmatter: { name: '', description: '' },
      body: trimmed,
      hasFrontmatter: false,
    };
  }

  const frontmatterBlock = trimmed.slice(3, closingIndex).trim();
  const body = trimmed.slice(closingIndex + 4).trim();

  let name = '';
  let description = '';

  for (const line of frontmatterBlock.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = stripYamlScalar(line.slice(colonIndex + 1));

    if (key === 'name') {
      name = value;
    } else if (key === 'description') {
      description = value;
    }
  }

  return {
    frontmatter: { name, description },
    body,
    hasFrontmatter: true,
  };
}
