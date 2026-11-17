/* The registry of landmark builders (package D8): landmark id -> { build(kit, spec), ground(spec) -> local rects/circles it claims, boardY(spec) }. Each plans_*.js file holds one group of places. */
import { AXIS } from './plans_axis.js';

export const PLANS = { ...AXIS };
