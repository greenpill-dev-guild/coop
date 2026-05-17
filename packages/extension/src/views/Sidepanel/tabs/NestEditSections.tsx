/**
 * Inline edit sections for the Nest members sub-tab.
 *
 * Extracted from NestTab.tsx — these collapsible card forms let members
 * edit the coop profile, soul, ritual, and setup insights.
 */

import type { CaptureMode, CoopSharedState, CoopSoul, SetupInsights } from '@coop/shared';
import { useEffect, useState } from 'react';
import type { SidepanelOrchestration } from '../hooks/useSidepanelOrchestration';

// ---------------------------------------------------------------------------
// Shared types & helpers
// ---------------------------------------------------------------------------

type CoreSoulPatch = Partial<
  Pick<
    CoopSoul,
    | 'purposeStatement'
    | 'whyThisCoopExists'
    | 'usefulSignalDefinition'
    | 'toneAndWorkingStyle'
    | 'artifactFocus'
  >
>;

type SetupEditFormState = {
  summary: string;
  capitalCurrent: string;
  capitalPain: string;
  capitalImprove: string;
  impactCurrent: string;
  impactPain: string;
  impactImprove: string;
  governanceCurrent: string;
  governancePain: string;
  governanceImprove: string;
  knowledgeCurrent: string;
  knowledgePain: string;
  knowledgeImprove: string;
};

type RitualEditFormState = {
  weeklyReviewCadence: string;
  namedMoments: string;
  facilitatorExpectation: string;
  defaultCapturePosture: string;
};

type MemoryCharter = NonNullable<CoopSoul['memoryCharter']>;

type MemoryCharterEditFormState = {
  goals: string;
  opportunityThesis: string;
  desiredSignals: string;
  antiSignals: string;
  evidenceStandards: string;
  vocabulary: string;
  prohibitedTopics: string;
  confidenceThreshold: string;
};

const setupLensFieldMap = [
  {
    lens: 'capital-formation',
    currentKey: 'capitalCurrent',
    painKey: 'capitalPain',
    improveKey: 'capitalImprove',
    title: 'Money & resources',
  },
  {
    lens: 'impact-reporting',
    currentKey: 'impactCurrent',
    painKey: 'impactPain',
    improveKey: 'impactImprove',
    title: 'Impact & outcomes',
  },
  {
    lens: 'governance-coordination',
    currentKey: 'governanceCurrent',
    painKey: 'governancePain',
    improveKey: 'governanceImprove',
    title: 'Decisions & teamwork',
  },
  {
    lens: 'knowledge-garden-resources',
    currentKey: 'knowledgeCurrent',
    painKey: 'knowledgePain',
    improveKey: 'knowledgeImprove',
    title: 'Knowledge & tools',
  },
] as const;

function listToMultiline(values: string[]) {
  return values.join('\n');
}

function multilineToList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createProfileEditForm(activeCoop: CoopSharedState) {
  return {
    name: activeCoop.profile.name,
    purpose: activeCoop.profile.purpose,
    captureMode: activeCoop.profile.captureMode,
  };
}

function createSoulEditForm(activeCoop: CoopSharedState) {
  const soul = activeCoop.soul;
  return {
    purposeStatement: soul?.purposeStatement ?? activeCoop.profile.purpose,
    whyThisCoopExists: soul?.whyThisCoopExists ?? '',
    usefulSignalDefinition: soul?.usefulSignalDefinition ?? '',
    toneAndWorkingStyle: soul?.toneAndWorkingStyle ?? '',
    artifactFocus: listToMultiline(soul?.artifactFocus ?? []),
  };
}

function createRitualEditForm(activeCoop: CoopSharedState): RitualEditFormState {
  const ritual = activeCoop.rituals[0];
  return {
    weeklyReviewCadence: ritual?.weeklyReviewCadence ?? '',
    namedMoments: listToMultiline(ritual?.namedMoments ?? []),
    facilitatorExpectation: ritual?.facilitatorExpectation ?? '',
    defaultCapturePosture: ritual?.defaultCapturePosture ?? '',
  };
}

