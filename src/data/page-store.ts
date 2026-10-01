/**
 * Page image storage.
 *
 * Images live as files under the app's document directory; the database only
 * ever holds their URIs. Keeping the bytes out of SQLite and out of React state
 * is what stops a many-page document from exhausting memory.
 *
 * Files are app-private. They are not readable by other apps and are removed
 * when the owning document is deleted.
 */

import { Directory, File, Paths } from 'expo-file-system';

const ROOT_DIRECTORY = 'dastavez';
const PAGES_DIRECTORY = 'pages';

/** `<document directory>/dastavez/pages`. */
export function pagesDirectory(): Directory {
  return new Directory(Paths.document, ROOT_DIRECTORY, PAGES_DIRECTORY);
}

/** Idempotent, so it is safe to call on every launch. */
export function ensurePageStorage(): void {
  const directory = pagesDirectory();
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
}

/** The destination file for a page id. Does not need to exist. */
export function pageFile(pageId: string): File {
  return new File(pagesDirectory(), `${pageId}.jpg`);
}

/**
 * Copies an image produced elsewhere — a camera, a picker, an editor — into app
 * storage and returns its URI.
 *
 * Sources from those APIs are usually temporary cache files that the system may
 * delete, so the image has to be copied rather than referenced in place.
 */
export async function storePageImage(sourceUri: string, pageId: string): Promise<string> {
  ensurePageStorage();

  const source = new File(sourceUri);
  const destination = pageFile(pageId);
  if (destination.exists) destination.delete();

  await source.copy(destination);
  return destination.uri;
}

/** Removes a page image by its stored URI. A missing file is ignored. */
export function deletePageFile(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}
