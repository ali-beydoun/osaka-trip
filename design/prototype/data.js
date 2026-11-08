// Synthetic prototype dataset. Same schema as the app payload, made-up content only.
// Nothing here describes a real trip, hotel, person, booking, route, venue or date. Text is deliberately bland.
window.PROTO = (function () {
  const src = 'https://example.com/source';
  const stop = (name, n, cost, pacing) => ({ name, maps_query: name + ' Osaka', what: 'Sample description for ' + name + '.', hours: n % 2 ? '9:00 to 17:00' : '10:00 to 18:00', cost, pacing, source: src });
  const eat = (name, for_b, price, hours, booking) => ({ name, maps_query: name + ' Osaka', what: 'Sample dish notes for ' + name + '.', for_b, price, hours, booking, source: src });
  const sweet = (name, hours) => ({ name, maps_query: name + ' Osaka', what: 'Sample sweet notes for ' + name + '.', hours, source: src });
  const shop = (name, forWho, hours) => ({ name, maps_query: name + ' Osaka', what: 'Sample shop notes for ' + name + '.', for: forWho, hours, source: src });
  const gt = (minutes, fare, arrive_at, mode) => ({ how: 'Sample route: ' + (mode === 'walking' ? 'a flat walk' : mode === 'driving' ? 'a short taxi' : 'train with one change') + ', about ' + minutes + ' min.', minutes, fare, arrive_at, maps_query: arrive_at + ' Osaka', mode, source: src });
  const PACING = ['Sample pacing note: benches on each floor', 'Sample pacing note: lifts available', 'Sample pacing note: flat paths, take it slowly', 'Sample pacing note: a few wide steps at the entrance', 'Sample pacing note: sit down every hour'];
  const mk = (i, iso, date, k, n, type, load, wkd, title, place, walk, open, zones) => ({
    iso, date, k, n, type, load, wkd, title, place, walk,
    summary: 'Summary for ' + title.toLowerCase() + ': sample morning, sample afternoon, sample evening.',
    ...(open ? { open } : {}),
    flow: [ { when: 'Morning', text: 'Sample morning activity ' + (i + 1), level: 2 }, { when: 'Afternoon', text: 'Sample afternoon activity ' + (i + 1), level: 1 }, { when: 'Evening', text: 'Sample evening activity ' + (i + 1), level: 0 } ],
    zones,
    home: { how: 'Sample way home: ' + (i % 2 ? 'train, then a short taxi.' : 'a short taxi.'), maps_query: 'Sample Hotel Osaka', mode: i % 2 ? 'transit' : 'driving', source: src },
    pacing: PACING[i % PACING.length],
    watch_outs: ['Sample watch-out ' + (i + 1) + 'a', 'Sample watch-out ' + (i + 1) + 'b', 'Sample watch-out ' + (i + 1) + 'c', 'Sample watch-out ' + (i + 1) + 'd: sources disagree on the hours'],
    decisions: ['Sample question ' + (i + 1) + '?'],
    sources: [src, 'https://example.com/day' + (i + 1)]
  });
  const zone = (name, purpose, time, gtArgs, stops, eats, sweets, shops) => ({ name, purpose, time, getting_there: gt(...gtArgs), stops, eat: eats, sweet: sweets, shop: shops });

  const days = [
    mk(0, '2030-05-07', 'Tue 7 May', '火', '7', 'travel', 1, false, 'Sample arrival day', 'Sample airport to the hotel', 'Low', 'Sample open decision for day 1?', [
      zone('Sample Terminal', 'Sample purpose: arrive and leave', '19:50 to 21:15', [10, '', 'Sample Terminal Station', 'walking'], [stop('Sample Terminal Desk', 1, 'Free', PACING[1])], [], [], []),
      zone('Sample Hotel Area', 'Sample purpose: settle in', '22:15 to 23:00', [55, '¥1,200', 'Sample Station', 'transit'], [stop('Sample Hotel', 2, '', PACING[1])],
        [eat('Sample Night Counter', 'Not for Traveller B', '¥1,000', '18:00 to 02:00', 'Walk in'), eat('Sample Corner Shop', 'Fish, prawn or veg options', 'Under ¥1,000', 'Open all day', 'Not needed')], [sweet('Sample Hotel Pastry Shelf', 'Until 23:00')], [])
    ]),
    mk(1, '2030-05-08', 'Wed 8 May', '水', '8', 'shop', 2, false, 'Sample shopping day', 'Sample riverside stores and lanes', 'Medium', 'Sample open decision for day 2?', [
      zone('Sample Riverside Stores', 'Sample purpose: shop floors and a food hall', '10:00 to 14:30', [10, '', 'Sample Riverside Store', 'walking'],
        [stop('Sample Riverside Store', 3, 'Free', PACING[0]), stop('Sample Sky Lounge', 4, '¥800 with a drink', PACING[1])],
        [eat('Sample Basement Food Hall', 'Fish, prawn or veg options', '¥1,200 to ¥2,500', '10:00 to 20:00', 'Walk in'), eat('Sample Certified Grill', 'Halal certified', '¥3,000 to ¥6,000', '11:00 to 21:30', 'Reserve ahead on weekends')],
        [sweet('Sample Pancake Corner', '10:00 to 19:00')], [shop('Sample Pre-owned Bag Floor', 'Traveller B', '10:00 to 20:00'), shop('Sample Gadget Floor', 'Traveller A', '10:00 to 20:00')]),
      zone('Sample Old Lanes', 'Sample purpose: small shops and cafés', '15:00 to 17:30', [12, '¥190', 'Sample Lanes Station', 'transit'],
        [stop('Sample Old Lanes', 5, 'Free', PACING[2])], [eat('Sample Lane Curry House', 'Halal (own claim)', '¥1,200', '11:30 to 20:00', 'Walk in')], [sweet('Sample Old House Coffee', '11:00 to 18:00, shut Tuesday')], [shop('Sample Vintage Corner', 'Both', '12:00 to 19:00')])
    ]),
    mk(2, '2030-05-09', 'Thu 9 May', '木', '9', 'sight', 4, false, 'Sample day trip', 'Sample Temple City by day, Sample Lantern Quarter after dark', 'Medium', '', [
      zone('Sample Temple City West', 'Sample purpose: a garden and a temple lunch', '9:00 to 13:00', [60, '¥410', 'Sample Temple City West Station', 'transit'],
        [stop('Sample Garden Temple', 6, 'Garden ¥500, halls +¥300', PACING[2]), stop('Sample Grove', 7, 'Free', PACING[2])],
        [eat('Sample Temple Lunch Hall', 'Fish, prawn or veg options', '¥3,800 to ¥9,000', '11:00 to 14:00', 'Required: reserve 2 to 3 days ahead'), eat('Sample Riverside Beef House', 'Halal certified', '¥4,000 to ¥7,000', '11:00 to 20:00', 'Advised, not required')],
        [sweet('Sample Bridge Coffee Stand', '8:00 to 17:00')], []),
      zone('Sample Lantern Quarter', 'Sample purpose: lanterns at dusk and dinner', '14:30 to 19:30', [30, 'Roughly ¥3,400', 'Sample Lantern Quarter', 'driving'],
        [stop('Sample Canal Walk', 8, 'Free', PACING[2]), stop('Sample Lantern Shrine', 9, 'Free', PACING[3])],
        [eat('Sample Quarter Ramen', 'Halal certified', '¥1,300', '11:30 to 21:00', 'Walk in; expect a queue'), eat('Sample Teppan Counter', 'Not for Traveller B', '¥5,000', '17:00 to 22:00', 'Reserve ahead')],
        [sweet('Sample Matcha House', '10:00 to 18:00')], [])
    ]),
    mk(3, '2030-05-10', 'Fri 10 May', '金', '10', 'rest', 2, false, 'Sample free day', 'Sample market street, then the hotel', 'Light to medium', '', [
      zone('Sample Market Street', 'Sample purpose: a covered shopping street', '11:00 to 13:30', [15, '¥190', 'Sample Market Station', 'transit'],
        [stop('Sample Market Street', 10, 'Free', PACING[4])], [eat('Sample Market Tempura', 'Fish, prawn or veg options', '¥1,500', '11:00 to 15:00', 'Walk in')], [sweet('Sample Market Taiyaki', '10:00 to 18:00')], [shop('Sample Camera Stall', 'Traveller A', '11:00 to 18:00')]),
      zone('Sample Hotel Area', 'Sample purpose: pack, then dinner', '14:00 to 21:00', [15, '¥190', 'Sample Station', 'transit'],
        [], [eat('Sample Certified Grill', 'Halal certified', '¥3,000 to ¥6,000', '11:00 to 21:30', 'Reserve ahead on weekends'), eat('Sample Lounge Light Menu', 'Fish, prawn or veg options', 'Included for lounge guests', '17:00 to 21:00', 'Not needed')], [sweet('Sample Station Patisserie', '10:00 to 21:00')], [])
    ]),
    mk(4, '2030-05-11', 'Sat 11 May', '土', '11', 'travel', 2, true, 'Sample departure day', 'Sample hotel, then the airport', 'Low', 'Sample open decision for day 5?', [
      zone('Sample Riverside Food Halls', 'Sample purpose: lunch and gifts', '11:15 to 15:00', [10, '', 'Sample Riverside Store', 'walking'],
        [], [eat('Sample Basement Food Hall', 'Fish, prawn or veg options', '¥1,200 to ¥2,500', '10:00 to 20:00', 'Walk in')], [sweet('Sample Gift Sweets Counter', '10:00 to 20:00')], []),
      zone('Sample Terminal', 'Sample purpose: refund desk, bag drop, lounge', '17:00 to 21:00', [50, '¥2,500 train or roughly ¥20,000 taxi', 'Sample Terminal', 'transit'],
        [stop('Sample Refund Desk', 11, 'Free', PACING[1]), stop('Sample Departures Lounge', 12, 'Card or pass', PACING[1])],
        [eat('Sample Terminal Udon', 'Fish, prawn or veg options', '¥1,100', '7:00 to 21:00', 'Walk in')], [sweet('Sample Gate Coffee', '6:00 to 22:00')], [shop('Sample Duty Free Hall', 'Both', '7:00 to 22:00')])
    ])
  ];

  const bakery = (name, jp, area, walk_min, opens, closed, seats, coffee, queue, price) => ({ name, jp, area, maps_query: name + ' Osaka', why: 'Sample reason to go to ' + name + '.', signature: 'Sample signature bake', for_b: 'Sample dietary note', hours: opens + ' to 19:00', closed, opens, seats, coffee, queue, walk_min, getting_there: 'Sample directions, ' + walk_min + ' min', mode: walk_min > 12 ? 'transit' : 'walking', price, tags: ['sample'], source: src });
  const bakeries = [
    bakery('Sample Bakery', 'サンプルベーカリー', 'Sample Riverside', 5, '08:00', 'Monday', 'Counter only, no seats', 'Basic', 'Low', 'Pastries ¥300 to ¥500'),
    bakery('Sample Station Patisserie', 'サンプルパティスリー', 'Sample Riverside', 8, '10:00', 'No closing day listed', 'About 20 seats', 'Good', 'Light to moderate', 'Cake sets ¥1,200'),
    bakery('Sample Old House Coffee', 'サンプルコーヒー', 'Sample Old Lanes', 18, '11:00', 'Tuesday', 'About 12 seats', 'Good', 'Medium', 'Coffee ¥700'),
    bakery('Sample Market Taiyaki', 'サンプルたい焼き', 'Sample Market Street', 0, '10:00', 'Irregular', 'Counter only, no seats', 'None', 'Low', '¥250')
  ];

  const hp = (name, jp, area, city, cuisine, status, certifier, alcohol, hours, closed, price, booking, walk_min, verified, g) => ({ name, jp, area, city, cuisine, status, certifier, alcohol, what: 'Sample menu notes for ' + name + '.', hours, closed, price, booking, walk_min, maps_query: name + ' Osaka', verified, source: src, g });
  const halal = {
    as_of: '1 May 2030',
    groups: [ { id: 'riverside', label: 'Sample Riverside' }, { id: 'oldtown', label: 'Sample Old Lanes' }, { id: 'templecity', label: 'Sample Temple City' }, { id: 'lantern', label: 'Sample Lantern Quarter' }, { id: 'airport', label: 'Sample Airport' } ],
    dayGroup: { '2030-05-07': 'airport', '2030-05-08': 'riverside', '2030-05-09': 'templecity', '2030-05-10': 'riverside', '2030-05-11': 'riverside' },
    places: [
      hp('Sample Certified Grill', 'サンプル認証グリル', 'Sample Riverside Store', 'Osaka', 'Wagyu', 'Halal certified', 'Sample Halal Council', 'No', '11:00 to 21:30', 'No closing day listed', '¥3,000 to ¥6,000', 'Reserve ahead on weekends', 10, 'Sample check: certificate seen online', 'riverside'),
      hp('Sample Riverside Kebab', 'サンプルケバブ', 'Behind Sample Station', 'Osaka', 'Turkish', 'Halal (own claim)', '', 'Unknown', '11:00 to 23:00', 'No closing day listed', 'Under ¥1,500', 'Walk in', 7, 'Could not confirm the supplier', 'riverside'),
      hp('Sample Station Curry Stand', 'サンプルカレー', 'Sample Station concourse', 'Osaka', 'Curry', 'Halal menu', '', 'Yes', '10:00 to 22:00', 'No closing day listed', '¥900', 'Not needed', 8, 'Sample check: menu seen online', 'riverside'),
      hp('Sample Basement Food Hall', 'サンプルデパ地下', 'Sample Riverside Store basement', 'Osaka', 'Mixed counters', 'Not halal: fallback', '', 'Yes', '10:00 to 20:00', 'No closing day listed', '¥1,200 to ¥2,500', 'Walk in', 10, 'Sample check: counters change', 'riverside'),
      hp('Sample Lane Curry House', 'サンプルレーンカレー', 'Sample Old Lanes', 'Osaka', 'Curry', 'Halal (own claim)', '', 'No', '11:30 to 20:00', 'Wednesday', '¥1,200', 'Walk in', 18, 'Sample check: owner confirmed by phone', 'oldtown'),
      hp('Sample Riverside Beef House', 'サンプルビーフ', 'Near the sample bridge', 'Temple City', 'Beef', 'Halal certified', 'Certifier not named', 'No', '11:00 to 20:00', 'No closing day listed', '¥4,000 to ¥7,000', 'Advised, not required', 0, 'Sample check: certificate in a visitor photo', 'templecity'),
      hp('Sample Temple Lunch Hall', 'サンプル精進', 'Inside the sample temple', 'Temple City', 'Vegetarian', 'Muslim-friendly', '', 'No', '11:00 to 14:00', 'Thursday in some months', '¥3,800 to ¥9,000', 'Required, 2 to 3 days ahead', 0, 'Estimate: stock may contain fish', 'templecity'),
      hp('Sample Quarter Ramen', 'サンプルラーメン', 'Sample Lantern Quarter', 'Temple City', 'Ramen', 'Halal certified', 'Sample Halal Council', 'No', '11:30 to 21:00', 'Monday', '¥1,300', 'Walk in; expect a queue', 0, 'Sample check: listed by the certifier', 'lantern'),
      hp('Sample Terminal Udon', 'サンプルうどん', 'Before security', 'Airport', 'Udon', 'Not halal: fallback', '', 'Yes', '7:00 to 21:00', 'No closing day listed', '¥1,100', 'Walk in', 0, 'Sample check: menu online', 'airport')
    ],
    prayer: [
      { name: 'Sample Store prayer room', area: 'Sample Riverside', where: 'Sample floor 8, ask at the desk', hours: '10:00 to 20:00', maps_query: 'Sample Riverside Store Osaka', source: src, g: 'riverside' },
      { name: 'Sample Station prayer room', area: 'Sample Riverside', where: 'Sample concourse', hours: 'Hours not listed', maps_query: 'Sample Station Osaka', source: src, g: 'riverside' },
      { name: 'Sample Terminal prayer room', area: 'Sample Airport', where: 'Sample level 2', hours: 'Open all day', maps_query: 'Sample Terminal Osaka', source: src, g: 'airport' }
    ],
    dropped: [ { name: 'Sample Dropped Grill', reason: 'Sample reason: shut' }, { name: 'Sample Dropped Biryani', reason: 'Sample reason: could not find a halal claim' }, { name: 'Sample Dropped Shawarma', reason: 'Sample reason: shut on the day we are there' } ]
  };

  const doc = {
    intro: 'Sample companion notes.',
    sections: [
      { id: 'next-up', title: 'Next up', items: [ { text: 'Sample task one', done: false }, { text: 'Sample task two', done: false }, { text: 'Sample task three', done: true } ] },
      { id: 'decisions', title: 'Decisions', rows: [ { title: 'Sample decision A', status: 'Decided', detail: 'Sample detail A', lean: '' }, { title: 'Sample decision B', status: 'Open', detail: 'Sample detail B', lean: 'Sample lean B' }, { title: 'Sample decision C', status: 'Open', detail: 'Sample detail C', lean: 'Sample lean C' } ] },
      { id: 'wants', title: 'What we want', rows: [ { title: 'Sample want 1', detail: 'Sample detail 1' }, { title: 'Sample want 2', detail: 'Sample detail 2' }, { title: 'Sample want 3', detail: 'Sample detail 3' } ] },
      { id: 'bookings', title: 'Bookings', rows: [ { title: 'Sample flights', status: 'Booked', detail: 'Sample detail: times in the airline app' }, { title: 'Sample Hotel', status: 'Booked', detail: 'Sample detail: free cancellation until a sample date' }, { title: 'Sample lunch', status: 'Not booked', detail: 'Sample detail: reserve 2 to 3 days ahead' }, { title: 'Sample airport car', status: 'Not booked', detail: 'Sample detail: optional' } ] },
      { id: 'getting-around', title: 'Getting around', rows: [ { title: 'Sample airport to hotel', detail: 'Sample route, about 50 min', q: 'Sample Station Osaka' }, { title: 'Sample hotel to Temple City', detail: 'Sample route, about an hour', q: 'Sample Temple City West Station' }, { title: 'Sample Lantern Quarter home', detail: 'Sample route, about 50 min, no change', q: 'Sample Station Osaka' }, { title: 'Sample hotel to airport', detail: 'Sample route, about 50 min', q: 'Sample Terminal Osaka' } ] },
      { id: 'airport-day', title: 'Airport day', steps: [ 'Sample step 1', 'Sample step 2', 'Sample step 3', 'Sample step 4' ] },
      { id: 'tax-free', title: 'Tax-free shopping', bullets: [ 'Sample rule 1', 'Sample rule 2', 'Sample rule 3', 'Sample rule 4' ] },
      { id: 'guides', title: 'Guides', rows: [ { title: 'Guide A', detail: 'Sample guide summary A' }, { title: 'Guide B', detail: 'Sample guide summary B' }, { title: 'Guide C', detail: 'Sample guide summary C' }, { title: 'Guide D', detail: 'Sample guide summary D' }, { title: 'Guide E', detail: 'Sample guide summary E' } ] },
      { id: 'sources', title: 'Sources', links: [ 'https://example.com/source-1', 'https://example.com/source-2', 'https://example.com/source-3', 'https://example.com/source-4' ] }
    ]
  };

  return {
    meta: { title: 'Osaka Trip', tz: 'Asia/Tokyo', start: '2030-05-07', end: '2030-05-11', researched: '1 Apr 2030', version: '2030.05.01' },
    travellers: [ { id: 'a', role: 'A', name: 'Traveller A', dietary: '' }, { id: 'b', role: 'B', name: 'Traveller B', dietary: 'Sample dietary note.' } ],
    hotel: { name: 'Sample Hotel', jp: 'サンプルホテル', address_jp: '〒530-0000 大阪市北区サンプル1-1-1', address: '1-1-1 Sample, Kita-ku, Osaka', phone: '+81 6 0000 0000', maps_query: 'Sample Hotel Osaka', checkin: '15:00', checkout: '11:00', stations: 'Sample Station 5 min, Sample Riverside Station 8 min' },
    days, bakeries, halal, doc
  };
})();
