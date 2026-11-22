// A pizza ordered from the sofa with the phone, paid at the door with the wallet.
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
    { id: 'wallet', kind: 'take', object: 'wallet', leftAt: { placeId: 'hall', spotId: 'console' } },
    { id: 'pay', kind: 'tell', at: 'hall', uses: 'wallet' },
    { id: 'wallet-back', kind: 'putBack', object: 'wallet' },
    { id: 'table', kind: 'goTo', roomId: 'dining' },
    { id: 'eat', kind: 'tell', at: 'dining' },
  ],
};
