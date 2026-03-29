import { apiRequest } from "../config/apiClient";
import supabase from "../config/supabaseClient";

const DASHBOARD_DATA_UNSUPPORTED_KEY = "etnova:dashboardDataUnsupported";
const BOOTSTRAP_TTL_MS = 60_000;

let bootstrapCache = null;
let bootstrapCacheAt = 0;
let bootstrapCacheUserId = null;
let inflightBootstrap = null;
let inflightBootstrapUserId = null;

function isDashboardEndpointSupported() {
  if (typeof window === "undefined") return true;
  return window.sessionStorage.getItem(DASHBOARD_DATA_UNSUPPORTED_KEY) !== "1";
}

function markDashboardEndpointUnsupported() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DASHBOARD_DATA_UNSUPPORTED_KEY, "1");
}

async function getCurrentUserId() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

function isCacheFresh(userId) {
  if (!bootstrapCache) return false;
  if (!userId || bootstrapCacheUserId !== userId) return false;
  return Date.now() - bootstrapCacheAt <= BOOTSTRAP_TTL_MS;
}

async function loadWithLegacyCalls(reqOptions) {
  const [profile, projects, notifications] = await Promise.all([
    apiRequest("/profile", reqOptions),
    apiRequest("/projects", reqOptions),
    apiRequest("/notifications", { ...reqOptions, skipCache: true }),
  ]);
  return {
    profile: profile ?? null,
    projects: projects ?? [],
    notifications: notifications ?? [],
  };
}

export async function fetchStudentBootstrapData(options = {}) {
  const { force = false } = options;
  const reqOptions = force ? { skipCache: true } : {};
  const userId = await getCurrentUserId();

  if (!force && isCacheFresh(userId)) {
    return bootstrapCache;
  }

  if (!force && inflightBootstrap && inflightBootstrapUserId === userId) {
    return inflightBootstrap;
  }

  inflightBootstrap = (async () => {
    let data;

    if (isDashboardEndpointSupported()) {
      try {
        const dashboard = await apiRequest("/dashboard-data", reqOptions);
        data = {
          profile: dashboard?.profile ?? null,
          projects: dashboard?.projects ?? [],
          notifications: dashboard?.notifications ?? [],
        };
      } catch (error) {
        if (error?.status !== 404) throw error;
        markDashboardEndpointUnsupported();
        data = await loadWithLegacyCalls(reqOptions);
      }
    } else {
      data = await loadWithLegacyCalls(reqOptions);
    }

    bootstrapCache = data;
    bootstrapCacheAt = Date.now();
    bootstrapCacheUserId = userId;
    return data;
  })();
  inflightBootstrapUserId = userId;

  try {
    return await inflightBootstrap;
  } finally {
    inflightBootstrap = null;
    inflightBootstrapUserId = null;
  }
}

export function invalidateStudentBootstrapCache() {
  bootstrapCache = null;
  bootstrapCacheAt = 0;
  bootstrapCacheUserId = null;
  inflightBootstrap = null;
  inflightBootstrapUserId = null;
}
