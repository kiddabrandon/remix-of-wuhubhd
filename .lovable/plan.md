# WuHubHD cinematic flow overhaul

## Goal
Make the entire browsing experience faster, clearer, and more cinematic while preserving every existing content source and account feature.

## Experience changes
- Rework the home page around a shorter immersive feature area so content shelves enter the first viewport sooner.
- Remove the duplicated “Tonight’s Pick” treatment and prioritize Continue Watching, reminders, trending, and upcoming releases.
- Refine poster and landscape cards with stable sizing, clearer metadata, stronger focus states, and less decorative chrome.
- Reorganize desktop navigation into primary browsing destinations and compact utility actions.
- Reorganize the mobile dock and browse sheet so Library, YouTube, reminders, downloads, parties, add-ons, and settings are easier to find.
- Improve spacing and touch targets across phone, desktop, and TV-sized layouts.

## Visual direction
- OLED Cyan palette: true black, cool gray, soft white, vivid cyan.
- Space Grotesk headings and DM Sans body text.
- Immersive full-width shelves with restrained blur, subtle separators, and minimal rounding.
- Motion limited to useful crossfades, shelf scrolling, and focused poster lift; reduced-motion remains supported.

## Technical details
- Keep all existing routes, data loaders, watch progress, reminders, downloads, add-ons, YouTube behavior, guest access, and admin permissions intact.
- Use TanStack links for navigation and semantic design tokens for all new visual roles.
- Add route-specific metadata to the home route while leaving generated routing files untouched.
- Validate the finished flow in the live preview at desktop and phone sizes, including navigation, content loading, and reminder access.
