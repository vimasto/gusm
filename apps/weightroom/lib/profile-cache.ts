"use client";

import { getQueryClient } from "@/lib/query-client";
import { PROFILE_QUERY_KEY } from "@/lib/query-keys";

export function clearProfileCache() {
  void getQueryClient().invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
}
