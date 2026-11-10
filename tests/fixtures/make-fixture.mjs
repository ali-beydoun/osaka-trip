// Synthetic trip with the real schema and made-up content. Used by tests and the public demo build.
const item = (name, extra = {}) => ({ name, maps_query: `${name} Osaka`, what: `Sample description for ${name}.`, hours: '10:00 to 20:00', source: 'https://example.com/source', ...extra });
const zone = (name, time, n) => ({
  name, purpose: `Sample purpose ${n}`, time,
  what_to_look_for: `Sample zone highlight ${n}.`,
  tips: [`Sample zone tip ${n}.`],
  getting_there: { how: 'Sample train route, about 20 min.', minutes: 20, fare: '¥240', arrive_at: 'Sample Station', maps_query: 'Sample Station Osaka', mode: 'transit', source: 'https://example.com/route' },
  stops: [item(`Sample Garden ${n}`, { cost: '¥500', pacing: 'Flat paths', why: `Sample reason ${n}.`, look_for: `Sample highlight ${n}.`, entry_tip: `Sample entry tip ${n}.`, checked_on: '1 May 30' })],
  eat: [item(`Sample Halal Diner ${n}`, { for_b: 'Halal certified', price: '¥1,500', booking: 'Not needed' }), item(`Sample Fish Bar ${n}`, { for_b: 'Fish, prawn or veg options', price: '¥2,000' }), item(`Sample Grill ${n}`, { for_b: 'Not for Traveller B', price: '¥3,000' })],
  sweet: [item(`Sample Pancake Cafe ${n}`, { what: 'Souffle pancakes, sample.' })],
  shop: [item(`Sample Market ${n}`, { for: 'Both' })],
});
const L = ['a', 'b', 'c'];
const days = ['2030-05-07', '2030-05-08', '2030-05-09'].map((iso, i) => ({
  iso, date: ['Tue 7 May', 'Wed 8 May', 'Thu 9 May'][i], k: ['火', '水', '木'][i], n: String(7 + i), type: ['travel', 'shop', 'sight'][i], load: i + 1, wkd: false,
  title: `Sample day ${i + 1}`, place: `Sample area ${i + 1}`, walk: 'Low', summary: `Summary for sample day ${i + 1}.`,
  checked_on: '1 May 30',
  route_strategy: `Sample route strategy for day ${i + 1}.`,
  logistics: [{ label: 'Sample transit', value: `Sample transit detail ${i + 1}.` }],
  rain_plan: [`Sample indoor rain option ${i + 1}.`],
  ...(i === 1 ? {
    open: 'Sample open decision',
    spa_intro: 'Sample spa intro for day 2.',
    spa_options: [{
      name: 'Sample Day Spa',
      area: 'Sample District (~5 min walk estimate)',
      privacy: 'Private rooms · Confirm therapist',
      checked_on: '1 May 30',
      hours: '10:00 to 21:00 daily',
      price: 'Facial 60 min ¥10,000; Massage 60 min ¥10,000',
      attendance: 'Both can attend in private rooms.',
      booking: 'Book online 24h ahead',
      why: 'Sample confirmed spa feature.',
      caveat: 'Sample unknown to confirm in writing.',
      source: 'https://example.com/spa',
      booking_url: 'https://example.com/spa',
      maps_query: 'Sample Day Spa Osaka',
    }],
  } : {}),
  flow: [{ when: 'Morning', text: 'Sample morning', level: 1 }, { when: 'Evening', text: 'Sample evening', level: 0 }],
  zones: [zone(`Sample Zone A${i}`, '9:00 to 13:00', `${L[i]}a`), zone(`Sample Zone B${i}`, '14:00 to 19:30', `${L[i]}b`)],
  home: { how: 'Sample way home, taxi 10 min.', maps_query: 'Sample Hotel', mode: 'driving', source: 'https://example.com/home' },
  pacing: 'Sample pacing note.', watch_outs: ['Sample watch-out'], decisions: ['Sample question?'], sources: ['https://example.com/a'],
}));
export const fixture = {
  meta: { title: 'Osaka Trip', tz: 'Asia/Tokyo', start: days[0].iso, end: days[2].iso, halal_as_of: '1 May 2030', migrated_from: 'fixture' },
  travellers: [{ id: 'b', role: 'B', name: 'Traveller B', dietary: 'Sample dietary note.' }, { id: 'a', role: 'A', name: 'Traveller A', dietary: '' }],
  hotel: { name: 'Sample Hotel', address: '1-1 Sample, Kita-ku, Osaka', name_jp: 'サンプルホテル', address_jp: '大阪市北区サンプル1-1', phone: '+81 6-0000-0000', maps_query: 'Sample Hotel Osaka', checkin: '15:00', checkout: '11:00', stations: 'Sample Station 5 min' },
  days,
  bakeries: [item('Sample Bakery', { jp: 'サンプル', area: 'Umeda', why: 'Sample reason', signature: 'Croissant', for_b: 'Sample note', opens: '8:00', closed: 'Mondays', walk_min: 5, tags: ['coffee'] })],
  halal: {
    groups: [{ id: 'umeda', label: 'Umeda' }, { id: 'nara', label: 'Nara' }],
    places: [item('Sample Certified Ramen', { status: 'Halal certified', certifier: 'Sample Body', alcohol: 'No', g: 'umeda', walk_min: 6, area: 'Umeda', city: 'Osaka', cuisine: 'Ramen', verified: 'Sample check' }),
      item('Sample Claim Curry', { status: 'Halal (own claim)', certifier: '', alcohol: 'Unknown', g: 'umeda', walk_min: 0, area: 'Umeda', city: 'Osaka', cuisine: 'Curry', verified: 'Unverified sample' }),
      item('Sample Nara Kebab', { status: 'Muslim-friendly', certifier: '', alcohol: 'Yes', g: 'nara', walk_min: 8, area: 'Nara', city: 'Nara', cuisine: 'Kebab', verified: 'Sample' })],
    prayer: [
      { name: 'Sample Prayer Room', area: 'Umeda', where: 'Sample floor 3', hours: '10:00 to 20:00', access: 'Sample public room', maps_query: 'Sample Prayer Room', source: 'https://example.com/p', g: 'umeda' },
      { name: 'Sample Nara Prayer', area: 'Nara', where: 'Sample floor 1', hours: '09:00 to 17:00', access: 'Sample public room', maps_query: 'Sample Nara Prayer', source: 'https://example.com/pn', g: 'nara' },
    ],
    dropped: [{ name: 'Sample Closed Place', reason: 'Closed in sample.' }],
    dayGroup: { '2030-05-07': 'umeda', '2030-05-08': 'umeda', '2030-05-09': 'nara' },
    dayGroups: { '2030-05-07': ['umeda'], '2030-05-08': ['umeda', 'nara'], '2030-05-09': ['nara'] },
    as_of: '1 May 2030',
  },
  to_book: { note: 'Only the flights and hotels are booked. Nothing on this list is booked yet.', items: [
    { id: 'transfer-arrival', title: 'Sample airport transfer in', day: '2030-05-07', kind: 'transfer', need: 'needs', detail: 'Sample transfer note.' },
    { id: 'eat-1', title: 'Sample Fish Bar ba', day: '2030-05-08', kind: 'restaurant', need: 'needs', detail: 'Book 2 days ahead (sample).' },
    { id: 'eat-2', title: 'Sample Grill ba', day: '2030-05-08', kind: 'restaurant', need: 'optional', detail: 'Online booking (sample).' },
  ] },
  doc: { intro: 'Sample intro for the trip.', sections: [
    { id: 'next-up', level: 2, title: 'Next up', md: '- [ ] Sample task one\n- [x] Sample task done' },
    { id: 'getting-around', level: 3, title: 'Getting around', md: 'Sample text.\n\n| Trip | How | Time |\n| --- | --- | --- |\n| A to B | **Train** [link](https://example.com) | 10 min |' },
  ] },
};
