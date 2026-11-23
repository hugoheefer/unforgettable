// Opener: a session that starts at home in the morning. Needs nothing on the person.
// The first thing the player does is their own choice: reading the messages takes the phone, getting up does not.
export const morning = {
  id: 'morning',
  time: 'morning',
  opener: true,
  steps: [
    { id: 'wake', kind: 'move', roomId: 'bedroom' },
    {
      id: 'first',
      kind: 'choose',
      options: [
        {
          id: 'phone',
          steps: [
            { id: 'phone', kind: 'take', object: 'phone', leftAt: { placeId: 'bedroom', spotId: 'nightstand' } },
            { id: 'read', kind: 'tell', at: 'bedroom', uses: 'phone' },
            { id: 'phone-back', kind: 'putBack', object: 'phone' },
          ],
        },
        { id: 'up', steps: [{ id: 'up', kind: 'tell', at: 'bedroom' }] },
      ],
    },
    { id: 'dress', kind: 'tell', at: 'bedroom' },
    { id: 'breakfast', kind: 'goTo', roomId: 'kitchen' },
    { id: 'eat', kind: 'tell', at: 'kitchen' },
  ],
};
