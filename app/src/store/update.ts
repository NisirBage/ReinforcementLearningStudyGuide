// Whether a new version of the app took over this page while it was open (D-041). The service worker activates
// updates at once (skipWaiting + clients.claim) and deletes the old version's files, so a page loaded before the
// update may ask for code files that no longer exist anywhere. Retrying cannot fix that; reloading can.
let updated = false;

export const appWasUpdated = () => updated;
export const markAppUpdated = () => void (updated = true);

/** Call once at start-up: a change of controller after the page already had one means an update took over. */
export function watchForUpdates(sw: Pick<ServiceWorkerContainer, "controller" | "addEventListener"> | undefined) {
  if (!sw) return;
  let had = !!sw.controller;
  sw.addEventListener("controllerchange", () => {
    if (had) markAppUpdated();
    had = true;
  });
}

/** For tests. */
export const resetUpdateFlag = () => void (updated = false);
