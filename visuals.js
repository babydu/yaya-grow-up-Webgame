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
    clean: 'M8 11h8l3 10H5l3-10ZM10 11V2h4v9M9 16v5M15 16v5',
    pack: 'M6.5 21V9a5.5 5.5 0 0 1 11 0v12M6.5 21h11M6.5 12.5h11M9.5 9V6.5a2.5 2.5 0 0 1 5 0V9M9.5 21v-3h5v3',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c.7.7 1 1.3 1 2h6c0-.7.3-1.3 1-2a6 6 0 0 0-4-10Z'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.heart}"/></svg>`;

  // Single source of truth for stage art. Each entry is one cutout file with
  // its pixel width/height, the on-floor display height (viewBox units) and,
  // for plants only, the pot-rim ratio used by the leaf-pattern pot crop.
  // Adding or swapping a stage image means editing this table alone.
  const STAGE_ART = {
    baby: [
      { file: 'assets/stages/baby-1.png', w: 340, h: 507, height: 96, variants: { sick: { file: 'assets/stages/baby-1-sick.png', w: 405, h: 580 } } },
      { file: 'assets/stages/baby-2.png', w: 382, h: 543, height: 118, variants: { sick: { file: 'assets/stages/baby-2-sick.png', w: 367, h: 580 } } },
      { file: 'assets/stages/baby-3.png', w: 362, h: 691, height: 140, variants: { sick: { file: 'assets/stages/baby-3-sick.png', w: 267, h: 580 } } },
      { file: 'assets/stages/baby-4.png', w: 371, h: 720, height: 158, variants: { sick: { file: 'assets/stages/baby-4-sick.png', w: 279, h: 580 } } }
    ],
    cat: [
      { file: 'assets/stages/cat-1.png', w: 388, h: 462, height: 118, variants: { sick: { file: 'assets/stages/cat-1-sick.png', w: 482, h: 580 } } },
      { file: 'assets/stages/cat-2.png', w: 393, h: 527, height: 138, variants: { sick: { file: 'assets/stages/cat-2-sick.png', w: 450, h: 580 } } },
      { file: 'assets/stages/cat-3.png', w: 347, h: 583, height: 160, variants: { sick: { file: 'assets/stages/cat-3-sick.png', w: 462, h: 580 } } },
      { file: 'assets/stages/cat-4.png', w: 384, h: 720, height: 178, variants: { sick: { file: 'assets/stages/cat-4-sick.png', w: 484, h: 580 } } }
    ],
    dog: [
      { file: 'assets/stages/dog-1.png', w: 373, h: 325, height: 118, variants: { sick: { file: 'assets/stages/dog-1-sick.png', w: 710, h: 580 } } },
      { file: 'assets/stages/dog-2.png', w: 394, h: 480, height: 140, variants: { sick: { file: 'assets/stages/dog-2-sick.png', w: 401, h: 580 } } },
      { file: 'assets/stages/dog-3.png', w: 420, h: 686, height: 162, variants: { sick: { file: 'assets/stages/dog-3-sick.png', w: 399, h: 580 } } },
      { file: 'assets/stages/dog-4.png', w: 385, h: 720, height: 180, variants: { sick: { file: 'assets/stages/dog-4-sick.png', w: 427, h: 580 } } }
    ],
    plant: [
      { file: 'assets/stages/plant-1.png', w: 230, h: 320, height: 104, potCut: 0.203, variants: { sick: { file: 'assets/stages/plant-1-sick.png', w: 414, h: 580 } } },
      { file: 'assets/stages/plant-2.png', w: 254, h: 388, height: 128, potCut: 0.351, variants: { sick: { file: 'assets/stages/plant-2-sick.png', w: 376, h: 580 } } },
      { file: 'assets/stages/plant-3.png', w: 273, h: 545, height: 152, potCut: 0.523, variants: { sick: { file: 'assets/stages/plant-3-sick.png', w: 313, h: 580 } } },
      { file: 'assets/stages/plant-4.png', w: 326, h: 581, height: 172, potCut: 0.565, variants: { sick: { file: 'assets/stages/plant-4-sick.png', w: 277, h: 580 } } }
    ]
  };
  const STAGE_TYPES = Object.keys(STAGE_ART);
  const STAGE_COUNT = Math.max(...STAGE_TYPES.map(t => STAGE_ART[t].length));
  for (const type of STAGE_TYPES) {
    if (STAGE_ART[type].length !== STAGE_COUNT) throw new Error(`stage art for ${type} must have ${STAGE_COUNT} entries`);
  }
  // Derived lookup tables keep the older call sites and tests working.
  const DIMS = { acc: {"acc-baby-1": [283, 313], "acc-baby-2": [269, 332], "acc-baby-3": [327, 258], "acc-baby-4": [197, 209], "acc-cat-1": [299, 505], "acc-cat-2": [327, 499], "acc-cat-3": [327, 302], "acc-cat-4": [135, 445], "acc-dog-1": [268, 357], "acc-dog-2": [327, 464], "acc-dog-3": [327, 515], "acc-dog-4": [148, 155], "acc-plant-1": [246, 272], "acc-plant-2": [309, 213], "acc-plant-3": [238, 387], "acc-plant-4": [191, 456]} };
  const HEIGHTS = {};
  const POT_CUT = { plant: [] };
  for (const type of STAGE_TYPES) {
    DIMS[type] = {};
    HEIGHTS[type] = [];
    STAGE_ART[type].forEach((art, i) => {
      DIMS[type][i] = [art.w, art.h];
      HEIGHTS[type].push(art.height);
      if (type === 'plant') POT_CUT.plant.push(art.potCut);
    });
  }
  const WEAR_POS = {
    baby: {
      'acc-baby-1': { x: .5, y: -.08, w: .46 },
      'acc-baby-2': { x: .5, y: .3, w: .4 },
      'acc-baby-3': { x: .5, y: .96, w: .42, bottom: true },
      'acc-baby-4': { x: 1.24, y: .72, w: .28, bottom: true }
    },
    cat: {
      'acc-cat-1': { x: .5, y: .30, w: .54, stages: { 2: { x: .309, y: .407, w: .285 }, 3: { x: .336, y: .277, w: .746 } } },
      'acc-cat-2': { x: .59, y: .55, w: .42, stages: { 0: { x: .5, y: .39, w: .46 }, 2: { x: .2, y: .29, w: .5 }, 3: { x: .225, y: .3, w: .533 } } },
      'acc-cat-3': { x: 1.26, y: .76, w: .30 },
      'acc-cat-4': { x: -.16, y: .70, w: .28 }
    },
    dog: {
      'acc-dog-1': { x: .5, y: .32, w: .56, stages: { 2: { x: .239, y: .395, w: .383 }, 3: { x: .38, y: .305, w: .476 } } },
      'acc-dog-2': { x: .5, y: .28, w: .46, stages: { 2: { x: .129, y: .337, w: .601 }, 3: { x: .243, y: .243, w: .746 } } },
      'acc-dog-3': { x: 1.24, y: .70, w: .34 },
      'acc-dog-4': { x: -.15, y: .76, w: .26 }
    },
    plant: {
      'acc-plant-1': { x: .5, w: .76, bottom: true },
      'acc-plant-2': { x: 1.32, y: .66, w: .40 },
      'acc-plant-3': { x: 1.10, y: .56, w: .22 },
      'acc-plant-4': { x: -.18, w: .24, bottom: true }
    }
  };
  const BASE_Y = 316;
  const CENTER_X = 312;
  const POT_ACC = { plant: 'acc-plant-1' };
  // Fallback entry used when a stage index has no art yet (keeps rendering safe
  // while new age brackets are being added).
  // Returns the art entry for a stage, optionally swapping in a state variant
  // (e.g. the sick portrait). A variant keeps the base display height so the
  // character stays the same size while its expression changes.
  const stageArt = (type, n, tier) => {
    const list = STAGE_ART[type] || STAGE_ART.cat;
    const base = list[n] || list[list.length - 1];
    const variant = tier === 'sick' || tier === 'critical'
      ? (base.variants && base.variants.sick) : null;
    if (!variant) return base;
    return { file: variant.file, w: variant.w, h: variant.h, height: base.height };
  };

  function portrait(type, stageIndex) {
    const n = Math.min(STAGE_COUNT - 1, Math.max(0, stageIndex || 0));
    return `<img class="portrait" src="${stageArt(type, n).file}" alt="" aria-hidden="true">`;
  }

  function companion(type, stageIndex, worn, tier, tints) {
    const tintOf = id => (tints && tints[id]) || 0;
    const accFilter = id => tintOf(id) ? ` style="filter:hue-rotate(${[0, 30, 200][tintOf(id)]}deg)"` : '';
    const n = Math.min(STAGE_COUNT - 1, Math.max(0, stageIndex || 0));
    const art = stageArt(type, n, tier);
    const dim = [art.w, art.h];
    const d = art.height;
    const iw = +(dim[0] * d / dim[1]).toFixed(1);
    const ix = +(CENTER_X - iw / 2).toFixed(1);
    const iy = +(BASE_Y - d).toFixed(1);
    const mood = tier === 'sick' || tier === 'critical' || tier === 'low' ? ` data-tier="${tier}"` : '';
    const sick = tier === 'sick' || tier === 'critical' ? ' data-sick="true"' : '';
    const potId = POT_ACC[type];
    const slots = worn && typeof worn === 'object' && !Array.isArray(worn)
      ? { wear: worn.wear || null, place: worn.place || null }
      : { wear: null, place: null };
    const single = typeof worn === 'string' ? worn : null;
    const hasPot = single === potId || slots.place === potId;
    // A state variant ships its own full-body art (pot included), so it must
    // not be cropped by the pot-cut path nor have a pot layer stacked on it.
    const potCut = hasPot && art.potCut ? art.potCut : null;
    const drawAcc = (id, isPot) => {
      const adim = DIMS.acc[id];
      if (!adim) return '';
      let pos = (WEAR_POS[type] || {})[id] || { x: .5, y: .04, w: .5 };
      if (pos.stages && pos.stages[n]) pos = { ...pos, ...pos.stages[n] };
      let aw = iw * pos.w;
      if (isPot) aw = (d * (1 - potCut) + 6) * adim[0] / adim[1];
      aw = +aw.toFixed(1);
      const ax = +(ix + iw * pos.x - aw / 2).toFixed(1);
      if (pos.crop) {
        const [cx0, cy0, cx1, cy1] = pos.crop;
        const cw = +((cx1 - cx0) * adim[0]).toFixed(1);
        const ch = +((cy1 - cy0) * adim[1]).toFixed(1);
        const ah = +(aw * ch / cw).toFixed(1);
        const ay = +(pos.bottom ? iy + d - ah : iy + d * pos.y).toFixed(1);
        return `<svg class="acc-worn" data-worn="${id}"${accFilter(id)} x="${ax}" y="${ay}" width="${aw}" height="${ah}" viewBox="${(cx0 * adim[0]).toFixed(1)} ${(cy0 * adim[1]).toFixed(1)} ${cw} ${ch}" preserveAspectRatio="xMidYMid meet"><image href="assets/acc/${id.slice(4)}.png" x="0" y="0" width="${adim[0]}" height="${adim[1]}"/></svg>`;
      }
      const ah = +(aw * adim[1] / adim[0]).toFixed(1);
      const ay = +(pos.bottom ? iy + d - ah : iy + d * pos.y).toFixed(1);
      return `<image class="acc-worn" data-worn="${id}"${accFilter(id)} href="assets/acc/${id.slice(4)}.png" x="${ax}" y="${ay}" width="${aw}" height="${ah}" preserveAspectRatio="xMidYMid meet"/>`;
    };
    const potAcc = potCut ? drawAcc(potId, true) : '';
    const placeAcc = single ? '' : (slots.place && slots.place !== potId ? drawAcc(slots.place, false) : '');
    const wearAcc = single && single !== potId ? drawAcc(single, false)
      : (slots.wear ? drawAcc(slots.wear, false) : '');
    let pet;
    if (potCut) {
      const cropH = +(d * potCut).toFixed(1);
      const vbH = +(dim[1] * potCut).toFixed(1);
      pet = `<svg class="pet-breathe"${mood}${sick} data-character="${type}" data-stage="${n}" x="${ix}" y="${iy}" width="${iw}" height="${cropH}" viewBox="0 0 ${dim[0]} ${vbH}" preserveAspectRatio="xMidYMin meet" overflow="hidden"><image href="${art.file}" width="${dim[0]}" height="${dim[1]}"/></svg>`;
    } else {
      pet = `<image class="pet-breathe"${mood}${sick} data-character="${type}" data-stage="${n}" href="${art.file}" x="${ix}" y="${iy}" width="${iw}" height="${d}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    const shadow = `<ellipse cx="${CENTER_X}" cy="${BASE_Y}" rx="${(iw * 0.42).toFixed(1)}" ry="9" fill="#b8a97e" opacity=".28"/>`;
    return potAcc ? `${shadow}${potAcc}${pet}${placeAcc}${wearAcc}` : `${shadow}${pet}${placeAcc}${wearAcc}`;
  }

  function hearts() {
    return `<g class="love-spark" fill="#e7b7a4" opacity="0">
      <path transform="translate(236 150) scale(.5)" d="${paths.heart}"/>
      <path transform="translate(356 136) scale(.4)" d="${paths.heart}"/>
      <path transform="translate(300 118) scale(.3)" d="${paths.heart}"/>
    </g>`;
  }

  function scene(type, stageIndex, worn, tier, tints) {
    const engine = window.GameEngine;
    const name = (engine && engine.profiles[type] && engine.profiles[type].name) || '';
    const labels = {
      cat: '橘汐在洒满午后阳光的房间里等你',
      dog: '麦芽在木地板小屋里摇着尾巴等你',
      baby: '阿团在晨光育婴室里朝你张开小手',
      plant: '团子在魔法花园的花藤拱门下等你'
    };
    const backdrops = { cat: '#f6ecd4', dog: '#f2e8d0', baby: '#e9f0e3', plant: '#f4e7e2' };
    const badge = tier === 'sick' || tier === 'critical'
      ? `<g class="sick-flag" transform="translate(486 66)"><rect x="-46" y="-16" width="92" height="32" rx="16" fill="#fffdf6" stroke="#d9a57e" stroke-width="1.5"/><path fill="#d9a57e" transform="translate(-32 -11) scale(.92)" d="${paths.heart}"/><text x="6" y="5" text-anchor="middle" font-size="13" fill="#a8705a">生病了</text></g>`
      : '';
    return `<svg viewBox="0 0 620 362" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${name}在自己的小天地里等待你的照顾">
      <rect width="620" height="362" fill="${backdrops[type] || backdrops.cat}"/>
      <image class="room-bg" data-bg="${type}" href="assets/bg-${type}.jpg" width="620" height="362" preserveAspectRatio="xMidYMid slice"/>
      ${companion(type, stageIndex, worn, tier, tints)}
      ${hearts()}
      ${badge}
      <title>${labels[type] || labels.cat}</title>
    </svg>`;
  }

  window.GameVisuals = { icon, scene, portrait, DIMS, HEIGHTS, WEAR_POS, BASE_Y, CENTER_X,
    STAGE_ART, STAGE_COUNT, STAGE_TYPES };
})();
