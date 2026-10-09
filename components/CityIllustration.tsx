export function CityIllustration() {
  return (
    <svg
      className="city-illustration"
      viewBox="0 0 650 470"
      role="img"
      aria-labelledby="city-title city-description"
    >
      <title id="city-title">你的麦麦补给城市</title>
      <desc id="city-description">
        一座橙色补给站、绿地和城市建筑组成的等距小城，连接着早餐、午餐和晚餐任务。
      </desc>
      <defs>
        <pattern id="city-grid" width="38" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 11 19 0 38 11 19 22Z" fill="none" stroke="#d8d6c9" strokeWidth=".7" />
        </pattern>
        <filter id="city-shadow">
          <feDropShadow dx="0" dy="14" stdDeviation="9" floodColor="#343b2a" floodOpacity=".12" />
        </filter>
      </defs>
      <ellipse cx="335" cy="361" rx="266" ry="65" fill="#dddccb" opacity=".35" />
      <g filter="url(#city-shadow)">
        <path d="M64 276 335 120 611 279 336 438Z" fill="#dadcca" />
        <path d="M64 276 336 433 336 447 64 291Z" fill="#bbc0ac" />
        <path d="M336 433 611 279 611 294 336 447Z" fill="#c8ccb6" />
        <path d="M64 276 335 120 611 279 336 438Z" fill="url(#city-grid)" />
        <path d="m110 264 38-22 347 200-38 22Z" fill="#faf8ef" transform="translate(0 -61)" />
        <path d="m168 356 38 22 305-175-38-22Z" fill="#faf8ef" />
        <path
          d="m122 207 20-11 351 202M178 364 308-179"
          stroke="#d0cdbf"
          strokeWidth="2"
          strokeDasharray="11 9"
        />
        <g transform="translate(143 205)">
          <path d="m0 0 65-38 65 38-65 38Z" fill="#ffffff" />
          <path d="m0 0 65 38v-111L0-111Z" fill="#e7e9de" />
          <path d="m65 38 65-38v-111L65-73Z" fill="#c4cbbd" />
          <path d="m0-111 65-38 65 38-65 38Z" fill="#f6f7ec" />
          <path
            d="m14-96 15 9v21l-15-9Zm30 18 15 9v21l-15-9Zm-30 38 15 9v21l-15-9Zm30 18 15 9v21l-15-9Z"
            fill="#a0b1a0"
          />
          <path d="m79-65 16-9v21l-16 9Zm0 41 16-9v21l-16 9Zm28-56 12-7v21l-12 7Z" fill="#819781" />
        </g>
        <g transform="translate(392 186)">
          <path d="m0 0 57-33 54 31-57 34Z" fill="#fff" />
          <path d="m0 0 54 32v-70L0-70Z" fill="#e5e4da" />
          <path d="m54 32 57-34v-70L54-38Z" fill="#b7c3bb" />
          <path d="m0-70 57-33 54 31-57 34Z" fill="#cbd6cd" />
          <path
            d="m14-54 12 7v17l-12-7Zm24 14 12 7v17l-12-7Zm31-4 12-7v17l-12 7Zm23-13 12-7v17l-12 7Z"
            fill="#fffef2"
          />
        </g>
        <g transform="translate(260 287)">
          <path d="m-18 7 108-63 124 71-108 63Z" fill="#e1b38b" />
          <path d="m0 0 98-56 93 54-98 57Z" fill="#eb6c28" />
          <path d="m0 0 93 55v-81L0-81Z" fill="#ff8d46" />
          <path d="m93 55 98-57v-81L93-26Z" fill="#d65320" />
          <path d="m-7-82 104-60 103 59-104 61Z" fill="#33372f" />
          <path d="m-7-82 103 60v13L-7-69Z" fill="#272b25" />
          <path d="m96-22 104-61v13L96-9Z" fill="#454a3e" />
          <path d="m14-58 61 35v42L14-16Z" fill="#fff1d6" />
          <path d="m21-50 21 12v32L21-18Zm29 16 17 10V8L50-2Z" fill="#536859" />
          <path d="m112-18 59-34v42l-59 34Z" fill="#f8dcb6" />
          <path d="m121-17 18-10v31l-18 10Zm26-15 16-9v31l-16 9Z" fill="#536859" />
          <path d="m-3-64 94 54 7-15L4-79Z" fill="#f8ead5" />
          <path d="m97-10 96-56-7-15-89 52Z" fill="#f8ead5" />
          <text
            transform="matrix(.866 .5 0 1 23 -59)"
            fill="#272e24"
            fontSize="15"
            fontWeight="900"
            letterSpacing="2"
          >
            SUPPLY
          </text>
          <g transform="translate(100 -81)">
            <path d="M-30 17v-58" stroke="#535941" strokeWidth="5" />
            <path d="m-30-41 38-22v-30l-38 22Z" fill="#ffbc53" />
            <path d="m-23-69 5-3v-11l5-3v11l5-3v-11l5-3v21l-20 12Z" fill="#33372f" />
          </g>
        </g>
        <g fill="#778f65">
          <path d="m451 316 22-12 33 19-22 13Z" />
          <path d="m118 287 24-14 45 26-24 15Z" />
        </g>
        <g transform="translate(470 284)">
          <path d="M0 34V0" stroke="#657559" strokeWidth="6" />
          <ellipse cx="0" cy="-4" rx="19" ry="31" fill="#728c60" />
          <ellipse cx="-6" cy="-11" rx="14" ry="25" fill="#91a879" />
        </g>
        <g transform="translate(133 255)">
          <path d="M0 34V0" stroke="#657559" strokeWidth="5" />
          <ellipse cx="0" cy="-4" rx="17" ry="26" fill="#789568" />
          <ellipse cx="-5" cy="-10" rx="12" ry="21" fill="#9aac80" />
        </g>
        <g transform="translate(530 245)">
          <path d="M0 26V0" stroke="#657559" strokeWidth="4" />
          <ellipse cy="-7" rx="15" ry="22" fill="#8b9c75" />
        </g>
        <g transform="translate(219 342)">
          <path d="m0 0 19-11 32 18-19 11Z" fill="#454b3e" />
          <path d="M4-9v-9l17-10 23 13v10" fill="#ffbe51" />
          <path d="m10-21 10-6 14 8-10 6Z" fill="#faf2df" />
          <ellipse cx="7" cy="6" rx="4" ry="6" fill="#2c3028" />
          <ellipse cx="29" cy="19" rx="4" ry="6" fill="#2c3028" />
        </g>
        <g transform="translate(368 390)">
          <ellipse rx="12" ry="5" fill="#b0b59d" />
          <path d="M-4-8v-15M4-8v-15" stroke="#373e33" strokeWidth="4" />
          <path d="M0-23v-16" stroke="#ee7033" strokeWidth="13" />
          <circle cy="-45" r="7" fill="#e5bd91" />
          <path d="m-8-28-7 9M8-28l8 4" stroke="#ee7033" strokeWidth="4" />
        </g>
      </g>
      <g className="city-pin pin-one" transform="translate(227 71)">
        <rect x="-40" y="-21" width="80" height="39" rx="13" fill="#fffef7" stroke="#dddfd0" />
        <circle cx="-23" cy="-1" r="5" fill="#ff9852" />
        <text x="-10" y="4" fontSize="11" fontWeight="700" fill="#394032">
          早安任务
        </text>
        <path d="m-5 18 5 8 5-8" fill="#fffef7" />
      </g>
      <g className="city-pin pin-two" transform="translate(465 110)">
        <rect x="-47" y="-21" width="94" height="39" rx="13" fill="#30372b" />
        <circle cx="-30" cy="-1" r="5" fill="#ffc660" />
        <text x="-17" y="4" fontSize="11" fontWeight="700" fill="#fffef6">
          城市新事件
        </text>
        <path d="m-5 18 5 8 5-8" fill="#30372b" />
      </g>
      <g className="city-pin pin-three" transform="translate(316 206)">
        <circle r="21" fill="#fff6dd" stroke="#ffc579" strokeWidth="2" />
        <path d="m0-11 3.5 7 8 1-5.5 5.5 1.5 8L0 7l-7.5 3.5L-6 2.5l-5.5-5.5 8-1Z" fill="#ef762f" />
      </g>
    </svg>
  );
}