function createMemoryCharterEditForm(activeCoop: CoopSharedState): MemoryCharterEditFormState {
  const charter = activeCoop.soul.memoryCharter;
  return {
    goals: listToMultiline(charter?.goals ?? [activeCoop.profile.purpose]),
    opportunityThesis:
      charter?.opportunityThesis ?? activeCoop.soul.whyThisCoopExists ?? activeCoop.profile.purpose,
    desiredSignals: listToMultiline(charter?.desiredSignals ?? activeCoop.soul.artifactFocus),
    antiSignals: listToMultiline(charter?.antiSignals ?? []),
    evidenceStandards: listToMultiline(
      charter?.evidenceStandards ?? [
        'Prefer member-approved artifacts before treating a memory as shared truth',
        'Keep source provenance visible on recommendations',
      ],
    ),
    vocabulary: listToMultiline(charter?.vocabulary ?? activeCoop.soul.vocabularyTerms),
    prohibitedTopics: listToMultiline(
      charter?.prohibitedTopics ?? activeCoop.soul.prohibitedTopics,
    ),
    confidenceThreshold: String(
      charter?.confidenceThreshold ?? activeCoop.soul.confidenceThreshold,
    ),
  };
}

function createSetupEditForm(activeCoop: CoopSharedState): SetupEditFormState {
  const lensById = new Map(
    (activeCoop.setupInsights?.lenses ?? []).map((lens) => [lens.lens, lens]),
  );

  return {
    summary: activeCoop.setupInsights?.summary ?? '',
    capitalCurrent: lensById.get('capital-formation')?.currentState ?? '',
    capitalPain: lensById.get('capital-formation')?.painPoints ?? '',
    capitalImprove: lensById.get('capital-formation')?.improvements ?? '',
    impactCurrent: lensById.get('impact-reporting')?.currentState ?? '',
    impactPain: lensById.get('impact-reporting')?.painPoints ?? '',
    impactImprove: lensById.get('impact-reporting')?.improvements ?? '',
    governanceCurrent: lensById.get('governance-coordination')?.currentState ?? '',
    governancePain: lensById.get('governance-coordination')?.painPoints ?? '',
    governanceImprove: lensById.get('governance-coordination')?.improvements ?? '',
    knowledgeCurrent: lensById.get('knowledge-garden-resources')?.currentState ?? '',
    knowledgePain: lensById.get('knowledge-garden-resources')?.painPoints ?? '',
    knowledgeImprove: lensById.get('knowledge-garden-resources')?.improvements ?? '',
  };
}

function buildSoulPatch(form: ReturnType<typeof createSoulEditForm>): CoreSoulPatch {
  return {
    purposeStatement: form.purposeStatement,
    whyThisCoopExists: form.whyThisCoopExists,
    usefulSignalDefinition: form.usefulSignalDefinition,
    toneAndWorkingStyle: form.toneAndWorkingStyle,
    artifactFocus: multilineToList(form.artifactFocus),
  };
}

function parseConfidenceThreshold(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, parsed));
}

function buildMemoryCharterPatch(
  form: MemoryCharterEditFormState,
  current: MemoryCharter | undefined,
  fallback: CoopSharedState,
): MemoryCharter {
  return {
    version: 1,
    goals: multilineToList(form.goals),
    opportunityThesis:
      form.opportunityThesis.trim() ||
      current?.opportunityThesis ||
      fallback.soul.whyThisCoopExists ||
      fallback.profile.purpose,
    desiredSignals: multilineToList(form.desiredSignals),
    antiSignals: multilineToList(form.antiSignals),
    evidenceStandards: multilineToList(form.evidenceStandards),
    vocabulary: multilineToList(form.vocabulary),
    prohibitedTopics: multilineToList(form.prohibitedTopics),
    confidenceThreshold: parseConfidenceThreshold(
      form.confidenceThreshold,
      current?.confidenceThreshold ?? fallback.soul.confidenceThreshold,
    ),
    updatedAt: new Date().toISOString(),
    updatedByMemberId: current?.updatedByMemberId,
  };
}

function buildSetupInsightsPatch(
  form: SetupEditFormState,
  currentSetupInsights?: Pick<
    SetupInsights,
    'crossCuttingPainPoints' | 'crossCuttingOpportunities'
  >,
): SetupInsights {
  const lenses = setupLensFieldMap.map(({ lens, currentKey, painKey, improveKey }) => ({
    lens,
    currentState: form[currentKey].trim(),
    painPoints: form[painKey].trim(),
    improvements: form[improveKey].trim(),
  }));

  return {
    summary: form.summary.trim(),
    crossCuttingPainPoints: currentSetupInsights?.crossCuttingPainPoints ?? [],
    crossCuttingOpportunities: currentSetupInsights?.crossCuttingOpportunities ?? [],
    lenses,
  };
}

