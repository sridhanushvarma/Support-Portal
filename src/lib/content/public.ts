import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { loadSettings } from "../settings";
import { TAGS } from "../cache-tags";
import * as data from "./public-data";

// Cross-request data cache, invalidated by tag on publish (spec 10.4). The TTL is a safety net only.
const TTL = 3600;

export const getSettings = cache(
  unstable_cache(() => loadSettings(), ["settings"], { tags: [TAGS.settings], revalidate: TTL }),
);

export const getPublishedServices = cache(
  unstable_cache(data.fetchPublishedServices, ["services:list"], {
    tags: [TAGS.services],
    revalidate: TTL,
  }),
);
export const getPublishedService = cache(
  unstable_cache(data.fetchPublishedService, ["services:one"], {
    tags: [TAGS.services],
    revalidate: TTL,
  }),
);
export const getPublishedProjects = unstable_cache(data.fetchPublishedProjects, ["projects:list"], {
  tags: [TAGS.projects, TAGS.services],
  revalidate: TTL,
});
export const getFeaturedProjects = unstable_cache(
  data.fetchFeaturedProjects,
  ["projects:featured"],
  {
    tags: [TAGS.projects, TAGS.services],
    revalidate: TTL,
  },
);
export const getRelatedProjects = unstable_cache(data.fetchRelatedProjects, ["projects:related"], {
  tags: [TAGS.projects, TAGS.services],
  revalidate: TTL,
});
export const getPublishedProject = cache(
  unstable_cache(data.fetchPublishedProject, ["projects:one"], {
    tags: [TAGS.projects, TAGS.services],
    revalidate: TTL,
  }),
);
export const getPublishedPage = cache(
  unstable_cache(data.fetchPublishedPage, ["pages:one"], { tags: [TAGS.pages], revalidate: TTL }),
);
export const getFooterPages = cache(
  unstable_cache(data.fetchFooterPages, ["pages:footer"], { tags: [TAGS.pages], revalidate: TTL }),
);
export const getLivePageSlugs = cache(
  unstable_cache(data.fetchLivePageSlugs, ["pages:slugs"], { tags: [TAGS.pages], revalidate: TTL }),
);
