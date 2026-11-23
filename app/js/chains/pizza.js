// A pizza ordered from the sofa with the phone, paid at the door with cash from the wallet or with the phone.
export const pizza = {
  id: 'pizza',
  time: 'evening',
  steps: [
    { id: 'hungry', kind: 'goTo', roomId: 'living' },
    { id: 'phone', kind: 'take', object: 'phone', leftAt: { placeId: 'living', spotId: 'coffee-table' } },
    { id: 'ordered', kind: 'tell', at: 'living', uses: 'phone' },
    { id: 'phone-back', kind: 'putBack', object: 'phone' },
    { id: 'bell', kind: 'tell' },
    { id: 'go', kind: 'goTo', roomId: 'hall' },
    {
      id: 'pay-how',
      kind: 'choose',
      at: 'hall',
      options: [
        {
          id: 'cash',
          steps: [
            { id: 'wallet', kind: 'take', object: 'wallet', leftAt: { placeId: 'hall', spotId: 'console' } },
            { id: 'pay', kind: 'tell', at: 'hall', uses: 'wallet' },
            { id: 'wallet-back', kind: 'putBack', object: 'wallet' },
          ],
        },
        {
          id: 'phone',
          steps: [
            { id: 'phone-pay', kind: 'take', object: 'phone', leftAt: { placeId: 'hall', spotId: 'console' } },
            { id: 'pay-phone', kind: 'tell', at: 'hall', uses: 'phone' },
            { id: 'phone-pay-back', kind: 'putBack', object: 'phone' },
          ],
        },
      ],
    },
    { id: 'table', kind: 'goTo', roomId: 'dining' },
    { id: 'eat', kind: 'tell', at: 'dining' },
  ],
};
