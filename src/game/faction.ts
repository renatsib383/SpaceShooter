/**
 * Who a ship answers to. Combat only needs "not mine" today, but reputation
 * and diplomacy will hang off this later, so it is a named type from the start
 * rather than a boolean.
 */
export type Faction = 'player' | 'raider';

export function isHostile(a: Faction, b: Faction): boolean {
  return a !== b;
}
