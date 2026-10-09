import { useEffect, useState } from 'react';
import { api } from './api';

let cache = null;
let inflight = null;

export const DEFAULT_COMPANY = {
  company_name: 'Hybrid MLM',
  company_tagline: 'Backoffice & Perhitungan Bonus',
};

export function fetchCompany() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .get('/public/company')
      .then(({ data }) => {
        cache = { ...DEFAULT_COMPANY, ...data };
        return cache;
      })
      .catch(() => DEFAULT_COMPANY)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function clearCompanyCache() {
  cache = null;
}

/** Nama & tagline perusahaan (dari Pengaturan) untuk header / login. */
export function useCompany() {
  const [company, setCompany] = useState(cache || DEFAULT_COMPANY);
  useEffect(() => {
    let alive = true;
    fetchCompany().then((c) => alive && setCompany(c));
    return () => {
      alive = false;
    };
  }, []);
  return company;
}
