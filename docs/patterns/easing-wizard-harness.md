# Easing Wizard → GROK.ATLAS Harness

Source: easingwizard.com UI (screenshot 2026-10-26) + site analysis.

## PATTERN: Curve Surface as Primary Control

SOURCE      easingwizard.com screenshot (2026-10-26)
MECHANISM   One dominant visual object (the curve) owns the canvas. Surrounding panels are contextual and collapse/expand by mode. Numeric controls and the visual stay in lockstep; the visual is not a preview of the controls — the controls are secondary to the visual.
CONSTRAINT  Need immediate spatial feedback for continuous parameters without modal dialogs or separate inspector windows.
ANTI        Form-first (sliders left, result right) or separate editor/preview tabs. Refused because the relationship between numbers and motion is non-obvious until seen.
MATCH       Grok Atlas HUD / WebGL parameter surface (camera paths, agent motion, shader timelines, Oracle Protocol transitions, time scrub, view transitions).
STEAL       Promote the primary visual (orbit path, timeline spline, or 3D parameter curve) to the center pane. Drive all numeric inputs from it; hide mode-specific controls until the object is selected.
REJECT      Do not copy the full Bézier/spring taxonomy or the exact dark-grid aesthetic wholesale — Atlas already has its own visual language.

## PATTERN: Live Triple Mirror (Visual / Preview / Code)

SOURCE      easingwizard.com screenshot (2026-10-26)
MECHANISM   Three synchronized representations of the same state: (1) editable visual surface, (2) isolated effect preview, (3) always-visible code/export. Any change updates all three. Code is not a final export step — it is a live peer of the visual.
CONSTRAINT  Developers need to both feel the result and copy production output without context-switching.
ANTI        Visual editor that generates code only on “export” or “copy”. Refused because the mental model of “what will this actually produce” must stay continuous.
MATCH       Grok Atlas when exposing motion, timing, or shader parameters that must be both interactively tuned and emitted as code (Three.js, CSS, or agent config). Shareable field states already exist; this extends the idea to live parameter surfaces.
STEAL       Keep a persistent, non-modal code pane (or collapsible strip) that mirrors the current visual state in the target dialect. Pair it with a dedicated preview viewport that only shows the effect, not the editor chrome.
REJECT      Do not force CSS `linear()` / Tailwind output if Atlas’s primary targets are WebGL timelines or agent state machines.

## Notes

These are the load-bearing seams. The rest of the Easing Wizard screenshot (specific easing types, pill tabs, neon stroke) is domain color — not mechanism. Apply only where a continuous parameter surface benefits from being the primary object rather than a form.
