import type { SkillManifest } from '@coop/shared';
import { validateSkillManifest } from '@coop/shared';
import { parseSkillMarkdown } from './skill-markdown';

export type RegisteredSkill = {
  manifest: SkillManifest;
  instructions: string;
  instructionMeta: {
    name: string;
    description: string;
  };
};

const manifestModules = import.meta.glob('../skills/*/skill.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const instructionModules = import.meta.glob('../skills/*/SKILL.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function skillIdFromPath(path: string) {
  const match = path.match(/\/skills\/([^/]+)\//);
  return match?.[1];
}

function buildRegistry() {
  const skills = new Map<string, RegisteredSkill>();
  const instructionMap = new Map(
    Object.entries(instructionModules)
      .map(([path, raw]) => [skillIdFromPath(path), raw] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])),
  );

  for (const [path, rawManifest] of Object.entries(manifestModules)) {
    const skillId = skillIdFromPath(path);
    if (!skillId) {
      continue;
    }

    const rawInstructions = instructionMap.get(skillId);
    if (!rawInstructions) {
      throw new Error(`Skill "${skillId}" is missing SKILL.md instructions.`);
    }

    const manifest = validateSkillManifest(rawManifest);
    if (manifest.id !== skillId) {
      throw new Error(`Skill manifest id "${manifest.id}" does not match directory "${skillId}".`);
    }
    if (manifest.inputSchemaRef !== 'agent-observation') {
      throw new Error(`Skill "${skillId}" must use the agent-observation input schema.`);
    }

    const parsedInstructions = parseSkillMarkdown(rawInstructions);
    if (!parsedInstructions.frontmatter.name || !parsedInstructions.frontmatter.description) {
      throw new Error(
        `Skill "${skillId}" must declare name and description in SKILL.md frontmatter.`,
      );
    }
    if (!parsedInstructions.body.trim()) {
      throw new Error(`Skill "${skillId}" has empty SKILL.md instructions.`);
    }

    skills.set(skillId, {
      manifest,
      instructions: parsedInstructions.body,
      instructionMeta: {
        name: parsedInstructions.frontmatter.name,
        description: parsedInstructions.frontmatter.description,
      },
    });
  }

  return [...skills.values()].sort((left, right) =>
    left.manifest.id.localeCompare(right.manifest.id),
  );
}

const registry = buildRegistry();

export function listRegisteredSkills() {
  return registry;
}

export function getRegisteredSkill(skillId: string) {
  return registry.find((entry) => entry.manifest.id === skillId);
}
