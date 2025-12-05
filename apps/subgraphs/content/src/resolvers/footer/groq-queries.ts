export const FOOTER_QUERY = `*[_id == $footerId][0]{
  storeName,
  social[]{
    text,
    url
  },
  copyright,
  poweredByCta{
    text
  }
}`;
