import crossingCountData from '../data/IBC_crossingCountByCountry.json';
import type { RouteDeath, CountryRoute, IbcCrossing, CrossingCountByCountry } from '../types/api';

let cached_routeDeath: Promise<RouteDeath[]> | null = null;
let cached_routeCountryList: Promise<CountryRoute[]> | null = null;
let cached_routeIBC: Promise<IbcCrossing[]> | null = null;
const cashed_routeCrossingCount: CrossingCountByCountry = crossingCountData as CrossingCountByCountry;

const baseUrl = `${window.location.protocol}//${window.location.host}`;

function get_routeDeath(): Promise<RouteDeath[]> {
  const url = `${baseUrl}/data/route_death`;
  const request = new Request(url, {
    method: 'GET',
    cache: 'default',
  });
  if (cached_routeDeath === null) {
    cached_routeDeath = fetch(request).then(res => res.json() as Promise<RouteDeath[]>).catch((err: unknown) => {
      cached_routeDeath = null; // clear cache so retry is possible
      throw err;
    });
  }
  return cached_routeDeath;
}

function get_routeCountryList(): Promise<CountryRoute[]> {
  const url = `${baseUrl}/data/route_IBC_country_list`;
  const request = new Request(url, {
    method: 'GET',
    cache: 'default',
  });
  if (cached_routeCountryList === null) {
    cached_routeCountryList = fetch(request).then(res => res.json() as Promise<CountryRoute[]>).catch((err: unknown) => {
      cached_routeCountryList = null;
      throw err;
    });
  }
  return cached_routeCountryList;
}

function get_routeIBC(): Promise<IbcCrossing[]> {
  const url = `${baseUrl}/data/route_IBC`;
  const request = new Request(url, {
    method: 'GET',
    cache: 'default',
  });
  if (cached_routeIBC === null) {
    cached_routeIBC = fetch(request).then(res => res.json() as Promise<IbcCrossing[]>).catch((err: unknown) => {
      cached_routeIBC = null;
      throw err;
    });
  }
  return cached_routeIBC;
}

function get_routeCrossingCount(): Promise<CrossingCountByCountry> {
  return new Promise(res => res(cashed_routeCrossingCount));
}

export {
  get_routeDeath,
  get_routeCountryList,
  get_routeIBC,
  get_routeCrossingCount,
};
