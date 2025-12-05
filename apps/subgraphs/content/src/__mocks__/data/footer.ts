export const mockFooterData = {
  storeName: 'Test Store',
  social: [
    {
      text: 'Facebook',
      url: 'https://facebook.com/teststore',
    },
    {
      text: 'Twitter',
      url: 'https://twitter.com/teststore',
    },
  ],
  copyright: '© 2024 Test Store. All rights reserved.',
  poweredByCta: {
    text: [
      {
        _key: 'block1',
        _type: 'block',
        style: 'normal',
        children: [
          {
            _key: 'span1',
            _type: 'span',
            text: 'Powered by ',
            marks: [],
          },
          {
            _key: 'span2',
            _type: 'span',
            text: 'Medusa',
            marks: ['link1'],
          },
        ],
        markDefs: [
          {
            _key: 'link1',
            _type: 'iconlink',
            href: 'https://medusajs.com',
            iconType: 'component',
            iconComponent: 'Medusa',
            target: '_blank',
          },
        ],
      },
    ],
  },
};
