import { useEffect, useState } from 'react';
import { api } from './api';

let cache = null;
let inflight = null;

export function fetchRegions() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .get('/regions')
      .then(({ data }) => {
        cache = data;
        return cache;
      })
      .catch(() => ({ provinces: [], regions: {} }))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** { provinces: [...], regions: { provinsi: [kota...] } } */
export function useRegions() {
  const [data, setData] = useState(cache || { provinces: [], regions: {} });
  useEffect(() => {
    let alive = true;
    fetchRegions().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
