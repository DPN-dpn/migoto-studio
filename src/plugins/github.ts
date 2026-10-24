import { isNewerVersion } from '../updater/version.ts';
import { platform } from '../platform/index.ts';

export interface GitHubRepoRef {
  owner: string;
  repo: string;
  tag?: string;
  directZipUrl?: string;
}

export interface GitHubPluginReleaseInfo {
  owner: string;
  repo: string;
  version: string;
  zipUrl: string;
  tagName?: string;
  releaseNotes?: string;
  isArchiveFallback?: boolean;
}

export interface PluginGitHubSource {
  owner: string;
  repo: string;
  url: string;
  installedVersion: string;
  lastCheckedVersion?: string;
  updateAvailable?: boolean;
  latestZipUrl?: string;
  checkedAt?: number;
}

/**
 * 사용자 입력 문자열에서 GitHub 저장소 및 릴리스 정보를 파싱합니다.
 * 지원 형식:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/releases/latest
 * - https://github.com/owner/repo/releases/tag/v1.0.0
 * - https://github.com/owner/repo/releases/download/v1.0.0/plugin.zip
 * - owner/repo
 */
export function parseGitHubUrl(input: string): GitHubRepoRef | null {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  // 1. 직접 다운로드 ZIP 링크: https://github.com/owner/repo/releases/download/tag/filename.zip
  const downloadMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/(.+?\.zip)$/i,
  );
  if (downloadMatch) {
    return {
      owner: downloadMatch[1],
      repo: downloadMatch[2],
      tag: downloadMatch[3],
      directZipUrl: trimmed,
    };
  }

  // 2. 릴리스 태그 링크: https://github.com/owner/repo/releases/tag/v1.0.0
  const tagMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/([^/?#]+)/i,
  );
  if (tagMatch) {
    return {
      owner: tagMatch[1],
      repo: tagMatch[2],
      tag: tagMatch[3],
    };
  }

  // 3. 릴리스 최신 링크: https://github.com/owner/repo/releases(?:/latest)?
  const releaseMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases(?:\/latest)?$/i,
  );
  if (releaseMatch) {
    return {
      owner: releaseMatch[1],
      repo: releaseMatch[2],
      tag: 'latest',
    };
  }

  // 4. 특정 브랜치/트리 링크: https://github.com/owner/repo/tree/branch-name
  const treeMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/?#]+)/i,
  );
  if (treeMatch) {
    return {
      owner: treeMatch[1],
      repo: treeMatch[2].replace(/\.git$/i, ''),
      tag: treeMatch[3],
    };
  }

  // 5. 일반 저장소 링크 또는 owner/repo 단축 형식
  const repoMatch = trimmed.match(
    /^(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/i,
  );
  if (repoMatch) {
    return {
      owner: repoMatch[1],
      repo: repoMatch[2].replace(/\.git$/i, ''),
    };
  }

  return null;
}

/**
 * GitHub API 또는 raw 저장소를 통해 최신 릴리스 및 플러그인 ZIP 다운로드 URL을 확인합니다.
 */
export async function fetchGitHubPluginRelease(ref: GitHubRepoRef): Promise<GitHubPluginReleaseInfo> {
  const { owner, repo, tag, directZipUrl } = ref;

  if (directZipUrl) {
    return {
      owner,
      repo,
      version: tag ? tag.replace(/^v/i, '') : 'latest',
      zipUrl: directZipUrl,
      tagName: tag,
    };
  }

  // 1. GitHub Releases API 조회 시도
  const releaseApiUrl = tag && tag !== 'latest'
    ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`
    : `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  try {
    const res = await fetch(releaseApiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const releaseData = await res.json();
      const tagName = releaseData.tag_name || releaseData.name || '';
      const version = tagName.replace(/^v/i, '').trim() || '1.0.0';

      // Releases asset 중 .zip 파일 탐색 (plugin.zip 또는 첫 번째 zip 파일 우선)
      if (Array.isArray(releaseData.assets) && releaseData.assets.length > 0) {
        const zipAsset = releaseData.assets.find(
          (a: any) => /\.zip$/i.test(a.name) && /plugin/i.test(a.name),
        ) || releaseData.assets.find((a: any) => /\.zip$/i.test(a.name));

        if (zipAsset && zipAsset.browser_download_url) {
          return {
            owner,
            repo,
            version,
            zipUrl: zipAsset.browser_download_url,
            tagName,
            releaseNotes: releaseData.body,
          };
        }
      }

      // asset에 zip이 없는 경우 GitHub 자동 생성 zipball_url 활용
      if (releaseData.zipball_url) {
        return {
          owner,
          repo,
          version,
          zipUrl: releaseData.zipball_url,
          tagName,
          releaseNotes: releaseData.body,
        };
      }
    }
  } catch {
    // API 제한 또는 네트워크 오류 시 아래 2단계 fallback으로 진행
  }

  // 2. Release가 없거나 API 조회가 제한된 경우:
  // raw plugin.json / manifest.json 에서 version 파악 후 메인 브랜치 아카이브 ZIP을 다운로드
  const candidateBranches: string[] = [];
  if (tag && tag !== 'latest') {
    candidateBranches.push(tag);
  }
  if (!candidateBranches.includes('main')) candidateBranches.push('main');
  if (!candidateBranches.includes('master')) candidateBranches.push('master');

  let version = '1.0.0';
  for (const branch of candidateBranches) {
    for (const manifestName of ['plugin.json', 'manifest.json']) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${manifestName}?t=${Date.now()}`;
        const manifestRes = await fetch(rawUrl, {
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          cache: 'no-store',
        });
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          if (manifest.version) {
            version = manifest.version;
            return {
              owner,
              repo,
              version,
              zipUrl: `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`,
              isArchiveFallback: true,
            };
          }
        }
      } catch {}
    }
  }

  // 최종 fallback: main.zip
  const defaultBranch = candidateBranches[0] || 'main';
  return {
    owner,
    repo,
    version,
    zipUrl: `https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch}.zip`,
    isArchiveFallback: true,
  };
}

/**
 * 지정된 URL로부터 ZIP 파일 바이트를 비동기 다운로드합니다.
 * 데스크톱에서는 curl/powershell을 활용하여 브라우저 CORS 제약을 우회합니다.
 */
export async function downloadZipBytes(url: string): Promise<Uint8Array> {
  if (platform().downloadBinary) {
    return await platform().downloadBinary!(url);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`플러그인 다운로드 실패 (${res.status} ${res.statusText}): ${url}`);
  }
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * 저장된 GitHub 출처 정보를 바탕으로 최신 릴리스 버전과 업데이트 여부를 확인합니다.
 */
export async function checkGitHubPluginUpdate(
  source: PluginGitHubSource,
): Promise<{ updateAvailable: boolean; latestVersion: string; zipUrl: string } | null> {
  try {
    const release = await fetchGitHubPluginRelease({
      owner: source.owner,
      repo: source.repo,
    });

    const isNewer = isNewerVersion(source.installedVersion, release.version);
    return {
      updateAvailable: isNewer,
      latestVersion: release.version,
      zipUrl: release.zipUrl,
    };
  } catch {
    return null;
  }
}
