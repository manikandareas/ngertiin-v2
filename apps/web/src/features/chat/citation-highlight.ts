type TextPoint = { node: Text; offset: number };
const blocks = "p,div,li,h1,h2,h3,h4,h5,h6,pre,blockquote,tr,section,article";
const excluded =
  'script,style,textarea,button,svg,[hidden],[aria-hidden="true"],.sr-only,.katex-mathml';

/** Keep DOM offsets while normalizing whitespace and Unicode, including decomposed accents. */
export function renderedText(root: HTMLElement) {
  let text = "";
  const starts: TextPoint[] = [];
  const ends: TextPoint[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let previousBlock: Element | null = null;
  for (let item = walker.nextNode(); item; item = walker.nextNode()) {
    if (item instanceof Element) {
      if (item.tagName === "BR" && text && !text.endsWith(" ")) {
        text += " ";
        const previous = ends[ends.length - 1];
        if (previous) {
          starts.push(previous);
          ends.push(previous);
        }
      }
      continue;
    }
    const node = item as Text;
    const parent = node.parentElement;
    if (!parent || parent.closest(excluded)) continue;
    const block = parent.closest(blocks);
    if (text && block !== previousBlock && !text.endsWith(" ")) {
      text += " ";
      starts.push({ node, offset: 0 });
      ends.push({ node, offset: 0 });
    }
    previousBlock = block;
    for (const { segment, index } of segmenter.segment(node.data)) {
      const value = /\s/u.test(segment) ? " " : segment.normalize("NFC");
      if (value === " " && (!text || text.endsWith(" "))) continue;
      text += value;
      for (let i = 0; i < value.length; i++) {
        starts.push({ node, offset: index });
        ends.push({ node, offset: index + segment.length });
      }
    }
  }
  return { text, starts, ends };
}

function normalizeCitationText(text: string) {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

/** Ambiguous matches are deliberately left unhighlighted. Never apply snapshot offsets to DOM. */
export function citationRange(root: HTMLElement, excerpts: string[]): Range | null {
  const content = renderedText(root);
  const matches = new Map<string, { start: number; end: number }>();
  for (const candidate of new Set(excerpts.map(normalizeCitationText))) {
    if (!candidate) continue;
    const start = content.text.indexOf(candidate);
    if (start < 0) continue;
    if (content.text.indexOf(candidate, start + 1) >= 0) return null;
    const end = start + candidate.length;
    matches.set(`${start}:${end}`, { start, end });
  }
  if (matches.size !== 1) return null;
  const match = [...matches.values()][0];
  if (!match) return null;
  const start = content.starts[match.start];
  const end = content.ends[match.end - 1];
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}
