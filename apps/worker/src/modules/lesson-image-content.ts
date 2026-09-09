import type { StoredLessonImage } from "@ngertiin/contracts/api";

/** Keep existing placements, remove unresolved images, and append missing placements. */
export function placeLessonImages(
  originalBody: string,
  images: StoredLessonImage[],
): { body: string; appended: string[] } {
  const referenced = new Set<string>();
  let body = originalBody.replace(/!\[[^\]]*\]\(visual-[12]\)/g, (reference) => {
    const image = images.find((image) => reference.endsWith(`(${image.id})`));
    if (!image) return "";
    referenced.add(image.id);
    return reference;
  });
  const appended = images.filter((image) => !referenced.has(image.id));
  for (const image of appended) {
    // The renderer reads the reviewed alt text from the registered image metadata.
    body = `${body.trimEnd()}\n\n![](${image.id})`;
  }

  return { body, appended: appended.map((image) => image.id) };
}
