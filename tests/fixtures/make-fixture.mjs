// Synthetic trip with the real schema and made-up content. Used by tests and the public demo build.
const item = (name, extra = {}) => ({ name, maps_query: `${name} Osaka`, what: `Sample description for ${name}.`, hours: '10:00 to 20:00', source: 'https://example.com/source', ...extra });
const zone = (name, time, n) => ({
  name, purpose: `Sample purpose ${n}`, time,
  getting_there: { how: 'Sample train route, about 20 min.', minutes: 20, fare: '¥240', arrive_at: 'Sample Station', maps_query: 'Sample Station Osaka', mode: 'transit', source: 'https://example.com/route' },
  stops: [item(`Sample Garden ${n}`, { cost: '¥500', pacing: 'Flat paths' })],
  eat: [item(`Sample Halal Diner ${n}`, { for_b: 'Halal certified', price: '¥1,500', booking: 'Not needed' }), item(`Sample Fish Bar ${n}`, { for_b: 'Fish, prawn or veg options', price: '¥2,000' }), item(`Sample Grill ${n}`, { for_b: 'Not for Traveller B', price: '¥3,000' })],
  sweet: [item(`Sample Pancake Cafe ${n}`, { what: 'Souffle pancakes, sample.' })],
  shop: [item(`Sample Market ${n}`, { for: 'Both' })],
});
const L = ['a', 'b', 'c'];
const days = ['2030-05-07', '2030-05-08', '2030-05-09'].map((iso, i) => ({
  iso, date: ['Tue 7 May', 'Wed 8 May', 'Thu 9 May'][i], k: ['火', '水', '木'][i], n: String(7 + i), type: ['travel', 'shop', 'sight'][i], load: i + 1, wkd: false,
  title: `Sample day ${i + 1}`, place: `Sample area ${i + 1}`, walk: 'Low', summary: `Summary for sample day ${i + 1}.`,
  ...(i === 1 ? { open: 'Sample open decision' } : {}),
  flow: [{ when: 'Morning', text: 'Sample morning', level: 1 }, { when: 'Evening', text: 'Sample evening', level: 0 }],
  zones: [zone(`Sample Zone A${i}`, '9:00 to 13:00', `${L[i]}a`), zone(`Sample Zone B${i}`, '14:00 to 19:30', `${L[i]}b`)],
  home: { how: 'Sample way home, taxi 10 min.', maps_query: 'Sample Hotel', mode: 'driving', source: 'https://example.com/home' },
  pacing: 'Sample pacing note.', watch_outs: ['Sample watch-out'], decisions: ['Sample question?'], sources: ['https://example.com/a'],
}));
export const fixture = {
  meta: { title: 'Osaka Trip', tz: 'Asia/Tokyo', start: days[0].iso, end: days[2].iso, halal_as_of: '1 May 2030', migrated_from: 'fixture' },
  travellers: [{ id: 'b', role: 'B', name: 'Traveller B', dietary: 'Sample dietary note.' }, { id: 'a', role: 'A', name: 'Traveller A', dietary: '' }],
  hotel: { name: 'Sample Hotel', address: '1-1 Sample, Kita-ku, Osaka', maps_query: 'Sample Hotel Osaka', checkin: '15:00', checkout: '11:00', stations: 'Sample Station 5 min' },
  days,
  bakeries: [item('Sample Bakery', { jp: 'サンプル', area: 'Umeda', why: 'Sample reason', signature: 'Croissant', for_b: 'Sample note', opens: '8:00', closed: 'Mondays', walk_min: 5, tags: ['coffee'] })],
  halal: {
    groups: [{ id: 'umeda', label: 'Umeda' }, { id: 'nara', label: 'Nara' }],
    places: [item('Sample Certified Ramen', { status: 'Halal certified', certifier: 'Sample Body', alcohol: 'No', g: 'umeda', walk_min: 6, area: 'Umeda', city: 'Osaka', cuisine: 'Ramen', verified: 'Sample check' }),
      item('Sample Claim Curry', { status: 'Halal (own claim)', certifier: '', alcohol: 'Unknown', g: 'umeda', walk_min: 0, area: 'Umeda', city: 'Osaka', cuisine: 'Curry', verified: 'Unverified sample' }),
      item('Sample Nara Kebab', { status: 'Muslim-friendly', certifier: '', alcohol: 'Yes', g: 'nara', walk_min: 8, area: 'Nara', city: 'Nara', cuisine: 'Kebab', verified: 'Sample' })],
    prayer: [{ name: 'Sample Prayer Room', area: 'Umeda', where: 'Sample floor 3', hours: '10:00 to 20:00', maps_query: 'Sample Prayer Room', source: 'https://example.com/p', g: 'umeda' }],
    dropped: [{ name: 'Sample Closed Place', reason: 'Closed in sample.' }],
    dayGroup: { '2030-05-07': 'umeda', '2030-05-08': 'umeda', '2030-05-09': 'nara' },
    as_of: '1 May 2030',
  },
  doc: { intro: 'Sample intro for the trip.', sections: [
    { id: 'next-up', level: 2, title: 'Next up', md: '- [ ] Sample task one\n- [x] Sample task done' },
    { id: 'getting-around', level: 3, title: 'Getting around', md: 'Sample text.\n\n| Trip | How | Time |\n| --- | --- | --- |\n| A to B | **Train** [link](https://example.com) | 10 min |' },
  ] },
};
