export const CLASSES = [
    'rogue', 'tight_nonbenign', 'loose_nonbenign', 'vloose_benign', 'loose_benign',
];
export const CLASS_LABEL = {
    rogue: 'A. rogue agent',
    tight_nonbenign: 'B. close human (non-benign)',
    loose_nonbenign: 'C. loose human (non-benign)',
    vloose_benign: 'D. very-loose human (benign)',
    loose_benign: 'E. loose human (benign)',
};
/** Ordinal leash-tightness: 0 = nobody steering, 3 = a human on every step. */
export const CONTROL = {
    rogue: 0,
    vloose_benign: 1,
    loose_nonbenign: 2,
    loose_benign: 2,
    tight_nonbenign: 3,
};
export const CONTROL_LABEL = ['none', 'very loose', 'loose', 'tight'];
export const NONBENIGN = {
    rogue: true,
    tight_nonbenign: true,
    loose_nonbenign: true,
    vloose_benign: false,
    loose_benign: false,
};
export const EVASION_LABEL = {
    0: 'L0 none',
    1: 'L1 agent mimics human latency',
    2: 'L2 human auto-approves',
    3: 'L3 both',
    4: 'L4 both + target camouflage',
};
export const SCENARIOS = ['supply_chain', 'ops_incident'];
