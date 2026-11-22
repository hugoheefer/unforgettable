// Opener: a session that starts at home in the morning. Needs nothing on the person.
export const morning = {
  id: 'morning',
  opener: true,
  steps: [
    { id: 'wake', kind: 'move', roomId: 'bedroom' },
    { id: 'phone', kind: 'take', object: 'phone', leftAt: { placeId: 'bedroom', spotId: 'nightstand' } },
    { id: 'read', kind: 'tell', at: 'bedroom' },
    { id: 'phone-back', kind: 'putBack', object: 'phone' },
    { id: 'dress', kind: 'tell', at: 'bedroom' },
    { id: 'breakfast', kind: 'goTo', roomId: 'kitchen' },
    { id: 'eat', kind: 'tell', at: 'kitchen' },
  ],
};
