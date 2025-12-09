export const FOOTER_QUERY = `*[_id == "footerId"][0]{
_id,
_type,
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
