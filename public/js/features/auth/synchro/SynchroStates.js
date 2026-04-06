/**
 * SynchroStates - State definitions and metadata for SynchroBot
 * Each state defines CSS classes and optional entry/exit behaviors
 */

export const STATES = {
  // ==================== GLOBAL & IDLE STATES ====================
  idle: {
    name: 'idle',
    description: 'Base floating animation, occasional blinks',
    cssClass: 'idle',
    canTransitionTo: [
      'bored',
      'tracking',
      'secure',
      'peeking',
      'hover-ready',
      'hover-blocked',
      'processing',
      'empathy',
    ],
  },

  bored: {
    name: 'bored',
    description: 'Droopy eyes, dim antenna, occasional pixelated sigh',
    cssClass: 'bored',
    canTransitionTo: ['sleeping', 'idle', 'tracking', 'secure'],
  },

  sleeping: {
    name: 'sleeping',
    description: 'Eyes closed (- -), antenna off, Zzz particles float up',
    cssClass: 'sleeping',
    particles: ['zzz'],
    canTransitionTo: ['idle'], // Wakes with startled jump
  },

  attention: {
    name: 'attention',
    description: 'Knocks on screen (tap tap) to get attention',
    cssClass: 'attention',
    animation: 'knock',
    canTransitionTo: ['idle', 'tracking', 'secure'],
  },

  // ==================== FOCUS STATES ====================
  tracking: {
    name: 'tracking',
    description: 'Eyes track the blinking cursor, soft blue antenna',
    cssClass: 'tracking',
    antennaColor: 'blue',
    canTransitionTo: ['reading', 'idle', 'secure', 'hover-ready', 'hover-blocked'],
  },

  reading: {
    name: 'reading',
    description: 'Eyes dart left/right rapidly, reading input',
    cssClass: 'reading',
    canTransitionTo: ['tracking', 'idle', 'secure', 'hover-ready'],
  },

  secure: {
    name: 'secure',
    description: 'Covers eyes with hands, squints tightly (> <)',
    cssClass: 'secure',
    canTransitionTo: ['peeking', 'idle', 'hover-ready', 'hover-blocked'],
  },

  peeking: {
    name: 'peeking',
    description: 'Gasps, drops hands, eyes wide open (O O), leans in to snoop',
    cssClass: 'peeking',
    canTransitionTo: ['secure', 'idle', 'confused', 'searching'],
  },

  confused: {
    name: 'confused',
    description: 'Tilted head, question mark popup',
    cssClass: 'confused',
    particles: ['question'],
    canTransitionTo: ['tracking', 'idle', 'peeking'],
  },

  searching: {
    name: 'searching',
    description: 'One hand up, looking around (visible + empty password)',
    cssClass: 'searching',
    canTransitionTo: ['peeking', 'idle'],
  },

  // ==================== VALIDATION STATES ====================
  validating: {
    name: 'validating',
    description: 'Thoughtful expression, tilted head',
    cssClass: 'validating',
    canTransitionTo: ['warning', 'success-partial', 'success-full', 'tracking'],
  },

  warning: {
    name: 'warning',
    description: 'Eyes narrow, antenna yellow, thumbs down',
    cssClass: 'warning',
    antennaColor: 'yellow',
    canTransitionTo: ['validating', 'tracking', 'idle'],
  },

  'success-partial': {
    name: 'success-partial',
    description: 'Peeks through fingers, antenna pulses yellow',
    cssClass: 'success-partial',
    antennaColor: 'yellow',
    canTransitionTo: ['success-full', 'secure', 'warning'],
  },

  'success-full': {
    name: 'success-full',
    description: 'Drops hands, happy arcs (^ ^), antenna flares green',
    cssClass: 'success-full',
    antennaColor: 'green',
    canTransitionTo: ['secure', 'hover-ready', 'mismatch'],
  },

  mismatch: {
    name: 'mismatch',
    description: 'One eye blinks out of sync, pixelated sigh',
    cssClass: 'mismatch',
    particles: ['sigh'],
    canTransitionTo: ['success-full', 'secure'],
  },

  // ==================== ACTION STATES ====================
  'hover-ready': {
    name: 'hover-ready',
    description: 'Hands on hips, confident pose, antenna green',
    cssClass: 'hover-ready',
    antennaColor: 'green',
    canTransitionTo: ['processing', 'idle', 'hover-blocked'],
  },

  'hover-blocked': {
    name: 'hover-blocked',
    description: 'Hands out in "stop" gesture, points at empty field',
    cssClass: 'hover-blocked',
    canTransitionTo: ['hover-ready', 'idle', 'tracking'],
  },

  processing: {
    name: 'processing',
    description: 'Eyes turn to spinning wheels, floats in tight circle',
    cssClass: 'processing',
    canTransitionTo: ['success', 'error'],
  },

  success: {
    name: 'success',
    description: 'Green glow, backflip, star eyes, zooms off-screen',
    cssClass: 'success',
    antennaColor: 'green',
    animation: 'celebrate',
    canTransitionTo: [], // Terminal state
  },

  error: {
    name: 'error',
    description: 'Red glow, facepalm, X X eyes, shakes head',
    cssClass: 'error',
    antennaColor: 'red',
    animation: 'shake',
    canTransitionTo: ['idle', 'tracking', 'secure'],
  },

  // ==================== FORGOT PASSWORD FLOW ====================
  empathy: {
    name: 'empathy',
    description: 'Floats lower, sad droopy eyes, holding magnifying glass',
    cssClass: 'empathy',
    canTransitionTo: ['hopeful', 'salute', 'shrug', 'processing'],
  },

  hopeful: {
    name: 'hopeful',
    description: 'Looks up at email field hopefully',
    cssClass: 'hopeful',
    canTransitionTo: ['empathy', 'salute', 'processing'],
  },

  salute: {
    name: 'salute',
    description: 'Salutes the user, ready for action',
    cssClass: 'salute',
    canTransitionTo: ['processing', 'empathy'],
  },

  shrug: {
    name: 'shrug',
    description: 'Shrugs shoulders, looks helpless',
    cssClass: 'shrug',
    canTransitionTo: ['salute', 'empathy', 'hopeful'],
  },

  envelope: {
    name: 'envelope',
    description: 'Transforms into envelope or throws paper airplane, thumbs up',
    cssClass: 'envelope',
    animation: 'paperPlane',
    canTransitionTo: [], // Terminal state
  },

  // ==================== VERIFY FLOW ====================
  expectant: {
    name: 'expectant',
    description: 'Waiting eagerly for verification code',
    cssClass: 'expectant',
    canTransitionTo: ['processing', 'success', 'error'],
  },
};

/**
 * Get all valid transitions from a state
 */
export function getValidTransitions(stateName) {
  const state = STATES[stateName];
  return state ? state.canTransitionTo : [];
}

/**
 * Check if a transition is valid
 */
export function isValidTransition(from, to) {
  const state = STATES[from];
  if (!state) return true; // Allow any transition from unknown states
  return state.canTransitionTo.includes(to);
}

/**
 * Get state metadata
 */
export function getStateMetadata(stateName) {
  return STATES[stateName] || null;
}

export default STATES;
