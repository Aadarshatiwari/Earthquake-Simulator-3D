# Phase 3.5 accessibility report

- Added a keyboard skip link and consistent focus outlines. Primary navigation scrolls inside its own row at narrower widths.
- Increased touch targets in navigation, configuration tabs and viewport selectors. Controls use visible text labels and report selection with accessible state attributes.
- Honoured reduced-motion preference for camera transitions and smooth results scrolling. Playback remains a user-controlled engineering action. Procedural audio and optional haptics remain independently off by default.
- Plots retain SI-labelled axes, legends, numerical results, and colour plus line styles. Heatmap legends have explicit units and numbers, and selected-storey values remain available as text.
- Fullscreen fallback is reversible with its button or Escape. Loading and calculation status are available to assistive technology through existing live regions.

Keyboard focus and responsive visual layouts were spot-checked in the desktop browser. A full WCAG audit, Android TalkBack, native touch gestures, and high zoom accessibility testing remain open.
