# Travian Resource Helper (Sidebar)

Userscript for **Travian** that adds a **Resource Helper** box to the game sidebar. It reads construction costs, troop training totals, and academy research rows on the current page, shows **how much wood, clay, iron, and crop you still need**, and lets you **save** those shortages for later.

## What it helps with

- **Planning**: See missing resources at a glance while you scroll (the box can stay pinned near the top of the viewport).
- **Queue**: Save several “need” snapshots with a label (the active village name is prefixed when the game exposes it). Reopen them from the **Saved** list.
- **Filling needs**: On supported pages, **Insert** can help apply a saved entry — for example on the **market** or when using **hero inventory** resource items, depending on what the current Travian UI exposes.

UI strings are available in **English** and **Slovak**; the language follows the page `lang` attribute (`sk` → Slovak, otherwise English).

## Requirements

- A userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) (or compatible).
- The script is intended for **Travian** pages; `@match` may be broad in the distributed file — tighten it in your copy if you only want it on Travian domains.

## Install

1. Install Tampermonkey (or similar).
2. Create a new script and paste the contents of `user-script.js`, **or** install from a raw URL if you publish one.
3. Save and reload a Travian tab. The sidebar box should appear when the page has a compatible sidebar layout.

## Privacy / data

Saved entries are stored in **`localStorage`** in your browser (key used by the script for the queue). Nothing is sent to the script author by default.

## License

Use in compliance with Travian’s terms of service and any applicable third-party licenses.
