---
name: Automaton owner console
description: Warm-paper journal and conversation for the French-speaking pilot owner.
colors:
  forest-green: "#215c46"
  forest-deep: "#174b38"
  forest-wash: "#e6eee5"
  feedback-error: "#963e27"
  warm-paper: "#f5f2eb"
  paper-surface: "#fffdf8"
  ink: "#20352d"
  muted-ink: "#526158"
  divider: "#d9dfd4"
  field-border: "#aab5aa"
  on-primary: "#fff"
typography:
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "31px"
    fontWeight: 600
    lineHeight: 1.15
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "25px"
    fontWeight: 500
    lineHeight: 1.6
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  control: "8px"
  question-surface: "12px"
spacing:
  compact: "8px"
  control-block: "10px"
  field: "12px"
  control-inline: "16px"
  mobile-inset: "20px"
  section: "24px"
  section-gap: "28px"
  workspace-gap: "38px"
components:
  button-primary:
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.forest-deep}"
  button-secondary:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.forest-wash}"
  message-field:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 13px"
  answer-field:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  question-surface:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.question-surface}"
    padding: "22px 24px"
  status-row:
    textColor: "{colors.ink}"
    padding: "0 0 24px"
  conversation-message:
    textColor: "{colors.ink}"
    padding: "16px 0"
---

# Design System: Automaton owner console

## Overview

**Creative North Star: "Le carnet de bord du pilote"**

This is the implemented owner console: a calm working journal beside a conversation, using the pilot's incumbent warm paper, deep ink and forest-green actions. Fraunces brings the same heading character as the public pilot site; readable system sans carries operational detail. The interface keeps activity, short decision explanations, observed results and owner input in view without adding a marketing hero or decorative data display.

The owner's interface is in plain French. Status rows, timestamps, message acknowledgements and inline questions establish hierarchy through type, spacing and fine dividers. This document records the built console in `index.html`, `console.css` and `console.js`; it does not define a redesign of the commercial site.

**Key Characteristics:**

- Warm-paper background with a pale question surface.
- Flat status rows and divider-led journal and conversation entries.
- Fraunces headings with compact, readable sans-serif detail.
- Inline owner questions followed by a desktop journal/conversation split.
- Explicit states, visible keyboard focus and restrained feedback transitions.

## Colors

The palette combines warm, pale neutrals with dark green ink and a focused forest action accent. The frontmatter holds the exact implemented values.

### Primary

- **Forest Green** (`forest-green`): primary actions, links, keyboard focus, connection indicator, owner attribution and successful feedback.
- **Deep Forest** (`forest-deep`): the primary-button hover state.
- **Forest Wash** (`forest-wash`): the hover fill of secondary choice buttons.

### Secondary

- **Error Terracotta** (`feedback-error`): failed-action and unavailable-console feedback, accompanied by a readable explanation.

### Neutral

- **Warm Paper** (`warm-paper`): the page and inline answer fields.
- **Paper Surface** (`paper-surface`): question containers, secondary buttons, the message composer and the focused skip link.
- **Deep Ink** (`ink`): main text, journal content, questions and neutral controls.
- **Muted Ink** (`muted-ink`): helper copy, labels, timestamps and acknowledgement text.
- **Soft Divider** (`divider`): section boundaries, message separators and secondary control outlines.
- **Field Border** (`field-border`): the stronger outline around editable fields.
- **On Primary** (`on-primary`): primary-button text.

**The Text Carries State Rule.** Every visible state has a text label; color and the connection dot reinforce that label.

## Typography

**Heading Font:** Fraunces, falling back to Georgia and serif. It is self-hosted through `/fraunces.ttf`, with `font-display: swap`, and reuses the pilot's existing TTF asset.

**Body Font:** Arial, Helvetica, sans-serif. There is no external font request or additional font dependency for body text.

The serif marks identity and section titles. The sans-serif carries status, prose, timestamps, controls and questions. The hierarchy remains compact enough for an owner to scan work and reply in one view.

### Hierarchy

- **Headline:** the Automaton identity; the `headline` role reduces to (26px) at the compact breakpoint.
- **Title:** journal and conversation section titles; the `title` role reduces to (23px) at the compact breakpoint.
- **Body:** questions and inherited control text use the `body` role. Text fields use a tighter line height (1.5).
- **Body Small:** journal and conversation prose use `body-small`; journal copy is limited to (72ch), messages to (70ch), and questions to (75ch).
- **Supporting Copy:** introductions and connection/navigation detail use (13px); status labels and timestamps use `label`; acknowledgements and footer text use (11px). Status values use (16px, weight 600), reducing to (14px) on compact screens.

**The Working Type Rule.** Keep Fraunces on identity and major section headings; operational detail stays in the established sans-serif stack.

## Layout

The masthead uses a flexible identity/navigation row. The main workspace and footer stop growing at (1600px), with horizontal insets of (4vw) on larger screens. The status overview is a flat grid of three labelled state groups and a launch action. Pending owner questions occupy a full-width inline surface before the work area.

