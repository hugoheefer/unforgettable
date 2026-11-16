// Joins a name entry of the texts with what the layout knows about the same thing (its id and icon), so a
// sentence can place the icon where its language wants it.

/**
 * @param {Record<string, object>} table one of the name tables of the texts (`texts.rooms`, `texts.things`, ...)
 * @param {{ id: string, icon?: string }} entity the layout entry
 */
export function named(table, entity) {
  return { ...table[entity.id], id: entity.id, icon: entity.icon };
}
