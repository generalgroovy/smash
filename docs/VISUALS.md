# Kinetic Print

[Back to README](../README.md)

## The visual idea

A printed movement study, not a sci-fi dashboard. Warm paper separates controls from an ink-dark arena. A cut eclipse and contour lines give the space an identity without moving behind the fight. Stone facets stay inside the real platform bounds. Acid green marks interface actions; cyan and coral belong to players.

## Read the fight

| Mark | Meaning |
| --- | --- |
| Diamond / P1 / faceted helmet | Blue. The same diamond appears in the HUD and stock markers. |
| Circle / P2 / round crested helmet | Red. Geometry and labels back up color. |
| Continuous pale platform edge | Solid main platform. |
| Dashed pale platform edge | One-way, drop-through platform. |
| Hollow short bar above a fighter | Attack startup / windup. |
| Solid short bar | Active attack phase. |
| Dotted short bar | Attack recovery, or helplessness when no action is available. |

The phase meter in training spells out the current move and phase, including hit freeze. A phase mark does **not** guarantee range, a hit, invulnerability, safety or frame advantage. Turn on Hitboxes for authoritative collision rectangles.

Material patterns are distinct: fire has teeth, water a wave, oil beads, spark a zigzag, charged water a double zigzag, and steam rising chevrons. A material tint alone is never its only visual identifier. Material lifetimes and physics still come entirely from the engine.

## Visual settings

**Focus view** removes the illustrated backdrop, platform ornament, trails and impact particles. Fighters, platform edges, material marks, shields and attacks remain visible.

**Attack-phase marks** toggles the small overhead timing bars. It does not hide training's phase meter or alter combat.

**Motion** defaults to the system preference and follows changes while open. Reduced mode fixes the camera and disables shake, trails, impact particles, idle scarf oscillation, field rotation and ambient material animation. Essential locomotion and attack poses remain: hiding them would hide the game. Full mode is an explicit override. Preferences save locally when storage is allowed and never restart or advance the match.

## Edit the style

`visual.js` owns player/material colors, identity shapes, backdrop and platform art. `style.css` owns interface tokens and layout. `animation.js` owns pose timing and limb geometry; this iteration does not modify it. Keep high contrast for fighters and collision edges, reserve background contrast for the fight, and test in Focus and Reduced modes as well as the default view.

The static backdrop is cached at the capped display resolution (up to 2× density and 1920×1080 pixels); there is no screen-sized particle simulation, external image, font download or shader dependency. All art is original procedural drawing.

## References and scope

Engineering references: [MDN canvas optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [MDN reduced-motion preference](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), and [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

These informed caching, motion controls and redundant shape cues. Selected contrast pairs and responsive layouts are tested; this is **not** a claim of comprehensive accessibility certification or screen-reader playability.