Desktop places the activity journal and conversation in a two-column grid, with a wider journal (`1.12fr`) and a conversation (`.88fr`, minimum 340px). At (1000px) and below, the status grid becomes two columns, the workspace gap reduces to (24px), and the conversation minimum becomes (320px).

At (740px) and below, the main inset becomes (20px) and the workspace becomes one column. Reading order is status, questions, journal, then chat. Answer fields and their submit buttons stack vertically; choices wrap; the footer stacks. The masthead keeps the identity on the left with compact connection and site navigation on the right.

The journal is independently scrollable, capped at (650px) on desktop, (600px) at the middle breakpoint and (390px) on compact screens. The conversation viewport is (340px), reducing to (290px) on compact screens. Both regions contain overscroll and have a keyboard tab stop with an accessible label. A visible-on-focus skip link leads to the journal section.

**The Reading Order Rule.** Keep unresolved questions above the journal and conversation, and preserve that same order when the split view stacks.

## Elevation & Depth

The console uses no shadows. Pale surface fill, single-pixel borders, whitespace and type establish depth. The question block is the only broad inset surface; journal entries and messages remain flat against the page. Focus uses an outline rather than a glow or lifted surface.

**The Flat Surface Rule.** Keep operating information flat; boundaries come from the existing divider and surface vocabulary.

## Shapes

Controls and fields use the `control` radius; the inline question container uses `question-surface`. Borders are fine and continuous (1px). The connection dot is a small circle (7px). The incumbent Automaton mark and external-link arrow are inline SVG line drawings; no icon font is required.

Buttons and single-line answer fields have a minimum height (44px). The message field has a minimum height (90px), maximum height (250px) and vertical resizing. Long prose and message content wrap within the available width.

## Components

### Buttons

Primary actions are forest-filled, white-text controls; suggested answers use pale secondary buttons. The frontmatter records their padding and shape. Hover changes the background, with a brief background/color transition (.16s ease). Disabled controls reduce opacity (.55) and use the unavailable cursor. All keyboard-focusable controls have a green outline (2px) with an offset (4px). Reduced-motion preference removes transitions.

The launch button shows current running and pass-limit states in its label and disables when a run, stale lock or exhausted pass limit prevents launching. The chat submit button reports its pending state as “Envoi…”.

### Status Row

Controller, incoming-request watcher and pilot limits appear as three compact labelled groups, separated from the workspace by a divider. Values are text from the current runtime state. The controller and watcher remain distinct, and the spending/attempt counters display observed values. Connection status is announced through a status region; the small green dot appears only in the connected state.

### Journal

The journal translates its source into headings, paragraphs and lists rendered as DOM text. It uses short sans-serif subheadings, fine spacing and no card wrapper. Its scrollable viewport accepts keyboard focus and shows the shared focus outline. Empty activity receives a readable empty-state explanation.

### Conversation

Messages are flat rows with an author/time header, wrapped text and optional acknowledgement. Owner attribution uses the action green; Automaton attribution uses ink. Owner messages distinguish “En attente de lecture” from “Lu par Automaton”. The log is keyboard scrollable and announces updates politely. It scrolls automatically to the bottom when the reader is already near its end.

### Message Composer

The labelled, resizable textarea sits below a divider. Its optional launch checkbox and primary submit action share a footer row, adapting to compact width. The helper copy states the implemented boundary precisely: “Conversation enregistrée sur ce Mac et transmise à Automaton via Codex. Ne colle pas de clé ni de secret.” Messages are read between executor steps; the interface does not imply continuous streaming or access to private reasoning.

### Inline Questions

Questions are hidden when none are pending. The pale container shows the count, a short reading/launch explanation, wrapped suggested-answer buttons and a labelled free-response field. The chat's launch checkbox applies to these answers too.

Submitting an answer disables the current question's inputs and buttons, marks it busy and shows “Envoi de la réponse…”. A per-question guard prevents duplicate submissions. If refreshed state rebuilds the question DOM while an answer is pending, the busy treatment is restored; completion or failure releases controls in the current DOM. Error feedback remains readable so the owner can retry. Dynamic text is inserted as DOM text.

## Do's and Don'ts

### Do:

- **Do** preserve the incumbent warm-paper, ink and forest-green palette and self-hosted Fraunces headings.
- **Do** keep owner operations in plain French and distinguish controller, watcher, queued messages and read messages.
- **Do** use real runtime state for status, counters, activity and conversation.
- **Do** preserve keyboard access, visible focus, labelled fields and readable pending/error states.
- **Do** keep questions inline and preserve the questions/journal/chat reading order on compact screens.
- **Do** describe local conversation storage and Codex transmission together in the composer helper copy.

### Don't:

- **Don't** add a marketing hero, decorative charts or fabricated performance metrics to this operating console.
- **Don't** turn the journal and conversation into a grid of raised cards or add decorative motion.
- **Don't** imply continuous token streaming, instant message reading or visibility into private reasoning.
- **Don't** ask for secrets or render message and journal content as untrusted HTML.
- **Don't** replace the established fonts, palette or SVG identity merely to match generic dashboard guidance.
