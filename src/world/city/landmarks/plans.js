/* The registry of landmark builders (package D8): landmark id -> { build(kit, spec), ground(spec) -> local rects/circles it claims, boardY(spec) }. Each plans_*.js file holds one group of places. */
import { AXIS } from './plans_axis.js';
import { MUGHAL } from './plans_mughal.js';
import { MODERN } from './plans_modern.js';

export const PLANS = { ...AXIS, ...MUGHAL, ...MODERN };