// ---------------------------------------------------------------------------
// NestProfileSection
// ---------------------------------------------------------------------------

export function NestProfileSection({
  activeCoop,
  updateCoopDetails,
}: {
  activeCoop: CoopSharedState;
  updateCoopDetails: SidepanelOrchestration['updateCoopDetails'];
}) {
  const [profileForm, setProfileForm] = useState(() => createProfileEditForm(activeCoop));

  useEffect(() => {
    setProfileForm(createProfileEditForm(activeCoop));
  }, [activeCoop]);

  const hasChanges =
    profileForm.name !== activeCoop.profile.name ||
    profileForm.purpose !== activeCoop.profile.purpose ||
    profileForm.captureMode !== activeCoop.profile.captureMode;

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Profile</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-profile-name">Coop name</label>
          <input
            id="edit-profile-name"
            value={profileForm.name}
            onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-profile-purpose">Purpose</label>
          <textarea
            id="edit-profile-purpose"
            value={profileForm.purpose}
            onChange={(e) => setProfileForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-profile-capture-mode">Round-up timing</label>
          <select
            id="edit-profile-capture-mode"
            value={profileForm.captureMode}
            onChange={(e) =>
              setProfileForm((f) => ({ ...f, captureMode: e.target.value as CaptureMode }))
            }
          >
            <option value="manual">Only when I choose</option>
            <option value="5-min">Every 5 min</option>
            <option value="10-min">Every 10 min</option>
            <option value="15-min">Every 15 min</option>
            <option value="30-min">Every 30 min</option>
            <option value="60-min">Every 60 min</option>
          </select>
        </div>
        <button
          className="primary-button"
          disabled={!hasChanges}
          onClick={() => {
            const profile: {
              name?: string;
              purpose?: string;
              captureMode?: CaptureMode;
            } = {};
            if (profileForm.name !== activeCoop.profile.name) profile.name = profileForm.name;
            if (profileForm.purpose !== activeCoop.profile.purpose) {
              profile.purpose = profileForm.purpose;
            }
            if (profileForm.captureMode !== activeCoop.profile.captureMode) {
              profile.captureMode = profileForm.captureMode;
            }
            void updateCoopDetails({ profile });
          }}
          type="button"
        >
          Save changes
        </button>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// NestSoulSection
// ---------------------------------------------------------------------------

export function NestSoulSection({
  activeCoop,
  updateCoopDetails,
}: {
  activeCoop: CoopSharedState;
  updateCoopDetails: SidepanelOrchestration['updateCoopDetails'];
}) {
  const [soulForm, setSoulForm] = useState(() => createSoulEditForm(activeCoop));

  useEffect(() => {
    setSoulForm(createSoulEditForm(activeCoop));
  }, [activeCoop]);

  const initialSoul = createSoulEditForm(activeCoop);
  const hasChanges =
    JSON.stringify(buildSoulPatch(soulForm)) !== JSON.stringify(buildSoulPatch(initialSoul));

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Soul</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-soul-purpose">Purpose statement</label>
          <textarea
            id="edit-soul-purpose"
            value={soulForm.purposeStatement}
            onChange={(event) =>
              setSoulForm((current) => ({ ...current, purposeStatement: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-soul-why">Why this coop exists</label>
          <textarea
            id="edit-soul-why"
            value={soulForm.whyThisCoopExists}
            onChange={(event) =>
              setSoulForm((current) => ({ ...current, whyThisCoopExists: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-soul-signal">Useful signal definition</label>
          <textarea
            id="edit-soul-signal"
            value={soulForm.usefulSignalDefinition}
            onChange={(event) =>
              setSoulForm((current) => ({
                ...current,
                usefulSignalDefinition: event.target.value,
              }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-soul-tone">Tone and working style</label>
          <textarea
            id="edit-soul-tone"
            value={soulForm.toneAndWorkingStyle}
            onChange={(event) =>
              setSoulForm((current) => ({ ...current, toneAndWorkingStyle: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-soul-focus">Artifact focus</label>
          <textarea
            id="edit-soul-focus"
            value={soulForm.artifactFocus}
            onChange={(event) =>
              setSoulForm((current) => ({ ...current, artifactFocus: event.target.value }))
            }
          />
          <span className="helper-text">Use one line per focus area.</span>
        </div>
        <button
          className="primary-button"
          disabled={!hasChanges}
          onClick={() => {
            void updateCoopDetails({ soul: buildSoulPatch(soulForm) });
          }}
          type="button"
        >
          Save soul
        </button>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// NestMemoryCharterSection
// ---------------------------------------------------------------------------

export function NestMemoryCharterSection({
  activeCoop,
  updateCoopDetails,
}: {
  activeCoop: CoopSharedState;
  updateCoopDetails: SidepanelOrchestration['updateCoopDetails'];
}) {
  const [charterForm, setCharterForm] = useState(() => createMemoryCharterEditForm(activeCoop));

  useEffect(() => {
    setCharterForm(createMemoryCharterEditForm(activeCoop));
  }, [activeCoop]);

  const initialCharter = createMemoryCharterEditForm(activeCoop);
  const hasChanges = JSON.stringify(charterForm) !== JSON.stringify(initialCharter);

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Memory Charter</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-memory-goals">Goals</label>
          <textarea
            id="edit-memory-goals"
            value={charterForm.goals}
            onChange={(event) =>
              setCharterForm((current) => ({ ...current, goals: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-memory-thesis">Opportunity thesis</label>
          <textarea
            id="edit-memory-thesis"
            value={charterForm.opportunityThesis}
            onChange={(event) =>
              setCharterForm((current) => ({
                ...current,
                opportunityThesis: event.target.value,
              }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-memory-desired-signals">Desired signals</label>
          <textarea
            id="edit-memory-desired-signals"
            value={charterForm.desiredSignals}
            onChange={(event) =>
              setCharterForm((current) => ({ ...current, desiredSignals: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-memory-anti-signals">Anti-signals</label>
          <textarea
            id="edit-memory-anti-signals"
            value={charterForm.antiSignals}
            onChange={(event) =>
              setCharterForm((current) => ({ ...current, antiSignals: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-memory-evidence">Evidence standards</label>
          <textarea
            id="edit-memory-evidence"
            value={charterForm.evidenceStandards}
            onChange={(event) =>
              setCharterForm((current) => ({ ...current, evidenceStandards: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-memory-vocabulary">Vocabulary</label>
          <textarea
            id="edit-memory-vocabulary"
            value={charterForm.vocabulary}
            onChange={(event) =>
              setCharterForm((current) => ({ ...current, vocabulary: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-memory-prohibited">Prohibited topics</label>
          <textarea
            id="edit-memory-prohibited"
            value={charterForm.prohibitedTopics}
            onChange={(event) =>
              setCharterForm((current) => ({ ...current, prohibitedTopics: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-memory-threshold">Confidence threshold</label>
          <input
            id="edit-memory-threshold"
            max="1"
            min="0"
            step="0.01"
            type="number"
            value={charterForm.confidenceThreshold}
            onChange={(event) =>
              setCharterForm((current) => ({
                ...current,
                confidenceThreshold: event.target.value,
              }))
            }
          />
        </div>
        <button
          className="primary-button"
          disabled={!hasChanges}
          onClick={() => {
            void updateCoopDetails({
              soul: {
                memoryCharter: buildMemoryCharterPatch(
                  charterForm,
                  activeCoop.soul.memoryCharter,
                  activeCoop,
                ),
              },
            });
          }}
          type="button"
        >
          Save memory charter
        </button>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// NestRitualSection
// ---------------------------------------------------------------------------

export function NestRitualSection({
  activeCoop,
  updateMeetingSettings,
}: {
  activeCoop: CoopSharedState;
  updateMeetingSettings: SidepanelOrchestration['updateMeetingSettings'];
}) {
  const [ritualForm, setRitualForm] = useState(() => createRitualEditForm(activeCoop));

  useEffect(() => {
    setRitualForm(createRitualEditForm(activeCoop));
  }, [activeCoop]);

  const initialRitual = createRitualEditForm(activeCoop);
  const hasChanges =
    JSON.stringify({
      ...ritualForm,
      namedMoments: multilineToList(ritualForm.namedMoments),
    }) !==
    JSON.stringify({
      ...initialRitual,
      namedMoments: multilineToList(initialRitual.namedMoments),
    });

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Ritual</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-ritual-cadence">Weekly review cadence</label>
          <input
            id="edit-ritual-cadence"
            value={ritualForm.weeklyReviewCadence}
            onChange={(event) =>
              setRitualForm((current) => ({
                ...current,
                weeklyReviewCadence: event.target.value,
              }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-ritual-moments">Named moments</label>
          <textarea
            id="edit-ritual-moments"
            value={ritualForm.namedMoments}
            onChange={(event) =>
              setRitualForm((current) => ({ ...current, namedMoments: event.target.value }))
            }
          />
          <span className="helper-text">Use one line per moment.</span>
        </div>
        <div className="field-grid">
          <label htmlFor="edit-ritual-facilitator">Facilitator expectation</label>
          <textarea
            id="edit-ritual-facilitator"
            value={ritualForm.facilitatorExpectation}
            onChange={(event) =>
              setRitualForm((current) => ({
                ...current,
                facilitatorExpectation: event.target.value,
              }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-ritual-posture">Default capture posture</label>
          <textarea
            id="edit-ritual-posture"
            value={ritualForm.defaultCapturePosture}
            onChange={(event) =>
              setRitualForm((current) => ({
                ...current,
                defaultCapturePosture: event.target.value,
              }))
            }
          />
        </div>
        <button
          className="primary-button"
          disabled={!hasChanges}
          onClick={() => {
            void updateMeetingSettings({
              weeklyReviewCadence: ritualForm.weeklyReviewCadence,
              namedMoments: multilineToList(ritualForm.namedMoments),
              facilitatorExpectation: ritualForm.facilitatorExpectation,
              defaultCapturePosture: ritualForm.defaultCapturePosture,
            });
          }}
          type="button"
        >
          Save ritual
        </button>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// NestSetupSection
// ---------------------------------------------------------------------------

export function NestSetupSection({
  activeCoop,
  updateCoopDetails,
}: {
  activeCoop: CoopSharedState;
  updateCoopDetails: SidepanelOrchestration['updateCoopDetails'];
}) {
  const [setupForm, setSetupForm] = useState(() => createSetupEditForm(activeCoop));

  useEffect(() => {
    setSetupForm(createSetupEditForm(activeCoop));
  }, [activeCoop]);

  const initialSetup = createSetupEditForm(activeCoop);
  const hasChanges =
    JSON.stringify(buildSetupInsightsPatch(setupForm, activeCoop.setupInsights)) !==
    JSON.stringify(buildSetupInsightsPatch(initialSetup, activeCoop.setupInsights));

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Setup</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-setup-summary">Big picture</label>
          <textarea
            id="edit-setup-summary"
            value={setupForm.summary}
            onChange={(event) =>
              setSetupForm((current) => ({ ...current, summary: event.target.value }))
            }
          />
        </div>
        <div className="lens-grid">
          {setupLensFieldMap.map(({ currentKey, painKey, improveKey, title }) => (
            <div className="panel-card" key={title}>
              <h3>{title}</h3>
              <div className="field-grid">
                <label htmlFor={`edit-setup-${currentKey}`}>How do you handle this today?</label>
                <textarea
                  id={`edit-setup-${currentKey}`}
                  value={setupForm[currentKey]}
                  onChange={(event) =>
                    setSetupForm((current) => ({
                      ...current,
                      [currentKey]: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field-grid">
                <label htmlFor={`edit-setup-${painKey}`}>What feels messy or hard?</label>
                <textarea
                  id={`edit-setup-${painKey}`}
                  value={setupForm[painKey]}
                  onChange={(event) =>
                    setSetupForm((current) => ({
                      ...current,
                      [painKey]: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field-grid">
                <label htmlFor={`edit-setup-${improveKey}`}>What should get easier?</label>
                <textarea
                  id={`edit-setup-${improveKey}`}
                  value={setupForm[improveKey]}
                  onChange={(event) =>
                    setSetupForm((current) => ({
                      ...current,
                      [improveKey]: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <button
          className="primary-button"
          disabled={!hasChanges}
          onClick={() => {
            void updateCoopDetails({
              setupInsights: buildSetupInsightsPatch(setupForm, activeCoop.setupInsights),
            });
          }}
          type="button"
        >
          Save setup
        </button>
      </div>
    </details>
  );
}
