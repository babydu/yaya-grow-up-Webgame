(() => {
  const paths = {
    home: 'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
    sprout: 'M12 21v-9M12 15C4 15 3 10 3 5c6 0 9 3 9 8M12 11c0-6 4-9 9-9 0 6-3 10-9 10',
    leaf: 'M19 3C8 2 3 7 5 14s15 7 14-11ZM4 21 15 9',
    book: 'M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 1',
    bag: 'M5 7h14l2 14H3L5 7ZM8 7V5a4 4 0 0 1 8 0v2',
    settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
    bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4M12 2v2',
    sun: 'M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',
    cat: 'M5 11V4l5 4h4l5-4v7c3 12-17 12-14 0ZM8.5 13.2h.01M15.5 13.2h.01M10 16.5q2 2 4 0M3 14l4 .6M17 14.6 21 14',
    dog: 'M8 7h8l3 3v8l-3 3H8l-3-3V10l3-3ZM8 7 3 10v6l4-1V8ZM16 7l5 3v6l-4-1V8ZM9.5 13h.2M14.3 13h.2M10 16.2h4l-2 2.2-2-2.2',
    baby: 'M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0M12 5.5c-3 0-3 4 0 4 1.6 0 1.6-2.4 0-2.4M8.8 12.4h.2M15 12.4h.2M9.4 16q2.6 2.4 5.2 0',
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

  const cardSrcs = {
    cat: 'assets/cat-card.png',
    dog: 'assets/dog-card.png',
    baby: 'assets/baby-card.png'
  };

  function portrait(type) {
    const src = cardSrcs[type] || cardSrcs.cat;
    return `<img class="portrait" src="${src}" alt="" aria-hidden="true">`;
  }

  const roomImgs = {
    cat: { src: 'assets/cat-room.png', w: 265, h: 360, d: 146 },
    dog: { src: 'assets/dog-room.png', w: 313, h: 360, d: 146 },
    baby: { src: 'assets/baby-room.png', w: 266, h: 360, d: 146 }
  };

  function companion(type) {
    const ri = roomImgs[type] || roomImgs.cat;
    const iw = +(ri.w * ri.d / ri.h).toFixed(1);
    const ix = +(312 - iw / 2).toFixed(1);
    const iy = 316 - ri.d;
    return `<ellipse cx="312" cy="316" rx="${(iw * 0.42).toFixed(1)}" ry="9" fill="#b8a97e" opacity=".28"/>
      <image class="pet-breathe" data-character="${type}" href="${ri.src}" x="${ix}" y="${iy}" width="${iw}" height="${ri.d}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  function hearts() {
    return `<g class="love-spark" fill="#e7b7a4" opacity="0">
      <path transform="translate(236 150) scale(.5)" d="${paths.heart}"/>
      <path transform="translate(356 136) scale(.4)" d="${paths.heart}"/>
      <path transform="translate(300 118) scale(.3)" d="${paths.heart}"/>
    </g>`;
  }

  function props(type) {
    if (type === 'cat') {
      return `<g transform="translate(156 292)">
          <ellipse rx="24" ry="8" fill="#cbb892"/>
          <path d="M-22 0q4 16 22 16T22 0" fill="#f7edd4" stroke="#d4c094" stroke-width="1.6"/>
          <ellipse rx="15" ry="4" fill="#fff8e8"/>
          <path d="M-5 9h10" stroke="#d4c094" stroke-width="1.5"/>
        </g>
        <g transform="translate(458 298)">
          <circle r="14" fill="#e7b7a4" stroke="#d9a090" stroke-width="1.3"/>
          <path d="M-8-4q10 6 4 14M6-6q-12 8-2 16M-4 8q8-2 12 6" fill="none" stroke="#f4d4c6" stroke-width="1.7"/>
          <path d="M12 6c16 10 22-8 18-16" fill="none" stroke="#e7b7a4" stroke-width="1.6"/>
        </g>`;
    }
    if (type === 'dog') {
      return `<g transform="translate(156 292)">
          <ellipse rx="24" ry="8" fill="#cbb892"/>
          <path d="M-22 0q4 16 22 16T22 0" fill="#e8c9a0" stroke="#c9a87a" stroke-width="1.6"/>
          <ellipse rx="14" ry="3.5" fill="#f7ead4"/>
        </g>
        <g transform="translate(460 300) rotate(-18)">
          <ellipse rx="16" ry="7" fill="#efe0c4" stroke="#d7c49e" stroke-width="1.4"/>
          <circle cx="-14" r="7" fill="#efe0c4" stroke="#d7c49e" stroke-width="1.4"/>
          <circle cx="14" r="7" fill="#efe0c4" stroke="#d7c49e" stroke-width="1.4"/>
        </g>`;
    }
    return `<g transform="translate(156 286)">
        <rect x="-11" y="-26" width="22" height="32" rx="9" fill="#f7f1e4" stroke="#e0d4b8" stroke-width="1.5"/>
        <rect x="-8" y="-22" width="16" height="11" rx="5" fill="#d7e3c8"/>
        <path d="M-4 8h8" stroke="#e0d4b8" stroke-width="1.5"/>
        <ellipse cx="0" cy="-16" rx="6" ry="3" fill="#fff" opacity=".45"/>
      </g>
      <g transform="translate(456 292)">
        <circle r="15" fill="#e7b7a4" stroke="#d9a090" stroke-width="1.3"/>
        <circle r="6" fill="#f4cfc0"/>
        <path d="M0 15v18" stroke="#d4c094" stroke-width="2"/>
        <circle cy="-1" r="3" fill="#fff" opacity=".3"/>
      </g>`;
  }

  function scene(type) {
    const engine = window.GameEngine;
    const name = (engine && engine.profiles[type] && engine.profiles[type].name) || '';
    const labels = {
      cat: '奶油蜷坐在垫子上，竖着尖耳朵等你',
      dog: '土豆坐在小屋中央，垂耳吐舌看着你',
      baby: '小满穿着连体衣坐在毯子里，朝你张开小手'
    };
    return `<svg viewBox="0 0 620 362" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${name}在温暖的小屋里等待你的照顾">
      <defs>
        <linearGradient id="sg-wall" x2="0" y2="1"><stop stop-color="#f7f1e4"/><stop offset="1" stop-color="#efe6d2"/></linearGradient>
        <linearGradient id="sg-floor" x2="0" y2="1"><stop stop-color="#eadcc4"/><stop offset="1" stop-color="#ddcfb4"/></linearGradient>
        <linearGradient id="sg-window" x2="0" y2="1"><stop stop-color="#cfe0b8"/><stop offset=".45" stop-color="#f4f7ea"/><stop offset="1" stop-color="#c5d6ae"/></linearGradient>
        <linearGradient id="sg-sun" x2="1" y2="1"><stop stop-color="#fff4cc" stop-opacity=".5"/><stop offset="1" stop-color="#fff4cc" stop-opacity="0"/></linearGradient>
        <radialGradient id="sg-glow" cx="50%" cy="50%" r="50%"><stop stop-color="#fff8e0" stop-opacity=".55"/><stop offset="1" stop-color="#fff8e0" stop-opacity="0"/></radialGradient>
        <pattern id="sg-paper" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M14 12v3m-1-1h3" stroke="#e4dcc6" stroke-width="1" opacity=".65"/></pattern>
      </defs>
      <rect width="620" height="362" fill="url(#sg-wall)"/>
      <rect width="620" height="245" fill="url(#sg-paper)" opacity=".5"/>
      <rect y="245" width="620" height="117" fill="url(#sg-floor)"/>
      <path d="M0 245h620" stroke="#d8ccb0" stroke-width="3"/>
      <path d="M0 248h620M78 248v114m156-114 8 114m150-114 18 114m148-114 32 114M0 308h620" stroke="#d2c4a6" opacity=".55"/>
      <path d="M34 42h156v176H34Z" fill="#e6d9bc" stroke="#d4c6a6" stroke-width="7"/>
      <path d="M46 54h132v152H46Z" fill="url(#sg-window)"/>
      <path d="M112 54v152M46 130h132" stroke="#f7f2e4" stroke-width="7"/>
      <path d="M28 36h168M40 222h144" stroke="#d8cbae" stroke-width="8" stroke-linecap="round"/>
      <path d="M38 50q20 74 0 152l20 4q16-88 4-156M178 50q-20 74 0 152l-20 4q-16-88-4-156" fill="#f7f1e0" stroke="#e6dcc4" stroke-width="1.3"/>
      <path d="M176 196 338 288H104l-30-74" fill="url(#sg-sun)"/>
      <rect x="454" y="52" width="68" height="78" rx="5" fill="#e4d6b6" stroke="#d2c4a6" stroke-width="3"/>
      <rect x="462" y="60" width="52" height="54" rx="3" fill="#f8f4e6"/>
      <path d="M488 104v-26m0 13q-18-4-15-15 15-1 15 15m0-5q18-4 15-17-15 1-15 17" fill="#b7c2a1" stroke="#9eac86" stroke-width="1.8"/>
      <path d="M510 196h60l-8 62h-44z" fill="#d2c4a4"/>
      <path d="M540 198v-74m0 48q-36 0-36-32 32-1 36 32m0-14q32-2 34-34-32-1-34 34" fill="#8fa57a" stroke="#7d9470" stroke-width="2"/>
      <ellipse cx="310" cy="322" rx="142" ry="26" fill="#cfc4a4" opacity=".45"/>
      <ellipse cx="310" cy="308" rx="128" ry="26" fill="#e8e1cc" stroke="#d0c8ae" stroke-width="1.6"/>
      <ellipse cx="310" cy="308" rx="106" ry="18" fill="none" stroke="#d8d2ba" stroke-dasharray="5 6"/>
      <ellipse cx="312" cy="246" rx="158" ry="128" fill="url(#sg-glow)"/>
      ${companion(type)}
      ${props(type)}
      ${hearts()}
      <title>${labels[type] || labels.cat}</title>
    </svg>`;
  }

  window.GameVisuals = { icon, scene, portrait };
})();
