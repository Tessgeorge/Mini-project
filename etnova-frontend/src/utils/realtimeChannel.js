const REMOVABLE_STATUSES = new Set(["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]);

export function subscribeWithDeferredCleanup(supabase, channel) {
  let latestStatus = "JOINING";
  let cleanupRequested = false;

  channel.subscribe((status) => {
    latestStatus = status;

    if (cleanupRequested && REMOVABLE_STATUSES.has(status) && status !== "CLOSED") {
      void supabase.removeChannel(channel);
    }
  });

  return () => {
    cleanupRequested = true;

    if (REMOVABLE_STATUSES.has(latestStatus) && latestStatus !== "CLOSED") {
      void supabase.removeChannel(channel);
    }
  };
}
