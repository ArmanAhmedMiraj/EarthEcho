// The app's own small line icons (24 x 24). One drawing style for every page, so the navigation reads as one family.
const PATHS = {
  farms: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  weather: "M7 18.5a4 4 0 0 1 .5-7.97 5.5 5.5 0 0 1 10.6 1.5A3.25 3.25 0 0 1 17.5 18.5z M12 2.5v1.5 M5.2 5.2l1 1 M18.8 5.2l-1 1",
  disasters: "M12 3.5l9.5 17h-19z M12 10v5 M12 17.6v.4",
  irrigation: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z M9.500 14.500a2.500 2.500 0 0 0 2.500 2.500",
  rotation: "M4 12a8 8 0 0 1 14-5.300L20 9 M20 4v5h-5 M20 12a8 8 0 0 1-14 5.300L4 15 M4 20v-5h5",
  market: "M3 12V4h8l10 10-8 8z M7.500 7.500h.010 M11 14l3-3",
  suppliers: "M4 9l1.500-5h13L20 9 M5 9.500V20h14V9.500 M4 9a2.700 2.700 0 0 0 5.300 0 2.700 2.700 0 0 0 5.400 0A2.700 2.700 0 0 0 20 9 M9.500 20v-5.500h5V20",
  assistant: "M4 5h16v11H10l-5 4v-4H4z M8.500 10.500h.010 M12 10.500h.010 M15.500 10.500h.010",
  suitability: "M12 21v-9 M12 12c0-4 3-6 7-6 0 4-3 6-7 6z M12 14.500c0-3-2.500-5-6-5 0 3 2.500 5 6 5z",
  soil: "M12 3l9 5-9 5-9-5z M3 12.500l9 5 9-5 M3 17l9 5 9-5",
  environment: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18",
  data: "M5 6c0-1.700 3.100-3 7-3s7 1.300 7 3-3.100 3-7 3-7-1.300-7-3z M5 6v12c0 1.700 3.100 3 7 3s7-1.300 7-3V6 M5 12c0 1.700 3.100 3 7 3s7-1.300 7-3",
  more: "M4 6h16 M4 12h16 M4 18h16",
  close: "M6 6l12 12 M18 6L6 18",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2.500v2 M12 19.500v2 M2.500 12h2 M19.500 12h2 M5.300 5.300l1.400 1.400 M17.300 17.300l1.400 1.400 M5.300 18.700l1.400-1.400 M17.300 6.700l1.400-1.400",
  moon: "M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z",
  pin: "M12 21s7-6.200 7-11.500a7 7 0 0 0-14 0C5 14.800 12 21 12 21z M12 7.500a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5z",
  plot: "M4 6l6-2 6 2 4-1.500V18l-4 1.500-6-2-6 2z M10 4v13.500 M16 6v13.500",
  // topic icons for section headers: one per subject, so a card's subject is clear before reading
  land: "M3 17l5-4 4 3 5-5 4 4v4H3z M6 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  water: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z M8.5 14.5c0 2 1.5 3 3 3",
  crop: "M12 21v-9 M12 12c0-4 3-6 7-6 0 4-3 6-7 6z M12 14.5c0-3-2.5-5-6-5 0 3 2.5 5 6 5z M5 21h14",
  history: "M4 12a8 8 0 1 0 2.3-5.6 M4 4v4h4 M12 8v4l3 2",
  note: "M6 3h9l4 4v14H6z M15 3v4h4 M9 12h7 M9 16h7",
  sky: "M7 18.5a4 4 0 0 1 .5-7.97 5.5 5.5 0 0 1 10.6 1.5A3.25 3.25 0 0 1 17.5 18.5z M12 2.5v1.5 M5.2 5.2l1 1 M18.8 5.2l-1 1",
  sun: "M12 4V2 M12 22v-2 M4 12H2 M22 12h-2 M5.6 5.6L4.2 4.2 M19.8 19.8l-1.4-1.4 M5.6 18.4l-1.4 1.4 M19.8 4.2l-1.4 1.4 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  money: "M3 7h18v10H3z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M6 12h.01 M18 12h.01",
  danger: "M12 3.5l9.5 17h-19z M12 10v5 M12 17.6v.4",
  river: "M3 8c3-3 6 3 9 0s6-3 9 0 M3 13c3-3 6 3 9 0s6-3 9 0 M3 18c3-3 6 3 9 0s6-3 9 0",
  satellite: "M4 9l5-5 5 5-5 5z M10 14l2 2 M14 10l2 2 M17 7l3 3-5 5-3-3 M16 16l4 4",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4",
  map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14",
  shop: "M4 9l1.5-5h13L20 9 M5 9.5V20h14V9.5 M9.5 20v-5.5h5V20",
  check: "M4 12l5 5L20 7",
  photo: "M4 6h16v12H4z M8 15l3-3 3 3 2-2 3 3 M9 9h.01",
  chat: "M4 5h16v11H10l-5 4v-4H4z",
};

// A section header with a coloured icon badge: the subject of a card at a glance. kind picks the colour (see orbit.css .sx).
export function SectionHead({ icon, kind = "plain", title, badge, children, as: Tag = "h3" }) {
  return (
    <div className={`sx sx-${kind}`}>
      <span className="sx-ic" aria-hidden="true"><Icon name={icon} size={20} /></span>
      <Tag className="sx-t">{title}{badge ? <span className="sx-badge">{badge}</span> : null}</Tag>
      {children ? <div className="sx-r">{children}</div> : null}
    </div>
  );
}

export default function Icon({ name, size = 22 }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}
