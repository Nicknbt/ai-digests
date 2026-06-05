function encodePackage(packageName) {
  return packageName.startsWith('@')
    ? `@${encodeURIComponent(packageName.slice(1))}`
    : encodeURIComponent(packageName);
}

export async function getLatestVersion(packageName) {
  try {
    const encoded = encodePackage(packageName);
    const url = `https://registry.npmjs.org/${encoded}/latest`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`npm: ${res.status} for ${packageName}`);
      return { name: packageName, version: 'unknown' };
    }
    const data = await res.json();
    return { name: data.name, version: data.version };
  } catch (err) {
    console.warn(`npm: failed to fetch ${packageName} — ${err.message}`);
    return { name: packageName, version: 'unknown' };
  }
}

/**
 * Returns detailed info about a package including dist-tags and stability.
 * @param {string} packageName
 * @returns {Promise<{name: string, latestVersion: string, stableVersion: string|null, isStable: boolean, distTags: object}>}
 */
export async function getPackageInfo(packageName) {
  try {
    const encoded = encodePackage(packageName);
    const url = `https://registry.npmjs.org/-/package/${encoded}/dist-tags`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`npm: dist-tags ${res.status} for ${packageName}`);
      const fallback = await getLatestVersion(packageName);
      return { ...fallback, stableVersion: null, isStable: true, distTags: {} };
    }
    const distTags = await res.json();
    const latestVersion = distTags.latest || 'unknown';
    const isStable = !isPreRelease(latestVersion);

    // Find a stable version if latest is pre-release
    let stableVersion = null;
    if (!isStable) {
      for (const [tag, ver] of Object.entries(distTags)) {
        if (!isPreRelease(ver) && tag !== 'latest') {
          stableVersion = ver;
          break;
        }
      }
      // If no other stable tag, check if latest is the only tag
      if (!stableVersion) stableVersion = distTags.latest;
    }

    return {
      name: packageName,
      latestVersion,
      stableVersion,
      isStable,
      distTags,
    };
  } catch (err) {
    console.warn(`npm: failed to fetch package info for ${packageName} — ${err.message}`);
    const fallback = await getLatestVersion(packageName);
    return { ...fallback, stableVersion: null, isStable: true, distTags: {} };
  }
}

function isPreRelease(version) {
  return /-[a-zA-Z]/.test(version);
}
