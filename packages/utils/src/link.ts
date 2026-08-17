export function EXTERNAL_LINK_PROPS({ referrer = true, opener = false, follow = false } = {}) {
  const rel: string[] = [];
  if (referrer === false) {
    rel.push("noreferrer");
  }
  if (opener === false) {
    rel.push("noopener");
  }
  if (follow === false) {
    rel.push("nofollow");
  }
  return { target: "_blank", rel: rel.join(" ") } as const;
}
