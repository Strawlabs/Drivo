---
name: Drivo Mobility System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4a3e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6c7b6d'
  outline-variant: '#bbcbbb'
  surface-tint: '#006d37'
  primary: '#006d37'
  on-primary: '#ffffff'
  primary-container: '#2ecc71'
  on-primary-container: '#005027'
  inverse-primary: '#4ae183'
  secondary: '#4f6073'
  on-secondary: '#ffffff'
  secondary-container: '#d2e4fb'
  on-secondary-container: '#556679'
  tertiary: '#5c5f60'
  on-tertiary: '#ffffff'
  tertiary-container: '#b1b3b4'
  on-tertiary-container: '#434546'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6bfe9c'
  primary-fixed-dim: '#4ae183'
  on-primary-fixed: '#00210c'
  on-primary-fixed-variant: '#005228'
  secondary-fixed: '#d2e4fb'
  secondary-fixed-dim: '#b7c8de'
  on-secondary-fixed: '#0b1d2d'
  on-secondary-fixed-variant: '#38485a'
  tertiary-fixed: '#e1e3e4'
  tertiary-fixed-dim: '#c5c7c8'
  on-tertiary-fixed: '#191c1d'
  on-tertiary-fixed-variant: '#454748'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 20px
  touch-target-min: 48px
---

## Brand & Style
The design system is anchored in the "Premium Sustainable" aesthetic—a blend of high-end hospitality and forward-thinking technology. It targets an audience that values reliability, environmental consciousness, and seamless luxury. 

The style is **Corporate Modern with a Minimalist lean**. It utilizes expansive white space to evoke a sense of calm and precision, ensuring the user feels in control. Visual clutter is ruthlessly eliminated to prioritize "driver-first" utility, while soft, organic shapes reflect the fluidity of motion and the approachability of a trusted service provider.

## Colors
This design system uses a high-contrast palette to balance ecological friendliness with professional authority.

*   **Electric Green (#2ECC71):** Used sparingly for primary actions, sustainability indicators (EV battery levels), and success states. It represents energy and the future.
*   **Deep Blue (#1A2B3C):** The foundational color for typography, primary navigation icons, and heavy-weighted buttons. It provides the "Trust" factor.
*   **Surface Neutrals:** A range of cool grays (from #F8F9FA for backgrounds to #64748B for secondary text) ensures depth without introducing chromatic noise.
*   **Pure White (#FFFFFF):** The canvas for all mobile interactions, ensuring maximum legibility under various lighting conditions (e.g., outdoor glare).

## Typography
We utilize **Geist** for its technical precision and exceptional legibility at small sizes, which is critical for map-based interfaces and real-time data tracking.

The typographic hierarchy is "bottom-heavy," meaning body and label styles are prioritized for clarity. Headlines use a tighter letter-spacing and heavier weights to command attention during the booking flow. For mobile devices, display sizes are capped to ensure that critical travel information (price, ETA) remains visible above the fold.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for handheld use.

*   **Rhythm:** A strict 8px baseline grid governs all vertical spacing.
*   **Margins:** Mobile layouts utilize a 20px side margin to prevent thumb-clash with device edges.
*   **Touch Targets:** All interactive elements (buttons, toggles, chips) must adhere to a minimum 48px height/width.
*   **Mobile-First Reflow:** On desktop views, content containers are capped at 480px for booking widgets to maintain the focused "app feel" even within a browser.

## Elevation & Depth
Depth is created using **Ambient Shadows** and **Tonal Layers** rather than harsh borders.

*   **Level 0 (Background):** Pure White (#FFFFFF).
*   **Level 1 (Cards):** Subtle 1px border (#F1F5F9) with a soft, diffused shadow: `0px 4px 20px rgba(26, 43, 60, 0.05)`.
*   **Level 2 (Active/Floating):** Higher elevation shadow used for the "Book Now" bar or floating map buttons: `0px 10px 30px rgba(26, 43, 60, 0.12)`.
*   **Scrim:** A 40% opacity Deep Blue blur is used when modals or drawer menus are active to pull focus to the foreground action.

## Shapes
The shape language is defined by "The Comfort Radius." 

Standard components (Cards, Input Fields) use a **16px (1rem)** radius to feel approachable. Larger container elements, such as bottom sheets or map overlays, transition to a **24px (1.5rem)** radius on the top corners to emphasize the "rounded card" aesthetic. Small utility components like chips and status badges use a full pill-shape (circular ends) to differentiate them from actionable cards.

## Components
Consistent application of these components ensures a premium "Drivo" experience:

*   **Primary Buttons:** Deep Blue background with White text for maximum authority. Electric Green is reserved for "Success" actions (e.g., "Ride Finished").
*   **Service Selection Cards:** 16px radius, featuring high-quality EV renders. When selected, the card gains a 2px Electric Green stroke.
*   **Status Chips:** Pill-shaped. "Charging" uses a subtle green tint background with dark green text. "On the way" uses a light blue tint.
*   **Input Fields:** Ghost-style with a light gray fill (#F8F9FA) that transitions to a white background with a Deep Blue border on focus.
*   **Bottom Sheets:** The primary mobile container. Always feature a "grabber" handle at the top and 24px top-corner radii.
*   **Map Markers:** Custom pin design using the Deep Blue base with an Electric Green pulse effect to indicate the user's specific EV.