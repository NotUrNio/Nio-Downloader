use std::ffi::OsStr;
use std::fs::File;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use serde::Deserialize;

use crate::NIO_FLATPAK_ID;
use crate::endpoint::is_owner_only;

pub const DEVELOPMENT_HOST_CONFIG_NAME: &str = "nio-native-host.dev.json";
const MAX_DEVELOPMENT_HOST_CONFIG_BYTES: usize = 4 * 1024;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DevelopmentHostConfig {
    #[serde(rename = "bridgeDataDir")]
    bridge_data_dir: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeHostPlatform {
    Darwin,
    Linux,
    Win32,
}

pub fn current_platform() -> NativeHostPlatform {
    if cfg!(target_os = "macos") {
        NativeHostPlatform::Darwin
    } else if cfg!(target_os = "windows") {
        NativeHostPlatform::Win32
    } else {
        NativeHostPlatform::Linux
    }
}

pub fn endpoint_path(user_data: &Path) -> PathBuf {
    bridge_endpoint_path(&user_data.join("bridge"))
}

pub fn bridge_endpoint_path(bridge_data: &Path) -> PathBuf {
    bridge_data.join("endpoint.json")
}

pub fn resolve_bridge_data_dir(
    user_data: Option<&Path>,
    override_data_dir: Option<&OsStr>,
) -> Option<PathBuf> {
    match override_data_dir {
        Some(value) => absolute_directory_from_env(value),
        None => user_data.map(|base| base.join("bridge")),
    }
}

pub fn resolve_native_host_user_data_dir(
    platform: NativeHostPlatform,
    home: &Path,
    roaming_app_data: Option<&OsStr>,
) -> PathBuf {
    match platform {
        NativeHostPlatform::Darwin => home
            .join("Library")
            .join("Application Support")
            .join("Nio Downloader"),
        NativeHostPlatform::Linux => home.join(".config").join("niodownloader"),
        NativeHostPlatform::Win32 => {
            let roaming_root = roaming_app_data
                .filter(|value| !value.to_string_lossy().trim().is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join("AppData").join("Roaming"));
            roaming_root.join("Nio Downloader")
        }
    }
}

pub fn native_host_user_data_dir() -> Option<PathBuf> {
    resolve_native_host_user_data_dir_from_optional_home(
        current_platform(),
        home::home_dir().as_deref(),
        std::env::var_os("APPDATA").as_deref(),
    )
}

pub(crate) fn absolute_directory_from_env(value: &OsStr) -> Option<PathBuf> {
    let text = value.to_str()?;
    if text.is_empty() || text.trim() != text {
        return None;
    }

    let path = PathBuf::from(text);
    if !path.is_absolute() {
        return None;
    }

    let mut has_normal_component = false;
    for component in path.components() {
        match component {
            Component::Normal(_) => has_normal_component = true,
            Component::RootDir | Component::Prefix(_) => {}
            Component::CurDir | Component::ParentDir => return None,
        }
    }

    has_normal_component.then_some(path)
}

pub fn native_host_bridge_data_dir(user_data: Option<&Path>) -> Option<PathBuf> {
    let override_data_dir = std::env::var_os("NIODOWNLOADER_BRIDGE_DATA_DIR");
    let development_data_dir = if override_data_dir.is_none() {
        std::env::current_exe()
            .ok()
            .as_deref()
            .and_then(read_development_bridge_data_dir)
    } else {
        None
    };
    resolve_native_host_bridge_data_dir(
        user_data,
        override_data_dir.as_deref(),
        development_data_dir,
    )
}

fn resolve_native_host_bridge_data_dir(
    user_data: Option<&Path>,
    override_data_dir: Option<&OsStr>,
    development_data_dir: Option<PathBuf>,
) -> Option<PathBuf> {
    match override_data_dir {
        Some(value) => resolve_bridge_data_dir(user_data, Some(value)),
        None => development_data_dir.or_else(|| user_data.map(|base| base.join("bridge"))),
    }
}

fn read_development_bridge_data_dir(executable_path: &Path) -> Option<PathBuf> {
    let config_path = executable_path.parent()?.join(DEVELOPMENT_HOST_CONFIG_NAME);
    let file = File::open(config_path).ok()?;
    if !is_owner_only(&file) {
        return None;
    }

    let mut bytes = Vec::new();
    file.take((MAX_DEVELOPMENT_HOST_CONFIG_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() > MAX_DEVELOPMENT_HOST_CONFIG_BYTES {
        return None;
    }

    let config: DevelopmentHostConfig = serde_json::from_slice(&bytes).ok()?;
    absolute_directory_from_env(OsStr::new(&config.bridge_data_dir))
}

/// Resolve the bridge directory visible inside the Nio Downloader Flatpak sandbox.
///
/// The broker must not fall back to the host user's home directory: that can
/// point at a different endpoint namespace when Flatpak environment setup is
/// incomplete or spoofed.
pub fn resolve_flatpak_bridge_data_dir(
    flatpak_id: Option<&OsStr>,
    xdg_config_home: Option<&OsStr>,
) -> Option<PathBuf> {
    if flatpak_id != Some(OsStr::new(NIO_FLATPAK_ID)) {
        return None;
    }
    absolute_directory_from_env(xdg_config_home?)
        .map(|config_home| config_home.join("niodownloader").join("bridge"))
}

fn resolve_native_host_user_data_dir_from_optional_home(
    platform: NativeHostPlatform,
    home: Option<&Path>,
    roaming_app_data: Option<&OsStr>,
) -> Option<PathBuf> {
    if platform == NativeHostPlatform::Win32
        && let Some(roaming_root) =
            roaming_app_data.filter(|value| !value.to_string_lossy().trim().is_empty())
    {
        return Some(PathBuf::from(roaming_root).join("Nio Downloader"));
    }
    let home = home?;
    Some(resolve_native_host_user_data_dir(
        platform,
        home,
        roaming_app_data,
    ))
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::resolve_flatpak_bridge_data_dir;
    use super::resolve_native_host_user_data_dir_from_optional_home;
    #[cfg(unix)]
    use super::{DEVELOPMENT_HOST_CONFIG_NAME, read_development_bridge_data_dir};
    use super::{
        NativeHostPlatform, bridge_endpoint_path, endpoint_path, resolve_bridge_data_dir,
        resolve_native_host_bridge_data_dir, resolve_native_host_user_data_dir,
    };

    #[cfg(unix)]
    fn temp_dir(label: &str) -> PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "nio-native-host-user-data-{label}-{}-{id}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("create temp directory");
        path
    }

    #[test]
    fn resolves_macos_and_linux_paths() {
        assert_eq!(
            resolve_native_host_user_data_dir(
                NativeHostPlatform::Darwin,
                Path::new("/Users/me"),
                None,
            ),
            PathBuf::from("/Users/me/Library/Application Support/Nio Downloader")
        );
        assert_eq!(
            resolve_native_host_user_data_dir(
                NativeHostPlatform::Linux,
                Path::new("/home/me"),
                None,
            ),
            PathBuf::from("/home/me/.config/niodownloader")
        );
    }

    #[test]
    fn resolves_windows_roaming_path_and_fallback() {
        assert_eq!(
            resolve_native_host_user_data_dir(
                NativeHostPlatform::Win32,
                Path::new("C:/Users/me"),
                Some(OsStr::new("Z:/Profiles/me/Roaming")),
            ),
            PathBuf::from("Z:/Profiles/me/Roaming").join("Nio Downloader")
        );
        assert_eq!(
            resolve_native_host_user_data_dir(
                NativeHostPlatform::Win32,
                Path::new("C:/Users/me"),
                Some(OsStr::new("  ")),
            ),
            PathBuf::from("C:/Users/me")
                .join("AppData")
                .join("Roaming")
                .join("Nio Downloader")
        );
    }

    #[test]
    fn windows_appdata_does_not_require_home_resolution() {
        assert_eq!(
            resolve_native_host_user_data_dir_from_optional_home(
                NativeHostPlatform::Win32,
                None,
                Some(OsStr::new("Z:/Profiles/me/Roaming")),
            ),
            Some(PathBuf::from("Z:/Profiles/me/Roaming").join("Nio Downloader"))
        );
        assert_eq!(
            resolve_native_host_user_data_dir_from_optional_home(
                NativeHostPlatform::Win32,
                None,
                Some(OsStr::new(" ")),
            ),
            None
        );
    }

    #[test]
    fn endpoint_is_under_bridge_directory() {
        assert_eq!(
            endpoint_path(Path::new("/data/NioDownloader")),
            PathBuf::from("/data/NioDownloader/bridge/endpoint.json")
        );
        assert_eq!(
            bridge_endpoint_path(Path::new("/data/shared-bridge")),
            PathBuf::from("/data/shared-bridge/endpoint.json")
        );
    }

    #[test]
    fn bridge_data_override_is_absolute_and_replaces_the_fallback() {
        #[cfg(windows)]
        let override_dir = PathBuf::from(r"C:\data\snap\common\bridge");
        #[cfg(not(windows))]
        let override_dir = PathBuf::from("/data/snap/common/bridge");

        assert_eq!(
            resolve_bridge_data_dir(
                Some(Path::new("/data/NioDownloader")),
                Some(override_dir.as_os_str()),
            ),
            Some(override_dir)
        );
        assert_eq!(
            resolve_bridge_data_dir(Some(Path::new("/data/NioDownloader")), None),
            Some(PathBuf::from("/data/NioDownloader/bridge"))
        );
        assert_eq!(resolve_bridge_data_dir(None, None), None);
    }

    #[test]
    fn development_config_precedes_the_production_profile_but_not_the_environment() {
        let root = std::env::temp_dir().join("nio-native-host-precedence");
        let production = root.join("NioDownloader");
        let development = root.join("NioDownloader-dev").join("bridge");
        let override_dir = root.join("custom").join("bridge");
        assert_eq!(
            resolve_native_host_bridge_data_dir(
                Some(production.as_path()),
                None,
                Some(development.clone()),
            ),
            Some(development)
        );
        assert_eq!(
            resolve_native_host_bridge_data_dir(
                Some(production.as_path()),
                Some(override_dir.as_os_str()),
                Some(root.join("NioDownloader-dev").join("bridge")),
            ),
            Some(override_dir)
        );
    }

    #[cfg(unix)]
    #[test]
    fn reads_only_an_owner_only_development_config_beside_the_executable() {
        use std::os::unix::fs::PermissionsExt;

        let directory = temp_dir("development-config");
        let executable = directory.join("nio-native-host");
        let config_path = directory.join(DEVELOPMENT_HOST_CONFIG_NAME);
        fs::write(
            &config_path,
            r#"{"bridgeDataDir":"/data/NioDownloader-dev/bridge"}"#,
        )
        .expect("write development config");
        fs::set_permissions(&config_path, fs::Permissions::from_mode(0o600))
            .expect("secure development config");

        assert_eq!(
            read_development_bridge_data_dir(&executable),
            Some(PathBuf::from("/data/NioDownloader-dev/bridge"))
        );

        fs::set_permissions(&config_path, fs::Permissions::from_mode(0o644))
            .expect("widen development config permissions");
        assert_eq!(read_development_bridge_data_dir(&executable), None);
        fs::remove_dir_all(directory).expect("remove temp directory");
    }

    #[cfg(unix)]
    #[test]
    fn flatpak_bridge_requires_the_exact_app_id_and_absolute_xdg_config_home() {
        assert_eq!(
            resolve_flatpak_bridge_data_dir(
                Some(OsStr::new("app.niodownloader.native")),
                Some(OsStr::new(
                    "/home/me/.var/app/app.niodownloader.native/config"
                )),
            ),
            Some(PathBuf::from(
                "/home/me/.var/app/app.niodownloader.native/config/niodownloader/bridge"
            ))
        );
        for flatpak_id in [None, Some(OsStr::new("org.example.Other"))] {
            assert_eq!(
                resolve_flatpak_bridge_data_dir(
                    flatpak_id,
                    Some(OsStr::new(
                        "/home/me/.var/app/app.niodownloader.native/config"
                    )),
                ),
                None
            );
        }
        for config_home in [
            None,
            Some(OsStr::new("relative/config")),
            Some(OsStr::new("/")),
        ] {
            assert_eq!(
                resolve_flatpak_bridge_data_dir(
                    Some(OsStr::new("app.niodownloader.native")),
                    config_home,
                ),
                None
            );
        }
    }

    #[test]
    fn malformed_bridge_data_override_fails_closed() {
        for invalid in [
            "",
            " ",
            "relative/bridge",
            "/",
            "/data/common/../escape",
            "/data/common/bridge ",
        ] {
            assert_eq!(
                resolve_bridge_data_dir(Some(Path::new("/fallback")), Some(OsStr::new(invalid))),
                None,
                "{invalid:?} must not fall back to user data",
            );
        }
    }
}
