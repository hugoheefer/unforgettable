// A pot of filter coffee: the pack is opened with the scissors or torn open, the player decides. The pack and the
// tin are props; the tin already says where it stays, so making it a thing needs no change here.
export const coffee = {
  id: 'coffee',
  time: 'day',
  steps: [
    { id: 'go', kind: 'goTo', roomId: 'kitchen' },
    { id: 'pack', kind: 'take', object: 'coffee-pack', at: 'kitchen' },
    {
      id: 'open-how',
      kind: 'choose',
      at: 'kitchen',
      options: [
        {
          id: 'cut',
          steps: [
            { id: 'scissors', kind: 'take', object: 'scissors', leftAt: { placeId: 'kitchen', spotId: 'counter' } },
            { id: 'open', kind: 'tell', at: 'kitchen', uses: 'scissors' },
            { id: 'scissors-back', kind: 'putBack', object: 'scissors' },
          ],
        },
        { id: 'tear', steps: [{ id: 'tear', kind: 'tell', at: 'kitchen' }] },
      ],
    },
    { id: 'tin', kind: 'take', object: 'coffee-tin', leftAt: { placeId: 'kitchen', spotId: 'counter' }, at: 'kitchen' },
    { id: 'fill', kind: 'tell', at: 'kitchen' },
    { id: 'tin-back', kind: 'putBack', object: 'coffee-tin', at: 'kitchen' },
    { id: 'sit', kind: 'goTo', roomId: 'living' },
    { id: 'drink', kind: 'tell', at: 'living' },
  ],
};
