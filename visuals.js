(() => {
  const paths = {
    home: 'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
    sprout: 'M12 21v-9M12 15C4 15 3 10 3 5c6 0 9 3 9 8M12 11c0-6 4-9 9-9 0 6-3 10-9 10',
    leaf: 'M19 3C8 2 3 7 5 14s15 7 14-11ZM4 21 15 9',
    book: 'M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 1',
    bag: 'M5 7h14l2 14H3L5 7ZM8 7V5a4 4 0 0 1 8 0v2',
    settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM15 12a3 3 0 1 0-6 0 3 3 0 1 0 6 0',
    bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4M12 2v2',
    sun: 'M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',
    cat: 'M5 11V4l5 4h4l5-4v7c3 12-17 12-14 0ZM8.5 13.2h.01M15.5 13.2h.01M10 16.5q2 2 4 0M3 14l4 .6M17 14.6 21 14',
    dog: 'M8 7h8l3 3v8l-3 3H8l-3-3V10l3-3ZM8 7 3 10v6l4-1V8ZM16 7l5 3v6l-4-1V8ZM9.5 13h.2M14.3 13h.2M10 16.2h4l-2 2.2-2-2.2',
    baby: 'M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0M12 5.5c-3 0-3 4 0 4 1.6 0 1.6-2.4 0-2.4M8.8 12.4h.2M15 12.4h.2M9.4 16q2.6 2.4 5.2 0',
    plant: 'M12 22v-8m0 0c-6 0-8-4-8-9 5 0 8 3 8 9m0 0c0-5 3-8 8-8 0 5-2 8-8 8m-3 8h6',
    cloud: 'M7 18a5 5 0 1 1-1-10 7 7 0 0 1 13-1 5 5 0 0 1 0 11H7ZM9 12l3 3 4-4',
    heart: 'M20 5c-3-3-7-1-8 2-1-3-5-5-8-2-6 6 8 16 8 16S26 11 20 5Z',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
    hand: 'M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 8-10 8-13 4l-5-6a2 2 0 0 1 3-2l3 2',
    bottle: 'm9 3 5-1 2 4-6 2-1-5ZM9 9l8-3 4 11c1 3-8 6-9 3L8 10M10 13l3-1M12 17l3-1',
    drop: 'M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13ZM8 15q0 4 4 4',
    moon: 'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z',
    arrow: 'M4 12h16M15 7l5 5-5 5',
    check: 'M5 12l4 4L20 5',
    spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7',
    clean: 'M8 11h8l3 10H5l3-10ZM10 11V2h4v9M9 16v5M15 16v5'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.heart}"/></svg>`;

  // Cutout pixel dimensions (w, h) per stage file, baked from the asset pipeline.
  const DIMS = {"acc": {"acc-baby-1": [283, 313], "acc-baby-2": [269, 332], "acc-baby-3": [327, 258], "acc-baby-4": [197, 209], "acc-cat-1": [299, 505], "acc-cat-2": [327, 499], "acc-cat-3": [327, 302], "acc-cat-4": [135, 445], "acc-dog-1": [268, 357], "acc-dog-2": [327, 464], "acc-dog-3": [327, 515], "acc-dog-4": [148, 155], "acc-plant-1": [246, 272], "acc-plant-2": [309, 213], "acc-plant-3": [238, 387], "acc-plant-4": [191, 456]}, "baby": {"0": [340, 507], "1": [382, 543], "2": [362, 691], "3": [371, 720]}, "cat": {"0": [388, 462], "1": [393, 527], "2": [347, 583], "3": [384, 720]}, "dog": {"0": [373, 325], "1": [394, 480], "2": [420, 686], "3": [385, 720]}, "plant": {"0": [230, 320], "1": [254, 388], "2": [273, 545], "3": [326, 581]}};
  // Display height (viewBox units) of each stage on the room floor.
  const HEIGHTS = {
    baby: [96, 118, 140, 158],
    cat: [118, 138, 160, 178],
    dog: [118, 140, 162, 180],
    plant: [104, 128, 152, 172]
  };
  // Worn accessory placement as fractions of the character box.
  const WEAR_POS = {};
  const BASE_Y = 316;
  const CENTER_X = 312;

  function portrait(type) {
    const src = `assets/stages/${type}-1.png`;
    return `<img class="portrait" src="${src}" alt="" aria-hidden="true">`;
  }

  function companion(type, stageIndex, worn, tier) {
    const n = Math.min(3, Math.max(0, stageIndex || 0));
    const dim = (DIMS[type] || DIMS.cat)[n];
    const d = (HEIGHTS[type] || HEIGHTS.cat)[n];
    const iw = +(dim[0] * d / dim[1]).toFixed(1);
    const ix = +(CENTER_X - iw / 2).toFixed(1);
    const iy = +(BASE_Y - d).toFixed(1);
    const sick = tier === 'sick' || tier === 'critical' ? ' data-sick="true"' : '';
    let acc = '';
    if (worn) {
      const adim = DIMS.acc[worn];
      const pos = (WEAR_POS[type] || {})[worn] || { x: .5, y: .04, w: .5 };
      if (adim) {
        const aw = +(iw * pos.w).toFixed(1);
        const ah = +(aw * adim[1] / adim[0]).toFixed(1);
        const ax = +(ix + iw * pos.x - aw / 2).toFixed(1);
        const ay = +(iy + d * pos.y).toFixed(1);
        acc = `<image class="acc-worn" data-worn="${worn}" href="assets/acc/${worn.slice(4)}.png" x="${ax}" y="${ay}" width="${aw}" height="${ah}" preserveAspectRatio="xMidYMid meet"/>`;
      }
    }
    return `<ellipse cx="${CENTER_X}" cy="${BASE_Y}" rx="${(iw * 0.42).toFixed(1)}" ry="9" fill="#b8a97e" opacity=".28"/>
      <image class="pet-breathe"${sick} data-character="${type}" data-stage="${n}" href="assets/stages/${type}-${n + 1}.png" x="${ix}" y="${iy}" width="${iw}" height="${d}" preserveAspectRatio="xMidYMid meet"/>${acc}`;
  }

  function hearts() {
    return `<g class="love-spark" fill="#e7b7a4" opacity="0">
      <path transform="translate(236 150) scale(.5)" d="${paths.heart}"/>
      <path transform="translate(356 136) scale(.4)" d="${paths.heart}"/>
      <path transform="translate(300 118) scale(.3)" d="${paths.heart}"/>
    </g>`;
  }

  function scene(type, stageIndex, worn, tier) {
    const engine = window.GameEngine;
    const name = (engine && engine.profiles[type] && engine.profiles[type].name) || '';
    const labels = {
      cat: '橘汐在洒满午后阳光的房间里等你',
      dog: '麦芽在木地板小屋里摇着尾巴等你',
      baby: '阿团在晨光育婴室里朝你张开小手',
      plant: '团子在魔法花园的花藤拱门下等你'
    };
    const backdrops = { cat: '#f6ecd4', dog: '#f2e8d0', baby: '#e9f0e3', plant: '#f4e7e2' };
    const badge = tier === 'sick'
      ? `<g class="sick-flag" transform="translate(486 66)"><rect x="-46" y="-16" width="92" height="32" rx="16" fill="#fffdf6" stroke="#d9a57e" stroke-width="1.5"/><path fill="#d9a57e" transform="translate(-32 -11) scale(.92)" d="${paths.heart}"/><text x="6" y="5" text-anchor="middle" font-size="13" fill="#a8705a">生病了</text></g>`
      : '';
    return `<svg viewBox="0 0 620 362" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${name}在自己的小天地里等待你的照顾">
      <rect width="620" height="362" fill="${backdrops[type] || backdrops.cat}"/>
      <image class="room-bg" data-bg="${type}" href="assets/bg-${type}.jpg" width="620" height="362" preserveAspectRatio="xMidYMid slice"/>
      ${companion(type, stageIndex, worn, tier)}
      ${hearts()}
      ${badge}
      <title>${labels[type] || labels.cat}</title>
    </svg>`;
  }

  window.GameVisuals = { icon, scene, portrait, DIMS, HEIGHTS, WEAR_POS, BASE_Y, CENTER_X };
})();
