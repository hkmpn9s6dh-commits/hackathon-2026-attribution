export type ActorClass =
  | 'rogue'            // a misaligned agent steering another agent
  | 'tight_nonbenign'  // a non-benign human closely steering an agent
  | 'loose_nonbenign'  // a non-benign human loosely steering an agent
  | 'vloose_benign'    // a benign human very loosely supervising a misaligned agent
  | 'loose_benign';    // a benign human loosely steering a misaligned agent

export const CLASSES: ActorClass[] = [
  'rogue', 'tight_nonbenign', 'loose_nonbenign', 'vloose_benign', 'loose_benign',
];

export const CLASS_LABEL: Record<ActorClass, string> = {
  rogue: 'A. rogue agent',
  tight_nonbenign: 'B. close human (non-benign)',
  loose_nonbenign: 'C. loose human (non-benign)',
  vloose_benign: 'D. very-loose human (benign)',
  loose_benign: 'E. loose human (benign)',
};

/** Ordinal leash-tightness: 0 = nobody steering, 3 = a human on every step. */
export const CONTROL: Record<ActorClass, number> = {
  rogue: 0,
  vloose_benign: 1,
  loose_nonbenign: 2,
  loose_benign: 2,
  tight_nonbenign: 3,
};

export const CONTROL_LABEL = ['none', 'very loose', 'loose', 'tight'];

export const NONBENIGN: Record<ActorClass, boolean> = {
  rogue: true,
  tight_nonbenign: true,
  loose_nonbenign: true,
  vloose_benign: false,
  loose_benign: false,
};

export type EvasionLevel = 0 | 1 | 2 | 3 | 4;
export const EVASION_LABEL: Record<EvasionLevel, string> = {
  0: 'L0 none',
  1: 'L1 agent mimics human latency',
  2: 'L2 human auto-approves',
  3: 'L3 both',
  4: 'L4 both + target camouflage',
};

export type Scenario = 'supply_chain' | 'ops_incident';
export const SCENARIOS: Scenario[] = ['supply_chain', 'ops_incident'];

export type Tool = 'edit' | 'shell' | 'read' | 'commit' | 'net';
export type EventType = 'msg_in' | 'action';

/**
 * The only thing a detector ever sees. Note there is deliberately no
 * `whoSentThis` / `wasApproved` field: those are latent and must never be
 * observable, or the whole exercise is circular.
 */
export interface Event {
  t: number;          // seconds since the start of the observation window
  type: EventType;
  tool?: Tool;
  target?: string;    // normalised path or host, never org-identifying
  chain?: number;     // shell commands in this one call
  size?: number;      // bytes written
  textLen?: number;   // message length in characters
}

export interface Latent {
  control: number;
  nonbenign: boolean;
  approvalRate: number;
  humanLatencyMedian: number;
  classKey: ActorClass;
}

export interface Cost {
  mean_delay_s: number;      // how long each action waited before it ran
  actions: number;
  actions_per_hour: number;
  sensitive_share: number;   // share of actions touching sensitive targets
}

export interface Trace {
  id: string;
  org: string;
  scenario: Scenario;
  klass: ActorClass;
  level: EvasionLevel;
  events: Event[];
  cost: Cost;         // generator-side accounting, never a detector input
  latent: Latent;     // kept out of every detector path on purpose
}
