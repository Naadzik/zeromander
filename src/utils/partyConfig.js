// .color/.lightColor are raw hexes for the PNG export (exportMap.js) ONLY —
// DOM styling must use .cssColor so both visual themes resolve correctly.
export const PARTY = {
  blue: {
    label: 'Urban Union',
    shortLabel: 'Urban Union',
    color: '#4D9FFF',
    lightColor: '#60A5FA',
    cssColor: 'var(--blue-party)'
  },
  red: {
    label: 'Heartland Alliance',
    shortLabel: 'Heartland',
    color: '#FF5A5A',
    lightColor: '#F87171',
    cssColor: 'var(--red-party)'
  },
  green: {
    label: 'Farmers Coalition',
    shortLabel: 'Farmers',
    color: '#3DD68C',
    lightColor: '#4ADE80',
    cssColor: 'var(--green-party)'
  },
};

export const PARTY_IDS = ['blue', 'red', 'green'];

export function partiesFor(isThreeParty) {
  return isThreeParty ? PARTY_IDS : ['blue', 'red'];
}
