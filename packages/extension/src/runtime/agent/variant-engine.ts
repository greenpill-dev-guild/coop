import { type CoopDexie, type SkillVariant, skillVariantSchema } from '@coop/shared';

function buildVariantId() {
  return `skill-variant-${crypto.randomUUID()}`;
}

function sortVariantsByActivation(variants: SkillVariant[]) {
  return [...variants].sort((left, right) => {
    const leftActivatedAt = left.activatedAt ?? left.createdAt;
    const rightActivatedAt = right.activatedAt ?? right.createdAt;
    return rightActivatedAt - leftActivatedAt;
  });
}

async function hashPrompt(promptText: string) {
  const encoded = new TextEncoder().encode(promptText);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function listVariantsForSkill(db: CoopDexie, skillId: string) {
  return db.skillVariants.where('skillId').equals(skillId).toArray();
}

export async function getBaselineVariant(db: CoopDexie, skillId: string) {
  const variants = await listVariantsForSkill(db, skillId);
  return variants.find((variant) => variant.isBaseline) ?? null;
}

export async function createVariant(
  db: CoopDexie,
  skillId: string,
  promptText: string,
  parentVariantId?: string,
) {
  const promptHash = await hashPrompt(promptText);
  const existing = (await db.skillVariants.where('promptHash').equals(promptHash).toArray()).find(
    (variant) => variant.skillId === skillId,
  );
  if (existing) {
    return existing;
  }

  const variant = skillVariantSchema.parse({
    id: buildVariantId(),
    skillId,
    promptText,
    promptHash,
    isActive: false,
    isBaseline: false,
    parentVariantId: parentVariantId ?? null,
    compositeScore: null,
    createdAt: Date.now(),
    activatedAt: null,
  });

  await db.skillVariants.put(variant);
  return variant;
}

export async function getActiveVariant(db: CoopDexie, skillId: string) {
  const variants = await listVariantsForSkill(db, skillId);
  const active = sortVariantsByActivation(variants.filter((variant) => variant.isActive))[0];
  if (active) {
    return active;
  }
  return variants.find((variant) => variant.isBaseline) ?? null;
}

export async function activateVariant(db: CoopDexie, variantId: string) {
  return db.transaction('rw', db.skillVariants, async () => {
    const target = await db.skillVariants.get(variantId);
    if (!target) {
      throw new Error(`Variant "${variantId}" was not found.`);
    }

    const now = Date.now();
    // Deactivate the currently active variant (if any, and if different from target)
    const currentlyActive = (await listVariantsForSkill(db, target.skillId)).filter(
      (v) => v.isActive && v.id !== target.id,
    );
    for (const prev of currentlyActive) {
      await db.skillVariants.put({ ...prev, isActive: false });
    }
    // Activate the target
    const activated = skillVariantSchema.parse({
      ...target,
      isActive: true,
      activatedAt: now,
    });
    await db.skillVariants.put(activated);
    return activated;
  });
}

export async function revertToBaseline(db: CoopDexie, skillId: string) {
  return db.transaction('rw', db.skillVariants, async () => {
    const variants = await listVariantsForSkill(db, skillId);
    const baseline = variants.find((variant) => variant.isBaseline);
    if (!baseline) {
      throw new Error(`No baseline variant exists for skill "${skillId}".`);
    }

    const now = Date.now();
    // Deactivate any non-baseline active variants
    const toDeactivate = variants.filter((v) => v.isActive && v.id !== baseline.id);
    for (const prev of toDeactivate) {
      await db.skillVariants.put({ ...prev, isActive: false });
    }
    // Activate the baseline
    const activated = skillVariantSchema.parse({
      ...baseline,
      isActive: true,
      activatedAt: now,
    });
    await db.skillVariants.put(activated);
    return activated;
  });
}

export async function getVariantLineage(db: CoopDexie, variantId: string) {
  const lineage: SkillVariant[] = [];
  const visited = new Set<string>();
  let current = await db.skillVariants.get(variantId);

  while (current && !visited.has(current.id)) {
    lineage.push(current);
    visited.add(current.id);
    current = current.parentVariantId
      ? await db.skillVariants.get(current.parentVariantId)
      : undefined;
  }

  return lineage;
}

export function generateDiff(baselineText: string, variantText: string) {
  const baselineLines = baselineText.split('\n');
  const variantLines = variantText.split('\n');
  const maxLineCount = Math.max(baselineLines.length, variantLines.length);
  const diff = [
    '--- baseline',
    '+++ variant',
    `@@ -1,${baselineLines.length} +1,${variantLines.length} @@`,
  ];

  for (let index = 0; index < maxLineCount; index += 1) {
    const baselineLine = baselineLines[index];
    const variantLine = variantLines[index];

    if (baselineLine === variantLine) {
      if (baselineLine !== undefined) {
        diff.push(` ${baselineLine}`);
      }
      continue;
    }

    if (baselineLine !== undefined) {
      diff.push(`-${baselineLine}`);
    }
    if (variantLine !== undefined) {
      diff.push(`+${variantLine}`);
    }
  }

  return diff.join('\n');
}

export async function seedBaseline(db: CoopDexie, skillId: string, promptText: string) {
  const existingBaseline = (await listVariantsForSkill(db, skillId)).find(
    (variant) => variant.isBaseline,
  );
  if (existingBaseline) {
    return existingBaseline;
  }

  const created = await createVariant(db, skillId, promptText);
  const baseline = skillVariantSchema.parse({
    ...created,
    isActive: true,
    isBaseline: true,
    activatedAt: created.createdAt,
  });

  await db.skillVariants.put(baseline);
  return baseline;
}
